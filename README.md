# Glassweb

A containerized web application featuring a Python FastAPI backend (with CORS enabled) and a static HTML/Nginx frontend, orchestrated using Docker Compose.

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
* **Backend (`/backend`):** Powered by Python, FastAPI, and Uvicorn. Includes CORS middleware and exposes a health-check endpoint (`/health`) returning `{"ok": true}`. Built on a Microsoft Playwright base image.
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

### Stopping the Application
To stop the containers, press `Ctrl + C` in your terminal, or run:
```bash
docker compose down
```