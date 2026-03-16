import abc
import threading
from datetime import datetime
from typing import List, Optional

import structlog


class BaseAgent(abc.ABC):
    def __init__(self, name: str):
        self.name = name
        self.status = "idle"
        self._logs: List[str] = []
        self._thread: Optional[threading.Thread] = None
        self.logger = structlog.get_logger(agent=name)

    @abc.abstractmethod
    def run(self) -> None:
        pass

    def log(self, message: str, level: str = "info") -> None:
        entry = f"[{datetime.utcnow().isoformat()}] [{level.upper()}] {message}"
        self._logs.append(entry)
        if len(self._logs) > 500:
            self._logs = self._logs[-500:]
        getattr(self.logger, level, self.logger.info)(message)

    def get_logs(self) -> List[str]:
        return self._logs[-100:]

    def start(self) -> None:
        if self.status == "running":
            self.log("Already running", "warning")
            return
        self.status = "running"
        self.log(f"Agent {self.name} starting")
        self._thread = threading.Thread(target=self._safe_run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self.status = "idle"
        self.log(f"Agent {self.name} stopped")

    def _safe_run(self) -> None:
        try:
            self.run()
        except Exception as e:
            self.log(f"Error: {e}", "error")
            self.status = "error"
        finally:
            if self.status != "error":
                self.status = "idle"
