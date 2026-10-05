"""Normalisation, de-duplication and ranking of yt-dlp flat entries."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import _ytdlp_cookie_opts

from .config import POPULAR_TRACK_HEAD

def is_youtube_video_id(id_val: str) -> bool:
    return bool(re.fullmatch(r"[a-zA-Z0-9_-]{11}", id_val or ""))

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
