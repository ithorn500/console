# Veliai Client Brain Edge

Date: 2026-06-02

## Purpose

The `:11434` Veliai Client surface is the operator chat front door for Veliai. It keeps the seeded llama.cpp web UI codebase, but the backend contract is Veliai-owned rather than llama.cpp-owned.

This slice makes each chat request a Veliai brain turn:

- `veliai-client-edge` accepts OpenAI-compatible `/v1/chat/completions`.
- The request body remains compatible with downstream clients.
- The native edge derives profile, userspace, namespace, conversation, model, queue id, and brain-turn id.
- The native edge makes a bounded Memorr owner recall attempt against `/api/memorr/veliai/profile/recall`.
- The native edge exposes `/api/veliai/client/conversations` for the UI and backs it with Memorr owner endpoint `/api/memorr/veliai/profile/conversations`.
- If recall succeeds and returns candidates, the edge injects descriptor-only profile memory context as a system message before Veliai routing.
- If recall fails, the edge forwards the chat normally and exposes the failure state in response headers.
- For non-streaming chat, the native edge can make Amber Bus Veliai Queue the response owner by submitting `veliai.queue.admit` with `wait_for_result:true` and `admission_contract: veliai.queue.response_owner.v1`.
- After a successful `veliai-client` queue-owned chat turn, Amber Bus submits a bounded Memorr formulation job so the conversation can later be discovered as a Memorr-owned profile descriptor.
- Queue response ownership is controlled by `VELIAI_CLIENT_QUEUE_RESPONSE_MODE=preferred|required|off` or request field `veliai_queue_response_mode`.
- In `preferred` mode, queue failure falls back to the direct Veliai Router path and still records the turn through the shadow ledger path.
- In `required` mode, queue failure is surfaced to the caller instead of silently bypassing the Bus lane.
- Streaming chat remains direct Veliai Router execution with asynchronous shadow admission until the Bus has a streaming queue response contract.
- The edge forwards the request to the Veliai router with `veliai.queue.brain_turn.v1` headers.
- The response exposes the same queue and context evidence headers to the browser/API caller.

## Current Runtime Boundary

This is now a mixed proof boundary:

- Non-streaming chat can be queue-owned: `:11434` submits to Amber Bus owner endpoint `/api/veliai/queue/admit`, Amber Bus writes the queue ledger row, executes Veliai Router, records response/timing, and returns the provider body to the existing UI/API caller.
- Streaming chat remains direct-router with shadow ledger admission because the Bus streaming response contract is not implemented yet.
- Fallback from queue-owned to direct-router is allowed only in `preferred` mode; `required` mode is the proof gate for strict queue ownership.
- Memorr recall remains descriptor-only and does not mutate Memorr storage.
- Memorr conversation discovery is descriptor-only and does not expose raw memory payloads or private Memorr paths.
- Queue-to-Memorr formulation is best-effort and descriptor-only. It stores bounded user/assistant summaries, queue refs, conversation refs, namespace, and privacy policy; it does not store raw browser chat trees as a Memorr message server.

Current path:

`Veliai Client UI (:11434) -> veliai-client-edge native C++ -> bounded Memorr recall -> Amber Bus /api/veliai/queue/admit -> Veliai Router/Ops (:11430) -> selected AI lane -> Amber Bus queue response/timing ledger -> UI/API caller`

Concierge brain request path introduced after the chat proof:

`Concierge / amber-queue -> Amber Bus veliai.queue.admit -> NeuFAB context descriptor / owner refs -> Veliai Router multi-lane execution -> queue response/timing ledger`

This path uses `source_app: concierge`, `job_type: concierge_brain_request`, and `requested_capability: concierge.brain.request`. The queue emits a `neufab.concierge_brain_context.v1` descriptor into the Veliai body metadata and prompt context. That descriptor carries profile namespace, owner refs, frame intent, and routing hints only; it explicitly marks `raw_payload_visible:false`, `raw_payload_logged:false`, and `owner_refs_only:true`. If the request privacy gate is `redacted_cloud_allowed`, the queue labels the route as `profile_private_redacted` so Veliai can hunt across local and cloud lanes without pretending raw profile payloads are present.

Completed chat memory formulation path:

`Amber Bus queue completion -> Memorr /api/memorr/formulation/jobs -> formulated profile memory -> Memorr /api/memorr/veliai/profile/conversations and /recall`

Streaming/fallback path:

`veliai-client-edge -> bounded Memorr recall -> direct Veliai Router/Ops (:11430) -> selected AI lane`, with `veliai-client-edge -> /api/bus/invoke/veliai.queue.admit -> shadow_recorded` evidence in the background.

Memorr profile recall path introduced in this slice:

`Memorr owner service -> /api/memorr/veliai/profile/recall -> formulated-memory candidates for profile namespace`

Memorr profile conversation discovery path:

`Veliai Client UI -> /api/veliai/client/conversations -> veliai-client-edge -> Memorr /api/memorr/veliai/profile/conversations -> formulated-memory conversation descriptors`

Target path after Epic 29 promotion:

`Veliai Client UI (:11434) plus Concierge / amber-queue -> Veliai Queue native admission -> NeuFAB context/memory retrieval -> Veliai Router multi-lane execution -> Memorr owner-backed memories`

## Context Policy

Profile spaces are context protectors, not security barriers. The default profile is `Iain/personal`, expressed as `profile:Iain/personal`. A `Crypto` profile can keep crypto memories scoped while still allowing Iain to request access through the correct route.

The edge never requests raw memory payloads. It carries descriptor evidence only and marks the context as hints, not commands. Raw payload retrieval remains a Memorr owner decision and requires a separate owner-approved lease/path API.

The seeded llama.cpp UI still keeps local editable conversation trees in browser IndexedDB for active chat mechanics. Veliai Client now merges Memorr-owned conversation descriptors into the sidebar as owner-backed rows. Opening such a row displays the bounded Memorr descriptor. If the operator starts a follow-up from that descriptor, the UI materialises a new local chat seeded with the Memorr descriptor as system context; it does not write new turns into Memorr directly.

## Runtime Evidence Headers

Brain-turn responses from `:11434` carry:

- `X-Veliai-Queue-Mode`
- `X-Veliai-Queue-Contract`
- `X-Veliai-Queue-Id`
- `X-Veliai-Brain-Turn-Id`
- `X-Veliai-Profile`
- `X-Veliai-Userspace`
- `X-Veliai-Memory-Namespace`
- `X-Veliai-Conversation-Id`
- `X-NeuFAB-Frame-Intent`
- `X-NeuFAB-Memory-Route`
- `X-Veliai-Queue-Admit`
- `X-Veliai-Queue-Admit-Mode`
- `X-Veliai-Queue-Admit-Request-Id`
- `X-Veliai-Queue-Admit-Ms`
- `X-Veliai-Queue-Response`
- `X-Veliai-Queue-Response-Mode`
- `X-Veliai-Queue-Response-Request-Id`
- `X-Veliai-Queue-Response-Ms`
- `X-Veliai-Queue-Provider-Status`
- `X-Veliai-Memorr-Recall`
- `X-Veliai-Memorr-Candidate-Count`
- `X-Veliai-Memorr-Recall-Ms`
- `X-Veliai-Memorr-Conversations`
- `X-Veliai-Memorr-Conversations-Ms`

## Validation

Validation for this slice is:

- `veliai-client-edge` builds as native C++.
- `/api/veliai/client/brain-edge/status` reports `queue_mode: queue_response_for_non_stream_shadow_for_stream_or_fallback`.
- `/v1/chat/completions` returns `X-Veliai-Queue-Contract: veliai.queue.brain_turn.v1`.
- A non-streaming `/v1/chat/completions` request with `VELIAI_CLIENT_QUEUE_RESPONSE_MODE=required` returns `X-Veliai-Queue-Response: done` and `X-Veliai-Queue-Admit: queue_owned_response`.
- The same queue id exists in Amber Bus `veliai_queue_jobs` as a `done` `veliai-client` / `veliai_chat_turn` row with attempts `1`, provider response text, and timing evidence.
- `:11434/api/veliai/client/conversations` returns `memorr.veliai.profile_conversation_index.v1` descriptors without raw payloads or private Memorr paths.
- A successful `veliai-client` queue-owned chat turn creates a Memorr formulated profile descriptor; a later conversation-index call shows the conversation and a recall query returns the same artifact.
- A `concierge` / `concierge_brain_request` queue proof reaches Veliai as `chat.profile_context`, includes `neufab.concierge_brain_context.v1`, preserves owner refs only, blocks raw payload fields, and records a done Concierge ledger row.
- A controlled Memorr recall proof returns `X-Veliai-Memorr-Recall: available`, `X-Veliai-Memorr-Candidate-Count: 2`, and increases prompt tokens, proving the descriptor context reached the selected lane.
- The live path returns `X-Veliai-Memorr-Recall: available`. With zero candidates, the edge does not inject an empty descriptor and prompt tokens remain normal.
- A controlled Amber Bus queue proof can be run with `VELIAI_CLIENT_QUEUE_ADMIT_INLINE=1` and returns `X-Veliai-Queue-Admit: accepted`.
- Streaming or fallback paths return `X-Veliai-Queue-Admit: submitted_async` immediately and later show the same queue id in the Amber Bus `veliai_queue_jobs` ledger as a non-runnable `shadow_recorded` `veliai-client` record.
- Amber Bus auth is token-if-configured: when `AMBER_BUS_RUNTIME_TOKEN` is unset on the Bus, the lab/open runtime accepts local registered traffic; when set, `veliai-client-edge` sends the configured token.
- The UI sends `conversation_id`, memory profile, userspace, namespace, and context policy.
- Memorr exposes `/api/memorr/veliai/profile/recall` as the owner-backed profile recall endpoint for Veliai/NeuFAB.
- Memorr exposes `/api/memorr/veliai/profile/conversations` as the owner-backed profile conversation descriptor index for Veliai/NeuFAB.
- No dependency on `:11438` is introduced.
