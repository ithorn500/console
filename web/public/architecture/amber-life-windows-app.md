# Amber Life Windows App Design

Status: product and architecture design
Date: 2026-06-03
Scope: future native Windows version of Amber Life for Veliai, To-Do, Email
Summary, Guardian, Life Capture, notifications, optional tabs, and Life Evidence.

## Evidence Baseline

This design complements the iOS design and R1 contract:

- [`amber-life-ios-app.md`](amber-life-ios-app.md) defines the Amber Life product
  shape, profile lock, owner boundaries, tabs, DEMand-Mobile transport, and Life
  Evidence model.
- [`amber-life-r1-implementation-contract.md`](amber-life-r1-implementation-contract.md)
  defines the first schema families, state machine, evidence fields, and test
  model that Windows must share where platform-neutral.
- [`amber-life-style-guide.md`](amber-life-style-guide.md) defines the Amber Life
  Windows sidebar, warm cream/amber/espresso palette, serif display titles,
  relationship labels, image-led cards, and Veliai interaction tab direction.
- [`Amber-Console-E36-plan-and-delivery.md`](../Amber-Console-E36-plan-and-delivery.md)
  makes Console proof Bus-only and distinct from Amber Life app ownership.
- `clients/windows` already contains the Amber Console Windows WinUI 3/.NET
  client. Amber Life Windows may reuse packaging, design-system, schema, and Bus
  client lessons from that codebase, but it is a separate user Amber Life client, not
  the Console renamed.

## Product Boundary

Amber Life Windows is a native Windows app for family/user workflows. It is not:

- Amber Console Windows;
- a web wrapper around `console.amber.com`;
- a browser-hosted Veliai page;
- a new Amber runtime service;
- a direct client for Guardian, Memorr, Veliai, Concierge, Crypto, or Logger
  private APIs.

Console Windows remains the operator app. Amber Life Windows may enable an
optional `Console` tab from the signed Tab Library, but that tab is a bounded
native read-only/operator-scoped view over Amber Bus contracts.

## Platform Direction

Recommended implementation:

- WinUI 3 / Windows App SDK on .NET, aligned with the existing
  `clients/windows` direction.
- A new product tree, for example `clients/windows/AmberLife.Windows`, rather
  than adding Life tabs into `AmberConsole.Windows`.
- Shared generated C# schema/codecs with Console Windows where the Bus contracts
  are identical.
- Native framed Amber Bus transport for production Life data. HTTP compatibility
  may exist only for existing Console migration routes or explicit diagnostics;
  it is not the production Amber Life data plane.
- Per-user full MSI install of the Amber Life app payload. Amber Life Windows
  does not use the Amber Console bootstrapper/launcher pattern; update checks,
  package verification, staging, and restart handoff are in-app.

## Transport

Windows uses the same Amber Bus owner boundaries as iOS:

```text
Amber Life Windows
  -> amber-bus.amber.com:17443 on AMBER WiFi or 192.168.0.0/24 LAN
  -> thethornfamily.co.uk:17443 off-LAN or when the local route fails
  -> DEMand native encrypted client session
  -> approved Amber Bus contracts
  -> owner services through existing owner boundaries
```

Transport rules:

- Public `443` remains Exchange/IIS-owned and is not used by Amber Life.
- `thethornfamily.co.uk:17443` is the internet/off-LAN endpoint.
- `amber-bus.amber.com:17443` is the required LAN endpoint whenever Windows is
  on AMBER WiFi or the `192.168.0.0/24` local subnet.
- On the Amber LAN, `thethornfamily.co.uk` is split-horizon DNS and may resolve
  to Exchange (`exchangesrv2019.amber.com`) rather than Amber Bus. The Windows
  app must not test or use `thethornfamily.co.uk:17443` while on AMBER WiFi or
  `192.168.0.0/24`.
- No WebView, REST polling, hosted web UI, browser storage, direct owner-service
  calls, mailbox credentials, or raw Memorr file paths.
- The Windows client uses the same profile-lock, schema-version, correlation,
  evidence, revocation, and tab-descriptor rules as iOS.
- Private device keys are generated on-device and protected with Windows
  platform key storage / DPAPI; app bundles contain public bootstrap metadata
  only.

The transport name may be `DEMand-Desktop` if the implementation wants a
desktop-specific profile, but it must be frame-compatible with the E31 Amber
Life contract and share the same security properties as DEMand-Mobile:
per-install credentials, forward-secret sessions, replay protection,
multiplexing, priority lanes, backpressure, resumption, and revocation.

## Identity And Profile Lock

First launch asks exactly:

- `Iain`
- `Sarah`
- `Finn`
- `Josh`

The chosen person locks:

- Veliai namespace;
- Memorr namespace;
- Journal/Life Capture namespace;
- Guardian presence subject;
- To-Do private namespace;
- notification scope;
- local encrypted display cache.

Windows-specific profile rules:

- The lock is per Windows user profile and per device install.
- On a shared PC, device possession or Windows sign-in is not enough to switch
  Amber Life profiles.
- Profile switching requires Windows Hello or device authentication plus
  owner-approved re-enrollment, transfer, parental/admin policy, or explicit
  shared/family scope.
- A family/shared mode may create tasks or shared life captures without exposing
  another person's private Memorr, Veliai, Journal, Email, or notification data.

## Navigation

Desktop layout uses a left navigation rail rather than mobile bottom tabs:

| Surface | Default | Owner |
| --- | --- | --- |
| Veliai | Yes | Veliai/Gemma through Amber Bus |
| To-Do | Yes | Guardian through Amber Bus |
| Email | Yes | Concierge + Memorr + Veliai through Amber Bus |
| Guardian | Yes | Guardian through Amber Bus |
| Life Capture | Yes on desktop | Memorr through Amber Bus |
| Settings | Always available | Amber Life client + Amber Bus |
| Crypto | Optional | Crypto + Memorr through Amber Bus |
| Console | Optional | Console + Logger through Amber Bus |

Desktop should make better use of width:

- Veliai can show conversation, memory/evidence rail, and draft/context panel at
  the same time.
- To-Do can show board/list/detail split views.
- Email can show digest, thread summary, and action candidates without exposing
  raw mailbox credentials.
- Guardian can show readiness, alerts, action proof, and runbook evidence.
- Life Capture can show local drafts, selected files/photos, journal entries,
  import state, and Memorr refs.

## Windows Integrations

Amber Life Windows uses Windows-native integration points where they are
available and consented:

- Windows Hello for app unlock and sensitive Guardian approvals.
- Windows toast notifications for Bus-backed notification descriptors.
- Startup/background presence only if explicitly enabled.
- System tray status for connection, pending sync/import, and critical alerts.
- File picker for Pictures, Videos, Documents, Downloads, screenshots, PDFs, and
  selected folders.
- Drag/drop and clipboard import into Life Capture as local pending drafts.
- Share target / protocol activation where packaging supports it.
- Camera, microphone, and scanner capture only after explicit feature consent.
- Local notification badges and task reminders from Bus descriptors.

Windows-specific hard rules:

- The app does not scan the whole filesystem by default.
- Pictures/Documents folder sync is opt-in and profile-scoped.
- OneDrive, Windows Photos, OneNote, Outlook, or other app content enters Amber
  Life only through user-selected files, share/export flows, or approved owner
  connectors. Amber Life does not mine private app databases.
- Email Summary still comes from Concierge/Memorr/Veliai through Amber Bus; the
  Windows app does not hold Exchange, IMAP, SMTP, or mailbox credentials.
- Clipboard content is local pending data until the user confirms privacy,
  retention, and owner target.

## Life Capture On Windows

Windows has a stronger desktop capture surface than iOS:

- file/folder picker import;
- drag/drop import;
- clipboard import;
- screenshot import;
- local journal draft;
- voice note;
- camera/scanner capture;
- document/PDF import;
- selected photo/video import.

Every capture starts as a local encrypted pending draft. It becomes Memorr owner
truth only after the user chooses:

- profile/private or family/shared scope;
- privacy class;
- retention class;
- source refs;
- whether Veliai may summarize it;
- whether it should create a Guardian task or remain a memory.

Large payload bytes use Central_IO/FASTIO leases. Memorr owns durable refs,
source refs, previews, tombstones, delete/export/revoke state, and context-pack
refs.

## Presence

Windows presence is useful but must be more conservative than phone presence.

Presence package fields:

- device install ID;
- Windows machine name hash or device alias;
- signed-in Windows user profile binding;
- locked Amber Life profile;
- app version and schema version;
- endpoint class: LAN, internet, offline;
- network class and AMBER/LAN evidence where available;
- battery/charging only for laptops/tablets where available;
- storage pressure;
- notification permission/state;
- startup/background state;
- last successful Bus contract;
- crash/error summary;
- optional coarse location only if explicitly enabled.

Guardian presence rules:

- A Windows desktop on AMBER/LAN is device-home evidence, not automatically
  person-home evidence unless the device is registered as personal and currently
  active for the locked profile.
- A laptop running Amber Life under a locked profile can contribute stronger
  home evidence when connected on AMBER/LAN and recently active.
- Shared PCs publish lower-confidence presence unless a Windows Hello/app unlock
  proves the current person.
- Guardian still owns stale/away policy and action gates.

## Notifications

Notifications are Bus-backed descriptors rendered as native Windows toasts.

Rules:

- Toast payloads contain privacy-safe descriptors and correlation IDs, not raw
  private email, photo, journal, or Guardian payloads.
- Notification actions route back through Amber Bus and owner gates.
- Sensitive Guardian actions require Windows Hello/device auth before submit.
- The app records delivered, dismissed, actioned, expired, denied, and failed
  notification evidence through Amber Bus/Logger.

## Life Evidence

Windows uses the same Life Evidence model as iOS. Every Veliai answer, task,
email summary, Guardian state, Life Capture draft, notification, optional tab
row, and transport state can open a native evidence pane.

Desktop evidence pane fields:

- owner system;
- source ref;
- profile/shared/operator scope;
- freshness and stale-after window;
- confidence and confidence source;
- privacy class, retention class, and redaction state;
- Bus schema/frame/correlation ID;
- Logger/Memorr/Guardian/Concierge/Veliai refs;
- action state: advice-only, pending, queued, applied, failed, rollback,
  no-action;
- missing/degraded state.

Evidence is structured UI, not a JSON dump.

## Suggested C# Project Layout

| Project/Namespace | Purpose |
| --- | --- |
| `AmberLife.Windows` | WinUI app entry, shell, activation, windowing, tray. |
| `AmberLife.DesignSystem` | Shared controls, status chips, evidence rows, semantic colors. |
| `AmberLife.BusSchemas` | Generated C# codecs/models for Amber Life Bus schemas. |
| `AmberLife.NativeTransport` | DEMand framed transport, session mux, backpressure, reconnect. |
| `AmberLife.Enrollment` | Bootstrap, profile lock, device key, challenge/response, revocation. |
| `AmberLife.Features.Veliai` | Native Veliai tab and streaming response frames. |
| `AmberLife.Features.Todo` | Guardian task views and mutations when approved. |
| `AmberLife.Features.Email` | Email digest and action candidates. |
| `AmberLife.Features.Guardian` | Readiness, alerts, presence, approvals, runbooks. |
| `AmberLife.Features.Capture` | File/clipboard/share/journal/camera/scanner import drafts. |
| `AmberLife.Features.Settings` | Profile, transport, permissions, Tab Library, privacy. |
| `AmberLife.Features.Evidence` | Life Evidence panes and correlation drilldown. |
| `AmberLife.Platform.Windows` | Windows Hello, notifications, tray, file picker, startup/background. |
| `AmberLife.TestSupport` | Mock Bus, transport simulator, owner fixtures, UI snapshots. |

Initial source location:

- Solution: `clients/windows/AmberLife.Windows.sln`.
- App project: `clients/windows/AmberLife.Windows/AmberLife.Windows.csproj`.
- Full MSI WiX definition:
  `clients/windows/packaging/msi/AmberLife.wxs`.
- GitHub build workflow: `.github/workflows/amber-life-windows.yml`.
- The MSI installs the full app payload under `%LOCALAPPDATA%\AmberLife\App`;
  profile/settings/update staging stay under `%LOCALAPPDATA%\AmberLife`, and
  there is no separate bootstrapper executable.
- Post-install updates use Amber Life's in-app update service over DEMand-Desktop
  on `17443`. The app requests update intent, downloads package chunks through
  encrypted DEMand frames, verifies package SHA256, stages the app package,
  writes a short apply script, exits, replaces the app folder, and restarts the
  app.

## Release Slices

### W1 - Native Read-Only Desktop

- WinUI shell with Veliai, To-Do, Email, Guardian, Life Capture, and Settings.
- First-run profile lock.
- Native Amber Bus session using LAN/internet endpoint selection.
- Read-only Veliai descriptors, Guardian readiness, to-dos, email summaries, and
  evidence.
- Windows toast notification registration/state model.
- Local encrypted display cache.
- File picker and local Life Capture drafts only.
- Life Evidence pane across all default surfaces.

### W2 - Safe Capture And Notifications

- Drag/drop, clipboard, screenshot, document, and selected folder imports.
- Confirmed Life Capture drafts become Memorr import candidates.
- Notification action ack/defer/open-evidence.
- Tab Library can enable native Crypto and Console tabs when descriptors and
  modules are present.
- Cross-profile rejection proof.

### W3 - Safe Mutations

- Add/complete Guardian to-dos.
- Submit native Veliai turns and stream frames.
- Convert email action candidates into Guardian task proposals.
- Windows Hello gated sensitive reads and Guardian approvals.

### W4 - Rich Desktop Memory

- Selected folder/photo sync, still off by default.
- Memorr day/moment desktop views.
- Document/PDF preview refs.
- Scanner/camera capture to Memorr.
- Offline outbox with owner-proof reconciliation.

## Validation Plan

Design validation:

- Confirm Windows Amber Life is separate from Amber Console Windows.
- Confirm every operational read/write uses Amber Bus contracts.
- Confirm native framed transport is the production path, not WebView/REST.
- Confirm Windows-specific integrations are consented and profile-scoped.
- Confirm shared-PC presence is lower confidence unless app/Windows auth proves
  the person.
- Confirm Email Summary never stores mailbox credentials.
- Confirm Life Capture never becomes durable owner truth inside the app.

Implementation validation once code exists:

- Unit tests for generated C# schema codecs.
- DEMand desktop transport simulator for enrollment, reconnect, resume,
  revocation, replay rejection, schema mismatch, and endpoint failure.
- UI snapshot tests for wide, laptop, compact, high contrast, degraded, offline,
  revoked, denied, and missing-contract states.
- Windows Hello and sensitive-action tests.
- Toast notification action and privacy-redaction tests.
- File/clipboard/drag-drop import tests for pending, confirmed, failed,
  duplicate, revoked, tombstone, and cross-profile-denied states.
- Static/runtime checks proving no WebView, REST polling, direct owner calls, or
  mailbox credentials in production app features.

## Go / No-Go

Go when:

- The app is native WinUI/.NET and separate from Console Windows.
- The app builds through the GitHub Windows workflow and emits a full MSI
  installer for the app payload; no bootstrapper/launcher MSI is used.
- The installed app can check and stage its own updates in-app from the Amber
  Life release manifest with SHA256 verification.
- First run requires Iain/Sarah/Finn/Josh profile lock.
- Amber Bus transport, schema, profile, and evidence contracts match the E31/E36
  Amber Life contract.
- Every default tab has ready/degraded/offline/missing-contract states.
- Life Evidence opens from every default surface.
- Windows notifications and Life Capture are privacy-safe and owner-backed.
- Shared-PC and presence behavior cannot falsely mark a person home with high
  confidence.

No-go when:

- The app embeds Console web, Veliai web, or any hosted owner UI.
- The app requires a bootstrapper/launcher to install or update after the full
  MSI requirement is in force.
- Any production feature needs direct owner-service HTTP/REST calls.
- The Windows app stores durable photo, journal, file, email, or task truth.
- Shared device use can expose another profile's private records.
- Evidence is absent or only raw JSON.
