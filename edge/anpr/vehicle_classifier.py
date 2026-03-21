"""
Dual IR beam vehicle classifier.

Hardware setup:
- IR_CAR (GPIO 22): High beam — triggered by cars and motorcycles
- IR_MOTO (GPIO 23): Low beam — triggered only by motorcycles (lower height)

Classification logic:
- Both beams broken → car
- Low beam only → motorcycle
- High beam only → sensor fault
- Neither → no vehicle
"""
from __future__ import annotations

import logging
import time
from enum import Enum
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except (ImportError, RuntimeError):
    GPIO_AVAILABLE = False
    logger.warning("RPi.GPIO not available — vehicle classifier in simulation mode")


class VehicleType(str, Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    UNKNOWN = "unknown"
    NONE = "none"
    SENSOR_FAULT = "sensor_fault"


class VehicleClassifier:
    """Dual IR beam vehicle type classifier."""

    def __init__(self) -> None:
        self._gpio_config = settings.gpio
        self._initialized = False
        self._last_detection: Optional[VehicleType] = None
        self._last_detection_time: float = 0.0
        # Debounce: ignore readings within this window (ms)
        self._debounce_ms: int = 200

    def initialize(self) -> None:
        """Set up GPIO pins for IR sensors."""
        if not GPIO_AVAILABLE:
            logger.info("Vehicle classifier running in simulation mode")
            self._initialized = True
            return

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self._gpio_config.ir_car, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(self._gpio_config.ir_moto, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        self._initialized = True
        logger.info(
            "Vehicle classifier initialized (IR_CAR=GPIO%d, IR_MOTO=GPIO%d)",
            self._gpio_config.ir_car,
            self._gpio_config.ir_moto,
        )

    def _read_beams(self) -> tuple[bool, bool]:
        """
        Read IR beam states.
        Returns (high_beam_broken, low_beam_broken).
        Beams are active-low: GPIO LOW = beam broken.
        """
        if not GPIO_AVAILABLE:
            return False, False

        high = not GPIO.input(self._gpio_config.ir_car)
        low = not GPIO.input(self._gpio_config.ir_moto)
        return high, low

    def classify(self) -> VehicleType:
        """
        Classify the vehicle currently in the detection zone.

        Returns:
            VehicleType enum value.
        """
        if not self._initialized:
            self.initialize()

        high_broken, low_broken = self._read_beams()

        now = time.monotonic()

        if high_broken and low_broken:
            result = VehicleType.CAR
        elif low_broken and not high_broken:
            result = VehicleType.MOTORCYCLE
        elif high_broken and not low_broken:
            # High beam only = sensor fault — something blocking high but not low
            logger.warning("Sensor fault: high beam broken without low beam")
            result = VehicleType.SENSOR_FAULT
        else:
            result = VehicleType.NONE

        # Debounce: only update if enough time has passed or type changed
        elapsed_ms = (now - self._last_detection_time) * 1000
        if result != VehicleType.NONE and elapsed_ms > self._debounce_ms:
            self._last_detection = result
            self._last_detection_time = now
            logger.info("Vehicle classified: %s (high=%s, low=%s)", result.value, high_broken, low_broken)

        return result

    def is_vehicle_present(self) -> bool:
        """Check if any vehicle is currently in the detection zone."""
        high, low = self._read_beams()
        return high or low

    def wait_for_vehicle(self, timeout_s: float = 30.0) -> VehicleType:
        """
        Block until a vehicle is detected or timeout.
        Uses GPIO edge detection when available.
        """
        if not GPIO_AVAILABLE:
            return VehicleType.UNKNOWN

        start = time.monotonic()
        while time.monotonic() - start < timeout_s:
            vtype = self.classify()
            if vtype not in (VehicleType.NONE, VehicleType.SENSOR_FAULT):
                return vtype
            time.sleep(0.05)

        logger.warning("Vehicle detection timed out after %.1fs", timeout_s)
        return VehicleType.UNKNOWN

    @property
    def last_detection(self) -> Optional[VehicleType]:
        return self._last_detection

    def cleanup(self) -> None:
        """Release GPIO resources."""
        if GPIO_AVAILABLE and self._initialized:
            try:
                GPIO.cleanup([self._gpio_config.ir_car, self._gpio_config.ir_moto])
            except Exception:
                logger.debug("GPIO cleanup for IR sensors failed", exc_info=True)


# Module-level singleton
vehicle_classifier = VehicleClassifier()
