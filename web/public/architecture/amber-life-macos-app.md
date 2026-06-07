# Amber Life macOS App Design

Status: product and architecture design
Date: 2026-06-03
Scope: native macOS Amber Life client kept in lock-step with the iOS and
Windows Amber Life designs under E31-F1-007.

## Evidence Baseline

This design follows the same owner boundaries as
[`amber-life-ios-app.md`](amber-life-ios-app.md) and
[`amber-life-windows-app.md`](amber-life-windows-app.md):

- Amber Life macOS is a user/family client, not Amber Console, not a hosted web
  shell, and not an AIGateway runtime service.
- Production data uses Amber Bus typed frames only. No tab may use WebView,
  hosted Console, HTTP REST polling, owner-service URLs, browser storage, or a
  remote UI bundle.
- Off-LAN access uses the public Concierge Internet endpoint
  `thethornfamily.co.uk:17443`.
- On AMBER WiFi or any `192.168.0.0/24` local route, macOS must use
  `amber-bus.amber.com:17443`.
- Public `443` remains Exchange/IIS-owned and is not used by Amber Life.
- The first-run profile lock is identical to iOS and Windows: `Iain`, `Sarah`,
  `Finn`, or `Josh`.
- Private device keys are generated on-device and stored in Keychain/Secure
  Enclave where available; only public endpoint/trust material is bundled.
- Memorr owns durable photo, journal, file, and life-capture records after
  import; Amber Life keeps only local encrypted drafts/cache and owner refs.
- Console web and Console Windows show macOS client/session/evidence state via
  Amber Bus contracts; E36 does not own the macOS app.

Apple platform notes:

- Use SwiftUI for the primary macOS UI and AppKit only for platform-specific
  integrations such as menu bar, document/drop handling, windowing, and sharing
  where SwiftUI does not cover the behavior cleanly.
- Use PhotosPicker/PhotoKit where macOS supports the required flow, preserving
  user-selected or limited-library consent.
- Journaling Suggestions is treated as iOS/iPadOS-first unless Apple exposes the
  required entitlement and picker on macOS for this app. macOS can display and
  edit Amber Life journal drafts and Memorr-backed moments, but it must not
  claim direct access to Apple's private Journal app database.
- Use ServiceManagement `SMAppService` for optional launch-at-login helpers on
  macOS 13 and later.

## Product Shape

The app name remains `Amber Life`.

Default macOS navigation uses a native sidebar and toolbar rather than an iOS
bottom tab bar:

| Surface | macOS label | Primary owner | Lock-step contract |
| --- | --- | --- | --- |
| Veliai | `Veliai` | Veliai/Gemma Gateway via Amber Bus | Same `veliai.client` frames as iOS/Windows; native streaming UI. |
| To-Do | `To-Do` | Guardian via Amber Bus | Same `guardian.todo` and evidence frames. |
| Email Summary | `Email` | Concierge + Memorr + Veliai via Amber Bus | Same digest/redaction/archive descriptors. |
| Guardian | `Guardian` | Guardian via Amber Bus | Same presence/readiness/action-proof frames. |
| Life Capture | `Life Capture` | Amber Life + Memorr via Amber Bus | Same local-draft and Memorr intake descriptors. |
| Settings | `Settings` | Amber Life client + Amber Bus | Same profile, transport, permission, tab library, privacy, and update state. |

Optional tabs stay identical to iOS/Windows:

| Optional tab | macOS label | Rule |
| --- | --- | --- |
| Crypto | `Crypto` | Native module enabled only by signed Amber Life tab descriptor. |
| Console Ops | `Console` | Native operator-health module over Amber Bus contracts; not a hosted Console WebView. |

The macOS app may use multiple windows for Veliai conversations, evidence
drilldowns, and Life Capture drafts. Multi-window state never bypasses the
locked profile; each private window carries the same `profile_lock_id`.

## Platform Capabilities

macOS contributes desktop-class life context while obeying the same consent and
owner-truth rules:

| Capability | macOS design |
| --- | --- |
| Presence | App active/idle, launch-at-login state, AMBER LAN evidence, network class, battery/power state where available, storage pressure, and stale timers. |
| Notifications | UserNotifications with privacy-redacted descriptors and Bus-backed action ack; no raw private payload in notification text. |
| Files and folders | Drag/drop, file picker, Finder share extension, clipboard, screenshot import, scanner/camera import where available. All imports become local pending drafts first. |
| Photos | User-selected PhotosPicker/PhotoKit import and optional profile-scoped photo sync where consented. No silent full-library import. |
| Journal | Amber Life journal drafts and Memorr-to-journal draft views. Direct Apple Journal database reads/writes are forbidden. |
| Biometrics | LocalAuthentication/Touch ID for sensitive reads, profile re-enrollment, Guardian approvals, raw email review, and destructive import/delete actions. |
| Background | Optional launch-at-login helper plus bounded refresh. It publishes freshness and degraded state instead of pretending always-on background execution. |
| Updates | In-app DEMand-Desktop update intent/package transfer over `17443`, hash verification, staged replacement, notarized package handoff when packaged for distribution. No bootstrapper. |

## Suggested Swift Package Layout

The macOS source should share generated Swift schema and transport packages with
iOS where possible:

| Target | Purpose |
| --- | --- |
| `AmberLifeMacApp` | macOS app entry, scenes, sidebar, commands, windows, menu bar, dependency wiring. |
| `AmberLifeDesignSystem` | Shared SwiftUI components with macOS density, keyboard focus, evidence rows, status chips. |
| `AmberBusSchemas` | Shared generated Swift models/codecs for Amber Life Bus schemas. |
| `AmberNativeTransport` | Shared framed transport, frame encoder/decoder, stream mux, backpressure. |
| `AmberDemandDesktop` | macOS DEMand-Desktop enrollment, endpoint selection, TLS/pinning, resume, revocation. |
| `AmberLifeEnrollment` | Shared profile lock, local device key, challenge/response, re-enrollment state. |
| `MacPresenceFeature` | Active/idle/network/power/storage presence descriptors and stale policy. |
| `MacLifeCaptureFeature` | File, folder, clipboard, screenshot, camera/scanner, Finder share drafts. |
| `MacPhotosFeature` | PhotosPicker/PhotoKit import and consent state. |
| `MacNotificationsFeature` | UserNotifications registration, action ack, privacy redaction. |
| `MacUpdateFeature` | DEMand-native self-update, package hash verification, staged app replacement. |
| `VeliaiFeature` | Shared native Veliai conversation with macOS keyboard/window affordances. |
| `TodoFeature` | Shared Guardian task view with macOS list/detail layout. |
| `EmailSummaryFeature` | Shared Concierge/Memorr/Veliai digest views. |
| `GuardianFeature` | Shared readiness, presence, approvals, and action proof. |
| `TabLibraryFeature` | Shared signed descriptor validation and optional native module visibility. |
| `EvidenceFeature` | Shared Life Evidence layer and correlation drilldown. |
| `AmberLifeMacTestSupport` | Mock Bus, DEMand-Desktop simulator, UI snapshots, permission fixtures. |

## DEMand-Desktop macOS State Machine

macOS uses the same state names and failure behavior as the iOS R1 contract,
with desktop-specific endpoint evidence:

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

Endpoint order:

1. If an active network route is inside `192.168.0.0/24`, or the WiFi SSID is
   known to be `AMBER`, use `amber-bus.amber.com:17443`.
2. Otherwise use `thethornfamily.co.uk:17443`.
3. Never fall back to `443`, Exchange, private owner-service ports, HTTP REST,
   WebSocket web-app tunnels, or direct Guardian/Memorr/Veliai APIs.

## Life Evidence

macOS uses the exact same `Life Evidence` shape as iOS and Windows. Every row,
notification, Veliai answer, import draft, update state, presence state, and
optional tab item can open evidence with:

- owner system;
- source ref;
- profile scope;
- freshness and stale-after policy;
- confidence and confidence source;
- privacy/retention class;
- Bus schema/frame/correlation ID;
- Logger/Memorr/Guardian/Concierge/Veliai refs;
- missing/degraded/denied/revoked state;
- action state.

The shared R1 snapshot/evidence schema for macOS, iOS, and Windows is
`schemas/amber-life/amber.life.r1.snapshot.v1.schema.json`, with fixture
`data/amber-life/amber.life.r1.snapshot.fixture.v1.json`. macOS Swift models and
test fixtures must stay compatible with that schema.

macOS adds desktop evidence fields where useful:

- active window/session id;
- launch-at-login state;
- local account display label, never a password/account secret;
- file import source kind, bookmark state, and sandbox scope;
- power/storage/network pressure evidence.

## Packaging And Updates

R1 design target:

- Signed/notarized `.app` inside a signed `.pkg` or `.dmg`, depending on the
  eventual distribution lane.
- In-app self-update over DEMand-Desktop on `17443`, not a bootstrapper.
- Update intent returns package refs and SHA256, not HTTP URLs.
- The app downloads package chunks through encrypted DEMand frames, verifies the
  hash, stages the update, exits, replaces the app payload, and relaunches.
- Update failures are visible in Settings, Console, and Logger.

The packaging workflow should be GitHub Actions on macOS runners once the app is
implemented. Build proof must include:

- `xcodebuild` or SwiftPM build;
- unit tests for endpoint selection, profile lock, DEMand frame parsing, update
  manifest/hash handling, and tab descriptor validation;
- signed/notarized artifact proof when distribution is enabled;
- generated Amber Life macOS app manifest with `bootstrapper: not_used` and
  `update_mode: in_app`.

## Lock-Step Rules

macOS must stay in lock-step with iOS and Windows:

- Same first-run profile names and profile-lock semantics.
- Same default surfaces and optional tab descriptor rules.
- Same no-HTTP/no-WebView production data plane.
- Same endpoint selection and split-DNS rule.
- Same Life Evidence fields.
- Same Memorr handoff rules for Photos, journal, file, and Life Capture intake.
- Same Guardian advice-vs-apply separation.
- Same Console/Logger visibility requirements.
- Platform differences are represented as capability/evidence fields, not new
  owner truth or platform-only schemas.

## Go / No-Go

Go when:

- macOS design is referenced by E31-F1-007 alongside iOS and Windows.
- No macOS feature requires WebView, HTTP REST, direct owner APIs, or private DB
  reads.
- DEMand-Desktop, profile lock, Life Evidence, Tab Library, notifications,
  presence, Life Capture, Photos, journal drafts, and update contracts match the
  iOS/Windows contract set.
- Console/Logger proof includes macOS client state.

No-go when:

- macOS becomes a Console wrapper or WebView.
- A macOS-only schema diverges from iOS/Windows without an explicit owner
  contract.
- File/Photos/Journal imports bypass user confirmation, privacy class,
  retention class, and Memorr owner refs.
- The app requires a bootstrapper or HTTP update path.
- The app uses `thethornfamily.co.uk:17443` on AMBER/`192.168.0.0/24` instead
  of `amber-bus.amber.com:17443`.
