import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-lsb-recovery.png';

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

const statePayload = await source('lsb_state_status');
const planPayload = await source('lsb_plan_status');
if (statePayload.schema !== 'amber.lsb.store.status.v1') throw new Error(`unexpected LSB state schema: ${statePayload.schema}`);
if (planPayload.schema !== 'amber.lsb.concierge.planner_status.v1') throw new Error(`unexpected LSB plan schema: ${planPayload.schema}`);
if (statePayload.state !== 'ready' || planPayload.state !== 'ready') throw new Error(`LSB not ready: ${statePayload.state}/${planPayload.state}`);
if (statePayload.raw_payload_allowed !== false || planPayload.raw_payload_allowed !== false) throw new Error('raw payload allowance must remain false');
if (statePayload.semantic_air_gap !== true || planPayload.semantic_air_gap !== true) throw new Error('semantic air gap proof missing');

const overview = await getJson('/api/console/overview?logger_evidence=0');
for (const target of ['lsb_state_status', 'lsb_plan_status']) {
  const row = overview.sources?.find(source => source.id === target);
  if (!row) throw new Error(`${target} missing from overview`);
  if (row.state !== 'ok' || row.http_status !== 200) throw new Error(`${target} overview not live: ${JSON.stringify(row)}`);
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
await page.getByRole('heading', { name: 'System Activity Map' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Owner Evidence Graph' }).waitFor({ timeout: 30000 });
await page.getByText('LSB State').first().waitFor({ timeout: 30000 });
await page.getByText('metadata feedback records').waitFor({ timeout: 30000 });
await page.getByText('NeuFab Bridge').first().waitFor({ timeout: 30000 });
await page.getByText('fallbacks on Bus path').waitFor({ timeout: 30000 });

const text = await page.locator('body').evaluate(element => element.textContent || '');
await page.screenshot({ path: screenshotPath, fullPage: true });
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
for (const expected of ['LSB State', 'NeuFab Bridge', 'metadata feedback records', 'fallbacks on Bus path']) {
  if (!text.includes(expected)) throw new Error(`missing LSB recovery UI text: ${expected}`);
}

console.log(`lsb recovery regression: ok records=${statePayload.records} indexes=${statePayload.indexes} kinds=${planPayload.supported_request_kinds.length} screenshot=${screenshotPath}`);
