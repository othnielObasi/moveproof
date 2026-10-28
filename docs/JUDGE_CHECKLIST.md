# Judge Checklist — MoveProof

Each item can be checked in the running app or with one API call. Replace `{run_id}` with a run from `GET /runs`.

- [ ] **Deployment**
  - Live demo on Nebius AI Cloud: https://moveproof.213-239-186-67.sslip.io (one shared robot; one mission at a time; settings read-only).
  - Frontend, backend and simulator reachable; API docs at `/docs`; `GET /health` reports database and simulator.

- [ ] **NVIDIA Nemotron on Nebius Token Factory**
  - `GET /llm/models` shows the provider and both tiers (fast: Nemotron 3.5 Lightning and Nemotron 3 Super; reasoning: Nemotron 3 Ultra).
  - `GET /llm/usage` shows per-model latency (p50/p95) and tokens by tier.
  - Each mission start produces a `PLAN` event with multi-waypoint plans and a `max_speed` per waypoint.
  - Without a key, a deterministic planner runs, still governed.

- [ ] **NVIDIA vision, cross-checked**
  - The run page's **Vision check** panel: Nemotron 3.5 Super VL reads the robot camera every 5 s; rings = sensors, dots = model.
  - `POST /perception/check` runs one now; each check during a run is a `PERCEPTION` event in the hash chain.
  - A hazard the model misses is logged as a fault (the gate keeps using sensors); a sighting the sensors don't confirm becomes a short slow zone and can never relax a rule.

- [ ] **Governance gate**
  - `GET /policies` lists 11 policies with parameters, triggers and actions.
  - Decisions are `DECISION` events with a `governance` payload and `risk_score`; executions are `EXECUTION` events in the same chain.
  - A denied move never executes, and every denial sends STOP to the robot.
  - Circuit breaker: 3 consecutive denials escalate to `NEEDS_REVIEW`.
  - `GET /governance/decisions/{run_id}` and `/stats` return the decision history and policy hit counts.

- [ ] **Signed receipts and audit**
  - `GET /governance/receipts/{run_id}` returns a receipt per decision.
  - `GET /governance/receipts/{run_id}/{decision_id}/verify` checks its Ed25519 signature; the public key is at `GET /governance/signing-key`.
  - `GET /compliance/verify/{run_id}` validates the hash chain.

- [ ] **Safety benchmark**
  - Results in [`backend/bench/results/rule_based`](../backend/bench/results/rule_based/README.md): 150 seeded missions per arm; unsafe moves executed 1,262 with no gate, 0 with the gate, 0 with gate + learning.
  - Reproduce: `cd backend && python -m bench run --planner rule_based --rounds 5 --seeds-per-round 30`.
  - Replay any benchmark case in the live simulator: `POST /sim/seed {"seed": N, "mode": "benchmark"}`.
  - With **Nemotron 3 Ultra** planning, run on **Nebius Serverless Jobs**: 824 unsafe moves proposed under the gate, 0 executed; 400 executed without it ([`backend/bench/results/nemotron`](../backend/bench/results/nemotron/README.md), runner in [`deploy/nebius`](../deploy/nebius/README.md)).

- [ ] **Adaptive learning (the planner learns from the gate)**
  - Overview → "It learns, and it stays on task": live counts of lessons learned and plans shaped by lessons.
  - Any run → **Learning & task** tab: the lessons Nemotron was given (marked "used by Nemotron"), every replan with the policy that caused it, and the lessons the run produced.
  - Governance → **Learning & task focus**: every lesson, with its policy, place and denial count. `GET /agent/lessons`.
  - Lessons come only from the gate's own decision records and never change the rules. Benchmark round 2: 2.69 → 1.69 unsafe proposals per 100 moves with lessons.

- [ ] **Task-drift control (every plan must still serve the mission)**
  - Every mission plan and replan is checked before use: ends within 1.5 m of the mission destination (from the mission record, never the model), stays inside the site, at most 2× the aisle route + 8 m.
  - A failing plan is replaced by the aisle route to the same destination; each check is a `TASK_CHECK` event in the hash chain.
  - Visible on the run page (**Learning & task** → Task focus), the Overview (plans checked, drift caught) and `GET /evidence/learning`.

- [ ] **Governed rule changes**
  - `GET /policies/active` shows rules in force, changeable thresholds with bounds, and fixed safety floors.
  - A proposal (`POST /policies/proposals`) must pass replay (`/evaluate`), and a benchmark for any relaxation, then approval by someone other than the proposer, before `/activate`. `POST /policies/rollback` undoes it.

- [ ] **Site intelligence (Tavily, untrusted)**
  - A spill gets a 1.2 m no-entry zone at once (`GET /site-intel/constraints`).
  - A hazard class is enforced only when two authoritative sources agree; zones only tighten.
  - The **Noticeboard bulletin** on the run page is quarantined and changes no rule (`POST /site-intel/screen` runs the same firewall on any text).

- [ ] **Live warehouse and hazards**
  - Run page hazard buttons: Human Near → SLOW; Too Close → STOP; Blocked → REPLAN; Spill → hazard zone; Forklift → robot holds or reroutes; Clear.
  - Same via API: `POST /sim/scenario` with `human_approach`, `human_too_close`, `path_blocked`, `spill`, `forklift_crossing` or `clear`.

- [ ] **UI**
  - Run page switches between **3D warehouse** and **Floor plan** with the same paths, safety rings, risk cells and trail.
  - 3D cameras: Overview, Follow and Robot eye; `/twin` shows the full-screen warehouse.
  - Hovering a planner waypoint highlights it on the map.
  - Pipeline stage is visible (Planning → Ready → Executing → Done).

- [ ] **Run lifecycle and intervention**
  - `POST /runs/{run_id}/pause` and `/resume` log `INTERVENTION` events.
  - `POST /operator/override` accepts `resume`, `force_approve` and `replan`, each logged as `OPERATOR_OVERRIDE:{ACTION}`.

- [ ] **Tests**
  - `cd backend && python -m pytest tests/ -q` — 221 tests.
  - `backend/tests/test_live_safety.py` proves denied moves stop the robot and nothing unapproved executes.
  - Browser smoke tests in `tests/` check the run page in both views without sending a single robot command.

- [ ] **Known limitations**
  - The live run loop checks about once a second; the benchmark engine at 5 Hz. People can still reach a robot that is already braking (counted separately in the benchmark).
  - Pause flags and the in-memory circuit-breaker cache reset on a backend restart.
  - With Nemotron planning, 40–50% of benchmark missions run out of time because the gate blocks about a third of its moves; safety is unaffected.
  - Vision reads a rendered top-down camera, not a real camera feed.
