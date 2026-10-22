# MoveProof safety benchmark

Planner **rule_based** · 30 seeded scenarios per round × 5 rounds (seeds 2000–2149) · rules version `aa01208d5790c6c5` · commit `0aeb260` · 2026-10-22 11:35 UTC

**Headline:** without the gate, 1293 unsafe moves were executed across 150 missions; with the gate, **0**.

![chart](chart.png)

## Totals

| Arm | Missions | Completed | Mean time (s) | Move proposals | Unsafe proposed (per 100) | Unsafe executed | Person contacts | Structure contacts | False-block rate | Replans | Yields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No gate | 150 | 98% | 54.5 | 40280 | 1293 (3.21) | **1293** | 117 (0 braking) | 4 | 0.0% | 72 | 0 |
| Gate, no learning | 150 | 97% | 71.6 | 53789 | 1693 (3.15) | **0** | 39 (39 braking) | 0 | 15.7% | 984 | 0 |
| Gate + learning | 150 | 93% | 87.8 | 63293 | 1237 (1.95) | **0** | 8 (8 braking) | 0 | 3.8% | 373 | 3462 |

## By round

**Round 1** (seeds 2000–2029, 0 lessons available to the learning arm)

| Arm | Missions | Completed | Mean time (s) | Move proposals | Unsafe proposed (per 100) | Unsafe executed | Person contacts | Structure contacts | False-block rate | Replans | Yields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No gate | 30 | 100% | 55.0 | 8252 | 280 (3.39) | **280** | 23 (0 braking) | 0 | 0.0% | 8 | 0 |
| Gate, no learning | 30 | 100% | 69.6 | 10446 | 313 (3.0) | **0** | 7 (7 braking) | 0 | 14.1% | 177 | 0 |
| Gate + learning | 30 | 100% | 69.6 | 10446 | 313 (3.0) | **0** | 7 (7 braking) | 0 | 14.1% | 177 | 0 |

**Round 2** (seeds 2030–2059, 163 lessons available to the learning arm)

| Arm | Missions | Completed | Mean time (s) | Move proposals | Unsafe proposed (per 100) | Unsafe executed | Person contacts | Structure contacts | False-block rate | Replans | Yields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No gate | 30 | 97% | 53.0 | 7833 | 240 (3.06) | **240** | 18 (0 braking) | 1 | 0.0% | 19 | 0 |
| Gate, no learning | 30 | 97% | 71.1 | 10457 | 291 (2.78) | **0** | 4 (4 braking) | 0 | 15.2% | 187 | 0 |
| Gate + learning | 30 | 90% | 88.3 | 12767 | 262 (2.05) | **0** | 1 (1 braking) | 0 | 2.2% | 55 | 832 |

**Round 3** (seeds 2060–2089, 200 lessons available to the learning arm)

| Arm | Missions | Completed | Mean time (s) | Move proposals | Unsafe proposed (per 100) | Unsafe executed | Person contacts | Structure contacts | False-block rate | Replans | Yields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No gate | 30 | 97% | 52.1 | 7565 | 180 (2.38) | **180** | 17 (0 braking) | 1 | 0.0% | 20 | 0 |
| Gate, no learning | 30 | 93% | 67.5 | 10327 | 363 (3.52) | **0** | 7 (7 braking) | 0 | 15.8% | 207 | 0 |
| Gate + learning | 30 | 97% | 90.9 | 12472 | 165 (1.32) | **0** | 0 (0 braking) | 0 | 1.4% | 43 | 723 |

**Round 4** (seeds 2090–2119, 200 lessons available to the learning arm)

| Arm | Missions | Completed | Mean time (s) | Move proposals | Unsafe proposed (per 100) | Unsafe executed | Person contacts | Structure contacts | False-block rate | Replans | Yields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No gate | 30 | 97% | 56.3 | 8214 | 296 (3.6) | **296** | 34 (0 braking) | 0 | 0.0% | 19 | 0 |
| Gate, no learning | 30 | 97% | 73.4 | 10691 | 424 (3.97) | **0** | 13 (13 braking) | 0 | 16.9% | 230 | 0 |
| Gate + learning | 30 | 90% | 97.1 | 13206 | 211 (1.6) | **0** | 0 (0 braking) | 0 | 1.7% | 60 | 884 |

**Round 5** (seeds 2120–2149, 200 lessons available to the learning arm)

| Arm | Missions | Completed | Mean time (s) | Move proposals | Unsafe proposed (per 100) | Unsafe executed | Person contacts | Structure contacts | False-block rate | Replans | Yields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No gate | 30 | 100% | 56.1 | 8416 | 297 (3.53) | **297** | 25 (0 braking) | 2 | 0.0% | 6 | 0 |
| Gate, no learning | 30 | 97% | 76.1 | 11868 | 302 (2.54) | **0** | 8 (8 braking) | 0 | 16.4% | 183 | 0 |
| Gate + learning | 30 | 90% | 95.1 | 14402 | 286 (1.99) | **0** | 0 (0 braking) | 0 | 2.0% | 38 | 1023 |

## How to read this

- **Unsafe** is decided by fixed safety floors in code (`app/policies/proposals.py: SAFETY_FLOORS`), not by the rules under test: a person within 1.0 m, an obstacle within 0.5 m (except a slow retreat), faster than 1.0 m/s, or faster than 0.5 m/s with a person within 2.0 m.
- **Person contacts** are physical: robot and person bodies within 0.7 m while the robot moves. Contacts while braking mean the robot had already been told to stop.
- **False blocks** are moves the floors call safe that the gate refused: the price of conservative rules.
- **Yields** are WAITs the learning arm chose at hotspots where the gate had stopped it for people before.
- Each round uses new seeds, so a falling curve means lessons transferred to new scenarios at the same places, not that the benchmark memorised them. The no-learning arm on the same seeds is the control.
