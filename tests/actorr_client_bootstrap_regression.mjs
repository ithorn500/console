import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-actorr-client-bootstrap.png';

async function source(target) {
  const response = await fetch(`${baseUrl}/api/console/source?target=${encodeURIComponent(target)}&logger_evidence=0`, { cache: 'no-store' });
  const json = await response.json();
  if (!response.ok) throw new Error(`${target} -> HTTP ${response.status}`);
  if (json.schema !== 'amber.console.source_detail.v1') throw new Error(`${target} source schema mismatch: ${json.schema}`);
  if (json.data_plane !== 'amber_bus_only') throw new Error(`${target} missing Amber Bus data-plane marker`);
  if (!json.ok || json.http_status !== 200) throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  return json.payload;
}

const payload = await source('actorr_client_bootstrap');
if (!payload.ok) throw new Error('Actorr client bootstrap payload is not ok');
if (!payload.latest_version) throw new Error('missing latest_version');
if (!payload.runtime?.linux_components?.includes('actorr_clientd')) throw new Error('linux client daemon missing from runtime components');
if (!payload.runtime?.windows_components?.some(item => String(item).includes('ActorrClient'))) throw new Error('windows client component missing');
if (!payload.linux_artifact_url || !payload.windows_artifact_url) throw new Error('artifact URLs missing');
if (Number(payload.summary?.install_success || 0) < 1) throw new Error('install_success telemetry missing');
if (Number(payload.summary?.update_success || 0) < 1) throw new Error('update_success telemetry missing');

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
await page.getByRole('heading', { name: 'Velox Media Pipeline and Operator Evidence' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Install, update, and service package proof' }).waitFor({ timeout: 30000 });
const panel = page.locator('.actorr-media-panel');
await panel.getByText('latest stable client').waitFor({ timeout: 30000 });
await panel.screenshot({ path: screenshotPath });
const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  clientButtons: element.querySelectorAll('.actorr-client-proof button').length
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
for (const text of ['Client Bootstrap', 'latest stable client', 'install success', 'update success', 'Linux', 'Windows']) {
  if (!proof.text.includes(text)) throw new Error(`panel missing text: ${text}`);
}
if (proof.clientButtons < 4) {
  throw new Error(`too few client bootstrap metric buttons rendered: ${proof.clientButtons}`);
}

console.log(`actorr client bootstrap regression: ok version=${payload.latest_version} installs=${payload.summary.install_success} updates=${payload.summary.update_success} screenshot=${screenshotPath}`);
