import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import RateLimitError

_hits: dict[str, deque[float]] = defaultdict(deque)


def auth_rate_limit(request: Request) -> None:
    """Sliding-window limiter for auth endpoints (in-memory; use Redis behind several workers)."""
    s = get_settings()
    if not s.rate_limit_enabled:
        return
    key = f"{request.client.host if request.client else 'unknown'}:{request.url.path}"
    now = time.monotonic()
    window = _hits[key]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= s.auth_rate_limit_per_minute:
        raise RateLimitError("Trop de tentatives. Réessaie dans une minute.")
    window.append(now)
