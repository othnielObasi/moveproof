# Submission package

This package contains the files needed to build and run the MoveProof demo for review.

Contents included by `scripts/package_submission.sh`:
- `frontend/`, `backend/` and `sim/` source
- `docker-compose.yml`, `docker-compose.vultr.yml`, `Dockerfile.fly`, `.env.example`, `LICENSE`
- `README.md` (project overview)
- `scripts/record_demo.js` (Playwright recorder)
- Optional: `frontend/public/downloads/moveproof_demo.mp4` (if provided)

Quick reviewer steps
1. Extract the archive:

```bash
tar -xzf submission-<timestamp>.tar.gz
cd submission-<timestamp>
```

2. (Optional) If the MP4 is not included, place the demo video at `frontend/public/downloads/moveproof_demo.mp4`.

3. Build and run with Docker Compose:

```bash
docker compose -f docker-compose.vultr.yml up --build -d
```

4. The frontend will be available on port 3000 by default (or 80 if the compose file maps it). The demo page is `/demo` and the direct download should be `/downloads/moveproof_demo.mp4`.

5. Run backend tests (optional):

```bash
cd backend
pip install -e ".[dev]"
pytest tests/
```

Notes
- The package includes `sim/`, `docker-compose.yml`, `.env.example` and `LICENSE`, so `docker compose up --build` works from the extracted folder.
- For NVIDIA Nemotron planning, set `NEBIUS_API_KEY`, `LLM_ENABLED=true` and `LLM_PROVIDER=nemotron` for the backend; without a key a deterministic planner runs, still governed. See the README.
- If your environment requires a host webserver for static files (e.g., nginx), place `moveproof_demo.mp4` in the server's webroot under `/downloads/` or use the frontend `public/downloads` path as above.
- Demo walkthrough: `docs/demo-script.md`. Judge checklist: `docs/JUDGE_CHECKLIST.md`.
