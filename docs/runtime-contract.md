# Amber Console Runtime Contract

Amber Console is an observability UI and operator surface.

- Service host: `console.amber.com`
- Source/runtime path: `/opt/console`
- Service unit: `amber-console.service`
- HTTP port: `8095`
- Frontend source: `/opt/console/web/src`
- Frontend build output served by native backend: `/opt/console/web/dist`
- Health: `/health`
- Overview: `/api/console/overview`
- Evidence chain: `/api/console/evidence-chain`
- Owner detail: `/api/console/source?target=<endpoint-id>`

The console renders live status, evidence chains, and click-through detail from
Amber Bus UI contracts. Owner services remain authoritative.

The backend is native C++ and treats Amber Bus as the only production UI data
plane. Entries in `config/owner_endpoints.v1.json` must use Bus-owned GET routes
or `/api/bus/invoke/<function-id>`; Console web and Windows clients must stay in
lock-step on those source IDs, schemas, lifecycle labels, and evidence terms.
Direct sibling service calls such as Guardian, Gemma, Actorr, Logger, or Memorr
private HTTP routes are not production Console data sources, even when the UI is
hosted on the same machine.

The browser app is React/Vite/TypeScript. Build it with:

```sh
cd /opt/console/web
npm install
npm run build
```

The native service serves the built static assets; React does not own domain
truth and does not call owner services directly.
