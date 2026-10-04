"""
Long-lived asyncio worker: JSON-RPC on stdin (one command per line), JSON lines on stdout.
Supports multiplexed in-flight requests (same id, multiple lines with seq until done:true).
Blocking ytmusicapi / yt_dlp work runs in ThreadPoolExecutor.
"""
from __future__ import annotations

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

# --- env ---
PY_WORKER_THREADS = max(1, int(os.getenv("PY_WORKER_THREADS", "16")))
RECO_BATCH_WORKERS = max(1, int(os.getenv("PY_RECO_BATCH_WORKERS", "4")))
RECO_429_RETRIES = max(0, int(os.getenv("PY_RECO_429_RETRIES", "2")))
# Total budget for the whole InnerTube client cascade before we fall back to yt-dlp.
INNERTUBE_TIMEOUT_SEC = float(os.getenv("PY_INNERTUBE_TIMEOUT_SEC", "1.6"))
# A single dropped connection must not fail a search: InnerTube answers in well
# under a second normally, so a short retry with backoff costs nothing in the
# happy path and removes the flakiness YouTube's CDN causes on burst traffic.
SEARCH_RETRIES = max(0, int(os.getenv("PY_SEARCH_RETRIES", "2")))
SEARCH_RETRY_BACKOFF_SEC = float(os.getenv("PY_SEARCH_RETRY_BACKOFF_SEC", "0.4"))

# --- yt-dlp cookie configuration ---
_YTDLP_COOKIES_BROWSER = os.getenv("YTDLP_COOKIES_BROWSER", "").strip() or None
_YTDLP_COOKIES_FILE = os.getenv("YTDLP_COOKIES_FILE", "").strip() or None
_YTDLP_BROWSER_CONFIG_PATH = os.getenv("YTDLP_BROWSER_CONFIG_PATH", "").strip() or None


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


# --- search constants (mirror ytdlp.service.ts) ---
MAX_TRACKS_OUT = 36
MAX_ALBUMS_OUT = 25
MAX_ARTISTS_OUT = 25
# Smaller main search for faster first paint; we still return up to MAX_TRACKS_OUT
# but ytsearchN bounds how much yt-dlp needs to resolve.
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
_executor: Optional[ThreadPoolExecutor] = None
_write_lock: Optional[asyncio.Lock] = None


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


# --- ytmusic helpers (sync, called from executor) ---


def safe_search(q: str, filter_value: str, limit_value: Optional[int]):
    """InnerTube search with a short retry.

    YouTube drops connections under bursty load and returns HTTP 400/429 for a
    moment before serving again. Those are transient, so retrying a couple of
    times with backoff turns a failed search into a slower one instead of a
    fallback to the much slower yt-dlp scrape.
    """
    last_err: Optional[Exception] = None
    for attempt in range(SEARCH_RETRIES + 1):
        try:
            try:
                return ytm.search(q, filter=filter_value, limit=limit_value)
            except TypeError:
                # Older ytmusicapi builds reject limit=None on some filters.
                if limit_value is None:
                    return ytm.search(q, filter=filter_value, limit=200)
                raise
        except Exception as err:  # network hiccup, 400/429, transient CDN error
            last_err = err
            if attempt >= SEARCH_RETRIES:
                break
            time.sleep(SEARCH_RETRY_BACKOFF_SEC * (2**attempt))
    assert last_err is not None
    raise last_err


def extract_year(item: dict) -> str:
    y = item.get("year", "")
    if y:
        return str(y)
    t = item.get("type", "")
    if isinstance(t, str) and len(t) == 4 and t.isdigit():
        return t
    return ""


def fetch_all_artist_albums(browse_id: str, params: str):
    try:
        return ytm.get_artist_albums(browse_id, params, limit=None)
    except TypeError:
        try:
            return ytm.get_artist_albums(browse_id, params)
        except Exception:
            return None
    except Exception:
        return None


def do_search_albums(query: str) -> List[dict]:
    results = safe_search(query, "albums", 20)
    out = []
    for r in results or []:
        out.append(
            {
                "browseId": r.get("browseId", ""),
                "title": r.get("title", ""),
                "artist": r["artists"][0]["name"] if r.get("artists") else "",
                "thumbnailUrl": r["thumbnails"][-1]["url"] if r.get("thumbnails") else "",
                "year": r.get("year", ""),
            }
        )
    return out


def do_search_artists(query: str) -> List[dict]:
    q0 = (query or "").strip()
    results0 = safe_search(q0, "artists", 40)

    merged = []
    seen = set()

    def add_results(items):
        for it in items or []:
            bid = it.get("browseId", "") or ""
            if not bid or bid in seen:
                continue
            seen.add(bid)
            merged.append(it)

    add_results(results0)

    qlow = q0.lower()
    exact = []
    rest = []
    for r in merged:
        name = (r.get("artist", "") or "").strip()
        if name.lower() == qlow and qlow:
            exact.append(r)
        else:
            rest.append(r)
    results = exact + rest

    out = []
    for r in results[:40]:
        out.append(
            {
                "browseId": r.get("browseId", ""),
                "name": r.get("artist", ""),
                "thumbnailUrl": r["thumbnails"][-1]["url"] if r.get("thumbnails") else "",
                "subscribers": r.get("subscribers", ""),
            }
        )
    return out


def do_get_album(browse_id: str) -> dict:
    result = ytm.get_album(browse_id)
    tracks = []
    for t in result.get("tracks", []):
        vid = t.get("videoId", "")
        tracks.append(
            {
                "trackId": vid,
                "title": t.get("title", ""),
                "artist": t["artists"][0]["name"] if t.get("artists") else result.get("artist", ""),
                "thumbnailUrl": result["thumbnails"][-1]["url"] if result.get("thumbnails") else "",
                "duration": t.get("duration_seconds", 0),
            }
        )
    return {
        "title": result.get("title", ""),
        "artist": result["artists"][0]["name"] if result.get("artists") else "",
        "year": result.get("year", ""),
        "thumbnailUrl": result["thumbnails"][-1]["url"] if result.get("thumbnails") else "",
        "tracks": tracks,
    }


def do_get_artist(browse_id: str) -> dict:
    result = ytm.get_artist(browse_id)
    albums = []
    albums_block = result.get("albums") or {}
    album_list = []
    if isinstance(albums_block, dict):
        params = albums_block.get("params")
        bid = albums_block.get("browseId") or browse_id
        if isinstance(params, str) and params.strip():
            album_list = fetch_all_artist_albums(bid, params) or albums_block.get("results", [])
        else:
            album_list = albums_block.get("results", [])
    for a in album_list or []:
        albums.append(
            {
                "browseId": a.get("browseId", ""),
                "title": a.get("title", ""),
                "year": extract_year(a),
                "thumbnailUrl": a["thumbnails"][-1]["url"] if a.get("thumbnails") else "",
            }
        )
    related_artists = []
    rel = result.get("related") or {}
    rel_results = rel.get("results") if isinstance(rel, dict) else None
    if isinstance(rel_results, list):
        for it in rel_results:
            if not isinstance(it, dict):
                continue
            bid = (it.get("browseId") or "").strip()
            name = (it.get("title") or it.get("name") or "").strip()
            if not bid or not name:
                continue
            thumbs = it.get("thumbnails") or []
            thumb = ""
            if isinstance(thumbs, list) and len(thumbs) > 0 and isinstance(thumbs[-1], dict):
                thumb = thumbs[-1].get("url") or ""
            related_artists.append(
                {
                    "browseId": bid,
                    "name": name,
                    "thumbnailUrl": thumb,
                    "subscribers": it.get("subscribers", "") or "",
                }
            )
    return {
        "name": result.get("name", ""),
        "thumbnailUrl": result["thumbnails"][-1]["url"] if result.get("thumbnails") else "",
        "subscribers": result.get("subscribers", ""),
        "albums": albums,
        "relatedArtists": related_artists,
    }


def do_get_watch_playlist_radio(video_id: str, limit_value: int) -> dict:
    if not video_id:
        return {"tracks": []}
    limit_n = int(limit_value or 50)
    limit_n = max(1, min(limit_n, 200))
    try:
        result = ytm.get_watch_playlist(video_id, radio=True, limit=limit_n)
    except TypeError:
        result = ytm.get_watch_playlist(video_id, radio=True)
    tracks_out = []
    for t in result.get("tracks", []) or []:
        if not isinstance(t, dict):
            continue
        vid = (t.get("videoId") or "").strip()
        if not vid:
            continue
        artists = t.get("artists") or []
        artist_name = ""
        if isinstance(artists, list) and len(artists) > 0 and isinstance(artists[0], dict):
            artist_name = artists[0].get("name") or ""
        thumbs = t.get("thumbnails") or []
        thumb = ""
        if isinstance(thumbs, list) and len(thumbs) > 0 and isinstance(thumbs[-1], dict):
            thumb = thumbs[-1].get("url") or ""
        if not thumb and re.fullmatch(r"[a-zA-Z0-9_-]{11}", vid):
            thumb = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
        tracks_out.append(
            {
                "trackId": vid,
                "title": t.get("title") or "",
                "artist": artist_name,
                "thumbnailUrl": thumb,
                "duration": t.get("lengthSeconds") or t.get("duration_seconds") or 0,
            }
        )
    return {"tracks": tracks_out}


def do_get_song(video_id: str) -> dict:
    vid = (video_id or "").strip()
    if not vid:
        return {"trackId": "", "thumbnailUrl": "", "duration": 0}
    try:
        result = ytm.get_song(vid) or {}
    except Exception:
        return {"trackId": vid, "thumbnailUrl": "", "duration": 0}
    video_details = result.get("videoDetails") if isinstance(result, dict) else {}
    if not isinstance(video_details, dict):
        video_details = {}
    micro = result.get("microformat") if isinstance(result, dict) else {}
    if not isinstance(micro, dict):
        micro = {}
    thumb = ""
    thumb_obj = micro.get("microformatDataRenderer") if isinstance(micro, dict) else {}
    if isinstance(thumb_obj, dict):
        thumbs = thumb_obj.get("thumbnail") or {}
        if isinstance(thumbs, dict):
            thumb_arr = thumbs.get("thumbnails") or []
            if isinstance(thumb_arr, list):
                for it in reversed(thumb_arr):
                    if isinstance(it, dict) and isinstance(it.get("url"), str) and it.get("url"):
                        thumb = it.get("url")
                        break
    if not thumb:
        thumbs = video_details.get("thumbnail") or {}
        if isinstance(thumbs, dict):
            thumb_arr = thumbs.get("thumbnails") or []
            if isinstance(thumb_arr, list):
                for it in reversed(thumb_arr):
                    if isinstance(it, dict) and isinstance(it.get("url"), str) and it.get("url"):
                        thumb = it.get("url")
                        break
    length = video_details.get("lengthSeconds")
    duration = 0
    try:
        duration = int(length or 0)
    except Exception:
        duration = 0
    return {"trackId": vid, "thumbnailUrl": thumb or "", "duration": max(0, duration)}


# --- yt-dlp flat (sync) ---


def _ytdlp_flat_entries(url: str, playlist_end: int) -> List[dict]:
    opts = {**YTDLP_FLAT_OPTS_BASE, "playlistend": playlist_end}
    rows: List[dict] = []
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if info is None:
            return rows
        entries = info.get("entries")
        if entries is None:
            if info.get("id"):
                rows.append(ydl.sanitize_info(info, private=True))
        else:
            for e in entries:
                if e:
                    rows.append(ydl.sanitize_info(e, private=True))
    return rows


# --- search bundle ranking (ported from ytdlp.service.ts) ---



def is_youtube_video_id(id_val: str) -> bool:
    return bool(re.fullmatch(r"[a-zA-Z0-9_-]{11}", id_val or ""))




def pick_thumbnail(entry: dict) -> str:
    t = entry.get("thumbnail")
    if isinstance(t, str) and t:
        return t
    thumbs = entry.get("thumbnails")
    if isinstance(thumbs, list) and thumbs:
        first = thumbs[0]
        if isinstance(first, dict) and isinstance(first.get("url"), str):
            return first["url"]
    return ""



def pick_artist(entry: dict) -> str:
    for k in ("artist", "uploader", "channel"):
        v = entry.get(k)
        if isinstance(v, str) and v:
            return v
    return ""


def parse_duration(value: Any) -> int:
    if isinstance(value, (int, float)) and value > 0:
        n = float(value)
        if n > 24 * 60 * 60:
            n /= 1000
        return max(0, int(n))
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return 0
        if re.fullmatch(r"\d+(\.\d+)?", raw):
            n = float(raw)
            if n > 24 * 60 * 60:
                n /= 1000
            return max(0, int(n))
        parts = [float(p.strip()) for p in raw.split(":")]
        if any(not (p >= 0) for p in parts):
            return 0
        if len(parts) == 2:
            return int(parts[0] * 60 + parts[1])
        if len(parts) == 3:
            return int(parts[0] * 3600 + parts[1] * 60 + parts[2])
    return 0


def pick_channel_id(entry: dict) -> str:
    c = entry.get("channel_id")
    return c if isinstance(c, str) and c else ""


def pick_view_count(entry: dict) -> int:
    v = entry.get("view_count")
    if isinstance(v, (int, float)) and v == v:
        return int(v)
    return 0



def shuffle_in_place(arr: List) -> None:
    for i in range(len(arr) - 1, 0, -1):
        j = random.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]


def map_flat_entry(entry: dict) -> Optional[dict]:
    id_val = entry.get("id")
    if not isinstance(id_val, str) or not id_val or not is_youtube_video_id(id_val):
        return None
    title = entry.get("title") if isinstance(entry.get("title"), str) else ""
    ch = pick_channel_id(entry)
    row = {
        "trackId": id_val,
        "title": title,
        "artist": pick_artist(entry),
        "thumbnailUrl": pick_thumbnail(entry),
        "duration": parse_duration(entry.get("duration")),
    }
    if ch:
        row["channelId"] = ch
    return row


def rank_track_entries(entries: List[dict], max_out: int) -> List[dict]:
    with_rows = []
    for entry in entries:
        row = map_flat_entry(entry)
        if row:
            with_rows.append({"entry": entry, "row": row})
    if not with_rows:
        return []
    any_views = any(pick_view_count(x["entry"]) > 0 for x in with_rows)
    if any_views:
        sorted_wr = sorted(with_rows, key=lambda x: pick_view_count(x["entry"]), reverse=True)
        head = sorted_wr[:POPULAR_TRACK_HEAD]
        head_ids = {h["row"]["trackId"] for h in head}
        tail = [x for x in sorted_wr[POPULAR_TRACK_HEAD:] if x["row"]["trackId"] not in head_ids]
        shuffle_in_place(tail)
        merged = head + tail
    else:
        head = with_rows[:POPULAR_TRACK_HEAD]
        tail = with_rows[POPULAR_TRACK_HEAD:]
        shuffle_in_place(tail)
        merged = head + tail
    return [x["row"] for x in merged[:max_out]]








def build_search_bundle(q: str) -> dict:
    """Tracks for the JSON search endpoint.

    The client renders tracks from this bundle but loads albums and artists
    through their own endpoints, so this path asks InnerTube for tracks only.
    Resolving artists here would spend a network round-trip on a result the
    caller discards.
    """
    return {"tracks": build_tracks_only(q), "albums": [], "artists": []}


def innertube_tracks(q: str) -> List[dict]:
    """Tracks from the InnerTube song search (fast path, no yt-dlp process)."""
    out: List[dict] = []
    seen = set()
    for row in do_search_songs(q):
        vid = row.get("trackId")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        out.append(row)
        if len(out) >= MAX_TRACKS_OUT:
            break
    return out





def build_tracks_only(q: str) -> List[dict]:
    """Track rows for a query, preferring the InnerTube song search.

    Falls back to yt-dlp's flat playlist when InnerTube returns nothing, which
    happens once YouTube rate-limits us.
    """
    q = (q or "").strip()
    if not q:
        return []

    # One JSON round-trip instead of a yt-dlp process that has to scrape and
    # parse a YouTube results page.
    try:
        fast_tracks = innertube_tracks(q)
    except Exception:
        fast_tracks = []
    if fast_tracks:
        return fast_tracks

    main_url = f"ytsearch{YT_SEARCH_MAIN}:{q}"
    main_entries = _ytdlp_flat_entries(main_url, PLAYLIST_END)
    return rank_track_entries(main_entries, MAX_TRACKS_OUT)




def do_reco_radio_batch(video_ids: List[str], limit_per: int) -> dict:
    limit_per = max(1, min(int(limit_per or 60), 200))
    out = []

    def one(vid: str) -> dict:
        for attempt in range(RECO_429_RETRIES + 1):
            try:
                return {"videoId": vid, **do_get_watch_playlist_radio(vid, limit_per)}
            except Exception as e:
                msg = str(e)
                if ("429" not in msg and "Too Many Requests" not in msg) or attempt >= RECO_429_RETRIES:
                    return {"videoId": vid, "tracks": [], "error": msg}
                delay = min(0.4 * (2**attempt), 2.0) + random.random() * 0.2
                import time

                time.sleep(delay)
        return {"videoId": vid, "tracks": [], "error": "429 retries exhausted"}

    from concurrent.futures import ThreadPoolExecutor as TPE

    ids = [v.strip() for v in (video_ids or []) if isinstance(v, str) and v.strip()]
    if not ids:
        return {"results": []}
    with TPE(max_workers=min(len(ids), RECO_BATCH_WORKERS)) as ex:
        futs = [ex.submit(one, vid) for vid in ids]
        for f in futs:
            out.append(f.result())
    return {"results": out}


def do_reco_albums_batch(queries: List[str]) -> dict:
    qs = [str(q).strip() for q in (queries or []) if str(q).strip()]
    if not qs:
        return {"results": []}
    out = []

    def one(q: str) -> dict:
        for attempt in range(RECO_429_RETRIES + 1):
            try:
                return {"query": q, "albums": do_search_albums(q)}
            except Exception as e:
                msg = str(e)
                if ("429" not in msg and "Too Many Requests" not in msg) or attempt >= RECO_429_RETRIES:
                    return {"query": q, "albums": [], "error": msg}
                delay = min(0.4 * (2**attempt), 2.0) + random.random() * 0.2
                import time

                time.sleep(delay)
        return {"query": q, "albums": [], "error": "429 retries exhausted"}

    from concurrent.futures import ThreadPoolExecutor as TPE

    with TPE(max_workers=min(len(qs), RECO_BATCH_WORKERS)) as ex:
        futs = [ex.submit(one, q) for q in qs]
        for f in futs:
            out.append(f.result())
    return {"results": out}


def do_search_songs(query: str) -> List[dict]:
    results = safe_search(query, "songs", MAX_TRACKS_OUT)
    out = []
    seen = set()
    for r in results or []:
        vid = r.get("videoId", "")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        dur = r.get("duration_seconds") or 0
        # Tracks with an unknown duration are kept: the client hides the length
        # when it is 0, but the track itself is still playable and relevant.
        out.append({
            "trackId": vid,
            "title": r.get("title", ""),
            "artist": r["artists"][0]["name"] if r.get("artists") else "",
            "thumbnailUrl": r["thumbnails"][-1]["url"] if r.get("thumbnails") else "",
            "duration": dur if isinstance(dur, (int, float)) and dur > 0 else 0,
        })
    return out


def do_get_player_stream(video_id: str) -> dict:
    """Resolve a googlevideo URL via the InnerTube player endpoint.

    This is the same JSON API the official YouTube Music web player uses, so it
    returns the signed stream URL directly instead of making yt-dlp scrape and
    parse a watch page (which costs several seconds per request).
    Tries the ANDROID client first, then IOS, then WEB.
    """
    vid = (video_id or "").strip()
    if not vid:
        return {"ok": False, "error": "videoId is required"}

    clients = [
        ("ANDROID", "20.10.38", "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip"),
        ("IOS", "20.10.4", "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3 like Mac OS X)"),
        ("WEB", "2.20250101.00.00", None),
    ]
    last_error = "no client produced a playable stream"
    deadline = time.monotonic() + INNERTUBE_TIMEOUT_SEC

    for client_name, client_version, user_agent in clients:
        # The per-request socket timeout does not cover the TLS handshake, so a
        # stalled handshake would otherwise block for the OS default (30s) and
        # blow the whole budget. Bail out once the cascade deadline is spent.
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return {"ok": False, "error": "innertube deadline exceeded"}

        body: Dict[str, Any] = {
            "context": {"client": {"clientName": client_name, "clientVersion": client_version}},
            "videoId": vid,
            "contentCheckOk": True,
            "racyCheckOk": True,
        }
        if client_name == "ANDROID":
            body["context"]["client"]["androidSdkVersion"] = 34
            body["context"]["client"]["userAgent"] = user_agent
            body["context"]["client"]["osName"] = "Android"
            body["context"]["client"]["osVersion"] = "14"
        elif client_name == "IOS":
            body["context"]["client"]["deviceModel"] = "iPhone16,2"
            body["context"]["client"]["userAgent"] = user_agent
            body["context"]["client"]["osName"] = "iOS"
            body["context"]["client"]["osVersion"] = "18.3.1.22D72"

        headers = {"Content-Type": "application/json", "Accept": "*/*"}
        if user_agent:
            headers["User-Agent"] = user_agent
        if client_name == "WEB":
            headers["Origin"] = "https://music.youtube.com"
            headers["Referer"] = "https://music.youtube.com/"
            headers["X-Youtube-Client-Name"] = "67"
            headers["X-Youtube-Client-Version"] = client_version
            headers["X-Goog-Visitor-Id"] = _visitor_id()

        try:
            payload = _post_json_with_deadline(
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                body,
                headers,
                remaining,
            )
        except Exception as e:  # network / HTTP issues: try the next client
            last_error = f"{client_name}: {e}"
            continue

        playability = payload.get("playabilityStatus") or {}
        status = str(playability.get("status") or "")
        if status and status != "OK":
            last_error = f"{client_name}: playabilityStatus={status}"
            continue

        url = _pick_audio_url(payload)
        if not url:
            last_error = f"{client_name}: no audio format in streamingData"
            continue
        # Note: the URL is deliberately not probed here. Signed googlevideo URLs
        # are single-use, so a validation request would consume the one URL the
        # player needs. A rejected URL is detected at stream time instead, where
        # the caller already retries with a freshly resolved URL.

        details = payload.get("videoDetails") or {}
        return {
            "ok": True,
            "url": url,
            "client": client_name,
            "title": details.get("title") or "",
            "author": details.get("author") or "",
            "lengthSeconds": int(details.get("lengthSeconds") or 0),
        }

    return {"ok": False, "error": last_error}


def _visitor_id() -> str:
    return base64.urlsafe_b64encode(os.urandom(16)).decode("ascii").rstrip("=")


def _post_json_with_deadline(
    url: str, body: dict, headers: Dict[str, str], budget: float
) -> dict:
    """POST JSON and return the parsed response, bounded by a wall-clock budget.

    ``urllib.request.urlopen(timeout=...)`` only bounds socket reads: the socket
    timeout is applied after the TLS handshake has already begun, so a stalled
    handshake blocks for the OS default (30s on Linux) and ignores the budget
    entirely. Running the request in a worker thread lets us stop waiting on it
    once the budget is spent; the abandoned daemon thread cannot keep the
    process alive.
    """
    import urllib.request

    result: Dict[str, Any] = {}

    def run() -> None:
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=budget) as resp:
                result["payload"] = json.loads(resp.read().decode("utf-8", "replace"))
        except Exception as exc:  # surfaced to the caller below
            result["error"] = exc

    worker = threading.Thread(target=run, name="innertube", daemon=True)
    worker.start()
    worker.join(budget)

    if worker.is_alive():
        raise TimeoutError(f"innertube request exceeded {budget:.1f}s")
    if "error" in result:
        raise result["error"]
    return result["payload"]


def _pick_audio_url(payload: dict) -> str:
    """Pick the best audio-only URL: prefer opus/mp4-m4a over m4a-only low quality."""
    streaming = payload.get("streamingData") or {}
    formats = list(streaming.get("adaptiveFormats") or []) + list(streaming.get("formats") or [])
    best_url = ""
    best_score = -1
    for fmt in formats:
        mime = str(fmt.get("mimeType") or "")
        if "audio" not in mime:
            continue
        url = str(fmt.get("url") or "")
        if not url:
            continue
        # 2 = opus/mp4 (best), 1 = m4a (ac-3/aac), 0 = medium quality only
        score = 2 if "audio/mp4" in mime else 1
        if fmt.get("audioQuality") == "AUDIO_QUALITY_MEDIUM":
            score = 0
        if score > best_score:
            best_url = url
            best_score = score
    return best_url


def handle_command_sync(cmd: dict) -> dict:
    req_id = cmd.get("id", "")
    action = cmd.get("action", "")
    args = cmd.get("args") or {}

    try:
        if action == "ping":
            return {"id": req_id, "ok": True, "data": "pong"}
        if action == "search_albums":
            q = (args.get("query") or "").strip()
            return {"id": req_id, "ok": True, "data": do_search_albums(q)}
        if action == "search_artists":
            q = (args.get("query") or "").strip()
            return {"id": req_id, "ok": True, "data": do_search_artists(q)}
        if action == "get_album":
            bid = (args.get("browseId") or "").strip()
            return {"id": req_id, "ok": True, "data": do_get_album(bid)}
        if action == "get_artist":
            bid = (args.get("browseId") or "").strip()
            return {"id": req_id, "ok": True, "data": do_get_artist(bid)}
        if action == "get_watch_playlist_radio":
            vid = (args.get("videoId") or "").strip()
            lim = int(args.get("limit") or 50)
            return {"id": req_id, "ok": True, "data": do_get_watch_playlist_radio(vid, lim)}
        if action == "get_song":
            vid = (args.get("videoId") or "").strip()
            return {"id": req_id, "ok": True, "data": do_get_song(vid)}
        if action == "reco_radio_batch":
            vids = args.get("videoIds") or []
            lim = int(args.get("limit") or 60)
            return {"id": req_id, "ok": True, "data": do_reco_radio_batch(list(vids), lim)}
        if action == "reco_albums_batch":
            qs = args.get("queries") or []
            return {"id": req_id, "ok": True, "data": do_reco_albums_batch(list(qs))}
        if action == "search_bundle":
            q = (args.get("query") or "").strip()
            return {"id": req_id, "ok": True, "data": build_search_bundle(q)}
        if action == "search_songs":
            q = (args.get("query") or "").strip()
            return {"id": req_id, "ok": True, "data": do_search_songs(q)}
        if action == "get_player_stream":
            vid = (args.get("videoId") or "").strip()
            return {"id": req_id, "ok": True, "data": do_get_player_stream(vid)}
        return {"id": req_id, "ok": False, "error": f"unknown action: {action}"}
    except Exception as e:
        return {"id": req_id, "ok": False, "error": str(e) or repr(e), "trace": traceback.format_exc()[-2000:]}


async def process_line(line: str, write_line: Callable[[dict], Any]) -> None:
    line = line.strip()
    if not line:
        return
    try:
        cmd = json.loads(line)
    except json.JSONDecodeError as e:
        await write_line({"id": "", "ok": False, "error": f"invalid json: {e}"})
        return

    req_id = cmd.get("id", "")
    action = cmd.get("action", "")


    def sync_wrap():
        return handle_command_sync(cmd)

    out = await to_thread(sync_wrap)
    await write_line(out)


async def amain() -> None:
    global _write_lock
    _write_lock = asyncio.Lock()
    loop = asyncio.get_running_loop()
    cmd_sem = asyncio.Semaphore(max(8, PY_WORKER_THREADS * 2))

    async def write_line(d: dict) -> None:
        assert _write_lock is not None
        async with _write_lock:
            sys.stdout.write(json.dumps(d, ensure_ascii=False) + "\n")
            sys.stdout.flush()

    async def guarded_process(line: str) -> None:
        async with cmd_sem:
            await process_line(line, write_line)

    sys.stderr.write("ytmusic_worker: ready (asyncio)\n")
    sys.stderr.flush()

    # Blocking stdin.readline in default executor; each command runs concurrently (bounded).
    while True:
        line_b = await loop.run_in_executor(None, sys.stdin.readline)
        if not line_b:
            break
        # sys.stdin.readline() returns str in text mode; keep a bytes fallback just in case.
        if isinstance(line_b, bytes):
            line = line_b.decode("utf-8", errors="replace")
        else:
            line = str(line_b)
        asyncio.create_task(guarded_process(line))


def main() -> None:
    try:
        asyncio.run(amain())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
