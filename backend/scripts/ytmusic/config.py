"""Environment-driven configuration and shared constants."""

import asyncio
import base64
import json
import os
import random
import re
import sys
import threading
import time
import traceback
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

from ytmusicapi import YTMusic
from yt_dlp import YoutubeDL


def _ytdlp_cookie_opts() -> dict:
    opts: Dict[str, Any] = {}
    if _YTDLP_COOKIES_BROWSER:
        config_path = _YTDLP_BROWSER_CONFIG_PATH
        if config_path:
            opts["cookiesfrombrowser"] = (_YTDLP_COOKIES_BROWSER, config_path)
        else:
            opts["cookiesfrombrowser"] = (_YTDLP_COOKIES_BROWSER,)
    elif _YTDLP_COOKIES_FILE:
        opts["cookiefile"] = _YTDLP_COOKIES_FILE
    return opts

PY_WORKER_THREADS = max(1, int(os.getenv("PY_WORKER_THREADS", "16")))

RECO_BATCH_WORKERS = max(1, int(os.getenv("PY_RECO_BATCH_WORKERS", "4")))

RECO_429_RETRIES = max(0, int(os.getenv("PY_RECO_429_RETRIES", "2")))

INNERTUBE_TIMEOUT_SEC = float(os.getenv("PY_INNERTUBE_TIMEOUT_SEC", "1.6"))

SEARCH_RETRIES = max(0, int(os.getenv("PY_SEARCH_RETRIES", "2")))

SEARCH_RETRY_BACKOFF_SEC = float(os.getenv("PY_SEARCH_RETRY_BACKOFF_SEC", "0.4"))

_YTDLP_COOKIES_BROWSER = os.getenv("YTDLP_COOKIES_BROWSER", "").strip() or None

_YTDLP_COOKIES_FILE = os.getenv("YTDLP_COOKIES_FILE", "").strip() or None

_YTDLP_BROWSER_CONFIG_PATH = os.getenv("YTDLP_BROWSER_CONFIG_PATH", "").strip() or None

MAX_TRACKS_OUT = 36

MAX_ALBUMS_OUT = 25

MAX_ARTISTS_OUT = 25

YT_SEARCH_MAIN = 20

POPULAR_TRACK_HEAD = 18

PLAYLIST_END = 25

YTDLP_FLAT_OPTS_BASE = {
    "quiet": True,
    "noprogress": True,
    "no_warnings": True,
    "skip_download": True,
    "extract_flat": True,
    "socket_timeout": 6,
    "retries": 1,
    **_ytdlp_cookie_opts(),
}

STOP_WORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "and",
        "or",
        "feat",
        "ft",
        "и",
        "в",
        "на",
        "из",
        "для",
    }
)

FULL_ALBUM_TITLE_RE = re.compile(r"\s*[\[(]?full\s+album[)\]]?\s*", re.I)

# `_executor` and `_write_lock` are lazily populated by the runtime module,
# which owns the thread pool and the asyncio loop.
