import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-veliai-memory-boundary.png';

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
  if (json?.schema !== 'amber.console.source_detail.v1') throw new Error(`${target} schema mismatch: ${json?.schema}`);
  if (json.data_plane !== 'amber_bus_only') throw new Error(`${target} data plane drift: ${json.data_plane}`);
  if (!json.ok || json.http_status !== 200) throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  return json.payload || {};
}

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const route = await source('veliai_route_plan_memory');
const recall = await source('memorr_formulated_memory');
const timeline = await source('memorr_email_timeline');

if (route.schema !== 'aigateway.veliai_manager.route_decision.v1') throw new Error(`route schema mismatch: ${route.schema}`);
if (route.execution_mode !== 'dry_run' || route.mutates_workers !== false || route.mutates_registry !== false) {
  throw new Error(`route is not dry-run/mutation-free: ${JSON.stringify(route).slice(0, 600)}`);
}
if (route.request?.capability !== 'memory.formulate' || route.request?.allow_external !== false || route.request?.privacy_local_required !== true) {
  throw new Error(`memory route request is not local-only: ${JSON.stringify(route.request)}`);
}
if (route.selected?.local !== true || !route.selected?.endpoint_id) {
  throw new Error(`selected memory route is not local: ${JSON.stringify(route.selected).slice(0, 500)}`);
}
if (recall.schema !== 'memorr.formulated_memory.recall.v1' || Number(recall.candidate_count || 0) < 1) {
  throw new Error(`Memorr recall proof invalid: ${JSON.stringify(recall).slice(0, 500)}`);
}
if (recall.path_api !== false) {
  throw new Error('Memorr recall unexpectedly reports path_api true');
}
if (timeline.schema !== 'memorr.email_timeline_retrieval.v1' || timeline.privacy?.raw_payload_available !== false || timeline.privacy?.raw_mime_visible !== false) {
  throw new Error(`timeline privacy proof invalid: ${JSON.stringify(timeline).slice(0, 500)}`);
}

const rawVisible = Boolean(
  timeline.privacy?.raw_payload_available ||
  timeline.privacy?.raw_mime_visible ||
  (recall.candidates || []).some(candidate => candidate.raw_payload_available_to_gemma)
);
if (rawVisible) throw new Error('raw memory payload unexpectedly visible to Gateway/Gemma');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1900 } });
const failures = [];
const offHostRequests = [];
const sourceRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.startsWith(baseUrl)) {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/console/source') {
      const target = parsed.searchParams.get('target') || '';
      if (target === 'veliai_route_plan_memory' || target === 'memorr_formulated_memory' || target === 'memorr_email_timeline') {
        sourceRequests.push({ target, loggerEvidence: parsed.searchParams.get('logger_evidence') });
      }
    }
    return;
  }
  if (url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
const panel = page.locator('.router-panel');
await panel.getByRole('heading', { name: 'Live Capability, Policy, Provider, and Heat-Relief Map' }).waitFor({ timeout: 30000 });
const ledger = panel.locator('.memory-boundary-ledger');
await ledger.getByRole('heading', { name: 'Gateway Memory Boundary Ledger' }).waitFor({ timeout: 30000 });
await page.waitForFunction(
  ({ candidateCount }) => {
    const node = document.querySelector('.memory-boundary-ledger');
    return node?.getAttribute('data-memory-boundary-ready') === 'true' &&
      node?.getAttribute('data-memory-boundary-local') === 'true' &&
      node?.getAttribute('data-memory-boundary-raw-visible') === 'false' &&
      node?.getAttribute('data-memory-boundary-candidates') === String(candidateCount);
  },
  { candidateCount: recall.candidate_count },
  { timeout: 30000 }
);

for (const label of ['Veliai dry-run route', 'Gateway mutation boundary', 'Memorr owner truth', 'Privacy and read lease']) {
  await ledger.getByRole('button', { name: new RegExp(label) }).waitFor({ timeout: 15000 });
}
await ledger.getByText(route.selected.endpoint_id).waitFor({ timeout: 15000 });
await ledger.getByText('local-only privacy gate').waitFor({ timeout: 15000 });
await ledger.getByText('workers and registry untouched').waitFor({ timeout: 15000 });
await ledger.getByText(`${recall.candidate_count} formulated candidates`).waitFor({ timeout: 15000 });
await ledger.getByText('raw payload hidden').waitFor({ timeout: 15000 });
await ledger.getByText(`${timeline.summary.read_lease_count} read leases`).waitFor({ timeout: 15000 });
await ledger.getByText('Memorr owns storage truth').waitFor({ timeout: 15000 });
await ledger.getByText('Gateway uses refs only').waitFor({ timeout: 15000 });
await ledger.getByText('owner-native compare open').waitFor({ timeout: 15000 });
await ledger.screenshot({ path: screenshotPath });
const backgroundSourceRequests = sourceRequests.slice();

await ledger.getByRole('button', { name: /Memorr owner truth/ }).click();
await page.locator('.drawer.open').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('memorr_formulated_memory').waitFor({ timeout: 15000 });

const proof = await page.evaluate(() => ({
  cardCount: document.querySelectorAll('.memory-boundary-ledger .memory-boundary-card').length,
  enabledExecutableControls: Array.from(document.querySelectorAll('.router-panel button'))
    .map(button => ({ text: button.textContent?.trim() || '', disabled: button.disabled }))
    .filter(button => /^(promote|retire|rollback|apply|save|dispatch|execute|run|route|mutate|compare)$/i.test(button.text) && !button.disabled)
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.cardCount !== 4) {
  throw new Error(`expected 4 boundary cards, rendered ${proof.cardCount}`);
}
if (proof.enabledExecutableControls.length) {
  throw new Error(`unexpected executable memory/route controls: ${JSON.stringify(proof.enabledExecutableControls)}`);
}
if (!backgroundSourceRequests.length || backgroundSourceRequests.some(request => request.loggerEvidence !== '0')) {
  throw new Error(`background memory-boundary reads did not stay on logger_evidence=0: ${JSON.stringify(backgroundSourceRequests)}`);
}

console.log(`veliai memory boundary regression: ok selected=${route.selected.endpoint_id} dry_run=${route.execution_mode} candidates=${recall.candidate_count} read_leases=${timeline.summary.read_lease_count} raw_visible=${rawVisible} screenshot=${screenshotPath}`);
