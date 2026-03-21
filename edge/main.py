"""
Edge Node entry point — initializes all subsystems, starts FastAPI server,
background sync loop, heartbeat, and GPIO event listeners.
"""
from __future__ import annotations

import asyncio
import logging
import signal
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI

from alerts import AlertType, Severity, alert_manager
from anpr.engine import ANPREngine, anpr_engine
from anpr.vehicle_classifier import VehicleType, vehicle_classifier
from api import app
from booth_ui import BoothUI, ScreenState, booth_ui
from config import ConfidenceTier, LaneMode, settings
from database import db
from gate.controller import GateState, gate_controller
from members import member_manager
from payment.nfc import NFCStatus, nfc_payment
from payment.qris import QRISStatus, qris_payment
from receipt import ReceiptData, receipt_manager
from state_machine import LaneState, lane_sm
from sync import sync_engine

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
def setup_logging() -> None:
    log_format = (
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("edge.log", mode="a"),
        ],
    )
    # Suppress noisy loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("ultralytics").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Subsystem initialization
# ---------------------------------------------------------------------------
async def initialize_subsystems() -> None:
    """Initialize all hardware and software subsystems."""
    logger.info("=" * 60)
    logger.info("Parkir Edge Node starting...")
    logger.info("Location: %s | Lane: %s | Mode: %s",
                settings.cloud.location_id,
                settings.cloud.lane_id,
                settings.cloud.lane_mode.value)
    logger.info("=" * 60)

    # Database
    await db.initialize()

    # Gate controller
    gate_controller.initialize()
    gate_controller.set_stuck_callback(
        lambda: asyncio.get_event_loop().create_task(
            alert_manager.on_gate_stuck(gate_controller.seconds_open)
        )
    )
    gate_controller.set_override_callback(
        lambda: asyncio.get_event_loop().create_task(
            alert_manager.on_emergency_override()
        )
    )

    # Vehicle classifier
    vehicle_classifier.initialize()

    # ANPR engine (lazy-loads models on first use)
    try:
        anpr_engine.initialize()
        anpr_engine.open_cameras()
    except Exception:
        logger.warning("ANPR engine initialization deferred", exc_info=True)

    # Receipt printer
    receipt_manager.initialize()

    # Booth UI
    booth_ui.initialize()
    booth_ui.start()

    # NFC payment: set initial online status
    nfc_payment.set_online_status(sync_engine.is_online)

    logger.info("All subsystems initialized")


async def shutdown_subsystems() -> None:
    """Gracefully shut down all subsystems."""
    logger.info("Shutting down Edge Node...")

    await sync_engine.stop()
    await gate_controller.stop_monitoring()
    await alert_manager.stop_monitoring()
    booth_ui.stop()
    anpr_engine.close_cameras()
    vehicle_classifier.cleanup()
    gate_controller.cleanup()
    await qris_payment.close()
    await nfc_payment.close()
    await receipt_manager.close()
    await db.close()

    logger.info("Edge Node shut down complete")


# ---------------------------------------------------------------------------
# Main vehicle processing loop
# ---------------------------------------------------------------------------
async def process_entry(session_uuid: str) -> None:
    """Process a vehicle entry."""
    try:
        # 1. Classify vehicle
        await lane_sm.transition(LaneState.CLASSIFYING)
        booth_ui.set_state(ScreenState.DETECTING)

        loop = asyncio.get_event_loop()
        vtype = await loop.run_in_executor(None, vehicle_classifier.classify)

        vehicle_type = "car"
        if vtype == VehicleType.MOTORCYCLE:
            vehicle_type = "motorcycle"
        elif vtype == VehicleType.SENSOR_FAULT:
            await alert_manager.on_sensor_fault()
            vehicle_type = "unknown"

        # 2. Read plate
        await lane_sm.transition(LaneState.READING_PLATE, vehicle_type=vehicle_type)

        result = await loop.run_in_executor(
            None, anpr_engine.recognize_from_camera, vehicle_type,
        )
        await alert_manager.on_anpr_result(bool(result.plate_text))

        plate = result.plate_text
        confidence = result.confidence
        tier = result.tier

        # 3. Handle confidence tiers
        if tier == ConfidenceTier.HIGH:
            # Auto-proceed
            await lane_sm.transition(
                LaneState.PLATE_CONFIRMED,
                plate_number=plate,
                vehicle_type=vehicle_type,
                confidence=confidence,
                confidence_tier=tier.value,
            )
            booth_ui.set_state(ScreenState.PLATE_CONFIRMED, {
                "plate_number": plate,
                "vehicle_type": vehicle_type,
                "confidence": confidence,
            })
            await asyncio.sleep(2)  # Brief display
            await lane_sm.transition(LaneState.CHECKING_RULES)

        elif tier == ConfidenceTier.MEDIUM:
            # Show plate, 5s timeout for correction
            await lane_sm.transition(
                LaneState.PLATE_CONFIRMED,
                plate_number=plate,
                vehicle_type=vehicle_type,
                confidence=confidence,
                confidence_tier=tier.value,
            )
            booth_ui.set_state(ScreenState.PLATE_CONFIRMED, {
                "plate_number": plate,
                "vehicle_type": vehicle_type,
                "confidence": confidence,
            })
            await asyncio.sleep(settings.timing.medium_confirm_timeout_s)
            if lane_sm.state == LaneState.PLATE_CONFIRMED:
                await lane_sm.transition(LaneState.CHECKING_RULES)

        elif tier == ConfidenceTier.LOW:
            # Require manual keyboard input
            await lane_sm.transition(
                LaneState.PLATE_MANUAL,
                plate_number=plate,
                vehicle_type=vehicle_type,
                confidence=confidence,
                confidence_tier=tier.value,
            )
            booth_ui.set_state(ScreenState.PLATE_MANUAL, {
                "suggested_plate": plate,
            })
            # Wait for manual input via API endpoint
            return

        else:
            # FAIL: mandatory manual entry
            await lane_sm.transition(
                LaneState.PLATE_MANUAL,
                vehicle_type=vehicle_type,
                confidence=0.0,
                confidence_tier="fail",
            )
            booth_ui.set_state(ScreenState.PLATE_MANUAL)
            return

        # 4. Check rules
        await _check_rules_and_proceed(session_uuid)

    except Exception:
        logger.exception("Entry processing error")
        await lane_sm.transition(LaneState.ERROR)
        booth_ui.set_state(ScreenState.ERROR, {"message": "Kesalahan sistem"})
        await asyncio.sleep(5)
        await lane_sm.reset()
        booth_ui.set_state(ScreenState.IDLE)


async def process_exit(session_uuid: str) -> None:
    """Process a vehicle exit."""
    try:
        # 1. Classify and read plate (similar to entry)
        await lane_sm.transition(LaneState.CLASSIFYING)
        booth_ui.set_state(ScreenState.DETECTING)

        loop = asyncio.get_event_loop()
        vtype = await loop.run_in_executor(None, vehicle_classifier.classify)
        vehicle_type = "motorcycle" if vtype == VehicleType.MOTORCYCLE else "car"

        await lane_sm.transition(LaneState.READING_PLATE, vehicle_type=vehicle_type)
        result = await loop.run_in_executor(
            None, anpr_engine.recognize_from_camera, vehicle_type,
        )
        await alert_manager.on_anpr_result(bool(result.plate_text))

        plate = result.plate_text

        if not plate or result.tier == ConfidenceTier.FAIL:
            await lane_sm.transition(LaneState.PLATE_MANUAL, vehicle_type=vehicle_type)
            booth_ui.set_state(ScreenState.PLATE_MANUAL)
            return

        await lane_sm.transition(
            LaneState.PLATE_CONFIRMED,
            plate_number=plate,
            vehicle_type=vehicle_type,
            confidence=result.confidence,
            confidence_tier=result.tier.value,
        )

        # 2. Calculate tariff
        await lane_sm.transition(LaneState.CHECKING_RULES)

        # Look up entry session
        # (In production, match by plate from cloud or local DB)
        tariff = await db.get_tariff(vehicle_type)
        if not tariff:
            tariff = {"first_hour": 3000, "next_hour": 2000, "max_daily": 30000}

        # For demo: calculate simple tariff
        entry_time = lane_sm.session.get("entry_time", datetime.now(timezone.utc).isoformat())
        now = datetime.now(timezone.utc)
        try:
            entry_dt = datetime.fromisoformat(entry_time)
            if entry_dt.tzinfo is None:
                entry_dt = entry_dt.replace(tzinfo=timezone.utc)
            duration_minutes = int((now - entry_dt).total_seconds() / 60)
        except (ValueError, TypeError):
            duration_minutes = 60

        hours = max(1, (duration_minutes + 59) // 60)
        amount = tariff["first_hour"]
        if hours > 1:
            amount += (hours - 1) * tariff["next_hour"]
        amount = min(amount, tariff["max_daily"])

        await lane_sm.transition(
            LaneState.PAYMENT_SCREEN,
            tariff_amount=amount,
            duration_minutes=duration_minutes,
        )

        # 3. Show payment screen
        booth_ui.set_state(ScreenState.PAYMENT_SCREEN, {
            "amount": amount,
            "nfc_available": nfc_payment.is_available,
        })

        # Payment handled by API endpoints / booth UI interaction

    except Exception:
        logger.exception("Exit processing error")
        await lane_sm.transition(LaneState.ERROR)
        booth_ui.set_state(ScreenState.ERROR, {"message": "Kesalahan sistem"})
        await asyncio.sleep(5)
        await lane_sm.reset()
        booth_ui.set_state(ScreenState.IDLE)


async def _check_rules_and_proceed(session_uuid: str) -> None:
    """Check whitelist, blacklist, member status and decide next step."""
    plate = lane_sm.session.get("plate_number", "")
    vehicle_type = lane_sm.session.get("vehicle_type", "car")

    # Check whitelist (free entry)
    if await db.is_whitelisted(plate):
        logger.info("Plate %s is whitelisted — free entry", plate)
        await lane_sm.transition(LaneState.ENTRY_FREE, payment_status="free")
        await _record_and_open_gate(session_uuid, payment_method="free", payment_status="free")
        return

    # Check member
    should_open, member = await member_manager.should_auto_open(plate)
    if should_open and member:
        logger.info("Member %s — auto-open for %s", member.member_id, plate)
        await lane_sm.transition(
            LaneState.ENTRY_FREE,
            member_id=member.member_id,
            payment_status="free",
        )
        # Show member greeting
        warning = await member_manager.check_expiry_warning(member)
        booth_ui.set_state(ScreenState.PLATE_CONFIRMED, {
            "plate_number": plate,
            "vehicle_type": vehicle_type,
            "message": f"Selamat datang, {member.name or 'Member'}!",
            "warning": warning,
        })
        await _record_and_open_gate(
            session_uuid, payment_method="member",
            payment_status="free", member_id=member.member_id,
        )
        return

    # Check blacklist
    if await db.is_blacklisted(plate):
        logger.warning("Plate %s is BLACKLISTED", plate)
        await alert_manager.raise_alert(
            AlertType.EMERGENCY_OVERRIDE,
            Severity.WARNING,
            f"Kendaraan blacklist terdeteksi: {plate}",
        )

    # Normal entry: log and open gate
    if settings.cloud.lane_mode == LaneMode.ENTRY:
        await lane_sm.transition(LaneState.ENTRY_LOG)
        await _record_and_open_gate(session_uuid)
    else:
        # Exit lane: need payment
        await lane_sm.transition(LaneState.PAYMENT_SCREEN)


async def _record_and_open_gate(
    session_uuid: str,
    payment_method: str = "",
    payment_status: str = "pending",
    member_id: str = "",
) -> None:
    """Record the session in DB and open the gate."""
    session = lane_sm.session
    now = datetime.now(timezone.utc).isoformat()

    await db.insert_session({
        "session_uuid": session_uuid,
        "location_id": settings.cloud.location_id,
        "lane_id": settings.cloud.lane_id,
        "lane_mode": settings.cloud.lane_mode.value,
        "plate_number": session.get("plate_number", ""),
        "vehicle_type": session.get("vehicle_type", "unknown"),
        "confidence": session.get("confidence", 0),
        "confidence_tier": session.get("confidence_tier", ""),
        "entry_time": now,
        "payment_method": payment_method or None,
        "payment_status": payment_status,
        "member_id": member_id or None,
    })

    # Open gate
    await lane_sm.transition(LaneState.GATE_OPENING)
    await gate_controller.async_open_gate()
    await lane_sm.transition(LaneState.GATE_OPEN)

    # Print entry receipt
    location_name = await db.get_config("location_name") or settings.cloud.location_id
    receipt_data = ReceiptData(
        location_name=location_name,
        lane_id=settings.cloud.lane_id,
        plate_number=session.get("plate_number", ""),
        vehicle_type=session.get("vehicle_type", "unknown"),
        entry_time=now,
        session_uuid=session_uuid,
        is_entry=True,
    )
    await receipt_manager.issue_entry_receipt(receipt_data)

    # Show confirmation
    booth_ui.set_state(ScreenState.PAYMENT_CONFIRMED, {
        "message": "Silakan masuk — Ambil tiket",
    })

    # Wait for vehicle to pass, then close gate
    await asyncio.sleep(settings.timing.gate_open_duration_s)
    await lane_sm.transition(LaneState.GATE_CLOSING)
    await gate_controller.async_close_gate()

    # Reset
    await lane_sm.reset()
    booth_ui.set_state(ScreenState.IDLE)


# ---------------------------------------------------------------------------
# Vehicle detection loop
# ---------------------------------------------------------------------------
async def detection_loop() -> None:
    """Main loop: wait for vehicle detection, then process."""
    logger.info("Vehicle detection loop started")
    while True:
        try:
            if lane_sm.state != LaneState.IDLE:
                await asyncio.sleep(0.5)
                continue

            # Check IR sensors for vehicle presence
            loop = asyncio.get_event_loop()
            present = await loop.run_in_executor(
                None, vehicle_classifier.is_vehicle_present,
            )

            if present:
                session_uuid = lane_sm.new_session()
                await lane_sm.transition(LaneState.DETECTING)
                booth_ui.set_state(ScreenState.DETECTING)

                if settings.cloud.lane_mode == LaneMode.ENTRY:
                    await process_entry(session_uuid)
                else:
                    await process_exit(session_uuid)

            await asyncio.sleep(0.2)

        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Detection loop error")
            await lane_sm.reset()
            booth_ui.set_state(ScreenState.IDLE)
            await asyncio.sleep(2)


# ---------------------------------------------------------------------------
# Heartbeat loop
# ---------------------------------------------------------------------------
async def heartbeat_loop() -> None:
    """Send periodic heartbeat to cloud."""
    while True:
        try:
            await sync_engine.send_heartbeat()

            # Update NFC online status
            nfc_payment.set_online_status(sync_engine.is_online)

            # Check for extended offline
            if sync_engine.connectivity_state.value == "extended_offline":
                await alert_manager.on_extended_offline()

            if sync_engine.is_online:
                await alert_manager.on_lane_online()
            else:
                await alert_manager.on_lane_offline()

        except asyncio.CancelledError:
            break
        except Exception:
            logger.debug("Heartbeat error", exc_info=True)

        await asyncio.sleep(settings.timing.heartbeat_interval_s)


# ---------------------------------------------------------------------------
# FastAPI lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan: start/stop background tasks."""
    await initialize_subsystems()

    # Start background tasks
    tasks = [
        asyncio.create_task(sync_engine.start()),
        asyncio.create_task(gate_controller.start_monitoring()),
        asyncio.create_task(alert_manager.start_monitoring()),
        asyncio.create_task(detection_loop()),
        asyncio.create_task(heartbeat_loop()),
    ]

    yield

    # Shutdown
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    await shutdown_subsystems()


# Attach lifespan to the existing app
app.router.lifespan_context = lifespan


# ---------------------------------------------------------------------------
# Signal handlers
# ---------------------------------------------------------------------------
def handle_signal(signum: int, frame) -> None:
    logger.info("Received signal %d — shutting down", signum)
    sys.exit(0)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    setup_logging()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    logger.info("Starting Parkir Edge Node...")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        log_level=settings.log_level.lower(),
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()
