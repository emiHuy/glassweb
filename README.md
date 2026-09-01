# Glassweb

A containerized web application featuring a Python FastAPI backend (with CORS enabled) and a static HTML/Nginx frontend, orchestrated using Docker Compose. Built toward a network request analyzer that fetches pages via headless browser and inspects outgoing tracker requests.

## Project Structure
```text
glassweb/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   └── index.html
├── .gitignore
├── Dockerfile
├── README.md
└── docker-compose.yml
```

---

## What It Does at the Moment
* **Backend (`/backend`):** Powered by Python, FastAPI, and Uvicorn. Includes CORS middleware. Built on a Microsoft Playwright base image.
  * `/health` — health check, returns `{"ok": true}`
  * `/test-render` — launches headless Chromium, navigates to a test page, and returns its title. Confirms the browser actually runs inside the container.
  * `/scan?url=<url>` — launches headless Chromium, navigates to the given URL, and captures every outgoing network request during load. Returns the page title, final URL (post-redirect), request count, and the full list of captured requests (url, resource type, method, whether it's the navigation request itself).
* **Frontend (`/frontend`):** Served via Nginx. Loads a static web page that pings the backend service to verify live cross-container communication.
* **Wiring:** Docker Compose links both containers, mapping the backend to port `8000` and the frontend to port `8080`.

---

## How to Run It

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on your machine.

### Instructions
1. Open your terminal in the root project directory (`glassweb/`).
2. Build and start the application:
   ```bash
   docker compose up --build
   ```
3. Open your web browser to test:
   * **Frontend Interface:** [http://localhost:8080](http://localhost:8080) (Displays *"backend reachable."*)
   * **Backend Health Check:** [http://localhost:8000/health](http://localhost:8000/health) (Returns `{"ok": true}`)
   * **Render Check:** [http://localhost:8000/test-render](http://localhost:8000/test-render) (Returns the title of a test page, confirming Chromium runs in-container)
   * **Scan:** `http://localhost:8000/scan?url=https://example.com` (Returns captured network requests for the given URL)

### Stopping the Application
To stop the containers, press `Ctrl + C` in your terminal, or run:
```bash
docker compose down
```