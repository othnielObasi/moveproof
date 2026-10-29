# Production Roadmap — MoveProof

> A phased plan to move MoveProof from hackathon prototype to production-ready deployment.
> Status checked against the code on 2026-10-25: ✅ done · 🟡 partly done · ⬜ open.

---

## Phase 1 — Security Hardening (Critical)

| Status | Item | Where it stands |
|---|---|---|
| ✅ | Dev-token endpoint open | `POST /auth/dev-token` returns 404 unless dev tokens are enabled; they are off by default in production |
| ✅ | Auth off by default | `AUTH_REQUIRED` defaults to on in production, off elsewhere |
| ✅ | Hardcoded DB password | `docker-compose.vultr.yml` reads `${POSTGRES_PASSWORD}`; the deploy script generates one if unset |
| ✅ | JWT secret regenerates on restart | Production startup fails if `JWT_SECRET` or `SIM_TOKEN` is missing |
| ✅ | No HTTPS configuration | `deploy/vultr-deploy.sh` configures Nginx and a Let's Encrypt certificate (Certbot, HTTP → HTTPS redirect) |
| 🟡 | No rate limiting | In-memory rate limiter middleware (on by default in production); per-process only, so it does not hold across several instances |
| ✅ | Permissive CORS | Methods and headers restricted to the ones the app uses |
| 🟡 | Missing security headers | Backend sends `X-Content-Type-Options`, `X-Frame-Options`, CSP, and HSTS in production; the Next.js frontend does not set its own |
| ⬜ | Production keys not wired | Vultr compose, deploy script and workflows pass only Gemini keys; add `NEBIUS_API_KEY`, `LLM_ENABLED`, `LLM_PROVIDER`, `TAVILY_API_KEY`, `RECEIPT_SIGNING_KEY` |
| ⬜ | Receipt signing key | Without `RECEIPT_SIGNING_KEY` a development key is generated in `data/`; production needs a managed key and a rotation plan |

---

## Phase 2 — Database & Data Integrity

| Status | Item | Where it stands |
|---|---|---|
| 🟡 | Connection pooling | SQLite: one connection per thread with WAL. PostgreSQL uses SQLAlchemy defaults with `pool_pre_ping`; set `pool_size`, `max_overflow`, `pool_recycle` for load |
| ✅ | Alembic migration drift | Migrations cover mission audit, policy versions, proposals and activations |
| ✅ | Manual ALTER TABLE at startup | Removed; schema changes go through Alembic |
| ✅ | No backup strategy | Daily `pg_dump` cron with 7-day retention in the deploy script; a documented restore procedure is still needed |
| ✅ | Shallow health check | `/health` reports database and simulator status |

---

## Phase 3 — Testing & Reliability

| Status | Item | Where it stands |
|---|---|---|
| 🟡 | Test coverage | 221 backend tests (governance, live run loop, benchmark, Nemotron routing, lessons, rule changes, signing, site intel) plus simulator traffic tests; coverage is not measured |
| 🟡 | No frontend tests | Two Playwright smoke tests cover the run page in 2D and 3D; no component tests, and CI does not run them yet |
| ⬜ | Silent exception swallowing | `run_service.py` still has about a dozen `except Exception: pass` blocks; log them and re-raise safety-critical failures |
| ⬜ | No load testing | Unknown behaviour under many concurrent runs and WebSocket clients |
| ✅ | Duplicate `rehydrate_plans` | One definition remains |
| ✅ | Benchmark test dependency | `matplotlib` added to the `dev` extras |
| ✅ | Operator stop could fail | The run loop held SQLite's write lock while waiting on the model, so a stop returned an error; it now commits first, and stop halts the robot before recording, with retries |
| ✅ | Viewing a run restarted it | `GET /runs/{id}` and the live feed no longer relaunch a run loop |

---

## Phase 4 — Dependency & Build Hygiene

| Status | Item | Where it stands |
|---|---|---|
| ⬜ | Backend deps unpinned | `>=` bounds only in `pyproject.toml`; generate a lock file |
| 🟡 | Frontend deps loosely pinned | `package-lock.json` is committed, but CI runs `npm install`, not `npm ci` |
| ✅ | Backend Dockerfile has no CMD | Runs preflight then Uvicorn |
| ✅ | Frontend prod Dockerfile missing `public/` | The frontend has no `public/` directory, so nothing is lost |
| ✅ | Minimal `.gitignore` | Covers `.env*`, `.venv/`, logs and build output |

---

## Phase 5 — Observability & Operations

| Status | Item | Where it stands |
|---|---|---|
| ⬜ | No OTEL config | `infra/` has only the Grafana dashboard; no collector config, no traces |
| ⬜ | Phantom Grafana metrics | The dashboard references metrics that are never emitted; add a Prometheus exporter |
| ⬜ | Basic logging only | No JSON logs or request IDs |
| ⬜ | Sentry config exists but no SDK | `sentry-sdk` is not installed |
| ⬜ | No WebSocket graceful shutdown | Clients are dropped on deploy |
| 🟡 | Model cost and latency | `GET /llm/usage` reports per-model latency and tokens; not exported as metrics |

---

## Phase 6 — Production Infrastructure

| Status | Item | Where it stands |
|---|---|---|
| ✅ | Multi-instance DDL race | Startup DDL removed; migrations run in preflight (still once per instance) |
| ✅ | No CI pipeline | `ci.yml`: backend tests, frontend build, Docker builds; no lint step yet |
| ✅ | SimAdapter token mismatch | Production refuses to start without `SIM_TOKEN`; the simulator returns a clear 401 on mismatch |
| ⬜ | No autoscaling | Single VM; in-memory pause flags and rate limits assume one backend instance |
| ✅ | No frontend error boundary | `app/error.tsx` catches page errors |
| ⬜ | No live deployment | No deployment is running (domain, Vultr IP and Fly hostname all down); GitHub Actions is locked by a billing issue; `fly.toml` removed. Pick one platform and align the configs |
| ⬜ | Real robot interface | Simulator only; a ROS 2 / Isaac Sim bridge behind the same `SimAdapter` contract is next |

---

## Top 3 Immediate Actions

1. **Wire production keys** — Nemotron, Tavily and a managed receipt-signing key in the Vultr and Fly configs
2. **Stop swallowing exceptions in the run loop** — a governance system must not fail silently
3. **Add metrics and tracing** — make the Grafana dashboard real and export model usage

---

*First written: March 2026 · Status updated: 25 October 2026*
