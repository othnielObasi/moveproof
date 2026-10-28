"""Run an immutable MoveProof revision in a Serverless Python container.

Only public source is downloaded. Credentials, when needed, come from a
MysteryBox environment reference. Artifacts are emitted in recoverable log
chunks, so a pilot does not need a storage bucket or an image registry.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile

REPOSITORY = "othnielObasi/moveproof"
MAX_ARCHIVE = 64 * 1024 * 1024
MAX_EXTRACTED = 256 * 1024 * 1024


def extract_source(payload: bytes, destination: Path) -> Path:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        members = archive.infolist()
        if sum(item.file_size for item in members) > MAX_EXTRACTED:
            raise ValueError("Source archive exceeds extraction limit")
        root = destination.resolve()
        for item in members:
            target = (root / item.filename).resolve()
            if not target.is_relative_to(root) or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError("Unsafe source archive member")
        archive.extractall(root)
    roots = list(destination.iterdir())
    if len(roots) != 1 or not (roots[0] / "backend" / "bench").is_dir():
        raise ValueError("Unexpected source archive layout")
    return roots[0]


def emit_artifacts(output: Path) -> None:
    buffer = io.BytesIO()
    # Explicit allowlist: never include environment files, keys or other outputs.
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name in ("results.json", "README.md", "chart.png", "manifest.json"):
            archive.add(output / name, arcname=name)
    payload = buffer.getvalue()
    if len(payload) > 8 * 1024 * 1024:
        raise ValueError("Artifact exceeds log transfer limit; use a bucket for larger runs")
    encoded = base64.b64encode(payload).decode("ascii")
    parts = [encoded[i:i + 1800] for i in range(0, len(encoded), 1800)]
    print("MOVEPROOF_ARTIFACT_BEGIN " + json.dumps({
        "sha256": hashlib.sha256(payload).hexdigest(), "parts": len(parts),
    }), flush=True)
    for index, part in enumerate(parts):
        print(f"MOVEPROOF_ARTIFACT_PART {index} {part}", flush=True)
    print("MOVEPROOF_ARTIFACT_END", flush=True)


def main() -> int:
    commit = os.environ["BENCH_COMMIT"]
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("BENCH_COMMIT must be a full immutable commit SHA")
    planner = os.environ.get("BENCH_PLANNER", "rule_based")
    if planner not in ("rule_based", "nemotron"):
        raise ValueError("Unsupported planner")
    rounds = int(os.environ.get("BENCH_ROUNDS", "1"))
    seeds = int(os.environ.get("BENCH_SEEDS_PER_ROUND", "1"))
    if not (1 <= rounds <= 3 and 1 <= seeds <= 20):
        raise ValueError("Run exceeds prepared benchmark limits")
    run_timeout = int(os.environ.get("BENCH_RUN_TIMEOUT_S", "600"))
    if not (60 <= run_timeout <= 4 * 3600):
        raise ValueError("BENCH_RUN_TIMEOUT_S must be 60 s to 4 h")
    if planner == "nemotron" and not os.environ.get("NEBIUS_API_KEY"):
        raise ValueError("Nemotron requires a MysteryBox NEBIUS_API_KEY reference")
    url = f"https://codeload.github.com/{REPOSITORY}/zip/{commit}"
    with urllib.request.urlopen(url, timeout=60) as response:
        payload = response.read(MAX_ARCHIVE + 1)
    if len(payload) > MAX_ARCHIVE:
        raise ValueError("Source archive exceeds download limit")
    with tempfile.TemporaryDirectory(prefix="moveproof-") as workspace:
        source = extract_source(payload, Path(workspace))
        backend = source / "backend"
        subprocess.run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check",
                        "--no-cache-dir", str(backend), "matplotlib>=3.8"], check=True, timeout=300)
        output = Path(workspace) / "results"
        env = {**os.environ, "PYTHONUNBUFFERED": "1", "MPLBACKEND": "Agg",
               "NEMOTRON_ENABLED": "true" if planner == "nemotron" else "false"}
        subprocess.run([sys.executable, "-m", "bench", "run", "--planner", planner,
                        "--rounds", str(rounds), "--seeds-per-round", str(seeds),
                        "--first-seed", "1000", "--progress", "--out", str(output)],
                       cwd=backend, env=env, check=True, timeout=run_timeout)
        manifest = {"repository": REPOSITORY, "source_commit": commit,
                    "source_archive_sha256": hashlib.sha256(payload).hexdigest(),
                    "planner": planner, "rounds": rounds, "seeds_per_round": seeds,
                    "arms": ["ungoverned", "governed", "learning"],
                    "execution": "nebius-serverless-job", "python": sys.version,
                    "scope": "pilot; not statistically representative" if seeds == 1 else "benchmark"}
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        emit_artifacts(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
