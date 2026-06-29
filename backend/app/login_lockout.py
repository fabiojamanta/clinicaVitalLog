from collections import defaultdict
from datetime import datetime, timedelta
from threading import Lock

from .datetime_utils import now_br

_lock = Lock()
_failures: dict[str, list[datetime]] = defaultdict(list)

MAX_FAILURES = 5
LOCKOUT_WINDOW = timedelta(minutes=15)


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _prune_attempts(email: str, now: datetime) -> list[datetime]:
    cutoff = now - LOCKOUT_WINDOW
    attempts = [t for t in _failures[email] if t >= cutoff]
    if attempts:
        _failures[email] = attempts
    elif email in _failures:
        del _failures[email]
    return attempts


def is_locked(email: str) -> bool:
    key = _normalize_email(email)
    if not key:
        return False
    with _lock:
        attempts = _prune_attempts(key, now_br())
        return len(attempts) >= MAX_FAILURES


def record_failure(email: str) -> None:
    key = _normalize_email(email)
    if not key:
        return
    with _lock:
        _prune_attempts(key, now_br())
        _failures[key].append(now_br())


def clear_failures(email: str) -> None:
    key = _normalize_email(email)
    with _lock:
        _failures.pop(key, None)
