# Glassweb

A containerized web application featuring a Python FastAPI backend (with CORS enabled) and an HTML/Nginx frontend report view, orchestrated using Docker Compose. Built as a network request analyzer that fetches pages via a headless browser and inspects outgoing requests against a known tracker dataset.

## Project Structure
```text
glassweb/
├── backend/
|   ├── data/
|   |   └── services.json
│   ├── helpers.py
│   ├── main.py
│   └── requirements.txt
├── frontend/
|   ├── index.html
|   ├── script.js
│   └── styles.css
├── .gitignore
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## What It Does at the Moment
* **Backend (`/backend`):** Powered by Python, FastAPI, and Uvicorn. Includes CORS middleware. Built on a Microsoft Playwright base image.
   * `/health` — health check, returns `{"ok": true}`
   * `/test-render` — launches headless Chromium, navigates to a test page, and returns its title. Confirms the browser actually runs inside the container.
   * `/scan?url=<url>` — launches headless Chromium, navigates to the given URL, and captures every outgoing network request during load. Each request is classified against the Disconnect.me tracker dataset (entity + category), with unmatched domains marked `unclassified`. Returns the page title, final URL (post-redirect), the full list of captured, classified requests, a total tracker count, and a per-category count breakdown.
* **Frontend (`/frontend`):** Served via Nginx. Loads a static web page that pings the backend service to verify live cross-container communication.
   * A URL input triggers `/scan` and renders the results: a stat strip, a segmented bar + legend showing the category breakdown, and a request table sorted by category.
   * URLs typed without a scheme (e.g. `example.com`) are automatically normalized to `https://` before scanning, so the "redirected to" indicator only appears for genuine redirects, not missing-prefix false positives.
   * An "About trackers" panel explains all tracker categories from the dataset, each with its own color and plain-language description.
   * A GitHub link in the header points back to this repo.
* **Wiring:** Docker Compose links both containers, mapping the backend to port `8000` and the frontend to port `8080`.

---

## Known Limitations
* **Requests that redirect**appear as separate entries for each hop, since each hop is captured as its own request. Redirect-chain reconstruction is planned but not yet implemented.
* **Large, slow-loading, or anti-bot-defended pages** can exceed Playwright's default 30s navigation timeout.
* **Dynamic, continuously-active pages** are only captured for the brief window between page load and the browser closing
* **Repeated domains** currently show as individual rows rather than being grouped for a page that calls the same tracker many times
* **Frontend table rendering uses `innerHTML`** with data sourced from the scanned page itself (untrusted input, since the tool is designed to point at arbitrary websites). Not yet hardened against malformed/malicious content.
---

## Data Sources
* **Tracker classification** uses the [Disconnect.me Tracking Protection List](https://github.com/disconnectme/disconnect-tracking-protection) (`services.json`), which maps categories → entities → domains for known trackers. Stored locally in `backend/data/`.

---

## How to Run It

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on your machine.
* The `playwright` version in `backend/requirements.txt` must match the base image version in the `Dockerfile` (`mcr.microsoft.com/playwright/python:vX.XX.X-noble`) — a mismatch causes `BrowserType.launch` errors since the browser binaries baked into the image won't match what the Python package expects.

### Instructions
1. Open your terminal in the root project directory (`glassweb/`).
2. Build and start the application:
   ```bash
   docker compose up --build
   ```
3. Open your web browser to test:
   * **Frontend Interface:** [http://localhost:8080](http://localhost:8080) (Enter a URL and scan it)
   * **Backend Health Check:** [http://localhost:8000/health](http://localhost:8000/health) (Returns `{"ok": true}`)
   * **Render Check:** [http://localhost:8000/test-render](http://localhost:8000/test-render) (Returns the title of a test page, confirming Chromium runs in-container)
   * **Scan:** `http://localhost:8000/scan?url=https://example.com` (Returns captured, classified network requests for the given URL)

### Stopping the Application
To stop the containers, press `Ctrl + C` in your terminal, or run:
```bash
docker compose down
```
