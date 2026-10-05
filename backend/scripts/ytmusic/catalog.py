"""Catalogue lookups through ytmusicapi: searches, albums, artists, songs."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import _ytdlp_cookie_opts

from .runtime import run_sync, ytm

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
