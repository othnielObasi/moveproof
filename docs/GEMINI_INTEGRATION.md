# Gemini Robotics 1.5 API Integration

> **Status (October 2026):** Gemini is now the **secondary** planner. When a Nebius key is
> set (`NEBIUS_API_KEY`, Nemotron enabled), the planner is NVIDIA Nemotron on Nebius Token
> Factory ([`nemotron_planner.py`](../backend/app/services/nemotron_planner.py)): fast models
> for per-step proposals, Nemotron Ultra for mission planning and replanning. Otherwise the
> Gemini planner runs, and with no Gemini key either it returns deterministic plans
> ([`llm_factory.py`](../backend/app/services/llm_factory.py)). The governance gate is the
> same whichever model plans. This page describes the original Gemini integration; the
> diagram's figures (for example the 0.70 risk threshold and "30% speed") are illustrative.
> The live gate escalates at risk ≥ 0.75 and caps speeds per policy.

## How It Works

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           OPERATOR COMMAND                                  │
│                   "Pick up package, deliver to zone B"                     │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         GEMINI ROBOTICS 1.5 API                            │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │  Scene Analysis  │───▶│  Action Planning │───▶│    Trajectory    │     │
│  │  (Camera/Lidar)  │    │  (AI Reasoning)  │    │   Generation     │     │
│  └──────────────────┘    └──────────────────┘    └────────┬─────────┘     │
└───────────────────────────────────────────────────────────┼────────────────┘
                                                            │
                              PLANNED ACTION                │
                              {                             │
                                action: "move",             │
                                trajectory: [{x,y,z}...],   │
                                target: "package_01"        │
                              }                             │
                                                            │
┌───────────────────────────────────────────────────────────▼────────────────┐
│                                                                             │
│   ██████╗  ██████╗ ██╗   ██╗███████╗██████╗ ███╗   ██╗ █████╗ ███╗   ██╗  │
│  ██╔════╝ ██╔═══██╗██║   ██║██╔════╝██╔══██╗████╗  ██║██╔══██╗████╗  ██║  │
│  ██║  ███╗██║   ██║██║   ██║█████╗  ██████╔╝██╔██╗ ██║███████║██╔██╗ ██║  │
│  ██║   ██║██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██║╚██╗██║██╔══██║██║╚██╗██║  │
│  ╚██████╔╝╚██████╔╝ ╚████╔╝ ███████╗██║  ██║██║ ╚████║██║  ██║██║ ╚████║  │
│   ╚═════╝  ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                      MOVEPROOF                         │  │
│   │                   THE GOVERNANCE LAYER (FastAPI)                    │  │
│   │                                                                     │  │
│   │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │  │
│   │  │   POLICY    │   │    RISK     │   │   AUDIT     │               │  │
│   │  │   ENGINE    │   │  SCORING    │   │   CHAIN     │               │  │
│   │  │             │   │             │   │             │               │  │
│   │  │ • human-    │   │ • 0.00-1.00 │   │ • SHA-256   │               │  │
│   │  │   presence  │   │ • threshold │   │ • tamper-   │               │  │
│   │  │ • speed-    │   │   = 0.70    │   │   proof     │               │  │
│   │  │   limit     │   │ • weighted  │   │ • ISO 42001 │               │  │
│   │  │ • collision │   │   scoring   │   │ • EU AI Act │               │  │
│   │  └─────────────┘   └─────────────┘   └─────────────┘               │  │
│   │                                                                     │  │
│   │                         DECISION                                    │  │
│   │         ┌──────────────────────────────────────────┐               │  │
│   │         │  ✓ SAFE    │  ⚡ SLOW   │  🛑 STOP  │  🔄 REPLAN │       │  │
│   │         │  Execute   │  30% speed │  Block    │  New path  │       │  │
│   │         └──────────────────────────────────────────┘               │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          │ GOVERNANCE DECISION
                                          │ {
                                          │   approved: true/false,
                                          │   action: "SAFE|SLOW|STOP|REPLAN",
                                          │   modified_trajectory: [...],
                                          │   audit_hash: "8f3a2b..."
                                          │ }
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
         ┌──────────────────┐                       ┌──────────────────┐
         │    APPROVED      │                       │    BLOCKED       │
         │                  │                       │                  │
         │  Robot executes  │                       │  Robot halts     │
         │  (possibly with  │                       │  Operator alert  │
         │  modified path)  │                       │  Incident logged │
         └──────────────────┘                       └──────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │  ROBOT / SIM     │
         │  Gazebo / Isaac  │
         │  Physical Robot  │
         └──────────────────┘


## Data Flow Example

### 1. Gemini Plans Action
```json
{
  "action_type": "move",
  "trajectory": [
    {"x": 10, "y": 20, "z": 0},
    {"x": 30, "y": 20, "z": 0},
    {"x": 50, "y": 40, "z": 0}
  ],
  "target_object": "package_01",
  "estimated_duration_ms": 5000
}
```

### 2. Scene Data (from sensors)
```json
{
  "robot_position": {"x": 10, "y": 20},
  "humans": [
    {"id": "h1", "x": 35, "y": 25, "velocity": 0.5}
  ],
  "obstacles": [],
  "battery": 87
}
```

### 3. Governance Evaluates
```json
{
  "approved": true,
  "action": "SLOW",
  "risk_score": 0.52,
  "violations": ["human-presence"],
  "modified_trajectory": null,
  "audit_hash": "8f3a2b1c9d4e..."
}
```

### 4. Robot Executes at 30% Speed


## Why This Matters

| Without Governance | With Governance |
|-------------------|-----------------|
| Gemini plans → Robot executes | Gemini plans → **WE CHECK** → Robot executes safely |
| No audit trail | Every decision logged with SHA-256 |
| Hope AI is right | Enforce safety policies |
| Compliance unknown | ISO 42001 / EU AI Act ready |
| Incidents after the fact | Prevent incidents before they happen |


## Integration Points

### Backend (FastAPI)
- `POST /governance/evaluate` - Evaluate any action
- `GET /policies` - List active policies
- `WS /ws/runs/{run_id}` - Real-time updates

### Planners
- `llm_factory.py` - Picks Nemotron when configured, otherwise Gemini
- `nemotron_planner.py` - NVIDIA Nemotron on Nebius Token Factory (primary)
- `gemini_planner.py` - Calls Gemini Robotics-ER 1.5 API to generate ActionProposals (secondary; deterministic plans without a key)
- `AgentRouter` in `agent_service.py` - Routes between planners

### Dashboard
- Same UI works for mock AND Gemini
- Just receives standardized data format
