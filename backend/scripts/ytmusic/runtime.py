"""Process-wide runtime: HTTP session, thread pool, offload helpers."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import PY_WORKER_THREADS

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

import asyncio

from ytmusicapi import YTMusic

# Lazily created singletons. `ytm` is built once so every ytmusicapi call reuses
# the same keep-alive connection pool instead of paying for a fresh TLS
# handshake on each request.
ytm = None
_executor = None


def _build_shared_session():
    """A single keep-alive HTTP session for every InnerTube call.

    ytmusicapi creates a throwaway session per client by default, so every
    search paid for a fresh TCP + TLS handshake. Measured on this host, sharing
    one session brought a cold songs search from ~1.6-2.7s down to ~1.0-1.3s.

    ``requests.Session`` is safe for this workload: the calls are independent
    GET/POST requests without per-thread auth state, and the worker only
    parallelises plain searches.
    """
    import requests

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    # Pool more than the default 10 so concurrent searches never queue on a
    # connection that is being reused by another thread.
    adapter = requests.adapters.HTTPAdapter(pool_connections=8, pool_maxsize=32)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


ytm = YTMusic(requests_session=_build_shared_session())


def get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=PY_WORKER_THREADS, thread_name_prefix="ytw")
    return _executor

def run_sync(fn: Callable[[], Any]) -> Any:
    return fn()

async def to_thread(fn: Callable[[], Any]) -> Any:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(get_executor(), run_sync, fn)
