#!/usr/bin/env python3
"""
Booth UI Demo — cycles through all screen states with sample data.

Usage:
    pip install pygame pydantic pydantic-settings python-dotenv
    python demo_ui.py

Controls:
    RIGHT ARROW / SPACE  — next screen
    LEFT ARROW           — previous screen
    Q / ESC              — quit
    A                    — toggle auto-cycle (3s per screen)
"""
from __future__ import annotations

import os
import sys
import time

# Force debug mode so Pygame runs windowed, not fullscreen
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("LANE_ID", "LANE-01-DEMO")
os.environ.setdefault("LANE_MODE", "entry")
os.environ.setdefault("SCREEN_WIDTH", "1024")
os.environ.setdefault("SCREEN_HEIGHT", "600")

# Ensure edge directory is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pygame  # noqa: E402 — must import after env setup
from booth_ui import BoothUI, ScreenState  # noqa: E402

# Sample data for each screen state
DEMO_SCREENS: list[tuple[ScreenState, dict]] = [
    (ScreenState.IDLE, {}),
    (ScreenState.DETECTING, {}),
    (
        ScreenState.PLATE_CONFIRMED,
        {
            "plate_number": "B 1234 ABC",
            "vehicle_type": "car",
            "confidence": 0.92,
        },
    ),
    (ScreenState.PLATE_MANUAL, {}),
    (
        ScreenState.PAYMENT_SCREEN,
        {
            "amount": 5000,
            "nfc_available": True,
        },
    ),
    (
        ScreenState.NFC_ACTIVE,
        {
            "amount": 5000,
            "message": "Menunggu kartu...",
        },
    ),
    (
        ScreenState.INSUFFICIENT_BAL,
        {
            "balance": 2000,
            "amount": 5000,
        },
    ),
    (ScreenState.PAYMENT_CONFIRMED, {}),
    (
        ScreenState.ERROR,
        {
            "message": "Hubungi petugas",
        },
    ),
]


def main() -> None:
    ui = BoothUI()
    if not ui.initialize():
        print("ERROR: Could not initialize Pygame display.")
        print("Make sure pygame is installed: pip install pygame")
        sys.exit(1)

    clock = pygame.time.Clock()
    idx = 0
    auto_cycle = True
    last_switch = time.time()
    cycle_interval = 3.0  # seconds

    state, data = DEMO_SCREENS[idx]
    ui.set_state(state, data)

    print("=== Parkir Booth UI Demo ===")
    print(f"Showing {len(DEMO_SCREENS)} screens")
    print("RIGHT/SPACE = next | LEFT = prev | A = toggle auto | Q/ESC = quit")
    print(f"\nCurrent: {state.value}")

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_q, pygame.K_ESCAPE):
                    running = False
                elif event.key in (pygame.K_RIGHT, pygame.K_SPACE):
                    idx = (idx + 1) % len(DEMO_SCREENS)
                    state, data = DEMO_SCREENS[idx]
                    ui.set_state(state, data)
                    last_switch = time.time()
                    print(f"Screen: {state.value}")
                elif event.key == pygame.K_LEFT:
                    idx = (idx - 1) % len(DEMO_SCREENS)
                    state, data = DEMO_SCREENS[idx]
                    ui.set_state(state, data)
                    last_switch = time.time()
                    print(f"Screen: {state.value}")
                elif event.key == pygame.K_a:
                    auto_cycle = not auto_cycle
                    print(f"Auto-cycle: {'ON' if auto_cycle else 'OFF'}")
            elif event.type == pygame.MOUSEBUTTONDOWN:
                # Forward touch events to the UI
                ui._handle_touch(event.pos)

        # Auto-cycle
        if auto_cycle and time.time() - last_switch >= cycle_interval:
            idx = (idx + 1) % len(DEMO_SCREENS)
            state, data = DEMO_SCREENS[idx]
            ui.set_state(state, data)
            last_switch = time.time()
            print(f"Screen: {state.value}")

        # Render
        ui._render()
        clock.tick(30)

    pygame.quit()
    print("Demo ended.")


if __name__ == "__main__":
    main()
