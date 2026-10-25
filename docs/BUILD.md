# Build & Deployment Guide

> MoveProof — an autonomous robotics governance platform.

This document covers every way to build, run, and deploy the project: local
development, Docker Compose, Vultr production, and the Fly.io + Vercel
alternative.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Local Development (Docker Compose)](#local-development-docker-compose)
5. [Local Development (No Docker)](#local-development-no-docker)
6. [Production — Vultr](#production--vultr)
7. [Production — Fly.io + Vercel](#production--flyio--vercel)
8. [Database & Migrations](#database--migrations)
9. [Running Tests](#running-tests)
10. [CI / CD Pipelines](#ci--cd-pipelines)
11. [Monitoring](#monitoring)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌────────────┐      ┌────────────┐      ┌────────────┐
│  Frontend   │ ───▶ │  Backend   │ ───▶ │ Simulator  │
│  Next.js    │      │  FastAPI   │      │  FastAPI    │
│  :3000      │      │  :8080     │      │  :8090      │
└────────────┘      └─────┬──────┘      └────────────┘
                          │
                    ┌─────▼──────┐
                    │ PostgreSQL │
                    │  :5432     │
                    └────────────┘
```

| Service       | Technology               | Port | Source Directory   |
|---------------|--------------------------|------|--------------------|
| **Frontend**  | Next.js 14, React 18, TypeScript, Tailwind CSS | 3000 | `frontend/` |
| **Backend**   | FastAPI, Python 3.11, SQLAlchemy, Alembic       | 8080 | `backend/`  |
| **Simulator** | FastAPI, Python 3.11 (live warehouse on the benchmark engine) | 8090 | `sim/warehouse_sim/` (+ `backend/bench/`) |
| **Database**  | PostgreSQL 16 (production) / SQLite (dev fallback)| 5432 | — |

The original mock simulator (`sim/mock_sim/`) is kept for comparison under the Compose `legacy` profile.

In production (Vultr), an **Nginx** reverse proxy sits in front of everything,
terminates TLS, and routes traffic:

- `https://domain.com/` → frontend (`:3000`)
- `https://domain.com/api/*` → backend (`:8080`, path prefix stripped)
- `https://domain.com/health|docs|redoc|ws` → backend (direct)

---

## Prerequisites

| Tool           | Version  | Purpose                |
|----------------|----------|------------------------|
| Docker         | ≥ 24     | Container builds       |
| Docker Compose | ≥ 2.20   | Service orchestration  |
| Python         | ≥ 3.10   | Backend (if running bare-metal) |
| Node.js        | ≥ 20     | Frontend (if running bare-metal) |
| Git            | ≥ 2.x    | Source control         |

Docker is the recommended path — it handles all dependencies automatically.

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### Required in Production

| Variable             | Description                                    | Example                          |
|----------------------|------------------------------------------------|----------------------------------|
| `DATABASE_URL`       | PostgreSQL connection string                   | `postgresql://moveproof:secret@db:5432/moveproof` |
| `JWT_SECRET`         | Secret key for JWT token signing               | *(auto-generated in dev)*        |
| `SIM_TOKEN`          | Shared auth token for simulator API            | *(empty in dev = no auth)*       |
| `POSTGRES_PASSWORD`  | PostgreSQL password (Vultr compose)            | `openssl rand -hex 32`           |
| `RECEIPT_SIGNING_KEY`| Base64 Ed25519 private key for signed receipts | *(dev key created in `data/`)*   |

### AI and Site Intelligence

| Variable               | Default                         | Description                          |
|------------------------|---------------------------------|--------------------------------------|
| `NEBIUS_API_KEY`       | —                               | Nebius Token Factory key (Nemotron)  |
| `LLM_ENABLED`          | `false`                         | Must be `true` for any model to plan |
| `LLM_PROVIDER`         | `nemotron`                      | `nemotron`, `gemini`, `agentic` or `mock` |
| `NEMOTRON_FAST_MODELS` | Lightning, Super                | Fast tier (per-step proposals; top two raced) |
| `NEMOTRON_REASONING_MODEL` | Nemotron 3 Ultra            | Mission planning and replanning      |
| `TAVILY_API_KEY`       | —                               | Live hazard lookups (labelled offline samples without it) |
| `GEMINI_API_KEY`, `GEMINI_PROJECT_ID`, `GEMINI_ENABLED` | — | Gemini, the secondary provider |

Check the Token Factory catalogue and both tiers with `python scripts/check_token_factory.py`.

### Other Optional Variables

| Variable               | Default                         | Description                          |
|------------------------|---------------------------------|--------------------------------------|
| `ENVIRONMENT`          | `development`                   | Set to `production` for prod guards  |
| `AUTH_REQUIRED`        | `true` in production, else `false` | Enforce authentication            |
| `CORS_ORIGINS`         | `http://localhost:3000`         | Allowed CORS origins (comma-separated) |
| `SIM_BASE_URL`         | `http://localhost:8090`         | Simulator endpoint                   |
| `NEXT_PUBLIC_API_BASE` | `/api`                          | Frontend → backend API prefix        |
| `BACKEND_URL`          | `http://localhost:8080`         | Where the Next.js dev server proxies `/api` |
| `SIM_TICK_HZ`          | `10`                            | Simulator physics rate               |
| `SIM_SEED`             | `42`                            | Simulator seed (same seed, same session) |

> **Note:** In production mode (`ENVIRONMENT=production`), the backend will
> refuse to start if `JWT_SECRET` or `SIM_TOKEN` are missing.
>

---

## Local Development (Docker Compose)

The fastest way to get everything running:

```bash
# 1. Clone the repository
git clone https://github.com/othnielObasi/moveproof.git
cd moveproof

# 2. Optional: create a .env file for API keys (Nemotron, Tavily)
cp .env.example .env
# Set NEBIUS_API_KEY, LLM_ENABLED=true, LLM_PROVIDER=nemotron, TAVILY_API_KEY

# 3. Build and start all services
docker compose up --build
```

This uses `docker-compose.yml` and starts four containers. The backend and frontend read `.env` if it exists; the local Postgres password is fixed (`moveproof`) in the compose file.

| Container       | Image                                | Exposed Port |
|-----------------|--------------------------------------|-------------|
| `frontend`      | `frontend/Dockerfile`                | `3000`      |
| `backend`       | `backend/Dockerfile`                 | `8080`      |
| `warehouse-sim` | `sim/warehouse_sim/Dockerfile` (built from the repo root) | `8090` |
| `postgres`      | `postgres:16`                        | `5432`      |

The legacy mock simulator starts only with `docker compose --profile legacy up mock-sim` (port `8091`).

The backend runs Alembic migrations on startup via `app.preflight`.

**Access points:**

- Dashboard: http://localhost:3000
- API docs: http://localhost:8080/docs
- Health check: http://localhost:8080/health
- Simulator: http://localhost:8090/health

### Hot Reload

- **Backend**: The local compose file mounts `./backend:/app`, so code changes
  are picked up by Uvicorn's auto-reload.
- **Frontend**: Runs via `npm run dev` with Next.js fast refresh.

### Stopping

```bash
docker compose down          # stop containers
docker compose down -v       # stop + remove volumes (wipes DB)
```

---

## Local Development (No Docker)

If you prefer running services directly:

### Backend

```bash
cd backend

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev,postgres]"

# Run database migrations (uses SQLite by default at data/app.db)
python -m app.preflight

# Start the server
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

### Simulator

From the repository root (the simulator imports the benchmark engine from `backend/bench`):

```bash
pip install -r sim/warehouse_sim/requirements.txt
PYTHONPATH=backend uvicorn server:app --app-dir sim/warehouse_sim --host 0.0.0.0 --port 8090
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The Next.js dev server rewrites `/api/*` requests
to `http://localhost:8080` automatically (see `next.config.js`).

---

## Production — Vultr

The primary production target. A single Vultr VM (recommended: **2 vCPU / 4 GB**)
runs all services via `docker-compose.vultr.yml` behind Nginx.

### Automated Deployment (Recommended)

Every push to `main` triggers the **provision_vultr_env** GitHub Actions
workflow, which SSHes into the VM and runs the deploy script.

**Required GitHub Secrets:**

| Secret            | Description                          |
|-------------------|--------------------------------------|
| `SSH_PRIVATE_KEY` | SSH key for VM access                |
| `VM_IP`           | Vultr VM public IP                   |
| `VM_USER`         | SSH user (typically `root`)          |
| `GEMINI_API_KEY`  | Gemini API key                       |
| `GEMINI_PROJECT_ID` | Gemini project ID                 |
| `POSTGRES_PASSWORD`  | PostgreSQL password               |
| `JWT_SECRET`      | JWT signing secret                   |
| `SIM_TOKEN`       | Simulator auth token                 |

> **Nemotron, Tavily and receipt signing in production:** `docker-compose.vultr.yml`
> sets the backend's environment explicitly and currently passes only the Gemini
> keys. To use Nemotron, live Tavily lookups and a stable signing key, add
> `NEBIUS_API_KEY`, `LLM_ENABLED`, `LLM_PROVIDER`, `TAVILY_API_KEY` and
> `RECEIPT_SIGNING_KEY` to the backend service there (and to `/etc/moveproof/.env`).
> `deploy/vultr-deploy.sh` also still requires `GEMINI_API_KEY`.

### Manual Deployment

SSH into the VM and run the deploy script:

```bash
ssh root@<VM_IP>
cd /opt/moveproof
git pull origin main
bash deploy/vultr-deploy.sh
```

The deploy script handles:
1. Repository clone / update
2. Environment file creation (`/etc/moveproof/.env`)
3. Firewall configuration (ports 80, 443)
4. Docker Compose build and launch
5. Nginx reverse proxy configuration
6. Let's Encrypt TLS certificate (Certbot)
7. Daily PostgreSQL backup cron (7-day retention)

### Production Container Resources

| Container  | CPU    | Memory | Notes                     |
|------------|--------|--------|---------------------------|
| frontend   | 0.5    | 512 MB | Next.js SSR               |
| backend    | 1.0    | 1.5 GB | FastAPI + Alembic          |
| db         | 1.0    | 1 GB   | PostgreSQL 16              |
| sim        | 0.5    | 256 MB | Warehouse simulator        |
| **Total**  | **3.0**| **3.25 GB** | Fits a 4 GB VM       |

### Network Isolation

```
                     ┌─── frontend_net ───┐
                     │                    │
Internet → Nginx → Frontend           Backend → Simulator
                                         │
                     └─── backend_net ────┘
                                         │
                                      PostgreSQL
```

The frontend can only reach the backend. The database and simulator are on
`backend_net` only — not directly accessible from the frontend container or
the public internet.

---

## Production — Fly.io + Vercel

An alternative deployment that co-locates the backend and simulator in a
single Fly.io machine and deploys the frontend to Vercel's edge network.

### Backend (Fly.io)

Uses `Dockerfile.fly` — a monolith image that runs both the API and simulator
via [Honcho](https://github.com/nickstenning/honcho) (see `Procfile`).

```bash
# One-time setup
fly launch --name moveproof --region lhr

# Set secrets
fly secrets set \
  NEBIUS_API_KEY=... LLM_ENABLED=true LLM_PROVIDER=nemotron \
  TAVILY_API_KEY=... \
  RECEIPT_SIGNING_KEY=... \
  DATABASE_URL=... \
  JWT_SECRET=... \
  SIM_TOKEN=...

# Deploy
fly deploy
```

### Frontend (Vercel)

```bash
npx vercel --prod
```

Configuration is in `vercel.json`. The build command runs `cd frontend && npm
run build`, and `NEXT_PUBLIC_API_BASE` is set to the Fly.io URL, so all API
calls from the browser go directly to Fly.

### CI/CD

The `deploy.yml` workflow deploys both on each push to `main`:
- **Fly.io**: Uses `flyctl` via `FLY_API_TOKEN`
- **Vercel**: Uses `amondnet/vercel-action` via `VERCEL_TOKEN`

The workflow sets only the Gemini, database and JWT secrets, on an app named
`moveproof-api`, while `vercel.json` points the frontend at
`https://moveproof.fly.dev`. The repo has no `fly.toml`; `fly launch` creates one. Set the Nemotron, Tavily and
signing secrets yourself with `fly secrets set`, and keep the app names consistent.

---

## Database & Migrations

### Engine Selection

| Environment   | Engine       | Connection String                        |
|---------------|-------------|------------------------------------------|
| Development   | SQLite       | `sqlite:///./data/app.db` (default)      |
| Production    | PostgreSQL 16| `postgresql://moveproof:<pw>@db:5432/moveproof`      |

Set `DATABASE_URL` to switch engines. The ORM layer (SQLAlchemy) abstracts
the difference.

### Running Migrations

Migrations run automatically on startup via `app.preflight` (with retry logic).
To run manually:

```bash
cd backend
alembic upgrade head
```

### Creating a New Migration

```bash
cd backend
alembic revision --autogenerate -m "describe_your_change"
```

Review the generated file in `alembic/versions/`, then apply:

```bash
alembic upgrade head
```

### Backing Up PostgreSQL (Production)

The Vultr deploy script installs a daily cron job:

```
0 3 * * * docker exec moveproof-db pg_dump -U moveproof moveproof | gzip > /opt/moveproof/backups/moveproof-$(date +\%Y\%m\%d).sql.gz
```

Backups are retained for 7 days.

---

## Running Tests

### Backend Tests

```bash
cd backend
pip install -e ".[dev]"
pytest -q                # 221 tests
```

Run from `backend/`: the benchmark tests import the `bench` package from there.

Key test files:

| File                    | Coverage                                 |
|-------------------------|------------------------------------------|
| `tests/test_api_smoke.py`       | API endpoint smoke tests          |
| `tests/test_governance.py`      | Governance engine logic           |
| `tests/test_live_safety.py`     | Live run loop: denied moves stop the robot; nothing unapproved executes |
| `tests/test_bench.py`           | Benchmark engine, arms and report |
| `tests/test_nemotron_planner.py`| Nemotron tier routing and fallback |
| `tests/test_planner_lessons.py` | Lessons from gate decisions       |
| `tests/test_governed_rules_and_signing.py` | Rule-change workflow and Ed25519 receipts |
| `tests/test_site_intel.py`      | Tavily firewall, corroboration, hazard zones |
| `tests/test_safety_validator.py`| Post-run safety validation        |
| `tests/test_plan_execution.py`  | Plan execution pipeline           |
| `tests/test_reward_hacking.py`  | Adversarial / reward hacking      |
| `tests/test_phase_abc.py`, `test_phase_d.py`, `test_new_services.py` | Earlier feature phases |
| `tests/test_startup_cleanup.py` | Startup and cleanup behaviour     |

### Simulator and Browser Tests

From the repository root:

```bash
python -m pytest tests/test_live_traffic.py -q   # live site traffic

npm install                                      # Playwright
APP_URL=http://127.0.0.1:3000 node tests/warehouse-ui.smoke.cjs
APP_URL=http://127.0.0.1:3000 node tests/warehouse-parity.smoke.cjs
```

The browser tests need the frontend running. They serve every API and WebSocket
call from fixtures and fail on any mutation, so they never move a robot. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` if Playwright's own Chromium is not installed.

### Frontend Build Verification

```bash
cd frontend
npm install
npm run build    # Type checks + production build
```

### Docker Build Verification

```bash
docker compose build                          # dev images
docker compose -f docker-compose.vultr.yml build  # prod images
```

---

## CI / CD Pipelines

All workflows live in `.github/workflows/`:

| Workflow                    | Trigger            | What it does                           |
|-----------------------------|--------------------|----------------------------------------|
| `ci.yml`                    | Push / PR to main  | Backend tests, frontend build, Docker builds (backend, mock sim, warehouse sim) |
| `deploy.yml`                | Push to main       | Deploy to Fly.io + Vercel              |
| `provision_vultr_env.yml`   | Push to main       | SSH deploy to existing Vultr VM        |
| `provision_vultr_api.yml`   | Push to main / manual | Create new Vultr VM via API         |
| `deploy_vultr.yml`          | Manual dispatch    | Create Vultr VM + deploy               |

### Typical Flow

```
git push origin main
  ├── ci.yml        → runs tests, verifies builds
  ├── deploy.yml    → deploys to Fly.io + Vercel
  └── provision_vultr_env.yml → SSH into Vultr VM, pull + rebuild
```

---

## Monitoring

### Health Endpoint

```bash
curl https://your-domain.com/health
# {"status":"ok","checks":{"database":"ok","simulator":"ok"}}
```

The health endpoint always returns HTTP 200. Dependency status is informational
in the JSON payload — not a fatal error code — so Docker healthchecks remain
stable during transient simulator hiccups.

### Grafana Dashboard

An optional Prometheus-based Grafana dashboard is included at
`infra/grafana/dashboard.json`. It tracks:

- Governance decision counts and approval rate
- Average risk score
- Policy violations by type
- Decision throughput over time
- Policy evaluation latency (p50 / p99)

### API Documentation

- **Swagger UI**: `https://your-domain.com/docs`
- **ReDoc**: `https://your-domain.com/redoc`
- **OpenAPI spec**: `https://your-domain.com/openapi.json`

---

## Troubleshooting

### "Cannot reach simulator"

The backend can't connect to the simulator on port 8090.

- **Local**: Make sure the simulator is running — `docker compose up warehouse-sim`
- **Docker**: Verify `SIM_BASE_URL` uses the container hostname, not `localhost`
  (`http://warehouse-sim:8090` in `docker-compose.yml`,
  `http://sim:8090` in `docker-compose.vultr.yml`)

### Simulator exits with `No module named 'bench'`

Build the warehouse simulator image from the repository root
(`docker build -f sim/warehouse_sim/Dockerfile .`), or run it locally with
`PYTHONPATH=backend`.

### Planning always uses the deterministic fallback

`LLM_ENABLED` must be `true` and `NEBIUS_API_KEY` set in the backend's own
environment. Check with `GET /llm/models`.

### Frontend shows "loading" indefinitely

The frontend API calls are failing silently.

- Check that `NEXT_PUBLIC_API_BASE` is correct and was set **at build time**
  (it's baked into the Next.js bundle)
- In dev, verify the `next.config.js` rewrite points to port `8080`
- Check browser DevTools → Network tab for failing `/api/*` requests

### Backend container keeps restarting

Check logs: `docker compose logs backend`

Common causes:
- Database not ready yet — the backend retries migrations 5 times (3s apart)
- Missing required env vars in production (`JWT_SECRET`, `SIM_TOKEN`)
- Port conflict on 8080

### Database migration errors

```bash
cd backend
alembic heads          # check for multiple heads
alembic history        # view migration chain
alembic upgrade head   # apply pending migrations
```

### Out of memory on Vultr

Container limits total 3.25 GB. Use a VM with at least 4 GB RAM:
- Vultr plan: `vc2-2c-4gb`
- Check usage: `docker stats --no-stream`
