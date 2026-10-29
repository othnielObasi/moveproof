# Pitch (MVP)
Robots fail silently: you can have “green dashboards” and still be unsafe.

**MoveProof** adds:
- runtime policy enforcement: an NVIDIA Nemotron planner proposes, a deterministic gate of 11 policies decides, before the robot moves,
- chain-of-trust audit trails with Ed25519-signed receipts,
- replayable telemetry and seeded scenario replay,
- operator oversight triggers,
- outside information (web hazard guidance) treated as untrusted: it can only tighten rules.

Proof it works: on 150 seeded warehouse missions per arm, 1,262 unsafe moves executed without the gate and 0 with it.

Built simulation-first to integrate with any robotics stack.
