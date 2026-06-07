# Amber Network Command Architecture - 2026-05-13

This is a **new versioned architecture note**. It does not replace or modify the existing image
drawings in `docs/architecture/`.

Original architecture drawings left untouched:

- `Amber Architecture.jpg`
- `Velia Architecture.jpg`
- `actorr-velox-architecture.png`
- `amber-bus-architecture.png`
- `gemma-guardian-memory-routes-architecture.png`
- `guardian-architecture.png`
- `home-assistant-guardian-edge-architecture.png`
- `signalscope-logger-architecture.png`
- `veliai-*-architecture.png`

Use this file for current repo topology and protocol updates. Use the original drawings for the
visual design language and previous architecture snapshots.

## Current Command View

High-level role model:

- **Amber Bus** is the nervous system and spine.
- **Gemma Gateway / AIGateway** is the head and brain: eyes, ears, memory, perception, and
  intelligence.
- **Guardian** is the arms and legs: where intelligence reaches the real world.
- **Actorr** is the entertainment system and pleasure zone: movies, TV, IPTV, VOD, and content.
- **Logger** is the auditor, feedback narrator, and emotional centre.
- **Home Assistant** is the senses and device fabric Guardian consumes.

```mermaid
flowchart LR
  Command["/opt/AIGateway\nCommand Repo\nAIGateway / Gemma Gateway\ncross-repo docs hub"]

  subgraph Mounts["/mnt sibling git roots"]
    Guardian["/mnt/guardian\nGuardian Server\npolicy, C2, tablets,\nguardian_core"]
    Bus["/mnt/amber-bus\nAmber Bus\ncatalog, graph, invoke,\nDEMand runtime"]
    Actorr["/mnt/actorr\nActorr\nmedia semantic actuator,\nVelox relay/transcode"]
    Logger["/mnt/logger\nSignalScope Logger\ncentral observability sink"]
    HA["/mnt/homeassistant\nHome Assistant instance config\ndevice manager, entity model,\nhouse telemetry feed"]
  end

  Command -->|"coordinates docs and contracts"| Guardian
  Command -->|"coordinates docs and contracts"| Bus
  Command -->|"coordinates docs and contracts"| Actorr
  Command -->|"coordinates docs and contracts"| Logger
  Command -->|"coordinates docs and contracts"| HA

  Guardian -->|"registers / consumes"| Bus
  Actorr -->|"registers / consumes"| Bus
  Logger -->|"registers ingest capability"| Bus
  Command -->|"AIGateway manifest / functions"| Bus

  Guardian -->|"structured logs"| Logger
  Actorr -->|"structured logs"| Logger
  HA -->|"HA telemetry/logs\nmostly via Guardian dependency"| Logger
  Command -->|"structured logs"| Logger
  Bus -->|"bus/runtime logs"| Logger
```

## Runtime Architecture With DEMand And Veliai-Vision

```mermaid
flowchart TB
  Operators["Operators / browsers / SDKs / tools"]

  subgraph Bus["Amber Bus"]
    Discovery[".well-known discovery\nHTTP bootstrap"]
    Catalogs["app, interface,\nfunctionality catalogs"]
    Invoke["invoke/control plane\nHTTP during migration"]
    Demand["DEMand runtime\nproduction native-client contract"]
    Graph["application graph\nonboarding artifacts"]
  end

  subgraph GG["AIGateway / Gemma Gateway"]
    Edge["gg-beast-edge\nC++ front door\nOps UI, Guardian routes,\nVeliai Media hosting"]
    Manager["Veliai_Manager\nmanager truth, model state,\nhardware status"]
    Process["gg-process-manager\nworker supervision"]
    Chat["chat lane\n:11434 CUDA / RTX 3090"]
    Embed["embed lane\n:11435 HIP / AMD"]
    Fast["fast lane\n:11436 HIP / AMD"]
    Memory["memory / retrieval\nQdrant, Mem0, Neo4j paths"]
    Media["Veliai Media / Veliai-Vision\ncamera/audio ingest, NVR,\nobject/person/face/voice,\nreview, clips, training packs"]
    Vision["vision / mmproj / NPU paths\nGemma vision, OpenCV,\nCoral/XDNA/Hailo planning"]
  end

  subgraph Apps["Amber applications"]
    Guardian["Guardian\nhome policy, C2,\nGuardian tablets"]
    HA["Home Assistant\nlive instance config,\nHA entities, devices,\nhouse telemetry"]
    Actorr["Actorr\nIPTV/VOD/EPG,\nVelox media relay"]
    Logger["SignalScope Logger\ncentral log correlation"]
  end

  Operators --> Edge
  Operators --> Discovery
  Discovery --> Catalogs --> Graph
  Catalogs --> Invoke
  Catalogs --> Demand

  Edge --> Manager
  Manager --> Process
  Process --> Chat
  Process --> Embed
  Process --> Fast
  Edge --> Memory
  Edge --> Media
  Media --> Vision

  Guardian -->|"AI/RAG/tool calls"| Edge
  Guardian -->|"bootstrap, desired state,\nupdate intent"| Demand
  HA -->|"device/entity state,\ntelemetry, HA-bound actions"| Guardian
  Actorr -->|"media intelligence edges"| Demand
  Logger -->|"logger.log.ingest"| Demand

  Guardian --> Logger
  HA -->|"telemetry/log feed"| Logger
  Actorr --> Logger
  Edge --> Logger
  Bus --> Logger
```

## What Changed Since The Older Drawings

- `/opt/AIGateway` is now documented as the **Command Repo** and coordination hub.
- The Command Repo is also the first step toward one agent workspace for the whole Amber Network:
  not a monorepo collapse, but a shared place to reason across repos and eventually harmonise
  structure and naming conventions.
- Sibling repos are explicitly mounted under `/mnt`, with separate git roots and separate rules.
- Guardian is documented as the shared control-plane dependency for most of the estate.
- Actorr is documented as the deliberate independent exception: present for future integration
  exploration and possible long-term structure/naming alignment, but not currently Guardian-shaped.
- Amber Bus production direction is **DEMand** for native-client runtime traffic. HTTP remains for
  discovery, bootstrap, artifacts, operator workflows, and migration edges.
- Veliai Media has become the bounded audio/video/NVR/perception subsystem hosted by `gg-beast-edge`.
- Veliai-Vision names the live vision/perception path inside Veliai Media: camera/audio ingest,
  NVR evidence, object/person/face/voice, review, clips, training packs, and vision acceleration.
- Guardian tablets are Guardian-managed devices. Their release APK is built in AIGateway but
  published through Guardian's `/mnt/guardian/src/www/guardian-tablet` manifest and fixed filenames.
- Home Assistant is documented as the live HA instance/config and telemetry/device boundary, not a
  peer application codebase like the other repos.
- Guardian was separated from HA months ago and now owns most automations, scripts, policy, C2, and
  control behavior that HA used to hold. Guardian has the clear direct dependency on HA for
  device/entity state and house telemetry.

## Do Not Edit Original Drawings In Place

When architecture changes again, create a new dated architecture file or a new image asset. Keep the
existing image files intact unless the user explicitly asks to replace a specific original.
