# backend/config.py
"""Configurable values"""

import os

# Navigation timeout for page.goto()
NAV_TIMEOUT_MS = int(os.environ.get("GLASSWEB_NAV_TIMEOUT_MS", 45_000))

# Post load observation window
POST_LOAD_WAIT_MS = int(os.environ.get("GLASSWEB_POST_LOAD_WAIT_MS", 3_000))