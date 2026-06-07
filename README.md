# Amber Console

Amber Console is the Amber operator surface for web and Windows parity.

The production data plane is Amber Bus only. Console can serve assets, cache display state, and present owner-backed evidence, but it must not become the owner of domain truth or call sibling owner services directly for operational UI data.

## Layout

- `native/` - native C++ Console backend.
- `web/` - React/Vite/TypeScript web surface.
- `config/` - owner endpoint and display contract configuration.
- `deploy/` - service/deployment artifacts.
- `docs/` - Console runtime and delivery notes.
- `tests/` - regression and smoke checks.

## Build Smoke

```bash
cd web
npm ci
npm run build

cd ..
cmake -S . -B build-dev -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo
cmake --build build-dev
```

## Provenance

This repository was initialised from the source snapshot at `console.amber.com:/opt/console` after `dev.amber.com` became the Amber source/build host.
