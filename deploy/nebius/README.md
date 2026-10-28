# MoveProof on Nebius Serverless Jobs

This deployment runs the existing benchmark, not the interactive website. The
first job is a **rule-based infrastructure pilot**: one seeded scenario, each
executed ungoverned, governed and with learning enabled. It makes no model calls
and is not evidence of Nemotron performance. A one-round run also cannot measure
learning across rounds.

## Prerequisites

- Nebius CLI in Ubuntu/WSL, authenticated with access to the intended project.
- `NEBIUS_PROJECT_ID` in the repository root `.env`.
- A ready subnet, 1 available regular VM, **2 non-GPU vCPUs**, 1 network SSD
  disk and 20 GiB SSD capacity. Network allocations and logging quotas must also
  permit the job. Quota availability does not guarantee physical capacity.
- The source revision returned by `git rev-parse HEAD` must already be public
  in `othnielObasi/moveproof`. The bootstrap is injected from the local checkout;
  source is fetched by immutable commit SHA. No local `.env` is copied.

The CLI and profile used here live under Ubuntu's root user, as installed in
this workstation. The scripts call `wsl -d Ubuntu -u root -- nebius` explicitly.

## Prepare without launching

From the repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe deploy/nebius/prepare_benchmark.py
```

This reads available subnets, saves the plan in ignored
`backend/data/nebius/pilot-plan.json` and runs `nebius ai job create --dry-run`.
It creates no paid compute. The full error is saved alongside the plan if
validation fails. There must be exactly one ready subnet; the script fails
rather than guessing if there are multiple.

The prepared pilot uses `python:3.12-slim`, `cpu-d3 / 2vcpu-8gb` (AMD Genoa,
available in every region; `cpu-e2` exists only in eu-north1), a 20 GiB
disk, `restart-policy=never`, and a 20-minute job timeout. Dependency setup is
limited to 5 minutes; benchmark execution is limited to 10 minutes. Dependency
versions follow the repository's existing constraints; this is not a fully
locked dependency environment.

## Cost review (checked 27 October 2026)

Using the published AMD Genoa (`cpu-d3`) rates from 1 October 2026:

- 2 vCPUs × $0.015/hour + 8 GiB RAM × $0.0045/hour = **$0.066/hour**.
- 20 GiB network SSD × $0.071 per GiB per 730 hours = **$0.001945/hour**.
- At 20 minutes: approximately **$0.0227**, before tax, networking and any
  extra billable provisioning/cleanup time. This is an estimate, not a billing cap.
- No GPU or Token Factory charges for the rule-based pilot. No bucket is created.
- A later Nemotron run incurs separate Token Factory inference charges. Its
  cost must be assessed separately; 60 scenarios with three arms means 180 arm
  runs, each of which may make several model requests including fallbacks.

Pricing: https://docs.nebius.com/compute/resources/pricing
Serverless billing: https://docs.nebius.com/serverless/pricing-quotas

## Current validation blocker

On 27 October 2026 the API accepted authentication and found a ready subnet,
but rejected the dry-run with `QuotaFailure`:

```text
compute.instance.non-gpu.vcpu (limit 0, requested 2)
```

In **Administration → Limits → Quotas → Compute**, request a non-GPU vCPU
quota of at least **2** for eu-north1. Check the other prerequisite quotas too;
the first validation failure does not establish that all other quotas pass.
Quota requests need the appropriate admin role. No cloud pilot has run yet.

Quota instructions: https://docs.nebius.com/overview/quotas

## Launch after review and successful validation

```powershell
.\.venv\Scripts\python.exe deploy/nebius/prepare_benchmark.py --launch
```

This repeats validation and submits exactly one asynchronous paid job. The
operation response, including its resource ID, is saved in ignored
`backend/data/nebius/pilot-operation.json`. Do not rerun `--launch` to check
status: that would create another job. Use the returned resource ID:

```powershell
wsl -d Ubuntu -u root -- nebius ai job get JOB_ID
wsl -d Ubuntu -u root -- nebius ai job logs JOB_ID --tail 1000 --since 24h --timestamps=false > backend/data/nebius/pilot.log
.\.venv\Scripts\python.exe deploy/nebius/collect_artifacts.py backend/data/nebius/pilot.log --out backend/data/nebius/recovered
```

The bootstrap emits a checksummed archive in short log chunks. Recovery fails
on incomplete or corrupted logs and refuses to overwrite an existing report.
Only `results.json`, `README.md`, `chart.png` and a source provenance manifest
are included. Save them locally; log retention is not permanent artifact storage.
If the job times out, it may not have reached artifact emission; do not treat
partial logs as a completed benchmark.

## Nemotron follow-up

After the infrastructure pilot succeeds, reference an **existing MysteryBox
secret** containing the Token Factory API key. Do not put a raw key in command
arguments, job environment flags, source control, or the injected bootstrap.

```powershell
.\.venv\Scripts\python.exe deploy/nebius/prepare_benchmark.py --planner nemotron --token-secret SECRET_SELECTOR
```

This is still a dry-run, still one scenario, and still requires a separate
review before adding `--launch`. The service must be permitted to resolve the
secret. No secret is created or uploaded by these scripts. Check the manifest
and `model_usage` in the results before attributing outputs to Nemotron;
fallback behaviour is possible.

The full multi-round study should be configured only after the pilot provides
measured inference usage and timing. CPU simulation plus Token Factory model
inference avoids paying for an unused local GPU.
