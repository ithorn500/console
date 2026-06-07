#!/usr/bin/env bash
set -euo pipefail

base="${1:-http://127.0.0.1:8095}"

curl -fsS "$base/health" | grep -q '"ok":true'
curl -fsS "$base/api/console/overview" | grep -q '"schema":"amber.console.overview.v1"'
curl -fsS "$base/api/console/evidence-chain" | grep -q '"schema":"amber.console.evidence_chain.v1"'
curl -fsS "$base/api/console/mail-flow" | grep -q '"schema":"amber.console.mail_flow.v1"'
curl -fsS "$base/api/console/source?target=concierge_email" | grep -q '"id":"concierge_email"'
curl -fsS "$base/api/console/source?target=concierge_lifecycle_drill" | grep -q '"id":"concierge_lifecycle_drill"'
curl -fsS "$base/api/console/source?target=mail_quarantine_review" | grep -q '"id":"mail_quarantine_review"'
curl -fsS "$base/api/console/source?target=exchange_pim_reader" | grep -q '"id":"exchange_pim_reader"'
curl -fsS "$base/api/console/source?target=memorr_email_timeline" | grep -q '"id":"memorr_email_timeline"'
curl -fsS "$base/api/console/source?target=memorr_exchange_pim_context" | grep -q '"id":"memorr_exchange_pim_context"'
curl -fsS "$base/architecture/" | grep -q 'Amber Architecture Docs'
curl -fsS "$base/architecture/architecture-site.css" | grep -q 'app-shell'
curl -fsS "$base/architecture/architecture-auto-index.json" | grep -q 'gateway-monolith-current-2026-06-05.png'
curl -fsS "$base/architecture/generated/2026-06-05/veliai-system-map-recognition-paths-2026-06-05.png" >/dev/null

echo "amber-console smoke: ok"
