"""
Long-lived asyncio worker: JSON-RPC on stdin (one command per line), JSON lines on stdout.
Supports multiplexed in-flight requests (same id, multiple lines with seq until done:true).
Blocking ytmusicapi / yt_dlp work runs in ThreadPoolExecutor.
"""
from __future__ import annotations

import asyncio
import json
import os
import random
import re
import sys
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

# --- search constants (mirror ytdlp.service.ts) ---
MAX_TRACKS_OUT = 40
MAX_ALBUMS_OUT = 25
MAX_ARTISTS_OUT = 25
# Smaller main search for faster first paint; we still return up to MAX_TRACKS_OUT
# but ytsearchN bounds how much yt-dlp needs to resolve.
YT_SEARCH_MAIN = 20
POPULAR_TRACK_HEAD = 18
STREAM_FIRST_TRACKS = 15
PLAYLIST_END = 25

YTDLP_FLAT_OPTS_BASE = {
    "quiet": True,
    "noprogress": True,
    "no_warnings": True,
    "skip_download": True,
    "extract_flat": True,
    "socket_timeout": 6,
    "retries": 1,
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

ytm = YTMusic()
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
    try:
        return ytm.search(q, filter=filter_value, limit=limit_value)
    except TypeError:
        if limit_value is None:
            return ytm.search(q, filter=filter_value, limit=200)
        raise


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


def do_ytdlp_flat(url: str, playlist_end: int) -> str:
    pe = max(1, min(int(playlist_end or 25), 200))
    lines = []
    for row in _ytdlp_flat_entries(url, pe):
        lines.append(json.dumps(row, ensure_ascii=False))
    return "\n".join(lines)


def do_ytdlp_flat_rows(url: str, playlist_end: int) -> dict:
    pe = max(1, min(int(playlist_end or 25), 200))
    return {"rows": _ytdlp_flat_entries(url, pe)}


# --- search bundle ranking (ported from ytdlp.service.ts) ---


def norm_text(s: str) -> str:
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def significant_tokens(q: str) -> List[str]:
    return [t for t in norm_text(q).split() if len(t) > 1 and t not in STOP_WORDS]


def is_youtube_video_id(id_val: str) -> bool:
    return bool(re.fullmatch(r"[a-zA-Z0-9_-]{11}", id_val or ""))


def is_youtube_channel_id(id_val: str) -> bool:
    return bool(re.fullmatch(r"UC[a-zA-Z0-9_-]{22}", id_val or ""))


def strip_topic_suffix(s: str) -> str:
    return re.sub(r"\s*[\u2013\u2014-]\s*topic\s*$", "", s or "", flags=re.I).strip()


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


def pick_channel_thumbnail(entry: dict) -> str:
    for k in ("channel_thumbnail", "uploader_thumbnail", "uploader_avatar_url"):
        v = entry.get(k)
        if isinstance(v, str) and v:
            return v
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


def pick_year(entry: dict) -> Optional[int]:
    ry = entry.get("release_year")
    if isinstance(ry, (int, float)) and ry > 1900:
        return int(ry)
    rd = entry.get("release_date")
    if isinstance(rd, str) and len(rd) >= 4:
        try:
            y = int(rd[:4])
            if y > 1900:
                return y
        except ValueError:
            pass
    ud = entry.get("upload_date")
    if isinstance(ud, str) and len(ud) >= 4:
        try:
            y = int(ud[:4])
            if y > 1900:
                return y
        except ValueError:
            pass
    return None


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


def merge_entries_by_id_many(lists: List[List[dict]]) -> List[dict]:
    m: Dict[str, dict] = {}
    for lst in lists:
        for e in lst:
            id_val = e.get("id")
            if isinstance(id_val, str) and id_val and id_val not in m:
                m[id_val] = e
    return list(m.values())


def youtube_playlist_search_url(query: str) -> str:
    q = quote_plus((query or "").strip())
    return f"https://www.youtube.com/results?search_query={q}&sp=EgIQAw%3D%3D"


def artist_name_matches_query(artist: str, query: str) -> bool:
    q = norm_text(query)
    art = norm_text(artist)
    if not q or len(q) < 2:
        return True
    if q in art:
        return True
    tokens = significant_tokens(query)
    if not tokens:
        return q in art
    return all(t in art for t in tokens)


def album_artist_matches_primary_query(artist_raw: str, query: str) -> bool:
    q = norm_text(query)
    if not q or len(q) < 2:
        return True
    a_full = norm_text(strip_topic_suffix(artist_raw))
    if not a_full:
        return False
    if re.search(r"\bvarious\s+artists?\b", a_full):
        return False

    def drop_article(s: str) -> str:
        return re.sub(r"^(the|a|an)\s+", "", s, flags=re.I).strip()

    if a_full == q or drop_article(a_full) == q or a_full == drop_article(q):
        return True
    collapsed = norm_text(re.sub(r"\s+", " ", re.sub(r"\s*&\s*", " ", artist_raw)))
    if collapsed == q or drop_article(collapsed) == q or collapsed == drop_article(q):
        return True
    has_collab = bool(
        re.search(r"\s+&\s+", artist_raw, re.I)
        or re.search(r"\s+feat\.?\s+", artist_raw, re.I)
        or re.search(r"\s+ft\.?\s+", artist_raw, re.I)
        or re.search(r"\s+featuring\s+", artist_raw, re.I)
    )
    if has_collab:
        return False
    return False


def pick_playlist_id(entry: dict) -> Optional[str]:
    pl_field = entry.get("playlist_id")
    if isinstance(pl_field, str) and pl_field and not is_youtube_video_id(pl_field) and not pl_field.startswith("RD"):
        return pl_field
    id_val = entry.get("id")
    if isinstance(id_val, str) and id_val and not is_youtube_video_id(id_val) and not id_val.startswith("RD"):
        return id_val
    url = entry.get("url")
    if isinstance(url, str):
        m = re.search(r"[?&]list=([^&]+)", url)
        if m:
            try:
                from urllib.parse import unquote

                raw = unquote(m.group(1))
            except Exception:
                raw = m.group(1)
            if not is_youtube_video_id(raw) and not raw.startswith("RD"):
                return raw
    return None


def album_authority_score(entry: dict, query: str) -> int:
    s = pick_view_count(entry)
    title = (entry.get("title") or "").lower() if isinstance(entry.get("title"), str) else ""
    channel = (entry.get("channel") or "").lower() if isinstance(entry.get("channel"), str) else ""
    uploader = (entry.get("uploader") or "").lower() if isinstance(entry.get("uploader"), str) else ""
    ch = channel or uploader

    for p in (
        "reaction",
        "karaoke",
        "8d audio",
        "bass boosted",
        "nightcore",
        "перезалив",
        "full album reaction",
        "reacts to",
        "listening to",
        "first time hearing",
    ):
        if p in title:
            s -= 900_000
    for p in ("cover", "remix", "tribute", "8d", "slowed", "reverb"):
        if p in title:
            s -= 150_000
    if "topic" in ch or re.search(r"\b- topic\b", ch):
        s += 500_000
    first_word = (query.strip().lower().split() or [""])[0]
    if first_word and len(first_word) > 2 and first_word in ch:
        s += 280_000
    if len(title) > 150:
        s -= 100_000
    return s


def map_playlist_album_row(entry: dict, query: str) -> Optional[Tuple[dict, int]]:
    playlist_id = pick_playlist_id(entry)
    if not playlist_id:
        return None
    title = entry.get("title") if isinstance(entry.get("title"), str) else ""
    if not str(title).strip():
        return None
    artist = (
        pick_artist(entry).strip()
        or (str(entry.get("uploader") or "").strip())
        or (str(entry.get("channel") or "").strip())
        or ""
    )
    if not album_artist_matches_primary_query(artist, query):
        return None
    thumb = pick_thumbnail(entry) or pick_channel_thumbnail(entry)
    row = {
        "albumId": playlist_id,
        "title": title,
        "artist": artist or "—",
        "year": pick_year(entry),
        "thumbnailUrl": thumb,
    }
    return row, album_authority_score(entry, query)


def rank_album_entries(entries: List[dict], query: str, track_ids: set, max_out: int) -> List[dict]:
    rows_scored: List[Tuple[dict, int]] = []
    for entry in entries:
        mapped = map_playlist_album_row(entry, query)
        if not mapped:
            continue
        row, score = mapped
        if row["albumId"] in track_ids:
            continue
        rows_scored.append((row, score))
    rows_scored.sort(key=lambda x: x[1], reverse=True)
    seen = set()
    out = []
    for row, _ in rows_scored:
        aid = row["albumId"]
        if aid in seen:
            continue
        seen.add(aid)
        out.append(row)
        if len(out) >= max_out:
            break
    return out


def build_search_bundle(q: str) -> dict:
    q = (q or "").strip()
    if not q:
        return {"tracks": [], "albums": [], "artists": []}

    main_url = f"ytsearch{YT_SEARCH_MAIN}:{q}"
    pl1 = youtube_playlist_search_url(q)
    pl2 = youtube_playlist_search_url(f"{q} album")

    def fetch_main():
        return _ytdlp_flat_entries(main_url, PLAYLIST_END)

    def fetch_pl1():
        try:
            return _ytdlp_flat_entries(pl1, PLAYLIST_END)
        except Exception:
            return []

    def fetch_pl2():
        try:
            return _ytdlp_flat_entries(pl2, PLAYLIST_END)
        except Exception:
            return []

    # parallel inside sync worker chunk — caller runs this in executor; we parallelize with threads here too
    from concurrent.futures import ThreadPoolExecutor as TPE

    with TPE(max_workers=3) as ex:
        f1 = ex.submit(fetch_main)
        f2 = ex.submit(fetch_pl1)
        f3 = ex.submit(fetch_pl2)
        main_entries = f1.result()
        pl1_entries = f2.result()
        pl2_entries = f3.result()

    tracks = rank_track_entries(main_entries, MAX_TRACKS_OUT)
    track_ids = {t["trackId"] for t in tracks}

    artist_map: Dict[str, dict] = {}
    for entry in main_entries:
        row = map_flat_entry(entry)
        if not row:
            continue
        name = (row.get("artist") or "").strip() or pick_artist(entry).strip()
        if not name:
            continue
        ch = pick_channel_id(entry)
        key = ch if ch else f"n:{name.lower()}"
        thumb = pick_channel_thumbnail(entry) or row.get("thumbnailUrl") or ""
        if key not in artist_map:
            artist_map[key] = {"id": ch or key, "name": name, "thumbnailUrl": thumb}
        elif not artist_map[key].get("thumbnailUrl") and thumb:
            artist_map[key]["thumbnailUrl"] = thumb

    artists = [a for a in artist_map.values() if artist_name_matches_query(a["name"], q)][:MAX_ARTISTS_OUT]

    if not artists and tracks:
        from_tracks: Dict[str, dict] = {}
        for t in tracks:
            name = (t.get("artist") or "").strip()
            if not name or not artist_name_matches_query(name, q):
                continue
            k = norm_text(strip_topic_suffix(name))
            if k not in from_tracks:
                from_tracks[k] = {
                    "id": t["trackId"],
                    "name": strip_topic_suffix(name) or name,
                    "thumbnailUrl": t.get("thumbnailUrl") or "",
                }
        artists = list(from_tracks.values())[:MAX_ARTISTS_OUT]

    album_entries = merge_entries_by_id_many([pl1_entries, pl2_entries])
    albums = rank_album_entries(album_entries, q, track_ids, MAX_ALBUMS_OUT)

    return {"tracks": tracks, "albums": albums, "artists": artists}


def build_tracks_and_artists_only(q: str) -> Tuple[List[dict], List[dict], set]:
    q = (q or "").strip()
    if not q:
        return [], [], set()

    main_url = f"ytsearch{YT_SEARCH_MAIN}:{q}"
    main_entries = _ytdlp_flat_entries(main_url, PLAYLIST_END)

    tracks = rank_track_entries(main_entries, MAX_TRACKS_OUT)
    track_ids = {t["trackId"] for t in tracks}

    artist_map: Dict[str, dict] = {}
    for entry in main_entries:
        row = map_flat_entry(entry)
        if not row:
            continue
        name = (row.get("artist") or "").strip() or pick_artist(entry).strip()
        if not name:
            continue
        ch = pick_channel_id(entry)
        key = ch if ch else f"n:{name.lower()}"
        thumb = pick_channel_thumbnail(entry) or row.get("thumbnailUrl") or ""
        if key not in artist_map:
            artist_map[key] = {"id": ch or key, "name": name, "thumbnailUrl": thumb}
        elif not artist_map[key].get("thumbnailUrl") and thumb:
            artist_map[key]["thumbnailUrl"] = thumb

    artists = [a for a in artist_map.values() if artist_name_matches_query(a["name"], q)][:MAX_ARTISTS_OUT]
    if not artists and tracks:
        from_tracks: Dict[str, dict] = {}
        for t in tracks:
            name = (t.get("artist") or "").strip()
            if not name or not artist_name_matches_query(name, q):
                continue
            k = norm_text(strip_topic_suffix(name))
            if k not in from_tracks:
                from_tracks[k] = {
                    "id": t["trackId"],
                    "name": strip_topic_suffix(name) or name,
                    "thumbnailUrl": t.get("thumbnailUrl") or "",
                }
        artists = list(from_tracks.values())[:MAX_ARTISTS_OUT]

    return tracks, artists, track_ids


def build_albums_only(q: str, track_ids: set) -> List[dict]:
    q = (q or "").strip()
    if not q:
        return []
    pl1 = youtube_playlist_search_url(q)
    pl2 = youtube_playlist_search_url(f"{q} album")

    # Fetch in parallel.
    from concurrent.futures import ThreadPoolExecutor as TPE

    with TPE(max_workers=2) as ex:
        f1 = ex.submit(lambda: _ytdlp_flat_entries(pl1, PLAYLIST_END))
        f2 = ex.submit(lambda: _ytdlp_flat_entries(pl2, PLAYLIST_END))
        pl1_entries = f1.result()
        pl2_entries = f2.result()

    album_entries = merge_entries_by_id_many([pl1_entries, pl2_entries])
    return rank_album_entries(album_entries, q, track_ids, MAX_ALBUMS_OUT)


async def handle_search_bundle_stream(req_id: str, args: dict, write_line: Callable[[dict], Any]) -> None:
    q = (args.get("query") or "").strip()
    seq = 0

    async def emit(data: dict, done: bool = False) -> None:
        nonlocal seq
        seq += 1
        payload = {"id": req_id, "ok": True, "seq": seq, "stream": True, "data": data}
        if done:
            payload["done"] = True
        await write_line(payload)

    if not q:
        await emit({"phase": "meta", "query": q})
        await emit({"phase": "tracks", "partial": True, "items": []})
        await emit({"phase": "tracks", "partial": False, "items": []})
        await emit({"phase": "albums", "items": []})
        await emit({"phase": "artists", "items": []})
        bundle = {"tracks": [], "albums": [], "artists": []}
        await emit({"phase": "bundle", "bundle": bundle}, done=True)
        return

    await emit({"phase": "meta", "query": q})

    # Stage 1: main search → tracks + artists (fast path, allows early UI).
    tracks, artists, track_ids = await to_thread(lambda: build_tracks_and_artists_only(q))
    first = tracks[:STREAM_FIRST_TRACKS]
    rest = tracks[STREAM_FIRST_TRACKS:]
    await emit({"phase": "tracks", "partial": True, "items": first})
    await emit({"phase": "tracks", "partial": False, "items": rest})
    await emit({"phase": "artists", "items": artists})

    # Stage 2: playlist searches → albums (slower).
    albums = await to_thread(lambda: build_albums_only(q, track_ids))
    await emit({"phase": "albums", "items": albums})

    bundle = {"tracks": tracks, "albums": albums, "artists": artists}
    await emit({"phase": "bundle", "bundle": bundle}, done=True)


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
        if action == "ytdlp_flat":
            url = (args.get("url") or "").strip()
            pe = int(args.get("playlistEnd") or 25)
            stdout = do_ytdlp_flat(url, pe)
            return {"id": req_id, "ok": True, "data": {"stdout": stdout}}
        if action == "ytdlp_flat_rows":
            url = (args.get("url") or "").strip()
            pe = int(args.get("playlistEnd") or 25)
            return {"id": req_id, "ok": True, "data": do_ytdlp_flat_rows(url, pe)}
        if action == "reco_radio_batch":
            vids = args.get("videoIds") or []
            lim = int(args.get("limit") or 60)
            return {"id": req_id, "ok": True, "data": do_reco_radio_batch(list(vids), lim)}
        if action == "reco_albums_batch":
            qs = args.get("queries") or []
            return {"id": req_id, "ok": True, "data": do_reco_albums_batch(list(qs))}
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

    if action == "search_bundle_stream":
        await handle_search_bundle_stream(req_id, cmd.get("args") or {}, write_line)
        return

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
