"""Recover a pilot's reports from `nebius ai job logs JOB_ID --tail 10000`.

Usage: python deploy/nebius/collect_artifacts.py job.log --out results/pilot
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

NAMES = {"results.json", "README.md", "chart.png", "manifest.json"}


def recover(logs: str, output: Path) -> None:
    begins = re.findall(r"MOVEPROOF_ARTIFACT_BEGIN (\{[^\n]+\})", logs)
    if len(begins) != 1 or "MOVEPROOF_ARTIFACT_END" not in logs:
        raise ValueError("Expected one complete artifact in job logs")
    manifest = json.loads(begins[0])
    parts: dict[int, str] = {}
    for number, text in re.findall(r"MOVEPROOF_ARTIFACT_PART (\d+) ([A-Za-z0-9+/=]+)", logs):
        index = int(number)
        if index in parts and parts[index] != text:
            raise ValueError("Conflicting artifact chunks")
        parts[index] = text
    if sorted(parts) != list(range(manifest["parts"])):
        raise ValueError("Missing artifact chunks; retrieve more job log lines")
    payload = base64.b64decode("".join(parts[i] for i in sorted(parts)), validate=True)
    if hashlib.sha256(payload).hexdigest() != manifest["sha256"]:
        raise ValueError("Artifact checksum mismatch")
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        members = archive.getmembers()
        if (len(members) != len(NAMES) or {m.name for m in members} != NAMES
                or any(not m.isfile() for m in members)
                or sum(m.size for m in members) > 64 * 1024 * 1024):
            raise ValueError("Unexpected artifact contents")
        if output.exists() and any(output.iterdir()):
            raise ValueError("Output directory must be empty")
        output.mkdir(parents=True, exist_ok=True)
        for member in members:
            stream = archive.extractfile(member)
            assert stream is not None
            (output / member.name).write_bytes(stream.read())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("logs", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    recover(args.logs.read_text(encoding="utf-8-sig"), args.out)
    print(f"Verified and recovered reports to {args.out}")
