# Veliai Glossary

**Status:** Shared vocabulary for Veliai / Gateway work.

This glossary keeps product names, runtime components, hardware lanes, and dataflow terms aligned.
When a code symbol and a product name differ, the code symbol remains authoritative for imports and
build wiring until a separate compatibility-safe rename is planned.

## Product and Program Names

| Term | Meaning |
|------|---------|
| **Veliai** | Preferred product/family name for the Amber brain/intelligence appliance and its cognitive subsystems. Use this in operator-facing and programme-level prose unless a lower-level name is required. |
| **Veliai Gateway** | Precise product name for the routed cognitive appliance formerly called Gemma Gateway/GG/AIGateway in many docs. It hosts the C++ edge, process manager, LLM worker lanes, Veliai Media, Guardian routes, memory/RAG, provider/offload routing, tools, and native intelligence surfaces. |
| **AIGateway** | Repository/path and historical command-repo name, especially `/opt/AIGateway`. Not the preferred product name for new prose. |
| **Gemma Gateway** | Legacy/descriptive alias for Veliai Gateway. Keep when referring to existing docs, URLs, service history, or compatibility. Prefer Veliai Gateway in new architecture language. |
| **GG** | Legacy implementation prefix used by binaries, APIs, env vars, and runtime components such as `gg-beast-edge` and `gg-process-manager`. |
| **Gemma** | Local model family/runtime identity only: Gemma 4 31B on the chat lane and Gemma 4 4B-class on the fast lane. Do not use `Gemma` to mean the whole routed appliance. |
| **Veliai Intelligence** | Product/architecture name for the native inference and reasoning layer. Current code still exposes key surfaces as `gemma_engine`. |
| **`gemma_engine`** | Current C++/pybind implementation symbol under `native/engine/`. Keep this name in code until an explicit import-safe rename is planned. |
| **Veliai Media** | Audio/video/NVR/perception subsystem hosted by `gg-beast-edge`: ingest, live views, motion, object/person/face/voice events, review, clips, retention, and training packs. |
| **Veliai-learning** | In-process learning/consolidation surface hosted by `gg-beast-edge`: nightly YOLO dataset export now, future memory repair, context gathering, validation, and promotion gates. |
| **Veliai_Manager** | Operator-visible load/supervision truth: lane state, worker status, hardware health, and central logging/control-plane surfaces. |
| **Guardian** | Policy/action layer that consumes intelligence, media, memory, and Amber Bus context to make safe decisions and eventually drive home/security actions. |
| **Amber Bus** | Cross-repo integration bus used for tool/control messages between Gateway, Guardian, Actorr, Home Assistant, VS Code/MCP, and other Veliai components. |
| **Epic 7** | Veliai Media / Frigate replacement program. |
| **Epic 8** | Selectable Ollama backend and Veliai Intelligence modernization, plus Veliai-learning enhancement. |
| **Epic 9** | Guardian realtime occupancy/action program: named people, voice confirmation, wake/trigger flow, Amber Bus control, and LLM tool use. |
| **Epic 10** | Beyond-Frigate media intelligence: richer reasoning over cameras/audio/events that Frigate does not attempt to unify with an LLM/Guardian system. |

## Runtime Components

| Term | Meaning |
|------|---------|
| **`gg-beast-edge`** | C++ Boost.Beast front door. Owns compat ports, Ops portal, Guardian routes, static UI serving, Veliai Media, and Veliai-learning. |
| **`gg-process-manager`** | C++ worker supervisor. Reads `deploy/model-registry.yaml`, spawns lane workers, writes `workers.json`, and exposes `/run/gg-pm.sock`. |
| **`llama-server` worker** | Per-lane inference process built from the local `vendor/llama.cpp` fork. |
| **EngineRunner** | Process-manager abstraction for selectable backend workers such as `llama_cpp` and future `ollama`. |
| **Ops portal** | Operator UI/API on `:11430`, including `/ui/ops`, `/api/v1/ops/*`, and `/api/gg/ops/*`. |
| **Compat listener** | Public OpenAI/Ollama-style entry port: `:11434` chat, `:11435` embeddings, `:11436` fast. |
| **Worker port** | Loopback lane port: `:21434` chat, `:21435` embeddings, `:21436` fast. |
| **Model registry** | `deploy/model-registry.yaml`, the live source of truth for profiles, device intent, model paths, mmproj pairing, and routing rules. |
| **`workers.json`** | `/opt/AIGateway/data/run/workers.json`, the live worker state written by `gg-process-manager`. |
| **central_log** | Shared structured logging path. Mutations should log under `veliai_manager.*`, for example `veliai_manager.media`. |

## LLM and Inference Lanes

| Term | Meaning |
|------|---------|
| **chat lane** | `:11434 -> :21434`, Gemma 4 31B on CUDA/RTX 3090. |
| **embed lane** | `:11435 -> :21435`, BGE-M3 embeddings on HIP/AMD 890M. |
| **fast lane** | `:11436 -> :21436`, small fast Gemma profile on HIP/AMD 890M. |
| **CUDA0 / RTX 3090** | Primary high-VRAM LLM device for chat/reasoning. |
| **HIP0 / AMD 890M** | AMD GPU lane for fast and embedding profiles, plus suitable video acceleration work when configured. |
| **AMD NPU / XDNA** | Local NPU target for supported verification/perception heads where available. |
| **Coral Edge TPU** | Low-power accelerator for quantized perception heads. Current hardware has two PCIe Edge TPUs. |
| **Hailo-8** | Incoming high-throughput vision accelerator; planned target for heavier future media perception once integrated. |
| **mmproj** | Multimodal projector model paired with a Gemma lane for vision/audio prefill. |
| **Ollama backend** | Future/selectable inference backend under Epic 8. It must remain Gateway-owned and fail closed when lane/device policy cannot be honored. |

## Media and Perception Terms

| Term | Meaning |
|------|---------|
| **Ingest fast path** | Camera/audio stream path optimized for live views: decode once, keep latest frame/packet state, and serve UI without waiting for inference. |
| **Birds-eye view** | Multi-camera live view built from the ingest fast path with optional overlay metadata. |
| **Motion gate** | Cheap downscaled frame-difference pass that decides whether heavier perception should sample a frame. |
| **Perception slow path** | Object/person/face/plate/voice analysis path. Accuracy matters more than rendering every frame. |
| **Object path** | Detection path for physical things: car, dog, bird, robot mower, delivery object, etc. YOLO is the canonical classifier. |
| **Person path** | Detection path for human bodies. A person can trigger face sampling, but the person label itself is not the identity. |
| **Face path** | Face detection/cropping path fed by person detections and optional still-frame sampling. A face crop can become training-grade evidence. |
| **Identity path** | Recognition path that links face and voice evidence to a stable person/profile used by Guardian/Gemma. |
| **Voice path** | Audio detection path for speech/wake/voice candidate events. |
| **Voice print path** | Speaker fingerprint path that confirms or rejects who is speaking. |
| **Plate path** | Vehicle plate candidate/OCR path. It should not override object identity unless explicitly verified. |
| **Static detection** | Tracking state for stationary eligible objects, mainly vehicles and other persistent objects. It should avoid repeated rediscovery without hiding real changes. |
| **Zone** | Operator-defined spatial area used to filter, name, or prioritize detections. |
| **Mask** | Operator-defined ignored area used to suppress known false positives such as reflective walls or moving plants. |
| **Training pack** | Operator-curated set of examples for a face, voice, object, or other class. |
| **Review item** | UI-visible event/candidate requiring operator decision: seen, false positive, train, export, mask, or reallocate. |
| **Evidence export** | Clip/snapshot/manifest bundle for a time window or event. |
| **Retention policy** | Rules that decide how long clips, snapshots, motion windows, review items, and continuous segments stay under `/Data/Veliai`. |

## Learning and Memory Terms

| Term | Meaning |
|------|---------|
| **YOLO correction** | Operator feedback that confirms or corrects an object class, for example “this is a dog”. |
| **YOLO dataset export** | Veliai-learning batch output under `/Data/Veliai/nvr/training/yolo/<dataset-id>/` with images, labels, `data.yaml`, classes, and manifest. |
| **Model promotion** | Replacing a live model with a trained candidate. This must remain gated by validation until automated gates are mature. |
| **RAG** | Retrieval augmented generation: pulling relevant context from memory/doc/vector stores into model prompts. |
| **Mem0** | Memory layer for user/profile/agent memory, where enabled by the wider Veliai stack. |
| **Qdrant** | Vector database target for semantic retrieval and profile/context search. |
| **Profile** | Stable identity/person/object/voice record that can link face samples, voice prints, memory, permissions, and Guardian policy. |
| **Context pack** | Validated bundle of relevant facts/evidence prepared for Guardian/Gemma decisions. |

## Cross-Repo Terms

| Term | Meaning |
|------|---------|
| **Actorr** | Sibling repo/component in the Amber Network. |
| **Guardian repo** | Sibling Guardian implementation and policy/action surfaces. |
| **Logger** | Shared logging/observability component in the Amber Network. |
| **Home Assistant** | Automation target/source for home state and device actions. |
| **MCP** | Model Context Protocol. In this workspace, planned/partial Amber Bus MCP surfaces connect tools such as VS Code into the Veliai bus. |
