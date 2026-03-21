"""
Triple receipt system — thermal printer, WhatsApp (Fonnte), screen display.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

# Optional imports
try:
    from escpos.printer import Usb as UsbPrinter
    PRINTER_AVAILABLE = True
except ImportError:
    PRINTER_AVAILABLE = False
    logger.warning("python-escpos not available — thermal printer disabled")

try:
    import qrcode
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False


@dataclass
class ReceiptData:
    """Data for receipt generation."""
    location_name: str
    lane_id: str
    plate_number: str
    vehicle_type: str
    entry_time: str
    exit_time: str = ""
    duration_minutes: int = 0
    tariff_amount: int = 0
    payment_method: str = ""
    payment_ref: str = ""
    session_uuid: str = ""
    member_name: str = ""
    is_entry: bool = True

    @property
    def formatted_entry_time(self) -> str:
        try:
            dt = datetime.fromisoformat(self.entry_time)
            return dt.strftime("%d/%m/%Y %H:%M:%S")
        except (ValueError, TypeError):
            return self.entry_time

    @property
    def formatted_exit_time(self) -> str:
        if not self.exit_time:
            return ""
        try:
            dt = datetime.fromisoformat(self.exit_time)
            return dt.strftime("%d/%m/%Y %H:%M:%S")
        except (ValueError, TypeError):
            return self.exit_time

    @property
    def formatted_amount(self) -> str:
        return f"Rp {self.tariff_amount:,}".replace(",", ".")

    @property
    def duration_display(self) -> str:
        if self.duration_minutes <= 0:
            return "-"
        hours = self.duration_minutes // 60
        minutes = self.duration_minutes % 60
        if hours > 0:
            return f"{hours} jam {minutes} menit"
        return f"{minutes} menit"

    @property
    def vehicle_type_display(self) -> str:
        return {"car": "Mobil", "motorcycle": "Motor"}.get(self.vehicle_type, self.vehicle_type)

    @property
    def payment_method_display(self) -> str:
        methods = {
            "qris": "QRIS",
            "nfc": "E-Money",
            "cash": "Tunai",
            "member": "Member",
            "free": "Gratis",
        }
        return methods.get(self.payment_method, self.payment_method)


class ReceiptPrinter:
    """Thermal receipt printer (58mm USB)."""

    def __init__(self) -> None:
        self._printer = None

    def initialize(self) -> bool:
        if not PRINTER_AVAILABLE:
            logger.info("Thermal printer not available")
            return False
        try:
            self._printer = UsbPrinter(
                settings.hardware.printer_vendor_id,
                settings.hardware.printer_product_id,
            )
            logger.info("Thermal printer initialized")
            return True
        except Exception:
            logger.warning("Failed to initialize thermal printer", exc_info=True)
            self._printer = None
            return False

    def print_entry_receipt(self, data: ReceiptData) -> bool:
        """Print entry ticket on thermal printer."""
        if not self._printer:
            if not self.initialize():
                return False
        try:
            p = self._printer
            assert p is not None

            p.set(align="center", bold=True, width=2, height=2)
            p.text("PARKIR\n")
            p.set(align="center", bold=False, width=1, height=1)
            p.text(f"{data.location_name}\n")
            p.text("=" * 32 + "\n")

            p.set(align="left")
            p.text(f"No. Plat  : {data.plate_number}\n")
            p.text(f"Kendaraan : {data.vehicle_type_display}\n")
            p.text(f"Masuk     : {data.formatted_entry_time}\n")
            p.text(f"Lane      : {data.lane_id}\n")

            p.text("-" * 32 + "\n")
            p.set(align="center", bold=True)
            p.text("SIMPAN TIKET INI\n")
            p.text("Tiket hilang dikenakan denda\n")
            p.set(bold=False)
            p.text("-" * 32 + "\n")

            # QR code with session UUID for exit scanning
            if QRCODE_AVAILABLE and data.session_uuid:
                p.qr(data.session_uuid, size=6)
                p.text("\n")

            p.text(f"ID: {data.session_uuid[:12]}...\n")
            p.cut()
            logger.info("Entry receipt printed for %s", data.plate_number)
            return True

        except Exception:
            logger.exception("Failed to print entry receipt")
            return False

    def print_exit_receipt(self, data: ReceiptData) -> bool:
        """Print exit receipt on thermal printer."""
        if not self._printer:
            if not self.initialize():
                return False
        try:
            p = self._printer
            assert p is not None

            p.set(align="center", bold=True, width=2, height=2)
            p.text("PARKIR\n")
            p.set(align="center", bold=False, width=1, height=1)
            p.text(f"{data.location_name}\n")
            p.text("=" * 32 + "\n")

            p.set(align="left")
            p.text(f"No. Plat   : {data.plate_number}\n")
            p.text(f"Kendaraan  : {data.vehicle_type_display}\n")
            p.text(f"Masuk      : {data.formatted_entry_time}\n")
            p.text(f"Keluar     : {data.formatted_exit_time}\n")
            p.text(f"Durasi     : {data.duration_display}\n")
            p.text("-" * 32 + "\n")

            p.set(align="center", bold=True, width=2, height=1)
            p.text(f"{data.formatted_amount}\n")
            p.set(bold=False, width=1)

            p.text(f"Bayar: {data.payment_method_display}\n")
            if data.payment_ref:
                p.text(f"Ref: {data.payment_ref}\n")
            p.text("-" * 32 + "\n")
            p.text("Terima kasih\n")
            p.text("Hati-hati di jalan\n\n")
            p.cut()

            logger.info("Exit receipt printed for %s", data.plate_number)
            return True

        except Exception:
            logger.exception("Failed to print exit receipt")
            return False


class WhatsAppReceipt:
    """Send receipt via WhatsApp using Fonnte API."""

    def __init__(self) -> None:
        self._api_key = settings.payment.fonnte_api_key
        self._http: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=15.0)
        return self._http

    async def send_entry_receipt(self, phone: str, data: ReceiptData) -> bool:
        """Send entry notification via WhatsApp."""
        if not self._api_key:
            logger.debug("Fonnte API key not configured — skipping WhatsApp receipt")
            return False

        message = (
            f"*PARKIR — {data.location_name}*\n\n"
            f"Kendaraan Anda telah masuk area parkir.\n\n"
            f"No. Plat: *{data.plate_number}*\n"
            f"Kendaraan: {data.vehicle_type_display}\n"
            f"Waktu Masuk: {data.formatted_entry_time}\n"
            f"ID: {data.session_uuid[:12]}\n\n"
            f"_Simpan pesan ini sebagai bukti parkir._"
        )
        return await self._send(phone, message)

    async def send_exit_receipt(self, phone: str, data: ReceiptData) -> bool:
        """Send exit receipt via WhatsApp."""
        if not self._api_key:
            return False

        message = (
            f"*PARKIR — {data.location_name}*\n\n"
            f"Terima kasih telah berkunjung!\n\n"
            f"No. Plat: *{data.plate_number}*\n"
            f"Masuk: {data.formatted_entry_time}\n"
            f"Keluar: {data.formatted_exit_time}\n"
            f"Durasi: {data.duration_display}\n"
            f"Total: *{data.formatted_amount}*\n"
            f"Bayar: {data.payment_method_display}\n"
            f"Ref: {data.payment_ref}\n\n"
            f"_Hati-hati di jalan!_"
        )
        return await self._send(phone, message)

    async def _send(self, phone: str, message: str) -> bool:
        """Send message via Fonnte API."""
        try:
            client = await self._get_client()
            resp = await client.post(
                "https://api.fonnte.com/send",
                headers={"Authorization": self._api_key},
                data={
                    "target": phone,
                    "message": message,
                    "countryCode": "62",
                },
            )
            resp.raise_for_status()
            result = resp.json()
            if result.get("status"):
                logger.info("WhatsApp receipt sent to %s", phone)
                return True
            else:
                logger.warning("Fonnte API error: %s", result.get("reason"))
                return False
        except Exception:
            logger.warning("Failed to send WhatsApp receipt", exc_info=True)
            return False

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()


class ScreenReceipt:
    """Generate receipt display data for the booth touchscreen."""

    @staticmethod
    def get_entry_display(data: ReceiptData) -> dict[str, Any]:
        return {
            "type": "entry",
            "title": "Selamat Datang!",
            "location": data.location_name,
            "plate": data.plate_number,
            "vehicle_type": data.vehicle_type_display,
            "entry_time": data.formatted_entry_time,
            "message": "Ambil tiket Anda",
            "session_id": data.session_uuid[:12],
        }

    @staticmethod
    def get_exit_display(data: ReceiptData) -> dict[str, Any]:
        return {
            "type": "exit",
            "title": "Terima Kasih!",
            "location": data.location_name,
            "plate": data.plate_number,
            "vehicle_type": data.vehicle_type_display,
            "entry_time": data.formatted_entry_time,
            "exit_time": data.formatted_exit_time,
            "duration": data.duration_display,
            "amount": data.formatted_amount,
            "payment_method": data.payment_method_display,
            "payment_ref": data.payment_ref,
            "message": "Hati-hati di jalan!",
        }


class ReceiptManager:
    """Orchestrates all three receipt channels."""

    def __init__(self) -> None:
        self.thermal = ReceiptPrinter()
        self.whatsapp = WhatsAppReceipt()
        self.screen = ScreenReceipt()

    def initialize(self) -> None:
        self.thermal.initialize()

    async def issue_entry_receipt(
        self,
        data: ReceiptData,
        phone: Optional[str] = None,
    ) -> dict[str, bool]:
        """Issue entry receipt via all available channels."""
        results: dict[str, bool] = {}

        # Thermal printer (blocking, run in executor)
        loop = asyncio.get_event_loop()
        results["thermal"] = await loop.run_in_executor(
            None, self.thermal.print_entry_receipt, data,
        )

        # WhatsApp (async)
        if phone:
            results["whatsapp"] = await self.whatsapp.send_entry_receipt(phone, data)
        else:
            results["whatsapp"] = False

        # Screen display is always available
        results["screen"] = True

        logger.info("Entry receipt issued: %s", results)
        return results

    async def issue_exit_receipt(
        self,
        data: ReceiptData,
        phone: Optional[str] = None,
    ) -> dict[str, bool]:
        """Issue exit receipt via all available channels."""
        results: dict[str, bool] = {}

        loop = asyncio.get_event_loop()
        results["thermal"] = await loop.run_in_executor(
            None, self.thermal.print_exit_receipt, data,
        )

        if phone:
            results["whatsapp"] = await self.whatsapp.send_exit_receipt(phone, data)
        else:
            results["whatsapp"] = False

        results["screen"] = True

        logger.info("Exit receipt issued: %s", results)
        return results

    def get_screen_data(self, data: ReceiptData) -> dict[str, Any]:
        if data.is_entry:
            return self.screen.get_entry_display(data)
        return self.screen.get_exit_display(data)

    async def close(self) -> None:
        await self.whatsapp.close()


# Module-level singleton
receipt_manager = ReceiptManager()
