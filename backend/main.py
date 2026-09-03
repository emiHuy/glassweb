"""FastAPI backend: exposes /health, /test-render, and /scan endpoints."""

import sys
import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright, Request

from helpers import load_tracker_data, extract_domain, match_domain, summarize_requests, UNCLASSIFIED

# Windows-only: Playwright needs the Proactor event loop to launch
# subprocesses (i.e. the browser). Only relevant for local dev —
# Docker runs on Linux, where this distinction doesn't apply.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

app = FastAPI()

# Allow frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TRACKER_MAP = load_tracker_data()

@app.get("/health")
async def health_check() -> dict:
    return {"ok": True}

@app.get("/test-render")
async def test_render() -> dict:
    # Initialize playwright
    pw = await async_playwright().start()

    # Launch tab within background browser instance
    browser = await pw.chromium.launch()
    page = await browser.new_page()

    try:
        # Navigate to url and return its title
        await page.goto("https://playwright.dev/python/")
        title = await page.title()
        return {"title": title}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Automation task failed: {str(e)}")

    finally:
        # Close tabs and browser
        await browser.close()
        await pw.stop()

@app.get("/scan")
async def scan(url: str) -> dict:
    # Initialize playwright
    pw = await async_playwright().start()

    # Launch tab within background browser instance
    browser = await pw.chromium.launch()
    page = await browser.new_page()

    network_requests = []

    def handle_request(req: Request):
        domain = extract_domain(req.url)
        classification = match_domain(domain, TRACKER_MAP) or UNCLASSIFIED

        req_info = {
            "url": req.url,
            "resource_type": req.resource_type,
            "method": req.method,
            "is_navigation_request": req.is_navigation_request(),
            "classification": classification
        }
        network_requests.append(req_info)

    # Set up listeners
    page.on("request", handle_request)

    try:
        # Navigate to url and return its information
        await page.goto(url)
        title = await page.title()
        summary = summarize_requests(network_requests)
        
        return {
            "url": url,
            "title": title, 
            "network_requests_count": len(network_requests),
            "network_requests": network_requests,
            "final_url": page.url, # url after redirect (if any)
            **summary
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Automation task failed: {str(e)}")

    finally:
        # Remove listeners
        page.remove_listener("request", handle_request)

        # Close tabs and browser
        await browser.close()
        await pw.stop()

if __name__ == "__main__":
    import uvicorn

    # Spin up server
    uvicorn.run(app, host="127.0.0.1", port=8000, loop="asyncio")