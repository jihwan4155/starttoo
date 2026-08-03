from __future__ import annotations

import json
import threading
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class EventLog:
    def __init__(self, path: Path, capacity: int = 300) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._events: deque[dict[str, Any]] = deque(maxlen=capacity)
        self._lock = threading.Lock()
        self._load_existing()

    def _load_existing(self) -> None:
        if not self.path.is_file():
            return
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
            for line in lines[-self._events.maxlen :]:
                event = json.loads(line)
                if isinstance(event, dict):
                    self._events.append(event)
        except (OSError, json.JSONDecodeError):
            return

    def add(
        self,
        level: str,
        event: str,
        message: str,
        *,
        request_id: str | None = None,
        **details: Any,
    ) -> dict[str, Any]:
        item: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(
                timespec="milliseconds"
            ),
            "level": level,
            "event": event,
            "message": message,
        }
        if request_id:
            item["request_id"] = request_id
        if details:
            item["details"] = details

        encoded = json.dumps(item, ensure_ascii=False)
        with self._lock:
            self._events.append(item)
            with self.path.open("a", encoding="utf-8") as output:
                output.write(encoded + "\n")
        return item

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        resolved_limit = max(1, min(limit, self._events.maxlen or limit))
        with self._lock:
            return list(self._events)[-resolved_limit:]
