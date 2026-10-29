# MoveProof

## A Real-Time Governance Layer for Autonomous Robotic Systems

**White Paper v1.1 — October 2026** (v1.0: March 2026)

**NOVTIA**

---

## Abstract

As autonomous robots transition from controlled laboratory environments into shared human workspaces — warehouses, hospitals, construction sites, and public infrastructure — the absence of enforceable runtime governance represents a critical safety gap. Current approaches rely on post-hoc log analysis, opaque neural-network decision-making, and operator trust in AI correctness. These are insufficient for safety-critical deployment and regulatory compliance under emerging frameworks such as the EU AI Act, ISO/IEC 42001:2023, and the NIST AI Risk Management Framework.

**MoveProof** introduces a real-time governance layer that interposes between AI-generated action proposals and physical robot execution. An NVIDIA Nemotron planner, served on Nebius Token Factory, proposes; a deterministic gate of 11 safety policies decides, in under 100 ms, before anything moves. Every decision is hash-chained and signed with Ed25519, producing audit trails suitable for regulatory submission. The system implements human-in-the-loop oversight triggers, cascading planner fallbacks, governed rule changes, untrusted handling of outside information, and compliance report generation aligned with three major international frameworks. On 150 seeded warehouse missions per arm, 1,262 unsafe moves executed without the gate and none with it.

This paper presents the architectural design, policy engine, chain-of-trust mechanism, AI integration strategy, evaluation and compliance framework of MoveProof.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [System Architecture](#3-system-architecture)
4. [The Governance Engine](#4-the-governance-engine)
5. [Chain-of-Trust Audit Trail](#5-chain-of-trust-audit-trail)
6. [AI Planning & Agentic Reasoning](#6-ai-planning--agentic-reasoning)
7. [Human-in-the-Loop Oversight](#7-human-in-the-loop-oversight)
8. [Regulatory Compliance](#8-regulatory-compliance)
9. [Simulation-First Architecture](#9-simulation-first-architecture)
10. [Operational Resilience](#10-operational-resilience)
11. [Deployment Model](#11-deployment-model)
12. [Future Directions](#12-future-directions)
13. [Conclusion](#13-conclusion)

---

## 1. Introduction

The global autonomous mobile robot (AMR) market is projected to exceed $20 billion by 2028, driven by adoption in logistics, manufacturing, healthcare, and last-mile delivery. As these systems scale from pilot programs to fleet-wide deployment in human-occupied environments, a fundamental question emerges: **who governs the robot's decisions at runtime, and how do we prove it?**

Traditional robotic safety relies on hardware interlocks, pre-computed safe operating envelopes, and human teleoperators. The introduction of large language models (LLMs) and vision-language-action models (VLAs) as robotic planners — exemplified by Google DeepMind's Gemini Robotics and similar foundation models — dramatically expands the action space while simultaneously reducing the predictability of robot behavior.

MoveProof addresses this gap by introducing **governance as computation**: a software layer that enforces safety policies, captures tamper-evident audit trails, and bridges the gap between AI autonomy and regulatory accountability.

### 1.1 Design Philosophy

MoveProof is guided by three core principles:

- **Govern, don't replace.** MoveProof does not replace the robot's perception or planning stack. It intercepts proposed actions, evaluates them against policy, and gates execution.
- **Prove, don't promise.** Every governance decision is cryptographically hashed and chained, producing an independently verifiable audit trail.
- **Degrade, don't fail.** When AI planners are unavailable, network connections drop, or perception confidence is low, the system falls back to progressively more conservative behaviors — never to unguarded execution.

---

## 2. Problem Statement

### 2.1 The Silent Failure Mode

Autonomous robots can exhibit "green dashboard" syndrome: all telemetry indicators report nominal while the robot performs actions that are unsafe in context. A robot operating at legal speed in an empty corridor is safe; the same speed in a corridor with a worker bending down to pick up a package is not. Current monitoring systems report *what the robot did*, not *whether it should have done it*.

### 2.2 The Accountability Gap

When an autonomous robot causes an incident, reconstruction typically depends on:

- Proprietary log formats from the robot vendor
- Post-hoc analysis by specialized engineers
- Incomplete or mutable audit trails

This is incompatible with the accountability requirements of the EU AI Act (Articles 9–15 for high-risk AI systems), which mandate risk management, data governance, transparency, human oversight, and robustness — all documented and auditable.

### 2.3 The LLM Planning Challenge

Foundation models used as robotic planners (e.g., Gemini Robotics-ER 1.5) introduce a new class of uncertainty. These models can generate creative, context-aware action plans, but they can also hallucinate waypoints outside operational boundaries, propose excessive speeds, or fail to account for dynamic obstacles. There is no intrinsic guarantee that an LLM-generated plan respects physical safety constraints.

### 2.4 Requirements

MoveProof was designed to satisfy the following requirements:

| Requirement | Description |
|---|---|
| **R1 — Runtime Enforcement** | Evaluate every action proposal before execution, with APPROVE / DENY / REVIEW outcomes |
| **R2 — Sub-100ms Latency** | Policy evaluation must not introduce perceptible control loop delay |
| **R3 — Tamper-Evident Logging** | Every decision must be cryptographically chained for independent verification |
| **R4 — Human Oversight** | Operators must be able to intervene on flagged decisions in real time |
| **R5 — Regulatory Alignment** | Audit outputs must map to EU AI Act, ISO 42001, and NIST AI RMF requirements |
| **R6 — Graceful Degradation** | System must remain safe when AI planners, databases, or network connections fail |
| **R7 — Simulator Agnostic** | Architecture must work with any simulator (Gazebo, Isaac Sim, custom) or physical robot |

---

## 3. System Architecture

MoveProof employs a **Sense-Think-Act-Audit** control loop architecture, extending the classical robotics Sense-Think-Act paradigm with a mandatory governance gate and audit chain.

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OPERATOR CONSOLE                            │
│                    (Next.js Dashboard)                              │
│   ┌─────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│   │  Live Map &  │  │  Chain-of-    │  │  Policy Management   │   │
│   │  Telemetry   │  │  Trust        │  │  & Compliance        │   │
│   │              │  │  Timeline     │  │  Reports             │   │
│   └──────┬───────┘  └──────┬────────┘  └──────────┬───────────┘   │
└──────────┼─────────────────┼──────────────────────┼───────────────┘
           │ WebSocket       │ REST                  │ REST
┌──────────▼─────────────────▼──────────────────────▼───────────────┐
│                     GOVERNANCE LAYER (FastAPI)                      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    RUN SERVICE (Orchestrator)                 │  │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │  │
│  │  │  SENSE  │→ │  THINK   │→ │  GOVERN   │→ │  ACT/AUDIT │  │  │
│  │  │  (Sim   │  │  (Agent  │  │  (Policy  │  │  (Execute  │  │  │
│  │  │  Adapt) │  │  Router) │  │  Engine)  │  │  + Chain)  │  │  │
│  │  └─────────┘  └──────────┘  └───────────┘  └────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │  Compliance  │  │  Operator    │  │  Telemetry &         │     │
│  │  Report Svc  │  │  Approval    │  │  Replay Service      │     │
│  └──────────────┘  └──────────────┘  └──────────────────────┘     │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTP + Auth Token
┌───────────────────────────────▼───────────────────────────────────┐
│                      ROBOT / SIMULATOR                             │
│      (Warehouse Sim  ·  Gazebo  ·  Isaac Sim  ·  Physical)        │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Overview

| Component | Technology | Responsibility |
|---|---|---|
| **Governance Layer** | Python / FastAPI | Policy evaluation, run orchestration, audit chain, compliance |
| **Operator Console** | Next.js 14 / React | Real-time visualization, policy management, compliance dashboards |
| **Simulator Adapter** | httpx AsyncClient | Abstraction layer isolating governance from simulator specifics |
| **Policy Engine** | Python (pluggable, OPA-ready) | Configurable weighted policy evaluation |
| **AI Planners** | NVIDIA Nemotron on Nebius Token Factory (fast tier + Ultra), Gemini (secondary), deterministic fallback | Action proposal generation |
| **Site Intelligence** | Tavily search behind a content firewall | Hazard guidance, treated as untrusted input |
| **Receipt Signing** | Ed25519 | Independently verifiable decision receipts |
| **Database** | PostgreSQL (prod) / SQLite (dev) | Persistent event store, mission/run records, audit log |
| **Observability** | Structured logs, per-model usage (`/llm/usage`), Grafana dashboard template | Metrics and alerting (OpenTelemetry planned) |

### 3.3 The Sense-Think-Act-Audit Loop

Each active run executes an asynchronous control loop at approximately 1 Hz (configurable):

1. **SENSE** — Poll telemetry from the simulator or robot via the `SimAdapter`. Capture position, heading, speed, zone classification, nearest obstacle distance, human detection confidence, and walking human positions.

2. **THINK** — Take the next waypoint of the approved mission plan (consumed when reached), or ask the planner for a proposal. Mission plans and replans come from Nemotron Ultra; per-step proposals from the fast tier; deterministic planning when no model is available. The planner produces an `ActionProposal` (intent: MOVE_TO / STOP / WAIT, with parameters).

3. **GOVERN** — The `GovernanceEngine` evaluates the proposal against all active policies. Output: `GovernanceDecision` with APPROVED / DENIED / NEEDS_REVIEW verdict, risk score (0.0–1.0), policy hits, and a policy state (SAFE / SLOW / STOP / REPLAN).

4. **ACT** — If approved, the command is sent to the robot. If denied, a STOP command is sent and recorded, so the robot never continues toward an earlier target.

5. **AUDIT** — Regardless of outcome, a chain-of-trust event is appended: the full context (telemetry + proposal + decision + execution result) is serialized, SHA-256 hashed with the previous event's hash, and persisted. The decision record is signed with Ed25519.

6. **BROADCAST** — The event is pushed to all connected WebSocket clients in real time.

---

## 4. The Governance Engine

### 4.1 Policy-as-Code Architecture

MoveProof implements policies as executable Python functions, evaluated deterministically against each action proposal. This approach provides:

- **Determinism**: Identical inputs always produce identical decisions (critical for audit reproducibility)
- **Sub-millisecond evaluation**: No network calls, no external dependencies
- **Testability**: Policies are unit-testable with standard pytest fixtures
- **Auditability**: Policy source code is the specification — no semantic gap between intent and implementation

The engine is designed as a pluggable facade, allowing future integration with Open Policy Agent (OPA) or hybrid policy systems without architectural changes.

### 4.2 Policy Catalog

| Policy ID | Name | Severity | Description |
|---|---|---|---|
| `GEOFENCE_01` | Geofence Enforcement | HIGH | Denies actions when the robot is outside or proposes movement outside the defined operational boundary |
| `SAFE_SPEED_01` | Zone Speed Limit | HIGH | Enforces maximum speed per zone type (aisle: 0.5 m/s, corridor: 0.7 m/s, loading bay: 0.4 m/s) |
| `HUMAN_CLEARANCE_02` | Human Proximity Slowdown | HIGH | Reduces permitted speed when a human is detected with sufficient confidence |
| `HUMAN_PROXIMITY_02` | Human Distance Enforcement | HIGH | Full stop when human is within 1.0m; speed reduction when within 3.0m |
| `OBSTACLE_CLEARANCE_03` | Obstacle Clearance | HIGH | Denies motion when obstacle clearance falls below 0.5m; triggers REPLAN state |
| `UNCERTAINTY_04` | Perception Uncertainty Gate | MEDIUM | Requires speed reduction and operator review when human detection confidence is below 0.65 |
| `HITL_05` | Human-in-the-Loop Trigger | HIGH | Escalates to operator review when aggregate risk score reaches 0.75 |
| `WORKER_PROXIMITY_06` | Walking Worker Detection | HIGH | Tracks moving human workers independently; applies distance-based STOP/SLOW zones |
| `PATH_CLEARANCE_07` | Path Clearance | HIGH | Denies a move whose straight path runs through permanent racking, so the robot replans along the aisles before it starts |
| `HAZARD_EXCLUSION_08` | Hazard Exclusion Zone | HIGH | Denies a move into or across a temporary no-entry zone round a hazard such as a spill; a robot already inside may only back out, slowly |
| `HAZARD_SLOW_09` | Hazard Slow Zone | MEDIUM | Caps speed near a hazard zone using reviewed per-hazard limits (0.1–0.3 m/s), never outside text |

Zone speed limits also cover the staging area (0.3 m/s). Thresholds such as these are changed only through the governed workflow in Section 4.5.

### 4.3 Risk Scoring

The governance engine computes a composite risk score in the range [0.0, 1.0] using a worst-case aggregation model. Each policy violation contributes a risk component:

$$R_{composite} = \max(r_1, r_2, \ldots, r_n)$$

Where each $r_i$ is a policy-specific risk value based on the magnitude of the violation (e.g., proximity to geofence boundary, ratio of proposed speed to zone limit, inverse of human distance).

Alongside the risk score, the policies that fire set the **policy state** — a discrete operational mode communicated to both the robot and the operator. Hard violations set STOP or REPLAN; soft ones set SLOW, which never overrides a harder state. The risk score drives escalation to an operator (Section 4.4).

| Policy State | Set by | Robot Behavior | Operator Signal |
|---|---|---|---|
| **SAFE** | No policy fired | Normal execution | Green |
| **SLOW** | Soft limits: speed near people, zone speed, hazard slow zones, low perception confidence | Speed reduced; heightened monitoring | Yellow |
| **STOP** | Geofence breach; a person within the stop radius | Immediate halt; await clearance | Red |
| **REPLAN** | Obstacle too close; path through racking; path into a hazard zone | Hold or back away slowly; request a new path | Blue |

### 4.4 Decision Outcomes

Each governance evaluation produces one of three outcomes:

- **APPROVED** — The proposal meets all policy requirements (possibly with speed modifications). Execution proceeds.
- **DENIED** — One or more HIGH-severity policies are violated. The robot holds position. The agent is informed and may replan.
- **NEEDS_REVIEW** — The risk score reaches the configurable threshold (default: 0.75), or three consecutive denials trip the circuit breaker. The proposal is queued for human operator approval. A hard denial relabelled NEEDS_REVIEW by the circuit breaker is never executed.

### 4.5 Governed Rule Changes

Policy thresholds are not edited in place. A change is a proposal that must pass, in order:

1. **Bounds** — hard limits in code refuse values outside safe ranges.
2. **Replay** — every recorded gate decision is re-judged under the candidate and the active rules; each move is labelled safe or unsafe by fixed safety floors that no proposal can change. The candidate fails if it would have allowed a single unsafe move. A relaxation also needs at least 50 recorded decisions.
3. **Benchmark** — for any relaxation, seeded scenarios are driven under both rule sets; any unsafe move executed, or the robot moving into a person, fails it.
4. **Approval** — by a named person who is not the proposer.
5. **Activation** — only between runs, and only if the rules have not changed since the proposal. Each activation is an append-only record, and every decision stores the rules version it was judged under. Rollback is available at any time.

---

## 5. Chain-of-Trust Audit Trail

### 5.1 Design Rationale

Regulatory frameworks (EU AI Act Article 12, ISO 42001 Clause 9) require that high-risk AI systems maintain logs that are "automatically generated" and "allow the tracing back of the system's operation." MoveProof's chain-of-trust mechanism provides this through a blockchain-inspired linked hash chain.

### 5.2 Event Structure

Each governance event contains:

```json
{
  "id": "evt-001",
  "run_id": "run-abc123",
  "timestamp": "2026-03-17T14:30:00.000Z",
  "type": "DECISION",
  "payload": {
    "telemetry": { "x": 12.5, "y": 8.3, "speed": 0.4, "human_detected": true },
    "proposal": { "intent": "MOVE_TO", "params": { "x": 15, "y": 7, "max_speed": 0.8 } },
    "governance": {
      "decision": "DENIED",
      "policy_hits": ["SAFE_SPEED_01", "HUMAN_CLEARANCE_02"],
      "risk_score": 0.85,
      "policy_state": "SLOW",
      "reasons": ["Speed too high for zone 'aisle': 0.80 > 0.50"]
    }
  },
  "hash": "a3f8c2d1e5b9...sha256",
  "prev_hash": "7b4e9f1a2c6d...sha256"
}
```

### 5.3 Hash Chain Construction

Each event's hash is computed over the canonical JSON serialization of its content concatenated with the previous event's hash:

$$H_n = \text{SHA-256}(\text{canonical}(E_n) \| H_{n-1})$$

Where $H_0 = \text{SHA-256}(\text{canonical}(E_0) \| \text{""})$ for the genesis event.

This construction ensures:

- **Tamper detection**: Modifying any event invalidates all subsequent hashes
- **Ordering proof**: The chain encodes a strict total order of events
- **Independent verification**: Any party with the event data can recompute and verify the chain without access to the MoveProof system

### 5.4 Chain Verification

The compliance service provides independent chain verification:

```python
def verify_chain(events: List[Event]) -> bool:
    for i, event in enumerate(events):
        expected_prev = events[i-1].hash if i > 0 else ""
        if event.prev_hash != expected_prev:
            return False
        recomputed = sha256(canonical(event) + expected_prev)
        if recomputed != event.hash:
            return False
    return True
```

This verification runs automatically during compliance report generation and is available on-demand via the API.

### 5.5 Signed Receipts

A hash chain proves that records were not altered after the fact by someone without the full chain; it does not prove who wrote them. Each governance decision is therefore also signed with Ed25519 over its canonical content: what was proposed, what the gate saw, the rules version and the outcome. Anyone with the deployment's public key (`GET /governance/signing-key`) can verify a receipt offline, or through `GET /governance/receipts/{run_id}/{id}/verify`.

---

## 6. AI Planning & Agentic Reasoning

### 6.1 Multi-Tier Planning Architecture

MoveProof routes each planning job to the model that suits it, with deterministic fallbacks underneath:

```
Mission planning, replanning after a denial:
    Nemotron 3 Ultra (reasoning tier, tried first, alone)
    ↓ fallback
    Fast tier
    ↓ fallback
    Deterministic aisle-following plan

Per-step proposals, scene / telemetry / failure analysis:
    Nemotron 3.5 Lightning and Nemotron 3 Super (fast tier, top two raced)
    ↓ fallback
    Deterministic Simple Agent (rule-based conservative proposal)
    ↓ fallback
    Local Fallback Planner (ultra-conservative single waypoint)

Secondary provider: Gemini (when no Nebius key is configured)
Optional: Agentic ReAct planner (multi-step reasoning with tool use)
```

Every tier produces the same `ActionProposal` interface, and **every proposal passes through the same governance gate** regardless of its origin. This is a critical design invariant: AI sophistication does not bypass safety enforcement.

### 6.2 Agentic ReAct Planner

The agentic planner implements a Reason-Act-Observe (ReAct) loop with structured tool use:

1. **Reason**: The agent receives telemetry, mission context, and denial history. It generates a chain-of-thought reasoning trace.
2. **Act**: The agent calls one of three tools:
   - `get_world_state` — Retrieve current environment state
   - `check_policy` — Pre-validate a proposal against governance policies
   - `submit_action` — Return a final action proposal
3. **Observe**: Tool results are fed back into the next reasoning step.

The agent is bounded: maximum 3 tool-call steps per attempt, maximum 2 replan attempts on governance denial. After exhausting replans, it defaults to a WAIT action with a recommendation for manual operator override.

A sliding-window memory (20 entries) of past proposals and outcomes enables adaptive behavior: the agent learns from recent denials and adjusts speed, route, and timing accordingly.

### 6.3 LLM Model Routing

The primary planner is NVIDIA Nemotron served on Nebius Token Factory's OpenAI-compatible API, in two tiers:

| Job | Tier | Default models | Why |
|---|---|---|---|
| Per-step proposals, scene / telemetry / failure analysis | Fast | Nemotron 3.5 Lightning, Nemotron 3 Super (top two raced) | Runs every control step, so latency and cost dominate |
| Mission planning, replanning after a denial | Reasoning | Nemotron 3 Ultra | Rare, high-stakes calls where reasoning quality matters |

Every model call is logged with its tier, model, latency and tokens (`GET /llm/usage`). Gemini (`gemini-robotics-er-1.5-preview` and Flash models, first valid response wins) remains as a secondary provider.

All model outputs undergo **geofence clamping** (coordinates constrained to operational boundaries), **speed limiting** (capped to zone maximums), **bay snapping** (fuzzy coordinates resolved to canonical bay positions from the world definition), and **rack repair** (legs that would cross racking are rerouted along the aisles).

### 6.4 Deterministic Fallback

When all LLM planners are unavailable (API key missing, rate-limited, network failure), the system seamlessly falls back to a deterministic `SimpleAgent` that:

- Proposes MOVE_TO toward the mission goal at 0.8 m/s
- Reduces to 0.4 m/s if the previous proposal was denied by governance
- Proposes WAIT if repeated denials indicate an unresolvable situation

This guarantees that **AI planner unavailability never results in unguarded robot execution**.

### 6.5 Learning From the Gate

The planner learns; the rules do not drift.

1. **Distil.** When a run ends, the gate's own decision records are folded into location-aware lessons: which policy denied moves, in which 2 m cell and zone, how often, across how many runs, and for location-bound rules the fastest speed the gate approved there.
2. **Retrieve.** Before a mission plan or a replan, lessons near the route are given to the planner as advisory context.
3. **Audit.** Every `PLAN` event records which lessons shaped it.

Lessons are written only from deterministic gate records, never from model output or web content, so neither a model nor a poisoned page can teach the planner. They change only what the planner proposes; the gate evaluates every move exactly as before. They are scoped to the policy version they were learned under.

### 6.6 Untrusted Site Intelligence

When a spill appears, MoveProof knows what was spilled from the warehouse system and asks Tavily for handling guidance from authoritative safety publishers. Outside text is never trusted:

1. **Baseline first** — every spill gets a 1.2 m no-entry zone at once, before any lookup.
2. **Firewall** — every result is screened for instructions aimed at the AI, attempts to relax a rule, permissions granted to robots, hidden text and encoded payloads; flagged items are quarantined and logged.
3. **No model in the loop** — fixed, reviewed rules read the accepted text. A hazard class is enforced only when two different authoritative sources report it.
4. **Tighten only** — each class maps to a reviewed, bounded zone; the strictest wins; a zone can grow but never shrink.
5. **Enforced by the gate** — `HAZARD_EXCLUSION_08` and `HAZARD_SLOW_09` read only zone geometry and limits, never the text. The planner receives sanitised notes in a fenced untrusted block; the gate receives none.

---

## 7. Human-in-the-Loop Oversight

### 7.1 Escalation Model

MoveProof implements a three-tier oversight model aligned with EU AI Act Article 14 (Human Oversight):

| Tier | Trigger | Operator Action |
|---|---|---|
| **Monitoring** | All events | Passive observation via real-time dashboard |
| **Review** | `NEEDS_REVIEW` decision (risk > 0.75) | Approve or revoke specific action proposals |
| **Intervention** | Operator discretion | Stop run, modify policies, override decisions |

### 7.2 Operator Approval Service

When governance issues a `NEEDS_REVIEW` decision, the proposal is held pending operator action. The operator sees:

- Full telemetry context (robot position, speed, nearby humans)
- The proposed action and its parameters
- All policy violations and risk scores
- The agent's reasoning chain (if agentic planner was used)

The operator can:

- **Approve**: Execution proceeds with the operator's identity recorded in the audit chain
- **Revoke**: The robot remains halted; the agent is notified to replan
- **Modify policies**: Adjust thresholds or disable policies for the current operational context

All operator decisions are immutably recorded in the chain-of-trust with the operator's identity, timestamp, and reasoning.

### 7.3 Real-Time Dashboard

The Next.js operator console provides:

- **Live warehouse view**, as a 2D floor plan or a 3D digital twin with the same data: robot, people, forklift, obstacles, hazard zones, geofence, zone overlays, proposed / approved / executed paths and risk cells; Overview, Follow and Robot-eye cameras in 3D
- **Chain-of-Trust Timeline** showing every governance decision with expandable details
- **Policy State Indicator** (SAFE / SLOW / STOP / REPLAN) with animated transitions
- **Agent Reasoning Panel** displaying LLM chain-of-thought with confidence scores
- **Compliance Report Export** for regulatory submission

All data streams via WebSocket with sub-second update latency.

---

## 8. Regulatory Compliance

### 8.1 Framework Alignment

MoveProof maps its governance capabilities to three major regulatory frameworks:

#### EU AI Act (High-Risk AI — Articles 9–15)

| Article | Requirement | MoveProof Implementation |
|---|---|---|
| Art. 9 | Risk Management System | Real-time risk scoring, policy catalog, configurable thresholds |
| Art. 10 | Data Governance | Structured telemetry storage, immutable audit log, hash-chain integrity |
| Art. 11 | Technical Documentation | Auto-generated compliance reports with framework mappings |
| Art. 12 | Record-Keeping | SHA-256 hash-chained event log, tamper-detection on read |
| Art. 13 | Transparency | Full reasoning chain capture, policy-hit explanations |
| Art. 14 | Human Oversight | Operator approval service, NEEDS_REVIEW escalation, real-time dashboard |
| Art. 15 | Accuracy & Robustness | Perception uncertainty gating, cascading planner fallbacks |

#### ISO/IEC 42001:2023 — AI Management System

| Clause | Requirement | MoveProof Implementation |
|---|---|---|
| Clause 6 | Planning / Risk Assessment | Continuous risk scoring with composite policy evaluation |
| Clause 7 | Support / Resources | Observability stack (OpenTelemetry, Grafana), structured logging |
| Clause 8 | Operation | Sense-Think-Act-Audit loop, governance-gated execution |
| Clause 9 | Performance Evaluation | Chain integrity verification, compliance report generation |
| Clause 10 | Improvement | Agentic memory (denial history), adaptive replanning |

#### NIST AI Risk Management Framework (AI RMF 1.0)

| Function | MoveProof Implementation |
|---|---|
| **GOVERN** | Policy-as-code engine, configurable risk thresholds, human-in-the-loop escalation |
| **MAP** | Telemetry capture, perception uncertainty tracking, zone classification |
| **MEASURE** | Real-time risk scoring, policy violation counts, chain integrity metrics |
| **MANAGE** | Governance decisions (APPROVE/DENY/REVIEW), operator overrides, compliance exports |

### 8.2 Compliance Report Generation

MoveProof generates structured compliance reports containing:

- Run metadata (mission, duration, total events)
- Aggregate metrics (approval rate, average risk score, policy hit frequency)
- Hash-chained audit entries with independent integrity verification
- Framework-specific compliance mapping
- Self-contained export bundle with summary hash for regulatory submission

Reports are generated on-demand via the API (`GET /compliance/report/{run_id}`) and can be exported as structured JSON suitable for submission to regulatory bodies.

---

## 9. Simulation-First Architecture

### 9.1 Design Philosophy

MoveProof is designed **simulation-first**: the governance layer is developed and validated against simulated environments before deployment to physical robots. This approach enables:

- **Rapid policy iteration**: Test new policies against recorded scenarios without physical risk
- **Deterministic reproduction**: Replay exact telemetry sequences for incident investigation
- **Scenario injection**: Programmatically create safety-critical situations (human approach, obstacle blockage, geofence breach) for systematic policy validation

### 9.2 Simulator Abstraction

The `SimAdapter` provides a clean abstraction between the governance layer and any simulator or physical robot:

```
SimAdapter Interface
├── get_telemetry() → TelemetryState
├── send_command(intent, params) → CommandResult
├── get_world() → WorldDefinition
└── post_scenario(name) → ScenarioResult
```

This adapter pattern allows MoveProof to work with:

- **Warehouse Simulator** (included, default) — the benchmark's deterministic engine run in real time
- **Mock Simulator** (included, legacy) — the original lightweight simulation
- **Gazebo** — ROS-based robotics simulator
- **NVIDIA Isaac Sim** — High-fidelity physically-accurate simulation
- **Physical Robots** — Direct hardware interface via the same API contract

### 9.3 Warehouse Simulator Capabilities

The included warehouse simulator shares its engine with the safety benchmark, so the live demonstration and the evaluation run in the same world:

- **Robot physics**: solid racks, edge-to-edge clearances, a robot that turns on the spot, fixed-rate physics from one seeded random source
- **Site activity**: workers moving between work destinations, people crossing at 13 hotspots, a forklift on the main corridor whose driver stops for the robot; pedestrians yield to vehicle traffic
- **Perception model**: people with distance and detection confidence (including occasional low-confidence detections), nearest obstacle ranging, zone classification, and a top-down camera frame for a vision model
- **Hazard injection**: a worker approaching or stepping out, a dropped pallet, a spill (with its substance from the warehouse system), a forklift crossing
- **Seeded replay**: any benchmark scenario can be loaded exactly, so a demonstration can show the case a result came from
- **World definition**: JSON-driven layout of a 40 × 25 m site with 4 zones, 9 rack sections and 20 bays

### 9.4 Safety Benchmark

The benchmark drives seeded warehouse missions through three arms on identical worlds: no gate, gate, and gate plus learning. A move is labelled unsafe by fixed safety floors in code, not by the rules under test; person contacts are measured physically (bodies within 0.7 m while the robot moves).

| | No gate | Gate | Gate + learning |
|---|---|---|---|
| Unsafe moves executed | 1,262 | **0** | **0** |
| Robot moved into a person | 117 | **0** | **0** |
| Robot hit a rack or obstacle | 4 | **0** | **0** |
| Safe moves wrongly blocked | – | 16.0% | 3.9% |
| Missions completed | 98% | 98% | 97% |

150 missions per arm (5 rounds × 30 fresh scenarios), rule-based planner. People still reached a robot that was already braking (38 times without learning, 9 with), which a 5 Hz check cannot prevent. A stress test with a planner that drives at 0.9 m/s everywhere executed 527 unsafe moves without the gate and none with it.

---

## 10. Operational Resilience

MoveProof is designed to maintain safety under degraded conditions. The system implements multiple resilience patterns:

### 10.1 Graceful Degradation Hierarchy

| Failure | System Response |
|---|---|
| Primary LLM unavailable | Cascade to next model in sequence |
| All LLMs unavailable | Fall back to deterministic planner |
| Database unreachable | Continue operation with in-memory state; retry with exponential backoff |
| Simulator disconnected | Robot holds position (fail-safe); operator alerted |
| Perception confidence low | Reduce speed; escalate to operator review |
| WebSocket disconnected | Events buffered; client auto-reconnects |

### 10.2 Run Recovery

On process restart or deployment, MoveProof automatically:

1. **Rehydrates in-memory plans** from persisted PLAN events in the database
2. **Detects orphaned runs** (status "running" with no active loop) and relaunches their control loops
3. **Verifies chain integrity** of existing event sequences

This ensures zero-downtime deployments with continuous governance enforcement.

### 10.3 Stagnation Detection

The control loop monitors position deltas across cycles. If the robot remains stationary for a configurable number of cycles without an explicit WAIT or STOP command, a `STAGNATION` alert is emitted and broadcast to operators, indicating a potential deadlock or hardware failure.

---

## 11. Deployment Model

### 11.1 Container Architecture

MoveProof is fully containerized using Docker Compose:

```yaml
Services:
  backend    — FastAPI governance layer (Python 3.11)
  frontend   — Next.js operator console (Node.js 20)
  sim        — Warehouse simulator (Python / FastAPI)
  postgres   — PostgreSQL 16
```

A Grafana dashboard template is included; an OpenTelemetry collector is planned.

### 11.2 Infrastructure Requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB | 50 GB (with telemetry retention) |
| Network | 10 Mbps | 100 Mbps |

### 11.3 Security

- **JWT authentication** with configurable expiration on all API endpoints (required by default in production)
- **Token-based simulator authentication** (shared secret via `X-Sim-Token` header)
- **Ed25519 receipt signing** with a deployment key (`RECEIPT_SIGNING_KEY`)
- **Rate limiting and security headers** (CSP, X-Frame-Options, HSTS in production)
- **CORS whitelisting** with configurable origin policies
- **Secret management** via environment variables (never committed to source control)
- **Database credentials** stored in protected environment files with restricted filesystem permissions

---

## 12. Future Directions

### 12.1 Near-Term Roadmap

- **NVIDIA vision-model perception**: perception from the robot camera, cross-checked by the gate against simulator ground truth
- **Benchmark at scale**: the safety benchmark on Nebius Serverless Jobs, with the Nemotron planner, measuring unsafe moves proposed against unsafe moves executed
- **NVIDIA Isaac Sim Integration**: physics-accurate simulation behind the same simulator contract
- **Open Policy Agent (OPA)**: Rego-based policy language for complex conditional logic and external data integration
- **Fleet Governance**: Multi-robot coordination with shared spatial policies and inter-robot safety zones
- **Incident Replay UI**: Visual timeline scrubbing with telemetry replay and counterfactual policy analysis

### 12.2 Research Directions

- **Formal Verification**: Integration with model checkers (TLA+, UPPAAL) for safety property proofs over policy compositions
- **Adaptive Policy Tuning**: Bayesian optimization of policy thresholds based on operational data, feeding the governed proposal workflow rather than changing rules directly
- **Federated Governance**: Cross-organization policy sharing with privacy-preserving compliance reporting
- **Real-Time Certification**: Continuous compliance monitoring with automated regulatory reporting pipelines

---

## 13. Conclusion

MoveProof demonstrates that **runtime governance for autonomous robots is both technically feasible and architecturally composable**. By interposing a policy evaluation layer between AI planning and physical execution, MoveProof provides:

1. **Safety enforcement** — Every action is policy-evaluated before execution, with sub-100ms latency; on 150 seeded missions per arm, no unsafe move executed with the gate, against 1,262 without it
2. **Cryptographic accountability** — SHA-256 hash-chained audit trails and Ed25519-signed receipts enable independent verification and tamper detection
3. **Regulatory readiness** — Native alignment with EU AI Act, ISO 42001, and NIST AI RMF through automated compliance reporting
4. **Human oversight** — Real-time operator dashboards with escalation triggers and approval workflows
5. **Operational resilience** — Cascading AI fallbacks, run recovery, and fail-safe defaults ensure continuous safe operation

As autonomous robots move from research labs to shared human environments, governance cannot remain an afterthought. MoveProof provides the architectural foundation for building autonomous systems that are not only intelligent but **accountable, auditable, and safe by design**.

---

## References

1. European Parliament. *Regulation (EU) 2024/1689 — Artificial Intelligence Act*. Official Journal of the European Union, 2024.
2. International Organization for Standardization. *ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system*. ISO, 2023.
3. National Institute of Standards and Technology. *AI Risk Management Framework (AI RMF 1.0)*. NIST AI 100-1, January 2023.
4. Google DeepMind. *Gemini Robotics: Bringing AI into the Physical World*. Technical Report, 2025.
5. Yao, S., et al. *ReAct: Synergizing Reasoning and Acting in Language Models*. ICLR, 2023.
6. Amodei, D., et al. *Concrete Problems in AI Safety*. arXiv:1606.06565, 2016.

---

## About NOVTIA

**NOVTIA** builds governance infrastructure for autonomous systems. The team brings over a decade of AI product management experience to the challenge of making autonomous robots safe, accountable, and regulation-ready.

---

*© 2026 NOVTIA. Licensed under the MIT License.*
*This white paper describes MoveProof as of October 2026.*
