import sys
import asyncio

# Fix Windows-specific Playwright subprocess crashes by forcing a Selector loop
if sys.platform == "win32":
    try:
        # Modern Python 3.14+ approach: Set loop directly on the active policy thread
        asyncio.get_event_loop_policy().set_event_loop(asyncio.SelectorEventLoop())
    except Exception:
        # Legacy fallback: Swap the global policy for older Python versions
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright
from typing import Optional

app = FastAPI()

# Allow frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
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

if __name__ == "__main__":
    import uvicorn

    # Spin up server
    uvicorn.run(app, host="127.0.0.1", port=8000, loop="asyncio")