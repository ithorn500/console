const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const target = process.argv[3] || 'amber_bus_apps';

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return json;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const sourceResponse = await fetch(`${baseUrl}/api/console/source?target=${encodeURIComponent(target)}`, { cache: 'no-store' });
const source = await sourceResponse.json();

if (!sourceResponse.ok) throw new Error(`source detail -> HTTP ${sourceResponse.status}`);
if (source.schema !== 'amber.console.source_detail.v1') throw new Error(`source schema mismatch: ${source.schema}`);
if (source.data_plane !== 'amber_bus_only') throw new Error(`source data-plane mismatch: ${source.data_plane}`);
if (!source.logger_call_evidence) throw new Error('missing logger_call_evidence block');

const evidence = source.logger_call_evidence;
if (evidence.schema !== 'amber.console.source_fetch_logger_evidence.v1') {
  throw new Error(`logger evidence schema mismatch: ${evidence.schema}`);
}
if (evidence.data_plane !== 'amber_bus_only') throw new Error(`logger data-plane mismatch: ${evidence.data_plane}`);
if (!evidence.request_id || !evidence.correlation_id) throw new Error('missing request/correlation id');
if (!evidence.ingest_ok || evidence.ingest_http_status !== 200 || Number(evidence.ingest_stored_count || 0) < 1) {
  throw new Error(`logger ingest failed: ${JSON.stringify(evidence)}`);
}
if (evidence.proof_http_status !== 200) {
  throw new Error(`logger proof query failed: ${JSON.stringify(evidence)}`);
}

let proof = null;
for (let attempt = 0; attempt < 5; attempt += 1) {
  proof = await postJson(
    'http://logger.amber.com:8055/api/v1/evidence/query',
    { owner_app: 'amber-console', include_events: true, limit: 25, minutes: 10 }
  );
  if (proof.gate_status === 'evidence_present' && JSON.stringify(proof).includes(evidence.request_id)) break;
  await sleep(500);
}
const proofText = JSON.stringify(proof);
if (proof.gate_status !== 'evidence_present' || !proofText.includes(evidence.request_id)) {
  throw new Error(`Logger read-back did not include request ${evidence.request_id}: ${proofText.slice(0, 800)}`);
}

console.log(`source logger call evidence regression: ok target=${target} request_id=${evidence.request_id} events=${proof.event_count}`);
