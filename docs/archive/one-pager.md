# MoveProof — Product Overview

## One-line

Runtime governance for autonomous robots: every action evaluated, every decision traceable, every violation blocked.

## Problem

Autonomous mobile robots (AMRs) in warehouses and factories operate without a compliance enforcement layer. Safety policies exist on paper, but nothing prevents the robot from executing dangerous actions in real time. When an incident occurs, logs tell you what happened — after the fact. Operators have no way to prove continuous compliance to regulators or insurers.

## Solution

MoveProof is middleware that intercepts every AI-generated action before execution, evaluates it against configurable safety policies, and produces cryptographically verifiable proof of every decision.

**It is not a robot brain. It is the robot's compliance officer.**

## How It Works

```
AI Planner → MoveProof evaluates → APPROVED / DENIED / ESCALATED → Execute or Block
                                          ↓
                             Hash-chained audit event stored
                             Governance receipt generated
                             Operator notified if needed
```

Every control cycle during a mission:
1. The NVIDIA Nemotron planner proposes an action (move, stop, wait)
2. The policy engine evaluates it against 11 safety policies
3. If approved, the action executes; if not, the robot is stopped, slowed or replanned
4. Full context (telemetry, proposal, decision, reasoning) is hash-chained to the audit trail and signed with Ed25519
5. The operator dashboard shows live state in a 2D floor plan or a 3D twin of the warehouse, with intervention controls

## Key Differentiators

| Feature | MoveProof | Traditional Monitoring |
|---|---|---|
| Enforcement timing | Before execution (preventive) | After execution (reactive) |
| Audit integrity | SHA-256 hash chain + Ed25519-signed receipts | Log files (mutable) |
| Outside information | Screened as untrusted; can only tighten rules | Not considered, or trusted as-is |
| Rule changes | Replayed, benchmarked, approved by a second person, reversible | Edited in config |
| Compliance mapping | ISO 42001, EU AI Act, NIST built-in | Manual report generation |
| Intervention controls | STOP / SLOW / REPLAN / ESCALATE | Alert + manual kill switch |
| Decision explainability | Per-action receipt with policy reasoning | Event summaries |

## Initial Wedge

**Warehouse robotics operators** deploying AMRs/AGVs who need to:
- Demonstrate safety compliance to enterprise customers during pilots
- Meet insurer requirements for autonomous equipment coverage
- Prepare for EU AI Act enforcement (2026) as high-risk AI operators

## Market Context

- EU AI Act classifies autonomous robotics as **high-risk AI** — mandatory risk management, human oversight, audit trails
- Warehouse robotics market: $6.1B (2024) → $14B+ (2030), 14% CAGR
- No existing product provides runtime governance (monitoring ≠ enforcement)

## Current State

- Working product: governance API, policy engine, operator dashboard, compliance reporting
- 11 safety policies with configurable parameters, changed only through a governed workflow
- NVIDIA Nemotron planner on Nebius Token Factory (fast tier per step, Ultra for planning and replanning) with a deterministic fallback
- SHA-256 hash-chained audit trail, Ed25519-signed decision receipts, compliance framework mapping
- Planner learns from the gate's own decisions; the rules never drift
- Hazard guidance from the web (Tavily) treated as untrusted: screened, corroborated by two sources, tighten-only
- Live warehouse simulator with workers, a forklift and on-demand hazards; 2D floor plan and 3D twin
- Safety benchmark, 150 seeded missions per arm: 1,262 unsafe moves executed without the gate, 0 with it
- Deployed on Vultr with auto-deploy CI/CD

## Team

**NOVTIA** — Othniel Obasi, Founder & CEO

## Contact

GitHub: [moveproof](https://github.com/othnielObasi/moveproof)
