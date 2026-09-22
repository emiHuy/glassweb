# backend/request_fields.py
"""Per-request field extraction from live Playwright objects."""

from urllib.parse import urlparse, parse_qs

from playwright.async_api import Request

TRACKING_PARAMS = ["fbclid", "gclid", "msclkid", "_ga", "utm_source", "utm_medium", "utm_campaign"]


def get_post_data(req: Request) -> str | None:
    """
    Safely extracts a request's POST body as text, if any.

    Playwright's `.post_data` assumes UTF-8 and raises UnicodeDecodeError
    on binary bodies, crashing the request listener if unhandled.
    `.post_data_buffer` gives raw bytes so we can fail gracefully instead.
    """
    buffer = req.post_data_buffer
    if buffer is None:
        return None
    try:
        return buffer.decode("utf-8")
    except UnicodeDecodeError:
        return f"[binary data, {len(buffer)} bytes]"


def get_tracking_params(url: str) -> list:
    """
    Finds which known tracking query parameters are present in a request's URL.
    Takes in a full request URL and returns the matching tracking param names.
    """
    try:
        query = urlparse(url).query
        params = parse_qs(query)
        return [p for p in TRACKING_PARAMS if p in params]
    except ValueError:
        return []