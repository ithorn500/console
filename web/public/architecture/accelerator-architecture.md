# Gemma Gateway — production accelerator architecture

**Status:** Normative production contract for TPU / NPU / Hailo workloads.  
**Last updated:** 2026-05-24.  
**Enforced by:** [`config/accelerators.production.json`](../../config/accelerators.production.json) and
[`scripts/ci/check_accelerator_architecture.py`](../../scripts/ci/check_accelerator_architecture.py).

This document defines how accelerator-owned perception and multimodal workloads are placed on the
active appliance. It exists to remove ambiguity: **green means a production payload actually ran on
the assigned accelerator**, not that a device node, model file, or fallback path exists.

**SSOT rule:** When this prose and the JSON registry disagree, **`config/accelerators.production.json`
wins**. This file explains operator meaning and deployment posture.

## 1. Production Rules

| Rule | Contract |
| --- | --- |
| Green requires live payload | A workload is healthy only after the assigned accelerator has executed the configured production model and exposed non-zero inference evidence with zero failures. |
| CPU fallback is not green | CPU fallback may keep a user-facing path limping, but accelerator-owned workloads must report degraded/red unless the assigned accelerator payload is proven. |
| Fallback cannot mask primary drift | A Coral fallback can keep object detection useful, but it must not make Hailo primary look healthy. |
| No unassigned device grab | Each exclusive Coral TPU has a declared owner. Object pools must not silently consume the wake or face TPU. |
| Lab artifacts are not live artifacts | Student, experimental, joined, or lab HEFs must stay out of the live Hailo root unless explicitly allowed by a separate operator decision. |

## 2. Device Allocation

| Device | Class | Production owner | Notes |
| --- | --- | --- | --- |
| `/dev/apex_2` | Coral EdgeTPU | `jarvis_wake` | Dedicated low-latency Jarvis wake classifier. Must not be used by object fallback. |
| `/dev/apex_1` | Coral EdgeTPU | `face_identity` | Dedicated face identity detector. |
| `/dev/apex_0` | Coral EdgeTPU | `object_detection_coral_fallback` | Fallback object path only; does not make Hailo primary green. |
| `/dev/apex_3` | Coral EdgeTPU | `audio_event_classifier` / reserve | Reserved for audio event classification and future always-on audio heads. |
| `/dev/hailo0` | Hailo-8 | `object_detection_primary` | Primary vision object detector using production `yolov8n.hef`. |
| `/dev/accel/accel0` | AMD XDNA NPU | `npu_preflight` | Intent-router / AIE preflight sidecar only on the live appliance. |
| CUDA0 / HIP0 | Lane GPU | `mmproj` | Paired llama-server workers load GGUF mmproj via llama.cpp mtmd on the text lane GPU. |

The active Coral env allocation is:

```bash
GG_F152_OPENWAKEWORD_CORAL_DEVICE=/dev/apex_2
GG_F148_FACE_EDGETPU_DEVICE=/dev/apex_1
GG_F152_OBJECT_EDGETPU_DEVICES=/dev/apex_0
GG_F152_OBJECT_EDGETPU_POOL_MAX_DEVICES=1
```

LXC hosts where `systemd-udevd` is inactive must install
`aigateway-accelerator-devices.service` so `/dev/accel/accel0` is re-chowned to `render:660`
after every reboot.

## 3. Workload Contracts

| Workload | Primary accelerator | Production model / artifact | Green evidence |
| --- | --- | --- | --- |
| `jarvis_wake` | Coral `/dev/apex_2` | `models/wakeword/openWakeWord/coral/hey_jarvis_v0.1.production.static.manual_ln.int8_edgetpu.tflite` | `/api/v1/ops/assistant/status` reports live Coral payload on `/dev/apex_2`, `inferences > 0`, `failures == 0`, and `hardware_accelerated=true`. |
| `face_identity` | Coral `/dev/apex_1` | `models/perception/face_detector_edgetpu.tflite` | Face EdgeTPU status must prove the configured device and live payload before it is treated as healthy. |
| `object_detection_primary` | Hailo-8 `/dev/hailo0` | `models/perception/hailo/yolov8n.hef` | `/api/v1/ops/media/object-detector/status` reports `hailo_detector_ready=true`, `hailo_live_inferences > 0`, `hailo_failures == 0`, and no Hailo error. |
| `object_detection_coral_fallback` | Coral `/dev/apex_0` | YOLO EdgeTPU fallback model | May keep detections flowing, but if Hailo primary is not green the architecture gate still fails. |
| `audio_event_classifier` | Coral `/dev/apex_3` | `models/perception/audio_tpu/yamnet_spectra_in_edgetpu.tflite` | Reserved production slot; green must require live EdgeTPU audio-event inference when promoted. |
| `voice_identity` | Host CPU ORT | `models/perception/voice_identity/wespeaker_voxceleb_resnet34_LM_static_t300.onnx` | CPU is the declared primary; green requires a warm ONNXRuntime WeSpeaker session, not NPU fallback masquerading as primary. |
| `npu_preflight` | AMD NPU `/dev/accel/accel0` | `models/npu_intent_router_v1/artifact.json` | `amd-npu-preflight.service` active; sidecar `/health` or `data/run/npu_preflight_health.v1.json` reports `ok=true`, `device_open=true`, and NPU smoke `status=passed`. |
| `mmproj` | Lane GPU (`cuda0` / `hip0`) | `mmproj-gemma-4-31B-it-f16.gguf` + `mmproj-gemma-4-e4b-it-f16.gguf` | `gg-process-manager` workers show `prefill_backend=llama.cpp-mtmd-gpu` with launch `--mmproj` on the paired lane GPU. |

## 4. mmproj — appliance vs engine (F-121)

Epic **§5.1.4 / F-121** delivered the **engine** path: ORT+VitisAI NPU mtmd subgraph (B1) and
precomputed injection (B2) in `gemma_engine`. That code remains compiled and testable.

**Appliance deployment posture (2026-05-24):** production multimodal prefill is **lane-GPU GGUF
mmproj via llama.cpp**, not NPU ORT. `deploy/model-registry.yaml` pairs projectors with chat/fast
lanes on `cuda0`/`hip0`; `registry_reader.cpp` and `engine_runner.cpp` forbid ONNX/NPU projector
handoff into live `llama-server` workers until a separate promotion ticket wires registry +
process-manager policy and proves NPU payload on `/dev/accel/accel0`.

Do not describe F-121 NPU mmproj as live appliance behavior until that promotion lands.

## 5. Hailo Object Readiness

Hailo object detection is the primary object path. The service may release Hailo vstreams after a
burst so the device can be shared, therefore `hailo_vstream_loaded=false` does not by itself mean
the detector is unhealthy.

The production green condition is:

```text
hailo_model_present=true
hailo_runtime_linked=true
hailo_adapter_ready=true
hailo_detector_ready=true
hailo_live_inferences > 0
hailo_failures == 0
hailo_last_error == ""
```

## 6. Wakeword Placement

The production Jarvis wake path is Coral EdgeTPU on `/dev/apex_2`. Hailo wake experiments, student
HEFs, joined HEFs, or generic ASR/Whisper artifacts are not production Jarvis wake until they satisfy
a separate production model contract and are explicitly promoted.

## 7. NPU Preflight Readiness

NPU green on the appliance means **payload proof for the preflight sidecar**, not merely that
`/dev/accel` exists:

```text
/dev/accel/accel0 readable and writable by aigateway (render group)
data/npu_smoke_status.v1.json status=passed
amd-npu-preflight.service active
data/run/npu_preflight_health.v1.json ok=true
data/run/npu_preflight_health.v1.json device_open=true
```

Device-node presence alone is **red**. CPU or reference classifier fallback is **degraded/red** for
accelerator-owned NPU claims.

## 8. Validation

Run the architecture gate locally:

```bash
python3 /opt/AIGateway/scripts/ci/check_accelerator_architecture.py
```

Useful spot checks:

```bash
curl -fsS http://127.0.0.1:11430/api/v1/ops/assistant/status | jq '.wakeword.openwakeword'
curl -fsS http://127.0.0.1:11430/api/v1/ops/media/object-detector/status | jq '{hailo_detector_ready,hailo_live_inferences,hailo_failures,hailo_last_error,edgetpu_detector_ready,edgetpu_device_path}'
curl -fsS http://127.0.0.1:8766/health | jq '{ok,device_open,smoke_passed}'
cat /opt/AIGateway/data/run/npu_preflight_health.v1.json
runuser -u aigateway -- test -r /dev/accel/accel0 /dev/accel/accel0
cat /opt/AIGateway/data/run/workers.json | jq '.workers[] | {handle, mmproj}'
```

## 9. Current Live Status

Re-verify after every LXC reboot:

- Jarvis wake payload on Coral `/dev/apex_2`
- Hailo object primary on `/dev/hailo0`
- NPU preflight green via sidecar health + smoke status
- Chat/fast mmproj active on lane GPUs via `workers.json`

If NPU regresses after reboot, check `aigateway-accelerator-devices.service` and
`/dev/accel/accel0` permissions before chasing model/runtime issues.
