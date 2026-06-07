import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-veliai-route-drift-guard.png';

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
    throw new Error(`${target} missing drift anchors: ${JSON.stringify({ hash: payload.decision_hash, route_id: payload.route_id, selected: selected.endpoint_id })}`);
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

const first = await readRound();
await new Promise(resolve => setTimeout(resolve, 1500));
const second = await readRound();
const rawPayloads = {};
for (const target of routeTargets) {
  rawPayloads[target] = await source(target);
}
const rejectedAlternatives = Object.values(rawPayloads).flatMap(payload => (payload.candidates || []).filter(candidate => candidate?.eligible === false));
const rejectedTotal = rejectedAlternatives.length;
const privacyRejections = rejectedAlternatives.filter(candidate => String(candidate.reason || candidate.health || '').includes('privacy')).length;
const mutationPaths = Object.values(rawPayloads).filter(payload => payload.mutates_workers !== false || payload.mutates_registry !== false).length;
const reasonFamilies = new Set(rejectedAlternatives.map(candidate => candidate.reason || candidate.health || 'unspecified'));

for (const target of routeTargets) {
  const a = first[target];
  const b = second[target];
  for (const key of ['decision_hash', 'route_id', 'selected_endpoint', 'selected_route_id', 'candidate_count', 'rejected_count', 'request_id']) {
    if (a[key] !== b[key]) {
      throw new Error(`${target} route drift on ${key}: ${a[key]} -> ${b[key]}`);
    }
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1550 } });
const failures = [];
const offHostRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Live Capability, Policy, Provider, and Heat-Relief Map' }).waitFor({ timeout: 30000 });
const panel = page.locator('.router-panel');
await panel.getByText('Route Drift Guard').waitFor({ timeout: 30000 });
await panel.getByText('Decision Failure Modes').waitFor({ timeout: 30000 });
await panel.getByText('stable hash anchors').waitFor({ timeout: 30000 });
await panel.getByText('owner-native compare open').first().waitFor({ timeout: 30000 });
await panel.getByText('long-run drift soak open').first().waitFor({ timeout: 30000 });
for (const text of ['privacy gate rejections', 'profile/capability rejections', 'external handoff rejections', 'mutation boundary', 'dry-run evidence only', 'no route execution']) {
  await panel.getByText(text).first().waitFor({ timeout: 15000 });
}
await page.waitForFunction(expected => {
  const ledger = document.querySelector('.route-failure-ledger');
  return ledger?.getAttribute('data-route-rejected-total') === String(expected.rejectedTotal) &&
    ledger?.getAttribute('data-route-mutation-paths') === String(expected.mutationPaths);
}, { rejectedTotal, mutationPaths }, { timeout: 30000 });
for (const row of Object.values(first)) {
  await panel.getByText(row.decision_hash).waitFor({ timeout: 30000 });
  await panel.getByText(row.selected_endpoint).first().waitFor({ timeout: 30000 });
}
await panel.screenshot({ path: screenshotPath });
const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  driftCards: element.querySelectorAll('.route-drift-card').length,
  failureCards: element.querySelectorAll('.route-failure-grid button').length,
  failureAttrs: {
    modes: Number(element.querySelector('.route-failure-ledger')?.getAttribute('data-route-failure-modes') || '0'),
    rejected: Number(element.querySelector('.route-failure-ledger')?.getAttribute('data-route-rejected-total') || '0'),
    privacy: Number(element.querySelector('.route-failure-ledger')?.getAttribute('data-route-privacy-rejections') || '0'),
    mutation: Number(element.querySelector('.route-failure-ledger')?.getAttribute('data-route-mutation-paths') || '0')
  },
  exactExecutableButtons: Array.from(element.querySelectorAll('button')).map(button => ({
    text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: button.disabled
  })).filter(button => /^(execute route|run route|apply route|fallback|retry|dispatch|execute|run|apply|save|start|stop|restart)$/i.test(button.text) && !button.disabled)
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.driftCards !== routeTargets.length) {
  throw new Error(`expected ${routeTargets.length} drift cards, saw ${proof.driftCards}`);
}
if (proof.failureCards !== 4) {
  throw new Error(`expected 4 failure mode cards, saw ${proof.failureCards}`);
}
if (proof.failureAttrs.rejected !== rejectedTotal || proof.failureAttrs.privacy !== privacyRejections || proof.failureAttrs.mutation !== mutationPaths || proof.failureAttrs.modes !== Math.min(3, reasonFamilies.size)) {
  throw new Error(`failure mode attrs mismatch: ${JSON.stringify({ proof: proof.failureAttrs, rejectedTotal, privacyRejections, mutationPaths, reasonFamilies: reasonFamilies.size })}`);
}
if (proof.exactExecutableButtons.length) {
  throw new Error(`Veliai decision panel exposed executable route controls: ${JSON.stringify(proof.exactExecutableButtons)}`);
}
for (const expected of ['dry-run sources', 'decision hashes', 'mutation paths', 'mutation-free']) {
  if (!proof.text.includes(expected)) throw new Error(`panel missing text: ${expected}`);
}
for (const expected of ['Decision Failure Modes', 'privacy gate rejections', 'profile/capability rejections', 'external handoff rejections', 'mutation boundary', 'dry-run evidence only', 'owner-native compare open']) {
  if (!proof.text.includes(expected)) throw new Error(`failure ledger missing text: ${expected}`);
}

console.log(`veliai route drift regression: ok routes=${routeTargets.length} rejected=${rejectedTotal} privacy=${privacyRejections} mutation=${mutationPaths} failure_cards=${proof.failureCards} hashes=${Object.values(first).map(row => row.decision_hash).join(',')} screenshot=${screenshotPath}`);
