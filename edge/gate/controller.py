"""
GPIO gate controller with anti-crush safety, LED/buzzer control,
emergency override, and gate stuck detection.
"""
from __future__ import annotations

import asyncio
import logging
import time
from enum import Enum
from typing import Callable, Optional

from config import settings

logger = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except (ImportError, RuntimeError):
    GPIO_AVAILABLE = False
    logger.warning("RPi.GPIO not available — gate controller in simulation mode")


class GateState(str, Enum):
    CLOSED = "closed"
    OPENING = "opening"
    OPEN = "open"
    CLOSING = "closing"
    STUCK = "stuck"
    ERROR = "error"


class GateController:
    """Controls barrier gate via relay, with safety features."""

    def __init__(self) -> None:
        self._cfg = settings.gpio
        self._timing = settings.timing
        self._state = GateState.CLOSED
        self._opened_at: Optional[float] = None
        self._initialized = False
        self._override_callback: Optional[Callable[[], None]] = None
        self._stuck_callback: Optional[Callable[[], None]] = None
        self._monitor_task: Optional[asyncio.Task] = None

    @property
    def state(self) -> GateState:
        return self._state

    @property
    def is_open(self) -> bool:
        return self._state in (GateState.OPEN, GateState.OPENING)

    @property
    def seconds_open(self) -> float:
        if self._opened_at is None:
            return 0.0
        return time.monotonic() - self._opened_at

    def initialize(self) -> None:
        """Set up all GPIO pins."""
        if not GPIO_AVAILABLE:
            logger.info("Gate controller running in simulation mode")
            self._initialized = True
            return

        GPIO.setmode(GPIO.BCM)

        # Relay outputs (active HIGH)
        GPIO.setup(self._cfg.relay_open, GPIO.OUT, initial=GPIO.LOW)
        GPIO.setup(self._cfg.relay_close, GPIO.OUT, initial=GPIO.LOW)

        # LED outputs
        GPIO.setup(self._cfg.led_green, GPIO.OUT, initial=GPIO.LOW)
        GPIO.setup(self._cfg.led_red, GPIO.OUT, initial=GPIO.HIGH)  # Red on at idle

        # Buzzer output
        GPIO.setup(self._cfg.buzzer, GPIO.OUT, initial=GPIO.LOW)

        # Emergency override button (active LOW with pull-up)
        GPIO.setup(self._cfg.button_override, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.add_event_detect(
            self._cfg.button_override,
            GPIO.FALLING,
            callback=self._on_override_pressed,
            bouncetime=500,
        )

        self._initialized = True
        logger.info("Gate controller initialized")

    # -------------------------------------------------------------------
    # Gate operations
    # -------------------------------------------------------------------
    def open_gate(self) -> bool:
        """
        Open the barrier gate.
        Returns True if the command was sent successfully.
        """
        if self._state in (GateState.OPEN, GateState.OPENING):
            logger.debug("Gate already open/opening — ignoring open command")
            return True

        logger.info("Opening gate")
        self._state = GateState.OPENING

        if GPIO_AVAILABLE:
            # Ensure close relay is off before opening
            GPIO.output(self._cfg.relay_close, GPIO.LOW)
            time.sleep(0.05)
            # Pulse open relay
            GPIO.output(self._cfg.relay_open, GPIO.HIGH)
            time.sleep(0.5)
            GPIO.output(self._cfg.relay_open, GPIO.LOW)

        self._state = GateState.OPEN
        self._opened_at = time.monotonic()

        # Set LEDs
        self._set_led_green(True)
        self._set_led_red(False)
        self._beep(count=1, duration_ms=100)

        logger.info("Gate opened")
        return True

    def close_gate(self) -> bool:
        """
        Close the barrier gate with anti-crush safety.
        Returns True if the command was sent successfully.
        """
        if self._state == GateState.CLOSED:
            logger.debug("Gate already closed — ignoring close command")
            return True

        # Anti-crush: check if IR beams detect a vehicle still under the gate
        if self._is_vehicle_under_gate():
            logger.warning("Anti-crush: vehicle detected under gate — aborting close")
            self._beep(count=3, duration_ms=200)
            return False

        logger.info("Closing gate")
        self._state = GateState.CLOSING

        if GPIO_AVAILABLE:
            # Ensure open relay is off before closing
            GPIO.output(self._cfg.relay_open, GPIO.LOW)
            time.sleep(0.05)
            # Pulse close relay
            GPIO.output(self._cfg.relay_close, GPIO.HIGH)
            time.sleep(0.5)
            GPIO.output(self._cfg.relay_close, GPIO.LOW)

        self._state = GateState.CLOSED
        self._opened_at = None

        # Set LEDs
        self._set_led_green(False)
        self._set_led_red(True)

        logger.info("Gate closed")
        return True

    def _is_vehicle_under_gate(self) -> bool:
        """Check IR sensors for vehicle presence (anti-crush safety)."""
        if not GPIO_AVAILABLE:
            return False
        # Both IR sensors are active-low when beam is broken
        car_beam = not GPIO.input(self._cfg.ir_car)
        moto_beam = not GPIO.input(self._cfg.ir_moto)
        return car_beam or moto_beam

    # -------------------------------------------------------------------
    # LED control
    # -------------------------------------------------------------------
    def _set_led_green(self, on: bool) -> None:
        if GPIO_AVAILABLE:
            GPIO.output(self._cfg.led_green, GPIO.HIGH if on else GPIO.LOW)

    def _set_led_red(self, on: bool) -> None:
        if GPIO_AVAILABLE:
            GPIO.output(self._cfg.led_red, GPIO.HIGH if on else GPIO.LOW)

    def set_leds(self, green: bool, red: bool) -> None:
        """Public LED control."""
        self._set_led_green(green)
        self._set_led_red(red)

    # -------------------------------------------------------------------
    # Buzzer control
    # -------------------------------------------------------------------
    def _beep(self, count: int = 1, duration_ms: int = 100, pause_ms: int = 100) -> None:
        if not GPIO_AVAILABLE:
            return
        for i in range(count):
            GPIO.output(self._cfg.buzzer, GPIO.HIGH)
            time.sleep(duration_ms / 1000)
            GPIO.output(self._cfg.buzzer, GPIO.LOW)
            if i < count - 1:
                time.sleep(pause_ms / 1000)

    def buzzer_alert(self) -> None:
        """Sound an alert buzzer pattern."""
        self._beep(count=5, duration_ms=150, pause_ms=100)

    def buzzer_success(self) -> None:
        """Sound a success buzzer pattern."""
        self._beep(count=2, duration_ms=80, pause_ms=80)

    def buzzer_error(self) -> None:
        """Sound an error buzzer pattern."""
        self._beep(count=3, duration_ms=300, pause_ms=200)

    # -------------------------------------------------------------------
    # Emergency override
    # -------------------------------------------------------------------
    def _on_override_pressed(self, channel: int) -> None:
        """GPIO callback for emergency override button."""
        logger.warning("Emergency override button pressed!")
        if self._state != GateState.OPEN:
            self.open_gate()
        if self._override_callback:
            try:
                self._override_callback()
            except Exception:
                logger.exception("Override callback failed")

    def set_override_callback(self, callback: Callable[[], None]) -> None:
        self._override_callback = callback

    def set_stuck_callback(self, callback: Callable[[], None]) -> None:
        self._stuck_callback = callback

    # -------------------------------------------------------------------
    # Gate stuck monitoring (async)
    # -------------------------------------------------------------------
    async def start_monitoring(self) -> None:
        """Start the async gate stuck monitoring loop."""
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("Gate stuck monitoring started")

    async def stop_monitoring(self) -> None:
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

    async def _monitor_loop(self) -> None:
        """Check for gate stuck condition periodically."""
        while True:
            try:
                await asyncio.sleep(5)
                if self._state == GateState.OPEN and self._opened_at:
                    elapsed = time.monotonic() - self._opened_at
                    if elapsed > self._timing.gate_stuck_threshold_s:
                        if self._state != GateState.STUCK:
                            self._state = GateState.STUCK
                            logger.warning(
                                "Gate STUCK — open for %.0fs (threshold: %ds)",
                                elapsed, self._timing.gate_stuck_threshold_s,
                            )
                            self.buzzer_alert()
                            if self._stuck_callback:
                                try:
                                    self._stuck_callback()
                                except Exception:
                                    logger.exception("Stuck callback failed")
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Gate monitor error")

    # -------------------------------------------------------------------
    # Async wrappers
    # -------------------------------------------------------------------
    async def async_open_gate(self) -> bool:
        """Async wrapper for open_gate."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.open_gate)

    async def async_close_gate(self) -> bool:
        """Async wrapper for close_gate."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.close_gate)

    # -------------------------------------------------------------------
    # Cleanup
    # -------------------------------------------------------------------
    def cleanup(self) -> None:
        """Release all GPIO resources."""
        if not GPIO_AVAILABLE or not self._initialized:
            return
        try:
            GPIO.output(self._cfg.relay_open, GPIO.LOW)
            GPIO.output(self._cfg.relay_close, GPIO.LOW)
            GPIO.output(self._cfg.led_green, GPIO.LOW)
            GPIO.output(self._cfg.led_red, GPIO.LOW)
            GPIO.output(self._cfg.buzzer, GPIO.LOW)
            GPIO.cleanup([
                self._cfg.relay_open, self._cfg.relay_close,
                self._cfg.ir_car, self._cfg.ir_moto,
                self._cfg.button_override,
                self._cfg.led_green, self._cfg.led_red,
                self._cfg.buzzer,
            ])
        except Exception:
            logger.debug("GPIO cleanup failed", exc_info=True)
        self._initialized = False


# Module-level singleton
gate_controller = GateController()
