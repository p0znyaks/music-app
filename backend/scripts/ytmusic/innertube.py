"""Direct InnerTube (music.youtube.com) access, including player endpoints."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import _ytdlp_cookie_opts

from .config import INNERTUBE_TIMEOUT_SEC, MAX_TRACKS_OUT
from .runtime import run_sync
from .catalog import do_search_songs

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
