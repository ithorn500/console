# Amber Life Full R1 Implementation

Status: task definition
Date: 2026-06-03
Task: E31-F1-008
Scope: full graphical Amber Life R1 app implementation kept in lock-step across
iOS, macOS, and Windows.

## Intent

E31-F1-007 closed the Amber Life contract and Windows first slice. E31-F1-008 is
the product implementation task: turn Amber Life into a real daily-life app, not
a shell of tabs.

Windows may lead the first implementation pass because the first-slice app and
MSI already exist, but the product contract is platform locked:

- same tab names, concepts, and evidence model on iOS, macOS, and Windows;
- same Bus schemas and owner boundaries;
- same profile lock for `Iain`, `Sarah`, `Finn`, and `Josh`;
- same native DEMand-Mobile/Desktop transport on `17443`;
- same no-WebView, no-HTTP, no-direct-owner-service rule;
- same graphical interaction model, adapted to each platform's native controls.

## Product Surfaces

Amber Life R1 has six default surfaces.

| Surface | R1 function | Primary owner |
| --- | --- | --- |
| Veliai | Native graphical chat, streaming answer, context, attachments, memory/evidence rail, suggested actions. | Veliai/Gemma via Amber Bus |
| Guardian | Home/person/device state, spa, heating, lights, alerts, approvals, action proof, advice-vs-apply gates. | Guardian via Amber Bus |
| Email | Daily summaries, priority mail, thread cards, redaction, action candidates, defer/archive/task proposal. | Concierge + Memorr + Veliai via Amber Bus |
| To-Do | Family and personal boards, assignment, due state, recurrence, completion, proposal-to-task flow. | Guardian via Amber Bus |
| Life | Presence, photos, journal, files, clipboard, location where consented, around-me timeline, Memorr intake. | Amber Life + Memorr via Amber Bus |
| Settings | Profile lock, permissions, device keys, transport, notifications, tab library, privacy, update state. | Amber Life + Amber Bus |

Optional R1-library tabs remain `Crypto` and `Console`, but they must be native
tab modules over signed Amber Life descriptors, not hosted web views.

## Graphical Standard

R1 is visual-first. Text is used for labels, summaries, and evidence detail, not
as the primary interaction model.

Expected controls:

- Veliai: conversation stream, compact answer cards, source/evidence rail,
  context chips, attachment tray, action proposal cards, confidence/freshness
  indicators.
- Guardian: room/device tiles, spa/heating/light controls, grouped home-state
  board, approval sheets, action-progress timeline, failure/retry proof.
- Email: daily digest lanes, sender/thread cards, priority markers, quick
  actions, redact/raw toggle gated by local auth.
- To-Do: family board, personal board, swimlanes, due badges, assignee avatars,
  completion gestures, recurring-task indicators.
- Life: around-me timeline, photo/journal/file draft cards, presence map/state,
  storage/privacy indicators, Memorr sync progress, evidence overlays.
- Settings: permission matrix, connection state, update state, profile state,
  tab-library manager, revocation/degraded-state panels.

## Functional Slices

R1 implementation is split into controlled slices so another E31 agent can keep
working on Bus/Concierge infrastructure without collision.

1. Product shell and design system
   - Replace text-heavy shell panels with native graphical surfaces.
   - Define shared visual vocabulary for state, evidence, action risk, owner,
     confidence, freshness, and privacy.
   - Keep platform-specific navigation native: iOS tabs, macOS sidebar/toolbar,
     Windows navigation rail.

2. DEMand session and mock Bus adapter
   - Keep current endpoint selection and profile lock.
   - Add mock fixtures for Veliai, Guardian, Email, To-Do, Life, notifications,
     and update state so UI can advance while live schemas stabilize.
   - Real Bus integration must be behind typed adapters with the same interface
     as the mock adapter.

3. Veliai R1
   - Native streaming chat UI.
   - Conversation list, prompt composer, attachment/context tray.
   - Source/freshness/confidence rail for every answer.
   - Action proposals: create task, ask Guardian, save to Memorr, summarize
     email/thread, convert to Life draft.

4. Guardian R1
   - Graphical home and person status.
   - Spa, heating, lights, and alert controls as Bus-backed proposals.
   - Clear advice-vs-apply split.
   - Sensitive actions require local auth and Guardian approval evidence.
   - Every action shows pending/applied/denied/stale/failure proof.

5. Email R1
   - Daily summary dashboard.
   - Priority and unread cards.
   - Thread summary with raw-content gate.
   - Action candidates: reply draft, archive, defer, create To-Do, ask Veliai.
   - No mailbox credentials or direct Exchange/EWS/Graph access in the app.

6. To-Do R1
   - Family board and personal board.
   - Assignments, due dates, recurrence, complete/reopen/defer.
   - Convert Veliai, Email, Guardian, and Life proposals into task drafts.
   - Cross-profile private tasks require explicit family/shared scope.

7. Life R1
   - Around-me graphical timeline.
   - Photo sync/import drafts, journal drafts, file/clipboard/screenshot/camera
     drafts, and location/presence where consented.
   - Memorr intake state with confirm/delete/export/revoke.
   - Nothing becomes durable memory without explicit policy and evidence.

8. Notifications and presence
   - APNs, macOS UserNotifications, and Windows toast descriptors use the same
     Bus-backed notification contract.
   - Presence uses phone/desktop state, AMBER WiFi/local subnet evidence, stale
     timers, battery/power/storage health, and profile lock.

9. Life Evidence
   - Every answer, state, action, card, notification, sync item, and task exposes
     why Amber believes it.
   - Evidence includes owner system, source ref, profile scope, freshness,
     confidence, privacy class, retention class, Bus schema, correlation ID, and
     degraded/missing state.

10. Packaging, update, and release proof
    - Windows keeps full MSI plus in-app self-update.
    - macOS keeps signed/notarized package design plus in-app DEMand-Desktop
      update.
    - iOS keeps native App Store/TestFlight-style build assumptions and APNs.
    - Release proof includes screenshots or visual test captures for all six
      default surfaces on each platform before R1 green.

## Source Progress

The first Windows R1 source slice now exists in
`clients/windows/AmberLife.Windows`:

- `Models/AmberLifeR1Models.cs` defines the shared surface, metric, action,
  panel, and Life Evidence records.
- `IAmberLifeBusAdapter` defines the app data boundary used by mock and real
  adapters.
- `MockAmberLifeBusAdapter` provides complete native fixture snapshots for
  Today, Veliai, Guardian, Email, To-Do, Life, and Settings.
- `DemandAmberLifeBusAdapter` implements the same interface and overlays live
  DEMand session evidence when real transport is enabled.
- `MainWindow.xaml.cs` renders the six surfaces from typed snapshots and shows
  Life Evidence cards for each surface.

The first shared R1 schema/fixture now exists:

- `schemas/amber-life/amber.life.r1.snapshot.v1.schema.json`
- `data/amber-life/amber.life.r1.snapshot.fixture.v1.json`

This schema pins the six default surfaces, the optional Windows-led `today`
dashboard, and the Life Evidence field set that Windows, iOS, and macOS must
share.

This is source implementation progress, not R1 green. Remaining proof still
requires a Windows/.NET build, screenshots or UI automation capture, live
owner-backed Bus contracts, matching iOS/macOS contract evidence, packaging
verification, and Console/Logger evidence.

## Boundaries

E31-F1-008 owns the app experience, typed client adapters, visual behavior, and
client-side tests. It does not move owner truth:

- Veliai owns model execution and inference routing.
- Guardian owns real-world action and home automation truth.
- Concierge owns email ingress and hygiene.
- Memorr owns durable memory, photo, journal, and Life records.
- Logger owns audit/history.
- Amber Bus owns transport, routing, descriptors, and evidence contracts.

## Go / No-Go

Go when:

- all six default surfaces are implemented graphically on Windows and specified
  in matching iOS/macOS contracts;
- mock fixtures and real Bus adapters share the same typed interface;
- every surface has Life Evidence;
- Guardian control actions are proposal/approval/proof flows, not direct device
  calls;
- Email uses Concierge summaries only;
- Life drafts require consent and visible Memorr handoff state;
- Windows MSI/update still builds and downloads from Amber Bus.

No-go when:

- any production surface uses WebView, hosted Console, HTTP REST, owner-service
  URLs, or direct Exchange/Guardian/Memorr/Veliai calls;
- the Windows app grows a platform-only schema that iOS/macOS cannot consume;
- the UI is primarily text status panels instead of graphical controls;
- Guardian actions skip approval/proof;
- Photos, journal, files, or location become durable memory without consent;
- a second agent changes the same shared Bus/E31 contract files without a
  coordination checkpoint.
