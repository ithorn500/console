# Gemma, Guardian, Memorr Memory Boundary And Production Plan

Status: architecture contract / production planning note
Date: 2026-05-26
Scope: Gemma Gateway, Guardian, Home Assistant wallpanel/Jarvis surfaces, and Memorr.

This note is the cut-once contract for Amber Network memory. It exists because the
word "memory" currently covers several different systems: cognitive recall,
asset storage, action state, RAG cargo, RL outcomes, family tasks, photographs,
emails, dashboard mirrors, and Jarvis voice interactions. Those systems must be
aligned before production work continues.

## Evidence Baseline

The current evidence points to this ownership split:

- Gemma Gateway already owns the active cognitive memory facade through
  `gg-beast-edge` and `/guardian/v1/memory/remember` /
  `/guardian/v1/memory/recall`, with BGE-M3/Qdrant-backed recall and auxiliary
  C++ knowledge/memory surfaces.
- Guardian's Epic E5 contract says Guardian uses Gemma Gateway for advisory
  recall and prompt cargo, while deterministic control, policy, vault writes,
  and apply safety remain in Guardian.
- Guardian E5 S-stages remain open for production maturity: observability,
  sync spine, single cargo contract, recall quality, output/apply safety, and a
  production gate.
- Home Assistant is the live device/entity/telemetry fabric and display
  boundary. It must not become the memory owner or action-policy owner.
- Memorr is the Amber Network memory/storage service workspace at
  `/mnt/memorr/opt/memorr`. Its repo currently has the source/workspace
  contract and early C++/assembler storage architecture, but no production
  service contract, schemas, deploy units, health endpoints, Bus contract, or
  runtime owner files yet.

## Vocabulary

Use these names consistently:

| Term | Owner | Meaning |
| --- | --- | --- |
| Cognitive memory | Gemma Gateway | Semantic recall, embeddings, profile facts, summaries, RAG context, graph-derived recall, and tool-selection context. |
| Tangible memory | Memorr | Cold storage and asset vault for photographs, emails, documents, videos, attachments, albums, timelines, and provenance. |
| Operational memory | Guardian | Canonical state for household tasks, control outcomes, policy decisions, approvals, RL rewards/outcomes, and action audit. |
| Display memory | HA / wallpanel / Jarvis | Mirrored or rendered memory/task views for humans. These surfaces are not authoritative stores. |

Qdrant, Mem0-compatible layers, graphs, and RAG indexes are cognitive recall
systems. They are not cold asset stores. Memorr is the cold asset store and the
tangible-memory service boundary.

## Ownership Contract

### Gemma Gateway

Gemma owns cognitive memory and intelligence-facing memory tools:

- `/guardian/v1/memory/remember` and `/guardian/v1/memory/recall`.
- Embedding, recall, summarisation, RAG, and namespace selection.
- Profile namespaces such as `profile:Iain/personal`,
  `profile:Iain/todos`, and `profile:family/todos`.
- Tool registration and tool selection for Guardian and Memorr tools.
- Identity-aware Jarvis interpretation once face/voice identity evidence has
  resolved the speaker or viewer.
- Semantic indexes and summaries for Memorr assets, always pointing back to
  Memorr-owned asset IDs.

Gemma does not own canonical household action state, physical actuation state,
or immutable asset bytes.

### Guardian

Guardian owns deterministic home state and action authority:

- Family to-do canonical records: ID, title, status, assignee, creator,
  source, timestamps, due date, recurrence, visibility, and audit trail.
- Action policy, approvals, apply safety, and physical/device control.
- Operational learning: entity trend models, runbook outcomes, RL reward/audit
  facts, policy adaptation candidates, and apply gates for household actions.
- Guardian-to-Gemma memory publishing and drift detection for Guardian-owned
  prompt cargo.
- HA sync/mirroring for wallpanel display.

Guardian may publish concise, typed memory facts to Gemma. Guardian must not
make Qdrant, Mem0, or Gemma recall the only copy of task/action truth.

The Guardian operational learning requirements contract is
`/mnt/guardian/src/docs/GUARDIAN_OPERATIONAL_LEARNING_CONTRACT.md`. It protects
the cleanup boundary: Guardian keeps self-learning operational models such as
spa thermal behavior, battery cycle behavior, solar forecast error, runbook
duration, and action outcomes, while Gemma receives explanation/recall facts and
Memorr receives durable evidence only when useful.

### Memorr

Memorr owns tangible memory: cold storage plus asset-backed Life memories.

Memorr should become the authority for:

- Immutable content objects for photos, emails, documents, videos, and
  attachments.
- Asset IDs, content hashes, source provenance, capture/import timestamps,
  storage locations, logical delete state, retention state, and privacy class.
- Mirrored durable storage under `/Data/Memories` and `/Vault/Memories`.
- Native FASTIO-backed MemorrDB catalog state, compression/checksum metadata,
  central_log evidence, and Amber Bus capability/event surfaces.
- Central_IO-managed mirror orchestration, compression/decompression, and native
  content de-duplication above FASTIO.
- Albums, timelines, collections, and asset relationships.
- Perceptual clusters, immutable lineage, semantic job/result records, scrub
  reports, and read-only media lease records.
- Non-destructive transformations: generated previews, OCR text, captions,
  transcripts, thumbnails, and derived metadata must point back to immutable
  originals.
- Cold storage lifecycle and sync status.

Memorr should expose asset and timeline tools to Gemma. Gemma may embed,
summarise, caption, and recall Memorr assets, but Gemma's vector store is an
index over Memorr assets, not the asset store.

Memorr should queue semantic processing and persist the results, but Gemma
Gateway owns model execution and cognitive interpretation. Memorr must request
captions, OCR, face/object/scene tags, visual embeddings, and text embeddings
through Amber Bus/Gemma capabilities rather than quietly taking over model
hardware or bypassing Gateway lane policy.

### Home Assistant, Wallpanel, And Jarvis

HA, wallpanel, and Jarvis are interaction/display surfaces:

- HA can mirror tasks and selected memory views for dashboards.
- Wallpanel can render family to-dos, albums, timelines, and recall cards.
- Jarvis can accept voice and face-aware commands, ask clarifying questions,
  and report outcomes.

These surfaces must call through Gemma/Guardian/Memorr ownership contracts.
They must not become hidden state owners.

### Amber Bus

Amber Bus should be the capability and event spine where cross-application
runtime integration is required. Direct private calls between sibling repos
should not become the normal production path unless explicitly documented as a
data-plane exception.

## Non-Negotiable Invariants

1. Qdrant, Mem0-compatible stores, graph recall, and RAG indexes must never be
   the only store for tangible assets.
2. Memorr stores asset bytes and asset provenance. Gemma stores cognitive
   indexes and summaries that reference Memorr `asset_id` values.
3. Guardian remains canonical for physical actions, household policy, task
   state, approvals, and apply safety.
4. HA and wallpanel display mirrored state. They are not memory or action
   authorities.
5. Every memory mutation needs an owner, namespace, `kind`, `source_system`,
   provenance, content hash or revision, privacy class, and drift status.
6. Profile memory must be identity-scoped. A command recognised as Iain writes
   to Iain's profile or to an explicit family/shared namespace.
7. Jarvis should use Gemma tools. Jarvis should not bypass Gemma to call private
   Guardian, HA, or Memorr implementation details.
8. Deleted, private, or retention-limited assets must be removed from cognitive
   recall indexes or marked unavailable by contract.
9. Degraded memory should degrade safely: no false action success, no invented
   asset IDs, no cross-profile leaks, and no physical apply based only on
   advisory recall.

## First Vertical Slice: Family To-Do

The family to-do feature is the correct first production slice because it forces
identity, memory, action state, HA display, and Jarvis interaction through one
small contract.

Example: "Jarvis, add put salt in the water softener."

Target flow:

1. Jarvis captures the utterance and face/voice evidence.
2. Gemma resolves identity as Iain with confidence and asks for clarification
   only if identity or intent is uncertain.
3. Gemma selects `guardian.family_todo.add`.
4. Guardian creates the canonical task:
   - title: `Put salt in the water softener`
   - creator: `Iain`
   - namespace: `family`
   - source: `jarvis_voice`
   - status: `open`
   - audit: face/voice identity evidence references, not raw biometric secrets.
5. Guardian emits/mirrors the task for HA wallpanel display.
6. Gemma writes concise semantic memory:
   - `profile:Iain/todos`: Iain asked to add the task.
   - `profile:family/todos`: the family has an open water-softener salt task.
   - Reference the Guardian task ID.
7. Jarvis confirms the result from Guardian's canonical response, not from
   memory-write success alone.

Failure handling:

- If Gemma memory is unavailable, Guardian still creates the task and marks
  memory sync pending.
- If Guardian is unavailable, Jarvis/Gemma must not claim the task was added.
- If HA is unavailable, the task remains canonical in Guardian and display sync
  catches up later.
- If identity is uncertain, the command should either ask "who is this for?" or
  write to an explicitly shared inbox with lower trust.

## Second Vertical Slice: Memory Day View

The memory-day view is the north-star product slice for tangible plus cognitive
memory.

Example: "Gemma, show me memories from 20/05/2005."

Internally this must be normalised to the unambiguous ISO date `2005-05-20`.
The response should feel like one day of memory, but it must be assembled from
owner-backed records:

1. Gemma parses the user, date, subject, and privacy context.
2. Gemma calls a timeline query contract for `2005-05-20`.
3. Memorr returns canonical assets from that day:
   - photos and videos;
   - emails, diary entries, documents, and attachments once onboarded;
   - file/source metadata and derived previews;
   - `canonical_ref` values such as `memorr:asset:...`.
4. Gemma returns cognitive memories:
   - captions;
   - summaries;
   - semantic links;
   - profile memories and graph facts that reference canonical records.
5. Guardian returns operational facts where relevant and authorised:
   - family to-dos;
   - runbook/action outcomes;
   - RL evidence;
   - house policy facts.
6. HA/wallpanel supplies display mirrors only, or approved house snapshots when
   those snapshots have a canonical owner.
7. Jarvis narrates the result without inventing empty sources or bypassing
   privacy boundaries.

The answer may include "I found no diary entries for that day" or "there are
private/quarantined items that need stronger identity" rather than filling gaps.

Memory-day result records must include:

- `owner`;
- `canonical_ref`;
- `namespace`;
- `source_system`;
- timestamp and timestamp evidence;
- `privacy_class`;
- confidence;
- summary/label;
- optional preview or asset reference.

Failure handling:

- If Memorr is unavailable, Gemma may still return Gemma/Guardian memories but
  must mark tangible assets unavailable.
- If identity confidence is too low, private/profile sources are blocked.
- If a source has not been onboarded, it is reported as not onboarded, not
  searched by an ad hoc path.
- If an asset was deleted or tombstoned, Gemma must not return vector ghosts.

## Third Vertical Slice: Tangible Memories

The next slice should prove Memorr's role.

Example: "Jarvis, remember these holiday photos with the emails from the hotel."

Target flow:

1. Memorr ingests photos and emails as immutable assets.
2. Memorr assigns stable `asset_id` values, hashes, provenance, privacy class,
   `/Data/Memories` and `/Vault/Memories` mirror state, and timeline hints.
3. Gemma captions/summarises/OCRs/transcribes through approved tools.
4. Gemma writes cognitive recall entries that reference Memorr asset IDs.
5. HA/wallpanel can render an album/timeline using Memorr previews and Gemma
   summaries.
6. Jarvis can answer semantic questions while returning Memorr-backed assets,
   never vector-store-only ghosts.

## Existing Use-Case Alignment

| Use case | Canonical owner | Cognitive owner | Display/interface |
| --- | --- | --- | --- |
| Family to-dos | Guardian | Gemma profile/task memory | HA wallpanel, Jarvis |
| Guardian strategy cargo / RAG | Guardian for truth and apply state | Gemma for recall and prompt cargo | Guardian C2 / Ops |
| RL outcomes | Guardian for reward/outcome truth | Gemma for advisory recall and summarisation | Guardian C2 / Ops |
| Photos, emails, documents | Memorr | Gemma indexes/summaries over Memorr assets | HA wallpanel, Jarvis, Memorr UI later |
| Memory day view | Memorr for assets; Guardian for operational facts; Gemma for cognitive refs | Gemma orchestration and narrative | Jarvis, HA wallpanel |
| Knowledge documents | Source repo or Memorr, depending on asset type | Gemma RAG/knowledge memory | Ops/Jarvis |
| HA entity state | HA as device/entity fabric; Guardian where policy/action state is derived | Gemma only as bounded recall summaries | HA, Guardian wallpanel |

## Production Plan

### Phase 0 - Inventory And Freeze

Goal: stop drift before building.

- Inventory all memory-like code paths in Gemma Gateway, Guardian, HA, and
  Memorr.
- Classify each as cognitive, tangible, operational, display, or legacy.
- Mark owner, runtime path, schemas/state files, APIs, and current deployment
  status.
- Freeze new memory-like implementations unless they name one of the owners in
  this document.

Exit criteria:

- One inventory table exists.
- Every active path has an owner and deprecation/keep decision.
- No new HA YAML, Guardian helper, or Gemma route is added as an unowned memory
  store.

### Phase 1 - Shared Contracts And Namespaces

Goal: make mutation shape explicit.

- Use [`shared-memory-mutation-schema-and-namespace-contract.md`](shared-memory-mutation-schema-and-namespace-contract.md)
  as the E23-2 contract of record.
- Define common fields: `owner`, `namespace`, `kind`, `source_system`,
  `source_id`, `content_sha256`, `revision`, `created_at`, `updated_at`,
  `privacy_class`, `retention_policy`, `drift_state`, and `canonical_ref`.
- Define namespace rules for personal, family/shared, Guardian/system, and
  Memorr asset scopes.
- Define delete/export/privacy propagation rules.
- Define cross-profile isolation tests.

Exit criteria:

- Contracts are documented and versioned.
- Guardian and Gemma agree on task and memory references.
- Memorr has a draft asset schema before implementation.

### Phase 2 - Gemma Cognitive Memory Hardening

Goal: make Gemma reliable as the cognitive memory owner.

- Keep `gg-beast-edge` as the active memory facade.
- Make recall quality measurable by namespace and `kind`.
- Surface memory-write success, pending, failed, and drift states.
- Ensure tool outputs can reference Guardian task IDs and Memorr asset IDs.
- Do not block decode on slow memory I/O; use post-completion writes where
  appropriate.

Exit criteria:

- Recall probes pass for profile, family, Guardian, and asset-reference
  namespaces.
- Failed memory writes are visible and retryable.
- No cognitive memory entry claims canonical ownership of Guardian or Memorr
  data.

### Phase 3 - Guardian E5 Production Maturity

Goal: finish the already-identified Guardian/Gemma memory maturity work.

This phase aligns with Guardian E5-S1 through E5-S6:

- E5-S1: observability and truth artifacts.
- E5-S2: debounced sync spine and drift blocking policy.
- E5-S3: single strategy cargo contract.
- E5-S4: recall quality and legacy retrieval retirement.
- E5-S5: output contract and apply safety.
- E5-S6: production validation gate.

Exit criteria:

- Drift is visible and actionable.
- Guardian never silently applies stale or failed Gemma strategy cargo.
- Legacy duplicate memory paths are either retired or explicitly marked
  development-only.

### Phase 4 - Memorr Asset Vault Contract

Goal: give tangible/Life memory a real owner.

- Define Memorr asset schema, object state machine, privacy model, and cold
  storage lifecycle.
- Define `/Data/Memories` warm mirror and `/Vault/Memories` cold mirror
  contracts, including mount checks, degraded state, recovery, and purge rules.
- Define MemorrDB so durable catalog state does not become massive JSON files.
- Define built-in compression/checksum metadata, Central_IO compression policy,
  and FASTIO write classes.
- Define native content de-duplication at the Central_IO/object layer while
  preserving every MemorrDB logical relationship.
- Define perceptual clusters, semantic processing jobs, cryptographic scrub,
  read leases, and immutable lineage as MemorrDB Life-engine records.
- Define central_log-only observability and Amber Bus-only external
  communication surfaces.
- Define ingestion contracts for photos, emails, documents, videos, and
  attachments.
- Define derived-object contracts for thumbnails, OCR text, captions,
  transcripts, summaries, and embeddings.
- Define Bus/Logger contracts and health endpoints.
- Keep Memorr implementation aligned with its repo contract: C++/assembler
  runtime unless the operator changes that contract.

Exit criteria:

- Memorr can ingest an asset without losing provenance.
- Gemma can index the asset by `asset_id`.
- Delete/privacy updates propagate to Gemma recall indexes.
- Derived/AI-touched artifacts keep lineage to originals.
- Storage-ready and semantic-ready states are separately visible.
- No broader `/mnt/memorr` runtime files are edited before the service contract
  exists.

### Phase 5 - Family To-Do Production Slice

Goal: ship the smallest user-visible feature that proves the architecture.

- Add Guardian canonical family to-do store/API.
- Add Gemma tool contracts for add/list/complete/search.
- Add identity-aware Jarvis command path.
- Add HA wallpanel mirror.
- Add memory write/read for profile and family semantic recall.
- Add tests for duplicate command handling, identity ambiguity, offline Gemma,
  offline Guardian, offline HA, and cross-profile isolation.

Exit criteria:

- "Jarvis, add put salt in the water softener" creates one Guardian task for
  Iain/family, displays on HA wallpanel, and is recallable through Gemma.
- Completion updates Guardian first, then HA/Gemma mirrors.
- The system can prove where the canonical record lives.

### Phase 6 - Memorr Tangible-Memory Slice

Goal: prove asset-backed memories end to end.

- Ingest a small set of photos/emails/documents into Memorr.
- Generate previews and metadata.
- Index summaries in Gemma with Memorr `asset_id` references.
- Query through Jarvis and display on wallpanel.
- Validate delete/export/privacy handling.

Exit criteria:

- Jarvis can answer from Gemma recall and retrieve/display Memorr-backed assets.
- No recalled asset exists only in Qdrant/Mem0-compatible storage.

### Phase 7 - Memory Timeline / Day View

Goal: make "show me memories from a date" work through owner-backed fan-out.

- Define `amber.memory.timeline.query.v1` and timeline result contracts.
- Normalise spoken/display dates such as `20/05/2005` to ISO dates such as
  `2005-05-20`.
- Fan out to Memorr assets, Gemma cognitive memories, Guardian operational
  facts, and approved HA/house mirrors.
- Include emails, diary entries, code/work records, and house snapshots only
  after their canonical source connector is onboarded.
- Require timestamp evidence, privacy class, namespace, and canonical ref for
  every result.

Exit criteria:

- Gemma can answer a date query without making any source the hidden canonical
  owner.
- Missing sources are reported as missing/not-onboarded.
- Private and quarantined sources are blocked without adequate identity.

### Phase 8 - HA And Wallpanel Surfacing

Goal: make surfaces useful without making them owners.

- Display family to-dos from Guardian.
- Display Memorr albums/timelines from Memorr plus Gemma summaries.
- Display memory sync/drift health.
- Avoid HA YAML control drift; Guardian remains action owner.

Exit criteria:

- Wallpanel works when HA is display-only.
- Loss of HA does not lose tasks, memories, or assets.

### Phase 9 - Privacy, Retention, Delete, Export

Goal: make memory safe enough for production.

- Implement subject/profile-level export.
- Implement logical delete and purge workflows.
- Implement asset deletion propagation from Memorr to Gemma indexes.
- Implement profile isolation tests for voice/face identity.
- Add audit records without storing raw biometric secrets in task records.

Exit criteria:

- A personal memory or asset can be exported and deleted by owner.
- Deleted assets do not remain semantically discoverable.
- Family/shared memory cannot leak private profile memory.

### Phase 10 - Soak And Go/No-Go

Goal: prove the joined system behaves under real household use.

- Run a soak with family to-dos, Guardian strategy cargo, and a small Memorr
  asset set.
- Track recall quality, drift, latency, duplicate writes, offline behavior,
  privacy failures, and HA display lag.
- Gate production on explicit success/fail criteria.

Exit criteria:

- No silent drift.
- No cross-profile leak.
- No vector-store-only asset.
- No claimed action success without Guardian canonical success.
- No hidden HA-owned action state.

## Tool Contract Direction

Initial tool families should be explicit and owned:

| Tool | Owner | Purpose |
| --- | --- | --- |
| `guardian.family_todo.add` | Guardian | Create canonical task. |
| `guardian.family_todo.list` | Guardian | List canonical tasks with filters. |
| `guardian.family_todo.complete` | Guardian | Complete canonical task. |
| `guardian.family_todo.update` | Guardian | Edit title, assignee, due date, visibility, or recurrence. |
| `gemma.memory.remember` | Gemma | Write cognitive memory using canonical references. |
| `gemma.memory.recall` | Gemma | Recall cognitive memories by namespace/kind/query. |
| `memorr.asset.ingest` | Memorr | Ingest tangible assets. |
| `memorr.asset.search` | Memorr + Gemma | Search by asset metadata plus cognitive recall. |
| `memorr.asset.get` | Memorr | Resolve asset/previews by `asset_id`. |
| `memorr.timeline.query` | Memorr + Gemma | Return timeline/day-view assets plus summaries. |
| `memorr.album.create` | Memorr | Create album/collection from Memorr assets. |
| `guardian.timeline.facts` | Guardian | Return authorised tasks/runbooks/action facts for a date range. |
| `gemma.timeline.compose` | Gemma | Orchestrate owner tools and narrate a memory day view. |

Gemma should orchestrate tool selection, but the owning service must enforce the
canonical write contract.

## Epic Alignment

Existing epics already cover parts of this:

- Epic 5: Gemma/Gateway memory substrate and Guardian E5 maturity.
- Epic 12 and Epic 15: Jarvis/Veliai Head interaction surfaces.
- Epic 16 and Epic 18: Guardian C2, wallpanel, and boundary hygiene.
- Epic 22: Amber Bus runtime spine.

Memorr is explicitly outside the current Guardian E5 S-stage scope. Epic 23 is
the full joined programme:

### Epic 23 - Memory Productionalisation

Goal: align Gemma cognitive memory, Guardian operational memory, Memorr tangible
memory, HA/wallpanel display, and Jarvis interaction into one production
contract.

Suggested tickets:

| Ticket | Title | Primary owner |
| --- | --- | --- |
| E23-1 | Memory path inventory and owner classification | AIGateway |
| E23-2 | Shared memory mutation schema and namespace contract | AIGateway + Guardian + Memorr |
| E23-3 | Gemma recall quality, drift, and write-status hardening | AIGateway |
| E23-4 | Guardian E5 S-stage production closeout | Guardian + AIGateway |
| E23-5 | Family to-do canonical Guardian store and Gemma tools | Guardian + AIGateway |
| E23-6 | HA/wallpanel to-do mirror | Guardian + HA |
| E23-7 | Memorr asset schema, state machine, and ingest contract | Memorr |
| E23-8 | Gemma indexing over Memorr asset IDs | AIGateway + Memorr |
| E23-9 | Jarvis identity-aware memory/task commands | AIGateway + Guardian |
| E23-10 | Privacy, delete, export, and profile isolation | All owners |
| E23-11 | Memory timeline/day-view contract and first date query | AIGateway + Memorr + Guardian |
| E23-12 | End-to-end soak and production gate | All owners |

## Go / No-Go Checklist

Production is a no-go if any of these are true:

- A task/action exists only in Gemma memory.
- A photo/email/document exists only in Qdrant, Mem0-compatible storage, or a
  derived summary.
- HA YAML or dashboard state is the only source of a task/action/memory.
- Guardian applies physical or policy changes based only on advisory recall.
- Jarvis reports success before the owning service confirms the write.
- Profile identity is uncertain but the write goes into a personal namespace.
- Delete/privacy changes do not propagate to cognitive recall.
- Drift is silent.

Production is a go only when:

- Every memory-like path has a named owner.
- Family to-do works end to end through Guardian, Gemma, HA/wallpanel, and
  Jarvis.
- Memorr can prove asset-backed recall with stable asset IDs.
- Offline/degraded behavior is visible and safe.
- The operator can inspect canonical truth, cognitive recall, display mirrors,
  and drift state separately.
