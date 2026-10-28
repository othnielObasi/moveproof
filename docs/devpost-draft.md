# Devpost submission draft: MoveProof

> Draft for the Nebius × NVIDIA Global AI Hackathon. Edit freely before submitting. Track: **Physical AI**.

**Title:** MoveProof

**Tagline:** Every robot move, proven safe before it happens.

**Links**
- Live demo: https://moveproof.213-239-186-67.sslip.io
- Code (MIT): https://github.com/othnielObasi/moveproof
- Video: *(YouTube link)*

---

## Inspiration

AI is starting to plan what robots do next. Language and vision models can reason about a warehouse better than hand-written rules, but they can also be confidently wrong, and a wrong move next to a person is an injury, not a typo. Regulations such as the EU AI Act now treat autonomous robotics as high-risk AI and ask for runtime risk control, human oversight and tamper-evident records. We wanted a robot that gets the intelligence of a frontier model without trusting it.

## What it does

MoveProof sits between a robot's AI planner and its motors.

- **NVIDIA Nemotron proposes.** Nemotron 3 Ultra plans each mission and replans after a denial; Nemotron 3.5 Lightning and Nemotron 3 Super handle fast per-step calls; Nemotron 3.5 Super VL reads the robot's camera. All are served on **Nebius Token Factory**.
- **A deterministic gate decides.** Eleven policies (geofence, zone speed, people and vehicles, racking, hazard zones, perception confidence, operator escalation) judge every proposed move before it runs. Only approved moves execute; every denial stops the robot.
- **Every decision is proven.** Each decision is hash-chained and signed with Ed25519, with the rules version it was judged under, and anyone can verify a receipt.
- **It stays on task.** Every plan and replan must end at the mission's destination (taken from the mission record, never from the model) without wandering; otherwise the robot takes the aisle route to the same destination.
- **It learns without drifting.** The gate's own denials become location-aware lessons for the planner. Lessons change what Nemotron proposes, never what the gate allows, and only the gate's records can write them.
- **Outside input can only add caution.** Web hazard guidance (Tavily) passes a firewall and a two-source rule and can only tighten zones; a vision sighting the sensors can't confirm can only slow the robot.

You can try it live: plan a mission in a 3D warehouse, then drop in a spill, a worker stepping out or a forklift and watch the gate respond.

## How we built it

- **NVIDIA Nemotron on Nebius Token Factory**, through its OpenAI-compatible API, in tiers: Ultra for planning and replanning, Lightning and Super for fast calls, 3.5 Super VL for vision. Every call is logged with tier, latency and tokens.
- **Nebius AI Cloud:** the live demo runs on a Nebius VM (Docker Compose behind Caddy with automatic HTTPS). The safety benchmark runs as **Nebius Serverless Jobs**: the job fetches an exact public commit, runs seeded simulations and returns a checksummed results archive. The Token Factory key reaches the job from **MysteryBox**, never from a command line.
- **The gate and audit:** FastAPI, deterministic Python policies, SHA-256 hash chain, Ed25519 receipts, PostgreSQL.
- **The warehouse:** a seeded simulator with workers, a forklift, spills and dropped pallets, shared with the benchmark so the demo and the evaluation run in the same world; a three.js digital twin and a floor plan in Next.js.
- **Tavily** for hazard guidance, treated as untrusted input.

## Results

On Nebius Serverless Jobs, with Nemotron 3 Ultra planning (2 rounds × 10 seeded scenarios × 3 arms; 365 Ultra calls, all successful):

| | No gate | Gate | Gate + learning |
|---|---|---|---|
| Unsafe moves executed | 400 | **0** | **0** |
| Robot hit a rack or obstacle | 8 | **0** | **0** |
| Unsafe proposals per 100 moves (round 2) | 14.67 | 2.69 | **1.69** |

With a rule-based planner over 150 missions per arm: 1,262 unsafe moves executed without the gate, 0 with it. We also report the cost: with Nemotron, the gate blocks about a third of its moves and half of the missions run out of time, so efficiency is where a model planner still needs work.

## Challenges we ran into

- **Reasoning budgets.** Nemotron 3 Ultra thinks before it answers, and the thinking counts against `max_tokens`. On live replans it used up to about 4,000 tokens, so the JSON plan was cut off and silently fell back. We raised the budget and now log truncation.
- **Vision with thinking on returned nothing.** Nemotron 3.5 Super VL spent its whole budget reasoning about the image. Turning thinking off with `chat_template_kwargs: {"enable_thinking": false}` gave answers in about a second. Asking for positions in image coordinates, not metres, made them accurate to about 0.1–0.4 m.
- **An async client bug only the benchmark exposed.** The benchmark's per-call event loops broke a shared HTTP client after the first call, so most model calls fell back. Testing one scenario locally before the cloud run caught it.
- **Keeping the AI on task.** We found plans and replans were safety-checked move by move but never checked against the mission itself, so we added the task-drift guard.

## Accomplishments we're proud of

- Zero unsafe moves executed with a real frontier-model planner, measured on Nebius infrastructure.
- A design where no model, camera or web page can ever relax a safety rule.
- Everything is verifiable: signed receipts, a hash chain, and benchmark results tied to an exact commit and job.

## What we learned

Model outputs are most useful when they're treated as proposals with evidence attached. The deterministic parts (the gate, the task guard, the safety floors) are what let us use a powerful model confidently.

## What's next

Real robots through a ROS 2 bridge behind the same simulator interface, larger benchmark sweeps on Serverless Jobs, and lessons that help Nemotron plan efficiently as well as safely.

## What changed during the submission period

MoveProof builds on our earlier project, Sovereign Robotics Ops, which showed that a governance gate can stop an AI-planned robot move. During the submission period we: moved the planner to NVIDIA Nemotron on Nebius Token Factory with tiered routing; added the planner learning loop, governed rule changes, Ed25519 receipts, the task-drift guard, the safety benchmark, the live warehouse simulator and 3D digital twin, Tavily site intelligence and vision cross-checking with Nemotron 3.5 Super VL; ran the benchmark on Nebius Serverless Jobs; deployed on Nebius AI Cloud; and rebuilt the interface.

## Built with

NVIDIA Nemotron 3 Ultra · Nemotron 3 Super · Nemotron 3.5 Lightning · Nemotron 3.5 Super VL · Nebius Token Factory · Nebius AI Cloud · Nebius Serverless Jobs · Nebius MysteryBox · Python · FastAPI · PostgreSQL · Next.js · three.js · Tavily · Docker · Caddy

---

## Feedback on Nebius and NVIDIA tools

*(Based on what happened while building; edit to add your own view.)*

**Nebius Token Factory**
- The OpenAI-compatible API made it quick to put Nemotron behind our existing planner interface, and the catalogue had the whole family we needed, including a vision model.
- Reasoning tokens count against `max_tokens` with no warning other than `finish_reason: length`. Typical reasoning budgets per model, or a separate reasoning-budget parameter, would prevent silently truncated answers.
- For Nemotron 3.5 Super VL, only `chat_template_kwargs: {"enable_thinking": false}` turned thinking off; a `/no_think` system message and `reasoning_effort` did not. Documenting this on the model page would save time.

**Nebius AI Cloud and Serverless Jobs**
- Per-second billing and the dry-run were excellent: the dry-run caught a quota problem before anything was billed, and a 4½-minute pilot cost under a cent.
- When a platform isn't available in a project's region, the error is "Platform cpu-e2 was not found in project". Saying it isn't offered in this region, and listing the platforms that are, would make it obvious.
- `nebius ai job logs --tail` accepts at most 1,000 lines; larger values fail. A documented way to return job artifacts (or a simple output-bucket example) would help.
- The CLI's quota listing showed usage but not limits.
- The Ubuntu 24.04 image reports a newer release codename, which made Docker's official apt repository pick packages the image can't install; we pinned the noble repository.

**NVIDIA Nemotron**
- Nemotron 3 Ultra's replanning around blocked waypoints was the strongest part of the planner: all 365 benchmark calls produced usable plans once the token budget was right.
- Nemotron 3.5 Lightning is fast but also reasons, and hit a 2,048-token cap on planning prompts; the fast tier needs a larger budget than expected.
