# Gemini Robotics 1.5 API Integration

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
- `GET /governance/policies` - List active policies
- `WS /ws/{run_id}` - Real-time updates

### Gemini Planner
- `gemini_planner.py` - Calls Gemini Robotics-ER 1.5 API to generate ActionProposals
- `AgentRouter` in `agent_service.py` - Routes to Gemini or mock planner

### Dashboard
- Same UI works for mock AND Gemini
- Just receives standardized data format
