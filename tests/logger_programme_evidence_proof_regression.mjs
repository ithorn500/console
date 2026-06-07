import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-logger-programme-evidence-proof.png';

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

const source = await getJson('/api/console/source?target=logger_evidence_proof&logger_evidence=0');
if (source.schema !== 'amber.console.source_detail.v1') {
  throw new Error(`logger evidence source schema mismatch: ${source.schema}`);
}
if (source.data_plane !== 'amber_bus_only') {
  throw new Error(`logger evidence source data plane mismatch: ${source.data_plane}`);
}
if (!source.ok || source.http_status !== 200) {
  throw new Error(`logger_evidence_proof not live: ${JSON.stringify(source).slice(0, 600)}`);
}

const payload = source.payload || {};
const duplicateCandidates = Array.isArray(payload.duplicate_candidates) ? payload.duplicate_candidates : [];
const incidentTimelines = Array.isArray(payload.incident_timelines) ? payload.incident_timelines : [];
const routeChain = Array.isArray(payload.route_chain) ? payload.route_chain : [];

if (payload.gate_status !== 'evidence_present') {
  throw new Error(`logger evidence proof gate not present: ${payload.gate_status}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1650 } });
const failures = [];
const offHostRequests = [];
const loggerProofRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.startsWith(baseUrl)) {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/console/source' && parsed.searchParams.get('target') === 'logger_evidence_proof') {
      loggerProofRequests.push(url);
    }
    return;
  }
  if (url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Logger Evidence Proof Ledger' }).waitFor({ timeout: 30000 });
const panel = page.locator('.logger-programme-proof');
await page.waitForFunction(() => {
  const element = document.querySelector('.logger-programme-proof');
  return element?.getAttribute('data-logger-programme-proof-gate') === 'evidence_present';
}, null, { timeout: 45000 });
await panel.getByText('proof events').waitFor({ timeout: 15000 });
await panel.getByText('duplicate events').waitFor({ timeout: 15000 });
await panel.getByText('incident timelines').waitFor({ timeout: 15000 });
await panel.getByText('route chain').first().waitFor({ timeout: 15000 });
await panel.getByText('missing correlations').waitFor({ timeout: 15000 });
await panel.getByText('Duplicate Candidates').waitFor({ timeout: 15000 });
await panel.getByText('Retention Boundary').waitFor({ timeout: 15000 });
await panel.getByText('Logger owns retention and proof query').waitFor({ timeout: 15000 });
await panel.getByText('targeted ids still missing').waitFor({ timeout: 15000 });
if (duplicateCandidates.length) {
  const firstKey = duplicateCandidates[0].dedupe_key || duplicateCandidates[0].key;
  await panel.getByText(String(firstKey).slice(0, 32)).first().waitFor({ timeout: 15000 });
}

const proof = await panel.evaluate(element => ({
  gate: element.getAttribute('data-logger-programme-proof-gate'),
  duplicates: Number(element.getAttribute('data-logger-programme-proof-duplicates') || '0'),
  timelines: Number(element.getAttribute('data-logger-programme-proof-timelines') || '0'),
  cards: element.querySelectorAll('.logger-programme-grid button').length,
  text: element.textContent || '',
  enabledDangerButtons: Array.from(element.querySelectorAll('button'))
    .map(button => ({ text: button.textContent?.trim() || '', disabled: button.disabled }))
    .filter(button => /^(promote|retire|rollback|apply|save|dispatch|execute|run|silence)$/i.test(button.text) && !button.disabled)
}));
await panel.screenshot({ path: screenshotPath });

const backgroundProofRequests = [...loggerProofRequests];
if (backgroundProofRequests.some(url => new URL(url).searchParams.get('logger_evidence') !== '0')) {
  throw new Error(`logger proof background source requests missing logger_evidence=0: ${backgroundProofRequests.join(', ')}`);
}
loggerProofRequests.length = 0;

await panel.getByRole('button').first().click();
await page.locator('.drawer.open').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('Owner Detail').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('logger_evidence_proof').waitFor({ timeout: 15000 });
await browser.close();

if (failures.length) throw new Error(failures.join('\n'));
if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (proof.gate !== payload.gate_status) {
  throw new Error(`proof gate mismatch: source=${payload.gate_status} rendered=${proof.gate}`);
}
if (proof.duplicates !== Number(payload.duplicate_event_count || 0)) {
  throw new Error(`duplicate event mismatch: source=${payload.duplicate_event_count || 0} rendered=${proof.duplicates}`);
}
if (proof.timelines !== incidentTimelines.length) {
  throw new Error(`incident timeline mismatch: source=${incidentTimelines.length} rendered=${proof.timelines}`);
}
if (proof.cards !== 5) {
  throw new Error(`expected 5 programme proof cards, saw ${proof.cards}`);
}
for (const text of ['Amber Bus contracts only', 'evidence_present', 'duplicate events', 'incident timelines', 'targeted ids still missing']) {
  if (!proof.text.includes(text)) throw new Error(`programme proof panel missing text: ${text}`);
}
if (routeChain.length && !proof.text.includes(routeChain[0])) {
  throw new Error(`programme proof panel missing route chain owner: ${routeChain[0]}`);
}
if (proof.enabledDangerButtons.length) {
  throw new Error(`unexpected enabled Logger action controls: ${JSON.stringify(proof.enabledDangerButtons)}`);
}

console.log(`logger programme evidence proof regression: ok gate=${proof.gate} duplicates=${proof.duplicates} timelines=${proof.timelines} route=${routeChain.length} screenshot=${screenshotPath}`);
