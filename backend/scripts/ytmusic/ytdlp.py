"""yt-dlp flat-playlist scraping (fallback when InnerTube is unavailable)."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import _ytdlp_cookie_opts

from .config import YTDLP_FLAT_OPTS_BASE, _ytdlp_cookie_opts

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
