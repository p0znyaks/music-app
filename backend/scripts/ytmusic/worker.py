"""JSON-lines request loop and command dispatch."""

from .config import *  # noqa: F401,F403  (shared constants)
from .config import _ytdlp_cookie_opts

from .runtime import to_thread, PY_WORKER_THREADS
from .catalog import (do_search_albums, do_search_artists, do_search_songs,
                      do_get_album, do_get_artist, do_get_song,
                      do_get_watch_playlist_radio)
from .innertube import do_get_player_stream
from .search import build_search_bundle
from .reco import do_reco_radio_batch, do_reco_albums_batch

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
