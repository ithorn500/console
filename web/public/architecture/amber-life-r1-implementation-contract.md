# Amber Life R1 Implementation Contract

Status: implementation contract / build target
Date: 2026-06-03
Scope: exact R1 build contract for the native Amber Life iOS app.

## Evidence Baseline

This contract refines [`amber-life-ios-app.md`](amber-life-ios-app.md). It turns
the missing R1 items into buildable modules, Bus contracts, state machines,
permissions, tests, and go/no-go gates.

The Journal product contract is
[`amber-life-journal-app.md`](amber-life-journal-app.md). R1 implementation must
treat Journal as a native Amber Life surface with Timeline, Composer,
JournalingSuggestions, LocalAuthentication app lock, notifications, local
persistence, and Memorr sync over Amber Bus.

The unified visual/product style guide is
[`amber-life-style-guide.md`](amber-life-style-guide.md). R1 implementation must
follow its warm cream/amber/espresso palette, serif display titles, relationship
labels, image-led cards, Windows sidebar layout, and first-class Veliai
interaction tab.

R1 still obeys the same hard boundaries:

- Amber Life is a native iOS app, not a WebView or hosted web shell.
- Production data moves through Amber Bus only.
- Off-LAN access uses DEMand-Mobile on `thethornfamily.co.uk:17443`.
- AMBER WiFi or `192.168.0.0/24` access uses DEMand-Mobile/Desktop on
  `amber-bus.amber.com:17443`.
- Public `443` remains Exchange/IIS-owned and is not used by Amber Life R1.
- No owner-service HTTP, REST polling, mailbox credential, raw owner DB/file
  access, or reusable private key is embedded in the app.
- First launch asks exactly `Iain`, `Sarah`, `Finn`, or `Josh`; that profile
  lock is carried by every private Bus frame.

## Swift Product Layout

R1 source should be structured as one app plus focused Swift packages/targets:

| Target | Purpose |
| --- | --- |
| `AmberLifeApp` | App entry point, root navigation, lifecycle, scene state, dependency wiring. |
| `AmberLifeDesignSystem` | Shared SwiftUI components, semantic colors, status chips, evidence rows, loading/degraded states. |
| `AmberBusSchemas` | Generated Swift models/codecs for the first Bus frame schemas. |
| `AmberNativeTransport` | Raw native framed transport, frame encoder/decoder, stream multiplexer, priority/backpressure hooks. |
| `AmberDemandMobile` | DEMand-Mobile enrollment, session negotiation, encryption envelope, resume, replay protection, revocation handling. |
| `AmberLifeEnrollment` | First-run profile choice, device key generation, challenge/response, profile-lock persistence. |
| `ProfileLockFeature` | Profile display, lock state, re-enrollment/transfer state, cross-profile denial UI. |
| `TabLibraryFeature` | Signed descriptor validation, optional tab enable/disable/reorder/overflow, missing-contract states. |
| `VeliaiFeature` | Native SwiftUI Veliai conversation, streaming frames, memory/route evidence. |
| `TodoFeature` | Guardian task list/read-only R1 surface, later safe mutations. |
| `EmailSummaryFeature` | Concierge/Memorr/Veliai digest descriptors and action candidates. |
| `GuardianFeature` | Readiness, alerts, presence, action proof, advice-vs-apply separation. |
| `LifeCaptureFeature` | Local pending life drafts, privacy/retention chooser, share handoff. |
| `PhotosJournalFeature` | PhotosUI/PhotoKit limited-library state, Journaling Suggestions picker, local draft bridge, and photo sync to Memorr. |
| `JournalFeature` | Timeline, composer, reflections, suggestions embedding, app lock, reminders, local journal storage, and Memorr journal sync. |
| `AmberLifePresence` | Phone presence package, AMBER WiFi evidence, background freshness/staleness policy. |
| `AmberLifeNotifications` | APNs token lifecycle, Bus notification descriptors, action ack, privacy redaction. |
| `EvidenceFeature` | Life Evidence layer, source/freshness/confidence views, correlation drilldown. |
| `OfflineDisplayCache` | Encrypted bounded display cache and pending outbox; never owner truth. |
| `AmberLifeTestSupport` | Mock Bus, DEMand-Mobile simulator, owner fixtures, snapshot fixtures. |

R1 may include stubs for `CryptoFeature` and `ConsoleOpsFeature`, but optional
tabs become visible only when signed descriptors and native modules are present.

## First Bus Schemas

The first generated Swift schema set must cover these frame families:

| Schema family | Required R1 frames |
| --- | --- |
| `amber_life.enrollment` | bootstrap metadata, profile lock, enrollment challenge, enrollment result, revocation state. |
| `amber_life.session` | DEMand-Mobile hello, session ready, resume request/result, heartbeat, close, error. |
| `amber_life.presence` | phone health, connectivity, AMBER WiFi home evidence, stale/away transition, permission state. |
| `amber_life.notification` | APNs token registration, notification descriptor, action ack, delivery/failure evidence. |
| `amber_life.tab_descriptor` | signed descriptor, availability, enable/disable/reorder, missing contract, revoked descriptor. |
| `amber_life.evidence` | source owner, freshness, confidence, profile scope, privacy/retention, refs, redaction, missing/degraded state. |
| `veliai.client` | conversation descriptor, turn submit, token/partial/final frames, route state, memory refs, advice-only marker. |
| `guardian.todo` | task list, task detail, evidence refs, read/degraded state. |
| `guardian.presence` | profile subject, home-network evidence, current/stale/away status, confidence, owner policy. |
| `guardian.action` | advisory proposal, approval required, applied, failed, rollback/no-action proof. |
| `concierge.email_summary` | digest group, thread summary, redaction state, action candidate, archive refs. |
| `memorr.life_capture` | local draft descriptor, import candidate, owner refs, privacy/retention, tombstone/unavailable state. |
| `memorr.photo_sync` | sync manifest, asset descriptor, lease request/result, progress, duplicate, failed, revoked, tombstone. |
| `memorr.journal` | journal draft descriptor, suggestion import candidate, Memorr ref, delete/revoke state. |

Generated schema rules:

- Swift models are generated from owner-approved schema definitions, not copied
  by hand in feature views.
- Every private schema carries `person_id`, `profile_namespace`,
  `profile_lock_id`, `device_install_id`, and `sharing_scope`.
- Every frame carries `schema_version`, `correlation_id`, `owner`, and
  `evidence_ref` where applicable.
- Unknown schema versions fail closed or show a native unsupported state.

## Shared R1 Snapshot Schema

The first cross-platform Amber Life UI snapshot contract is:

- `schemas/amber-life/amber.life.r1.snapshot.v1.schema.json`
- `data/amber-life/amber.life.r1.snapshot.fixture.v1.json`

This schema is the shared fixture shape for Windows, iOS, and macOS R1 work. It
requires the six default surfaces `veliai`, `guardian`, `email`, `todo`, `life`,
and `settings`, and allows the Windows-led `today` dashboard as a native
dashboard surface. Every surface includes owner, state, transport state,
metrics, primary actions, panels, and Life Evidence.

Every metric, action, panel, and surface snapshot carries the same Life Evidence
fields: owner system, source ref, profile scope, freshness, confidence percent,
privacy class, retention class, schema ref, correlation ID, and state.

Generated Swift, macOS Swift, and C# models must stay field-compatible with this
schema. Platform-specific additions belong in evidence/capability fields, not in
new platform-only owner truth.

## DEMand-Mobile State Machine

R1 client state:

```text
not_started
  -> bootstrap_loaded
  -> profile_required
  -> profile_locked
  -> device_key_ready
  -> enrollment_challenge
  -> enrolled
  -> connecting
  -> session_negotiating
  -> session_ready
  -> degraded
  -> reconnecting
  -> offline_cache
  -> revoked
  -> update_required
```

State rules:

- `profile_required` blocks all privileged network traffic.
- `device_key_ready` uses locally generated per-install keys; build metadata is
  not network authority.
- `session_ready` is the only state that can send live owner mutations.
- `degraded` may read cached slices and send bounded presence if policy allows.
- `offline_cache` cannot claim a mutation succeeded.
- `revoked` stops privileged traffic and shows re-enrollment/lost-phone state.
- `update_required` stops traffic when build trust, pins, or minimum schema are
  rejected by Amber Bus.

Endpoint selection:

1. On SSID `AMBER`, or when the active network is inside `192.168.0.0/24`, use
   `amber-bus.amber.com:17443`.
2. If LAN fails, or the device is off AMBER/local subnet, use
   `thethornfamily.co.uk:17443`.
3. Never fall back to private owner-service URLs, raw LAN ports, HTTP REST, or
   WebView paths.

Inside the Amber LAN, `thethornfamily.co.uk` is split-horizon DNS and may resolve
to Exchange (`exchangesrv2019.amber.com`) rather than Amber Bus. R1 clients must
not use `thethornfamily.co.uk:17443` for LAN validation or LAN fallback while on
SSID `AMBER` or `192.168.0.0/24`; only external internet probes may validate the
public hostname.

## Onboarding Flow

```text
Launch
  -> load public bootstrap metadata and pins
  -> choose profile: Iain / Sarah / Finn / Josh
  -> create local profile-lock record
  -> generate per-install device key
  -> connect to DEMand-Mobile endpoint
  -> complete Bus enrollment challenge
  -> receive scoped revocable device credential
  -> request permissions only when a feature needs them
  -> enter four-tab shell
```

Profile switching is not an R1 convenience feature. A profile change requires
biometric unlock plus owner-approved re-enrollment, transfer, or admin policy.

## Permission Matrix

| Permission | R1 timing | Required for | Denied behavior |
| --- | --- | --- | --- |
| Network | Launch/enrollment | Bus session and evidence. | Offline cache only; no owner success claims. |
| Notifications/APNs | After shell is useful | Bus-backed notifications and action alerts. | App shows notification disabled; Console sees state. |
| Background App Refresh | Presence setup | Heartbeat, badge/digest freshness. | `background_refresh_denied`; stale timers apply. |
| Local network / WiFi identity where required | Presence setup | AMBER WiFi home evidence. | Presence falls back to non-WiFi freshness. |
| Location | Explicit opt-in only | GPS/coarse presence or WiFi identity if required by iOS. | No location presence; network evidence only where available. |
| Photos | Life Capture or Photo Sync | Picker, limited-library state, approved sync. | Draft/photo sync unavailable with clear evidence. |
| Journaling Suggestions | Journal flow | User-selected Journal moments. | Journal import unavailable; local drafts still work. |
| Microphone/Siri/App Intents | Voice entry | Ask Veliai, add task by voice. | Text entry remains available. |
| Face ID/biometrics | Sensitive action/read | App unlock, raw thread review, Guardian approvals. | Sensitive action blocked or password/device auth fallback by policy. |

Permissions are requested just in time. The first run profile choice must happen
before permission prompts so consent binds to the selected person.

## Life Evidence Contract

Every feature uses `EvidenceFeature` for the same evidence shape:

| Field | Meaning |
| --- | --- |
| `owner_system` | Veliai, Guardian, Memorr, Concierge, Logger, Crypto, Console, or Amber Bus. |
| `source_ref` | Owner ref, Memorr ref, Logger ref, Bus route, or schema frame source. |
| `profile_scope` | Locked profile, family/shared, or operator/admin scope. |
| `freshness` | Observed timestamp, stale-after window, current/stale/offline state. |
| `confidence` | Value plus source, for example AMBER WiFi evidence or owner assertion. |
| `privacy_retention` | Privacy class, retention class, redaction state, export/delete policy. |
| `correlation` | Bus correlation ID and related Logger IDs. |
| `action_state` | Advice-only, pending, queued, applied, failed, rolled back, no-action. |
| `missing_state` | Missing, denied, unavailable, revoked, unsupported, or schema mismatch. |

R1 screens must include an evidence affordance for Veliai responses, Guardian
presence, task rows, email summaries, notification rows, Life Capture drafts,
photo/journal imports, and transport/session state.

## Background Execution

R1 background policy:

- Use bounded BGTaskScheduler jobs for digest/presence refresh where iOS permits.
- Use significant-change or coarse location only after explicit opt-in.
- Prefer AMBER WiFi and power for photo sync previews/import prep.
- Pause non-critical background work for low-power mode, critical battery,
  thermal pressure, storage pressure, or Bus backpressure.
- Publish freshness and stale state instead of pretending background work is
  continuous.

Presence freshness:

- `current`: recent heartbeat or AMBER WiFi evidence inside Guardian policy.
- `stale`: last evidence exceeded the freshness window.
- `away`: Guardian policy decided away after detach/stale transition.
- `unknown`: permission denied, revoked, first launch incomplete, or no evidence.

## Photo And Journal Sync Engine

R1 implements picker/draft proof and the local sync engine foundations:

- encrypted local manifest keyed by `profile_lock_id`;
- asset descriptors for selected items and limited-library grants;
- change observation where Photos permission allows it;
- Central_IO/FASTIO lease request descriptors for later media upload;
- duplicate, interrupted, revoked, tombstone, and retry states;
- no silent full-library scan;
- no write/read claim against Apple's private Journal database.

Photo sync remains off by default. R1 may keep media upload disabled until the
Memorr-E32 `amber_life.photo_sync` intake is green, but the UI/state machine and
test fixtures must already model the full path.

## Guardian Approval UX

R1 is mostly read-only, but it must already show the difference between:

- Veliai advice;
- Guardian proposal;
- approval required;
- queued;
- applied;
- failed;
- rolled back;
- no-action.

Sensitive Guardian approval flows in later releases must reuse the R1 proof
components and require biometric/device authentication before submit.

## Observability And Privacy

R1 must provide:

- in-app diagnostics bundle with build, schema, endpoint, session, permission,
  and last correlation IDs;
- Console web and Windows visibility for app version, profile lock, endpoint,
  session health, notification state, background state, and failed contracts;
- Logger evidence for enrollment, revocation, presence, notification, Veliai
  turn, task/email/Guardian attempts, photo/journal import attempts;
- retention/export/delete surface for profile-scoped local cache and Memorr refs;
- accessibility baseline for Dynamic Type, VoiceOver labels, contrast, reduced
  motion, and keyboard/switch navigation where applicable.

Diagnostics must not include private keys, bearer credentials, raw mailbox
content, raw private photo bytes, or raw private journal text.

## Test Fixtures

R1 test harness must include:

- Mock Amber Bus frame server.
- DEMand-Mobile simulator for enrollment, reconnect, resume, revoke, replay
  rejection, schema mismatch, and endpoint failure.
- Owner fixtures for Veliai, Guardian, Concierge, Memorr, Logger, Tab Library,
  notifications, presence, and evidence.
- UI snapshot fixtures for ready, loading, degraded, offline, revoked, denied,
  missing-contract, cross-profile-denied, and stale states.
- Photo/Journal fixtures for picker cancel, limited library, revoked library,
  large asset, duplicate asset, tombstone, and redacted journal import.
- Static checks proving no WebView/HTTP production data plane in app feature
  targets.
- Console/Logger parity fixtures proving every app-originated action can be
  followed through owner evidence.

## R1 Go / No-Go

Go when:

- The Swift app launches into onboarding and requires one of the four profiles.
- DEMand-Mobile can complete an enrolled or simulated session on the approved
  endpoint model.
- All four default tabs render native ready/degraded/offline states from typed
  Bus fixtures.
- Life Evidence opens from every R1 tab and shows source, freshness, profile,
  confidence, owner refs, and missing/degraded state.
- Permission denials are visible and do not create fake success.
- APNs/token state and notification descriptors are modeled even if live push is
  not yet promoted.
- Photo/Journal drafts remain local/pending until owner confirmation.
- Console/Logger can see client state and failed contracts through Bus fixtures.
- Tests prove no WebView, REST polling, direct owner-service operational call, or
  owner credential in the production data plane.

No-go when:

- Any tab needs HTTP/REST/WebView/direct owner calls to feel alive.
- The app can enroll without a profile lock.
- Build metadata or app bundle secrets become permanent network authority.
- Evidence is absent, raw JSON-only, or cannot distinguish advice from applied
  owner truth.
- Permission denial, offline mode, stale data, revoked device, or schema mismatch
  produces green UI.
- Photo sync can silently upload outside the locked profile or without explicit
  consent.
