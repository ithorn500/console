# Amber Life Diary / Journal Surface

Status: product and architecture contract
Date: 2026-06-04
Scope: native Diary/Journal surface inside Amber Life, for iOS first, with Windows/macOS parity later where platform APIs exist.

## Source References

Primary platform references:

- Apple Journaling Suggestions framework: https://developer.apple.com/documentation/JournalingSuggestions
- Apple LocalAuthentication framework: https://developer.apple.com/documentation/localauthentication/
- Apple SwiftData framework: https://developer.apple.com/documentation/swiftdata

Amber references:

- [`amber-life-ios-app.md`](amber-life-ios-app.md)
- [`amber-life-r1-implementation-contract.md`](amber-life-r1-implementation-contract.md)
- [`gemma-guardian-memorr-memory-boundary.md`](gemma-guardian-memorr-memory-boundary.md)

## Product Boundary

Amber Life Diary/Journal is part of the Amber Life app. It is not a separate
product and must not scrape or write Apple's Journal app store. It can use
Apple's official Journaling Suggestions picker when the user explicitly selects
a suggestion.

Owner boundary:

- The app owns local draft UX and encrypted local display state.
- Memorr owns durable journal memory, media refs, deletion/export/tombstone
  state, and long-term retrieval.
- Amber Bus is the only sync route between the app and Memorr.
- Veliai may summarize or reflect only after user consent and Bus admission.

No direct Memorr file paths, Memorr DB reads, owner HTTP calls, mailbox
credentials, WebView, or JSON media upload path is allowed.

## Home Timeline

Default landing state is a reverse-chronological timeline.

Entry cards:

- Text-only cards show date, day of week, bookmark state, and up to five preview
  lines.
- Photo/video cards show a hero image or a 2x2 grid of up to four visual assets,
  then the text preview.
- Location cards show a native MapKit/Apple Maps snapshot.
- Audio cards show waveform preview, duration, and inline play/pause.
- Mixed entries choose the strongest visual lead, then show compact chips for
  text, media, place, audio, and suggestion source.

Timeline controls:

- Swipe left or right reveals Delete and Bookmark.
- A centered bottom floating plus button opens the new-entry sheet.
- Top pill filters: All Entries, Bookmarked, Reflections, Photos, Video, Places,
  Audio.
- Empty states are visual and actionable, not prose-heavy status pages.

## Composer

Composer is a blank-canvas writing surface, not a form.

Required behavior:

- Expanding text editor with no boxed form chrome.
- Entry date defaults to now and can be manually changed for backlogs or future
  notes.
- Bookmark toggle is visible at the top.
- Draft autosaves locally before any network sync.
- Privacy, retention, and profile namespace are visible before Memorr sync.

Attachment toolbar:

- Photos: native PhotosUI/PhotoKit picker with multi-select image/video support.
- Camera: in-app camera capture.
- Audio: built-in recorder with live waveform and embedded voice memo.
- Location: MapKit place picker for place/business tags.
- Memorr sync: explicit button/state to sync the journal entry and selected
  attachments to Memorr over Amber Bus.

Large media bytes use Central_IO or the approved native Bus lease path. They do
not move through JSON bodies.

## Journaling Suggestions

When the user taps the plus button, Amber Life Journal first presents a native
new-entry sheet:

- Recent tab: uses Apple's JournalingSuggestions picker to let the user choose
  recent activity clusters.
- Reflections tab: app-generated reflection prompts.
- Blank tab/action: starts an empty composer immediately.

Suggestion rules:

- Use Apple's official JournalingSuggestions API only.
- The user must tap/select the suggestion before Amber Life sees suggestion
  content.
- Parsed suggestion content becomes a local draft with source refs and privacy
  metadata.
- Photos, locations, audio, workout/listening/activity hints from a suggestion
  are embedded as draft attachments where the API provides them.
- The suggestion object itself is not treated as durable owner truth until the
  user saves/syncs to Memorr.

## Security And Privacy

App lock:

- Use LocalAuthentication for Face ID, Touch ID, or device passcode.
- Required at app open unless lock timeout policy says otherwise.
- Required again before sensitive raw content, export/delete, Guardian action,
  profile switch, or private Memorr sync.

Timeout settings:

- Immediately on close.
- After 1 minute idle.
- After 5 minutes idle.
- After 15 minutes idle.

App switcher privacy:

- Blur or replace the scene when inactive/backgrounded.
- The switcher preview must not show journal text, media, maps, waveform, or
  private evidence.

Profile/privacy:

- First-run Amber Life profile lock applies to Journal.
- Entries are private to `profile:<person>` unless explicitly marked
  family/shared.
- Cross-profile reads or sync are denied by default.

## Notifications

Journal habit settings:

- Select days of week.
- Select one or more reminder times.
- Notification copy is privacy-safe and does not include entry content.

Suggestion alerts:

- Optional toggle for "new suggestion available".
- Alerts open the Recent suggestions sheet, not raw suggestion data.
- Delivery, open, dismiss, and failure evidence is published to Amber Bus/Logger.

## Storage And Sync

Local persistence:

- Use SwiftData for the first implementation if it satisfies migration,
  predicate, encryption-at-rest wrapper, and test requirements.
- CoreData is the fallback if SwiftData blocks required migration/conflict
  behavior.
- Store journal text, metadata, attachment descriptors, local file refs, sync
  state, and evidence refs locally for instant offline access.
- Sensitive local state must be protected by platform storage/keychain policy
  and app lock.

Memorr sync:

- Sync is explicit per entry or through a user-approved background policy.
- Each entry produces a `memorr.journal` candidate through Amber Bus.
- Attachments produce Central_IO leases and Memorr source refs.
- Sync state is visible: local draft, queued, syncing, synced, failed,
  conflict, deleted, tombstoned, revoked.
- Dedupe uses stable local entry ID, content hash, media hashes, source
  suggestion refs, and Memorr owner refs.

Photo sync option:

- Amber Life must expose "Sync Photos To Memorr" as a first-class action.
- Apple Photos imports stay under the lab roots until production cutover:
  `/Data/Media/Lab/photo/iCloud Photos` and
  `/Vault/Media/Lab/photo/iCloud Photos`.
- Production root promotion requires a separate go/no-go and operator-visible
  evidence.

## Data Model

Minimum local model:

- `JournalEntry`: id, profile, title/preview, body, created_at, entry_date,
  updated_at, bookmarked, reflection_source, privacy_class, retention_class,
  sync_state, memorr_ref, evidence_ref.
- `JournalAttachment`: id, entry_id, kind, local_ref, media_hash, thumbnail_ref,
  duration, dimensions, location_ref, source_suggestion_ref, sync_state.
- `JournalLocation`: id, name, coordinate, address, map_snapshot_ref,
  privacy_precision.
- `JournalAudio`: id, local_ref, duration, waveform_ref, transcript_ref,
  sync_state.
- `JournalSuggestionSource`: id, provider, suggestion_id_hash, title,
  selected_at, source_types, privacy_class.

## Build Acceptance

R1 is not complete until:

- Timeline, filters, composer, suggestions sheet, attachment toolbar, app lock,
  switcher privacy, reminders, and Memorr sync state are implemented in native
  SwiftUI.
- JournalingSuggestions, PhotosUI/PhotoKit, Camera, AVAudioRecorder/AVAudioEngine,
  MapKit, LocalAuthentication, and notifications are integrated where available.
- All operational sync goes through Amber Bus.
- Memorr receives journal/photo candidates with source refs, privacy class,
  retention class, profile namespace, hashes, and evidence refs.
- Offline drafts work without Bus and never claim owner sync success while
  offline.
- Console/Logger can see live client state, sync state, failures, evidence, and
  owner refs.
