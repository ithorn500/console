import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-veliai-queue-summary.png';

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

async function source(target) {
  const json = await getJson(`/api/console/source?target=${encodeURIComponent(target)}&logger_evidence=0`);
  if (json.schema !== 'amber.console.source_detail.v1') throw new Error(`${target} source schema mismatch: ${json.schema}`);
  if (json.data_plane !== 'amber_bus_only') throw new Error(`${target} missing Amber Bus data-plane marker`);
  if (!json.ok || json.http_status !== 200) throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  return json.payload;
}

const queue = await source('veliai_queue');
const artifacts = await source('veliai_artifacts');
if (queue.schema !== 'veliai.queue.summary.v1') throw new Error(`unexpected queue schema: ${queue.schema}`);
if (artifacts.schema !== 'veliai.queue.artifacts.summary.v1') throw new Error(`unexpected artifacts schema: ${artifacts.schema}`);
if (!queue.summary || typeof queue.summary !== 'object') throw new Error('queue summary missing');
if (queue.governance?.state !== 'normal' || queue.governance?.ok !== true) {
  throw new Error(`queue governance not normal: ${JSON.stringify(queue.governance)}`);
}
if (Number(queue.governance?.pressure_level ?? 0) !== 0) {
  throw new Error(`queue pressure should be zero: ${JSON.stringify(queue.governance)}`);
}
if (!Array.isArray(queue.governance?.allowed_actions) || queue.governance.allowed_actions.length < 3) {
  throw new Error(`queue owner action list missing: ${JSON.stringify(queue.governance)}`);
}
if (!artifacts.supervisor_status?.summary) throw new Error('artifact supervisor summary missing');
if (artifacts.supervisor_status?.state !== 'normal' || artifacts.supervisor_status?.unhealthy !== false) {
  throw new Error(`artifact supervisor not normal: ${JSON.stringify(artifacts.supervisor_status)}`);
}
if (!Array.isArray(artifacts.available_targets) || !artifacts.available_targets.includes('supervisor_status')) {
  throw new Error('artifact targets missing supervisor_status');
}
if (JSON.stringify(queue).includes('veliai_body_json') || JSON.stringify(queue).includes('request_json')) {
  throw new Error('queue summary leaked heavy request/response bodies');
}

const overview = await getJson('/api/console/overview?logger_evidence=0');
for (const target of ['veliai_queue', 'veliai_artifacts']) {
  const row = overview.sources?.find(source => source.id === target);
  if (!row) throw new Error(`${target} missing from overview`);
  if (!['ok', 'degraded'].includes(row.state) || row.http_status !== 200) {
    throw new Error(`${target} overview not live: ${JSON.stringify(row)}`);
  }
  if (row.data_plane !== 'amber_bus_only') throw new Error(`${target} overview data plane drift`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1500 } });
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
await page.getByText('Queue Ledger').waitFor({ timeout: 30000 });
await page.getByText('Read-only readiness ledger').waitFor({ timeout: 30000 });
await page.waitForFunction(() => {
  const ledger = document.querySelector('.queue-governance-ledger');
  return ledger?.getAttribute('data-queue-governance-state') === 'normal' &&
    ledger?.getAttribute('data-queue-governance-ok') === 'true';
}, null, { timeout: 30000 });
await page.getByText('artifact summary').waitFor({ timeout: 30000 });
await page.getByText('failed recent').waitFor({ timeout: 30000 });
await page.getByText('governance state').waitFor({ timeout: 30000 });
await page.getByText('owner reports normal queue posture').waitFor({ timeout: 30000 });
await page.getByText('pressure window').waitFor({ timeout: 30000 });
await page.getByText('owner-only actions').waitFor({ timeout: 30000 });
await page.getByText('displayed, not executable').waitFor({ timeout: 30000 });
await page.getByText('queue actions owner-only').waitFor({ timeout: 30000 });
const panel = page.locator('.router-panel');
await panel.screenshot({ path: screenshotPath });
const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  governanceCards: element.querySelectorAll('.queue-governance-grid button').length,
  governanceAttrs: {
    state: element.querySelector('.queue-governance-ledger')?.getAttribute('data-queue-governance-state'),
    ok: element.querySelector('.queue-governance-ledger')?.getAttribute('data-queue-governance-ok'),
    pressure: element.querySelector('.queue-governance-ledger')?.getAttribute('data-queue-governance-pressure'),
    executable: element.querySelector('.queue-governance-ledger')?.getAttribute('data-queue-actions-executable')
  },
  exactExecutableButtons: Array.from(element.querySelectorAll('button')).map(button => ({
    text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: button.disabled
  })).filter(button => /^(cancel queued job|raise job priority|apply|save|promote|retire|rollback|dispatch|execute|run|start|stop|restart)$/i.test(button.text) && !button.disabled)
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.governanceCards !== 4) {
  throw new Error(`expected 4 queue governance cards, saw ${proof.governanceCards}`);
}
if (proof.governanceAttrs.state !== 'normal' || proof.governanceAttrs.ok !== 'true' || proof.governanceAttrs.pressure !== '0' || proof.governanceAttrs.executable !== 'false') {
  throw new Error(`queue governance attrs mismatch: ${JSON.stringify(proof.governanceAttrs)}`);
}
if (proof.exactExecutableButtons.length) {
  throw new Error(`queue governance exposed executable controls: ${JSON.stringify(proof.exactExecutableButtons)}`);
}
for (const expected of ['Queue Ledger', 'accepted', 'running', 'retryable', 'artifact summary', 'Read-only readiness ledger', 'governance state', 'normal', 'pressure 0', 'owner-only actions', 'cancel queued job', 'raise job priority', 'bounded summaries']) {
  if (!proof.text.includes(expected)) throw new Error(`panel missing text: ${expected}`);
}

console.log(`veliai queue summary regression: ok state=${queue.governance.state} pressure=${queue.governance.pressure_level || 0} done=${queue.summary.done || 0} failed=${queue.summary.failed || 0} targets=${artifacts.available_targets.length} governance_cards=${proof.governanceCards} screenshot=${screenshotPath}`);
