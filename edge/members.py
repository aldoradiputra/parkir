"""
Monthly pass / member management — lookup, validation, auto-open, prepaid deduction.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from database import db

logger = logging.getLogger(__name__)


@dataclass
class MemberInfo:
    member_id: str
    plate_number: str
    name: str
    vehicle_type: str
    valid_from: str
    valid_until: str
    prepaid_balance: int
    is_active: bool

    @property
    def is_valid(self) -> bool:
        """Check if membership is currently valid."""
        if not self.is_active:
            return False
        now = datetime.now(timezone.utc)
        try:
            until = datetime.fromisoformat(self.valid_until)
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            return until > now
        except (ValueError, TypeError):
            return False

    @property
    def days_remaining(self) -> int:
        """Days until membership expires."""
        try:
            until = datetime.fromisoformat(self.valid_until)
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            delta = until - datetime.now(timezone.utc)
            return max(0, delta.days)
        except (ValueError, TypeError):
            return 0

    @property
    def is_expiring_soon(self) -> bool:
        """True if membership expires within 7 days."""
        return 0 < self.days_remaining <= 7


class MemberManager:
    """Handles member lookup, validation, and prepaid balance deduction."""

    async def lookup_by_plate(self, plate_number: str) -> Optional[MemberInfo]:
        """
        Look up a member by plate number.
        Returns MemberInfo if found, None otherwise.
        """
        row = await db.get_member_by_plate(plate_number)
        if not row:
            return None

        member = MemberInfo(
            member_id=row["member_id"],
            plate_number=row["plate_number"],
            name=row.get("name", ""),
            vehicle_type=row.get("vehicle_type", ""),
            valid_from=row.get("valid_from", ""),
            valid_until=row.get("valid_until", ""),
            prepaid_balance=row.get("prepaid_balance", 0),
            is_active=bool(row.get("is_active", 0)),
        )

        logger.info(
            "Member lookup: plate=%s member=%s valid=%s days_remaining=%d",
            plate_number, member.member_id, member.is_valid, member.days_remaining,
        )
        return member

    async def should_auto_open(self, plate_number: str) -> tuple[bool, Optional[MemberInfo]]:
        """
        Check if gate should auto-open for this plate.
        Returns (should_open, member_info).
        """
        member = await self.lookup_by_plate(plate_number)
        if member is None:
            return False, None

        if not member.is_valid:
            logger.info(
                "Member %s expired (until: %s) — no auto-open",
                member.member_id, member.valid_until,
            )
            return False, member

        logger.info(
            "Member %s valid — auto-open gate for %s",
            member.member_id, plate_number,
        )
        return True, member

    async def deduct_prepaid(
        self,
        member_id: str,
        amount: int,
    ) -> tuple[bool, int]:
        """
        Deduct from member's prepaid balance.
        Returns (success, remaining_balance).
        """
        async with db.connection() as conn:
            cursor = await conn.execute(
                "SELECT prepaid_balance FROM members WHERE member_id=? AND is_active=1",
                (member_id,),
            )
            row = await cursor.fetchone()
            if not row:
                logger.warning("Member %s not found for prepaid deduction", member_id)
                return False, 0

            current_balance = row["prepaid_balance"]
            if current_balance < amount:
                logger.info(
                    "Insufficient prepaid balance: member=%s balance=%d required=%d",
                    member_id, current_balance, amount,
                )
                return False, current_balance

            new_balance = current_balance - amount
            await conn.execute(
                "UPDATE members SET prepaid_balance=?, "
                "updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') "
                "WHERE member_id=?",
                (new_balance, member_id),
            )
            await conn.commit()

            logger.info(
                "Prepaid deduction: member=%s amount=%d balance=%d→%d",
                member_id, amount, current_balance, new_balance,
            )
            return True, new_balance

    async def check_expiry_warning(self, member: MemberInfo) -> Optional[str]:
        """
        Generate expiry warning message if applicable.
        Returns Indonesian message string or None.
        """
        if not member.is_valid:
            return f"Member {member.name} telah kedaluwarsa pada {member.valid_until}"

        if member.is_expiring_soon:
            return (
                f"Member {member.name} akan berakhir dalam "
                f"{member.days_remaining} hari. Segera perpanjang!"
            )

        return None

    def get_display_data(self, member: MemberInfo) -> dict[str, Any]:
        """Get data for booth UI display."""
        return {
            "member_id": member.member_id,
            "name": member.name,
            "plate": member.plate_number,
            "vehicle_type": member.vehicle_type,
            "valid_until": member.valid_until,
            "days_remaining": member.days_remaining,
            "prepaid_balance": member.prepaid_balance,
            "is_valid": member.is_valid,
            "is_expiring_soon": member.is_expiring_soon,
            "message": "Selamat datang, " + (member.name or "Member") + "!",
        }


# Module-level singleton
member_manager = MemberManager()
