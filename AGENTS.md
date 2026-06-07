# Amber Console Agent Rules

Amber Console is the Epic 26 observability and operator UI surface.

- Amber Console observes and requests actions through owner contracts; it does not own domain truth.
- Backend runtime is native-first C++.
- Browser UI is React/Vite/TypeScript served as built static assets by the native backend; static mock data must not count as delivery.
- Keep files split by domain. Do not grow one large mixed-purpose server or UI file.
- Every visible panel should have a click-through detail path backed by owner evidence.
- Owner services keep canonical state: Amber Bus, Guardian, Memorr, Veliai/Gemma, Logger, Actorr, and programme-control data.

## ACSA Console Surface Mandate

- ACSA now requires every Amber functionality designed or developed to have a live graphical surface in both the Amber Console Windows app and the Console web app on `console.amber.com`.
- Console surfaces must follow the ACSA App and Web guidelines: graphical first, live owner-backed evidence, click-through everywhere, no JSON dumps or static mock panels as delivery proof.
- Console UI work must follow ACSA-HIG-001: C2/Actorr-inspired live graphics, React/TypeScript/Vite web tooling, C++/WinUI 3/WebView2 Windows shell, signed self-update, Amber Bus/DEMand connectivity, semantic color, AI-centric assistance, lifecycle badges, and Windows/web parity.
- UI data is Amber Bus only. The Console web app, Windows app, and Console backend must not use direct local/private owner calls as production data sources, even when hosted on the same machine. Windows and web stay in lock-step on contracts, schemas, events, lifecycle states, terminology, and evidence; no exceptions.
