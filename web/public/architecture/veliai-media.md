# Veliai Media — Audio/Video/NVR Boundary

**Status:** Architectural boundary for Epic 7 and F-152 follow-on work.  
**Purpose:** Keep the surveillance/audio/video/NVR subsystem cleanly separated from inference
serving, model loading, and lane scheduling while still running inside the existing monolith.

Veliai Media is the product subsystem for camera/audio ingest, perception evidence, NVR events,
recording, review, zones, masks, and operator training packs. It is not a second gateway engine and
not a sidecar. It is a bounded native subsystem hosted by `gg-beast-edge`.

---

## 1. Naming

Use **Veliai Media** for the audio/video/surveillance subsystem.

Avoid overloading:

- **Veliai Intelligence** — native LLM/inference/reasoning surfaces in `native/engine` /
  `gemma_engine`; the current code symbol remains `gemma_engine` until an explicit compatibility-safe
  rename is planned.
- **Veliai_Manager** — load authority, supervision, worker/lane state, and ops-visible native truth.
- **gg-beast-edge** — the C++ front door: compat listeners, Ops portal, Guardian routes, static UI,
  and host process for native control-plane modules.
- **Veliai Media** — camera/audio/NVR/perception subsystem hosted by Beast, with explicit manager and
  hardware touchpoints.

---

## 2. Target Code Shape

Current reality: much of F-148/F-152 lives in `native/gg_beast_edge/perception_identity.hpp`.

Epic 7 target:

```text
native/veliai_media/
  media_types.hpp              shared media/NVR structs and JSON helpers
  media_config.hpp             env/config paths and policy defaults
  media_store.hpp/.cpp         event/review/track/training stores
  media_ingest.hpp/.cpp        RTSP/audio/video ingest workers
  media_motion.hpp/.cpp        motion maps, masks, detection regions
  media_tracking.hpp/.cpp      tracks, stationary state, best-frame scoring
  media_zones.hpp/.cpp         zones, masks, loitering, filters
  media_identity.hpp/.cpp      face/voice/object training pack bridge
  media_recording.hpp/.cpp     segments, clips, snapshots, retention
  media_mqtt.hpp/.cpp          MQTT/Home Assistant publishing
  media_api.hpp/.cpp           Ops/Guardian-facing API handlers
  media_status.hpp/.cpp        status JSON and health surfaces
```

`gg-beast-edge` should host and route to this subsystem, not absorb its internals indefinitely.

---

## 3. Allowed Dependencies

Veliai Media may depend on:

- `central_log.hpp` for `veliai_manager.*` logging.
- Beast HTTP request/response types only at the API boundary.
- Veliai_Manager / process-manager status as read-only operational truth.
- approved local hardware interfaces:
  - Coral TPU for supported quantized perception heads
  - AMD NPU for supported audio/voice/perception heads
  - OpenCV/libav/Vosk/openWakeWord vendor code for media processing
- Guardian route/client surfaces for final policy/actuation handoff.
- shared config helpers and JSON escaping utilities already used by `gg-beast-edge`.

Veliai Media must not depend on:

- `native/engine` decode internals
- `llama-server` worker request paths
- chat/embed/fast lane queues for media compute
- model-registry mutation/load behavior
- CUDA/3090 or HIP fast/embed lanes unless an exact future ticket explicitly authorizes it

---

## 4. Boundary Rules

1. **Inference lanes stay clean.** Media code must not call chat/embed/fast compat paths for hot-path
   detection, tracking, recording, or media storage.
2. **No hidden model loading.** Media model packs report status and request explicit operator action;
   they do not mutate the LLM model registry or worker startup params.
3. **No Python production hot path.** Python may exist as import/dev tooling only. Production ingest,
   detection, tracking, and event formation are native.
4. **Hardware access is explicit.** Any TPU/NPU/OpenCV backend use is surfaced in status JSON and
   logs. CPU is allowed only for bounded decode/preprocess/tracking, not fake accelerator fallback.
5. **Guardian remains actuation authority.** Media can produce events, alerts, command candidates,
   and review items; Guardian decides final actions.
6. **Raw media is policy-bound.** Recording, snapshots, and clips write only through Veliai Media
   retention policy. Debug dumps need explicit bounded config.
7. **Central logging is mandatory for mutations.** Train/delete/reallocate/review/recording prune
   actions emit `central_log` events under `veliai_manager.media` or a narrower child.

---

## 5. Beast Integration

`gg-beast-edge` owns ports and request routing. Veliai Media owns media behavior.

Allowed Beast touchpoints:

- route allowlisting in `ops_portal_handler.hpp`
- Guardian route dispatch in the existing Guardian path
- static UI serving for Ops pages
- status aggregation for `/api/v1/ops/*`

Preferred future shape:

```cpp
// Beast handler layer
if (veliai_media::maybe_handle_ops(req, path, respond)) return;
if (veliai_media::maybe_handle_guardian(req, path, respond)) return;
```

The handler layer should not grow large media algorithms.

---

## 6. Veliai_Manager Touchpoints

Veliai Media should use Veliai_Manager as a control-plane peer, not as a media implementation bucket.

Allowed manager surfaces:

- hardware inventory and health status
- central log namespaces
- operator-visible subsystem status
- future resource-budget advisories

Forbidden manager surfaces:

- media code directly changing LLM lane placement
- media code reloading LLM workers
- media code consuming inference slots as a detection shortcut

Suggested status shape:

```json
{
  "veliai_media": {
    "status": "online",
    "streams": 3,
    "recording": "enabled",
    "detectors": {
      "face": "model_required|ready",
      "voice": "model_required|ready",
      "objects": "model_required|ready|candidate_only"
    },
    "hardware": {
      "coral": "ready",
      "npu": "ready",
      "opencv": "ready"
    }
  }
}
```

---

## 7. Debug and Sanity

Veliai Media should expose debug surfaces that do not require spelunking through inference state:

- `/api/v1/ops/media/status`
- `/api/v1/ops/media/streams`
- `/api/v1/ops/media/events`
- `/api/v1/ops/media/tracks`
- `/api/v1/ops/media/review`
- `/api/v1/ops/media/zones`
- `/api/v1/ops/media/recording/status`
- `/api/v1/ops/media/mqtt/status`

Epic 7 may keep `/api/v1/ops/nvr/*` as product aliases, but the subsystem boundary should be
`media`.

---

## 7.1 Veliai-learning

**Veliai-learning** is the in-process overnight learning and consolidation loop hosted by
`gg-beast-edge`. It is not a daemon, not a sidecar, and not a second inference engine. It is the
single place where operator corrections, media training packs, and future memory-consolidation jobs
are gathered into durable learning artifacts.

Current first job:

- **YOLO dataset consolidation:** confirmed object samples are batched into a YOLO dataset under
  `/Data/Veliai/nvr/training/yolo/<dataset-id>/`.
- The export writes `images/train`, `images/val`, `labels/train`, `labels/val`, `data.yaml`,
  `classes.txt`, and `manifest.json`.
- Samples are collected one correction at a time in the UI, but YOLO training is a batch process.

Default schedule:

- `GG_F161_YOLO_NIGHTLY_CONSOLIDATION_ENABLED=1`
- `GG_F161_YOLO_CONSOLIDATION_TIME=03:30`
- `GG_F161_OBJECT_YOLO_DATASET_DIR=/Data/Veliai/nvr/training/yolo`

Guardrail:

- Veliai-learning may prepare datasets automatically.
- Veliai-learning must not silently replace the live EdgeTPU model until a validation/promotion gate
  exists. Model promotion remains manual until metrics can prove the new model is better.

Status surface:

- `/api/v1/ops/media/object-detector/status` exposes `veliai_learning`.
- Mutating learning actions log via `central_log` under `veliai_manager.media`.

---

## 8. Migration Plan

1. Keep existing routes stable.
2. Introduce `native/veliai_media/` with type/config/store modules first.
3. Move training-pack stores and NVR event/review stores out of `perception_identity.hpp`.
4. Move ingest and OpenCV media loops after store/status contracts are stable.
5. Leave thin adapter functions in `perception_identity.hpp` only where older Guardian routes need
   compatibility.
6. Add build-level includes from `gg-beast-edge` to `veliai_media`; do not make `native/engine`
   depend on `veliai_media`.

---

## 9. Review Checklist

Before merging Epic 7 media code, check:

- Does this belong in `native/veliai_media/` rather than `gg_beast_edge/*`?
- Does it mutate LLM lane/model state? If yes, stop.
- Does it call an inference worker path? If yes, stop unless explicitly ticketed.
- Does it expose hardware/model status honestly?
- Does it emit `central_log` for operator-visible mutations?
- Does it persist media state through Veliai Media stores, not ad hoc files?
- Does it preserve Guardian as final actuation authority?

---

## 10. Perception Path Contract

Veliai Media must model media perception as separate use-case paths, not as one generic
`detection` bucket. Each path has a different meaning, confidence type, lifecycle, and set of valid
operator actions.

### 10.1 Canonical Paths

| Path | Meaning | Parent / child role | Confidence means | Valid outputs | Invalid outputs |
|------|---------|---------------------|------------------|---------------|-----------------|
| `motion` | Cheap frame-difference gate: something changed in this area. | Root gate for fixed cameras; advisory for PTZ cameras. | Motion/change score, not object certainty. | Motion evidence, masks, sensitivity tuning, recording trigger. | Named objects, named people, face samples, identity candidates. |
| `object` | General physical object detector/classifier. | Root object lane. | Detector/classifier confidence. | Car, van, parcel, bin, robot mower, custom trained object classes. | Person identity, face identity, wake command. |
| `person` | Human body/person detector. | Root person lane; may trigger face search. | Person/body detector confidence. | Person event, occupancy/security evidence, face-search ROI. | A named person. Do not label this as Josh or any other identity. |
| `face` | Localized face crop candidate. | Child of `person` where possible; may be direct only if verifier is strong. | Face crop/verifier quality. | Face sample candidate, crop diagnostics, training-quality decision. | Object/person class, identity match by itself. |
| `identity` | Face and/or voice print matched or unknown identity candidate. | Child of `face` and/or `voice_print`. | Match similarity to enrolled identity, or unknown-candidate similarity. | Josh/known person match, unassigned identity sample, merge/name/drop workflow. | Generic object class or motion evidence. |
| `animal` | Animal detector/classifier. | Object-specialized lane. | Animal detector/classifier confidence. | Bird, dog, cat, fox, pet/animal training set. | Person/face identity. |
| `plate` | Vehicle registration/number plate candidate and OCR evidence. | Child of `object`/vehicle. | Plate detector confidence or OCR confidence. | Plate text, vehicle evidence, review item linked to vehicle event. | Vehicle identity unless explicitly linked by a vehicle registry. |
| `voice` | Audio segment, wake/VAD/STT evidence. | Audio root lane. | Wake, VAD, speech, or command-candidate score. | Wake hit, speech window, transcript/command candidate. | Speaker identity unless a voice print is produced. |
| `voice_print` | Speaker embedding/fingerprint candidate. | Child of `voice`; feeds `identity`. | Speaker embedding similarity/quality. | Known speaker match or unassigned voice sample. | Transcript command truth. |
| `wake_command` | Guardian/Jarvis wake and command lifecycle. | Child of `voice`, optionally enriched by `identity`. | Command/wake confidence. | Command candidate for Guardian/Amber Bus. | Object/person detection. |
| `camera_ai` | Reolink/on-camera semantic hint. | Advisory path. | Camera-reported state/confidence. | Hint, wake/keepalive context, optional review hint. | Authoritative detector truth without confirmation. |
| `static_object` | Track state for stable physical objects. | Property of `object`/selected `animal`, not a detector path. | Not a confidence signal. | Suppress repeat detections for parked cars/static objects. | Static person, static face, static identity, static motion, static voice. |

### 10.2 Required Hierarchy

The expected flow is:

```text
frame ingest
  -> motion gate
  -> object lane
       -> vehicle/car/mower/parcel/other
       -> plate OCR child evidence when a plate is found
       -> static_object track state when a physical object remains stable
  -> person lane
       -> face crop lane
            -> identity lane
                 -> known identity or unassigned face sample
  -> animal lane
       -> bird/dog/cat/fox/custom animal training set

audio ingest
  -> voice lane
       -> wake_command when wake/VAD/STT produces a command candidate
       -> voice_print lane
            -> identity lane
                 -> known speaker or unassigned voice sample

camera-native AI
  -> camera_ai lane as a hint only
```

### 10.3 Naming Rules

- A `person` event is a body/object event. It must not be named as a person.
- A name attaches only in the `identity` path after a valid face or voice print has matched, or after
  an operator names an unassigned identity candidate.
- A `face` event is a crop-quality event. It must not imply identity by itself.
- A `voice` event is an audio/speech event. It must not imply speaker identity by itself.
- `camera_ai` can wake, hint, or prioritize processing, but it must not overwrite our detector truth.

### 10.4 Confidence Rules

Never compare all confidence values as if they mean the same thing.

- `detector_confidence`: object/person/animal/plate detector confidence.
- `quality_score`: face crop quality, motion changed ratio, or sample quality.
- `identity_confidence`: face/voice identity match similarity.
- `confidence_kind`: mandatory label describing which of the above the display `confidence` field is
  representing.

Review representative selection must use path priority first, then confidence. A 100% face crop
quality is not stronger than a real person/object detector event unless it has become an `identity`
event with a valid candidate id.

### 10.5 Static Detection Rules

Static detection is allowed only for stable physical things:

- vehicles and known vehicle-like objects
- custom object packs such as robot mower, bins, bicycle, parcel box
- selected animal/object classes only if explicitly configured

Static detection is not valid for:

- `motion`
- `person`
- `face`
- `identity`
- `voice`
- `voice_print`
- `wake_command`
- `plate`
- `camera_ai`

Implementation rule: `static_object` is a track property on eligible `object`/configured `animal`
tracks. It is not a category, detector, or review queue.

### 10.6 UI Rules

The UI should expose these as different workflows:

- Motion: ignore/mask/tune sensitivity.
- Object/animal: review, train object/animal class, mark false positive, export evidence.
- Person: review occupancy/security evidence and trigger face search; do not name here.
- Face/identity: name, merge, drop, confirm match, manage training samples.
- Voice/voice print: inspect audio sample, name/merge/drop speaker print.
- Plate: review OCR evidence and link to vehicle evidence.
- Camera AI: show as a hint source, not a confirmed detection.

When a review window contains multiple paths, the UI should show the path stack rather than hiding
the lower-level context. Example: `person -> face -> identity_unknown`, with each stage’s own status.

### 10.7 Hardware Tier Contract

Veliai Media should use a tiered perception strategy. The purpose is to keep the live path fast,
avoid wasting expensive inference on boring frames, and make every accelerator role visible in
status/logs.

| Tier | Hardware | Canonical paths | Strategy |
|------|----------|-----------------|----------|
| Tier 0: Ingest / Live | libav/OpenCV/VAAPI/AMD 890M GPU/host bounded decode | live frames, restream, birds-eye view | Decode once, publish latest frames, serve live UI directly from the fast path. Perception samples from this path; it must not block it. |
| Tier 1: Reflex | Dual Coral TPUs | `object`, `animal`, candidate object classes | High-speed low-resolution candidate generation for things like car, person-like object, animal, robot mower, parcel. Motion remains a cheap frame-diff gate, not a Coral workload by itself. |
| Tier 2: Verification | AMD NPU / XDNA where supported | `person`, `face`, `plate`, `voice_print` candidates | Verify/refine candidate crops with INT8 models where the local NPU stack supports them. This is the place for higher-quality person/face/plate confirmation before identity. |
| Tier 2b: GPU Assist | AMD 890M GPU where it does not conflict with fast/embed lanes | decode assist, resize, colorspace, OpenCV/HIP/OpenCL/Vulkan-capable preprocessing | Use for media acceleration when it reduces CPU load without stealing budget from the appliance fast/embed LLM lanes. It is not the same device role as the AMD NPU. |
| Tier 3: Reasoning | RTX 3090 / Gemma lane by explicit policy only | `identity`, `wake_command`, event reasoning, Gemma tool use | Final high-context reasoning, event explanation, Guardian/Amber Bus command planning, and LLM-backed review. This must not become the default hot media path or silently consume chat lane capacity. |

Important constraints:

- Coral TPUs are candidate generators, not magic OpenCV accelerators.
- AMD NPU use is model/runtime-specific; status must say which models are actually running there.
- AMD 890M GPU use is for decode/preprocess/display-side acceleration unless explicitly promoted to
  a media compute role. It must be reported separately from AMD NPU/XDNA.
- RTX 3090 is reserved for Gemma/chat reasoning unless an explicit media reasoning path is enabled.
- Face identity should not be treated as a detector. It is the result of a valid face/voice print
  reaching the `identity` path.
- Any fallback from TPU/NPU/GPU to CPU must be explicit in status and logs; no fake accelerator truth.

### 10.8 Video Acceleration Contract

Video acceleration is infrastructure for ingest, live view, segment writing, and clip export. It is
not the same thing as detector acceleration.

Veliai Media should surface video acceleration separately from perception acceleration:

| Function | Preferred hardware | Purpose |
|----------|--------------------|---------|
| Decode | AMD 890M VAAPI or NVIDIA NVDEC, depending on codec/device availability | Decode camera streams once for live view, recording, and perception sampling. |
| Encode / transcode | AMD 890M VAAPI or NVIDIA NVENC when policy allows | Build playable MP4/export clips without burning CPU. |
| Resize / colorspace | AMD 890M GPU, OpenCV hardware path, or bounded CPU fallback | Produce low-res detect frames, birds-eye tiles, thumbnails, and model input tensors. |
| Live restream | Fast-path latest-frame buffer, MJPEG/segment output | Serve birds-eye/camera UI directly from live ingest, not from the slow perception loop. |
| Segment writing | Packet copy where possible; hardware encode only when required | Keep Frigate-style continuous/triggered evidence without re-encoding every frame. |

Rules:

- Decode once per source. The birds-eye/live UI and perception sampler consume the same ingest state.
- Prefer packet copy for recording/segments when the source codec/container allows it.
- Hardware transcode is allowed for export/playback compatibility, but it should not sit in the
  always-on hot path unless needed.
- Status must report codec, source resolution, decode mode, hardware device, decode errors, and
  whether export used packet copy or hardware/software transcode.
- Video acceleration fallback to software decode/encode is allowed only as an explicit degraded mode
  with visible status/logging.

### 10.9 LLM Profile Identity Link

Faces and voices are not isolated media-only identities. The long-term target is that Gemma has a
single person/profile record that can be linked to face prints, voice prints, memories, preferences,
Guardian permissions, and occupancy/security context.

Canonical model:

```text
LLM / Gemma profile
  -> person profile id / namespace
  -> face identity print(s)
  -> voice identity print(s)
  -> memory namespace
  -> Guardian permissions / household role
  -> recent sightings / occupancy state
```

Rules:

- A face print and a voice print can attach to the same Gemma/person profile.
- The profile link is explicit and operator-approved. A low-confidence face or voice candidate must
  not silently merge into a Gemma profile.
- Media identity ids remain stable media records, but expose a `profile_namespace` or
  `profile_id` link when attached to a Gemma profile.
- Gemma should consume a curated identity/occupancy summary, not raw face/voice event streams.
- Guardian action permissions must use the linked profile/role, not just a detected face or voice.
- Conflicts are possible and must be represented: for example face says Josh, voice says someone
  else, or voice is known but face is unknown.

Required profile-facing summaries:

- `who_is_home`: current likely occupancy by linked profile.
- `recent_sightings`: profile, stream, time, confidence, source path.
- `identity_conflicts`: mismatched face/voice/profile evidence.
- `training_needed`: profiles with weak face or voice sample coverage.
- `guardian_auth_context`: profile/role confidence for security-relevant actions.

This bridge belongs at the identity/profile boundary. The media hot path produces face/voice
candidates and matches; the LLM profile layer decides how those matches become durable profile
context for Gemma and Guardian.

#### RAG / Mem0 / Qdrant Placement

The durable Gemma/person profile link belongs in the RAG / Mem0 / Qdrant identity-memory layer, not
only in Veliai Media.

Ownership split:

| Layer | Owns | Does not own |
|-------|------|--------------|
| Veliai Media | Raw evidence, face crops, voice samples, sightings, clips, review state, match confidence. | Long-term semantic identity memory or Guardian authorization policy. |
| Identity/Profile layer | Person/profile id, `profile_namespace`, approved face/voice print links, household role, profile merge history. | Raw media retention or frame-level detection. |
| Mem0 / Qdrant / RAG | Durable semantic memories, profile facts, preferences, long-term retrieval embeddings keyed by profile namespace. | Raw video/audio blobs or surveillance review workflow. |
| Guardian | Final action authority, door/lock/security policy, command execution. | Face/voice detector truth or LLM memory storage. |

The media identity record should expose a stable link shape:

```json
{
  "identity_id": "identity-1",
  "profile_namespace": "person:josh",
  "profile_id": "person:josh",
  "face_print_ids": ["face:..."],
  "voice_print_ids": ["voice:..."],
  "last_seen_ms": 1778434800000,
  "identity_confidence": 0.94,
  "link_state": "operator_approved"
}
```

Mem0/Qdrant should store higher-level retrievable facts under `profile_namespace`, for example:

```json
{
  "namespace": "person:josh",
  "kind": "profile_fact",
  "text": "Josh is an approved household member with linked face and voice prints.",
  "source": "veliai_media.identity_profile_link",
  "confidence": 1.0
}
```

Runtime flow:

```text
face/voice evidence
  -> media identity candidate
  -> operator-approved profile link
  -> profile_namespace
  -> Mem0/Qdrant durable person memory
  -> Gemma profile context
  -> Guardian authorization context
```

Raw media remains retention-controlled under `/Data/Veliai`. RAG memory stores semantic profile facts
and compact references, not image/audio/video payloads.

Implementation surface:

- `POST /api/v1/ops/identity/profile/link` approves an identity-to-profile link.
- `POST /api/v1/ops/identity/profile/unlink` removes that link by operator approval.
- `GET /api/v1/ops/identity/profile/context` returns Gemma-ready profile context:
  `who_is_home`, `recent_sightings`, `identity_conflicts`, `training_needed`, and
  `guardian_auth_context`.
- `GET /api/v1/ops/identity/profile/conflicts` returns current face/voice/profile conflicts.
- `GET /api/v1/ops/identity/status` includes `profile_id`, `profile_namespace`, `link_state`,
  `approved_by`, `approved_ms`, `face_print_ids`, and `voice_print_ids` for each identity.

The profile bridge is deliberately operator-approved. Training a face or voice can update an already
approved profile memory, but weak candidate detection must not create a durable profile link by
itself.

### 10.10 5.4 Implementation Review Rubric

When a lower-cost implementation pass modifies this subsystem, review it against this rubric:

1. **Path semantics preserved:** `person` is not nameable, `face` is not identity, `voice` is not
   voice print, and `motion` is not an object false positive.
2. **Profile links explicit:** profile links require `approved=true`, preserve `link_state`, and
   expose `profile_namespace`.
3. **RAG payloads compact:** Qdrant/Mem0 receives semantic facts and references only, never raw
   image/audio/video payloads.
4. **Hot path protected:** media ingest, live views, detection, and recording do not block on LLM
   or RAG calls.
5. **Hardware truth preserved:** status says exactly which TPU/NPU/GPU/video path is active; no fake
   accelerator claims.
6. **Guardian authority intact:** profile/identity confidence can inform Guardian, but final lock,
   security, and actuation policy remains Guardian-owned.
7. **Central logs present:** link/unlink/train/merge/delete/reallocate/review changes emit
   `central_log` under `veliai_manager.identity` or `veliai_manager.media`.
8. **Backwards compatible stores:** existing identity and review JSONL records still load.
9. **Validation included:** `gg-beast-edge` builds, profile context endpoint responds, and identity
   status exposes face/voice/profile fields.
