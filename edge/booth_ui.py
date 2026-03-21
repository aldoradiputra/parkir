"""
Booth touchscreen UI controller — Pygame-based 7" 1024x600 display.

Screen states:
- IDLE: Welcome screen with location name
- DETECTING: Vehicle detection animation
- PLATE_CONFIRMED: Show detected plate, vehicle type, confidence
- PLATE_MANUAL: Keyboard for manual plate entry
- PAYMENT_SCREEN: Payment method selection (QRIS / NFC)
- PAYMENT_CONFIRMED: Payment success animation
- NFC_ACTIVE: NFC tap waiting screen
- INSUFFICIENT_BAL: Insufficient balance — fallback to QRIS
- ERROR: Error screen with attendant call message
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from enum import Enum
from typing import Any, Optional

from config import settings

logger = logging.getLogger(__name__)

try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False
    logger.warning("pygame not available — booth UI disabled")


class ScreenState(str, Enum):
    IDLE = "idle"
    DETECTING = "detecting"
    PLATE_CONFIRMED = "plate_confirmed"
    PLATE_MANUAL = "plate_manual"
    PAYMENT_SCREEN = "payment_screen"
    PAYMENT_CONFIRMED = "payment_confirmed"
    NFC_ACTIVE = "nfc_active"
    INSUFFICIENT_BAL = "insufficient_bal"
    ERROR = "error"


# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------
class Colors:
    BLACK = (0, 0, 0)
    WHITE = (255, 255, 255)
    BG_DARK = (18, 18, 24)
    BG_CARD = (30, 30, 42)
    GREEN = (34, 197, 94)
    RED = (239, 68, 68)
    YELLOW = (250, 204, 21)
    BLUE = (59, 130, 246)
    GRAY = (107, 114, 128)
    LIGHT_GRAY = (156, 163, 175)
    ORANGE = (249, 115, 22)


class BoothUI:
    """Manages the booth touchscreen display via Pygame."""

    def __init__(self) -> None:
        self._width = settings.hardware.screen_width
        self._height = settings.hardware.screen_height
        self._state = ScreenState.IDLE
        self._data: dict[str, Any] = {}
        self._screen: Optional[pygame.Surface] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._font_large: Optional[pygame.font.Font] = None
        self._font_medium: Optional[pygame.font.Font] = None
        self._font_small: Optional[pygame.font.Font] = None
        self._font_plate: Optional[pygame.font.Font] = None
        self._manual_input: str = ""
        self._keyboard_visible = False

    @property
    def screen_state(self) -> ScreenState:
        return self._state

    def initialize(self) -> bool:
        """Initialize Pygame display."""
        if not PYGAME_AVAILABLE:
            logger.info("Booth UI running in headless mode")
            return False
        try:
            pygame.init()
            pygame.mouse.set_visible(True)
            self._screen = pygame.display.set_mode(
                (self._width, self._height),
                pygame.FULLSCREEN if not settings.debug else 0,
            )
            pygame.display.set_caption("Parkir — Booth UI")

            # Load fonts
            self._font_large = pygame.font.Font(None, 64)
            self._font_medium = pygame.font.Font(None, 42)
            self._font_small = pygame.font.Font(None, 28)
            self._font_plate = pygame.font.Font(None, 80)

            logger.info("Booth UI initialized (%dx%d)", self._width, self._height)
            return True
        except Exception:
            logger.exception("Failed to initialize Pygame display")
            return False

    # -------------------------------------------------------------------
    # State management
    # -------------------------------------------------------------------
    def set_state(self, state: ScreenState, data: Optional[dict[str, Any]] = None) -> None:
        """Update the screen state and associated data."""
        with self._lock:
            self._state = state
            if data:
                self._data = data
            else:
                self._data = {}
            if state == ScreenState.PLATE_MANUAL:
                self._manual_input = ""
                self._keyboard_visible = True
            else:
                self._keyboard_visible = False
        logger.debug("UI state → %s", state.value)

    def get_manual_input(self) -> str:
        """Get the current manual plate input."""
        return self._manual_input

    # -------------------------------------------------------------------
    # Main render loop (runs in separate thread)
    # -------------------------------------------------------------------
    def start(self) -> None:
        """Start the UI render loop in a background thread."""
        if not PYGAME_AVAILABLE:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
        if PYGAME_AVAILABLE:
            pygame.quit()

    def _run_loop(self) -> None:
        """Main UI thread loop — handles events and rendering."""
        clock = pygame.time.Clock()
        while self._running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self._running = False
                elif event.type == pygame.KEYDOWN:
                    self._handle_key(event)
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    self._handle_touch(event.pos)

            self._render()
            clock.tick(30)  # 30 FPS

    # -------------------------------------------------------------------
    # Rendering
    # -------------------------------------------------------------------
    def _render(self) -> None:
        if not self._screen:
            return

        with self._lock:
            state = self._state
            data = self._data.copy()

        self._screen.fill(Colors.BG_DARK)

        renderers = {
            ScreenState.IDLE: self._render_idle,
            ScreenState.DETECTING: self._render_detecting,
            ScreenState.PLATE_CONFIRMED: self._render_plate_confirmed,
            ScreenState.PLATE_MANUAL: self._render_plate_manual,
            ScreenState.PAYMENT_SCREEN: self._render_payment_screen,
            ScreenState.PAYMENT_CONFIRMED: self._render_payment_confirmed,
            ScreenState.NFC_ACTIVE: self._render_nfc_active,
            ScreenState.INSUFFICIENT_BAL: self._render_insufficient,
            ScreenState.ERROR: self._render_error,
        }

        renderer = renderers.get(state, self._render_idle)
        renderer(data)

        pygame.display.flip()

    def _draw_centered_text(
        self,
        text: str,
        font: pygame.font.Font,
        color: tuple[int, int, int],
        y: int,
    ) -> None:
        surface = font.render(text, True, color)
        rect = surface.get_rect(center=(self._width // 2, y))
        self._screen.blit(surface, rect)  # type: ignore

    def _draw_card(self, x: int, y: int, w: int, h: int) -> None:
        rect = pygame.Rect(x, y, w, h)
        pygame.draw.rect(self._screen, Colors.BG_CARD, rect, border_radius=12)  # type: ignore

    def _render_idle(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium and self._font_small
        self._draw_centered_text("PARKIR", self._font_large, Colors.GREEN, 200)
        self._draw_centered_text(
            "Selamat Datang", self._font_medium, Colors.WHITE, 280,
        )
        self._draw_centered_text(
            "Silakan masuk ke area deteksi",
            self._font_small, Colors.LIGHT_GRAY, 340,
        )
        self._draw_centered_text(
            f"Lane: {settings.cloud.lane_id}",
            self._font_small, Colors.GRAY, 500,
        )

    def _render_detecting(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium
        self._draw_centered_text(
            "Mendeteksi Kendaraan...", self._font_medium, Colors.YELLOW, 250,
        )
        # Animated dots
        dots = "." * (int(time.time() * 2) % 4)
        self._draw_centered_text(dots, self._font_large, Colors.YELLOW, 320)

    def _render_plate_confirmed(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium and self._font_small and self._font_plate
        plate = data.get("plate_number", "???")
        vtype = {"car": "Mobil", "motorcycle": "Motor"}.get(
            data.get("vehicle_type", ""), "Kendaraan"
        )
        conf = data.get("confidence", 0)

        self._draw_centered_text(
            "Plat Terdeteksi", self._font_medium, Colors.GREEN, 150,
        )

        # Plate number in large font with background card
        card_w, card_h = 600, 100
        card_x = (self._width - card_w) // 2
        self._draw_card(card_x, 200, card_w, card_h)
        self._draw_centered_text(plate, self._font_plate, Colors.WHITE, 250)

        self._draw_centered_text(
            f"Jenis: {vtype}  |  Confidence: {conf:.0%}",
            self._font_small, Colors.LIGHT_GRAY, 340,
        )

        # Confirmation prompt
        self._draw_centered_text(
            "Tekan OK untuk konfirmasi atau koreksi plat",
            self._font_small, Colors.YELLOW, 420,
        )

    def _render_plate_manual(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium and self._font_small
        self._draw_centered_text(
            "Masukkan Nomor Plat", self._font_medium, Colors.WHITE, 100,
        )

        # Input field
        card_w, card_h = 600, 80
        card_x = (self._width - card_w) // 2
        self._draw_card(card_x, 140, card_w, card_h)
        display_text = self._manual_input or "_ _ _ _ _ _ _ _"
        color = Colors.WHITE if self._manual_input else Colors.GRAY
        self._draw_centered_text(display_text, self._font_large, color, 180)

        # Virtual keyboard layout
        self._render_keyboard()

    def _render_keyboard(self) -> None:
        assert self._font_medium and self._font_small
        rows = [
            "1234567890",
            "QWERTYUIOP",
            "ASDFGHJKL",
            "ZXCVBNM",
        ]
        start_y = 260
        key_w, key_h = 80, 55
        gap = 8

        for row_idx, row in enumerate(rows):
            total_w = len(row) * (key_w + gap) - gap
            start_x = (self._width - total_w) // 2
            for col_idx, char in enumerate(row):
                x = start_x + col_idx * (key_w + gap)
                y = start_y + row_idx * (key_h + gap)
                rect = pygame.Rect(x, y, key_w, key_h)
                pygame.draw.rect(self._screen, Colors.BG_CARD, rect, border_radius=6)  # type: ignore
                char_surface = self._font_medium.render(char, True, Colors.WHITE)
                char_rect = char_surface.get_rect(center=rect.center)
                self._screen.blit(char_surface, char_rect)  # type: ignore

        # Action buttons
        btn_y = start_y + 4 * (key_h + gap) + 10
        # DEL button
        del_rect = pygame.Rect(self._width // 2 - 200, btn_y, 150, 50)
        pygame.draw.rect(self._screen, Colors.RED, del_rect, border_radius=8)  # type: ignore
        del_text = self._font_small.render("HAPUS", True, Colors.WHITE)
        self._screen.blit(del_text, del_text.get_rect(center=del_rect.center))  # type: ignore

        # OK button
        ok_rect = pygame.Rect(self._width // 2 + 50, btn_y, 150, 50)
        pygame.draw.rect(self._screen, Colors.GREEN, ok_rect, border_radius=8)  # type: ignore
        ok_text = self._font_small.render("OK", True, Colors.WHITE)
        self._screen.blit(ok_text, ok_text.get_rect(center=ok_rect.center))  # type: ignore

    def _render_payment_screen(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium and self._font_small
        amount = data.get("amount", 0)

        self._draw_centered_text(
            "Pembayaran", self._font_medium, Colors.WHITE, 100,
        )
        self._draw_centered_text(
            f"Rp {amount:,}".replace(",", "."),
            self._font_large, Colors.GREEN, 170,
        )

        # QRIS button
        qris_rect = pygame.Rect(self._width // 2 - 280, 250, 250, 200)
        pygame.draw.rect(self._screen, Colors.BLUE, qris_rect, border_radius=12)  # type: ignore
        self._draw_centered_text(
            "QRIS", self._font_medium, Colors.WHITE, 330,
        )

        # NFC button
        nfc_available = data.get("nfc_available", False)
        nfc_color = Colors.ORANGE if nfc_available else Colors.GRAY
        nfc_rect = pygame.Rect(self._width // 2 + 30, 250, 250, 200)
        pygame.draw.rect(self._screen, nfc_color, nfc_rect, border_radius=12)  # type: ignore
        self._draw_centered_text(
            "E-Money", self._font_medium, Colors.WHITE, 330,
        )
        if not nfc_available:
            self._draw_centered_text(
                "Tidak tersedia", self._font_small, Colors.RED, 370,
            )

    def _render_payment_confirmed(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium
        self._draw_centered_text(
            "Pembayaran Berhasil!", self._font_large, Colors.GREEN, 240,
        )
        self._draw_centered_text(
            "Silakan lewat", self._font_medium, Colors.WHITE, 320,
        )

    def _render_nfc_active(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium and self._font_small
        self._draw_centered_text(
            "Tempelkan Kartu E-Money", self._font_medium, Colors.ORANGE, 220,
        )
        message = data.get("message", "Menunggu kartu...")
        self._draw_centered_text(message, self._font_small, Colors.LIGHT_GRAY, 300)

        amount = data.get("amount", 0)
        if amount:
            self._draw_centered_text(
                f"Total: Rp {amount:,}".replace(",", "."),
                self._font_medium, Colors.WHITE, 380,
            )

    def _render_insufficient(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium and self._font_small
        self._draw_centered_text(
            "Saldo Tidak Cukup", self._font_medium, Colors.RED, 200,
        )
        balance = data.get("balance", 0)
        amount = data.get("amount", 0)
        self._draw_centered_text(
            f"Saldo: Rp {balance:,}  |  Total: Rp {amount:,}".replace(",", "."),
            self._font_small, Colors.LIGHT_GRAY, 270,
        )
        self._draw_centered_text(
            "Gunakan QRIS untuk membayar",
            self._font_medium, Colors.YELLOW, 360,
        )

    def _render_error(self, data: dict[str, Any]) -> None:
        assert self._font_large and self._font_medium and self._font_small
        self._draw_centered_text(
            "Terjadi Kesalahan", self._font_large, Colors.RED, 220,
        )
        message = data.get("message", "Hubungi petugas")
        self._draw_centered_text(message, self._font_medium, Colors.WHITE, 310)

    # -------------------------------------------------------------------
    # Input handling
    # -------------------------------------------------------------------
    def _handle_key(self, event: Any) -> None:
        if self._state != ScreenState.PLATE_MANUAL:
            return
        if event.key == pygame.K_BACKSPACE:
            self._manual_input = self._manual_input[:-1]
        elif event.key == pygame.K_RETURN:
            pass  # Handled by touch on OK button
        elif event.unicode.isalnum() and len(self._manual_input) < 15:
            self._manual_input += event.unicode.upper()

    def _handle_touch(self, pos: tuple[int, int]) -> None:
        if self._state == ScreenState.PLATE_MANUAL:
            self._handle_keyboard_touch(pos)
        elif self._state == ScreenState.PAYMENT_SCREEN:
            self._handle_payment_touch(pos)

    def _handle_keyboard_touch(self, pos: tuple[int, int]) -> None:
        rows = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
        start_y = 260
        key_w, key_h = 80, 55
        gap = 8
        x, y = pos

        for row_idx, row in enumerate(rows):
            total_w = len(row) * (key_w + gap) - gap
            start_x = (self._width - total_w) // 2
            for col_idx, char in enumerate(row):
                kx = start_x + col_idx * (key_w + gap)
                ky = start_y + row_idx * (key_h + gap)
                if kx <= x <= kx + key_w and ky <= y <= ky + key_h:
                    if len(self._manual_input) < 15:
                        self._manual_input += char
                    return

        # Check action buttons
        btn_y = start_y + 4 * (key_h + gap) + 10
        if self._width // 2 - 200 <= x <= self._width // 2 - 50 and btn_y <= y <= btn_y + 50:
            self._manual_input = self._manual_input[:-1]
        elif self._width // 2 + 50 <= x <= self._width // 2 + 200 and btn_y <= y <= btn_y + 50:
            pass  # OK pressed — state machine handles submission

    def _handle_payment_touch(self, pos: tuple[int, int]) -> None:
        x, y = pos
        # QRIS button region
        if self._width // 2 - 280 <= x <= self._width // 2 - 30 and 250 <= y <= 450:
            with self._lock:
                self._data["selected_method"] = "qris"
        # NFC button region
        elif self._width // 2 + 30 <= x <= self._width // 2 + 280 and 250 <= y <= 450:
            with self._lock:
                self._data["selected_method"] = "nfc"


# Module-level singleton
booth_ui = BoothUI()
