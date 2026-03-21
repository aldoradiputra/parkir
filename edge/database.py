"""
SQLite database setup and access layer for the Edge Node.
"""
from __future__ import annotations

import asyncio
import logging
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

import aiosqlite

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid    TEXT UNIQUE NOT NULL,
    location_id     TEXT NOT NULL,
    lane_id         TEXT NOT NULL,
    lane_mode       TEXT NOT NULL CHECK(lane_mode IN ('entry', 'exit')),
    plate_number    TEXT,
    vehicle_type    TEXT CHECK(vehicle_type IN ('car', 'motorcycle', 'unknown')),
    confidence      REAL,
    confidence_tier TEXT CHECK(confidence_tier IN ('high', 'medium', 'low', 'fail', 'manual')),
    entry_time      TEXT,
    exit_time       TEXT,
    duration_minutes INTEGER,
    tariff_amount   INTEGER DEFAULT 0,
    payment_method  TEXT CHECK(payment_method IN ('qris', 'nfc', 'cash', 'member', 'free', NULL)),
    payment_status  TEXT DEFAULT 'pending'
                    CHECK(payment_status IN ('pending', 'paid', 'timeout', 'override', 'free')),
    payment_ref     TEXT,
    member_id       TEXT,
    image_path      TEXT,
    override_by     TEXT,
    override_reason TEXT,
    synced          INTEGER DEFAULT 0,
    sync_attempts   INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_synced ON sessions(synced);
CREATE INDEX IF NOT EXISTS idx_sessions_plate ON sessions(plate_number);
CREATE INDEX IF NOT EXISTS idx_sessions_uuid ON sessions(session_uuid);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);

CREATE TABLE IF NOT EXISTS config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS nfc_transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid    TEXT NOT NULL,
    card_type       TEXT NOT NULL CHECK(card_type IN ('flazz', 'brizzi', 'tapcash', 'mandiri', 'unknown')),
    card_uid        TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    balance_before  INTEGER,
    balance_after   INTEGER,
    status          TEXT DEFAULT 'pending'
                    CHECK(status IN ('pending', 'success', 'failed', 'insufficient')),
    error_message   TEXT,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (session_uuid) REFERENCES sessions(session_uuid)
);

CREATE INDEX IF NOT EXISTS idx_nfc_session ON nfc_transactions(session_uuid);
CREATE INDEX IF NOT EXISTS idx_nfc_card ON nfc_transactions(card_uid);

CREATE TABLE IF NOT EXISTS members (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id       TEXT UNIQUE NOT NULL,
    plate_number    TEXT NOT NULL,
    name            TEXT,
    vehicle_type    TEXT,
    valid_from      TEXT,
    valid_until     TEXT,
    prepaid_balance INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_members_plate ON members(plate_number);

CREATE TABLE IF NOT EXISTS whitelist (
    plate_number    TEXT PRIMARY KEY,
    note            TEXT,
    updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS blacklist (
    plate_number    TEXT PRIMARY KEY,
    reason          TEXT,
    updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tariffs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_type    TEXT NOT NULL,
    first_hour      INTEGER NOT NULL DEFAULT 0,
    next_hour       INTEGER NOT NULL DEFAULT 0,
    max_daily       INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type      TEXT NOT NULL,
    severity        TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
    message         TEXT NOT NULL,
    resolved        INTEGER DEFAULT 0,
    synced          INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_synced ON alerts(synced);
"""


class Database:
    """Async SQLite database wrapper."""

    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or settings.db_path
        self._db: Optional[aiosqlite.Connection] = None

    async def initialize(self) -> None:
        """Create database and tables."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA foreign_keys=ON")
        await self._db.execute("PRAGMA busy_timeout=5000")
        await self._db.executescript(SCHEMA_SQL)
        await self._db.commit()
        logger.info("Database initialized at %s", self.db_path)

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    @asynccontextmanager
    async def connection(self) -> AsyncGenerator[aiosqlite.Connection, None]:
        if not self._db:
            await self.initialize()
        assert self._db is not None
        yield self._db

    # -----------------------------------------------------------------------
    # Session helpers
    # -----------------------------------------------------------------------
    async def insert_session(self, data: dict[str, Any]) -> int:
        async with self.connection() as db:
            cols = ", ".join(data.keys())
            placeholders = ", ".join(["?"] * len(data))
            cursor = await db.execute(
                f"INSERT INTO sessions ({cols}) VALUES ({placeholders})",
                list(data.values()),
            )
            await db.commit()
            return cursor.lastrowid  # type: ignore[return-value]

    async def update_session(self, session_uuid: str, data: dict[str, Any]) -> None:
        async with self.connection() as db:
            data["updated_at"] = datetime.now(timezone.utc).isoformat()
            set_clause = ", ".join(f"{k}=?" for k in data.keys())
            await db.execute(
                f"UPDATE sessions SET {set_clause} WHERE session_uuid=?",
                [*data.values(), session_uuid],
            )
            await db.commit()

    async def get_session(self, session_uuid: str) -> Optional[dict[str, Any]]:
        async with self.connection() as db:
            cursor = await db.execute(
                "SELECT * FROM sessions WHERE session_uuid=?", (session_uuid,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_unsynced_sessions(self, limit: int = 100) -> list[dict[str, Any]]:
        async with self.connection() as db:
            cursor = await db.execute(
                "SELECT * FROM sessions WHERE synced=0 ORDER BY created_at ASC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def mark_synced(self, session_uuids: list[str]) -> None:
        async with self.connection() as db:
            placeholders = ",".join(["?"] * len(session_uuids))
            await db.execute(
                f"UPDATE sessions SET synced=1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') "
                f"WHERE session_uuid IN ({placeholders})",
                session_uuids,
            )
            await db.commit()

    async def increment_sync_attempts(self, session_uuids: list[str]) -> None:
        async with self.connection() as db:
            placeholders = ",".join(["?"] * len(session_uuids))
            await db.execute(
                f"UPDATE sessions SET sync_attempts=sync_attempts+1 "
                f"WHERE session_uuid IN ({placeholders})",
                session_uuids,
            )
            await db.commit()

    # -----------------------------------------------------------------------
    # NFC transaction helpers
    # -----------------------------------------------------------------------
    async def insert_nfc_transaction(self, data: dict[str, Any]) -> int:
        async with self.connection() as db:
            cols = ", ".join(data.keys())
            placeholders = ", ".join(["?"] * len(data))
            cursor = await db.execute(
                f"INSERT INTO nfc_transactions ({cols}) VALUES ({placeholders})",
                list(data.values()),
            )
            await db.commit()
            return cursor.lastrowid  # type: ignore[return-value]

    async def update_nfc_transaction(self, txn_id: int, data: dict[str, Any]) -> None:
        async with self.connection() as db:
            set_clause = ", ".join(f"{k}=?" for k in data.keys())
            await db.execute(
                f"UPDATE nfc_transactions SET {set_clause} WHERE id=?",
                [*data.values(), txn_id],
            )
            await db.commit()

    # -----------------------------------------------------------------------
    # Config helpers
    # -----------------------------------------------------------------------
    async def get_config(self, key: str) -> Optional[str]:
        async with self.connection() as db:
            cursor = await db.execute("SELECT value FROM config WHERE key=?", (key,))
            row = await cursor.fetchone()
            return row["value"] if row else None

    async def set_config(self, key: str, value: str) -> None:
        async with self.connection() as db:
            await db.execute(
                "INSERT OR REPLACE INTO config (key, value, updated_at) "
                "VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                (key, value),
            )
            await db.commit()

    # -----------------------------------------------------------------------
    # Member helpers
    # -----------------------------------------------------------------------
    async def get_member_by_plate(self, plate: str) -> Optional[dict[str, Any]]:
        async with self.connection() as db:
            cursor = await db.execute(
                "SELECT * FROM members WHERE plate_number=? AND is_active=1", (plate,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def upsert_members(self, members: list[dict[str, Any]]) -> None:
        async with self.connection() as db:
            for m in members:
                await db.execute(
                    "INSERT OR REPLACE INTO members "
                    "(member_id, plate_number, name, vehicle_type, valid_from, valid_until, "
                    "prepaid_balance, is_active, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                    (
                        m["member_id"], m["plate_number"], m.get("name"),
                        m.get("vehicle_type"), m.get("valid_from"), m.get("valid_until"),
                        m.get("prepaid_balance", 0), m.get("is_active", 1),
                    ),
                )
            await db.commit()

    # -----------------------------------------------------------------------
    # Whitelist / Blacklist
    # -----------------------------------------------------------------------
    async def is_whitelisted(self, plate: str) -> bool:
        async with self.connection() as db:
            cursor = await db.execute(
                "SELECT 1 FROM whitelist WHERE plate_number=?", (plate,)
            )
            return (await cursor.fetchone()) is not None

    async def is_blacklisted(self, plate: str) -> bool:
        async with self.connection() as db:
            cursor = await db.execute(
                "SELECT 1 FROM blacklist WHERE plate_number=?", (plate,)
            )
            return (await cursor.fetchone()) is not None

    async def replace_whitelist(self, plates: list[dict[str, Any]]) -> None:
        async with self.connection() as db:
            await db.execute("DELETE FROM whitelist")
            for p in plates:
                await db.execute(
                    "INSERT INTO whitelist (plate_number, note) VALUES (?, ?)",
                    (p["plate_number"], p.get("note")),
                )
            await db.commit()

    async def replace_blacklist(self, plates: list[dict[str, Any]]) -> None:
        async with self.connection() as db:
            await db.execute("DELETE FROM blacklist")
            for p in plates:
                await db.execute(
                    "INSERT INTO blacklist (plate_number, reason) VALUES (?, ?)",
                    (p["plate_number"], p.get("reason")),
                )
            await db.commit()

    # -----------------------------------------------------------------------
    # Tariff helpers
    # -----------------------------------------------------------------------
    async def get_tariff(self, vehicle_type: str) -> Optional[dict[str, Any]]:
        async with self.connection() as db:
            cursor = await db.execute(
                "SELECT * FROM tariffs WHERE vehicle_type=?", (vehicle_type,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def replace_tariffs(self, tariffs: list[dict[str, Any]]) -> None:
        async with self.connection() as db:
            await db.execute("DELETE FROM tariffs")
            for t in tariffs:
                await db.execute(
                    "INSERT INTO tariffs (vehicle_type, first_hour, next_hour, max_daily) "
                    "VALUES (?, ?, ?, ?)",
                    (t["vehicle_type"], t["first_hour"], t["next_hour"], t["max_daily"]),
                )
            await db.commit()

    # -----------------------------------------------------------------------
    # Alert helpers
    # -----------------------------------------------------------------------
    async def insert_alert(self, alert_type: str, severity: str, message: str) -> int:
        async with self.connection() as db:
            cursor = await db.execute(
                "INSERT INTO alerts (alert_type, severity, message) VALUES (?, ?, ?)",
                (alert_type, severity, message),
            )
            await db.commit()
            return cursor.lastrowid  # type: ignore[return-value]

    async def get_unsynced_alerts(self, limit: int = 50) -> list[dict[str, Any]]:
        async with self.connection() as db:
            cursor = await db.execute(
                "SELECT * FROM alerts WHERE synced=0 ORDER BY created_at ASC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def mark_alerts_synced(self, alert_ids: list[int]) -> None:
        async with self.connection() as db:
            placeholders = ",".join(["?"] * len(alert_ids))
            await db.execute(
                f"UPDATE alerts SET synced=1 WHERE id IN ({placeholders})",
                alert_ids,
            )
            await db.commit()


# Module-level singleton
db = Database()
