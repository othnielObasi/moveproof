# Fly.io (sidecar) deployment

This repo runs **backend + warehouse simulator on the same Fly machine** (`Dockerfile.fly`, started by Honcho from the `Procfile`):
- `api` process: FastAPI (public) on port 8080
- `sim` process: warehouse simulator (private) on `127.0.0.1:8090`

The repo no longer ships a `fly.toml`. `fly launch` generates one; point it at `Dockerfile.fly`, set the internal port to 8080, and set `SIM_BASE_URL=http://127.0.0.1:8090`.

## Prereqs
- Fly CLI installed
- A PostgreSQL database (Fly Postgres, Railway, Supabase or similar)

## Login
```bash
fly auth login
```

## Create app (one-time)
From repo root:
```bash
fly launch --no-deploy
```
> Choose the region when prompted, or edit `primary_region` in the generated `fly.toml`.

## Set secrets
```bash
fly secrets set DATABASE_URL="YOUR_DATABASE_URL"
fly secrets set CORS_ORIGINS="https://YOUR_VERCEL_APP.vercel.app"
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
fly secrets set SIM_TOKEN="$(openssl rand -hex 16)"   # required when ENVIRONMENT=production
fly secrets set RECEIPT_SIGNING_KEY="$(python -c 'import os,base64;print(base64.b64encode(os.urandom(32)).decode())')"
```

Planner (NVIDIA Nemotron on Nebius Token Factory):
```bash
fly secrets set NEBIUS_API_KEY="..." LLM_ENABLED="true" LLM_PROVIDER="nemotron"
```

Site intelligence (optional; labelled offline samples without it):
```bash
fly secrets set TAVILY_API_KEY="..."
```

Gemini remains available as a secondary provider (`GEMINI_API_KEY`, `GEMINI_ENABLED=true`).

## Deploy
```bash
fly deploy
```

The `deploy.yml` workflow also deploys on every push to `main`. It sets only the Gemini, database and JWT secrets, and targets an app named `moveproof-api`; use that name when you run `fly launch`, or change the workflow.

## Verify
- API docs: `https://<app>.fly.dev/docs`
- Health: `https://<app>.fly.dev/health` (database and simulator status)
- Planner: `https://<app>.fly.dev/llm/models`
