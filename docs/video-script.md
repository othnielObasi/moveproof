# Demo video script (2 min 55 s)

For the Nebius × NVIDIA Global AI Hackathon, Physical AI track. The rules: 3 minutes or less, public YouTube, at least 1 minute of the key application modules in action (MoveProof has no physical robot), and show how Nebius Token Factory and NVIDIA Nemotron are used.

**Before recording**
- Use the live site: https://moveproof.213-239-186-67.sslip.io (Chrome, 1440×900 or larger, dark OS theme).
- Make sure no mission is running (Runs page). The demo robot is shared: one mission at a time, 4-minute limit.
- Have two tabs ready: the Overview, and Governance → *Test a move or plan*.
- Record at 1080p. Speak over the footage, or add the narration afterwards.

| Time | On screen | Narration |
|---|---|---|
| **0:00–0:15** | Overview hero. Slow scroll to the proof stats (400 → 0, 1,262 → 0). | "AI can now plan what a robot does next. But a model can be brilliant and still wrong, and in a warehouse, wrong means someone gets hurt. MoveProof makes sure every robot move is proven safe before it happens." |
| **0:15–0:35** | *How it works* cards, then the *Live system* panel showing the Nemotron models. | "An NVIDIA Nemotron planner, served on Nebius Token Factory, proposes. A deterministic gate of eleven policies decides. Only approved moves run, and every decision is signed and hash-chained. Nemotron 3 Ultra plans and replans, the fast Nemotron models handle per-step calls, and Nemotron 3.5 Super VL reads the robot's camera." |
| **0:35–0:55** | Click **Live warehouse**. Pick dock **B-03**, click **Start governed run**. The run page opens: the plan appears in the 3D warehouse. Open the **Learning & task** tab. | "I send the robot to dock B-03. Ultra plans the route. Before the robot moves, the task guard checks the plan ends at B-03 without wandering, and here are the lessons from earlier runs that Nemotron was given, and used." |
| **0:55–1:20** | Press **Too Close**. The gate decision turns red: DENIED, STOP. The robot halts. A replan appears in the Learning & task tab. | "A worker steps out in front of the robot. The gate denies the move and stops it, then Ultra replans around the worker. The replan goes through the same task check: still B-03, no detour." |
| **1:20–1:45** | Press **Spill**. Open **Site & vision**: the no-entry zone, the Tavily lookup, then the Vision check panel. Post the **Noticeboard bulletin**. | "A spill. It gets a no-entry zone at once. Tavily looks up handling guidance, but outside text is never trusted: a hazard is only enforced when two authoritative sources agree, and zones can only tighten. A planted notice telling robots to ignore the speed limits is quarantined. Meanwhile, the vision model checks what the camera sees against the sensors. It can only add caution." |
| **1:45–2:05** | Governance → **Test a move or plan** → *Wrong destination* → **Run the task guard**. Red dashed plan rejected, green aisle route to B-03. | "What if the model plans to the wrong place? The task guard rejects any plan that doesn't end at the mission's destination, or wanders, and the robot takes the aisle route to the right dock instead." |
| **2:05–2:35** | **Evidence** → the Nemotron benchmark card (Nebius Serverless Job badge, 400 → 0). Then *Receipts & chain*: click **Verify signature**. | "We measured it. On Nebius Serverless Jobs we ran seeded warehouse missions with Nemotron planning: without the gate, 400 unsafe moves executed, including moves into people. With the gate: zero. And with lessons from the gate, Nemotron proposed 37 percent fewer unsafe moves. Every decision has a signed receipt anyone can verify." |
| **2:35–2:55** | Back to the Overview *It learns, and it stays on task* section, then the footer / GitHub repo. | "MoveProof: Nemotron on Nebius Token Factory proposes, the gate decides, the robot stays on task and learns, and the proof is signed. Running on Nebius AI Cloud. The code is open source on GitHub." |

**A real catch for the 1:45 shot (optional):** open Runs → `run_4ead731ee738` → *Learning & task*. A live Nemotron replan was 28 m long when the aisle route was 5 m; the task guard rejected it and sent the robot the short way. You can use it alongside, or instead of, the planted example.

**Key-modules minute:** 0:35–1:45 is continuous live footage of the application modules (planning, the gate, replanning, hazards, Tavily screening, vision), which covers the 1-minute requirement for projects without hardware.

**If something goes wrong on camera**
- *"A mission is already running"*: open the link it gives, stop that run, start again.
- The 3D view is slow on your machine: switch to **Floor plan**; everything else is the same.
- Ultra is slow to plan (it can take 10–20 s): keep talking over the *Planning* step, or cut it in editing.
