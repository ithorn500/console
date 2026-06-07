# Veliai-Compute And Velia-Grid

**Status:** Initial native agent and Guardian Device Management control surface exist.  
**Created:** 2026-05-14.  
**Program:** [`../Epic-17-plan-and-delivery.md`](../Epic-17-plan-and-delivery.md).  
**Protocol spec:** [`velia-grid-technical-spec.md`](velia-grid-technical-spec.md).  

Veliai-Compute is the native compute-offload node model for Veliai Media. Velia-Grid is the local
low-latency protocol exposed by a Veliai-Compute node.

The design goal is very low overhead:

- Guardian and Amber Bus carry bootstrap, desired state, capability truth, drain/resume, and
  heartbeat;
- Velia-Grid carries only hot-path local admission/lease/status messages;
- media bytes should stay in Veliai Media frame rings or shared memory;
- remote compute nodes may subscribe directly to Guardian-authorised RTSP/HTTP/Veliai-Vision
  sources so Veliai Media does not become the stream fanout bottleneck;
- future detector results should be compact structured events, not raw frame payloads.

This page is the architecture overview. The normative message schemas, reference types, lease
rules, error semantics, metrics, and versioning rules live in
[`velia-grid-technical-spec.md`](velia-grid-technical-spec.md).

## Runtime Shape

```text
Guardian Device Management
        |
        | Amber Bus invoke:
        | guardian.device_management.compute.bootstrap
        | guardian.device_management.compute.heartbeat
        v
Veliai-Compute node
        |
        | Unix socket / named pipe:
        | Velia-Grid v1
        v
Veliai Media scheduler/client
        |
        | frame_ref / tensor_ref
        v
Veliai Media frame rings, evidence store, identity path
```

The compute node is opportunistic. Veliai Media keeps source ownership and must be able to retry
locally or on another node when a lease fails, expires, or the node disappears.

## Zero-Impact Install

The host install must not depend on hand-maintained local configuration files.

Allowed local state:

- bootstrap script and installed agent payload under `/opt/veliai-compute`;
- systemd or Windows service registration;
- release cache/downloads;
- local runtime cache of the latest Guardian bootstrap/heartbeat response;
- socket/pipe runtime files.

Not allowed for production:

- required `/etc/veliai-compute/env`;
- manually edited per-host policy files;
- camera credentials or Guardian policy replicated into the compute host;
- automatic driver/kernel/DKMS installs from the node agent;
- hard dependencies that make Veliai Media fail if the node is offline.

Linux default layout:

```text
/opt/veliai-compute/scripts/bootstrap.sh
/opt/veliai-compute/releases/<version>/
/opt/veliai-compute/current -> /opt/veliai-compute/releases/<version>
/opt/veliai-compute/state/
/opt/veliai-compute/downloads/
/var/lib/veliai-compute/cache.json
/run/veliai-compute/velia-grid.sock
```

Windows default layout:

```text
C:\ProgramData\VeliaiCompute\releases\<version>\
C:\ProgramData\VeliaiCompute\current
C:\ProgramData\VeliaiCompute\downloads
\\.\pipe\velia-grid
```

## Code Structure

Current AIGateway files:

| Path | Purpose |
|---|---|
| `native/veliai_compute/main.cpp` | Linux C++ node agent: hardware discovery, Amber Bus bootstrap/heartbeat, Unix Velia-Grid socket |
| `native/veliai_compute/main_windows.cpp` | Windows service/node agent: hardware hints and named-pipe Velia-Grid skeleton |
| `native/veliai_compute/CMakeLists.txt` | Native build target |
| `native/veliai_compute/README.md` | Build, install, smoke, and node-operation notes |
| `scripts/veliai_compute/bootstrap.sh` | Linux self-update/bootstrap wrapper |
| `scripts/veliai_compute/package_release.sh` | Linux release tarball/manifest builder |
| `scripts/veliai_compute/windows_bootstrap.ps1` | Windows service/update bootstrap |
| `scripts/veliai_compute/package_windows_release.ps1` | Windows release manifest helper |
| `deploy/veliai-compute/*.service`, `*.timer` | systemd templates, not live system mutation |

Current Guardian files:

| Path | Purpose |
|---|---|
| `/mnt/guardian/src/guardian_core/managed_compute_registry.py` | Managed Compute registry and action implementation |
| `/mnt/guardian/src/guardian_core/c2_server.py` | C2 HTTP routes and standalone live bundle |
| `/mnt/guardian/src/apps/control_planes/platform_infra/guardian_http_engine_app.py` | Amber Bus function adapter |
| `/mnt/guardian/src/apps/apps.yaml` | Device Management child category config |
| `/mnt/guardian/src/apps/log_json_paths.py` | central_log target mapping |
| `/mnt/guardian/src/www/guardian_c2_deck_v3*` | C2 tab, renderer, topology/graph integration |

## Veliai Media Implementation Seed

Veliai Media now has an in-process implementation seed for the first hot-path work that should
later move behind Velia-Grid:

- VAAPI/libavfilter VPP scaling is used for camera and wallpanel media preprocessing where
  available.
- Radeon/radeonsi `scale_vaapi` has a known crash mode when a single hardware VPP pass downscales
  more than roughly 4:1, so the current path performs safe-stage hardware scaling before exact final
  output scaling.
- OpenCV face cascade loading is cached, and OpenCV runtime threads are capped to keep media CPU
  behaviour predictable.
- Camera wake/STT gates are stricter so noisy camera streams do not create speech windows without a
  real wake signal.

This validates the `frame.preprocess`, `video.decode`, and `video.transcode` capability classes. It
does not replace Veliai-Compute worker execution. The extraction target is: Veliai Media owns frame
rings and submits `frame_ref` jobs; Veliai-Compute owns admission, accelerator-safe execution, and
compact result flow.

For remote nodes, the extraction target also includes `source_subscribe`: the compute node receives
a Guardian-authorised source descriptor, connects directly to the source or to a lightweight relay,
keeps its own local cache/ring, and sends compact results back to Veliai Media. Veliai Media should
not become the default restream/fanout path for off-node processing.

This path is library-based (`libav`, `libavfilter`, OpenCV). It must not become an `ffmpeg` command
sidecar.

## Guardian Data Structures

### Managed Compute Registry

Path:

```text
/mnt/guardian/src/log_files/state/guardian/managed_compute_registry.v1.json
```

Schema:

```json
{
  "schema": "guardian.device_management.managed_compute.registry.v1",
  "ok": true,
  "when_utc": "2026-05-14T16:32:00+00:00",
  "authority": "guardian.device_management.managed_compute",
  "nodes": [
    {
      "node_id": "geekcom-i9-13900h",
      "host_name": "geekcom",
      "registered_at_utc": "2026-05-14T16:31:00+00:00",
      "last_seen_utc": "2026-05-14T16:32:00+00:00",
      "last_mode": "heartbeat",
      "desired_state": "available",
      "stale": false,
      "hardware": {
        "cpu": {
          "model": "Intel(R) Core(TM) i9-13900H",
          "threads": 20,
          "avx2": true,
          "avx512": false
        },
        "dri_devices": ["renderD128"],
        "coral_devices": [],
        "hailo_devices": [],
        "openvino_hint": true
      },
      "driver_audit": [
        {
          "component": "gpu_video_vaapi_qsv",
          "status": "driver_ready",
          "action": "none",
          "evidence": [
            "/dev/dri_present=true",
            "module_i915_loaded=true",
            "module_any_video_driver_loaded=true",
            "driver=renderD128:i915"
          ]
        },
        {
          "component": "coral_edgetpu",
          "status": "driver_required_if_coral_installed",
          "action": "manual_install_only_verify_gasket_apex_driver_for_Proxmox_kernel",
          "evidence": [
            "/dev/apex_present=false",
            "/sys/class/apex_present=false",
            "module_apex_or_gasket_loaded=false"
          ]
        },
        {
          "component": "hailo",
          "status": "driver_required_if_hailo_installed",
          "action": "manual_install_only_hailo_pci_driver_then_hailort_runtime",
          "evidence": [
            "/dev/hailo_present=false",
            "module_hailo_loaded=false",
            "hailort_runtime_hint=false"
          ]
        }
      ],
      "capabilities": [
        {
          "id": "frame.preprocess",
          "status": "ready",
          "hardware": "cpu_simd",
          "notes": "resize/crop/colorspace primitives"
        }
      ],
      "runtime_config": {
        "schema": "guardian.device_management.managed_compute.runtime_config.v1",
        "node_id": "geekcom-i9-13900h",
        "authority": "guardian.device_management.managed_compute",
        "zero_impact_install": true,
        "config_source": "amber_bus_guardian_device_management",
        "cache_allowed": true,
        "accepted_protocols": ["velia-grid.v1"],
        "heartbeat_interval_sec": 60,
        "lease_ttl_ms": 5000,
        "max_inflight_jobs": 1,
        "socket_path": "/run/veliai-compute/velia-grid.sock",
        "resume_policy": "retry_local_or_other_node",
        "update_manifest_url": "http://guardian.amber.com/local/veliai-compute/manifest.json",
        "supported_ops": ["frame.preprocess", "motion.gate", "evidence.batch"]
      }
    }
  ],
  "summary": {
    "nodes_total": 1,
    "nodes_online": 1,
    "nodes_stale": 0,
    "nodes_draining": 0,
    "nodes_retired": 0
  }
}
```

### Device Management Compute Category

Path:

```text
/mnt/guardian/src/log_files/state/system/device_management_compute.v1.json
```

Schema is the existing generic `guardian.device_category_control_plane.v1` rollup. It points at the
registry as a child artifact:

```json
{
  "schema": "guardian.device_category_control_plane.v1",
  "ok": true,
  "category_id": "compute",
  "label": "Managed Compute category",
  "children": [
    {
      "id": "managed_compute_registry",
      "label": "Veliai-Compute node registry",
      "rel_path": "state/guardian/managed_compute_registry.v1.json",
      "present": true,
      "optional": true,
      "ok": true
    }
  ]
}
```

## Amber Bus APIs

Veliai-Compute uses the canonical Amber Bus consumer invoke surface. Guardian still exposes a
provider ingress for the Bus to call back into Guardian, but Veliai-Compute nodes must not call
that Guardian-local compatibility route directly.

```http
POST http://amber-bus.amber.com:8080/api/bus/invoke/{function_id}
Content-Type: application/json
```

The steady function IDs are:

| Function ID | Purpose |
|---|---|
| `guardian.device_management.compute.bootstrap` | First contact; creates/updates registry row and returns runtime config |
| `guardian.device_management.compute.heartbeat` | Periodic status/capability refresh; returns desired state/runtime config |
| `guardian.device_management.compute.list` | Operator/API registry read |
| `guardian.device_management.compute.drain` | Desired state becomes `draining` |
| `guardian.device_management.compute.resume` | Desired state becomes `available` |
| `guardian.device_management.compute.retire` | Desired state becomes `retired` |

Bootstrap request:

```json
{
  "function_id": "guardian.device_management.compute.bootstrap",
  "source": "veliai-compute-agent",
  "payload": {
    "schema": "veliai.compute.node.status.v1",
    "node_id": "geekcom-i9-13900h",
    "host_name": "geekcom",
    "protocol": "velia-grid.v1",
    "agent": {
      "name": "veliai-compute-agent",
      "version": "0.1.0"
    },
    "hardware": {},
    "driver_audit": [],
    "capabilities": [],
    "amber_bus": {
      "status": "bootstrap"
    },
    "time_monotonic_ns": 1234567890
  }
}
```

Bootstrap response:

```json
{
  "schema": "guardian.device_management.managed_compute.bootstrap_result.v1",
  "ok": true,
  "node_id": "geekcom-i9-13900h",
  "desired_state": "available",
  "runtime_config": {
    "schema": "guardian.device_management.managed_compute.runtime_config.v1",
    "zero_impact_install": true,
    "heartbeat_interval_sec": 60,
    "lease_ttl_ms": 5000,
    "resume_policy": "retry_local_or_other_node",
    "update_manifest_url": "http://guardian.amber.com/local/veliai-compute/manifest.json"
  }
}
```

The node writes only the response body to its local cache. If Amber Bus or Guardian is unreachable,
the node can continue with cached policy while advertising degraded bus status.

## C2 APIs

Guardian C2 exposes the operator/API management surface:

```http
GET  /api/guardian/device_management/compute
POST /api/guardian/device_management/compute
```

POST body:

```json
{
  "action": "drain",
  "node_id": "geekcom-i9-13900h"
}
```

Supported actions:

- `list`
- `bootstrap`
- `heartbeat`
- `drain`
- `resume`
- `retire`
- `set_desired_state`

The C2 deck surfaces this under:

```text
Execution -> Managed Compute
```

## Velia-Grid v1

This section is a compact overview. The complete technical specification is
[`velia-grid-technical-spec.md`](velia-grid-technical-spec.md).

Velia-Grid v1 is intentionally small. It is newline-delimited JSON over a local stream transport.

Linux:

```text
/run/veliai-compute/velia-grid.sock
```

Windows:

```text
\\.\pipe\velia-grid
```

### Low-Overhead Rules

- Every request and response is one JSON object plus `\n`.
- Message bodies should stay small; do not put frames, audio chunks, tensors, images, or model
  weights in Velia-Grid JSON.
- Hot input must use `frame_ref`, `roi_ref`, `tensor_ref`, or future shared-memory descriptors.
- Lease before submit for realtime remote/off-node work.
- TTLs are short and explicit.
- Results should contain IDs, timings, detections, boxes, scores, and references to persisted
  evidence, not media blobs.
- The caller remains responsible for retrying locally or elsewhere.

### Message Types

| Type | Direction | Purpose |
|---|---|---|
| `hello` | client -> node | Protocol/capability greeting |
| `ping` | client -> node | Lightweight liveness |
| `status` | client -> node | Node status snapshot |
| `capabilities` | client -> node | Capability list |
| `lease` | client -> node | Opportunistic short-lived admission |
| `submit` | client -> node | Submit an admitted job |
| `drain` | client -> node | Reject future leases/submits for update/maintenance |
| `resume` | client -> node | Return to available admission |

### Hello

Request:

```json
{"type":"hello","client":"veliai-media","protocol":"velia-grid.v1"}
```

Response:

```json
{
  "ok": true,
  "protocol": "velia-grid.v1",
  "node_id": "geekcom-i9-13900h",
  "messages": ["hello", "ping", "status", "capabilities", "lease", "submit", "drain", "resume"]
}
```

### Status

Request:

```json
{"type":"status"}
```

Response:

```json
{
  "ok": true,
  "availability": "available",
  "lease_mode": "opportunistic",
  "resume_policy": "retry_local_or_other_node",
  "status": {
    "schema": "veliai.compute.node.status.v1",
    "node_id": "geekcom-i9-13900h",
    "hardware": {},
    "capabilities": []
  }
}
```

### Lease

Request:

```json
{
  "type": "lease",
  "op": "frame.preprocess",
  "latency_class": "realtime",
  "deadline_ms": 40,
  "fallback": "local_or_other_node"
}
```

Response:

```json
{
  "ok": true,
  "status": "leased",
  "lease_id": "geekcom-i9-13900h-lease-123",
  "lease_ttl_ms": 5000,
  "op": "frame.preprocess",
  "resume_policy": "retry_local_or_other_node",
  "note": "lease is opportunistic; caller keeps source ownership and must retry on expiry"
}
```

Unavailable response:

```json
{
  "ok": false,
  "status": "rejected",
  "reason": "node_draining",
  "retry": "local_or_other_node"
}
```

### Submit

Current implementation is admission-only. It verifies that the operation is declared and returns a
lease-like acceptance. Future implementations must require a valid lease for realtime off-node jobs.

Request:

```json
{
  "type": "submit",
  "job_id": "frontdoor-000123",
  "op": "frame.preprocess",
  "lease_id": "geekcom-i9-13900h-lease-123",
  "input": {
    "type": "frame_ref",
    "stream_id": "front-door",
    "frame_id": "184928",
    "format": "nv12",
    "width": 1280,
    "height": 720,
    "transport": "shared_memory",
    "ref": "veliai-media/front-door/ring/184928"
  },
  "deadline_ms": 40
}
```

Current response:

```json
{
  "ok": true,
  "job_id": "frontdoor-000123",
  "status": "accepted",
  "mode": "admission_only",
  "lease_id": "geekcom-i9-13900h-frontdoor-000123",
  "lease_ttl_ms": 5000,
  "resume_policy": "retry_local_or_other_node",
  "op": "frame.preprocess",
  "note": "worker execution not implemented yet; caller should treat this as admission smoke"
}
```

### Drain And Resume

Drain:

```json
{"type":"drain","reason":"self_update"}
```

Response:

```json
{"ok":true,"status":"draining"}
```

Resume:

```json
{"type":"resume"}
```

Response:

```json
{"ok":true,"status":"available"}
```

## Latency Budget

The target is low millisecond overhead before real compute begins.

| Step | Goal |
|---|---|
| Velia-Grid parse + dispatch | under 1 ms on local host |
| Lease response | under 2 ms local steady-state |
| Frame reference handoff | zero frame copies in the hot path |
| Realtime detector admission | bounded by caller deadline, normally under 5 ms before worker queue |
| Heartbeat/control-plane update | not in hot path; default 60 seconds |

Design implications:

- keep Amber Bus out of per-frame loops;
- avoid HTTP for hot job submission;
- avoid raw JSON arrays for pixels/tensors;
- use pre-opened sockets/pipes from the client;
- keep runtime config cached in memory after bootstrap;
- use compact status counters rather than verbose diagnostics on every poll.

## Readiness Ladder

Hardware capability readiness must be honest:

```text
not_present -> driver_required -> runtime_required -> model_required -> smoke_required -> smoke_failed -> ready
```

Current agent uses:

- `ready` for CPU SIMD admission-only operations;
- `ready` for `/dev/dri` video decode/transcode when device nodes exist;
- `model_required` for Coral object/face detection when `/dev/apex_*` exists;
- `runtime_required` for Hailo when a Hailo device node exists but runtime/model smoke has not run;
- `not_present` when a device class is absent.

Future workers must only report `ready` after a model-specific smoke test.

## Proxmox Driver Audit

Because the first external node target is a Proxmox host, the agent must audit drivers without
modifying the hypervisor.

The Linux agent reports a `driver_audit` array in `veliai.compute.node.status.v1`.

| Component | Read-only evidence | Healthy state | Install-needed state |
|---|---|---|---|
| `gpu_video_vaapi_qsv` | `/dev/dri`, `/proc/modules` `i915`/`amdgpu`/`nvidia`/`xe`, `/sys/class/drm/*/device/driver` | `driver_ready` | `driver_or_passthrough_required` |
| `coral_edgetpu` | `/dev/apex_*`, `/sys/class/apex`, `/proc/modules` `apex`/`gasket` | `driver_ready` | `driver_required_if_coral_installed` |
| `hailo` | `/dev/hailo*`, `/proc/modules` `hailo`/`hailo_pci`, `hailortcli`/`libhailort` hints, `.hef` model pack, smoke marker | `ready` only after model-specific smoke | `driver_required_if_hailo_installed`, `runtime_required`, `model_required`, or `smoke_required` |
| `openvino` | `/opt/intel/openvino`, `OPENVINO_DIR` | `runtime_hint_present_model_required` | `runtime_not_present` |

Rules:

- the agent never installs drivers, firmware, DKMS packages, runtimes, or udev rules;
- install actions are advisory strings surfaced to Guardian C2;
- a driver can be `driver_ready` while a capability is still `model_required`;
- Hailo cannot become `ready` until device, kernel module, HailoRT runtime, model pack, and
  model-specific smoke test all pass;
- Coral cannot become inference-ready until EdgeTPU driver/device and model-specific smoke pass;
- Proxmox kernel updates may change driver compatibility, so heartbeat should keep auditing after
  every reboot/update.

## Non-Goals

Veliai-Compute does not:

- carry raw camera streams through Amber Bus;
- execute arbitrary code;
- own Guardian device policy;
- own camera credentials;
- replace Veliai Media;
- mutate LLM lane placement;
- silently fall back to CPU for accelerator-required realtime jobs.
