# Memory model

**Status:** Normative for the active checkout.
**Last updated:** 2026-05-07 — Epic 5 unified memory façade update.

This document separates implemented memory code from target/archived memory narratives. Older
docs and follow-up tickets still reference a Python `app/services/*` memory stack. In the
current checkout, that Python tree is not present. The active implementation is C++-first:
`gg-beast-edge` owns the Guardian memory façade and calls the BGE-M3 embed lane plus Qdrant
directly.

---

## Core Rule

Memory must not mutate an admitted inference turn in a way that breaks the turn boundary.

Gemma memory is deliberately close to context and token generation. The
production-safe form is **token/context-adjacent** rather than a distant
Guardian-side RAG bolt-on: retrieve, rank, govern, and assemble bounded memory
before generation; observe decode-adjacent state through native hooks where
enabled; write back after the turn.

Terminology matters:

- Qdrant returns vector-search hits and payloads.
- BGE-M3 produces embeddings/rerank signals.
- Mem0-compatible layers provide memory orchestration/metadata semantics where
  enabled.
- LangGraph-style flows orchestrate retrieval/reasoning/tool paths.
- llama.cpp/Gemma tokenizes selected textual context, or consumes approved
  tensor/embedding paths where native hooks support them.

Those systems do not, by themselves, constitute active memory. They become
Gemma memory only when selected owner-backed content is admitted into the
active context/token/tensor path for the current turn.

The practical limit is context-window economics. The job is not to retrieve
"more"; it is to stream the **right memories**, in the **right format**, with
the **right token cost**, into the Gemma context window that is actually going
to answer. The active lane split matters:

- `:11434` chat is the primary Gemma 31B lane with `n_ctx: 32768`.
- `:11436` fast is the Gemma e4B fast lane with `n_ctx: 131072`.
- `:11435` embed is the BGE-M3 lane for retrieval/indexing, not chat.

The 128k fast lane is therefore not just a faster small model; it is a memory
staging and compression asset. It can hold wider recall packs, perform
summarisation/consolidation, and prepare compact strategy context for the 32k
primary chat lane when the larger model should answer.

Memorr formulated memories extend this rule. Gemma can be asked to find the
pattern in a bounded evidence pack and generate a compact formula or summary:

```text
Gemma, here are 50 facts. Find the pattern to optimise memory storage and
retrieval. Generate a formula if possible.
```

That formulation may run on local fast Gemma, local primary Gemma, Ollama
Cloud, Gemini, OpenAI, or an approved subscription handoff depending on privacy,
context size, expected quality, cost, and budget policy. The output is not
canonical until Memorr stores it as an owner-backed formulated memory with
evidence refs and provenance.

The safe shape remains:

1. Build request context.
2. Retrieve or attach memory before generation starts.
3. Admit and run one inference turn.
4. Stream or return one response.
5. Write back memory after completion.

Decode-time hooks may observe and enqueue bounded events, but blocking vector I/O or governance
decisions inside the hot decode path remain out of scope.

---

## Implemented Today

| Layer | Active implementation | Notes |
|-------|-----------------------|-------|
| **Request-local context** | Client `messages`, request metadata, `memory_namespace` fields parsed by edge/native helpers | Rebuilt per request |
| **Unified Guardian memory façade** | `POST /guardian/v1/memory/remember`, `POST /guardian/v1/memory/recall` in `native/gg_beast_edge/guardian_handler.hpp` | Single active `remember` / `recall` contract for C++ shell |
| **BGE-M3 + Qdrant memory store** | `native/gg_beast_edge/guardian_handler.hpp`, `native/gg_beast_edge/qdrant_client.hpp` | Chunked ingest, 1024-dim BGE-M3 embeddings, namespace + tier filters, Qdrant collection guard |
| **System tool registry namespace** | `system:tool_registry` records with `source_type:"tool_schema"` | Optional persisted descriptors for dynamic toolbox selection; not user/person memory |
| **Guardian memory clusters** | `native/gg_beast_edge/memory_manager.hpp` | In-memory clusters, approve/reject, golden pinning |
| **Guardian knowledge retrieval** | `native/gg_beast_edge/knowledge_base.hpp` | Namespaced items with embeddings, cosine search, TSV snapshot under `data/run` |
| **Native runtime context** | `native/engine/src/context_memory_manager.cpp` | Namespace-scoped in-process helper exposed through `gemma_engine` |
| **Latent hook plumbing** | `native/engine/src/latent_hook_queue.cpp`, `decode_post_step_registry.cpp`, `mem0_grounding_sampler.cpp` | Infrastructure exists; product memory behavior is not complete end to end |
| **KV / prefix experiments** | `native/engine/src/kv_injection_experimental.cpp`, `kv_residency_manager.cpp` | Experimental and gated; not default recall |

The active checkout therefore has two memory proximities:

- **Production default:** `gg-beast-edge` uses the BGE-M3 embed lane and Qdrant
  before generation, then injects bounded recall as ordinary context.
- **Native/experimental proximity:** `gemma_engine` exposes decode-post-step
  hooks, embeddings/logits views, latent queues, context memory helpers, and
  sampler scaffolding close to the llama.cpp decode path. These are designed to
  keep memory near token generation while avoiding blocking vector I/O inside
  hot `llama_decode` loops.

The active C++ edge also keeps legacy-compatible `POST /guardian/v1/ingest` and
`POST /guardian/v1/retrieve` aliases, but new call sites should prefer the memory façade paths.

Tool schemas and capability descriptors are allowed to use the same BGE-M3/Qdrant substrate, but
only as system metadata under `memory_namespace:"system:tool_registry"` with
`source_type:"tool_schema"`. They must not be written to profile/person namespaces and must not be
described as a separate RAG stack.

---

## Not Implemented In This Checkout

These names appear in older docs, tickets, and sample artifacts, but the corresponding active
files are absent:

- `app/services/agent_stack.py`
- `app/services/mem0_orchestrator.py`
- `app/services/latent_memory_orchestrator.py`
- `app/services/memory_categorizer.py`
- `app/api/chat.py`
- `app/api/guardian.py`

Do not cite those as implemented until the Python Gateway shell is restored or the behavior is
ported to active C++/native modules.

---

## Practical Layers

### Short-Term

Short-term memory is the effective context for one request:

- chat `messages`
- request metadata such as `memory_namespace`
- retrieved snippets or Guardian knowledge items included before generation
- any native runtime context attached to the namespace

It is reconstructed per turn. The façade also accepts `memory_tier:"short"` for explicitly
remembered short-lived facts; default TTL is `GG_MEMORY_SHORT_TTL_SECONDS` or 6 hours.

### Medium-Term

Medium-term memory in active code is:

- namespace-scoped BGE-M3 embeddings stored in Qdrant through `/guardian/v1/memory/remember`;
- dense semantic recall through `/guardian/v1/memory/recall`;
- chunk metadata (`doc_id`, `chunk_index`, `chunk_count`) and governance metadata
  (`approved`, `golden`, `salience`, `ttl_seconds`, `expires_at`);
- Guardian `KnowledgeBase` and `MemoryManager` remain auxiliary C++ surfaces.

Default medium TTL is `GG_MEMORY_MEDIUM_TTL_SECONDS` or 30 days.

### Long-Term

Long-term memory is implemented as durable Qdrant records with `memory_tier:"long"` and no
expiry by default (`GG_MEMORY_LONG_TTL_SECONDS=0`). It is useful for explicit operator-approved
facts and golden pins.

What is still outstanding is **autonomous governance**: automatic promotion from short/medium to
long, pruning, conflict resolution, and approval workflows. Those remain coordinated by F-100
and F-120.

---

## Current Truth vs Target State

**Current truth:**

- C++ Guardian memory façade, memory ingest/recall, and knowledge retrieval are implemented.
- BGE-M3 + Qdrant dense memory is active and tested through the façade.
- Native context memory and latent hook infrastructure exist.
- Experimental KV/state injection exists but is not default recall.
- Python Mem0/Qdrant orchestration files referenced by older docs are absent.

**Target state:**

- Automatic promotion/pruning/governance for short, medium, and long-term memory.
- User/global partition merge policy and golden-pin ranking.
- Optional sparse/multi-vector/rerank support once exposed by the active embed/rerank path.
- Wider Ops UI presentation for memory source, namespace, TTL, and governance decisions.

---

## Practical Takeaway

When extending memory, keep the turn atomic:

- retrieve before admission,
- decode without blocking memory I/O,
- write back after completion,
- expose whether the behavior is C++ edge memory, native engine context, or a future restored
  Python service.
