# Shared Memory Mutation Schema And Namespace Contract

Status: E23 L2-001 contract ready / mirror stage / not promoted
Date: 2026-05-29
Owners: AIGateway/Gemma Gateway, Guardian, Memorr, Veliai, Logger, Actorr,
HA mirrors, Amber Bus
Applies to: Amber Bus memory events, Gemma cognitive indexes, Guardian
operational state, Memorr tangible assets, HA/wallpanel/Jarvis mirrors.

This is the contract of record for E23-2. It defines the shared mutation
envelope, namespace rules, privacy propagation, and isolation tests that must be
in place before family to-dos, Memorr asset-backed memories, or cross-service
memory automation are treated as production features.

The north-star query this contract must enable is a memory day view:

```text
Gemma, show me memories from 20/05/2005.
```

The spoken/display date must be normalised to `2005-05-20` before fan-out.
Gemma may orchestrate the query and narrate the result, but every returned item
must remain owner-backed by Memorr, Guardian, Gemma, or another explicitly
onboarded canonical source.

## Relationship To The Boundary Plan

This document implements the E23-2 slice from
[`gemma-guardian-memorr-memory-boundary.md`](gemma-guardian-memorr-memory-boundary.md).
That plan defines ownership. This contract defines the data plane shape used
when those owners exchange memory-like state.

The critical rule is unchanged: the envelope can describe, mirror, index, or
delete state, but it does not transfer canonical ownership. The owning service
still enforces the write.

## E23-1 Inventory Baseline

The read-only inventory before this contract found these active or emerging
memory-like paths:

| Area | Evidence | Classification | Contract impact |
| --- | --- | --- | --- |
| Gemma Gateway memory facade | `native/gg_beast_edge/guardian_handler.hpp`, `docs/architecture/memory-model.md` | Cognitive memory | Active owner for `/guardian/v1/memory/remember` and `/guardian/v1/memory/recall`, BGE-M3/Qdrant recall, memory tiers, namespace filters. |
| Gemma system tool registry | `memory_namespace:"system:tool_registry"` in the memory model | Cognitive/system metadata | Tool schemas must stay out of profile/person namespaces. |
| Guardian E5 memory adapter | `/mnt/guardian/src/scripts/guardian_memory_adapter.py` | Operational-to-cognitive bridge | Production path uses `GemmaGatewayClient`; local Mem0 is dev-only. |
| Guardian GG memory publish/drift | `/mnt/guardian/src/scripts/guardian_gg_memory_publish.py` | Operational-to-cognitive sync | Existing hashes/fingerprints/drift files should map onto mutation envelope fields. |
| Guardian E5 S-stages | `/mnt/guardian/src/docs/GUARDIAN_GG_STRATEGY_CARGO_MATURITY_PLAN.md` | Production maturity | Observability, sync spine, single cargo, recall quality, apply safety, and soak remain open. |
| Guardian forensics/ops manifests | `/mnt/guardian/src/forensics_manifest.yaml`, `/mnt/guardian/src/ops_manifest_sources.yaml` | Display/ops mirrors | Existing state files are evidence and mirrors, not Gemma-owned truth. |
| HA Gemma/Guardian scripts and sensors | `/mnt/homeassistant/scripts.yaml`, `/mnt/homeassistant/templates.yaml`, `/mnt/homeassistant/forensics_manifest.yaml` | Display/legacy mirrors | HA surfaces file sensors, dashboards, and compatibility scripts; HA must not become memory/action authority. |
| Memorr source workspace | `/mnt/memorr/opt/memorr/README.md`, `AGENTS.md` | Tangible memory owner | Memorr is the memory/storage service boundary on `memorr.amber.com`. |
| Memorr emerging native skeleton | `/mnt/memorr/opt/memorr/native`, `/mnt/memorr/opt/memorr/schemas/memorr.health.v1.schema.json` | Emerging tangible-memory implementation | Health/object-index skeleton exists, but Bus/Logger/service contracts and asset schemas are not production complete. |

Inventory conclusion: E23-2 must support existing Guardian/Gemma ingest and
drift fields, HA display mirrors, and Memorr asset/object references without
letting any mirror or cognitive index become the canonical store.

## Schema Artifacts

The machine-readable schemas and fixtures live under:

- [`../../schemas/amber-memory/mutation-envelope.v1.schema.json`](../../schemas/amber-memory/mutation-envelope.v1.schema.json)
- [`../../schemas/amber-memory/namespace.v1.schema.json`](../../schemas/amber-memory/namespace.v1.schema.json)
- [`../../schemas/amber-memory/memory-reference.v1.schema.json`](../../schemas/amber-memory/memory-reference.v1.schema.json)
- [`../../schemas/amber-memory/fixtures/epic23_l2_mutation_envelope_fixture_pack.v1.json`](../../schemas/amber-memory/fixtures/epic23_l2_mutation_envelope_fixture_pack.v1.json)

The mutation and namespace schemas are copied into Memorr, Amber Bus, and
Guardian docs so owner repos have the same L2 contract at implementation time:

- `/mnt/memorr/opt/memorr/schemas/amber.memory.mutation-envelope.v1.schema.json`
- `/mnt/memorr/opt/memorr/schemas/amber.memory.namespace.v1.schema.json`
- `/mnt/amber-bus/schemas/amber.memory.mutation-envelope.v1.schema.json`
- `/mnt/amber-bus/schemas/amber.memory.namespace.v1.schema.json`
- `/mnt/guardian/src/docs/schemas/amber.memory.mutation-envelope.v1.schema.json`
- `/mnt/guardian/src/docs/schemas/amber.memory.namespace.v1.schema.json`

They intentionally describe the shared envelope and references only. Owner
payload schemas such as Guardian task records, Memorr asset/document/email
records, Veliai formulated-memory artifacts, Logger evidence rows, Actorr media
evidence, and HA mirror state remain owner-local and are referenced through
`payload_schema`.

## Core Model

Every cross-service memory mutation is three things:

| Layer | Meaning | Owner |
| --- | --- | --- |
| Event envelope | What happened, who owns it, how to route/mirror/index/delete it. | Amber shared contract. |
| Canonical record | The owner database/object/file-plane record referenced by `canonical_ref`. | `owner`. |
| Consumer instruction | What Gemma, HA, wallpanel, or another mirror should do with the event. | Receiving service, bounded by this contract. |

The event envelope is safe to route. The payload is not automatically safe to
store, display, embed, or expose to a model. Consumers must obey `payload_mode`,
`privacy_class`, namespace, and owner rules.

## Universal Mutation Envelope

Required top-level fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schema` | string | Must be `amber.memory.mutation.v1`. |
| `schema_version` | integer | Must be `1` for this contract. |
| `event_id` | string | Globally unique event ID. |
| `event_type` | string | Fully qualified event type, e.g. `guardian.task.created`. |
| `operation` | enum | `create`, `update`, `delete`, `reclassify`, `mirror`, `index`, `export`, `purge`, `tombstone`. |
| `owner` | enum | Canonical owner: `gemma`, `guardian`, `memorr`, `veliai`, `logger`, `actorr`, `ha_mirror`, or `amber_bus`. |
| `namespace` | string | Access/index boundary. Must match the namespace contract. |
| `entity_type` | string | `task`, `asset`, `memory`, `policy`, `profile`, `graph_fact`, `strategy_cargo`, `rl_outcome`, `display_mirror`, `timeline_item`, or future registered type. |
| `kind` | string | Semantic subtype, e.g. `family_todo`, `asset_photo`, `guardian_persona`. Not the operation. |
| `source_system` | string | System that produced the event, e.g. `jarvis_voice`, `guardian_c2`, `memorr_ingest`. |
| `source_id` | string | Source-local ID, utterance ID, file ID, or import ID. |
| `source_cursor` | object | Bounded replay cursor: mailbox UID, Guardian queue sequence, source scan cursor, Bus stream sequence, Logger correlation, Veliai job, or equivalent owner cursor. |
| `canonical_ref` | string | Stable owner reference, e.g. `guardian:task:9912`, `memorr:asset:abc`, `gemma:memory:xyz`. |
| `object_ref` | string/null | Owner object or evidence ref when the mutation is tied to stored content or a durable artifact. |
| `content_sha256` | string/null | Raw content hash for Memorr objects or artifact hash for durable evidence; null only for pure logical mutations. |
| `revision` | integer | Monotonic owner revision for the canonical record. |
| `wal` | object | Replay contract: stream ID, sequence, entry ref/hash, prior hash, durability state, and replay state. L2 fixtures use `contract_fixture`, not production WAL claims. |
| `created_at` | RFC3339 string | Event creation time. |
| `updated_at` | RFC3339 string | Canonical record update time known to the event producer. |
| `privacy_class` | enum | `public_household`, `shared_household`, `private_profile`, `sensitive_profile`, `system_restricted`, `secret`. |
| `privacy` | object | Model/export/raw-payload policy. `raw_payload_to_gemma` is always false in this contract. |
| `retention_policy` | string | Retention contract such as `indefinite`, `delete_after_30d`, `purge_immediate`, `legal_hold`, or `owner_defined`. |
| `lifecycle` | object | Retention, delete, tombstone, export, and reclassification state. |
| `payload_mode` | enum | `inline`, `redacted`, `reference_only`, `hash_only`, or `none`. |
| `payload_sha256` | string | SHA-256 of the canonical JSON payload included or referenced by the event. |
| `canonical_sha256` | string | SHA-256 or revision fingerprint of the owner canonical record when available. |
| `idempotency_key` | string | Stable replay/dedupe key. |
| `correlation_id` | string | End-to-end correlation used by Logger/Central_LOG and owner replay evidence. |
| `producer` | object | Producer app/service/host metadata. |
| `authorization` | object | Actor, subject, identity confidence, and decision metadata. |
| `mirror_state` | object | Per-consumer mirror/index state. |
| `mirror_targets` | array | Bounded per-target mirror plan/status, including Memorr Data/Vault, Gemma index, HA mirror, Logger, Amber Bus, and export targets. |
| `derived_artifacts` | array | Bounded refs to captions, OCR, transcripts, embeddings, formulated memories, redacted summaries, thumbnails, audit evidence, or export manifests. |
| `poison_status` | object | Retry, poison, dead-letter, quarantine, owner-resolution, and blocked-action state. |
| `payload` | object/null | Inline payload only when allowed by `payload_mode` and `privacy_class`. |

Recommended fields:

- `causation_id`: previous event or command that caused this event.
- `trace_id`: local trace ID when present.
- `payload_schema`: owner payload schema ID.
- `payload_ref`: pointer to canonical payload or asset when payload is redacted.
- `asset_sha256`: raw object/content hash for Memorr-owned assets only.
- `tombstone`: delete/purge marker.
- `deleted_at`: logical deletion timestamp.
- `purge_after`: earliest physical purge timestamp.
- `expires_at`: event or short-lived memory expiry.
- `tags`: low-cardinality routing tags.
- `links`: related canonical refs.

## L2-001 Fixture Gate

The executable gate is:

```bash
scripts/ci/epic23_l2_mutation_envelope_gate.sh
```

It validates:

- mutation and namespace schemas;
- Memorr asset, document, and email mutations;
- Guardian operational evidence mutation;
- Veliai formulated-memory artifact;
- delete/tombstone, reclassify, and export mutations;
- Amber Bus poison/dead-letter retry case;
- owner-repo schema/fixture copy parity;
- no fixture claims production runtime writes or raw-payload access for Gemma.

Passing this gate means dependent L3 tasks have a precise contract to implement.
It does not promote MemorrDB, Guardian queue retirement, Concierge email ingress,
Veliai execution, Logger retention, Actorr media evidence, or HA mirrors to
production authority.

### Example: Family To-Do Create

```json
{
  "schema": "amber.memory.mutation.v1",
  "schema_version": 1,
  "event_id": "evt_01HZ_FAMILY_TODO_0001",
  "event_type": "guardian.task.created",
  "operation": "create",
  "owner": "guardian",
  "namespace": "profile:family/todos",
  "entity_type": "task",
  "kind": "family_todo",
  "source_system": "jarvis_voice",
  "source_id": "jrv_audio_8832a",
  "canonical_ref": "guardian:task:9912",
  "revision": 1,
  "created_at": "2026-05-26T11:00:00Z",
  "updated_at": "2026-05-26T11:00:00Z",
  "privacy_class": "shared_household",
  "retention_policy": "indefinite",
  "payload_mode": "inline",
  "payload_schema": "guardian.family_task.v1",
  "payload_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "canonical_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "idempotency_key": "guardian:task:9912:rev:1",
  "producer": {
    "app": "guardian",
    "service": "family_todo",
    "host": "guardian.amber.com"
  },
  "authorization": {
    "actor_id": "profile:Iain",
    "subject_id": "profile:family",
    "identity_confidence": 0.98,
    "identity_methods": ["face", "voice"],
    "decision": "allow"
  },
  "mirror_state": {
    "gemma": "pending_mirror",
    "ha": "pending_mirror"
  },
  "payload": {
    "title": "Put salt in the water softener",
    "status": "open",
    "assignee": null
  }
}
```

### Example: Memorr Asset Reference

```json
{
  "schema": "amber.memory.mutation.v1",
  "schema_version": 1,
  "event_id": "evt_01HZ_MEMORR_ASSET_0001",
  "event_type": "memorr.asset.created",
  "operation": "create",
  "owner": "memorr",
  "namespace": "asset:memorr/vault",
  "entity_type": "asset",
  "kind": "asset_photo",
  "source_system": "memorr_ingest",
  "source_id": "import:iphone:2026-05-26:001",
  "canonical_ref": "memorr:asset:01HZPHOTO001",
  "revision": 1,
  "created_at": "2026-05-26T11:05:00Z",
  "updated_at": "2026-05-26T11:05:00Z",
  "privacy_class": "private_profile",
  "retention_policy": "owner_defined",
  "payload_mode": "reference_only",
  "payload_ref": "memorr:asset:01HZPHOTO001",
  "asset_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "payload_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "canonical_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "idempotency_key": "memorr:asset:01HZPHOTO001:rev:1",
  "producer": {
    "app": "memorr",
    "service": "asset_ingest",
    "host": "memorr.amber.com"
  },
  "authorization": {
    "actor_id": "profile:Iain",
    "subject_id": "profile:Iain",
    "identity_confidence": 1.0,
    "identity_methods": ["owner_import"],
    "decision": "allow"
  },
  "mirror_state": {
    "gemma": "pending_index",
    "ha": "not_applicable"
  },
  "payload": null
}
```

### Example: Memory Day Query Event

This event records a query request or query audit. Results are owner-backed
timeline records, not canonical state transfers.

```json
{
  "schema": "amber.memory.mutation.v1",
  "schema_version": 1,
  "event_id": "evt_01HZ_TIMELINE_QUERY_0001",
  "event_type": "gemma.timeline.queried",
  "operation": "index",
  "owner": "gemma",
  "namespace": "profile:Iain/timeline",
  "entity_type": "timeline_item",
  "kind": "timeline_query",
  "source_system": "jarvis_voice",
  "source_id": "jrv_audio_20050520",
  "canonical_ref": "gemma:timeline_query:2005-05-20:Iain",
  "revision": 1,
  "created_at": "2026-05-26T13:00:00Z",
  "updated_at": "2026-05-26T13:00:00Z",
  "privacy_class": "private_profile",
  "retention_policy": "owner_defined",
  "payload_mode": "inline",
  "payload_schema": "amber.memory.timeline.query.v1",
  "payload_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "canonical_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "idempotency_key": "gemma:timeline_query:2005-05-20:Iain:rev:1",
  "producer": {
    "app": "gemma",
    "service": "timeline_compose",
    "host": "gemma.amber.com"
  },
  "authorization": {
    "actor_id": "profile:Iain",
    "subject_id": "profile:Iain",
    "identity_confidence": 0.98,
    "identity_methods": ["face", "voice"],
    "decision": "allow"
  },
  "mirror_state": {
    "gemma": "in_sync",
    "memorr": "not_applicable",
    "guardian": "not_applicable",
    "ha": "not_applicable"
  },
  "payload": {
    "date": "2005-05-20",
    "display_date": "20/05/2005",
    "subject": "profile:Iain",
    "sources": ["memorr.assets", "gemma.memories", "guardian.operational_facts"]
  }
}
```

## Field Rules

### Owner

`owner` is the strict canonical authority:

| Owner | May own | Must not own |
| --- | --- | --- |
| `gemma` | Cognitive memory records, semantic summaries, embeddings, RAG/index metadata, tool registry metadata. | Guardian tasks/actions, Memorr asset bytes, HA device truth. |
| `guardian` | Tasks, policy/action state, approvals, apply safety, RL outcomes, operational truth, Guardian prompt cargo truth. | Memorr asset bytes, Gemma vector-only memory as canonical user record. |
| `memorr` | Tangible assets, object indexes, immutable content objects, emails, documents, albums, timelines, provenance, storage lifecycle. | Guardian action state, Gemma embeddings as sole asset record. |
| `veliai` | Formulated-memory artifacts, inference/job evidence, and derived cognitive artifacts that point back to owner refs. | Memorr bytes, Guardian apply state, Logger incident authority. |
| `logger` | Observability evidence, incidents, correlation, retention, and audit timeline records. | Owner domain truth or raw private payloads outside its retention policy. |
| `actorr` | Actorr-owned media/evidence records. | Guardian household policy or Memorr Life asset authority. |
| `ha_mirror` | Display-only HA/wallpanel mirror state. | Canonical memory, task, or physical-world policy truth. |
| `amber_bus` | Bus stream, poison/dead-letter, discovery, route, and delivery evidence. | Owner payload authority or domain-specific canonical stores. |

### Namespace

Namespaces are access and indexing boundaries. They are not owners.

Pattern:

```text
domain:actor/context
```

Allowed domains for E23-2:

| Pattern | Meaning | Required owner behavior |
| --- | --- | --- |
| `profile:{Identity}/personal` | Single-user private profile memory. | Identity confidence must meet the personal threshold before write/read. |
| `profile:{Identity}/todos` | Single-user task memory/index view. | Guardian owns canonical tasks; Gemma may own cognitive refs. |
| `profile:family/todos` | Shared household task namespace. | Guardian owns canonical tasks; readable by authenticated family members unless item privacy narrows it. |
| `profile:family/shared` | Shared household memory. | Must not include private-profile content without reclassification. |
| `system:guardian/policy` | Guardian policy and apply context. | Guardian owns; Gemma read-only advisory context. |
| `system:tool_registry` | Gemma tool schema metadata. | Gemma owns; never profile/person memory. |
| `asset:memorr/vault` | Memorr cold asset vault. | Memorr owns immutable asset records and bytes, mirrored through `/Data/Memories` and `/Vault/Memories`. |
| `asset:memorr/{collection}` | Memorr album/timeline/collection boundary. | Memorr owns collection membership; Gemma may index summaries. |
| `index:gemma/rag` | Gemma semantic index boundary. | Gemma owns index entries that point to canonical refs. |
| `profile:{Identity}/timeline` | Single-user timeline/day-view query and result boundary. | Query orchestration may be Gemma-owned; returned items must retain owner `canonical_ref`. |
| `profile:family/timeline` | Shared household timeline/day-view boundary. | Must exclude private-profile or quarantined items unless reclassified to shared. |
| `ops:{owner}/drift` | Operational drift and mirror status. | Owning service writes; display surfaces may mirror. |

Identity confidence thresholds:

| Namespace class | Minimum confidence | Behavior below threshold |
| --- | --- | --- |
| `private_profile` / `sensitive_profile` | `0.95` | Block read/write and ask who is speaking or require stronger auth. |
| `shared_household` | `0.70` for identified actor, or authenticated wallpanel/session | Use shared namespace only; do not infer private actor facts. |
| `system_restricted` / `secret` | Explicit service authorization | No Jarvis free-form access. |

### Payload Modes

| Mode | Meaning | Consumer rule |
| --- | --- | --- |
| `inline` | Payload is included and may be consumed according to privacy class. | Consumers may store/mirror only allowed fields. |
| `redacted` | Payload includes only redacted display/index fields. | Consumers must not infer missing sensitive details. |
| `reference_only` | Payload is not included; use `payload_ref`/`canonical_ref`. | Consumers must call owner-approved tools to resolve. |
| `hash_only` | Only hashes/revisions are exposed. | Consumers may prove drift but cannot display/embed content. |
| `none` | No payload is available. | Routing/tombstone/status only. |

Gemma may embed only payloads that are approved for cognitive indexing. For
Memorr assets, Gemma should embed derived text/captions/OCR/transcripts produced
by approved tools, not raw asset bytes.

### Memorr Storage Mirrors

Memorr-owned tangible memories use two runtime storage roots:

- `/Data/Memories`: warm/servable mirror for current catalogs, previews,
  derived text, thumbnails, and retrieval materialisation.
- `/Vault/Memories`: cold durable mirror for retained originals, tombstones,
  recovery records, and export/delete evidence.

The event envelope exposes logical owner refs and mirror state. Consumers must
not treat direct filesystem paths under either root as stable cross-service APIs.
Memorr's production catalog is native FASTIO-backed MemorrDB, not a large JSON
file. Cross-service consumers receive Amber Bus events, capabilities, and memory
mutation envelopes rather than direct MemorrDB access.
Native de-duplication happens below the memory mutation layer: identical content
may share one Central_IO object, but every asset, source path, album, timeline,
and privacy relationship remains owner-backed by MemorrDB references.
Perceptual clusters, semantic artifacts, scrub reports, stream leases, and
lineage edges are Memorr-owned records. Mutation events may describe them, but
they do not transfer ownership to Gemma, HA, Guardian, Veliai, Actorr, or Amber
Bus.

### Hashes

Use separate hashes so drift can be understood:

| Field | Meaning |
| --- | --- |
| `payload_sha256` | SHA-256 of the exact canonical JSON payload, redacted payload, or reference envelope that this event presents to consumers. |
| `canonical_sha256` | Owner-side canonical record hash/fingerprint. |
| `asset_sha256` | Raw content/object hash for Memorr assets only. |

JSON hashes must be computed from canonical JSON: UTF-8, sorted object keys,
no insignificant whitespace, and stable number/string representation.

### Mirror State

`mirror_state` is per consumer. Do not use one global `drift_state`.

Allowed values:

- `not_applicable`
- `pending_mirror`
- `pending_index`
- `in_sync`
- `conflict`
- `orphaned`
- `blocked_privacy`
- `blocked_auth`
- `failed`

Each service monitors its own mirror/index state:

- Guardian monitors Guardian-owned operational state and Guardian-to-Gemma drift.
- Memorr monitors asset/index propagation and storage lifecycle.
- Gemma monitors cognitive index status.
- HA/wallpanel mirrors display state only.

## Delete, Tombstone, Export, And Privacy Propagation

Deletion is a multi-stage contract:

1. The owner records a logical delete or privacy update in the canonical store.
2. The owner emits a mutation event with `operation:"delete"`,
   `operation:"reclassify"`, `operation:"purge"`, or `operation:"tombstone"`.
3. Consumers apply the event idempotently.
4. Cognitive indexes delete or reclassify vectors by `canonical_ref`.
5. Display mirrors remove cached state.
6. The owner performs physical purge only according to `retention_policy`,
   `purge_after`, and service-specific compliance rules.

Tombstones are durable. They must survive restart and replay so old events,
stale HA mirrors, or old Qdrant/Mem0-compatible entries cannot resurrect a
deleted memory.

### Delete Event Example

```json
{
  "schema": "amber.memory.mutation.v1",
  "schema_version": 1,
  "event_id": "evt_01HZ_MEMORR_DELETE_0001",
  "event_type": "memorr.asset.deleted",
  "operation": "delete",
  "owner": "memorr",
  "namespace": "asset:memorr/vault",
  "entity_type": "asset",
  "kind": "asset_photo",
  "source_system": "memorr_asset_service",
  "source_id": "delete_request:01HZ",
  "canonical_ref": "memorr:asset:01HZPHOTO001",
  "revision": 2,
  "created_at": "2026-05-26T12:00:00Z",
  "updated_at": "2026-05-26T12:00:00Z",
  "privacy_class": "private_profile",
  "retention_policy": "delete_after_30d",
  "payload_mode": "none",
  "payload_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "canonical_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "idempotency_key": "memorr:asset:01HZPHOTO001:delete:rev:2",
  "tombstone": true,
  "deleted_at": "2026-05-26T12:00:00Z",
  "purge_after": "2026-06-25T12:00:00Z",
  "producer": {
    "app": "memorr",
    "service": "asset_delete",
    "host": "memorr.amber.com"
  },
  "authorization": {
    "actor_id": "profile:Iain",
    "subject_id": "profile:Iain",
    "identity_confidence": 1.0,
    "identity_methods": ["owner_session"],
    "decision": "allow"
  },
  "mirror_state": {
    "gemma": "pending_index",
    "ha": "pending_mirror"
  },
  "payload": null
}
```

### Reclassification

Privacy upgrades must be treated like delete plus create:

1. Owner emits `operation:"reclassify"` with old and new namespace references in
   `links`.
2. Gemma deletes vectors from the old namespace before writing the new namespace.
3. HA/wallpanel removes shared/private-ineligible mirrors.
4. Consumers mark old namespace entries as tombstoned by `canonical_ref` and
   old revision.

Moving a task from `profile:family/todos` to `profile:Iain/personal` must remove
it from family recall and shared display before personal recall becomes visible.

### Export

Export events must be owner-driven and namespace-bounded:

- Personal export can include only namespaces the actor is allowed to read.
- Shared household export must not include private profile namespaces.
- Memorr export must include asset IDs, hashes, provenance, and available
  derived metadata, but raw asset bytes are resolved through Memorr export
  tooling, not Gemma recall.

## Timeline / Memory Day Query Contract

Timeline queries are read contracts. They do not transfer ownership and they do
not create new canonical memories unless the query/audit itself is retained by
Gemma.

Query payloads should use `amber.memory.timeline.query.v1`:

| Field | Meaning |
| --- | --- |
| `query_id` / `correlation_id` | Stable query and Logger/Central_LOG correlation identifiers. |
| `query_type` | `memory_day`, `date_range`, `document_latest`, `email_thread`, `photo_video_cluster`, or `provenance_lookup`. |
| `time_range` | Normalized UTC start/end plus local date/display date when applicable. |
| `subject` | Profile, family, organisation, supplier, or Memorr collection subject. |
| `timezone` | Query timezone used for date boundaries. |
| `sources` | Requested source families such as `memorr.assets`, `memorr.documents`, `memorr.email`, `memorr.derived_ocr`, `memorr.formulated_memories`, `memorr.lineage`, `gemma.memories`, `guardian.operational_facts`, and `ha.house_mirrors`. |
| `filters` | Entity, asset kind, supplier/person, document latest/version, email thread/classification, cluster, privacy, quarantine, and tombstone filters. |
| `privacy_mode` | `strict`, `shared_only`, `operator_review`, or `owner_export`. |
| `response_policy` | Sort order, maximum results, empty-source handling, read-lease refs, summary style, and explicit `raw_payload_allowed:false`. |
| `execution_contract` | Mirror-stage, not-promoted contract pointing future execution to native C++ MemorrDB/index owner adapters. |

Timeline result payloads should use `amber.memory.timeline.result.v1` and each
item must include:

- `owner`;
- `canonical_ref`;
- `namespace`;
- `entity_type`;
- `kind`;
- `timestamp`;
- `timestamp_evidence`, such as EXIF capture time, file mtime, email date,
  Guardian event time, diary entry date, or Git commit time;
- `privacy_class`;
- `redaction_state`;
- `confidence`;
- scoring fields for relevance, timestamp, provenance, privacy, and when
  applicable document-version or cluster-representative choice;
- `summary`;
- `evidence_refs`;
- `provenance.source_refs`, `lineage_refs`, timestamp source, and owner
  correlation ID;
- optional `preview_ref`, `asset_ref`, `read_lease_ref`, document, email,
  cluster, or related `links`.

L2-002 fixture gate:

```bash
scripts/ci/epic23_l2_timeline_query_gate.sh
```

It validates the query/result schemas, the Memorr owner-repo copies, one
memory-day response, the British Gas latest bill/statement plus open
complaint/dispute shape, source fan-out, date normalization, document
latest-by-version rules, email thread refs, photo/video cluster refs, read lease
refs, redaction state, provenance/source refs, empty-source handling, and the
rule that no direct `/Data`, `/Vault`, Guardian log, or HA path is exposed as API
truth.

This gate is contract evidence only. It does not activate MemorrDB timeline
indexes, Concierge email ingress, Guardian queue retirement, HA history
scraping, raw blob streaming, or product UI behavior.

Source behavior:

- Memorr returns tangible assets and asset-derived metadata.
- Gemma returns cognitive memories and narrative links.
- Guardian returns authorised operational facts, to-dos, runbook outcomes, and
  policy/action evidence.
- HA/wallpanel returns display mirrors only unless a specific house snapshot or
  telemetry source has a canonical owner.
- Email, diary, code, and house-media sources must be marked `not_onboarded`
  until their owner connector exists.

Privacy behavior:

- Private profile timeline queries require the private-profile identity
  threshold.
- Family timeline queries must not include private-profile entries by default.
- Quarantined Memorr sources are omitted or counted as blocked until policy
  authorises reveal.
- Deleted/tombstoned refs must not appear in results.

## Consumer Obligations

### Gemma

Gemma must:

- Enforce namespace and privacy filters before recall.
- Store `canonical_ref`, `owner`, `kind`, `privacy_class`, and `revision` with
  every cognitive index entry.
- Avoid embedding `reference_only`, `hash_only`, or `none` payloads directly.
- Delete or reclassify vectors by `canonical_ref` and namespace on tombstone or
  reclassification events.
- Never answer a private-profile query from shared namespace context.
- Report failed/pending cognitive writes so Guardian or Memorr can see drift.

### Guardian

Guardian must:

- Own canonical family to-do and action state.
- Confirm user-facing write success only after Guardian canonical success.
- Publish memory facts to Gemma as mirror/index events, not as authority
  transfer.
- Block physical or policy apply when required Guardian/Gemma drift gates fail.
- Reject namespace-mismatched personal task reads.

### Memorr

Memorr must:

- Own immutable asset IDs, object hashes, provenance, and storage lifecycle.
- Emit asset create/delete/reclassify/tombstone events.
- Preserve durable tombstones for deleted assets.
- Never rely on Gemma/Qdrant/Mem0-compatible storage as the asset record.
- Expose Bus/Logger contracts before sibling repos consume Memorr capabilities
  as production surfaces.

### HA / Wallpanel / Jarvis

HA, wallpanel, and Jarvis must:

- Treat events as display/interaction input.
- Resolve writes through the owning service tools.
- Drop mirrors on delete/reclassify events.
- Avoid storing private payloads in dashboard/file-sensor state.
- Ask for identity clarification when private namespace confidence is below
  threshold.

## Required Tests For E23-2 Completion

### T1 - Ambiguity Block

Input: Jarvis receives "Read my messages" with voice/face confidence `0.60`.

Expected:

- No query to `profile:{Identity}/personal`.
- Gemma asks who is speaking or requests stronger authentication.
- A shared namespace fallback is not used for personal messages.

### T2 - Cross-Profile Leak Test

Input: User A asks "What is User B's current to-do list?"

Expected:

- Gemma filters tool context by actor permissions.
- `guardian.family_todo.list` or future personal-todo tool rejects namespace
  mismatch.
- Response states that the personal list is not accessible.

### T3 - Ghost Protocol

Input: Memorr hard-deletes an asset, then Gemma recall searches for the exact
deleted topic.

Expected:

- Memorr tombstone exists.
- Gemma returns zero results for the deleted `canonical_ref`.
- HA/wallpanel cached thumbnail or card is gone.

### T4 - Shared-To-Private Reclassification

Input: A task moves from `profile:family/todos` to `profile:Iain/personal`.

Expected:

- Guardian emits reclassification event.
- Gemma removes the old shared vector before writing the private vector.
- Family namespace recall returns zero for that task.
- Iain personal namespace recall returns one result when identity is strong.
- HA shared wallpanel drops the task.

### T5 - Idempotent Replay

Input: The same mutation event is delivered three times.

Expected:

- Owner canonical record is not duplicated.
- Gemma index has one effective entry for the latest revision.
- HA mirror has one visible item.
- `idempotency_key` is recorded or derivable in consumer evidence.

### T6 - Owner-Only Canonical Write

Input: A Gemma cognitive memory write attempts to mark a Guardian task complete
without calling Guardian.

Expected:

- The mutation is rejected or stored only as advisory cognitive memory.
- Guardian canonical task state remains unchanged.
- Jarvis does not report completion.

### T7 - Memory Day Privacy And Provenance

Input: Iain asks "show me memories from 20/05/2005" with identity confidence
`0.98`.

Expected:

- Date is normalised to `2005-05-20`.
- Results from Memorr, Gemma, and Guardian include owner-backed
  `canonical_ref` values.
- Quarantined Memorr folders are omitted or reported as blocked.
- Empty or not-onboarded sources are reported as empty/not-onboarded.
- No result lacks timestamp evidence.

## E23-2 Exit Criteria

E23-2 is complete only when:

- The shared envelope and namespace schemas are versioned.
- Guardian, Gemma, and Memorr can validate the envelope before consuming it.
- At least one Guardian task example and one Memorr asset example validate.
- Delete and reclassification events have durable tombstone semantics.
- The six required isolation/replay/owner tests exist in the Amber test plan.
- Timeline/day-view query and result contracts exist with at least one privacy
  and provenance test.
- No active HA display path is treated as canonical memory/action state.
- No cognitive index entry can exist without `owner`, `namespace`,
  `canonical_ref`, `kind`, `privacy_class`, and `revision`.

## Implementation Notes For Later Phases

- Do not retrofit every existing memory route in one patch. Add envelope
  production at owner boundaries first, then consumers.
- Prefer owner payload schemas in owner repos, with AIGateway holding only the
  shared cross-service envelope/reference schemas.
- Keep payloads small. Large assets and large prompts should be reference-only.
- Use Amber Bus for production cross-service eventing. Direct calls are allowed
  only as documented data-plane exceptions or current transitional paths.
- Add schema validation to CI before enabling automatic mutation consumption.
