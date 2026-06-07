import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-veliai-route-soak-ledger.png';
const soakMs = Number(process.argv[4] || 65000);
const intervalMs = Number(process.argv[5] || 15000);

const routeTargets = [
  'veliai_route_plan_memory',
  'veliai_route_plan_summary',
  'veliai_route_plan_code',
  'veliai_route_plan_long_context'
];

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${String(err)}`);
  }
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return json;
}

async function source(target) {
  const json = await getJson(`/api/console/source?target=${encodeURIComponent(target)}&logger_evidence=0`);
  if (json?.schema !== 'amber.console.source_detail.v1') {
    throw new Error(`${target} source schema mismatch: ${json?.schema}`);
  }
  if (json.data_plane !== 'amber_bus_only') {
    throw new Error(`${target} missing Amber Bus-only marker`);
  }
  if (!json.ok || json.http_status !== 200) {
    throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json.payload || {};
}

function summarize(target, payload) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const selected = payload.selected || {};
  const rejectedCount = candidates.filter(candidate => candidate?.eligible === false).length;
  if (payload.schema !== 'aigateway.veliai_manager.route_decision.v1') {
    throw new Error(`${target} route schema mismatch: ${payload.schema}`);
  }
  if (payload.execution_mode !== 'dry_run') {
    throw new Error(`${target} execution mode drifted: ${payload.execution_mode}`);
  }
  if (payload.mutates_workers !== false || payload.mutates_registry !== false) {
    throw new Error(`${target} mutation guard drifted: workers=${payload.mutates_workers} registry=${payload.mutates_registry}`);
  }
  if (!payload.decision_hash || !payload.route_id || !selected.endpoint_id) {
    throw new Error(`${target} missing route anchors`);
  }
  if (candidates.length < 4 || rejectedCount < 1) {
    throw new Error(`${target} insufficient candidate/rejected evidence: candidates=${candidates.length} rejected=${rejectedCount}`);
  }
  return {
    target,
    decision_hash: payload.decision_hash,
    route_id: payload.route_id,
    selected_endpoint: selected.endpoint_id,
    selected_route_id: selected.route_id || '',
    candidate_count: candidates.length,
    rejected_count: rejectedCount,
    request_id: payload.request?.request_id || ''
  };
}

async function readRound() {
  const rows = {};
  for (const target of routeTargets) {
    rows[target] = summarize(target, await source(target));
  }
  return rows;
}

function compareRounds(baseline, current, label) {
  for (const target of routeTargets) {
    const a = baseline[target];
    const b = current[target];
    for (const key of ['decision_hash', 'route_id', 'selected_endpoint', 'selected_route_id', 'candidate_count', 'rejected_count', 'request_id']) {
      if (a[key] !== b[key]) {
        throw new Error(`${target} route soak drift on ${key} during ${label}: ${a[key]} -> ${b[key]}`);
      }
    }
  }
}

const rounds = [];
const startedAt = Date.now();
while (Date.now() - startedAt <= soakMs || rounds.length < 2) {
  const round = await readRound();
  if (rounds.length) compareRounds(rounds[0], round, `round ${rounds.length + 1}`);
  rounds.push(round);
  const remaining = soakMs - (Date.now() - startedAt);
  if (remaining <= 0 && rounds.length >= 2) break;
  await new Promise(resolve => setTimeout(resolve, Math.max(1000, Math.min(intervalMs, remaining))));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1550 } });
const failures = [];
const offHostRequests = [];
const sourceRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/console/source?') && routeTargets.some(target => url.includes(`target=${encodeURIComponent(target)}`))) {
    sourceRequests.push(url);
  }
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Live Capability, Policy, Provider, and Heat-Relief Map' }).waitFor({ timeout: 30000 });
const ledger = page.locator('.route-soak-ledger');
await ledger.getByRole('heading', { name: 'Bounded Drift Soak Ledger' }).waitFor({ timeout: 30000 });
await page.waitForFunction(() => {
  const element = document.querySelector('.route-soak-ledger');
  return Number(element?.getAttribute('data-route-soak-samples') || 0) >= 2 &&
    Number(element?.getAttribute('data-route-soak-drift-events') || 999) === 0 &&
    Number(element?.getAttribute('data-route-soak-mutation-events') || 999) === 0;
}, null, { timeout: 70000 });
await ledger.screenshot({ path: screenshotPath });

const proof = await ledger.evaluate(element => ({
  text: element.textContent || '',
  samples: Number(element.getAttribute('data-route-soak-samples') || 0),
  driftEvents: Number(element.getAttribute('data-route-soak-drift-events') || 0),
  mutationEvents: Number(element.getAttribute('data-route-soak-mutation-events') || 0),
  windowMs: Number(element.getAttribute('data-route-soak-window-ms') || 0),
  cards: element.querySelectorAll('.route-soak-card').length,
  enabledExecutable: Array.from(document.querySelectorAll('button')).map(button => ({
    text: (button.textContent || '').trim(),
    disabled: button.disabled
  })).filter(button => /^(promote|retire|rollback|apply|save|dispatch|execute|run|route|mutate|compare)$/i.test(button.text) && !button.disabled)
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (sourceRequests.length < routeTargets.length) {
  throw new Error(`too few background route source requests: ${sourceRequests.length}`);
}
if (sourceRequests.some(url => !url.includes('logger_evidence=0'))) {
  throw new Error(`route source background request missing logger_evidence=0: ${sourceRequests.find(url => !url.includes('logger_evidence=0'))}`);
}
if (proof.cards !== 4) {
  throw new Error(`expected 4 route soak cards, saw ${proof.cards}`);
}
if (proof.samples < 2 || proof.driftEvents !== 0 || proof.mutationEvents !== 0 || proof.windowMs < 25000) {
  throw new Error(`route soak ledger not stable: ${JSON.stringify(proof)}`);
}
if (proof.enabledExecutable.length) {
  throw new Error(`unexpected executable controls: ${proof.enabledExecutable.map(button => button.text).join(', ')}`);
}
for (const expected of ['sample window', 'decision drift', 'mutation during soak', 'closure gate', 'stable bounded window', 'long-run soak still open', 'L9 remains NO_GO']) {
  if (!proof.text.includes(expected)) throw new Error(`route soak ledger missing text: ${expected}`);
}

const hashes = Object.values(rounds[0]).map(row => row.decision_hash).join(',');
console.log(`veliai route soak ledger regression: ok rounds=${rounds.length} samples=${proof.samples} drift=${proof.driftEvents} mutation=${proof.mutationEvents} window_ms=${proof.windowMs} hashes=${hashes} screenshot=${screenshotPath}`);
