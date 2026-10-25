# Vercel Deployment Guide

## Prereqs
- Vercel account
- Backend deployed (see [deploy-fly.md](deploy-fly.md))

## Steps

1. In Vercel dashboard → New Project → Import from GitHub.
2. Either set the project root to `frontend`, or keep the repo root and let `vercel.json` run `cd frontend && npm install` / `npm run build`.
3. Environment variable (baked in at build time):
```
NEXT_PUBLIC_API_BASE=https://moveproof.fly.dev
```
   `vercel.json` already sets this to `https://moveproof.fly.dev`; change it if your Fly app has a different name. The live feed's WebSocket uses `NEXT_PUBLIC_WS_BASE` if set, otherwise this API base.
4. Hit Deploy.

After deploying, add your Vercel URL to `CORS_ORIGINS` on Fly:

```bash
fly secrets set CORS_ORIGINS="https://YOUR_VERCEL_APP.vercel.app"
```

If the run page shows the live feed as Offline, check `NEXT_PUBLIC_API_BASE` (or `NEXT_PUBLIC_WS_BASE`) and `CORS_ORIGINS`.
