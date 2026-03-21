"""
Offline sync engine — manages connectivity states and bidirectional
data sync between Edge Node and Cloud API.

Connectivity states:
- fully_online:     Cloud reachable, all features active
- intermittent:     Unstable, queue and retry
- offline:          No connectivity, full local operation
- extended_offline: Offline > 24h, alert management
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from config import ConnectivityState, settings
from database import db

logger = logging.getLogger(__name__)

# Extended offline threshold: 24 hours
EXTENDED_OFFLINE_THRESHOLD_S = 24 * 3600


class SyncEngine:
    """Bidirectional sync between Edge Node and Cloud."""

    def __init__(self) -> None:
        self._cloud_url = settings.cloud.api_url
        self._api_key = settings.cloud.lane_api_key
        self._location_id = settings.cloud.location_id
        self._lane_id = settings.cloud.lane_id
        self._sync_interval = settings.timing.sync_interval_s
        self._state = ConnectivityState.OFFLINE
        self._last_online: Optional[float] = None
        self._consecutive_failures = 0
        self._http: Optional[httpx.AsyncClient] = None
        self._running = False
        self._task: Optional[asyncio.Task] = None

    @property
    def connectivity_state(self) -> ConnectivityState:
        return self._state

    @property
    def is_online(self) -> bool:
        return self._state in (ConnectivityState.FULLY_ONLINE, ConnectivityState.INTERMITTENT)

    # -------------------------------------------------------------------
    # HTTP client
    # -------------------------------------------------------------------
    async def _get_client(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                base_url=self._cloud_url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                    "X-Location-ID": self._location_id,
                    "X-Lane-ID": self._lane_id,
                },
                timeout=10.0,
            )
        return self._http

    # -------------------------------------------------------------------
    # Connectivity check
    # -------------------------------------------------------------------
    async def check_connectivity(self) -> ConnectivityState:
        """
        Check internet and cloud API connectivity.
        Updates internal state accordingly.
        """
        try:
            client = await self._get_client()
            resp = await client.get("/api/v1/health", timeout=5.0)
            if resp.status_code == 200:
                self._consecutive_failures = 0
                self._last_online = time.monotonic()
                self._state = ConnectivityState.FULLY_ONLINE
                return self._state
        except Exception:
            pass

        # Cloud unreachable — check basic internet
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                await c.get("https://www.google.com/generate_204")
                # Internet works but cloud is down
                self._consecutive_failures += 1
                if self._consecutive_failures >= 3:
                    self._state = ConnectivityState.INTERMITTENT
                else:
                    self._state = ConnectivityState.INTERMITTENT
                return self._state
        except Exception:
            pass

        # Fully offline
        self._consecutive_failures += 1

        if self._last_online:
            offline_duration = time.monotonic() - self._last_online
            if offline_duration > EXTENDED_OFFLINE_THRESHOLD_S:
                self._state = ConnectivityState.EXTENDED_OFFLINE
            else:
                self._state = ConnectivityState.OFFLINE
        else:
            self._state = ConnectivityState.OFFLINE

        return self._state

    # -------------------------------------------------------------------
    # Push unsynced sessions to cloud (batch)
    # -------------------------------------------------------------------
    async def push_sessions(self) -> int:
        """
        Push unsynced sessions to cloud API in batches of 100.
        Returns number of successfully synced sessions.
        """
        if not self.is_online:
            return 0

        sessions = await db.get_unsynced_sessions(limit=100)
        if not sessions:
            return 0

        logger.info("Pushing %d unsynced sessions to cloud", len(sessions))

        try:
            client = await self._get_client()
            payload = {
                "location_id": self._location_id,
                "lane_id": self._lane_id,
                "sessions": sessions,
            }
            resp = await client.post("/api/v1/sync/sessions", json=payload)
            resp.raise_for_status()
            data = resp.json()

            synced_uuids = data.get("synced", [])
            if synced_uuids:
                await db.mark_synced(synced_uuids)
                logger.info("Synced %d sessions to cloud", len(synced_uuids))

            failed_uuids = data.get("failed", [])
            if failed_uuids:
                await db.increment_sync_attempts(failed_uuids)
                logger.warning("%d sessions failed to sync", len(failed_uuids))

            return len(synced_uuids)

        except httpx.HTTPError as exc:
            logger.warning("Failed to push sessions: %s", exc)
            uuids = [s["session_uuid"] for s in sessions]
            await db.increment_sync_attempts(uuids)
            return 0

    # -------------------------------------------------------------------
    # Push alerts
    # -------------------------------------------------------------------
    async def push_alerts(self) -> int:
        """Push unsynced alerts to cloud."""
        if not self.is_online:
            return 0

        alerts = await db.get_unsynced_alerts(limit=50)
        if not alerts:
            return 0

        try:
            client = await self._get_client()
            resp = await client.post("/api/v1/sync/alerts", json={
                "location_id": self._location_id,
                "lane_id": self._lane_id,
                "alerts": alerts,
            })
            resp.raise_for_status()
            alert_ids = [a["id"] for a in alerts]
            await db.mark_alerts_synced(alert_ids)
            logger.info("Synced %d alerts to cloud", len(alerts))
            return len(alerts)
        except Exception:
            logger.warning("Failed to push alerts", exc_info=True)
            return 0

    # -------------------------------------------------------------------
    # Pull config updates from cloud
    # -------------------------------------------------------------------
    async def pull_config(self) -> bool:
        """
        Pull latest configuration from cloud:
        tariffs, whitelist, blacklist, members.
        """
        if not self.is_online:
            return False

        try:
            client = await self._get_client()
            resp = await client.get(
                "/api/v1/sync/config",
                params={
                    "location_id": self._location_id,
                    "lane_id": self._lane_id,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # Update tariffs
            if "tariffs" in data:
                await db.replace_tariffs(data["tariffs"])
                logger.info("Updated %d tariff entries", len(data["tariffs"]))

            # Update whitelist
            if "whitelist" in data:
                await db.replace_whitelist(data["whitelist"])
                logger.info("Updated %d whitelist entries", len(data["whitelist"]))

            # Update blacklist
            if "blacklist" in data:
                await db.replace_blacklist(data["blacklist"])
                logger.info("Updated %d blacklist entries", len(data["blacklist"]))

            # Update members
            if "members" in data:
                await db.upsert_members(data["members"])
                logger.info("Updated %d member entries", len(data["members"]))

            # Store last sync timestamp
            await db.set_config(
                "last_config_sync",
                datetime.now(timezone.utc).isoformat(),
            )

            return True

        except httpx.HTTPError as exc:
            logger.warning("Failed to pull config: %s", exc)
            return False

    # -------------------------------------------------------------------
    # Heartbeat
    # -------------------------------------------------------------------
    async def send_heartbeat(self) -> bool:
        """Send heartbeat to cloud with lane status."""
        if not self.is_online:
            return False

        try:
            client = await self._get_client()
            resp = await client.post("/api/v1/heartbeat", json={
                "location_id": self._location_id,
                "lane_id": self._lane_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "connectivity": self._state.value,
                "uptime_s": time.monotonic(),
            })
            resp.raise_for_status()
            return True
        except Exception:
            logger.debug("Heartbeat failed", exc_info=True)
            return False

    # -------------------------------------------------------------------
    # Main sync cycle
    # -------------------------------------------------------------------
    async def sync_cycle(self) -> None:
        """Execute one complete sync cycle."""
        # 1. Check connectivity
        state = await self.check_connectivity()
        logger.debug("Connectivity: %s", state.value)

        if not self.is_online:
            logger.debug("Offline — skipping sync")
            return

        # 2. Push unsynced data
        await self.push_sessions()
        await self.push_alerts()

        # 3. Pull config updates
        await self.pull_config()

    # -------------------------------------------------------------------
    # Background loop
    # -------------------------------------------------------------------
    async def start(self) -> None:
        """Start the background sync loop."""
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "Sync engine started (interval: %ds)", self._sync_interval,
        )

    async def stop(self) -> None:
        """Stop the background sync loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._http and not self._http.is_closed:
            await self._http.aclose()
        logger.info("Sync engine stopped")

    async def _run_loop(self) -> None:
        """Background sync loop."""
        while self._running:
            try:
                await self.sync_cycle()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Sync cycle error")

            await asyncio.sleep(self._sync_interval)


# Module-level singleton
sync_engine = SyncEngine()
