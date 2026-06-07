# Amber Life iOS App Design

Status: product and architecture design
Date: 2026-06-02
Scope: future Amber Life iOS client for Veliai, family to-dos, email summary, Guardian, encrypted internet access, phone presence, and notifications.

## Evidence Baseline

This design follows the current owner boundaries:

- [`amber-life-journal-app.md`](amber-life-journal-app.md) defines the native
  Amber Life Journal product contract: Timeline, Composer, Journaling
  Suggestions, app lock, reminders, local persistence, and Memorr sync.
- [`amber-life-style-guide.md`](amber-life-style-guide.md) defines the unified
  iOS/Windows Amber Life visual language, palette, typography, relationship
  labels, page layout, and Veliai interaction tab direction.
- `docs/Amber-Console-E36-plan-and-delivery.md` makes Amber Life client state Console-visible proof, not a backend.
- `docs/architecture/veliai-client-brain-edge.md` defines Veliai Client as the operator chat front door, with Veliai Queue, Memorr recall, and conversation descriptors.
- `docs/architecture/gemma-guardian-memorr-memory-boundary.md` defines Guardian as task/action truth, Memorr as durable asset/email memory truth, and Gemma/Veliai as cognitive recall and interpretation.
- `docs/Concierge-E35-plan-and-delivery.md` makes Concierge the long-term mail/PIM ingress owner, with typed Memorr archive candidates and Veliai-assisted triage.
- `docs/Guardian-E37-plan-and-delivery.md` makes Guardian the physical-world operational authority, with actions and apply gates exposed through Amber Bus.
- `docs/Amber-Bus-E31-plan-and-delivery.md` defines the Amber Bus Concierge Internet connector as the encrypted internet edge for approved mobile clients.
- Apple Photos integration should use PhotosUI/PhotoKit user-selected or limited-library access, not silent whole-library scraping.
- Apple Journal-style integration should use the Journaling Suggestions picker for user-selected moments where available; Amber Life does not assume private write access to Apple's Journal app store.

There is now a first-class iOS app skeleton at `clients/ios/AmberLife.iOS` with
a minimal Xcode project and TestFlight archive helper. It remains an Amber Life
client product surface, not an AIGateway runtime service or a Guardian tablet
variant.

## Change Process Notes

Affected runtime paths:

- iOS app shell: future Amber Life client source tree, likely outside the current Android Guardian tablet subproject.
- Data plane: Amber Bus contracts only, including the Concierge Internet encrypted client connector for off-LAN access.
- Owner services: Veliai/Gemma Gateway, Guardian, Memorr, Concierge, Logger, and optional Console display cache.
- UI surfaces: iOS app, Console web, and Console Windows contract health views.

Unaffected paths:

- No systemd unit changes.
- No LLM lane, model registry, load command, or startup path changes.
- No direct Memorr, Guardian, Concierge, or Veliai private API calls from the iOS UI.
- No runtime Python service is introduced.
- No long-lived private key, shared symmetric secret, owner-service token, mailbox credential, or Bus root credential is baked into the public app binary.
- No WebView, embedded browser shell, HTTP REST chat path, or hosted Veliai web UI is used for the Veliai tab's primary experience.

Success criteria:

- The iOS app can show live state, activity, errors, degraded modes, owner references, and action evidence for each tab.
- Every operational read and write goes through Amber Bus.
- The app can connect over the internet with zero manual client configuration after install through the encrypted Concierge Internet connector.
- The Veliai tab uses a native SwiftUI interface and direct native framed API transport into Veliai through Amber Bus/Concierge Internet.
- Settings provides a Tab Library so approved existing Amber surfaces can be added or removed without shipping a new hard-coded tab bar; the first optional tabs are `Crypto` and `Console`.
- Every default and optional tab uses native SwiftUI surfaces and native Amber Bus frames. No Amber Life tab drops to HTTP, WebView, hosted web UI, browser storage, or REST polling for production data.
- Device presence, phone health, location, background state, and notification state are visible through scoped Bus contracts.
- Photos, journal suggestions, share-sheet imports, and phone-native moments can become Memorr-backed life records only after explicit user selection and owner-visible consent.
- The app offers an opt-in Photos-to-Memorr sync that runs under the locked first-run profile, preserves limited-library consent, and writes only to Memorr-owned profile namespaces through Amber Bus/Central_IO leases.
- The app offers a first-class Journal surface matching
  [`amber-life-journal-app.md`](amber-life-journal-app.md): timeline cards,
  composer, Apple Journaling Suggestions picker, reflections, local app lock,
  reminder schedule, offline local persistence, and Memorr sync over Amber Bus.
- First run asks who is using the app: `Iain`, `Sarah`, `Finn`, or `Josh`. The selected person locks the app's Amber Bus session, Memorr namespace, Veliai memory namespace, Guardian presence subject, and default task/email/journal ownership until an approved re-enrollment or profile-switch flow occurs.
- Guardian remains canonical for to-dos and physical actions.
- Memorr remains canonical for durable email/archive objects.
- Veliai provides summaries, chat, triage, and advice without becoming task, email, or action truth.

Failure criteria:

- The app logs into mail directly.
- The app reads Memorr files or owner DBs directly.
- The app calls private Guardian or Gateway endpoints for operational data.
- The app requires manual router, VPN, certificate, or endpoint setup by the user after install.
- The app embeds reusable private keys or bearer secrets that cannot be revoked per device/install.
- The Veliai tab drops into a web page, WebView, HTTP REST chat endpoint, or JSON-over-HTTP compatibility path for production chat.
- Optional tabs such as Crypto or Console Ops open a web console, call HTTP APIs directly, poll REST endpoints, or bypass Amber Bus tab contracts.
- A Veliai answer is presented as an applied Guardian action without Guardian proof.
- Email bodies with credentials or secrets enter ordinary Veliai context without Memorr/Concierge redaction.
- Photos, journal suggestions, or share-sheet content are imported to Memorr without user confirmation, privacy class, retention class, and source refs.
- Photo sync uploads assets outside the locked profile namespace, silently expands from limited-library consent to whole-library access, or sends media bytes through JSON/HTTP bodies instead of approved Bus/Central_IO payload leases.
- A request, memory, journal item, task, presence update, or notification leaves the device without a locked `profile:<person>/...` namespace or family/shared namespace decision.
- One locked profile can read or mutate another person's private Memorr, Veliai, Guardian, Journal, or Photos-derived records without explicit sharing policy.

## Product Shape

The app name is `Amber Life`.

First run requires a person selection:

- `Iain`
- `Sarah`
- `Finn`
- `Josh`

The chosen person becomes the app's locked profile identity. The app can still
show shared family state where the owner contracts permit it, but private
Memorr, Veliai, Journal, Photos, Email, To-Do, Guardian presence, and notification
traffic is scoped to that locked profile.

The named surfaces are four first-class tabs:

| Tab | iOS label | Primary owner | Purpose |
| --- | --- | --- | --- |
| Veliai | `Veliai` | Veliai/Gemma Gateway via Amber Bus | Conversational front door, memory-aware analysis, drafting, and guided work. |
| To-Do | `To-Do` | Guardian via Amber Bus | Family and personal tasks, approvals, recurring jobs, and completion evidence. |
| Email Summary | `Email` | Concierge + Memorr + Veliai via Amber Bus | Mail digest, important threads, action extraction, archive refs, and safe summaries. |
| Guardian | `Guardian` | Guardian via Amber Bus | Home/physical-world status, action gates, runbooks, alerts, and proof. |

If release scope must be exactly three tabs, merge `To-Do` and `Email` into a single `Today` tab with two segmented views. The stronger long-term design is four tabs because each named area has a different owner and failure model.

Settings includes a `Tab Library` for adding approved existing Amber surfaces to
the bottom tab bar or a `More` overflow when the tab count exceeds ergonomic iOS
limits. The library is not a plug-in marketplace and does not load remote web
apps. It is a native registry of signed, schema-backed Amber Life tab modules
whose data contracts are already exposed through Amber Bus.

First optional tabs:

| Optional tab | iOS label | Primary owner | Purpose |
| --- | --- | --- | --- |
| Crypto | `Crypto` | Crypto + Memorr + Amber Bus | Portfolio, market, forecast, risk, evidence, and decision timeline views using Bus-approved Crypto facts and Memorr refs. |
| Console Ops | `Console` | Amber Console + Logger + owner services through Amber Bus | Operator health, degraded states, route evidence, L8/L9 proof, client/session state, and click-through owner refs in native iOS form. |

Tab Library rules:

- Default tabs remain Veliai, To-Do, Email, and Guardian unless release scope explicitly changes.
- Optional tabs can be enabled, disabled, reordered, or moved to overflow from Settings.
- The tab registry is delivered as signed Amber Bus tab descriptors plus app-bundled native SwiftUI module code. A descriptor can enable an existing native module; it cannot inject script, HTML, WebView content, or remote UI.
- Every optional tab declares owner, schema version, required Bus contracts, profile/shared scope, permission class, cache policy, evidence view, degraded states, and retirement state.
- Private optional tabs inherit the locked first-run profile. Shared/operator tabs require explicit family/shared or admin/operator scope.
- A disabled or unsupported optional tab shows a native unavailable state with the missing contract and owner reference; it does not fall back to HTTP.

## Review Findings And Innovation Gaps

The first Amber Life design had the right owner boundaries, but it was missing
several product-critical pieces:

| Gap | Impact | Design correction |
| --- | --- | --- |
| Native Veliai access was underspecified | A web shell or HTTP REST chat path would add latency and break the app-native feel | Veliai becomes a SwiftUI-native tab using a direct framed native API over Amber Bus/Concierge Internet. |
| iOS life sources were missing | The app would not feel like a real Amber Life client without Photos, Journal-style moments, share sheet, and local context | Add PhotosUI/PhotoKit, Journaling Suggestions, Share Extension, and Memorr import flows. |
| Consent and retention for phone-native memories were too shallow | Photos, journal moments, and location are highly private | Add explicit source refs, privacy class, retention class, redaction, and user confirmation before Memorr writes. |
| Profile identity was too loose | A family phone app without a profile lock risks cross-person memory and presence leakage | Add first-run person selection and enforce profile namespaces through Amber Bus, Memorr, Veliai, Guardian, and notifications. |
| Fast interaction surfaces were missing | A phone app needs glanceable entry points, not only tabs | Add widgets, Live Activities where appropriate, App Intents/Shortcuts, and notification actions. |
| Offline and conflict behavior needed shape | Native performance requires local drafts, but owner truth must remain remote | Add encrypted local draft cache with owner-proof reconciliation and visible pending states. |
| Guardian presence needed richer context | AMBER WiFi is useful but should not become an unsafe automation trigger | Link AMBER WiFi to Guardian home presence with stale/away windows and no bypass of Guardian apply gates. |

## R1 Missing-Items Closure

Amber Life must not move from design to build until these ten missing items are
treated as first-class R1 requirements rather than later polish:

| Item | R1 requirement | Owner path |
| --- | --- | --- |
| Executable iOS product | Create a real Xcode/SwiftUI app, package layout, signing/build lane, internal distribution path, and CI checks. | Future Amber Life client source plus E36 Console proof governance. |
| Native Amber Bus client | Implement the Swift DEMand-Mobile client, generated typed codecs, stream resume, backpressure, offline outbox, and correlation IDs. | Amber Bus E31 plus Amber Life client modules. |
| Enrollment and trust | Define first-run profile enrollment, per-install keys, revocation, lost-phone disable, build trust, profile transfer, and secure storage. | Amber Bus Concierge Internet plus ProfileLockFeature. |
| Concrete Bus contracts | Freeze the first contract set for Veliai, To-Do, Email, Guardian, Tab Library, notification, presence, photo sync, journal, and evidence. | E31 Bus contracts plus owner epics E32-E38. |
| UX wireframes and states | Produce native flows for onboarding, tabs, Settings, permissions, errors, degraded states, offline states, and evidence drilldowns. | E31 Amber Life app ownership plus E36 Console visibility. |
| Notifications | Add APNs token lifecycle, Bus-backed notification descriptors, payload privacy classes, action routing, retries, and delivery evidence. | Amber Life Notifications plus E31/E36 visibility. |
| Background execution | Specify BGTaskScheduler, significant-change presence, silent-push refresh, low-power/storage/thermal throttles, freshness, and stale state. | AmberLifePresence plus Guardian presence contracts. |
| Photos/Journal sync engine | Build asset observation, limited-library handling, encrypted local manifest, chunked Central_IO leases, retry, dedupe, tombstones, and conflict UI. | Amber Life PhotosJournalFeature plus Memorr E32 intake. |
| Guardian approval UX | Separate Veliai advice from Guardian apply proof, require biometric confirmation for sensitive actions, and show rollback/no-action evidence. | GuardianFeature plus Guardian E37 gates. |
| Privacy, evidence, and tests | Add family/admin policy, accessibility, retention/export/delete, observability bundles, threat model, mocked Bus, DEMand-Mobile simulator, UI snapshots, and integration fixtures. | E36 implementation contract plus Console/Logger proof. |

The build artifact for this closure is
[`amber-life-r1-implementation-contract.md`](amber-life-r1-implementation-contract.md).
That document owns the exact Swift module layout, first Bus schemas,
DEMand-Mobile state machine, onboarding flow, permission matrix, and test
fixtures.

## Life Evidence Layer

Amber Life has a product-wide `Life Evidence` layer. Every Veliai answer,
Guardian presence state, Memorr photo sync, journal link, email summary, task,
notification, optional Crypto item, and Console Ops row must be tappable to show
why Amber believes it.

Each evidence view shows:

- source owner and owner system;
- profile or shared namespace;
- freshness timestamp and staleness window;
- confidence and confidence source;
- privacy class, retention class, and redaction state;
- Bus contract, schema version, frame type, and correlation ID;
- Memorr/Logger/Guardian/Concierge/Veliai refs where available;
- missing, degraded, denied, stale, or revoked evidence state;
- whether an item is advice-only, pending, applied, failed, rolled back, or
  no-action.

Life Evidence rules:

- Evidence is structured UI, not a JSON dump.
- Missing evidence is displayed as missing; Veliai must not fill the gap with a
  guess.
- Evidence follows the locked first-run profile unless the item is explicitly
  family/shared/operator scoped.
- Sensitive evidence requires biometric unlock or owner policy before display.
- Every mutation initiated from Amber Life produces an evidence trail visible in
  the app, Console web, Console Windows, and Logger.
- Notifications carry enough evidence metadata to open the same evidence view
  without leaking raw private payloads into APNs.

The shared R1 snapshot/evidence schema for iOS, macOS, and Windows is
`schemas/amber-life/amber.life.r1.snapshot.v1.schema.json`, with fixture
`data/amber-life/amber.life.r1.snapshot.fixture.v1.json`. iOS generated Swift
models for the default surfaces must stay compatible with that schema.

## Navigation Model

Use a native SwiftUI `TabView` with SF Symbols:

| Tab | Icon | Default landing state |
| --- | --- | --- |
| Veliai | `sparkles` | Active conversation with profile, route, memory, and queue evidence visible behind a details affordance. |
| To-Do | `checklist` | Open family tasks grouped by today, upcoming, waiting, and completed. |
| Email | `envelope.badge` | Daily digest with priority threads, bills/school/dentist/PeakSave/remediation groups, and archive status. |
| Guardian | `shield.lefthalf.filled` | Home readiness, alerts, blocked actions, and recent Guardian evidence. |
| Settings | `gearshape` | App/device/profile configuration, Tab Library, privacy, permissions, and transport health. |

Global top bar:

- Profile lock: current person/userspace selected at first run. Profile switching requires biometric unlock and owner-approved re-enrollment or admin policy.
- Connection pill: Bus connected, degraded, offline cache, or auth needed.
- Presence chip: background refresh, location, battery, storage pressure, and notification health at a glance.
- Evidence drawer button: opens recent Bus correlation IDs, owner refs, and Logger proof for the visible tab.
- Voice button: starts a Veliai turn that can target the current tab context.

Settings surfaces:

- Profile lock and re-enrollment state.
- Tab Library: enable, disable, reorder, and inspect optional tabs.
- Transport health: DEMand-Mobile session state, endpoint, latency, queue depth, crypto/enrollment state, and last Bus proof.
- Permissions: Photos, Journal Suggestions, notifications, background refresh, location, microphone, biometrics, and photo-sync mode.
- Privacy and retention defaults for Memorr imports, Journal, Photos sync, phone presence, and notifications.
- Build trust, certificate pin, device credential, revocation/update state, and Logger correlation IDs.

## Visual Direction

The app should feel like a quiet command surface, not a marketing app:

- Dense but calm layouts with live cards, compact status rows, timelines, and owner proof chips.
- Semantic colors only: green ready, amber gated/degraded, red blocked/failure, blue informational, neutral for archived history.
- Cards are for repeated items such as tasks, threads, alerts, and evidence records; do not nest cards inside cards.
- Every action button must expose state: ready, requires approval, queued, applied, failed, or read-only.
- No JSON dump panels. Raw evidence opens as structured fields with owner, schema, correlation ID, timestamp, and click-through source.

## Tab Design

### Veliai

Primary jobs:

- Ask questions over owner-backed memory.
- Continue saved Memorr-backed conversations.
- Draft replies, task changes, and Guardian action requests.
- Explain why a route, memory source, or provider was selected.
- Import user-selected phone-native context into a Veliai turn without making the phone a hidden memory database.

Core panels:

- Conversation stream with compact evidence per assistant response.
- Memory context strip showing Memorr candidate count, namespace, privacy gate, and unavailable states.
- Route strip showing queue mode, provider, lane, degradation, cost/quota state, and response owner.
- Suggested follow-ups as non-executing buttons until the user taps.
- Attachment/context rail for selected photos, journal suggestions, email refs, Guardian tasks, and Memorr assets.
- Low-latency streaming response surface with token, tool-proposal, memory-candidate, and evidence frames.

Data contracts:

- Submit turns through a native `AmberLifeVeliaiClient` generated Swift binding over the DEMand/native framed protocol.
- Transport runs through the Concierge Internet connector or AMBER LAN endpoint, then into Amber Bus/Veliai Queue and the native Veliai router.
- Read conversation descriptors through Memorr-backed Veliai conversation contracts exposed by Amber Bus native frames.
- Read route/queue/provider evidence through Amber Bus source detail and Logger refs as native evidence frames.
- Stream responses as typed frames: assistant tokens, tool proposals, memory refs, provider state, safety gates, and final owner proof.
- Every turn carries locked profile fields: `person_id`, `profile_namespace`, `userspace`, `device_install_id`, `session_profile_lock_id`, and `sharing_scope`.

Hard rule:

- Veliai can recommend or prepare a Guardian action, but only Guardian can apply it.
- The Veliai tab is native SwiftUI. It must not use a WebView, hosted Veliai web page, HTTP REST chat, JSON-over-HTTP compatibility endpoint, or browser-local conversation store as its production path.

Performance requirements:

- First visible token or structured response frame target: under 500 ms on AMBER WiFi when the selected lane is already warm.
- Interaction updates use incremental native frames instead of polling.
- Draft context is locally staged, compressed where useful, and sent as bounded descriptors or Central_IO leases rather than oversized JSON payloads.
- Long photo/video payloads are never inlined into Veliai prompts; they become Memorr import candidates or Central_IO leases with explicit refs.

### Photos, Journal, And Phone-Native Memory

Primary jobs:

- Let the user pick photos, videos, Live Photos, and albums for Memorr-backed life records.
- Let the user choose Journaling Suggestions moments for Amber Life entries.
- Turn selected phone-native context into Veliai summaries, Memorr records, Guardian tasks, or Email/To-Do context.
- Provide a Share Extension so content from Photos, Safari, Mail, Messages, Files, and other apps can be sent to Amber Life.
- Build a bidirectional Journal-to-Memorr bridge where user-selected journal moments become Memorr records and Memorr-backed memories can seed new local Journal drafts or Amber Life journal entries.

Core panels and flows:

- `Life Capture`: user-selected photos, journal suggestions, notes, links, screenshots, documents, and voice snippets.
- `Moment Builder`: combines selected assets, location/date descriptors, people labels where user-approved, Veliai summary, and Memorr import intent.
- `Photo Day`: on-device picker into Memorr day view; selected assets become immutable Memorr import candidates with source refs.
- `Photo Sync`: optional profile-scoped background sync for user-approved Photos assets, albums, or limited-library selections into Memorr.
- `Journal Prompt`: Journaling Suggestions picker result becomes a local draft; the user chooses whether to save to Memorr, ask Veliai, create a task, or discard.
- `Journal To Memorr`: selected Journaling Suggestion or Amber Life journal draft becomes a profile-scoped Memorr memory object with source refs, privacy class, and retention class.
- `Memorr To Journal Draft`: Memorr day/moment refs can seed an Amber Life local journal draft for the locked profile. The app does not write directly into Apple's private Journal database.
- `Share To Amber Life`: share-sheet import creates a local pending draft with privacy and retention choices.

Photo sync modes:

- `off`: default. No asset sync occurs; picker/share actions still work.
- `selected`: sync only explicitly chosen assets or moments.
- `albums`: sync approved albums selected by the locked profile.
- `limited_library`: sync the current iOS limited-library grant and show a control to update that grant.
- `family_shared`: optional destination for explicitly shared assets under `profile:family/life/photos`; never the default for private profile sync.

Photo sync contract:

- Every sync session carries the first-run profile lock: `person_id`, `profile_namespace`, `memorr_namespace`, `device_install_id`, `profile_lock_id`, and sharing scope.
- Private photos default to `profile:<Name>/life/photos`; journal-linked photo moments default to `profile:<Name>/journal`.
- The app creates an idempotent sync manifest with local asset identifiers, album/source refs, creation/modification dates, media type, byte size, checksum/perceptual hash where available, privacy class, retention class, and consent state.
- Large media bytes move through Amber Bus-approved Central_IO/FASTIO leases. They are not embedded in JSON, Veliai prompts, Guardian events, or direct Memorr file writes.
- Memorr is the durable owner after import. Amber Life keeps only an encrypted local pending queue, thumbnails needed for display, and owner refs.
- The sync engine handles new assets, edits, deletes, limited-library revocations, interrupted uploads, duplicates, and backpressure as visible states rather than silent drift.
- Background sync should prefer AMBER WiFi and power when available, obey iOS background execution limits, and surface `sync_pending`, `sync_paused_power`, `sync_paused_network`, `sync_failed`, and `sync_revoked` states in the app and Console.

Apple framework direction:

- Use PhotosUI for picker-first access where possible.
- Use PhotoKit only when Amber Life needs approved library metadata, limited-library management, or user-authorized broader access.
- Support limited-library mode as a first-class state, including a control to update selected assets.
- Use Journaling Suggestions for user-selected moments. Treat returned suggestion data as user-granted context for Amber Life only, not as permission to mine Journal history.

Hard rules:

- Amber Life does not silently scan the full Photos library.
- Amber Life does not claim to write into or read from Apple's private Journal app database.
- Journal-derived Memorr records are profile-scoped to the locked first-run person unless the user explicitly chooses a family/shared namespace.
- Selected assets are imported to Memorr only after the user chooses an import action, privacy class, retention class, and owner/profile.
- Photo sync is opt-in per locked profile and must never infer consent for another family member from the phone install alone.
- Face/person inference from photos is advisory unless backed by an approved identity contract.
- Deleting or revoking an imported phone asset must propagate a Memorr unavailable/tombstone/ref-state update where the asset was owner-linked.

### To-Do

Primary jobs:

- View personal, family, and house tasks.
- Add tasks through text, voice, or extracted email actions.
- Complete, defer, assign, recur, and link evidence.
- See memory sync and HA/wallpanel mirror state without treating either as truth.

Core panels:

- Today: due and high-priority tasks.
- Family: shared tasks by assignee.
- House: Guardian operational tasks and runbook follow-ups.
- Waiting: tasks blocked by owner, evidence, device, or approval.

Data contracts:

- `guardian.family_todo.list`
- `guardian.family_todo.add`
- `guardian.family_todo.update`
- `guardian.family_todo.complete`
- Guardian task evidence and memory sync state through Amber Bus.

Record shape:

- `task_id`, title, status, assignee, creator, namespace, source, due date, recurrence, visibility, policy gate, owner refs, audit refs, Memorr refs, and HA mirror status.

Hard rule:

- A task cannot exist only in Veliai memory or an iOS cache. Guardian creates and owns the canonical task record.
- The locked profile supplies task creator, assignee default, and private/shared namespace defaults. Family tasks use explicit family/shared scope; private tasks stay in the locked person's namespace.

### Email Summary

Primary jobs:

- Show the day's important email without exposing raw mailbox operations to the phone.
- Group operational mail such as PeakSave, school, billing, dentist, and remediation.
- Summarise threads with Memorr archive refs and redaction state.
- Convert safe, explicit items into Guardian task proposals.

Core panels:

- Priority digest: top threads and why they matter.
- Action candidates: proposed to-dos, calendar items, replies, and Guardian events.
- Archive status: kept, review, quarantined, spam, attachment pending, OCR pending, or redacted.
- Thread detail: safe summary first, with raw-content access gated by owner policy.

Data contracts:

- Concierge-owned mail digest/query contracts over Amber Bus.
- Memorr email archive refs and attachment refs over Amber Bus.
- Veliai summary/triage jobs through Veliai Queue, using redacted context packs.
- Guardian operational email events for PeakSave/remediation where the action owner is Guardian.

Hard rules:

- The app does not hold mailbox credentials.
- Memorr never logs into email directly.
- Guardian is not the permanent mailbox poller.
- Credential-bearing or secret-bearing email bodies stay sealed/redacted unless an approved owner lease permits display.

### Guardian

Primary jobs:

- See real-world readiness and action state.
- Inspect alerts, runbooks, blocked actions, and recent outcomes.
- Request actions that pass Guardian policy/apply gates.
- Drill into owner evidence before trusting a result.

Core panels:

- Readiness: Guardian apps, C2, HA telemetry boundary, policy state, and action lock state.
- Alerts: security, house, energy, device, camera, and remediation items.
- Actions: proposed, queued, approved, applied, failed, rolled back, or no-action.
- Runbooks: current and recent operational procedures with proof.

Data contracts:

- Guardian C2/action/status/evidence contracts through Amber Bus.
- Owner action readiness contracts through Amber Bus.
- Logger evidence refs for action, rollback, and failure proof.
- Memorr refs only for durable evidence or memory links.
- Guardian presence subject is the locked first-run person unless an owner-approved device transfer/re-enrollment changes it.

Hard rule:

- The iOS app can request, approve, or display actions only through Guardian gates. It must never call a device, HA service, or private Guardian implementation path directly.

### Optional Crypto

Primary jobs:

- Show portfolio, market, forecast, risk, decision, and evidence timelines.
- Surface Crypto facts and predictions that are already owned by Crypto and stored/referenced through Memorr where appropriate.
- Let Veliai explain a forecast or decision trail without letting the app become a trading backend.

Core panels:

- Market and portfolio summary with stale/freshness state.
- Forecast timeline with model/source/evidence chips.
- Decision trail showing operator notes, risk gates, and Memorr refs.
- Alerts and watchlist changes routed through Amber Bus notification descriptors.

Data contracts:

- Crypto fact, forecast, risk, portfolio, and timeline descriptors through Amber Bus.
- Memorr refs for durable notes, evidence, and historical context.
- Logger refs for decision/audit proof.
- Veliai explanation turns over native Bus frames using approved Crypto/Memorr context packs.

Hard rules:

- The Crypto tab is display, analysis, and evidence first. Trade execution or exchange mutation requires a separate owner-approved Crypto action gate.
- The app must not call exchange APIs, HTTP market feeds, or Crypto private endpoints directly.

### Optional Console Ops

Primary jobs:

- Give a native iOS operator view of Amber health without opening the web Console.
- Show Bus, Concierge Internet, Veliai, Memorr, Guardian, Logger, and client/session states as bounded operational slices.
- Provide click-through owner refs, L8/L9 evidence, and degraded-state explanations.

Core panels:

- Amber Bus route/module health, DEMand-Mobile session state, and queue/backpressure state.
- Client devices and Amber Life enrollment/revocation state.
- Owner service readiness and degraded summaries.
- L8/L9 proof board and recent Logger evidence.

Data contracts:

- Console display contracts through Amber Bus.
- Logger evidence refs through Amber Bus.
- Owner status is owner-provided and Bus-carried; the tab does not scrape service endpoints.

Hard rules:

- Console Ops is a native iOS surface, not an embedded `console.amber.com` page.
- It never uses HTTP, WebView, REST polling, or direct owner-service calls as its production data path.
- Destructive operator actions, if ever added, require explicit Guardian/owner/operator gates and are not part of the first optional tab release.

### System Integrations

Expected iOS-native integrations:

- App Intents and Shortcuts for "Ask Veliai", "Add to Guardian To-Do", "Capture Life Moment", "Summarise this", and "I'm home/away" diagnostics.
- Widgets for Guardian presence, next tasks, critical alerts, and Veliai route health.
- Live Activities only for genuinely active workflows such as a Guardian gated action, active home arrival check, or long-running Memorr import.
- Notification actions for approve, defer, mark done, ask Veliai, and open evidence, all routed through Guardian/Bus gates.
- Share Extension for photos, URLs, text, PDFs, email exports, and files.
- Siri voice entry through App Intents where available; raw always-listening wakeword is not assumed on iOS.
- Optional Watch companion later for presence, approvals, and quick tasks after iPhone proof is green.

## First-Run Profile Lock

First run must happen before enrollment completes. The app presents exactly four
profile choices: `Iain`, `Sarah`, `Finn`, and `Josh`.

Selection creates a profile-lock record:

- `person_id`: `iain`, `sarah`, `finn`, or `josh`;
- `display_name`: `Iain`, `Sarah`, `Finn`, or `Josh`;
- `profile_namespace`: `profile:<Name>/personal`;
- `todo_namespace`: `profile:<Name>/todos` plus optional `profile:family/todos`;
- `journal_namespace`: `profile:<Name>/journal`;
- `memorr_namespace`: `profile:<Name>/life`;
- `guardian_presence_subject`: `person:<Name>`;
- `device_install_id`;
- `profile_lock_id`;
- creation timestamp, app build, and enrollment correlation ID.

The profile lock is included in every Amber Bus session and every owner contract
frame. Amber Bus must reject private reads, writes, recalls, notifications, and
presence updates that do not match the session profile lock, unless the request
uses an explicit family/shared namespace or an owner-approved admin/delegation
contract.

Privacy effect:

- This is not the whole security model, but it gives a real privacy boundary:
  accidental cross-person recall, journal import, task ownership, notification,
  and presence leakage become contract violations instead of UI mistakes.
- Device possession alone is not enough to switch private profiles. Switching
  requires biometric unlock plus re-enrollment, parental/admin approval, or an
  explicit owner policy.
- If the phone is handed to another family member temporarily, the safe path is
  a guest/shared action, not silent profile switching.

Profile-scoped contracts:

- Veliai memory namespace: `profile:<Name>/personal`.
- Journal namespace: `profile:<Name>/journal`.
- Memorr life namespace: `profile:<Name>/life`.
- To-do private namespace: `profile:<Name>/todos`.
- Shared family namespace: `profile:family/...`.
- Guardian presence subject: `person:<Name>`.
- Notifications: delivered only if the payload's profile/shared scope matches
  the device profile lock.

## Cross-Tab Workflows

### Add A Tab From Settings

```text
Settings
  -> Tab Library
  -> signed Amber Bus tab descriptor list
  -> user enables Crypto or Console
  -> app verifies native module exists in bundle
  -> Bus contract and profile/operator-scope check
  -> tab appears in tab bar or More overflow
  -> tab streams native Amber Bus frames over DEMand-Mobile
```

Rules:

- A tab descriptor can expose only native modules that are already present in the app build.
- Descriptor fields include tab ID, owner, schema version, icon, label, required Bus contracts, permission class, profile/shared/operator scope, cache limits, evidence contract, and retirement state.
- If a descriptor is unavailable, revoked, unsupported, or missing its Bus contracts, the app shows a native disabled state with owner evidence.
- Crypto and Console are the first optional descriptors. Additional tabs must pass the same owner, scope, evidence, and no-HTTP gates.

### Zero-Config Internet Enrollment

```text
Amber Life first launch
  -> baked public bootstrap metadata and certificate pins
  -> person selection: Iain / Sarah / Finn / Josh
  -> profile lock created locally
  -> Concierge Internet edge at thethornfamily.co.uk:17443
  -> per-install Secure Enclave or Keychain device key
  -> Bus enrollment challenge
  -> scoped device certificate/session credential bound to profile lock
  -> DEMand-Mobile encrypted point-to-point Amber Bus session
```

Failure behavior:

- If the public edge is unavailable, the app stays in offline/local-cache mode and shows `internet_access_unavailable`.
- If enrollment fails, the app never falls back to private owner-service URLs.
- If profile selection is missing, enrollment cannot complete.
- If the selected profile is revoked, transferred, or mismatched by Bus policy, the app returns to a locked re-enrollment state.
- If a build credential or certificate pin is revoked, the app must show a revocation/update state and stop privileged traffic.

Endpoint selection:

- Internet/off-home endpoint: `thethornfamily.co.uk:17443`.
- Home WiFi SSID: `AMBER`.
- Home/local subnet: `192.168.0.0/24`.
- Home WiFi/LAN endpoint: `amber-bus.amber.com:17443`.
- If the phone is on AMBER WiFi or has an active local address/route inside
  `192.168.0.0/24`, it must use `amber-bus.amber.com:17443`.
- On the Amber LAN, `thethornfamily.co.uk` is split-horizon DNS and may resolve
  to Exchange (`exchangesrv2019.amber.com`) rather than Amber Bus. The iOS app
  must not test or use `thethornfamily.co.uk:17443` while on AMBER WiFi or
  `192.168.0.0/24`.
- The app never asks the user to manually choose LAN versus internet mode.

Transport rule:

- `thethornfamily.co.uk:17443` and `amber-bus.amber.com:17443` are native Amber
  Bus endpoints for DEMand-Mobile,
  an extension of DEMand for mobile point-to-point encrypted sessions.
- It is not a VPN and does not expose IP-layer access to the home network.
- It is not HTTP, HTTPS REST, WebSocket-over-web-app, or a web Console tunnel.
- The encryption envelope is Amber Bus defined but should use reviewed modern
  primitives, per-install device keys, forward-secret session keys,
  replay-resistant frame counters, fast session resumption, certificate or trust
  pin validation, and Bus-visible revocation.
- After enrollment, all default and optional tabs multiplex typed native frames
  over the same authenticated session with priority lanes for Veliai streaming,
  presence, notifications, tab updates, and media/control leases.

### Add A Task From Voice

```text
iOS voice button
  -> Veliai turn over Amber Bus
  -> identity/profile and intent resolution
  -> Guardian task proposal
  -> user confirms
  -> guardian.family_todo.add
  -> Guardian task_id returned
  -> Memorr/Gemma memory refs updated asynchronously
  -> To-Do tab shows canonical task and sync state
```

Failure behavior:

- If Guardian is unavailable, the app does not say the task was added.
- If memory sync fails, the task remains in Guardian and shows `memory_sync_pending`.

### Email To Task

```text
Concierge mail digest
  -> Memorr archive refs
  -> Veliai extracts candidate actions from redacted context
  -> Email tab shows proposed task
  -> user confirms
  -> Guardian creates canonical task
```

Failure behavior:

- If the email is quarantined or redacted, Veliai can summarise only the safe descriptor.
- If Guardian rejects the task, the Email tab keeps the candidate as not applied.

### Guardian Action Advice

```text
Guardian alert
  -> Veliai advisory analysis
  -> Guardian apply gate
  -> user approval if required
  -> Guardian action result
  -> Logger proof and Memorr evidence refs
```

Failure behavior:

- Veliai advice without Guardian apply proof is labeled `advice_only`.
- No physical-world success toast appears until Guardian returns applied evidence.

### Phone Presence

```text
Amber Life background refresh / significant-change event
  -> phone presence package
  -> Amber Bus Concierge Internet connector
  -> Bus presence topic
  -> Console/Logger visibility
  -> Guardian/Veliai/Memorr consumers only through approved contracts
```

Presence package fields:

- device ID and install ID;
- enrolled person/profile ID and Guardian presence subject ref;
- app version, schema version, build channel, and last successful Bus contract;
- online/offline state, network class, current endpoint class (`home_lan` or
  `internet`), SSID evidence when iOS permits it, background-refresh state,
  notification permission state, and APNs token status;
- battery level, charging state, low-power mode, storage pressure, thermal/health state where iOS exposes it, and recent crash/error summaries;
- location only when explicitly enabled: coarse/fine class, timestamp, accuracy, purpose, retention class, and consent state.

Guardian presence link:

- If an enrolled Amber Life device is connected to WiFi SSID `AMBER`, Guardian
  treats the enrolled person as `home`.
- The app publishes `guardian.presence.home_network` evidence with device ID,
  person/profile ID, SSID `AMBER`, endpoint used, timestamp, and confidence.
- If the phone leaves AMBER WiFi, loses background permission, stops reporting,
  or the evidence exceeds the Guardian staleness window, Guardian marks the
  person's home presence stale or away according to its owner policy.
- This presence signal may inform Guardian household context, alerts, and
  automations, but physical-world actions still require Guardian policy/apply
  gates.

Failure behavior:

- If background execution is denied, Console and the app show `background_refresh_denied`.
- If location permission is denied, presence continues with network/home-WiFi
  evidence where iOS permits it and without GPS location.
- If storage or battery is critical, the app reduces background work and reports degraded presence.

### Journal To Memorr

```text
Journaling Suggestions picker / Amber Life journal draft
  -> local profile-locked draft
  -> user confirms owner, privacy, retention, and sharing scope
  -> Memorr import candidate in profile:<Name>/journal or profile:family/journal
  -> Veliai optional summary over owner refs
  -> Memorr memory object and source refs
  -> Amber Life Journal/Memorr view
```

Rules:

- Journal-derived records default to the locked profile's private journal namespace.
- Family/shared journal records require explicit user selection.
- Veliai sees descriptors or approved context packs, not raw private journal text by default.
- Memorr stores durable journal memory objects and source refs; Amber Life stores only drafts/display cache.
- Revoking or deleting a Journal-derived Memorr record removes or marks unavailable the associated Veliai recall descriptors.

### Photos To Memorr Sync

```text
Amber Life Photo Sync option
  -> locked profile and Photos consent check
  -> user chooses selected assets, albums, limited-library sync, or family/shared destination
  -> local encrypted sync manifest and pending queue
  -> Amber Bus photo-sync contract
  -> Central_IO/FASTIO upload lease for media bytes
  -> Memorr profile-scoped asset/source-ref intake
  -> Memorr dedupe, thumbnail/preview refs, memory object links, and tombstone handling
  -> Amber Life, Veliai, Console, and Logger see owner refs through Bus only
```

Rules:

- Photo sync is off by default and can be paused or disabled per locked profile.
- Sync destination defaults to `profile:<Name>/life/photos` and may use `profile:family/life/photos` only after explicit sharing selection.
- Memorr-E32 must provide an `amber_life.photo_sync` backend intake with idempotent sessions, profile-scoped asset refs, dedupe, delete/revoke/tombstone handling, bounded preview generation, and Bus-visible progress.
- Veliai receives only Memorr refs or approved context packs for synced photos; raw photo bytes are not prompt material.
- Failed or partial sync never changes the user's local Photos library. It leaves visible pending/error state with retry and revoke options.

## Local iOS Architecture

Recommended implementation:

- SwiftUI for screens and navigation.
- Swift concurrency for Bus calls and streaming Veliai turns.
- Network.framework `NWConnection` using DEMand-Mobile, an Amber Bus point-to-point encrypted extension of DEMand, to `amber-bus.amber.com:17443` on AMBER WiFi or `192.168.0.0/24`, otherwise to `thethornfamily.co.uk:17443`.
- DEMand-Mobile frames provide session negotiation, device enrollment proof, profile lock binding, stream multiplexing, priority, backpressure, compression where approved, resumable cursors, frame counters, and replay protection.
- No URLSession/HTTP REST path for production app data. HTTP may exist only for non-production diagnostics or explicitly approved compatibility tests outside the app's operational data plane.
- A small local repository layer per tab, backed by the same generated Amber Bus schemas.
- Encrypted local cache for bounded display-only slices after approval.
- Background refresh, silent push, and significant-change location only for approved low-risk presence, summaries, and badges.
- Push notifications delivered as Bus-backed notification descriptors, not raw owner payloads.
- PhotosUI, PhotoKit, JournalingSuggestions, AppIntents, WidgetKit, ActivityKit, and Share Extension targets where supported by the deployment baseline.

Suggested modules:

- `AmberLifeApp`
- `AmberBusClient`
- `AmberNativeTransport`
- `AmberLifeVeliaiClient`
- `AmberLifePresence`
- `AmberLifeNotifications`
- `AmberLifeEnrollment`
- `ProfileLockFeature`
- `SettingsFeature`
- `TabLibraryFeature`
- `VeliaiFeature`
- `CryptoFeature`
- `ConsoleOpsFeature`
- `LifeCaptureFeature`
- `PhotosJournalFeature`
- `ShareExtensionBridge`
- `AppIntentsFeature`
- `WidgetsAndLiveActivities`
- `TodoFeature`
- `EmailSummaryFeature`
- `GuardianFeature`
- `EvidenceFeature`
- `IdentityProfileFeature`
- `OfflineDisplayCache`

The cache is never authoritative. It stores display slices, last-known owner refs, and pending UI drafts. Mutations remain pending until Amber Bus returns owner proof.

Connectivity model:

- The app ships with public bootstrap metadata: endpoint name, public trust anchor, certificate pin set, build channel, minimum schema, and enrollment audience.
- Bootstrap endpoint metadata includes `thethornfamily.co.uk:17443`,
  `amber-bus.amber.com:17443`, home SSID `AMBER`, and local subnet
  `192.168.0.0/24`.
- The app generates the private device key locally on first launch. The key is non-exportable where iOS supports it.
- The app exchanges an enrollment challenge with Amber Bus and receives a revocable scoped device credential.
- The scoped device credential is bound to the selected first-run profile lock.
- The app rotates session credentials and stops traffic when enrollment, pin, build, or policy state is revoked.
- The app never stores owner-service credentials, mailbox credentials, or raw Bus root secrets.
- The profile-lock record is stored in Keychain/app protected storage and is mirrored to Bus enrollment state as non-secret identity binding metadata.

Native Veliai transport model:

- The app uses generated Swift codecs for Bus and Veliai frame schemas.
- The app opens one authenticated native session and multiplexes Veliai turns, evidence, presence, notification ack, and import-control frames over it.
- Every native frame carries profile-lock metadata or an explicit shared/family namespace marker.
- Veliai turns are framed binary or compact schema frames, not JSON-over-HTTP.
- Large selected assets use file/provider handles, Memorr import descriptors, or Central_IO leases; they are never inlined into chat payloads.
- Conversation state stored on the phone is a local draft/display cache only. Memorr/Veliai owner descriptors remain the durable discovery path.

## Permissions And Privacy

Required capabilities:

- Network access to the approved Amber Bus endpoint.
- Local notifications for task, mail, and Guardian alerts.
- Remote notifications through APNs for Bus-backed notification descriptors.
- Background app refresh for bounded presence, badge, and digest updates.
- Network/home presence permissions where iOS requires them, so the app can
  identify AMBER WiFi for Guardian presence.
- Location permission only when the user enables Amber Life GPS/coarse location
  presence or when iOS requires location authorization for WiFi network identity.
- Microphone only when voice entry is enabled.
- Face ID / device biometrics for app unlock and sensitive thread/action review.
- Photos access through PhotosUI picker, limited-library access, or explicit full access only when the user opts in.
- Journaling Suggestions access only through the system picker and only for user-selected suggestions.
- First-run profile selection is required before Bus enrollment, notifications, presence, Photos import, Journal import, or Veliai use.

Privacy rules:

- No mailbox credentials on device unless a future owner-approved connector explicitly delegates them.
- No long-lived private network credentials in the app bundle; only public trust anchors and non-secret bootstrap metadata may be baked at build time.
- Location telemetry must be opt-in, purpose-bound, visible, revocable, and retention-limited.
- AMBER WiFi presence is purpose-bound to Guardian home presence and must be
  visible and revocable. It must not become a general movement-history store.
- Phone health telemetry is operational presence, not durable memory, unless an owner-approved summary/ref is explicitly stored.
- No raw biometric secrets in task or action records.
- No raw Memorr media/email paths in the app.
- Redacted summaries must remain visibly redacted; do not fill gaps with Veliai guesses.
- Photo and Journal-derived imports carry source app, selected asset refs, capture/import timestamp, privacy class, retention class, and revocation state.
- Photo, Journal, Share, Veliai, Guardian, Email, notification, and presence frames carry the locked profile or explicit family/shared scope.
- Profile-switch and device-transfer flows require biometric unlock and owner-approved re-enrollment.
- Share Extension drafts remain local and pending until the user confirms an owner action.

## Console And Logger Parity

Because every Amber function needs a human-visible graphical surface, the iOS client must also be visible from Console:

- Console web and Windows show iOS client registration, app version, schema version, last Bus heartbeat, notification permission state, offline cache mode, and recent failed contracts.
- Console web and Windows show Concierge Internet listener state, external reachability, router apply/rollback state, device enrollment state, app build trust state, background refresh state, location consent state, battery/storage/health status, and notification delivery health.
- Console web and Windows show current Amber Life endpoint class, AMBER WiFi
  home-presence evidence, Guardian presence subject, last-seen timestamp, and
  stale/away transition state.
- Console web and Windows show Photos/Journal/Share integration state: permission mode, last selected/imported refs, pending drafts, failed imports, redaction state, and Memorr owner refs.
- Console web and Windows show profile-lock state: selected person, namespace, device binding, enrollment correlation, shared-scope usage, and rejected cross-profile attempts without exposing private content.
- Logger stores correlation IDs for iOS-initiated Veliai turns, task mutations, email action promotions, and Guardian action approvals.
- Logger stores internet connector enrollment, revocation, router configuration proposals, notification sends, presence updates, and denied/degraded background or location states without leaking secrets or raw private payloads.
- Console can show a read-only detail view for each iOS-originated action; it cannot impersonate the phone unless a separate owner-approved admin contract exists.

## Release Slices

### R1 - Read-Only Life Dashboard

- Four-tab shell.
- Native SwiftUI Veliai tab with no WebView and no production HTTP REST chat path.
- Native Settings surface with profile, permissions, transport health, and read-only Tab Library availability state.
- First-run profile selection for Iain, Sarah, Finn, or Josh before enrollment.
- Bus auth, encrypted internet enrollment, and heartbeat.
- Phone presence package: app version, schema version, connectivity, battery, storage pressure, notification permission, background-refresh state, and no-location default.
- Endpoint selection for `thethornfamily.co.uk:17443`,
  `amber-bus.amber.com:17443`, AMBER WiFi, `192.168.0.0/24`, and Guardian
  home-presence evidence.
- Read-only Veliai conversation descriptors.
- PhotosUI picker proof, limited-library state display, and local-only Life Capture drafts.
- Journaling Suggestions picker proof where available, with local-only drafts.
- Journal-to-Memorr local draft proof for the locked profile.
- Read-only Guardian to-dos.
- Read-only email digest descriptors.
- Read-only Guardian readiness and alerts.
- Evidence drawer and Console visibility.

### R2 - Safe Mutations

- Add and complete Guardian to-dos.
- Native Veliai framed turn submission and streaming frames.
- Tab Library can enable, disable, reorder, and overflow app-bundled native modules from signed Amber Bus descriptors.
- Optional Crypto and Console Ops tabs can be enabled in native read-only mode when their Bus contracts are present.
- Convert email action candidates into Guardian task proposals.
- Submit Veliai turns through approved queue contracts.
- Confirmed Photos/Journal/Share drafts become Memorr import candidates with source refs.
- Journal-to-Memorr import for the locked profile, plus explicit family/shared journal import.
- Cross-profile rejection proof for private Journal/Memorr/Veliai/notification/presence frames.
- APNs notification registration and Bus-backed notification descriptors.
- Opt-in location presence with retention class and Console visibility.
- Guardian presence integration: AMBER WiFi means the enrolled person is at home,
  with stale/away transitions and Logger evidence.
- User-visible failure states and retry.

### R3 - Guardian Approval Surface

- Approve/reject Guardian gated actions.
- Show rollback/no-action evidence.
- Push notifications for gated actions and critical alerts.
- Background degraded-state reporting for battery, storage, connectivity, and app health.
- Face ID required for sensitive approvals.

### R4 - Rich Life Memory

- Memorr day views and attachment-safe previews.
- Photo Day and Journal Moment views backed by selected iOS assets and Memorr owner refs.
- Opt-in Photos-to-Memorr sync for selected assets, approved albums, and limited-library grants, backed by Memorr-E32 `amber_life.photo_sync` intake.
- Memorr-to-Journal local draft seeding for the locked profile.
- Share Extension ingestion from Photos, Safari, Mail, Messages, Files, and other apps.
- App Intents, widgets, and Live Activities for approved workflows.
- Email thread archive drilldown with redaction gates.
- Cross-tab search over Bus-approved context packs.
- Offline display cache for recent bounded slices.

## Validation Plan

Design validation:

- Confirm every tab maps to a named owner and Amber Bus contract family.
- Confirm no direct owner-service or raw file path is required.
- Confirm Veliai is SwiftUI-native and uses native framed transport, with WebView/HTTP REST production paths disabled.
- Confirm Settings Tab Library enables only app-bundled native modules from signed Amber Bus descriptors and cannot load HTML, JavaScript, WebView URLs, remote UI bundles, or owner-service endpoints.
- Confirm optional Crypto and Console Ops tabs use Amber Bus contracts only and show native missing-contract/revoked/unsupported states.
- Confirm failure states are visible for unavailable Bus, unavailable owner, redacted context, queued action, rejected action, and stale cache.
- Confirm the app uses baked public bootstrap material only, generates per-install keys locally, and can revoke a device/build without touching owner-service credentials.
- Confirm internet access exposes only the Concierge Internet connector and never raw owner services.
- Confirm internet and WiFi/LAN endpoint selection: `thethornfamily.co.uk:17443`
  off-home, and `amber-bus.amber.com:17443` whenever on AMBER WiFi or
  `192.168.0.0/24`.
- Confirm AMBER WiFi presence creates Guardian home-presence evidence for the
  enrolled person and clears or marks stale when the phone leaves or stops
  reporting.
- Confirm PhotosUI/PhotoKit and Journaling Suggestions flows require user selection and produce only pending drafts until owner-confirmed.
- Confirm opt-in Photos-to-Memorr sync is distinct from one-off picker imports and stays scoped to the locked profile or explicit family/shared destination.
- Confirm photo-sync media bytes use Amber Bus-approved Central_IO/FASTIO leases and Memorr owner refs, not JSON/HTTP bodies or direct file writes.
- Confirm Share Extension content remains local/pending until the user confirms privacy, retention, and owner target.
- Confirm first-run profile selection is required and every Bus frame carries a locked profile or explicit shared/family namespace.
- Confirm private cross-profile Memorr, Veliai, Journal, To-Do, Guardian presence, and notification attempts are rejected and logged.

Implementation validation once code exists:

- Unit tests for schema decoding, redaction handling, and mutation state transitions.
- Native transport tests for frame encoding, stream resume, backpressure, reconnect, and no HTTP/WebView fallback.
- DEMand-Mobile tests for enrollment proof, forward-secret session setup, frame counters, replay rejection, multiplexing, priority, backpressure, resumption, revocation, and no VPN/IP-layer exposure.
- Tab Library tests for descriptor signature validation, module availability, enable/disable/reorder/overflow, missing contracts, revoked descriptors, profile/operator-scope checks, and no HTTP/WebView fallback.
- UI snapshot tests for all tabs in ready, degraded, offline, and blocked states.
- Bus contract integration tests with recorded owner fixtures.
- Enrollment, certificate pinning, revocation, and expired-build tests.
- Background presence tests for denied permissions, low battery, storage pressure, offline mode, and stale APNs token.
- Guardian presence tests for AMBER WiFi attached, AMBER WiFi detached,
  `192.168.0.0/24` local-subnet attached/detached, LAN endpoint available,
  internet endpoint available, stale last-seen, and denied network/location
  permission states.
- Photos/Journal/Share tests for limited-library, revoked access, user cancel, large asset, failed Memorr import, tombstone propagation, and redacted summary states.
- Photos-to-Memorr sync tests for off/default, selected assets, album sync, limited-library sync, duplicate upload, interrupted upload, power/network pause, cross-profile rejection, family/shared destination, and delete/revoke tombstones.
- Profile-lock tests for first-run selection, missing profile, re-enrollment, device transfer, family/shared scope, and cross-profile denial.
- Console parity check proving iOS client state is visible in web and Windows surfaces.
- Logger proof check for task add, email-to-task, Veliai turn, and Guardian approval.

## Go / No-Go

Go when:

- Amber Bus exposes bounded read contracts for all four tabs.
- Concierge Internet connector has encrypted client transport, router apply/rollback evidence, revocable device enrollment, and Console/Logger visibility.
- Amber Life can reach `thethornfamily.co.uk:17443` over the internet and uses
  `amber-bus.amber.com:17443` whenever on AMBER WiFi or `192.168.0.0/24`.
- Guardian task contracts are canonical and mutation-safe.
- Concierge/Memorr email digest descriptors exist without raw mailbox dependency.
- Veliai Queue can accept iOS-originated turns with profile and memory evidence.
- Native Veliai transport accepts iOS-originated turns without WebView or HTTP REST in the production path.
- DEMand-Mobile over `amber-bus.amber.com:17443` on AMBER WiFi or
  `192.168.0.0/24`, and over `thethornfamily.co.uk:17443` off-LAN/internet, is
  the production encrypted Amber Bus transport for all app tabs; no VPN, HTTP
  data plane, WebView, REST polling, or direct owner-service call is required.
- Settings Tab Library can enable the first optional native tabs, Crypto and Console Ops, from signed Amber Bus descriptors with Console/Logger evidence.
- Photos, Journal Suggestions, and Share Extension drafts can become Memorr import candidates with explicit user confirmation.
- Opt-in Photos-to-Memorr sync has Memorr-E32 backend proof for profile-scoped asset/source refs, Central_IO/FASTIO media leases, dedupe, interrupted-upload recovery, limited-library revocation, tombstones, and Console/Logger evidence.
- Journal-to-Memorr and Memorr-to-Journal-draft flows work for the locked profile and explicit family/shared scope.
- Amber Bus enforces profile locks for private Amber Life frames.
- Console and Logger can show iOS client proof.
- Amber Life can report phone presence and receive Bus-backed notifications without direct owner-service calls.
- Guardian can consume AMBER WiFi presence as a home signal for the enrolled
  person with owner-visible evidence.

No-go when:

- The app would need direct owner-service calls to feel useful.
- Internet access requires manual client configuration or exposes private LAN owner endpoints.
- Private keys, shared secrets, owner tokens, mailbox credentials, or Bus root credentials are baked into the app.
- The `17443` transport is implemented as VPN/IP-layer access, HTTP/REST, WebView, WebSocket web-app tunnel, or another non-DEMand-Mobile production path.
- Settings Tab Library can load remote UI, HTML, JavaScript, web Console pages, or unsigned descriptors.
- Crypto or Console Ops tabs require direct HTTP/owner-service calls instead of Amber Bus contracts.
- The Veliai tab depends on WebView, hosted web UI, HTTP REST chat, polling, or browser local storage for production chat.
- Photos, Journal Suggestions, or Share Extension imports bypass user selection or owner confirmation.
- Photo sync can run silently by default, cross profile boundaries, or upload media bytes outside the Amber Bus/Central_IO/Memorr owner contract.
- First run does not require choosing Iain, Sarah, Finn, or Josh.
- Private Bus frames can omit profile lock metadata.
- Cross-profile private reads/writes succeed without an explicit shared/family/admin policy.
- Email digest requires mailbox credentials on the phone.
- To-dos are still memory-only or UI-cache-only.
- Guardian action proof cannot be distinguished from Veliai advice.
- Redaction and sensitive approval UX are not implemented.
