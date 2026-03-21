"""
Lane state machine — manages the lifecycle of a vehicle session
from detection through gate operation and payment.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional

from config import ConfidenceTier, LaneMode, settings
from database import db

logger = logging.getLogger(__name__)


class LaneState(str, Enum):
    IDLE = "idle"
    DETECTING = "detecting"
    CLASSIFYING = "classifying"
    READING_PLATE = "reading_plate"
    PLATE_CONFIRMED = "plate_confirmed"
    CHECKING_RULES = "checking_rules"
    PLATE_MANUAL = "plate_manual"
    ENTRY_FREE = "entry_free"
    ENTRY_LOG = "entry_log"
    GATE_OPENING = "gate_opening"
    GATE_OPEN = "gate_open"
    GATE_CLOSING = "gate_closing"
    PAYMENT_SCREEN = "payment_screen"
    PAYMENT_NFC = "payment_nfc"
    PAYMENT_QRIS = "payment_qris"
    PAYMENT_CONFIRMED = "payment_confirmed"
    PAYMENT_TIMEOUT = "payment_timeout"
    PAYMENT_OVERRIDE = "payment_override"
    ERROR = "error"


# Valid transitions
TRANSITIONS: dict[LaneState, list[LaneState]] = {
    LaneState.IDLE: [LaneState.DETECTING],
    LaneState.DETECTING: [LaneState.CLASSIFYING, LaneState.IDLE, LaneState.ERROR],
    LaneState.CLASSIFYING: [LaneState.READING_PLATE, LaneState.ERROR],
    LaneState.READING_PLATE: [
        LaneState.PLATE_CONFIRMED, LaneState.PLATE_MANUAL, LaneState.ERROR,
    ],
    LaneState.PLATE_CONFIRMED: [LaneState.CHECKING_RULES, LaneState.PLATE_MANUAL],
    LaneState.CHECKING_RULES: [
        LaneState.ENTRY_FREE, LaneState.ENTRY_LOG,
        LaneState.GATE_OPENING, LaneState.PAYMENT_SCREEN,
        LaneState.ERROR,
    ],
    LaneState.PLATE_MANUAL: [LaneState.CHECKING_RULES, LaneState.IDLE, LaneState.ERROR],
    LaneState.ENTRY_FREE: [LaneState.GATE_OPENING],
    LaneState.ENTRY_LOG: [LaneState.GATE_OPENING],
    LaneState.GATE_OPENING: [LaneState.GATE_OPEN, LaneState.ERROR],
    LaneState.GATE_OPEN: [LaneState.GATE_CLOSING],
    LaneState.GATE_CLOSING: [LaneState.IDLE, LaneState.ERROR],
    LaneState.PAYMENT_SCREEN: [
        LaneState.PAYMENT_NFC, LaneState.PAYMENT_QRIS,
        LaneState.PAYMENT_TIMEOUT, LaneState.PAYMENT_OVERRIDE,
    ],
    LaneState.PAYMENT_NFC: [
        LaneState.PAYMENT_CONFIRMED, LaneState.PAYMENT_SCREEN,
        LaneState.PAYMENT_TIMEOUT,
    ],
    LaneState.PAYMENT_QRIS: [
        LaneState.PAYMENT_CONFIRMED, LaneState.PAYMENT_SCREEN,
        LaneState.PAYMENT_TIMEOUT,
    ],
    LaneState.PAYMENT_CONFIRMED: [LaneState.GATE_OPENING],
    LaneState.PAYMENT_TIMEOUT: [
        LaneState.PAYMENT_OVERRIDE, LaneState.PAYMENT_SCREEN, LaneState.IDLE,
    ],
    LaneState.PAYMENT_OVERRIDE: [LaneState.GATE_OPENING, LaneState.IDLE],
    LaneState.ERROR: [LaneState.IDLE],
}


class LaneStateMachine:
    """
    Manages the state of a single parking lane.
    Tracks transitions and holds current session context.
    """

    def __init__(self) -> None:
        self._state = LaneState.IDLE
        self._session: dict[str, Any] = {}
        self._state_listeners: list[Callable[[LaneState, LaneState, dict[str, Any]], None]] = []
        self._lock = asyncio.Lock()
        self._history: list[tuple[LaneState, str]] = []

    @property
    def state(self) -> LaneState:
        return self._state

    @property
    def session(self) -> dict[str, Any]:
        return self._session.copy()

    @property
    def is_busy(self) -> bool:
        return self._state != LaneState.IDLE

    def add_listener(
        self, callback: Callable[[LaneState, LaneState, dict[str, Any]], None]
    ) -> None:
        """Register a state change listener."""
        self._state_listeners.append(callback)

    async def transition(self, new_state: LaneState, **context: Any) -> bool:
        """
        Attempt a state transition.
        Returns True if the transition was valid and executed.
        """
        async with self._lock:
            allowed = TRANSITIONS.get(self._state, [])
            if new_state not in allowed:
                logger.warning(
                    "Invalid transition: %s → %s (allowed: %s)",
                    self._state.value, new_state.value,
                    [s.value for s in allowed],
                )
                return False

            old_state = self._state
            self._state = new_state
            self._session.update(context)

            timestamp = datetime.now(timezone.utc).isoformat()
            self._history.append((new_state, timestamp))
            # Keep only last 50 entries
            if len(self._history) > 50:
                self._history = self._history[-50:]

            logger.info(
                "State: %s → %s | ctx=%s",
                old_state.value, new_state.value,
                {k: v for k, v in context.items() if k != "image"},
            )

            # Notify listeners
            for listener in self._state_listeners:
                try:
                    listener(old_state, new_state, self._session)
                except Exception:
                    logger.exception("State listener error")

            return True

    async def force_state(self, state: LaneState, reason: str = "") -> None:
        """Force a state change (bypass transition rules)."""
        async with self._lock:
            old = self._state
            self._state = state
            logger.warning(
                "Forced state: %s → %s (reason: %s)",
                old.value, state.value, reason,
            )
            self._history.append((state, datetime.now(timezone.utc).isoformat()))

    def new_session(self) -> str:
        """Start a new session and return its UUID."""
        session_uuid = str(uuid.uuid4())
        self._session = {
            "session_uuid": session_uuid,
            "location_id": settings.cloud.location_id,
            "lane_id": settings.cloud.lane_id,
            "lane_mode": settings.cloud.lane_mode.value,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        logger.info("New session: %s", session_uuid)
        return session_uuid

    def clear_session(self) -> None:
        """Clear the current session context."""
        self._session = {}

    async def reset(self) -> None:
        """Reset to IDLE state, clearing session."""
        self.clear_session()
        await self.force_state(LaneState.IDLE, reason="reset")

    def get_status(self) -> dict[str, Any]:
        """Get current state machine status for API/UI."""
        return {
            "state": self._state.value,
            "session_uuid": self._session.get("session_uuid"),
            "plate_number": self._session.get("plate_number"),
            "vehicle_type": self._session.get("vehicle_type"),
            "lane_mode": settings.cloud.lane_mode.value,
            "lane_id": settings.cloud.lane_id,
            "is_busy": self.is_busy,
        }


# Module-level singleton
lane_sm = LaneStateMachine()
