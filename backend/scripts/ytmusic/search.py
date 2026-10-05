"""Search bundle assembly: InnerTube first, yt-dlp as fallback."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import _ytdlp_cookie_opts

from .config import MAX_TRACKS_OUT, PLAYLIST_END, YT_SEARCH_MAIN
from .ranking import rank_track_entries
from .ytdlp import _ytdlp_flat_entries
from .innertube import innertube_tracks

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

def build_search_bundle(q: str) -> dict:
    """Tracks for the JSON search endpoint.

    The client renders tracks from this bundle but loads albums and artists
    through their own endpoints, so this path asks InnerTube for tracks only.
    Resolving artists here would spend a network round-trip on a result the
    caller discards.
    """
    return {"tracks": build_tracks_only(q), "albums": [], "artists": []}
