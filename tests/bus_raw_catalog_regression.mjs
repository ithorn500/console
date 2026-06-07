import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-bus-raw-catalogues.png';

async function source(target) {
  const response = await fetch(`${baseUrl}/api/console/source?target=${encodeURIComponent(target)}`, { cache: 'no-store' });
  const json = await response.json();
  if (!response.ok) throw new Error(`${target} -> HTTP ${response.status}`);
  if (json.schema !== 'amber.console.source_detail.v1') throw new Error(`${target} source schema mismatch: ${json.schema}`);
  if (json.data_plane !== 'amber_bus_only') throw new Error(`${target} missing Amber Bus data-plane marker`);
  if (!json.ok || json.http_status !== 200) throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  return json.payload;
}

const functionality = await source('amber_bus_functionality');
const contracts = await source('amber_bus_contracts');
const consume = await source('amber_bus_consume_menu');
const nativeHealth = await source('amber_bus_native_health');

if (functionality.schema !== 'amber.functionality.catalog.v1' || Number(functionality.count || 0) < 150) {
  throw new Error(`functionality catalogue too small or wrong schema: ${functionality.schema} ${functionality.count}`);
}
if (contracts.schema !== 'amber.interface.catalog.v1' || Number(contracts.count || 0) < 80) {
  throw new Error(`contracts catalogue too small or wrong schema: ${contracts.schema} ${contracts.count}`);
}
if (consume.schema !== 'amber.consume.menu.model.v1' || Number(consume.summary?.functionalities || 0) < 150) {
  throw new Error(`consume menu too small or wrong schema: ${consume.schema} ${consume.summary?.functionalities}`);
}
if (nativeHealth.schema !== 'amber.bus.health.v1') {
  throw new Error(`native health schema mismatch: ${nativeHealth.schema}`);
}
if (nativeHealth.socket_state?.schema !== 'amber.bus.native_socket_state.v1') {
  throw new Error(`native socket state missing: ${JSON.stringify(nativeHealth.socket_state || {}).slice(0, 500)}`);
}
for (const field of ['listen_port', 'listen', 'established', 'close_wait', 'time_wait', 'total_for_listen_port']) {
  if (typeof nativeHealth.socket_state[field] !== 'number') {
    throw new Error(`native socket state field ${field} is not numeric`);
  }
}
if (!nativeHealth.fd_pressure || typeof nativeHealth.fd_pressure.open_fds !== 'number') {
  throw new Error('native fd_pressure.open_fds missing');
}
if (nativeHealth.active_client_pressure?.schema !== 'amber.bus.native_active_client_pressure.v1') {
  throw new Error(`native active client pressure missing: ${JSON.stringify(nativeHealth.active_client_pressure || {}).slice(0, 500)}`);
}
if (typeof nativeHealth.active_client_pressure.active_count !== 'number' || !Array.isArray(nativeHealth.active_client_pressure.sample)) {
  throw new Error('native active client pressure has invalid count/sample shape');
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
  if (url.startsWith(baseUrl)) return;
  if (url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Living Spine, Manifest, and Function Graph' }).waitFor({ timeout: 30000 });
await page.locator('.bus-contract-strip').getByText('raw function catalogue').waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Source age, schema integrity, and manifest timestamp proof' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Native Bus listener pressure and CLOSE-WAIT proof' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Linked contracts, direct access, and consume prompts' }).waitFor({ timeout: 30000 });
const panel = page.locator('.bus-spine-panel');
await page.waitForFunction(() => {
  const element = document.querySelector('.bus-spine-panel');
  return (element?.querySelectorAll('.bus-function-grid button').length || 0) >= 20;
}, null, { timeout: 45000 });
await panel.screenshot({ path: screenshotPath });
const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  cards: element.querySelectorAll('.bus-function-grid button').length
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (!proof.text.includes('/api/bus/functionality') || !proof.text.includes('/api/bus/contracts') || !proof.text.includes('/api/bus/consume/menu')) {
  throw new Error('raw catalogue route chips not rendered');
}
if (!proof.text.includes('schema ok') || !proof.text.includes('manifest-age proof live') || !proof.text.includes('per-manifest timestamp proof')) {
  throw new Error('Bus freshness/schema gate not rendered');
}
if (!proof.text.includes('Owner-Client Socket Pressure') || !proof.text.includes('CLOSE-WAIT') || !proof.text.includes('amber.bus.native_socket_state.v1')) {
  throw new Error('Bus native socket pressure proof not rendered');
}
if (!proof.text.includes('active request paths') || !proof.text.includes('amber.bus.native_active_client_pressure.v1')) {
  throw new Error('Bus native active client pressure proof not rendered');
}
if (proof.cards < 20) {
  throw new Error(`too few raw catalogue cards rendered: ${proof.cards}`);
}

console.log(`bus raw catalog regression: ok functions=${functionality.count} interfaces=${contracts.count} consume=${consume.summary.functionalities} close_wait=${nativeHealth.socket_state.close_wait} active=${nativeHealth.active_client_pressure.active_count} cards=${proof.cards} screenshot=${screenshotPath}`);
