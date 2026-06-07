# Architecture Diagram Review - 2026-06-05

**Status:** Current review note.  
**Created:** 2026-06-05.  
**Owner:** Command Repo / AIGateway docs.  
**Scope:** `docs/architecture` Markdown diagram sources and image diagrams.  
**Supersedes:** None.  
**Superseded by:** None.

## Evidence Baseline

- `docs/README.md` identifies `architecture/gateway-monolith.md` as the canonical architecture doc.
- `docs/amber-network/documentation-authority-and-drift-control.md` classifies `gateway-monolith.md`
  as canonical and defines documentation authority states.
- `docs/architecture/amber-network-command-architecture-2026-05-13.md` says the original image
  drawings were intentionally left untouched and should be used as visual language and previous
  architecture snapshots.
- `docs/architecture/amber-network-command-architecture-v2-2026-05-15.md` is the latest
  multi-part diagram source pack and lists the v2 image filenames to generate later.
- `docs/architecture/life-evidence-memory-fabric-architecture-2026-06-05.md` is the newest
  operator-supplied architecture diagram capture in this folder.

## Current Diagram Sources

| File | Currentness | Why |
|---|---|---|
| `gateway-monolith.md` | Canonical Gateway architecture source | `docs/README.md` and the drift-control registry identify it as the Gateway monolith authority. |
| `amber-network-command-architecture-v2-2026-05-15.md` | Current Amber Network diagram source pack | It supersedes the older handoff shape for updated v2 image generation and adds the latest Command Repo, sibling-root, provider, and service-ownership source diagrams. |
| `veliai-system-map.md` | Current supporting system map | It remains a high-level Veliai module/dataflow map and is cited by repo-map/docs material. |
| `veliai-media.md` | Current supporting boundary diagram/text source | It is the normative Veliai Media boundary reference linked from `gateway-monolith.md`. |
| `veliai-learning.md` | Current supporting boundary source | It defines the mandated in-process learning/consolidation boundary. |
| `life-evidence-memory-fabric-architecture-2026-06-05.md` | Current captured diagram | It is the newest architecture capture and is explicitly marked as operator-supplied repo documentation. |

## Historical Or Reference Image Diagrams

These files are useful visual references and architecture snapshots, but they are not the latest
source of implementation truth when they conflict with the current Markdown sources above.

| Image | Currentness | Notes |
|---|---|---|
| `Amber Architecture.jpg` | Historical/reference | Original Amber visual snapshot from 2026-05-10. |
| `Velia Architecture.jpg` | Historical/reference | Original Velia visual snapshot from 2026-05-10. |
| `actorr-velox-architecture.png` | Historical/reference | Original subsystem image snapshot from 2026-05-11. |
| `amber-bus-architecture.png` | Historical/reference | Original subsystem image snapshot from 2026-05-11. |
| `gemma-guardian-memory-routes-architecture.png` | Historical/reference | Original memory-route image snapshot from 2026-05-11. |
| `guardian-architecture.png` | Historical/reference | Original Guardian image snapshot from 2026-05-11. |
| `home-assistant-guardian-edge-architecture.png` | Historical/reference | Original HA/Guardian edge image snapshot from 2026-05-11. |
| `signalscope-logger-architecture.png` | Historical/reference | Original Logger image snapshot from 2026-05-11. |
| `veliai-gemma-guardian-memory-architecture.png` | Historical/reference | Original memory architecture image snapshot from 2026-05-11. |
| `veliai-intelligence-architecture.png` | Historical/reference | Original Veliai Intelligence image snapshot from 2026-05-11. |
| `veliai-learning-architecture.png` | Historical/reference | Original Veliai-learning image snapshot from 2026-05-11. |
| `veliai-manager-control-plane-architecture.png` | Historical/reference | Original control-plane image snapshot from 2026-05-11. |
| `veliai-media-architecture.png` | Historical/reference | Original Veliai Media image snapshot from 2026-05-11. |

## Generated Current Images

The current Markdown Mermaid blocks were rendered into dated PNG assets under
`docs/architecture/generated/2026-06-05/`. Each generated image has a matching `.mmd` source and is
listed in `docs/architecture/generated/2026-06-05/manifest.json`.

| Generated image | Source |
|---|---|
| `generated/2026-06-05/amber-network-command-architecture-v2-2026-05-15.png` | `amber-network-command-architecture-v2-2026-05-15.md` |
| `generated/2026-06-05/amber-network-live-runtime-flow-v2-2026-05-15.png` | `amber-network-command-architecture-v2-2026-05-15.md` |
| `generated/2026-06-05/gateway-monolith-runtime-v2-2026-05-15.png` | `amber-network-command-architecture-v2-2026-05-15.md` |
| `generated/2026-06-05/ollama-cloud-model-catalog-v2-2026-05-15.png` | `amber-network-command-architecture-v2-2026-05-15.md` |
| `generated/2026-06-05/veliai-portfolio-system-map-v2-2026-05-15.png` | `amber-network-command-architecture-v2-2026-05-15.md` |
| `generated/2026-06-05/amber-network-optimisation-map-v2-2026-05-15.png` | `amber-network-command-architecture-v2-2026-05-15.md` |
| `generated/2026-06-05/amber-network-service-ownership-v2-2026-05-15.png` | `amber-network-command-architecture-v2-2026-05-15.md` |
| `generated/2026-06-05/gateway-monolith-current-2026-06-05.png` | `gateway-monolith.md` |
| `generated/2026-06-05/veliai-system-map-modules-2026-06-05.png` | `veliai-system-map.md` |
| `generated/2026-06-05/veliai-system-map-media-dataflow-2026-06-05.png` | `veliai-system-map.md` |
| `generated/2026-06-05/veliai-system-map-recognition-paths-2026-06-05.png` | `veliai-system-map.md` |
| `generated/2026-06-05/veliai-system-map-learning-loop-2026-06-05.png` | `veliai-system-map.md` |
| `generated/2026-06-05/life-evidence-memory-fabric-2026-06-05.png` | `life-evidence-memory-fabric-architecture-2026-06-05.md` |
| `generated/2026-06-05/amber-network-command-view-previous-2026-05-13.png` | `amber-network-command-architecture-2026-05-13.md` |
| `generated/2026-06-05/amber-network-runtime-demand-previous-2026-05-13.png` | `amber-network-command-architecture-2026-05-13.md` |

## Go / No-Go

Go for operator reading and navigation:

- Use the new static site at `docs/architecture/index.html`.
- Treat Markdown diagram sources as current authority.
- Treat existing image diagrams as historical/reference snapshots unless a newer generated v2 image
  is produced and reviewed.

No-go for implementation changes based only on the old image files:

- Do not infer current lane, owner, service, Bus, or deployment behavior from the original `.png` or
  `.jpg` diagrams when a current Markdown authority says otherwise.
- Do not overwrite original drawings in place; generate new dated assets.
