# Epic 26 Bus-Only Visual Slice

Date: 2026-06-01

## Evidence Pass

- `config/owner_endpoints.v1.json` contained direct Guardian, Gemma, Memorr, and
  programme-control URLs.
- `native/src/console_service.cpp` fetched those URLs directly through
  `http_get`.
- React panels consumed the Console backend only, but source IDs could still be
  backed by direct owner calls.
- Registered Amber Bus invoke contracts exist for Gateway Ops
  `aigateway.ops.ui.invoke`, Guardian C2 `guardian.c2.ui.invoke`, Actorr
  `actorr.c2.operator_snapshot`, Logger `logger.ops.dashboard_snapshot`, and a
  Memorr status route is present in the native runtime route catalog but is not
  yet live as a Bus invoke function.

## Design

- Keep the browser UI behind the native Console backend.
- Make the backend fetch every production source through Amber Bus GET or
  `/api/bus/invoke/<function-id>`.
- Preserve source IDs so Windows and web can share contracts.
- Surface unavailable Bus contracts as degraded evidence instead of falling back
  to private owner URLs.
- Add graphical Guardian/Actorr/Logger operator tiles and mount existing
  topology/evidence panels so click-through evidence is visible without raw JSON
  as the primary experience.
- Add the Guardian lawn boundary/vision panel using Bus-routed
  `guardian.c2.ui.invoke` calls for `lawn_outline_editor_get` and
  `sensor.lawn_poo_detection`, while deferring the huge full C2 snapshot to
  explicit detail click-through.

## Validation Plan

- Validate JSON config.
- Build React/Vite.
- Build native C++.
- Smoke the local Console service health, overview, evidence-chain, and source
  detail routes.
- Search Console config, native, and web source for direct owner data URLs.

## Validation Result

- JSON config parse: pass.
- React/Vite build: pass.
- Native C++ build: pass.
- API smoke: pass on `http://127.0.0.1:8095`.
- Browser smoke: pass, screenshot
  `/tmp/amber-console-epic26-lawn-smoke.png`.
- Guardian lawn outline detail: pass, 31 saved boundary points via Amber Bus.
- Gateway Ops state detail: pass via Amber Bus.
- Direct owner URL search in Console config/native/web/docs: pass.

During validation, Amber Bus native invoke wedged on requests that carried an
explicit `Connection: close` header. The Console HTTP client no longer sends
that header, and `amber-bus-native.service` was restarted on the owner host to
clear the wedged worker.
