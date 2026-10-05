"""YouTube Music worker, split by responsibility.

The worker used to be a single ~965-line module. It is now a package:

    config    environment-driven settings and shared constants
    runtime   HTTP session, thread pool, offload helpers
    ranking   normalisation, de-duplication and ranking of flat entries
    ytdlp     yt-dlp scraping (fallback path)
    catalog   ytmusicapi lookups: search, albums, artists, songs
    innertube direct InnerTube API access, including player endpoints
    search    search-bundle assembly
    reco      recommendation batches
    worker    JSON-lines loop and command dispatch

Import `main` from `.worker`; `ytmusic_worker.py` stays as the CLI entrypoint.
"""