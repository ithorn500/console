# Amber Network Architecture Diagram Source Pack v2 - 2026-05-15

**Status:** Single-file, multi-part architecture diagram source pack.  
**Scope:** `/opt/AIGateway` plus Amber Network sibling roots under `/mnt`.  
**Do not overwrite note:** this v2 file is additive. The original `docs/architecture/*.md`,
`.png`, and `.jpg` files are intentionally left untouched.

Use this one file as the source prompt for GPT or another diagramming tool to create updated v2
architecture images. It is intentionally multi-part: each Mermaid block can become one diagram, or
the whole file can be used to generate a complete architecture pack.

Recommended generated output filenames, if images are created later:

- `amber-network-command-architecture-v2-2026-05-15.png`
- `gateway-monolith-runtime-v2-2026-05-15.png`
- `veliai-portfolio-system-map-v2-2026-05-15.png`
- `amber-network-service-ownership-v2-2026-05-15.png`
- `amber-network-optimisation-map-v2-2026-05-15.png`

## Diagram Generation Instructions

When creating images from this file:

- Preserve the existing repo boundaries. `/opt/AIGateway` is the Command Repo; `/mnt/*` entries are
  sibling git roots, not children of AIGateway.
- Show fixed local inference lanes exactly: `:11434` chat on CUDA/RTX 3090, `:11435` embed on
  HIP/AMD, `:11436` fast on HIP/AMD.
- Show `:11437` as Ollama Cloud only, owned by Gateway/Beast, with the seven approved aliases.
- Show Home Assistant as the live device/entity/config boundary consumed by Guardian.
- Show Guardian as the action/device authority.
- Show Amber Bus as the discovery/catalog/DEMand/native-dataplane spine.
- Show Logger as the central audit/observability sink.
- Show Actorr as the independent entertainment/media codebase, connected through integration edges
  rather than forced Guardian patterns.
- Do not draw a second Gateway engine, a local Ollama hardware takeover, or CPU fallback for GPU
  lanes.

## V2 Changes Captured

- `/opt/AIGateway` remains the Command Repo and live Gemma Gateway appliance.
- `:11437` is now the Gateway-owned Ollama Cloud lane with seven approved aliases:
  `gemma-4-31b-cloud`, `qwen3-coder-480b-cloud`, `gpt-oss-120b-cloud`,
  `qwen3-vl-235b-cloud`, `deepseek-v4-pro-cloud`, `devstral-small-24b-cloud`, and
  `kimi-k2-6-cloud`.
- `deploy/veliai-provider-registry.json` and the compiled Veliai router defaults now include the
  Ollama Cloud provider entries.
- The Ollama browser UI served on `:11437` can select and persist those models.
- Version 9 is the current Amber Network known-good baseline reference, with baseline artifacts
  under `docs/amber-network/baselines/version-9-amber-network-baseline-2026-05-15/`.
- `/mnt/guardian`, `/mnt/actorr`, `/mnt/logger`, and `/mnt/homeassistant` were observed clean in the
  current pass; `/mnt/amber-bus` still has catalog/feed/projection edits in flight.
- Home Assistant remains the live device/entity/config boundary that Guardian consumes, not a peer
  orchestration codebase.

## Command Repo And Sibling Roots

```mermaid
flowchart TB
  Command["/opt/AIGateway<br/>Command Repo<br/>Gemma Gateway appliance<br/>cross-repo docs and baseline authority"]

  subgraph Gateway["Gateway runtime owned in /opt/AIGateway"]
    Beast["gg-beast-edge<br/>C++ monolith front door"]
    PM["gg-process-manager<br/>local worker supervisor"]
    Registry["deploy/model-registry.yaml<br/>local lane/device truth"]
    ProviderRegistry["deploy/veliai-provider-registry.json<br/>provider/catalog truth"]
    Android["android/guardian-tablet<br/>Guardian tablet APK source"]
    Baseline["Version 9 baseline artifacts<br/>docs/amber-network/baselines/..."]
  end

  subgraph Mounts["/mnt sibling git roots, not a monorepo"]
    Guardian["/mnt/guardian<br/>Guardian Server<br/>policy, C2, devices, tablet artifacts"]
    Bus["/mnt/amber-bus<br/>Amber Bus<br/>discovery, catalogs, DEMand, native dataplane"]
    Actorr["/mnt/actorr<br/>Actorr<br/>entertainment, IPTV, VOD, Velox"]
    Logger["/mnt/logger<br/>SignalScope Logger<br/>observability and audit sink"]
    HA["/mnt/homeassistant<br/>Home Assistant live config<br/>device/entity telemetry boundary"]
  end

  Command --> Beast
  Command --> PM
  Command --> Registry
  Command --> ProviderRegistry
  Command --> Android
  Command --> Baseline

  Command -.->|coordinates docs, baselines, contracts| Guardian
  Command -.->|coordinates docs, baselines, contracts| Bus
  Command -.->|coordinates docs, baselines, contracts| Actorr
  Command -.->|coordinates docs, baselines, contracts| Logger
  Command -.->|coordinates docs, baselines, contracts| HA

  Android -->|"release APK only"| Guardian
  Guardian -->|"device/entity reads and HA-bound actions"| HA
  Guardian -->|"registers and consumes capabilities"| Bus
  Actorr -->|"future integration/catalog edges"| Bus
  Logger -->|"logger.log.ingest and fleet logs"| Bus
  Command -->|"Gateway manifest and route/catalog awareness"| Bus
```

## Live Runtime Flow

```mermaid
flowchart LR
  Operators["Operators, browsers, SDKs, Codex/App experiments"]
  VSCode["Future Veliai IDE / VSCode<br/>blocked behind Portfolio Epic 1 product APIs"]

  subgraph GG["Gemma Gateway on gemma"]
    Ops[":11430 Ops portal"]
    Chat[":11434 chat<br/>Gemma 4 31B on CUDA / RTX 3090"]
    Embed[":11435 embed<br/>BGE-M3 on HIP / AMD"]
    Fast[":11436 fast<br/>small fast GGUF on HIP / AMD"]
    Cloud[":11437 Ollama Cloud<br/>Gateway-owned browser UI and OpenAI-compatible API"]
    Router["Veliai_Manager / Veliai router<br/>Ops control-plane catalog and route decisions"]
    Media["Veliai Media / Veliai-Vision<br/>camera, NVR, review, training, perception"]
    Memory["memory and retrieval<br/>Qdrant, Mem0 paths, knowledge stores"]
  end

  subgraph CloudModels["Ollama Cloud aliases on :11437"]
    GemmaCloud["gemma-4-31b-cloud"]
    QwenCoder["qwen3-coder-480b-cloud"]
    GptOss["gpt-oss-120b-cloud"]
    QwenVL["qwen3-vl-235b-cloud"]
    DeepSeek["deepseek-v4-pro-cloud"]
    Devstral["devstral-small-24b-cloud"]
    Kimi["kimi-k2-6-cloud"]
  end

  subgraph Network["Amber Network services"]
    Guardian["Guardian<br/>action authority, tablets, C2"]
    Bus["Amber Bus<br/>DEMand, catalogs, native dataplane"]
    Actorr["Actorr<br/>media/entertainment domain"]
    Logger["Logger<br/>central audit sink"]
    HA["Home Assistant<br/>device and telemetry fabric"]
  end

  Operators --> Ops
  Operators --> Chat
  Operators --> Fast
  Operators --> Embed
  Operators --> Cloud
  VSCode -.->|future /api/veliai/* product APIs| Router

  Cloud --> GemmaCloud
  Cloud --> QwenCoder
  Cloud --> GptOss
  Cloud --> QwenVL
  Cloud --> DeepSeek
  Cloud --> Devstral
  Cloud --> Kimi

  Ops --> Router
  Router --> Chat
  Router --> Fast
  Router --> Embed
  Router --> Cloud
  Media --> Logger
  Memory --> Chat

  Guardian --> Chat
  Guardian --> Embed
  Guardian --> Bus
  Guardian --> Logger
  Guardian --> HA
  Actorr --> Bus
  Actorr --> Logger
  Bus --> Logger
  Router --> Logger
```

## Gateway Monolith Runtime v2

This part is the detailed Gateway diagram. It updates the older monolith view with the Ollama Cloud
lane and model catalog while preserving the monolith + inline supervisor truth.

```mermaid
flowchart TB
  subgraph Clients["Clients and operator surfaces"]
    OpenAI["OpenAI/Ollama-compatible clients<br/>curl, SDKs, Codex/App experiments"]
    LlamaUI["llama.cpp / Gateway UI<br/>browser SPA static JS/CSS"]
    OpsUI["Ops UI<br/>browser on :11430"]
    OllamaUI["Ollama browser UI<br/>served by Beast on :11437"]
    GuardianClients["Guardian server/tablets<br/>C2, policy, device workflows"]
  end

  subgraph Beast["gg-beast-edge<br/>C++ Boost.Beast monolith front door"]
    ChatCompat[":11434 chat compat<br/>X-AIGateway-Compat-Lane=chat"]
    EmbedCompat[":11435 embed compat<br/>X-AIGateway-Compat-Lane=embed"]
    FastCompat[":11436 fast compat<br/>X-AIGateway-Compat-Lane=fast"]
    CloudCompat[":11437 Ollama Cloud<br/>OpenAI-compatible API + Ollama UI shims"]
    OpsPortal[":11430 Ops portal<br/>/api/v1/ops/* and /api/gg/ops/*"]
    GuardianRoutes["/guardian/v1/*<br/>Guardian handler"]
    MediaRoutes["Veliai Media routes<br/>streams, review, training, NVR"]
    StaticRoutes["static UI handlers<br/>/ui/ops, /ui/llama, Ollama UI bundle"]
  end

  subgraph ProcessManager["gg-process-manager"]
    ModelRegistry["deploy/model-registry.yaml<br/>local model/device/mmproj truth"]
    Supervisor["worker supervisor<br/>spawn, health, restart"]
    WorkersJson["data/run/workers.json<br/>live local worker truth"]
    PmSocket["/run/gg-pm.sock<br/>control socket"]
  end

  subgraph LocalWorkers["Local llama.cpp workers"]
    ChatWorker[":21434 chat worker<br/>Gemma 4 31B<br/>CUDA0 / RTX 3090"]
    EmbedWorker[":21435 embed worker<br/>BGE-M3<br/>HIP0 / AMD lane"]
    FastWorker[":21436 fast worker<br/>small fast GGUF<br/>HIP0 / AMD lane"]
  end

  subgraph OllamaCloud["Inline-supervised Ollama Cloud path"]
    OllamaChild["repo-built Ollama child<br/>127.0.0.1:21437<br/>supervised by Beast"]
    CloudRegistry["Gateway cloud catalog<br/>seven aliases, remote models only"]
    CloudUIState["Ollama UI settings shim<br/>persists SelectedModel"]
  end

  subgraph NativeIntelligence["Native / experimental intelligence"]
    GemmaEngine["gemma_engine / ServerCore / Veliai_Manager<br/>native symbol, not a second gateway"]
    ProviderRegistry["deploy/veliai-provider-registry.json<br/>local + Ollama Cloud provider truth"]
    Router["veliai_router.hpp<br/>Ops route-decision control surface"]
  end

  OpenAI --> ChatCompat
  OpenAI --> EmbedCompat
  OpenAI --> FastCompat
  OpenAI --> CloudCompat
  LlamaUI --> StaticRoutes
  OpsUI --> OpsPortal
  OllamaUI --> CloudCompat
  GuardianClients --> GuardianRoutes

  ChatCompat --> ChatWorker
  EmbedCompat --> EmbedWorker
  FastCompat --> FastWorker
  CloudCompat --> OllamaChild
  CloudCompat --> CloudRegistry
  CloudCompat --> CloudUIState

  OpsPortal --> Router
  OpsPortal --> ProviderRegistry
  OpsPortal --> PmSocket
  GuardianRoutes --> ChatWorker
  GuardianRoutes --> EmbedWorker
  MediaRoutes --> StaticRoutes

  ModelRegistry --> Supervisor
  Supervisor --> ChatWorker
  Supervisor --> EmbedWorker
  Supervisor --> FastWorker
  Supervisor --> WorkersJson
  PmSocket --> Supervisor

  GemmaEngine -.->|native/experimental| ProviderRegistry
  Router --> ProviderRegistry
  Router --> WorkersJson
  ProviderRegistry --> CloudRegistry
```

### Ollama Cloud Model Catalog

```mermaid
flowchart TB
  Lane[":11437 Gateway-owned Ollama Cloud lane<br/>Beast public listener"]
  Internal["127.0.0.1:21437<br/>inline Ollama child"]
  UI["Ollama browser UI<br/>model picker and settings shim"]
  API["OpenAI-compatible API<br/>/v1/models, /v1/chat/completions, /v1/responses"]

  Lane --> UI
  Lane --> API
  API --> Internal
  UI --> SettingsPost["POST /api/v1/settings<br/>SelectedModel persists"]
  SettingsPost --> Lane

  subgraph Models["Approved remote aliases"]
    M1["gemma-4-31b-cloud<br/>gemma4:31b-cloud"]
    M2["qwen3-coder-480b-cloud<br/>qwen3-coder:480b-cloud"]
    M3["gpt-oss-120b-cloud<br/>gpt-oss:120b-cloud"]
    M4["qwen3-vl-235b-cloud<br/>qwen3-vl:235b-instruct-cloud"]
    M5["deepseek-v4-pro-cloud<br/>deepseek-v4-pro:cloud"]
    M6["devstral-small-24b-cloud<br/>devstral-small-2:24b-cloud"]
    M7["kimi-k2-6-cloud<br/>kimi-k2.6:cloud"]
  end

  Internal --> M1
  Internal --> M2
  Internal --> M3
  Internal --> M4
  Internal --> M5
  Internal --> M6
  Internal --> M7
```

## Veliai Portfolio System Map v2

This part maps the consolidated Portfolio Epic 1-6 model onto the current codebase and sibling
repos.

```mermaid
flowchart LR
  subgraph P1["Portfolio Epic 1<br/>Model Runtime and Router"]
    LocalLanes["Local llama.cpp lanes<br/>:11434 / :11435 / :11436"]
    OllamaCloud["Ollama Cloud lane<br/>:11437 seven aliases"]
    VeliaiRouter["Veliai router / provider registry<br/>Ops control plane now<br/>future /api/veliai/* product APIs"]
    CatalogTruth["One model catalog target<br/>local, Ollama Cloud, OpenAI, Gemini, future coding models"]
  end

  subgraph P2["Portfolio Epic 2<br/>Developer IDE"]
    VSCodeFuture["VSCode / IDE surface<br/>route visibility, repo context, patch workflow"]
    GitHubWorkflows["GitHub/dev workflows<br/>must consume Gateway APIs, not provider secrets directly"]
  end

  subgraph P3["Portfolio Epic 3<br/>Guardian Device and Ops"]
    Guardian["Guardian<br/>C2, policy, tablets, wallpanels, device truth"]
    Tablet["Android Guardian tablet<br/>built in /opt, released via /mnt/guardian"]
    HA["Home Assistant<br/>device/entity telemetry consumed by Guardian"]
  end

  subgraph P4["Portfolio Epic 4<br/>Perception and Security"]
    Media["Veliai Media<br/>camera/audio ingest, NVR, review, clips"]
    Vision["Veliai-Vision<br/>object, person, face, voice, training packs"]
    Security["Security workflow target<br/>evidence and action candidates"]
  end

  subgraph P5["Portfolio Epic 5<br/>Jarvis Presence"]
    Jarvis["Jarvis tablet head<br/>wake, voice, visual presence"]
    Head["Veliai Head runtime<br/>Filament/GLB/audio/morph validation"]
  end

  subgraph P6["Portfolio Epic 6<br/>Boundary Hygiene"]
    Boundary["Epic 18 boundary repair<br/>memory integrity and provenance"]
    BusFirst["Bus-first command surfaces<br/>Ops, reports, management panels"]
    DirectAudit["Non-Bus direct-surface audit<br/>HA, Guardian, Logger, Actorr, Gateway"]
    SupplierAdapters["Guardian-owned supplier migration<br/>HA integrations and BLE devices"]
  end

  subgraph Shared["Shared infrastructure"]
    AmberBus["Amber Bus<br/>DEMand and native dataplane"]
    Logger["Logger<br/>central log/audit sink"]
    Actorr["Actorr<br/>independent entertainment/media domain"]
  end

  LocalLanes --> VeliaiRouter
  OllamaCloud --> VeliaiRouter
  VeliaiRouter --> CatalogTruth
  CatalogTruth --> VSCodeFuture
  CatalogTruth --> GitHubWorkflows

  Guardian --> Tablet
  Guardian --> HA
  Guardian --> AmberBus
  Guardian --> Logger

  Media --> Vision
  Vision --> Security
  Security --> Guardian
  Media --> Logger
  Media --> AmberBus

  Jarvis --> Tablet
  Head --> Jarvis
  Tablet --> Guardian

  Boundary --> AmberBus
  BusFirst --> AmberBus
  DirectAudit --> Boundary
  SupplierAdapters --> Guardian
  HA --> DirectAudit
  Guardian --> DirectAudit

  Actorr --> AmberBus
  Actorr --> Logger
  AmberBus --> Logger
```

## Optimisation And Non-Regression Map v2

This part turns the optimisation prerequisite into a diagram. It should be drawn as a throughput
and payload-efficiency map, not a feature-removal map.

```mermaid
flowchart TB
  Contract["Non-regression contract<br/>preserve functionality and performance<br/>remove wasted work only"]

  subgraph Hotspots["Observed high-churn paths"]
    MediaPayloads["Veliai Media UI/status<br/>large refreshes, inline thumbnails, frequent polls"]
    TabletSync["Guardian tablet sync<br/>multiple sequential fetches"]
    GuardianWrites["Guardian tablet manager writes<br/>full public-doc rewrites"]
    CentralLog["Gateway central_log<br/>request-path rotations and full reads"]
    BusRetention["Amber Bus native dataplane<br/>queue retention scans and traffic logs"]
    CatalogSpine["Portfolio Epic 1 catalog<br/>one shared model/router API target"]
  end

  subgraph AdditiveFixes["Additive optimisation slices"]
    SummaryDelta["summary/delta APIs<br/>detail endpoints stay"]
    BundledSync["guardian.tablet.sync.fetch<br/>old function IDs remain"]
    DebouncedWrites["dirty-bit + debounce writes<br/>atomic grouped publish"]
    AsyncLog["append-only JSONL + async spooler<br/>batched Bus shipping"]
    IndexedRetention["topic retention indexes<br/>traffic-log rotation"]
    ProductAPIs["stable /api/veliai/* product APIs<br/>models, route-plan, chat, context, metrics"]
  end

  subgraph Measurements["Required evidence"]
    Payload["payload size"]
    Latency["latency and UI render cost"]
    CPU["CPU, memory, and filesystem churn"]
    Queue["queue depth, drops, write rate"]
    Lane["GPU lane use and route/provider behavior"]
  end

  Contract --> MediaPayloads
  Contract --> TabletSync
  Contract --> GuardianWrites
  Contract --> CentralLog
  Contract --> BusRetention
  Contract --> CatalogSpine

  MediaPayloads --> SummaryDelta
  TabletSync --> BundledSync
  GuardianWrites --> DebouncedWrites
  CentralLog --> AsyncLog
  BusRetention --> IndexedRetention
  CatalogSpine --> ProductAPIs

  SummaryDelta --> Payload
  BundledSync --> Latency
  DebouncedWrites --> CPU
  AsyncLog --> Queue
  IndexedRetention --> Queue
  ProductAPIs --> Lane
```

## Remote Service Ownership

The `/mnt/*` checkouts are source/config mirrors. Live operations belong on the owning hosts.

```mermaid
flowchart TB
  subgraph Source["Local mounted source/config roots"]
    GSrc["/mnt/guardian"]
    BSrc["/mnt/amber-bus"]
    LSrc["/mnt/logger"]
    ASrc["/mnt/actorr"]
    HASrc["/mnt/homeassistant"]
  end

  subgraph Hosts["Owning runtime hosts"]
    GHost["guardian.amber.com<br/>/opt/guardian<br/>guardian-apps, guardian-trigger, guardian-c2"]
    BHost["amber-bus.amber.com<br/>/opt/amber-bus<br/>amber-bus-fastio, amber-bus, native, portal, log-forwarder"]
    LHost["logger.amber.com<br/>/opt/logger<br/>logger or logger-native, db-health timer"]
    AHost["actorr.amber.com<br/>/opt/actorr<br/>actorr, catalogd, epgd, veiloxd, veloxd, transcoders"]
    HAHost["homeassistant.local<br/>/home/hassist/homeassistant<br/>Home Assistant container or HA core"]
  end

  GSrc -.->|deploy/restart remotely| GHost
  BSrc -.->|deploy/restart remotely| BHost
  LSrc -.->|deploy/restart remotely| LHost
  ASrc -.->|deploy/restart remotely| AHost
  HASrc -.->|reload/restart HA-bound services only| HAHost
```

## Current Repo State Observed For This V2 Pass

| Root | Branch | Latest observed commit | Current status summary |
| --- | --- | --- | --- |
| `/opt/AIGateway` | `main` | `d285d93 Persist Ollama Cloud UI model selection` | clean before this v2 doc pass |
| `/mnt/guardian` | `develop` | `999ef238 test: align Guardian tool bridge catalog baseline` | clean |
| `/mnt/amber-bus` | `main` | `df89a6c fix: align Guardian bus capability snapshot` | 13 modified catalog/feed/projection files |
| `/mnt/actorr` | `main` | `83a12c2 chore: ignore local Actorr media payloads` | clean |
| `/mnt/logger` | `main` | `fe0954d baseline: clean Logger Version 9 source state` | clean |
| `/mnt/homeassistant` | `develop` | `bbceaa7a custom_components/places/json_sensors/...` | clean |

## V2 Boundary Rules

- AIGateway is the command cockpit and main appliance, not a monorepo containing `/mnt`.
- Guardian is the action and device authority. Home Assistant supplies device/entity state.
- Actorr stays the independent exception until an explicit integration task says otherwise.
- Amber Bus is the runtime spine; DEMand/native dataplane is the production direction for heavy
  runtime paths.
- Logger remains the central audit sink.
- Cloud models on `:11437` are remote provider capacity. They do not change local lane mapping and
  must not receive private/security context unless that context is sanitized and approved.
