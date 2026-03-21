"""
Local FastAPI server — endpoints for booth touchscreen UI,
gate control, status/health, manual plate entry, and payment.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from alerts import alert_manager
from config import LaneMode, settings
from database import db
from gate.controller import GateState, gate_controller
from members import member_manager
from payment.nfc import NFCStatus, nfc_payment
from payment.qris import QRISStatus, qris_payment
from receipt import ReceiptData, receipt_manager
from state_machine import LaneState, lane_sm
from sync import sync_engine

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Parkir Edge Node",
    version="1.0.0",
    description="Local API for booth touchscreen and lane management",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------
class ManualPlateRequest(BaseModel):
    plate_number: str = Field(..., min_length=3, max_length=15)
    vehicle_type: str = Field(default="car", pattern="^(car|motorcycle)$")
    operator_id: Optional[str] = None


class PaymentMethodRequest(BaseModel):
    method: str = Field(..., pattern="^(qris|nfc)$")
    session_uuid: str
    amount: int = Field(..., gt=0)


class OverrideRequest(BaseModel):
    session_uuid: str
    operator_id: str
    reason: str = ""


class GateCommandRequest(BaseModel):
    action: str = Field(..., pattern="^(open|close)$")


# ---------------------------------------------------------------------------
# Health & Status
# ---------------------------------------------------------------------------
@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lane_id": settings.cloud.lane_id,
        "location_id": settings.cloud.location_id,
    }


@app.get("/status")
async def status() -> dict[str, Any]:
    return {
        "lane": lane_sm.get_status(),
        "gate": {
            "state": gate_controller.state.value,
            "seconds_open": gate_controller.seconds_open,
        },
        "connectivity": sync_engine.connectivity_state.value,
        "alerts": alert_manager.get_status(),
        "nfc_available": nfc_payment.is_available,
    }


@app.get("/status/state")
async def get_state() -> dict[str, Any]:
    """Get current state machine status (polled by booth UI)."""
    return lane_sm.get_status()


# ---------------------------------------------------------------------------
# Gate control
# ---------------------------------------------------------------------------
@app.post("/gate")
async def gate_command(req: GateCommandRequest) -> dict[str, Any]:
    if req.action == "open":
        success = await gate_controller.async_open_gate()
    else:
        success = await gate_controller.async_close_gate()

    return {
        "action": req.action,
        "success": success,
        "gate_state": gate_controller.state.value,
    }


@app.get("/gate/status")
async def gate_status() -> dict[str, Any]:
    return {
        "state": gate_controller.state.value,
        "is_open": gate_controller.is_open,
        "seconds_open": round(gate_controller.seconds_open, 1),
    }


# ---------------------------------------------------------------------------
# Manual plate entry
# ---------------------------------------------------------------------------
@app.post("/plate/manual")
async def manual_plate_entry(req: ManualPlateRequest) -> dict[str, Any]:
    """Submit a manually entered plate number from booth keyboard."""
    from anpr.engine import ANPREngine

    normalized = ANPREngine.normalize_plate(req.plate_number)
    if not normalized:
        raise HTTPException(400, "Nomor plat tidak valid")

    # Update session context
    await lane_sm.transition(
        LaneState.PLATE_MANUAL,
        plate_number=normalized,
        vehicle_type=req.vehicle_type,
        confidence=0.0,
        confidence_tier="manual",
        override_by=req.operator_id,
    )

    # Move to rules check
    await lane_sm.transition(LaneState.CHECKING_RULES)

    return {
        "plate_number": normalized,
        "vehicle_type": req.vehicle_type,
        "state": lane_sm.state.value,
    }


# ---------------------------------------------------------------------------
# Plate confirmation (for MEDIUM confidence)
# ---------------------------------------------------------------------------
@app.post("/plate/confirm")
async def confirm_plate(plate_number: Optional[str] = None) -> dict[str, Any]:
    """Confirm or correct a detected plate number."""
    if plate_number:
        from anpr.engine import ANPREngine
        normalized = ANPREngine.normalize_plate(plate_number)
        await lane_sm.transition(
            LaneState.PLATE_CONFIRMED,
            plate_number=normalized,
            confidence_tier="manual",
        )
    else:
        # Accept the auto-detected plate as-is
        await lane_sm.transition(LaneState.PLATE_CONFIRMED)

    await lane_sm.transition(LaneState.CHECKING_RULES)

    return {
        "plate_number": lane_sm.session.get("plate_number"),
        "state": lane_sm.state.value,
    }


# ---------------------------------------------------------------------------
# Payment
# ---------------------------------------------------------------------------
@app.post("/payment/initiate")
async def initiate_payment(req: PaymentMethodRequest) -> dict[str, Any]:
    """Initiate payment via QRIS or NFC."""
    session = await db.get_session(req.session_uuid)
    if not session:
        raise HTTPException(404, "Sesi tidak ditemukan")

    if req.method == "qris":
        await lane_sm.transition(LaneState.PAYMENT_QRIS)
        txn = await qris_payment.create_transaction(
            session_uuid=req.session_uuid,
            amount=req.amount,
            plate_number=session.get("plate_number", ""),
            vehicle_type=session.get("vehicle_type", "car"),
        )
        return {
            "method": "qris",
            "status": txn.status.value,
            **qris_payment.get_qr_display_data(txn),
        }

    elif req.method == "nfc":
        if not nfc_payment.is_available:
            raise HTTPException(
                503,
                nfc_payment.get_offline_message(),
            )
        await lane_sm.transition(LaneState.PAYMENT_NFC)
        return {
            "method": "nfc",
            **nfc_payment.get_display_data(),
            "amount": req.amount,
            "message": f"Tempelkan kartu e-money — Total: Rp {req.amount:,}".replace(",", "."),
        }

    raise HTTPException(400, "Metode pembayaran tidak valid")


@app.get("/payment/status/{session_uuid}")
async def payment_status(session_uuid: str) -> dict[str, Any]:
    """Check current payment status."""
    session = await db.get_session(session_uuid)
    if not session:
        raise HTTPException(404, "Sesi tidak ditemukan")

    return {
        "session_uuid": session_uuid,
        "payment_status": session.get("payment_status", "pending"),
        "payment_method": session.get("payment_method"),
        "payment_ref": session.get("payment_ref"),
        "tariff_amount": session.get("tariff_amount", 0),
        "state": lane_sm.state.value,
    }


@app.post("/payment/override")
async def payment_override(req: OverrideRequest) -> dict[str, Any]:
    """Operator override for payment timeout."""
    await lane_sm.transition(
        LaneState.PAYMENT_OVERRIDE,
        override_by=req.operator_id,
        override_reason=req.reason,
    )
    await db.update_session(req.session_uuid, {
        "payment_status": "override",
        "override_by": req.operator_id,
        "override_reason": req.reason,
    })
    await alert_manager.on_emergency_override()

    # Open gate
    await lane_sm.transition(LaneState.GATE_OPENING)
    await gate_controller.async_open_gate()

    return {
        "success": True,
        "session_uuid": req.session_uuid,
        "state": lane_sm.state.value,
    }


# ---------------------------------------------------------------------------
# Member info
# ---------------------------------------------------------------------------
@app.get("/member/{plate_number}")
async def get_member(plate_number: str) -> dict[str, Any]:
    from anpr.engine import ANPREngine
    normalized = ANPREngine.normalize_plate(plate_number)
    member = await member_manager.lookup_by_plate(normalized)
    if not member:
        raise HTTPException(404, "Member tidak ditemukan")
    return member_manager.get_display_data(member)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
@app.get("/alerts")
async def get_alerts() -> dict[str, Any]:
    return alert_manager.get_status()


# ---------------------------------------------------------------------------
# Session info
# ---------------------------------------------------------------------------
@app.get("/session/{session_uuid}")
async def get_session(session_uuid: str) -> dict[str, Any]:
    session = await db.get_session(session_uuid)
    if not session:
        raise HTTPException(404, "Sesi tidak ditemukan")
    return session


# ---------------------------------------------------------------------------
# Screen display data (for booth UI polling)
# ---------------------------------------------------------------------------
@app.get("/display")
async def get_display_data() -> dict[str, Any]:
    """Get current display data based on lane state."""
    state = lane_sm.state
    session = lane_sm.session

    base = {
        "state": state.value,
        "lane_mode": settings.cloud.lane_mode.value,
        "lane_id": settings.cloud.lane_id,
    }

    if state == LaneState.IDLE:
        base["message"] = "Selamat datang — Silakan masuk"
        base["sub_message"] = ""

    elif state == LaneState.DETECTING:
        base["message"] = "Mendeteksi kendaraan..."

    elif state in (LaneState.READING_PLATE, LaneState.CLASSIFYING):
        base["message"] = "Membaca plat nomor..."

    elif state == LaneState.PLATE_CONFIRMED:
        base["message"] = "Plat terdeteksi"
        base["plate_number"] = session.get("plate_number", "")
        base["vehicle_type"] = session.get("vehicle_type", "")
        base["confidence"] = session.get("confidence", 0)

    elif state == LaneState.PLATE_MANUAL:
        base["message"] = "Masukkan nomor plat secara manual"

    elif state == LaneState.PAYMENT_SCREEN:
        base["message"] = "Pilih metode pembayaran"
        base["amount"] = session.get("tariff_amount", 0)
        base["nfc_available"] = nfc_payment.is_available

    elif state == LaneState.PAYMENT_QRIS:
        txn = qris_payment.current_transaction
        if txn:
            base.update(qris_payment.get_qr_display_data(txn))
        base["message"] = "Scan QRIS untuk membayar"

    elif state == LaneState.PAYMENT_NFC:
        base.update(nfc_payment.get_display_data())

    elif state == LaneState.PAYMENT_CONFIRMED:
        base["message"] = "Pembayaran berhasil!"
        base["payment_method"] = session.get("payment_method", "")

    elif state == LaneState.PAYMENT_TIMEOUT:
        base["message"] = "Pembayaran timeout — hubungi petugas"

    elif state in (LaneState.GATE_OPENING, LaneState.GATE_OPEN):
        base["message"] = "Silakan lewat"
        base["gate_state"] = gate_controller.state.value

    elif state == LaneState.ERROR:
        base["message"] = "Terjadi kesalahan — hubungi petugas"

    return base
