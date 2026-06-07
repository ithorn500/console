import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-perimeter-media-contract-block.png';

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

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const sourceIds = [
  'adguard_status',
  'adguard_stats',
  'adguard_querylog',
  'adguard_clients',
  'adguard_filtering',
  'adguard_security'
];

const payloads = {};
for (const id of sourceIds) {
  const payload = await source(id);
  if (payload.schema !== 'adguardhome.invoke_result.v1' || payload.ok !== true) {
    throw new Error(`${id} invoke payload invalid: ${JSON.stringify(payload).slice(0, 500)}`);
  }
  payloads[id] = payload;
}

const status = payloads.adguard_status.data || {};
const security = payloads.adguard_security.data || {};
if (status.running !== true) {
  throw new Error(`AdGuard status is not running: ${JSON.stringify(status).slice(0, 500)}`);
}
if (security.schema !== 'adguardhome.security.summary.v1') {
  throw new Error(`AdGuard security schema mismatch: ${security.schema}`);
}

const loggerRequestProof = await getJson('/api/console/logger-request-proof-depth');
if (loggerRequestProof?.schema !== 'amber.console.logger_request_proof_depth.v1' || loggerRequestProof.data_plane !== 'amber_bus_only' || loggerRequestProof.ok !== true) {
  throw new Error(`Logger request proof route invalid: ${JSON.stringify(loggerRequestProof).slice(0, 500)}`);
}
const loggerIncidentProof = await getJson('/api/console/logger-incident-stream-proof');
if (loggerIncidentProof?.schema !== 'amber.console.logger_incident_stream_proof.v1' || loggerIncidentProof.data_plane !== 'amber_bus_only' || loggerIncidentProof.ok !== true) {
  throw new Error(`Logger incident stream proof route invalid: ${JSON.stringify(loggerIncidentProof).slice(0, 500)}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1500 } });
const browserFailures = [];
const offHostRequests = [];
const sourceRequests = [];
const loggerProofRequests = [];

page.on('pageerror', error => browserFailures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') browserFailures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/console/source?')) sourceRequests.push(url);
  if (url.includes('/api/console/logger-request-proof-depth') || url.includes('/api/console/logger-incident-stream-proof')) loggerProofRequests.push(url);
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'AdGuard Read-Only Posture' }).waitFor({ timeout: 30000 });

const panel = page.locator('.adguard-panel');
await panel.getByText('6/6 Bus sources live').waitFor({ timeout: 30000 });
await panel.getByText('running').first().waitFor({ timeout: 15000 });
await panel.getByText('info').first().waitFor({ timeout: 15000 });
await panel.getByRole('heading', { name: 'pfSense' }).waitFor({ timeout: 15000 });
await panel.getByRole('heading', { name: 'MediaDownloader' }).waitFor({ timeout: 15000 });
await panel.getByText('contract blocked').first().waitFor({ timeout: 15000 });
await panel.getByText('No approved Amber Bus read-only owner feed.').waitFor({ timeout: 15000 });
await panel.getByText('Queue, history, and health panels wait for owner contracts.').waitFor({ timeout: 15000 });
await panel.getByText('No DNS, DHCP, filter, rewrite, upstream, or protection writes.').waitFor({ timeout: 15000 });
await panel.getByText('Logger security-event linkage').waitFor({ timeout: 15000 });
await panel.getByText('linkage pending').waitFor({ timeout: 15000 });
await panel.getByText('Owner event/correlation contract required.').waitFor({ timeout: 15000 });
await panel.getByRole('heading', { name: 'Perimeter and Media Handoff Ledger' }).waitFor({ timeout: 15000 });
await panel.getByText('owner Bus feed').waitFor({ timeout: 15000 });
await panel.getByText('approved read-only posture route required').waitFor({ timeout: 15000 });
await panel.getByText('pfSense owner contract missing').waitFor({ timeout: 15000 });
await panel.getByText('MediaDownloader owner contract missing').waitFor({ timeout: 15000 });
await panel.getByText('perimeter writes absent').waitFor({ timeout: 15000 });
await panel.screenshot({ path: screenshotPath });

const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  contractCards: element.querySelectorAll('.adguard-contract-strip section').length,
  loggerCards: element.querySelectorAll('.adguard-logger-strip button').length,
  handoffCards: element.querySelectorAll('.perimeter-contract-grid button').length,
  handoffAttrs: {
    open: element.querySelector('.perimeter-contract-handoff')?.getAttribute('data-perimeter-contract-open'),
    pfsense: element.querySelector('.perimeter-contract-handoff')?.getAttribute('data-pfsense-contract'),
    media: element.querySelector('.perimeter-contract-handoff')?.getAttribute('data-mediadownloader-contract'),
    controls: element.querySelector('.perimeter-contract-handoff')?.getAttribute('data-perimeter-controls')
  },
  executableControls: Array.from(element.querySelectorAll('button')).map(button => ({
    text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: button.disabled
  })).filter(button => /^(dns|dhcp|firewall|nat|vpn|filter|rewrite|upstream|protection|queue|history|download|start|stop|restart|apply|save|dispatch|execute|run)$/i.test(button.text) && !button.disabled)
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (browserFailures.length) {
  throw new Error(browserFailures.join('\n'));
}
if (proof.contractCards !== 2) {
  throw new Error(`expected 2 contract-blocked cards, saw ${proof.contractCards}`);
}
if (proof.loggerCards !== 4) {
  throw new Error(`expected 4 Logger linkage cards, saw ${proof.loggerCards}`);
}
if (proof.handoffCards !== 4) {
  throw new Error(`expected 4 perimeter handoff cards, saw ${proof.handoffCards}`);
}
if (proof.handoffAttrs.open !== '2' || proof.handoffAttrs.pfsense !== 'missing' || proof.handoffAttrs.media !== 'missing' || proof.handoffAttrs.controls !== 'locked') {
  throw new Error(`perimeter handoff attrs drifted: ${JSON.stringify(proof.handoffAttrs)}`);
}
if (proof.executableControls.length) {
  throw new Error(`unexpected perimeter/media executable controls: ${JSON.stringify(proof.executableControls)}`);
}
for (const text of ['6/6 Bus sources live', 'running', 'info', 'pfSense', 'MediaDownloader', 'contract blocked', 'operator approval', 'owner contracts', 'Logger security-event linkage', 'linkage pending', 'request correlations', 'Perimeter and Media Handoff Ledger', 'owner Bus feed', 'approved read-only posture route required', 'pfSense owner contract missing', 'MediaDownloader owner contract missing', 'Amber Bus-only evidence']) {
  if (!proof.text.includes(text)) throw new Error(`panel missing text: ${text}`);
}

const adguardBackgroundRequests = [...new Set(sourceRequests.filter(url => {
  const parsed = new URL(url);
  return sourceIds.includes(parsed.searchParams.get('target') || '');
}))];
if (adguardBackgroundRequests.length < sourceIds.length) {
  throw new Error(`too few AdGuard background source requests observed: ${adguardBackgroundRequests.length}`);
}
const withoutFastPath = adguardBackgroundRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('logger_evidence') !== '0';
});
if (withoutFastPath.length) {
  throw new Error(`AdGuard background source requests missing logger_evidence=0: ${withoutFastPath.join(', ')}`);
}
if (loggerProofRequests.length < 2) {
  throw new Error(`browser did not request both Logger proof routes: ${loggerProofRequests.join(', ')}`);
}

console.log(`perimeter media contract-block regression: ok live_sources=${sourceIds.length} risk=${security.risk_level || 'unknown'} logger_linkage=pending request_ids=${loggerRequestProof.request_id_count || 0} correlations=${loggerRequestProof.correlation_id_count || 0} cards=${proof.contractCards} handoff=${proof.handoffCards} screenshot=${screenshotPath}`);
