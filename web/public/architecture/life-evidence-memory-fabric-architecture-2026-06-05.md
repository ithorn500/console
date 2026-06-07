# Life Evidence Memory Fabric Architecture

Status: operator-supplied architecture diagram captured as repo documentation
Date: 2026-06-05
Scope: Life evidence feeds, Amber Bus/LSB/Concierge, NeuFAB, Memorr, and produced memory surfaces

This document preserves the 2026-06-05 operator diagram for the Life Evidence -> Amber Bus ->
NeuFAB -> Memorr -> Produced Memories flow. The source was supplied as an inline image in the Codex
thread; the client did not expose a raw bitmap file in `/root/.codex/attachments`, so this file keeps
the architecture content as a durable markdown/Mermaid artifact.

## Diagram

```mermaid
flowchart LR
  subgraph Feeds["Life Evidence Feeds"]
    direction TB
    F1["1. Photos / Videos<br/>/Data / Vault / iCloud / Amber Life"]
    F2["2. Amber Life Journal<br/>manual entries + suggestions"]
    F3["3. Email<br/>threads, senders, attachments"]
    F4["4. Calendar / PIM<br/>meetings, trips, events"]
    F5["5. Documents<br/>bills, statements, PDFs"]
    F6["6. OCR / Text Extraction<br/>PDF, image, scanned docs"]
    F7["7. Presence / Devices<br/>iCloud, Amber Life, WiFi, HA"]
    F8["8. Guardian Events<br/>locks, doors, devices, policy"]
    F9["9. Veliai Observations<br/>cameras, faces, voice, plates"]
    F10["10. Home Assistant<br/>sensors, location, state"]
  end

  subgraph Bus["Amber Bus + LSB Reflex Layer"]
    direction TB
    AB["Amber Bus<br/>contracts, invokes,<br/>events, UI data plane"]
    LSB["LSB<br/>context flags /<br/>reflex signals<br/>not the worker"]
    CON["Concierge<br/>cloud providers,<br/>email, Apple/iCloud"]
  end

  subgraph NeuFAB["NeuFAB Brain Fabric"]
    direction TB
    VID["Veliai-ID<br/>face detection,<br/>embeddings,<br/>identity match"]
    VEL["Veliai<br/>scene understanding +<br/>language synthesis"]
    VP["Voice Print<br/>speaker identity<br/>evidence"]
    OCR["OCR /<br/>semantic classifiers"]
  end

  subgraph Memorr["Memorr: Source of Truth + Memory Engine"]
    direction TB
    Intake["Evidence Intake<br/>owner refs only"]
    Ledger["MDBX Evidence Ledger<br/>photos, faces, exif, email, docs,<br/>calendar, presence, journal"]
    Identity["Canonical Identity<br/>Iain, Sarah, Finn, Josh,<br/>friends, family, unknowns"]
    Work["Lazy Work Queues<br/>bounded batches,<br/>day/night policy"]
    Correlator["Memory Correlator<br/>who + where + when + what + why"]
    Formation["Life Memory Formation Engine<br/>scene last, context first"]
    Store["Authority Memory Store<br/>.memories, relationship hints,<br/>profile timelines"]
  end

  subgraph Surfaces["Produced Memories + Surfaces"]
    direction TB
    S1["Life Memories<br/>holiday, party, visit,<br/>family moment"]
    S2["People Memories<br/>faces, voice, relationships,<br/>presence"]
    S3["Place Memories<br/>home, Hat Creek,<br/>Guildford, Frimley"]
    S4["Admin Memories<br/>bills, statements,<br/>disputes, renewals"]
    S5["Journal Suggestions<br/>recent moments<br/>to write about"]
    S6["Guardian Context<br/>home/away, device<br/>health, risk"]
    S7["Amber Life App<br/>Home, Photos, Journal,<br/>People, Insights"]
    S8["Home Assistant<br/>Guardian Integration"]
    S9["Amber Console<br/>operator truth + evidence"]
  end

  F1 --> AB
  F2 --> AB
  F3 --> AB
  F4 --> AB
  F5 --> AB
  F6 --> LSB
  F7 --> LSB
  F8 --> LSB
  F9 --> CON
  F10 --> CON

  LSB --> AB
  CON --> AB
  AB --> VID
  CON --> OCR

  VID --> Intake
  VID --> Ledger
  VEL --> Ledger
  VP --> Correlator
  OCR --> Ledger
  OCR --> Correlator

  Intake --> Ledger
  Ledger --> Identity
  Ledger --> Work
  Identity --> Correlator
  Work --> Correlator
  Correlator --> Formation
  Formation --> Store

  Ledger --> S1
  Ledger --> S2
  Ledger --> S3
  Ledger --> S4
  Work --> S5
  Correlator --> S6
  Store --> S7
  Store --> S8
  Store --> S9

  S1 -. "results / enrichment" .-> Ledger
  S2 -. "results / enrichment" .-> Ledger
  S3 -. "results / enrichment" .-> Ledger
```

## Flow Semantics

- Primary data flow: evidence and signals move from Life Evidence Feeds through Amber Bus,
  LSB/Concierge, NeuFAB, and into Memorr.
- Processing and analysis: queued work belongs in NeuFAB/Veliai/OCR/semantic classifier paths,
  with lazy Memorr work queues for bounded batch processing.
- Results and enrichment: produced memories and surfaces return enrichment to the MDBX evidence
  ledger and Authority Memory Store as owner-backed refs.

## Boundary Notes

- Amber Bus carries contracts, invokes, events, and the UI data plane.
- LSB supplies context flags and reflex signals; it is not the worker.
- Concierge owns cloud/provider/email/Apple/iCloud ingress and route authority.
- NeuFAB is the brain fabric for identity, scene, voice, OCR, semantic classification, and working
  state.
- Memorr is the source of truth and memory engine; its evidence ledger and authority memory store
  hold durable memory truth.
- Produced memories and surfaces consume owner-backed memory outputs; they do not become durable
  truth stores.
