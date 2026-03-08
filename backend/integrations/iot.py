"""
IoT simulator — RFID readers, weight sensors, conveyor health.
Runs a background thread that ticks every 3 seconds generating sensor events.
"""
import threading
import random
import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional

# Conveyor belt IDs (matches routing rules)
BELTS = ["A1", "A2", "B1", "B2", "C1"]

# RFID reader locations per belt
RFID_POINTS = {
    "A1": ["A1-CHECKIN", "A1-SORT",  "A1-LOAD"],
    "A2": ["A2-CHECKIN", "A2-SORT",  "A2-LOAD"],
    "B1": ["B1-CHECKIN", "B1-SORT",  "B1-LOAD"],
    "B2": ["B2-CHECKIN", "B2-SORT",  "B2-LOAD"],
    "C1": ["C1-CHECKIN", "C1-SORT",  "C1-LOAD"],
}

class IoTSimulator:
    def __init__(self):
        self._rng = random.Random()
        self._lock = threading.Lock()
        self._rfid_events: deque = deque(maxlen=30)  # rolling last 30 scans
        # belt_id -> { speed_mps, load_pct, temp_c, status, jam }
        self._conveyors: dict = {b: self._fresh_telemetry(b) for b in BELTS}
        self._thread: threading.Thread | None = None
        self._running = False
        self._blackout_until: Optional[float] = None  # unix timestamp

    def _fresh_telemetry(self, belt_id: str) -> dict:
        return {
            "belt_id": belt_id,
            "speed_mps": round(self._rng.uniform(0.8, 1.4), 2),
            "load_pct": round(self._rng.uniform(20, 75), 1),
            "temp_c": round(self._rng.uniform(18, 28), 1),
            "status": "OK",
            "jam": False,
            "last_seen": datetime.now(timezone.utc).isoformat(),
        }

    def _tick(self):
        with self._lock:
            # Update conveyor telemetry
            for belt_id, data in self._conveyors.items():
                if data["jam"]:
                    continue  # jammed — values stay frozen
                data["speed_mps"] = round(max(0.3, data["speed_mps"] + self._rng.uniform(-0.05, 0.05)), 2)
                data["load_pct"]  = round(min(100, max(0, data["load_pct"] + self._rng.uniform(-5, 5))), 1)
                data["temp_c"]    = round(data["temp_c"] + self._rng.uniform(-0.3, 0.3), 1)
                # random fault signal (0.5% chance)
                if self._rng.random() < 0.005:
                    data["status"] = "FAULT"
                elif data["status"] == "FAULT" and self._rng.random() < 0.3:
                    data["status"] = "OK"
                data["last_seen"] = datetime.now(timezone.utc).isoformat()

            # Generate 1-3 RFID scan events (suppressed during blackout)
            if self._blackout_until and time.time() < self._blackout_until:
                return
            for _ in range(self._rng.randint(1, 3)):
                belt = self._rng.choice(BELTS)
                reader = self._rng.choice(RFID_POINTS[belt])
                bag_tag = f"TAG{self._rng.randint(10000, 99999)}"
                weight_kg = round(self._rng.uniform(5, 30), 1)
                overweight = weight_kg > 23
                self._rfid_events.appendleft({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "reader_id": reader,
                    "belt_id": belt,
                    "bag_tag": bag_tag,
                    "weight_kg": weight_kg,
                    "overweight": overweight,
                    "read_strength": self._rng.randint(70, 100),
                })

    def _loop(self):
        while self._running:
            self._tick()
            time.sleep(3)

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="iot-sim")
        self._thread.start()

    def stop(self):
        self._running = False

    # ---- public accessors ----

    def get_rfid_events(self, limit: int = 15) -> list[dict]:
        with self._lock:
            return list(self._rfid_events)[:limit]

    def get_conveyor_health(self) -> list[dict]:
        with self._lock:
            return list(self._conveyors.values())

    def inject_jam(self, belt_id: str) -> bool:
        with self._lock:
            if belt_id not in self._conveyors:
                return False
            self._conveyors[belt_id]["jam"]    = True
            self._conveyors[belt_id]["status"] = "JAM"
            self._conveyors[belt_id]["speed_mps"] = 0.0
            self._conveyors[belt_id]["last_seen"] = datetime.now(timezone.utc).isoformat()
            return True

    def clear_jam(self, belt_id: str) -> bool:
        with self._lock:
            if belt_id not in self._conveyors:
                return False
            self._conveyors[belt_id] = self._fresh_telemetry(belt_id)
            return True

    def start_blackout(self, duration_sec: int = 30) -> float:
        """Suppress RFID events for duration_sec seconds. Returns end timestamp."""
        with self._lock:
            self._blackout_until = time.time() + duration_sec
            return self._blackout_until

    def is_blackout(self) -> bool:
        return self._blackout_until is not None and time.time() < self._blackout_until


# Singleton used by the FastAPI router
iot_sim = IoTSimulator()
