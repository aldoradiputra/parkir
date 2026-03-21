"""
Edge Node configuration loaded from environment variables.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _env_int(key: str, default: int = 0) -> int:
    return int(os.getenv(key, str(default)))


def _env_float(key: str, default: float = 0.0) -> float:
    return float(os.getenv(key, str(default)))


def _env_bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).lower() in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# Lane mode
# ---------------------------------------------------------------------------
class LaneMode(str, Enum):
    ENTRY = "entry"
    EXIT = "exit"


# ---------------------------------------------------------------------------
# ANPR confidence tiers
# ---------------------------------------------------------------------------
class ConfidenceTier(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    FAIL = "fail"


# ---------------------------------------------------------------------------
# Connectivity state
# ---------------------------------------------------------------------------
class ConnectivityState(str, Enum):
    FULLY_ONLINE = "fully_online"
    INTERMITTENT = "intermittent"
    OFFLINE = "offline"
    EXTENDED_OFFLINE = "extended_offline"


# ---------------------------------------------------------------------------
# Configuration dataclasses
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CloudConfig:
    api_url: str = _env("CLOUD_API_URL", "https://api.parkir.id")
    lane_api_key: str = _env("LANE_API_KEY", "")
    location_id: str = _env("LOCATION_ID", "")
    lane_id: str = _env("LANE_ID", "")
    lane_mode: LaneMode = LaneMode(_env("LANE_MODE", "entry"))


@dataclass(frozen=True)
class ANPRConfig:
    confidence_high: float = _env_float("ANPR_CONFIDENCE_HIGH", 0.85)
    confidence_medium: float = _env_float("ANPR_CONFIDENCE_MEDIUM", 0.65)
    confidence_low: float = _env_float("ANPR_CONFIDENCE_LOW", 0.40)
    burst_frames: int = _env_int("ANPR_BURST_FRAMES", 5)
    plate_regex: str = r"^([A-Z]{1,2})\s?(\d{1,4})\s?([A-Z]{1,3})$"
    model_path: str = _env("YOLO_MODEL_PATH", str(BASE_DIR / "models" / "yolov8n-plate.pt"))
    clahe_clip: float = _env_float("CLAHE_CLIP", 2.0)
    clahe_grid: int = _env_int("CLAHE_GRID", 8)
    target_width: int = 640
    upscale_min: int = 2
    upscale_max: int = 4


@dataclass(frozen=True)
class GPIOConfig:
    relay_open: int = _env_int("GPIO_RELAY_OPEN", 17)
    relay_close: int = _env_int("GPIO_RELAY_CLOSE", 27)
    ir_car: int = _env_int("GPIO_IR_CAR", 22)
    ir_moto: int = _env_int("GPIO_IR_MOTO", 23)
    button_override: int = _env_int("GPIO_BUTTON_OVERRIDE", 24)
    led_green: int = _env_int("GPIO_LED_GREEN", 25)
    led_red: int = _env_int("GPIO_LED_RED", 26)
    buzzer: int = _env_int("GPIO_BUZZER", 16)


@dataclass(frozen=True)
class HardwareConfig:
    nfc_device: str = _env("NFC_DEVICE", "usb:072f:2200")
    printer_vendor_id: int = _env_int("PRINTER_VENDOR_ID", 0x0416)
    printer_product_id: int = _env_int("PRINTER_PRODUCT_ID", 0x5011)
    printer_port: str = _env("PRINTER_PORT", "/dev/usb/lp0")
    camera_car_index: int = _env_int("CAMERA_CAR_INDEX", 0)
    camera_moto_index: int = _env_int("CAMERA_MOTO_INDEX", 1)
    modem_apn: str = _env("MODEM_APN", "internet")
    screen_width: int = _env_int("SCREEN_WIDTH", 1024)
    screen_height: int = _env_int("SCREEN_HEIGHT", 600)


@dataclass(frozen=True)
class TimingConfig:
    sync_interval_s: int = _env_int("SYNC_INTERVAL", 30)
    payment_timeout_s: int = _env_int("PAYMENT_TIMEOUT", 180)
    gate_stuck_threshold_s: int = _env_int("GATE_STUCK_THRESHOLD", 45)
    heartbeat_interval_s: int = _env_int("HEARTBEAT_INTERVAL", 60)
    medium_confirm_timeout_s: int = _env_int("MEDIUM_CONFIRM_TIMEOUT", 5)
    gate_open_duration_s: int = _env_int("GATE_OPEN_DURATION", 10)


@dataclass(frozen=True)
class PaymentConfig:
    midtrans_server_key: str = _env("MIDTRANS_SERVER_KEY", "")
    midtrans_client_key: str = _env("MIDTRANS_CLIENT_KEY", "")
    midtrans_is_production: bool = _env_bool("MIDTRANS_PRODUCTION", False)
    fonnte_api_key: str = _env("FONNTE_API_KEY", "")
    static_qris_image: str = _env("STATIC_QRIS_IMAGE", str(BASE_DIR / "assets" / "static_qris.png"))


# ---------------------------------------------------------------------------
# Aggregate config
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class EdgeConfig:
    cloud: CloudConfig = field(default_factory=CloudConfig)
    anpr: ANPRConfig = field(default_factory=ANPRConfig)
    gpio: GPIOConfig = field(default_factory=GPIOConfig)
    hardware: HardwareConfig = field(default_factory=HardwareConfig)
    timing: TimingConfig = field(default_factory=TimingConfig)
    payment: PaymentConfig = field(default_factory=PaymentConfig)
    db_path: str = _env("DB_PATH", str(BASE_DIR / "parkir_edge.db"))
    log_level: str = _env("LOG_LEVEL", "INFO")
    debug: bool = _env_bool("DEBUG", False)


# Singleton
settings = EdgeConfig()
