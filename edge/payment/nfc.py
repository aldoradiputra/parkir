"""
NFC e-money payment via ACR122U-SAM reader (nfcpy).

Supports Indonesian e-money cards:
- BCA Flazz
- BRI Brizzi
- Bank Mandiri e-money (Mandiri)
- BNI TapCash

Disabled when offline — shows "Tap kartu tidak tersedia — gunakan QRIS".
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

try:
    import nfc
    NFC_AVAILABLE = True
except ImportError:
    NFC_AVAILABLE = False
    logger.warning("nfcpy not available — NFC payments disabled")


class CardType(str, Enum):
    FLAZZ = "flazz"
    BRIZZI = "brizzi"
    TAPCASH = "tapcash"
    MANDIRI = "mandiri"
    UNKNOWN = "unknown"


class NFCStatus(str, Enum):
    IDLE = "idle"
    WAITING = "waiting"
    READING = "reading"
    PROCESSING = "processing"
    SUCCESS = "success"
    INSUFFICIENT = "insufficient"
    FAILED = "failed"
    OFFLINE = "offline"


@dataclass
class NFCResult:
    status: NFCStatus
    card_type: CardType = CardType.UNKNOWN
    card_uid: str = ""
    amount: int = 0
    balance_before: int = 0
    balance_after: int = 0
    error_message: str = ""


# AID patterns for card type detection
CARD_AIDS: dict[str, CardType] = {
    "A0000000031010": CardType.FLAZZ,     # BCA Flazz
    "A00000000401": CardType.BRIZZI,       # BRI Brizzi
    "A0000000040102": CardType.BRIZZI,     # BRI Brizzi alt
    "A0000000040301": CardType.TAPCASH,    # BNI TapCash
    "A000000004030201": CardType.TAPCASH,  # BNI TapCash alt
    "A0000000041010": CardType.MANDIRI,    # Mandiri e-money
}


class NFCPayment:
    """NFC e-money payment handler via ACR122U."""

    def __init__(self) -> None:
        self._device_path = settings.hardware.nfc_device
        self._cloud_url = settings.cloud.api_url
        self._api_key = settings.cloud.lane_api_key
        self._clf = None
        self._status = NFCStatus.IDLE
        self._is_online = True
        self._http: Optional[httpx.AsyncClient] = None

    @property
    def status(self) -> NFCStatus:
        return self._status

    @property
    def is_available(self) -> bool:
        """NFC is only available when online and hardware is present."""
        return NFC_AVAILABLE and self._is_online

    def set_online_status(self, online: bool) -> None:
        """Update connectivity status — NFC disabled when offline."""
        self._is_online = online
        if not online:
            self._status = NFCStatus.OFFLINE
            logger.info("NFC payments disabled — offline mode")

    def get_offline_message(self) -> str:
        """Indonesian message when NFC is unavailable."""
        return "Tap kartu tidak tersedia — gunakan QRIS"

    # -------------------------------------------------------------------
    # NFC reader management
    # -------------------------------------------------------------------
    def _open_reader(self) -> bool:
        """Open the NFC reader device."""
        if not NFC_AVAILABLE:
            return False
        try:
            self._clf = nfc.ContactlessFrontend(self._device_path)
            logger.info("NFC reader opened: %s", self._device_path)
            return True
        except Exception:
            logger.exception("Failed to open NFC reader at %s", self._device_path)
            self._clf = None
            return False

    def _close_reader(self) -> None:
        if self._clf:
            try:
                self._clf.close()
            except Exception:
                pass
            self._clf = None

    # -------------------------------------------------------------------
    # Card detection and identification
    # -------------------------------------------------------------------
    def _detect_card_type(self, tag) -> CardType:
        """Identify the card type from tag data/AID."""
        try:
            if hasattr(tag, "ndef") and tag.ndef:
                # Check AID-based identification
                for aid_hex, card_type in CARD_AIDS.items():
                    aid_bytes = bytes.fromhex(aid_hex)
                    try:
                        # Try SELECT by AID
                        command = bytes([0x00, 0xA4, 0x04, 0x00, len(aid_bytes)]) + aid_bytes
                        if hasattr(tag, "transceive"):
                            response = tag.transceive(command)
                            if response and response[-2:] == bytes([0x90, 0x00]):
                                return card_type
                    except Exception:
                        continue

            # Fallback: identify by ATR/manufacturer data
            identifier = tag.identifier.hex().upper() if hasattr(tag, "identifier") else ""
            logger.debug("Card UID: %s", identifier)

            # Try AID selection for common card types
            if hasattr(tag, "transceive"):
                for aid_hex, card_type in CARD_AIDS.items():
                    try:
                        aid_bytes = bytes.fromhex(aid_hex)
                        cmd = bytes([0x00, 0xA4, 0x04, 0x00, len(aid_bytes)]) + aid_bytes
                        resp = tag.transceive(cmd)
                        if resp and len(resp) >= 2 and resp[-2] == 0x90 and resp[-1] == 0x00:
                            return card_type
                    except Exception:
                        continue

        except Exception:
            logger.debug("Card type detection failed", exc_info=True)

        return CardType.UNKNOWN

    def _get_card_uid(self, tag) -> str:
        """Extract card UID as hex string."""
        if hasattr(tag, "identifier"):
            return tag.identifier.hex().upper()
        return ""

    # -------------------------------------------------------------------
    # Balance deduction via cloud API
    # -------------------------------------------------------------------
    async def _get_client(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                base_url=self._cloud_url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                timeout=15.0,
            )
        return self._http

    async def _deduct_balance(
        self,
        card_type: CardType,
        card_uid: str,
        amount: int,
        session_uuid: str,
    ) -> NFCResult:
        """
        Deduct balance via bank API proxy (cloud endpoint).
        """
        try:
            client = await self._get_client()
            payload = {
                "card_type": card_type.value,
                "card_uid": card_uid,
                "amount": amount,
                "session_uuid": session_uuid,
                "location_id": settings.cloud.location_id,
                "lane_id": settings.cloud.lane_id,
            }
            resp = await client.post("/api/v1/payments/nfc/deduct", json=payload)
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") == "success":
                return NFCResult(
                    status=NFCStatus.SUCCESS,
                    card_type=card_type,
                    card_uid=card_uid,
                    amount=amount,
                    balance_before=data.get("balance_before", 0),
                    balance_after=data.get("balance_after", 0),
                )
            elif data.get("status") == "insufficient":
                return NFCResult(
                    status=NFCStatus.INSUFFICIENT,
                    card_type=card_type,
                    card_uid=card_uid,
                    amount=amount,
                    balance_before=data.get("balance_before", 0),
                    balance_after=data.get("balance_before", 0),
                    error_message=f"Saldo tidak cukup. Saldo: Rp {data.get('balance_before', 0):,}".replace(",", "."),
                )
            else:
                return NFCResult(
                    status=NFCStatus.FAILED,
                    card_type=card_type,
                    card_uid=card_uid,
                    error_message=data.get("message", "Transaksi gagal"),
                )

        except httpx.HTTPError as exc:
            logger.error("NFC deduction API error: %s", exc)
            return NFCResult(
                status=NFCStatus.FAILED,
                card_type=card_type,
                card_uid=card_uid,
                error_message="Koneksi ke server gagal",
            )

    # -------------------------------------------------------------------
    # Main payment flow
    # -------------------------------------------------------------------
    async def process_payment(
        self,
        amount: int,
        session_uuid: str,
        timeout_s: float = 30.0,
    ) -> NFCResult:
        """
        Wait for NFC card tap, detect type, and deduct balance.
        Returns NFCResult with status and transaction details.
        """
        if not self._is_online:
            return NFCResult(
                status=NFCStatus.OFFLINE,
                error_message=self.get_offline_message(),
            )

        if not NFC_AVAILABLE:
            return NFCResult(
                status=NFCStatus.FAILED,
                error_message="NFC reader tidak tersedia",
            )

        self._status = NFCStatus.WAITING
        logger.info("Waiting for NFC card tap (timeout: %.0fs)", timeout_s)

        # Run NFC blocking read in executor
        loop = asyncio.get_event_loop()
        tag = await loop.run_in_executor(None, self._wait_for_card, timeout_s)

        if tag is None:
            self._status = NFCStatus.IDLE
            return NFCResult(
                status=NFCStatus.FAILED,
                error_message="Kartu tidak terdeteksi — coba lagi",
            )

        self._status = NFCStatus.READING
        card_type = self._detect_card_type(tag)
        card_uid = self._get_card_uid(tag)
        logger.info("Card detected: type=%s uid=%s", card_type.value, card_uid)

        self._status = NFCStatus.PROCESSING

        # Deduct via cloud API
        result = await self._deduct_balance(card_type, card_uid, amount, session_uuid)

        self._status = NFCStatus.IDLE
        self._close_reader()

        return result

    def _wait_for_card(self, timeout_s: float) -> Any:
        """Blocking wait for NFC card (runs in thread executor)."""
        try:
            if not self._open_reader():
                return None

            tag = self._clf.connect(  # type: ignore[union-attr]
                rdwr={
                    "on-connect": lambda tag: tag,
                },
                terminate=lambda: False,
            )
            return tag if tag else None
        except Exception:
            logger.debug("NFC card wait failed", exc_info=True)
            return None

    # -------------------------------------------------------------------
    # UI helpers
    # -------------------------------------------------------------------
    def get_display_data(self) -> dict[str, Any]:
        """Get data for booth UI NFC screen."""
        if not self._is_online:
            return {
                "status": NFCStatus.OFFLINE.value,
                "message": self.get_offline_message(),
                "available": False,
            }
        return {
            "status": self._status.value,
            "message": self._get_status_message(),
            "available": self.is_available,
        }

    def _get_status_message(self) -> str:
        messages = {
            NFCStatus.IDLE: "Tempelkan kartu e-money",
            NFCStatus.WAITING: "Menunggu kartu...",
            NFCStatus.READING: "Membaca kartu...",
            NFCStatus.PROCESSING: "Memproses pembayaran...",
            NFCStatus.SUCCESS: "Pembayaran berhasil!",
            NFCStatus.INSUFFICIENT: "Saldo tidak cukup",
            NFCStatus.FAILED: "Gagal — coba lagi",
            NFCStatus.OFFLINE: self.get_offline_message(),
        }
        return messages.get(self._status, "")

    async def close(self) -> None:
        self._close_reader()
        if self._http and not self._http.is_closed:
            await self._http.aclose()


# Module-level singleton
nfc_payment = NFCPayment()
