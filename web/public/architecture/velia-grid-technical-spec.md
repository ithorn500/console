# Velia-Grid Technical Specification

**Status:** v1 draft, current implementation admission-only.  
**Created:** 2026-05-14.  
**Program:** [`../Epic-17-plan-and-delivery.md`](../Epic-17-plan-and-delivery.md).  
**Architecture overview:** [`veliai-compute-and-velia-grid.md`](veliai-compute-and-velia-grid.md).  

Velia-Grid is the low-latency local protocol between Veliai Media and Veliai-Compute nodes. It is
for compute admission, leases, worker status, and compact compute results. It is not a video bus, a
Guardian policy API, or an Amber Bus replacement.

## 1. Scope

Velia-Grid v1 standardises:

- how a Veliai Media client discovers local compute capability;
- how short-lived leases are requested for realtime and near-realtime work;
- how frame, ROI, tensor, and audio references are submitted without copying media through JSON;
- how remote nodes subscribe directly to Guardian-authorised media sources without making Veliai
  Media restream or copy frame payloads;
- how accelerator constraints, fallback policy, deadlines, and errors are represented;
- how worker execution will report compact results and metrics.

Current implementation state:

- Linux local transport exists at `/run/veliai-compute/velia-grid.sock`;
- Windows named-pipe skeleton exists at `\\.\pipe\velia-grid`;
- `hello`, `ping`, `status`, `capabilities`, `lease`, `submit`, `drain`, and `resume` exist;
- `source_subscribe` is designed but not implemented;
- `submit` is admission-only until worker execution is implemented.

## 2. Roles

| Role | Responsibility |
|---|---|
| Veliai Media client | Owns media ingest, frame rings, clips, review data, identity path, and source-specific interpretation |
| Veliai-Compute node | Owns compute admission, capability advertisement, worker scheduling, accelerator execution, and compact result flow |
| Guardian Device Management | Owns device/source truth, credentials, policy, commissioning, desired state, and node runtime config |
| Amber Bus | Carries bootstrap, heartbeat, registry, desired-state changes, and function discovery; it does not carry hot frames |
| Veliai-Vision | Carries direct wallpanel media/source frames and liveness into Veliai Media; it does not schedule compute |

Guardian Device Management remains the source of truth for cameras and wallpanel camera-class
sources. Veliai-Grid messages may reference Guardian source ids and policy labels, but must not
mutate Guardian policy.

## 3. Transport

Velia-Grid v1 uses newline-delimited JSON over a local stream transport.

| Platform | Transport |
|---|---|
| Linux / Proxmox | Unix stream socket at `/run/veliai-compute/velia-grid.sock` |
| Windows | Named pipe at `\\.\pipe\velia-grid` |

Transport rules:

- one UTF-8 JSON object per line;
- request and response bodies should remain compact, normally under 64 KiB;
- no raw frames, audio chunks, tensors, images, model weights, or credentials in JSON bodies;
- all hot media inputs must be references (`frame_ref`, `roi_ref`, `tensor_ref`, `audio_ref`);
- every request that can block or queue must include `request_id` and `deadline_ms`;
- realtime off-node work must acquire a lease before `submit`.

## 4. Envelope

Request envelope:

```json
{
  "type": "submit",
  "request_id": "req-20260514-0001",
  "protocol": "velia-grid.v1",
  "client": "veliai-media",
  "trace_id": "frontdoor-184928",
  "deadline_ms": 40,
  "timestamp_ms": 1778776200000
}
```

Response envelope:

```json
{
  "ok": true,
  "request_id": "req-20260514-0001",
  "protocol": "velia-grid.v1",
  "node_id": "geekcom-i9-13900h",
  "status": "accepted",
  "metrics": {
    "queue_ms": 0.4
  }
}
```

Rules:

- `protocol` is `velia-grid.v1`;
- unknown additive fields must be ignored;
- unknown message `type` values must be rejected with `unsupported`;
- responses should echo `request_id` when provided.

## 5. Message Types

| Type | Direction | Current state | Purpose |
|---|---|---|---|
| `hello` | client -> node | implemented | Protocol greeting and message list |
| `ping` | client -> node | implemented | Lightweight liveness |
| `status` | client -> node | implemented | Node status snapshot |
| `capabilities` | client -> node | implemented | Capability advertisement |
| `lease` | client -> node | implemented | Short-lived admission for a job class |
| `submit` | client -> node | admission-only | Submit a job against a valid lease where required |
| `source_subscribe` | client -> node | planned | Grant a node permission to subscribe directly to a media source and process from its local cache |
| `cancel` | client -> node | planned | Cancel a queued or running job |
| `job_status` | client -> node | planned | Query state of a submitted job |
| `drain` | client -> node | implemented | Reject future leases/submits for update or maintenance |
| `resume` | client -> node | implemented | Return to available admission |

`cancel` and `job_status` are mandatory before production worker execution, but may be rejected by
the current admission-only seed.

## 6. Capability Schema

Capability advertisement:

```json
{
  "id": "frame.preprocess",
  "status": "ready",
  "hardware": {
    "class": "vaapi",
    "device": "renderD129",
    "driver": "radeonsi",
    "status": "ready"
  },
  "models": [],
  "input_formats": ["nv12", "yuv420p", "rgb", "bgr"],
  "output_formats": ["nv12", "rgb", "bgr"],
  "max_resolution": [7680, 2160],
  "latency_classes": ["realtime", "near_realtime", "evidence"],
  "batching": false,
  "limits": {
    "max_inflight": 1,
    "queue_depth": 4,
    "max_downscale_ratio": 4.0
  },
  "readiness": {
    "state": "ready",
    "smoke": "passed"
  }
}
```

Readiness ladder:

```text
not_present -> driver_required -> runtime_required -> model_required -> smoke_failed -> ready
```

Hardware-specific guardrails must be advertised as capability constraints. For example, the current
Radeon/radeonsi VAAPI path must cap a single hardware VPP downscale stage to roughly 4:1 or perform
safe internal staging before exact output scaling.

## 7. Reference Schemas

### 7.1 Frame Reference

```json
{
  "type": "frame_ref",
  "source_id": "guardian.camera.door",
  "stream_id": "door",
  "media_transport": "rtsp",
  "frame_id": "184928",
  "timestamp_ms": 1778776200101,
  "format": "nv12",
  "width": 1280,
  "height": 720,
  "stride": [1280, 1280],
  "transport": "shared_memory",
  "ref": "veliai-media/door/ring/184928",
  "ttl_ms": 250,
  "policy_label": "security.front_door",
  "privacy": {
    "redaction_state": "not_redacted",
    "retention_class": "security_event_candidate"
  },
  "authority": "guardian.device_management.cameras"
}
```

Allowed `media_transport` values:

- `rtsp`;
- `http_mjpeg`;
- `veliai_vision`;
- future values explicitly added by this spec.

Allowed hot-path `transport` values:

- `shared_memory`;
- `mmap`;
- `frame_ring`;
- `tensor_ring`;
- `file_ref` for evidence/batch work only.

### 7.2 ROI Reference

```json
{
  "type": "roi_ref",
  "parent_frame_id": "184928",
  "source_id": "guardian.camera.door",
  "stream_id": "door",
  "box": {
    "mode": "normalized_xyxy",
    "value": [0.42, 0.18, 0.62, 0.79]
  },
  "crop_policy": "caller_may_crop",
  "transport": "frame_ring",
  "ref": "veliai-media/door/ring/184928"
}
```

### 7.3 Tensor Reference

```json
{
  "type": "tensor_ref",
  "dtype": "float32",
  "shape": [1, 3, 640, 640],
  "layout": "nchw",
  "transport": "shared_memory",
  "ref": "veliai-media/tensors/job-0001/input"
}
```

### 7.4 Source Descriptor Reference

`source_descriptor_ref` is used when a remote Veliai-Compute node should subscribe directly to a
source rather than receive frames from Veliai Media.

```json
{
  "type": "source_descriptor_ref",
  "source_id": "guardian.camera.garden",
  "stream_id": "garden",
  "allowed_media_transports": ["rtsp"],
  "descriptor_ref": "guardian.device_management.cameras/garden/stream/main",
  "authority": "guardian.device_management.cameras",
  "policy_label": "security.garden",
  "privacy": {
    "redaction_state": "not_redacted",
    "retention_class": "security_event_candidate"
  }
}
```

The descriptor is Guardian-authorised control-plane data. It may resolve to RTSP/HTTP endpoint
details, ONVIF profile data, credential references, Veliai-Vision session metadata, source policy,
and privacy labels. Veliai Media may request the subscription, but it must not become the credential
or device-identity source of truth.

## 8. Lease And Submit

Lease request:

```json
{
  "type": "lease",
  "request_id": "req-lease-0001",
  "protocol": "velia-grid.v1",
  "client": "veliai-media",
  "op": "object.detect",
  "latency_class": "realtime",
  "deadline_ms": 40,
  "requirements": {
    "accelerator": ["hailo", "coral"],
    "fallback": "defer"
  }
}
```

Lease response:

```json
{
  "ok": true,
  "request_id": "req-lease-0001",
  "protocol": "velia-grid.v1",
  "node_id": "geekcom-i9-13900h",
  "status": "leased",
  "lease_id": "geekcom-i9-13900h-lease-123",
  "lease_ttl_ms": 5000,
  "resume_policy": "retry_local_or_other_node"
}
```

Submit request:

```json
{
  "type": "submit",
  "request_id": "req-submit-0001",
  "protocol": "velia-grid.v1",
  "client": "veliai-media",
  "job_id": "door-184928-object-detect",
  "op": "object.detect",
  "lease_id": "geekcom-i9-13900h-lease-123",
  "latency_class": "realtime",
  "deadline_ms": 40,
  "input": {
    "type": "frame_ref",
    "source_id": "guardian.camera.door",
    "stream_id": "door",
    "media_transport": "rtsp",
    "frame_id": "184928",
    "format": "nv12",
    "width": 1280,
    "height": 720,
    "transport": "shared_memory",
    "ref": "veliai-media/door/ring/184928",
    "ttl_ms": 250
  },
  "requirements": {
    "accelerator": ["hailo", "coral"],
    "fallback": "defer"
  },
  "result": {
    "mode": "inline_compact",
    "include_timing": true
  }
}
```

Fallback policies:

| Policy | Meaning |
|---|---|
| `reject` | Fail immediately if required hardware is unavailable |
| `defer` | Keep or reschedule only within bounded queue/deadline |
| `lower_resolution` | Retry using an explicitly permitted lower-resolution source/reference |
| `cpu_authorized_only` | CPU is allowed only because the job explicitly permits it |

No silent CPU fallback is allowed for accelerator-required realtime work.

## 8A. Source Subscription

`source_subscribe` is the preferred remote-node split mode when pushing frame refs over the network
would add avoidable load.

The node connects to a Guardian-authorised media source, keeps a short-lived local decode/cache/ring,
processes according to the requested profile, and returns compact results or `artifact_ref` values
to Veliai Media.

Request:

```json
{
  "type": "source_subscribe",
  "request_id": "req-source-garden-0001",
  "protocol": "velia-grid.v1",
  "client": "veliai-media",
  "source": {
    "type": "source_descriptor_ref",
    "source_id": "guardian.camera.garden",
    "stream_id": "garden",
    "allowed_media_transports": ["rtsp", "veliai_vision"],
    "descriptor_ref": "guardian.device_management.cameras/garden/stream/main"
  },
  "processing": {
    "ops": ["motion.gate", "object.detect"],
    "sample_fps": 5,
    "latency_class": "realtime",
    "roi": "full_frame"
  },
  "requirements": {
    "accelerator": ["hailo", "coral", "vaapi"],
    "fallback": "defer"
  },
  "deadline_ms": 40
}
```

Response:

```json
{
  "ok": true,
  "request_id": "req-source-garden-0001",
  "protocol": "velia-grid.v1",
  "node_id": "geekcom-i9-13900h",
  "status": "leased",
  "mode": "source_subscription_direct",
  "lease_id": "garden-source-lease-123",
  "lease_ttl_ms": 5000,
  "media_transport": "rtsp",
  "cache_policy": {
    "local_ring_ttl_ms": 5000,
    "max_cached_frames": 30
  },
  "result_transport": "velia-grid.v1"
}
```

Allowed subscription modes:

| Mode | Meaning |
|---|---|
| `source_subscription_direct` | Node connects directly to the source endpoint; preferred when the source can tolerate another client |
| `source_subscription_relay` | Node connects to a lightweight relay selected by Guardian/source policy, not to Veliai Media |
| `veliai_media_restream` | Last-resort explicit policy when direct/relay modes are impossible |

Veliai Media should not be the default fanout path. It owns meaning, events, review, and training;
it should not be forced to decode, re-encode, or restream remote compute workloads unless policy
explicitly chooses `veliai_media_restream`.

## 9. Result Schemas

### 9.1 Detection Result

```json
{
  "ok": true,
  "request_id": "req-submit-0001",
  "protocol": "velia-grid.v1",
  "job_id": "door-184928-object-detect",
  "status": "ok",
  "model": "hailo-yolo-person-vehicle-v1",
  "hardware": "hailo8",
  "latency_ms": 12.4,
  "detections": [
    {
      "class": "person",
      "confidence": 0.91,
      "box": {
        "mode": "normalized_xyxy",
        "value": [0.42, 0.18, 0.62, 0.79]
      }
    }
  ],
  "metrics": {
    "queue_ms": 0.6,
    "compute_ms": 11.2,
    "copy_count": 0,
    "frame_ref_age_ms": 18.7
  }
}
```

### 9.2 Preprocess Result

```json
{
  "ok": true,
  "request_id": "req-preprocess-0001",
  "protocol": "velia-grid.v1",
  "job_id": "door-184928-thumb",
  "status": "ok",
  "output": {
    "type": "frame_ref",
    "format": "rgb",
    "width": 480,
    "height": 270,
    "transport": "shared_memory",
    "ref": "veliai-media/door/preprocess/door-184928-thumb",
    "ttl_ms": 1000
  },
  "metrics": {
    "hardware": "vaapi",
    "compute_ms": 3.8,
    "copy_count": 1
  }
}
```

## 10. Error Semantics

Common statuses:

| Status | Meaning |
|---|---|
| `accepted` | Job was admitted but has not completed |
| `running` | Job is executing |
| `ok` | Job completed successfully |
| `rejected` | Request is valid but not accepted |
| `deferred` | Caller should retry elsewhere or later within policy |
| `expired` | Lease or input reference expired |
| `cancelled` | Caller or node cancelled work |
| `failed` | Worker failed after admission |
| `unsupported` | Message, op, format, or capability is not supported |
| `stale_ref` | Input reference TTL or frame lifetime is invalid |
| `lease_expired` | Lease id is no longer usable |
| `required_accelerator_unavailable` | Requested hardware/model is unavailable |
| `node_draining` | Node is refusing new work for maintenance/update |
| `deadline_exceeded` | Work cannot complete inside caller deadline |
| `privacy_policy_denied` | Source policy forbids the requested operation |

Failure response:

```json
{
  "ok": false,
  "request_id": "req-submit-0001",
  "protocol": "velia-grid.v1",
  "job_id": "door-184928-object-detect",
  "status": "deferred",
  "reason": "required_accelerator_unavailable",
  "required": ["hailo", "coral"],
  "available": ["cpu_simd"],
  "retry": "local_or_other_node",
  "retry_after_ms": 250
}
```

## 11. Metrics

Worker execution results should expose:

- `queue_ms`;
- `compute_ms`;
- `latency_ms`;
- `copy_count`;
- `frame_ref_age_ms`;
- `hardware`;
- `hardware_id`;
- `driver`;
- `model`;
- `model_id`;
- `worker_id`;
- `dropped_jobs`;
- `deadline_misses`;
- `fallback_rejections`.

These metrics feed Guardian C2 and central logs through Amber Bus/Guardian control surfaces. They
must not require shipping raw frames through Amber Bus.

## 12. Security And Privacy

- Local sockets/pipes must be permissioned to the Veliai Media and Veliai-Compute service accounts.
- Camera credentials remain in Guardian Device Management and are never copied into Velia-Grid jobs.
- `source_id`, `policy_label`, and `privacy.redaction_state` must be preserved from Guardian source
  truth into frame refs.
- Jobs must reject with `privacy_policy_denied` when source policy forbids the requested operation.
- Amber Bus may carry status, metrics, and compact result references, not hot frame payloads.

## 13. Versioning

The v1 protocol string is:

```text
velia-grid.v1
```

Compatibility rules:

- additive fields are allowed;
- receivers must ignore unknown additive fields;
- enum additions require clients to tolerate unknown values conservatively;
- breaking schema changes require `velia-grid.v2`;
- `protocol` mismatch must be rejected before job admission.

## 14. Current Implementation Notes

The current native node is a protocol and admission seed. Worker execution is future work.

The current Veliai Media hot-path optimisation seed remains in-process:

- VAAPI/libavfilter safe-stage VPP scaling;
- Radeon/radeonsi downscale guardrail for roughly 4:1 maximum hardware downscale per pass;
- OpenCV cascade caching and runtime thread capping;
- stricter camera wake/STT gating.

The next implementation step is to extract the local `frame.preprocess` and `video.decode` path
behind this specification so Veliai Media submits frame references rather than embedding all compute
inside the ingest loop.
