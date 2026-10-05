"""Recommendation batches: radio continuations and album expansion."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import _ytdlp_cookie_opts

from .config import RECO_429_RETRIES, RECO_BATCH_WORKERS
from .catalog import do_get_watch_playlist_radio, do_search_albums
from .runtime import run_sync

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
