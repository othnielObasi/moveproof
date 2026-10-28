"""Prepare/dry-run a Serverless pilot. Creating paid compute requires --launch.

Run from Windows using the Nebius CLI installed in Ubuntu/WSL. Only the
NEBIUS_PROJECT_ID value is read from .env; no local credentials are uploaded.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def cli(*arguments: str) -> list[str]:
    return ["wsl.exe", "-d", "Ubuntu", "-u", "root", "--", "nebius",
            "--no-check-update", "--no-progress", "--color=false", *arguments]


def project_id() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        key, separator, value = line.strip().partition("=")
        if separator and key.strip() == "NEBIUS_PROJECT_ID":
            value = value.strip().strip("\"'")
            if re.fullmatch(r"project-[a-z0-9]+", value):
                return value
    raise ValueError("Set a valid NEBIUS_PROJECT_ID in the root .env")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--planner", choices=["rule_based", "nemotron"], default="rule_based")
    parser.add_argument("--token-secret", help="Existing MysteryBox secret selector; never a raw API key")
    parser.add_argument("--launch", action="store_true", help="Create the reviewed paid pilot job")
    parser.add_argument("--rounds", type=int, default=1, help="Benchmark rounds (1-3)")
    parser.add_argument("--seeds", type=int, default=1, help="Scenarios per round (1-20)")
    parser.add_argument("--timeout-min", type=int, default=20,
                        help="Job time limit in minutes; the benchmark gets this minus 8 for setup")
    args = parser.parse_args()
    if not (1 <= args.rounds <= 3 and 1 <= args.seeds <= 20):
        parser.error("--rounds must be 1-3 and --seeds 1-20 (the bootstrap enforces the same limits)")
    if not (20 <= args.timeout_min <= 240):
        parser.error("--timeout-min must be 20-240")
    run_timeout_s = (args.timeout_min - 8) * 60
    if args.planner == "nemotron" and not args.token_secret:
        parser.error("Nemotron needs --token-secret referencing an existing MysteryBox secret")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    subnets = json.loads(subprocess.check_output(
        cli("vpc", "subnet", "list", "--parent-id", project_id(), "--format", "json"),
        text=True, encoding="utf-8", timeout=60))
    available = [s for s in subnets.get("items", []) if s.get("status", {}).get("state") == "READY"]
    if len(available) != 1:
        raise ValueError("Expected one READY subnet; select an explicit subnet before launching")
    bootstrap = ROOT / "deploy" / "nebius" / "benchmark_bootstrap.py"
    linux_path = "/mnt/" + bootstrap.drive[0].lower() + bootstrap.as_posix()[2:]
    kind = "pilot" if args.rounds * args.seeds == 1 else "run"
    name = f"moveproof-bench-{kind}-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    command = cli("ai", "job", "create", "--name", name,
                  "--parent-id", project_id(), "--subnet-id", available[0]["metadata"]["id"],
                  "--image", "python:3.12-slim", "--platform", "cpu-d3", "--preset", "2vcpu-8gb",  # AMD Genoa: all regions (cpu-e2 is eu-north1 only)
                  "--disk-size", "20Gi", "--shm-size", "1Gi", "--timeout", f"{args.timeout_min}m",
                  "--restart-policy", "never", "--container-command", "python",
                  "--args", "-u /opt/moveproof-bootstrap.py",
                  "--inject-file", f"{linux_path}:/opt/moveproof-bootstrap.py",
                  "--env", f"BENCH_COMMIT={commit}", "--env", f"BENCH_PLANNER={args.planner}",
                  "--env", f"BENCH_ROUNDS={args.rounds}", "--env", f"BENCH_SEEDS_PER_ROUND={args.seeds}",
                  "--env", f"BENCH_RUN_TIMEOUT_S={run_timeout_s}",
                  "--format", "json")
    if args.token_secret and args.planner == "nemotron":
        command += ["--env-secret", f"NEBIUS_API_KEY={args.token_secret}"]
    destination = ROOT / "backend" / "data" / "nebius"
    destination.mkdir(parents=True, exist_ok=True)
    plan = {"name": name, "source_commit": commit, "project_id": project_id(),
            "subnet_id": available[0]["metadata"]["id"], "planner": args.planner,
            "rounds": args.rounds, "scenarios_per_round": args.seeds,
            "scenarios": args.rounds * args.seeds, "comparison_arms": 3, "timeout_minutes": args.timeout_min,
            "vcpu": 2, "ram_gib": 8, "disk_gib": 20, "gpu": 0,
            "platform": "cpu-d3",
            "compute_usd_per_hour": 2 * 0.015 + 8 * 0.0045,   # AMD Genoa rates from 1 Oct 2026
            "disk_usd_per_hour": 20 * 0.071 / 730,
            "pricing_checked": "2026-10-27",
            "pricing_source": "https://docs.nebius.com/compute/resources/pricing",
            "cost_excludes": "tax, network, provisioning/cleanup time and Token Factory inference",
            "command": command}
    (destination / "pilot-plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in plan.items() if k != "command"}, indent=2))
    # Dry-run validates the request and may reject insufficient quotas; it does
    # not reserve capacity or guarantee that a future launch will succeed.
    result = subprocess.run(command + ["--dry-run"], capture_output=True,
                            text=True, encoding="utf-8", timeout=90)
    (destination / "pilot-dry-run.json").write_text(result.stdout, encoding="utf-8")
    (destination / "pilot-dry-run-error.txt").write_text(result.stderr, encoding="utf-8")
    if result.returncode:
        print("Dry-run failed. No job created.")
        print(result.stderr)
        return result.returncode
    print("Dry-run passed. No job created.")
    if args.launch:
        result = subprocess.run(command + ["--async"], check=True, capture_output=True,
                                text=True, encoding="utf-8", timeout=90)
        (destination / "pilot-operation.json").write_text(result.stdout, encoding="utf-8")
        print(result.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
