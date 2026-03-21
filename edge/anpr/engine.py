"""
ANPR Engine — YOLOv8-nano plate detection + EasyOCR character recognition.

Handles Indonesian plate format with zone-aware OCR correction,
CLAHE preprocessing, burst capture, deskew, and confidence tiering.
"""
from __future__ import annotations

import logging
import math
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from config import ANPRConfig, ConfidenceTier, settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Zone-aware OCR correction maps
# ---------------------------------------------------------------------------
LETTER_CORRECTIONS: dict[str, str] = {
    "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B",
}
DIGIT_CORRECTIONS: dict[str, str] = {
    "O": "0", "I": "1", "Z": "2", "S": "5", "G": "6", "B": "8",
    "o": "0", "l": "1", "i": "1",
}

PLATE_RE = re.compile(settings.anpr.plate_regex)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class PlateResult:
    plate_text: str
    confidence: float
    tier: ConfidenceTier
    bbox: tuple[int, int, int, int] | None = None
    image: Optional[np.ndarray] = None
    raw_ocr: str = ""


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class ANPREngine:
    """YOLOv8-nano + EasyOCR pipeline for Indonesian license plates."""

    def __init__(self, config: ANPRConfig | None = None) -> None:
        self.cfg = config or settings.anpr
        self._yolo = None
        self._ocr = None
        self._car_cap: Optional[cv2.VideoCapture] = None
        self._moto_cap: Optional[cv2.VideoCapture] = None

    # -------------------------------------------------------------------
    # Lazy initialization (heavy imports)
    # -------------------------------------------------------------------
    def _ensure_yolo(self):
        if self._yolo is None:
            try:
                from ultralytics import YOLO
                model_path = self.cfg.model_path
                if not Path(model_path).exists():
                    logger.warning(
                        "YOLO model not found at %s, using default yolov8n.pt", model_path
                    )
                    model_path = "yolov8n.pt"
                self._yolo = YOLO(model_path)
                logger.info("YOLOv8 model loaded from %s", model_path)
            except Exception:
                logger.exception("Failed to load YOLOv8 model")
                raise

    def _ensure_ocr(self):
        if self._ocr is None:
            try:
                import easyocr
                self._ocr = easyocr.Reader(
                    ["en"], gpu=False, verbose=False,
                )
                logger.info("EasyOCR reader initialized")
            except Exception:
                logger.exception("Failed to initialize EasyOCR")
                raise

    def initialize(self) -> None:
        """Pre-load models (call during startup)."""
        self._ensure_yolo()
        self._ensure_ocr()
        logger.info("ANPR engine initialized")

    def open_cameras(self) -> None:
        """Open car and motorcycle cameras."""
        hw = settings.hardware
        self._car_cap = cv2.VideoCapture(hw.camera_car_index)
        self._moto_cap = cv2.VideoCapture(hw.camera_moto_index)
        if self._car_cap.isOpened():
            logger.info("Car camera opened (index %d)", hw.camera_car_index)
        else:
            logger.warning("Car camera failed to open (index %d)", hw.camera_car_index)
        if self._moto_cap.isOpened():
            logger.info("Motorcycle camera opened (index %d)", hw.camera_moto_index)
        else:
            logger.warning("Motorcycle camera failed to open (index %d)", hw.camera_moto_index)

    def close_cameras(self) -> None:
        for cap in (self._car_cap, self._moto_cap):
            if cap and cap.isOpened():
                cap.release()

    # -------------------------------------------------------------------
    # Image preprocessing
    # -------------------------------------------------------------------
    def _preprocess(self, img: np.ndarray) -> np.ndarray:
        """Apply CLAHE and resize to target width."""
        # Convert to grayscale for CLAHE
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img

        # CLAHE
        clahe = cv2.createCLAHE(
            clipLimit=self.cfg.clahe_clip,
            tileGridSize=(self.cfg.clahe_grid, self.cfg.clahe_grid),
        )
        enhanced = clahe.apply(gray)

        # Resize to target width maintaining aspect ratio
        h, w = enhanced.shape[:2]
        if w > self.cfg.target_width:
            scale = self.cfg.target_width / w
            enhanced = cv2.resize(
                enhanced, (self.cfg.target_width, int(h * scale)),
                interpolation=cv2.INTER_AREA,
            )

        return enhanced

    def _deskew(self, img: np.ndarray) -> np.ndarray:
        """Deskew a plate ROI using minimum area rectangle."""
        try:
            if len(img.shape) == 3:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            else:
                gray = img.copy()

            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if not contours:
                return img

            largest = max(contours, key=cv2.contourArea)
            rect = cv2.minAreaRect(largest)
            angle = rect[1][0]

            # Correct angle
            if angle < -45:
                angle = 90 + angle
            elif angle > 45:
                angle = angle - 90

            if abs(angle) < 1.0:
                return img

            h, w = gray.shape[:2]
            center = (w // 2, h // 2)
            matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
            return cv2.warpAffine(
                img, matrix, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )
        except Exception:
            logger.debug("Deskew failed, returning original image")
            return img

    def _upscale_plate(self, roi: np.ndarray) -> np.ndarray:
        """Upscale small plate ROI by 2-4x."""
        h, w = roi.shape[:2]
        min_width = 200
        if w >= min_width:
            return roi
        scale = max(self.cfg.upscale_min, min(self.cfg.upscale_max, min_width / w))
        return cv2.resize(
            roi, (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC,
        )

    # -------------------------------------------------------------------
    # Plate detection (YOLOv8)
    # -------------------------------------------------------------------
    def _detect_plates(self, frame: np.ndarray) -> list[tuple[np.ndarray, tuple[int, int, int, int], float]]:
        """Detect plate regions in a frame. Returns list of (roi, bbox, det_conf)."""
        self._ensure_yolo()
        results = self._yolo(frame, verbose=False, conf=0.3)  # type: ignore[union-attr]

        plates: list[tuple[np.ndarray, tuple[int, int, int, int], float]] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                det_conf = float(box.conf[0])
                # Pad the ROI slightly
                pad_x = int((x2 - x1) * 0.05)
                pad_y = int((y2 - y1) * 0.1)
                y1p = max(0, y1 - pad_y)
                y2p = min(frame.shape[0], y2 + pad_y)
                x1p = max(0, x1 - pad_x)
                x2p = min(frame.shape[1], x2 + pad_x)
                roi = frame[y1p:y2p, x1p:x2p]
                if roi.size > 0:
                    plates.append((roi, (x1, y1, x2, y2), det_conf))

        return plates

    # -------------------------------------------------------------------
    # OCR
    # -------------------------------------------------------------------
    def _ocr_plate(self, roi: np.ndarray) -> tuple[str, float]:
        """Run EasyOCR on a plate ROI. Returns (raw_text, ocr_confidence)."""
        self._ensure_ocr()
        roi = self._upscale_plate(roi)
        roi = self._deskew(roi)

        # Preprocess for OCR
        if len(roi.shape) == 3:
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        else:
            gray = roi

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
        gray = clahe.apply(gray)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        results = self._ocr.readtext(binary, detail=1, paragraph=False)  # type: ignore[union-attr]

        if not results:
            return "", 0.0

        # Combine all detected text
        texts: list[str] = []
        confidences: list[float] = []
        for _, text, conf in results:
            texts.append(text.strip())
            confidences.append(conf)

        raw = " ".join(texts).upper().strip()
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        return raw, avg_conf

    # -------------------------------------------------------------------
    # Zone-aware correction & normalization
    # -------------------------------------------------------------------
    @staticmethod
    def _correct_zones(raw: str) -> str:
        """
        Apply zone-aware corrections to Indonesian plate format.
        Format: [1-2 letters] [1-4 digits] [1-3 letters]
        """
        # Remove all spaces and non-alphanumeric
        cleaned = re.sub(r"[^A-Z0-9]", "", raw.upper())
        if not cleaned:
            return ""

        # Try to split into zones: prefix letters, digits, suffix letters
        match = re.match(r"^([A-Z0-9]{1,2})(\d{1,4})([A-Z0-9]{1,3})$", cleaned)
        if not match:
            # Try harder: find digit boundary
            first_digit = -1
            last_digit = -1
            for i, ch in enumerate(cleaned):
                if ch.isdigit():
                    if first_digit == -1:
                        first_digit = i
                    last_digit = i

            if first_digit == -1:
                return cleaned

            prefix = cleaned[:first_digit] if first_digit > 0 else ""
            digits = cleaned[first_digit:last_digit + 1] if last_digit >= first_digit else ""
            suffix = cleaned[last_digit + 1:] if last_digit + 1 < len(cleaned) else ""

            # Correct prefix (should be letters)
            prefix = "".join(LETTER_CORRECTIONS.get(c, c) for c in prefix)
            # Correct digits (should be numbers)
            digits = "".join(DIGIT_CORRECTIONS.get(c, c) for c in digits)
            # Correct suffix (should be letters)
            suffix = "".join(LETTER_CORRECTIONS.get(c, c) for c in suffix)

            return f"{prefix}{digits}{suffix}"

        prefix, digits, suffix = match.group(1), match.group(2), match.group(3)

        # Apply zone corrections
        prefix = "".join(LETTER_CORRECTIONS.get(c, c) for c in prefix)
        digits = "".join(DIGIT_CORRECTIONS.get(c, c) for c in digits)
        suffix = "".join(LETTER_CORRECTIONS.get(c, c) for c in suffix)

        return f"{prefix}{digits}{suffix}"

    @staticmethod
    def normalize_plate(text: str) -> str:
        """
        Normalize a plate string: uppercase, strip whitespace, remove
        non-alphanumerics, apply zone correction.
        """
        cleaned = re.sub(r"[^A-Za-z0-9]", "", text.upper().strip())
        corrected = ANPREngine._correct_zones(cleaned)
        return corrected

    def _classify_confidence(self, confidence: float) -> ConfidenceTier:
        """Map a numeric confidence to a tier."""
        if confidence >= self.cfg.confidence_high:
            return ConfidenceTier.HIGH
        elif confidence >= self.cfg.confidence_medium:
            return ConfidenceTier.MEDIUM
        elif confidence >= self.cfg.confidence_low:
            return ConfidenceTier.LOW
        else:
            return ConfidenceTier.FAIL

    # -------------------------------------------------------------------
    # Burst capture
    # -------------------------------------------------------------------
    def _capture_burst(self, cap: cv2.VideoCapture, count: int = 5) -> list[np.ndarray]:
        """Capture a burst of frames from a camera."""
        frames: list[np.ndarray] = []
        for _ in range(count):
            ret, frame = cap.read()
            if ret and frame is not None:
                frames.append(frame)
        return frames

    # -------------------------------------------------------------------
    # Main recognition pipeline
    # -------------------------------------------------------------------
    def recognize(
        self,
        frame: np.ndarray | None = None,
        vehicle_type: str = "car",
    ) -> PlateResult:
        """
        Run the full ANPR pipeline on a single frame or burst from camera.

        If frame is None, captures from the appropriate camera.
        Returns the best PlateResult from burst analysis.
        """
        frames: list[np.ndarray] = []

        if frame is not None:
            frames = [frame]
        else:
            cap = self._car_cap if vehicle_type == "car" else self._moto_cap
            if cap and cap.isOpened():
                frames = self._capture_burst(cap, self.cfg.burst_frames)
            else:
                logger.warning("No camera available for vehicle type: %s", vehicle_type)
                return PlateResult(
                    plate_text="", confidence=0.0,
                    tier=ConfidenceTier.FAIL, raw_ocr="",
                )

        if not frames:
            return PlateResult(
                plate_text="", confidence=0.0,
                tier=ConfidenceTier.FAIL, raw_ocr="",
            )

        best: PlateResult | None = None

        for frame in frames:
            preprocessed = self._preprocess(frame)
            # Detect on original (color) for YOLO, OCR on preprocessed
            detections = self._detect_plates(frame)

            for roi, bbox, det_conf in detections:
                raw_text, ocr_conf = self._ocr_plate(roi)
                if not raw_text:
                    continue

                normalized = self.normalize_plate(raw_text)
                if not normalized:
                    continue

                # Combined confidence: detection * OCR
                combined = det_conf * ocr_conf

                # Validate against regex for bonus
                if PLATE_RE.match(normalized):
                    combined = min(1.0, combined * 1.15)

                tier = self._classify_confidence(combined)

                result = PlateResult(
                    plate_text=normalized,
                    confidence=round(combined, 4),
                    tier=tier,
                    bbox=bbox,
                    image=roi,
                    raw_ocr=raw_text,
                )

                if best is None or result.confidence > best.confidence:
                    best = result

        if best is None:
            return PlateResult(
                plate_text="", confidence=0.0,
                tier=ConfidenceTier.FAIL, raw_ocr="",
            )

        logger.info(
            "ANPR result: plate=%s conf=%.2f tier=%s raw=%s",
            best.plate_text, best.confidence, best.tier.value, best.raw_ocr,
        )
        return best

    def recognize_from_camera(self, vehicle_type: str = "car") -> PlateResult:
        """Convenience method: capture burst and recognize."""
        return self.recognize(frame=None, vehicle_type=vehicle_type)


# Module-level singleton
anpr_engine = ANPREngine()
