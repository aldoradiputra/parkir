"""
QRIS payment via Midtrans — create transactions, display QR, poll status.
Falls back to static QRIS image when offline.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)


class QRISStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    EXPIRED = "expired"
    FAILED = "failed"


class QRISTransaction:
    """Represents a single QRIS payment transaction."""

    def __init__(
        self,
        order_id: str,
        amount: int,
        qr_url: str = "",
        qr_string: str = "",
        status: QRISStatus = QRISStatus.PENDING,
        payment_ref: str = "",
    ) -> None:
        self.order_id = order_id
        self.amount = amount
        self.qr_url = qr_url
        self.qr_string = qr_string
        self.status = status
        self.payment_ref = payment_ref
        self.created_at = datetime.now(timezone.utc)


class QRISPayment:
    """QRIS payment handler via cloud API (Midtrans proxy)."""

    def __init__(self) -> None:
        self._cloud_url = settings.cloud.api_url
        self._api_key = settings.cloud.lane_api_key
        self._timeout_s = settings.timing.payment_timeout_s
        self._static_qris = settings.payment.static_qris_image
        self._current_txn: Optional[QRISTransaction] = None
        self._http: Optional[httpx.AsyncClient] = None

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

    # -------------------------------------------------------------------
    # Create QRIS transaction
    # -------------------------------------------------------------------
    async def create_transaction(
        self,
        session_uuid: str,
        amount: int,
        plate_number: str = "",
        vehicle_type: str = "car",
    ) -> QRISTransaction:
        """
        Create a QRIS payment transaction via cloud API.
        Falls back to static QRIS if the cloud is unreachable.
        """
        order_id = f"PKR-{settings.cloud.lane_id}-{session_uuid[:8]}"

        try:
            client = await self._get_client()
            payload = {
                "order_id": order_id,
                "amount": amount,
                "location_id": settings.cloud.location_id,
                "lane_id": settings.cloud.lane_id,
                "session_uuid": session_uuid,
                "plate_number": plate_number,
                "vehicle_type": vehicle_type,
            }
            resp = await client.post("/api/v1/payments/qris/create", json=payload)
            resp.raise_for_status()
            data = resp.json()

            txn = QRISTransaction(
                order_id=order_id,
                amount=amount,
                qr_url=data.get("qr_url", ""),
                qr_string=data.get("qr_string", ""),
                status=QRISStatus.PENDING,
                payment_ref=data.get("transaction_id", ""),
            )
            self._current_txn = txn
            logger.info(
                "QRIS transaction created: order=%s amount=%d", order_id, amount,
            )
            return txn

        except (httpx.HTTPError, httpx.ConnectError, Exception) as exc:
            logger.warning("Failed to create QRIS transaction online: %s", exc)
            return self._create_static_fallback(order_id, amount)

    def _create_static_fallback(self, order_id: str, amount: int) -> QRISTransaction:
        """Create a static QRIS fallback when offline."""
        logger.info("Using static QRIS fallback for order %s", order_id)
        txn = QRISTransaction(
            order_id=order_id,
            amount=amount,
            qr_url=self._static_qris if Path(self._static_qris).exists() else "",
            qr_string="",
            status=QRISStatus.PENDING,
        )
        self._current_txn = txn
        return txn

    # -------------------------------------------------------------------
    # Payment status polling
    # -------------------------------------------------------------------
    async def poll_payment_status(
        self,
        txn: QRISTransaction,
        poll_interval_s: float = 3.0,
    ) -> QRISStatus:
        """
        Poll the cloud API for payment status until paid, expired, or timeout.
        Returns final QRISStatus.
        """
        elapsed = 0.0
        while elapsed < self._timeout_s:
            try:
                client = await self._get_client()
                resp = await client.get(
                    f"/api/v1/payments/qris/status/{txn.order_id}"
                )
                resp.raise_for_status()
                data = resp.json()
                status_str = data.get("status", "pending")

                if status_str == "paid":
                    txn.status = QRISStatus.PAID
                    txn.payment_ref = data.get("transaction_id", txn.payment_ref)
                    logger.info("QRIS payment confirmed: order=%s", txn.order_id)
                    return QRISStatus.PAID
                elif status_str in ("expired", "failed"):
                    txn.status = QRISStatus(status_str)
                    logger.info("QRIS payment %s: order=%s", status_str, txn.order_id)
                    return txn.status

            except (httpx.HTTPError, Exception) as exc:
                logger.debug("Poll error (will retry): %s", exc)

            await asyncio.sleep(poll_interval_s)
            elapsed += poll_interval_s

        # Timeout
        txn.status = QRISStatus.EXPIRED
        logger.warning(
            "QRIS payment timeout after %ds: order=%s", self._timeout_s, txn.order_id,
        )
        return QRISStatus.EXPIRED

    async def wait_for_payment(
        self,
        txn: QRISTransaction,
    ) -> QRISStatus:
        """
        Wait for payment with combined polling approach.
        Tries WebSocket first, falls back to polling.
        """
        # Try WebSocket connection for real-time updates
        try:
            return await self._wait_websocket(txn)
        except Exception as exc:
            logger.debug("WebSocket payment notification failed: %s — falling back to polling", exc)

        # Fall back to polling
        return await self.poll_payment_status(txn)

    async def _wait_websocket(self, txn: QRISTransaction) -> QRISStatus:
        """Listen for payment confirmation via WebSocket."""
        import websockets

        ws_url = self._cloud_url.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/ws/payments/{txn.order_id}"

        async with websockets.connect(ws_url, extra_headers={
            "Authorization": f"Bearer {self._api_key}",
        }) as ws:
            try:
                msg = await asyncio.wait_for(
                    ws.recv(), timeout=self._timeout_s
                )
                import json
                data = json.loads(msg)
                if data.get("status") == "paid":
                    txn.status = QRISStatus.PAID
                    txn.payment_ref = data.get("transaction_id", "")
                    return QRISStatus.PAID
            except asyncio.TimeoutError:
                txn.status = QRISStatus.EXPIRED
                return QRISStatus.EXPIRED

        return QRISStatus.EXPIRED

    # -------------------------------------------------------------------
    # QR display helpers
    # -------------------------------------------------------------------
    def get_qr_display_data(self, txn: QRISTransaction) -> dict[str, Any]:
        """Get data needed by the booth UI to display QR code."""
        return {
            "order_id": txn.order_id,
            "amount": txn.amount,
            "qr_url": txn.qr_url,
            "qr_string": txn.qr_string,
            "status": txn.status.value,
            "is_static": not txn.qr_string,
            "timeout_s": self._timeout_s,
            "message_id": "Scan QRIS untuk membayar",
            "message_amount": f"Total: Rp {txn.amount:,}".replace(",", "."),
        }

    @property
    def current_transaction(self) -> Optional[QRISTransaction]:
        return self._current_txn

    async def cancel_transaction(self) -> None:
        """Cancel the current transaction."""
        if self._current_txn:
            self._current_txn.status = QRISStatus.EXPIRED
            self._current_txn = None

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()


# Module-level singleton
qris_payment = QRISPayment()
