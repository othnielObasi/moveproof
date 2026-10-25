# Submission Metadata

## Basic Information

- Project Title: MoveProof
- Short Description: Every robot move, proven safe before it happens. An NVIDIA Nemotron planner proposes, a deterministic governance gate decides, and every decision leaves a signed, hash-chained receipt.
- Long Description:
  MoveProof is a governance layer between a robot's AI planner and its actuators. NVIDIA Nemotron models on Nebius Token Factory plan (Nemotron Ultra for missions and replans, fast models per step); every proposed move passes a deterministic gate of 11 safety policies (geofence, zone speed, people and vehicles nearby, obstacle and racking clearance, perception confidence, hazard zones, operator escalation) before it can run, and every denial stops the robot. Each decision is SHA-256 hash-chained and Ed25519-signed. The planner learns from the gate's own records, never from model output; rule changes are replayed, benchmarked and approved by a second person; hazard guidance from the web (Tavily) is screened as untrusted and can only tighten zones. A live warehouse simulator with workers, a forklift and on-demand hazards drives a 2D floor plan and a 3D digital twin. On 150 seeded missions per arm, 1,262 unsafe moves executed without the gate and 0 with it. The stack is a FastAPI backend, a Next.js operator dashboard and the simulator, packaged for single-VM deployment (Vultr) or Fly.io + Vercel.
- Technology & Category Tags: Python, FastAPI, Next.js, three.js, Docker, Postgres, NVIDIA Nemotron, Nebius Token Factory, Tavily, Ed25519, GitHub Actions, Vultr, Physical AI, Robotics, AI Governance
- Final Submission Video Link (Twitter/X): https://twitter.com/yourhandle/status/REPLACE_WITH_VIDEO_ID

## Cover Image and Presentation

- Cover Image: deploy/cover.png (replace with the project's cover image)
- Video Presentation: deploy/presentation_video.mp4 (or Twitter/X link above)
- Slide Presentation: deploy/slides.pdf

## App Hosting & Code Repository

- Public GitHub Repository: https://github.com/othnielObasi/moveproof
- Demo Application Platform: Vultr single-VM (docker-compose), or local via Docker Compose
- Application URL: http://<VULTR_VM_IP_OR_HOSTNAME> (replace after provisioning)

## Packaging & Notes for Reviewers

- To create the submission archive (includes optional demo video):

```bash
scripts/package_submission.sh [path/to/moveproof_demo.mp4]
```

- To run locally for quick review:

```bash
git clone https://github.com/othnielObasi/moveproof.git
cd moveproof
docker compose up -d
# Frontend: http://localhost:3000/demo
# Backend: http://localhost:8080/docs
# For Nemotron: put NEBIUS_API_KEY, LLM_ENABLED=true, LLM_PROVIDER=nemotron in .env first
```

- To deploy on a Vultr VM (example):

```bash
# On the target VM
git clone https://github.com/othnielObasi/moveproof.git /opt/moveproof
cd /opt/moveproof
docker compose -f docker-compose.vultr.yml --env-file /etc/moveproof/.env up -d --build
```

## Checklist (for submission)

- [ ] Final submission video uploaded to Twitter/X and link inserted above
- [ ] Cover image added to `deploy/cover.png`
- [ ] Slide deck added to `deploy/slides.pdf`
- [ ] Demo video optionally added and packaged via `scripts/package_submission.sh`
- [ ] Application URL inserted above and verified

## Contact

- Maintainer: Othniel Obasi — https://github.com/othnielObasi
