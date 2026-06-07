please# Veliai-learning

**Status:** Mandated in-process learning and consolidation surface.

Veliai-learning is the single place where the appliance grows from operator feedback, media review,
memory repair, context gathering, and overnight consolidation. It is hosted inside `gg-beast-edge`.
It is not a daemon, not a sidecar, and not a second inference engine.

## Mandate

All learning/consolidation jobs that belong to the appliance brain should land here first:

- YOLO/object dataset consolidation from Veliai Media review corrections.
- Future model validation and promotion gates for object detectors.
- Memory repair and deduplication jobs that act on Gemma/Mem0/Qdrant state.
- Context gathering jobs that prepare safer, richer future prompts or Guardian evidence.
- Audit-visible nightly work that operators can inspect from one status surface.

Do not create parallel learning scripts, schedulers, or hidden services for these jobs unless a future
ticket explicitly replaces this mandate.

## Runtime Boundary

Veliai-learning runs in the existing monolith process:

```text
gg-beast-edge
  Veliai Media
  Guardian routes
  Veliai-learning
```

It may call local C++ store/export helpers and use `/Data/Veliai` for durable artifacts. It must not
mutate LLM lane mapping, systemd units, model registry load behavior, or worker startup parameters.

## Current Job: YOLO Consolidation

Operator corrections are collected one at a time, but YOLO training is a batch process.

Current nightly behavior:

1. Read confirmed object training samples.
2. Export a YOLO dataset under `/Data/Veliai/nvr/training/yolo/<dataset-id>/`.
3. Write `data.yaml`, `classes.txt`, `manifest.json`, images, and labels.
4. Emit `central_log` events under `veliai_manager.media`.

Default configuration:

```text
GG_F161_YOLO_NIGHTLY_CONSOLIDATION_ENABLED=1
GG_F161_YOLO_CONSOLIDATION_TIME=03:30
GG_F161_OBJECT_YOLO_DATASET_DIR=/Data/Veliai/nvr/training/yolo
```

## Promotion Guardrail

Veliai-learning may prepare data automatically. It must not silently replace a live model until a
validation gate exists and passes. Live EdgeTPU model promotion remains manual until the system can
prove a new model is better than the current one.

## Evolution Plan

Veliai-learning should grow in layers:

1. **Observe and gather**
   - collect labelled samples, memory anomalies, context gaps, and operator corrections
   - keep artifacts inspectable under `/Data/Veliai`
   - report status without changing live behavior

2. **Consolidate**
   - batch YOLO datasets
   - deduplicate memory records
   - prepare context packs for Guardian/Gemma
   - write manifests and central-log entries for every batch

3. **Validate**
   - test candidate object models against held-out review samples
   - test memory repairs with dry-run diffs
   - score whether a proposed context pack improves decision quality

4. **Promote with gates**
   - require validation metrics before model promotion
   - keep operator approval for live model replacement until automated gates are mature
   - retain rollback metadata for every promoted artifact

5. **Closed-loop learning**
   - route future false positives/false negatives into the next batch
   - link identities, voice prints, object packs, and memory profiles through stable IDs
   - let Guardian/Gemma consume validated learning artifacts without touching hot inference lanes

## Status

Primary status surface:

```text
GET /api/v1/ops/media/object-detector/status
```

Look for:

```json
{
  "veliai_learning": {
    "name": "Veliai-learning",
    "process": "gg-beast-edge",
    "nightly_yolo_consolidation_enabled": true,
    "nightly_time": "03:30",
    "last_status": "dataset_exported",
    "last_dataset_dir": "/Data/Veliai/nvr/training/yolo/..."
  }
}
```
