"""CLI entrypoint for the YouTube Music worker.

The implementation lives in the `ytmusic` package next to this file; this
module only keeps the executable path that the Node backend spawns
(`python3 scripts/ytmusic_worker.py`) working.
"""

import os
import sys

# Allow `python3 scripts/ytmusic_worker.py` to import the sibling package.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ytmusic.worker import main  # noqa: E402

if __name__ == "__main__":
    main()
