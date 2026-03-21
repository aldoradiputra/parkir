"""
Alert system — monitors lane health, gate status, payment timeouts,
and ANPR failure rates. Stores alerts locally and syncs to cloud.
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional

from database import db

logger = logging.getLogger(__name__)


class AlertType(str, Enum):
    LANE_OFFLINE = "lane_offline"
    GATE_STUCK = "gate_stuck"
    PAYMENT_TIMEOUT = "payment_timeout"
    ANPR_FAILURE_RATE = "anpr_failure_rate"
    CAMERA_ERROR = "camera_error"
    NFC_READER_ERROR = "nfc_reader_error"
    PRINTER_ERROR = "printer_error"
    SYNC_FAILURE = "sync_failure"
    EXTENDED_OFFLINE = "extended_offline"
    SENSOR_FAULT = "sensor_fault"
    EMERGENCY_OVERRIDE = "emergency_override"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Alert:
    alert_type: AlertType
    severity: Severity
    message: str
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    db_id: Optional[int] = None


class ANPRMetrics:
    """Track ANPR success/failure rates over a sliding window."""

    def __init__(self, window_size: int = 100) -> None:
        self._window_size = window_size
        self._results: deque[bool] = deque(maxlen=window_size)
        self._failure_threshold = 0.5  # Alert if >50% failures

    def record(self, success: bool) -> None:
        self._results.append(success)

    @property
    def failure_rate(self) -> float:
        if not self._results:
            return 0.0
        failures = sum(1 for r in self._results if not r)
        return failures / len(self._results)

    @property
    def total_count(self) -> int:
        return len(self._results)

    @property
    def is_high_failure_rate(self) -> bool:
        # Need at least 10 samples before alerting
        return len(self._results) >= 10 and self.failure_rate > self._failure_threshold


class AlertManager:
    """Centralized alert management for the Edge Node."""

    def __init__(self) -> None:
        self._anpr_metrics = ANPRMetrics()
        self._active_alerts: dict[AlertType, Alert] = {}
        self._alert_callbacks: list[Callable[[Alert], None]] = []
        self._last_heartbeat: Optional[float] = None
        self._monitor_task: Optional[asyncio.Task] = None

    @property
    def anpr_metrics(self) -> ANPRMetrics:
        return self._anpr_metrics

    def add_callback(self, callback: Callable[[Alert], None]) -> None:
        """Register an alert callback (e.g., for UI notification)."""
        self._alert_callbacks.append(callback)

    # -------------------------------------------------------------------
    # Alert creation
    # -------------------------------------------------------------------
    async def raise_alert(
        self,
        alert_type: AlertType,
        severity: Severity,
        message: str,
    ) -> Alert:
        """Create and store an alert."""
        alert = Alert(
            alert_type=alert_type,
            severity=severity,
            message=message,
        )

        # Store in database
        db_id = await db.insert_alert(
            alert_type=alert_type.value,
            severity=severity.value,
            message=message,
        )
        alert.db_id = db_id
        self._active_alerts[alert_type] = alert

        logger.log(
            logging.CRITICAL if severity == Severity.CRITICAL else
            logging.WARNING if severity == Severity.WARNING else logging.INFO,
            "ALERT [%s] %s: %s", severity.value, alert_type.value, message,
        )

        # Notify callbacks
        for cb in self._alert_callbacks:
            try:
                cb(alert)
            except Exception:
                logger.debug("Alert callback error", exc_info=True)

        return alert

    async def resolve_alert(self, alert_type: AlertType) -> None:
        """Mark an alert type as resolved."""
        if alert_type in self._active_alerts:
            del self._active_alerts[alert_type]
            logger.info("Alert resolved: %s", alert_type.value)

    def is_active(self, alert_type: AlertType) -> bool:
        return alert_type in self._active_alerts

    # -------------------------------------------------------------------
    # Specific alert triggers
    # -------------------------------------------------------------------
    async def on_lane_offline(self) -> None:
        if not self.is_active(AlertType.LANE_OFFLINE):
            await self.raise_alert(
                AlertType.LANE_OFFLINE,
                Severity.WARNING,
                "Lane offline — tidak ada koneksi ke server",
            )

    async def on_lane_online(self) -> None:
        await self.resolve_alert(AlertType.LANE_OFFLINE)

    async def on_gate_stuck(self, seconds_open: float) -> None:
        await self.raise_alert(
            AlertType.GATE_STUCK,
            Severity.CRITICAL,
            f"Gate terbuka terlalu lama ({seconds_open:.0f}s) — kemungkinan stuck",
        )

    async def on_gate_unstuck(self) -> None:
        await self.resolve_alert(AlertType.GATE_STUCK)

    async def on_payment_timeout(self, session_uuid: str, amount: int) -> None:
        await self.raise_alert(
            AlertType.PAYMENT_TIMEOUT,
            Severity.WARNING,
            f"Pembayaran timeout — sesi {session_uuid[:8]}, jumlah Rp {amount:,}".replace(",", "."),
        )

    async def on_anpr_result(self, success: bool) -> None:
        """Record ANPR result and check failure rate."""
        self._anpr_metrics.record(success)
        if self._anpr_metrics.is_high_failure_rate:
            if not self.is_active(AlertType.ANPR_FAILURE_RATE):
                await self.raise_alert(
                    AlertType.ANPR_FAILURE_RATE,
                    Severity.WARNING,
                    f"Tingkat kegagalan ANPR tinggi: {self._anpr_metrics.failure_rate:.0%} "
                    f"dari {self._anpr_metrics.total_count} percobaan terakhir",
                )
        elif self.is_active(AlertType.ANPR_FAILURE_RATE):
            await self.resolve_alert(AlertType.ANPR_FAILURE_RATE)

    async def on_camera_error(self, camera: str) -> None:
        await self.raise_alert(
            AlertType.CAMERA_ERROR,
            Severity.CRITICAL,
            f"Kamera {camera} error — tidak dapat menangkap gambar",
        )

    async def on_sensor_fault(self) -> None:
        await self.raise_alert(
            AlertType.SENSOR_FAULT,
            Severity.WARNING,
            "Sensor IR fault — hanya beam atas terdeteksi",
        )

    async def on_emergency_override(self) -> None:
        await self.raise_alert(
            AlertType.EMERGENCY_OVERRIDE,
            Severity.CRITICAL,
            "Tombol darurat ditekan — gate dibuka paksa",
        )

    async def on_extended_offline(self) -> None:
        await self.raise_alert(
            AlertType.EXTENDED_OFFLINE,
            Severity.CRITICAL,
            "Lane offline lebih dari 24 jam — perlu pengecekan jaringan",
        )

    # -------------------------------------------------------------------
    # Monitoring loop
    # -------------------------------------------------------------------
    async def start_monitoring(self) -> None:
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("Alert monitoring started")

    async def stop_monitoring(self) -> None:
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

    async def _monitor_loop(self) -> None:
        """Periodic health check loop."""
        while True:
            try:
                await asyncio.sleep(30)
                # ANPR metrics check is handled in on_anpr_result
                # Gate stuck is handled by gate controller
                # Connectivity is handled by sync engine
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Alert monitor error")

    # -------------------------------------------------------------------
    # Status
    # -------------------------------------------------------------------
    def get_status(self) -> dict[str, Any]:
        return {
            "active_alerts": [
                {
                    "type": a.alert_type.value,
                    "severity": a.severity.value,
                    "message": a.message,
                    "created_at": a.created_at,
                }
                for a in self._active_alerts.values()
            ],
            "anpr_failure_rate": round(self._anpr_metrics.failure_rate, 3),
            "anpr_total_reads": self._anpr_metrics.total_count,
        }


# Module-level singleton
alert_manager = AlertManager()
