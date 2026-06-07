import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-source-reliability-regression.png';

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const overview = await getJson('/api/console/overview');
if (overview.schema !== 'amber.console.overview.v1') throw new Error('overview schema mismatch');
if (!Array.isArray(overview.sources) || overview.sources.length < 40) throw new Error(`too few overview sources: ${overview.sources?.length}`);
if (overview.sources.some(source => source.data_plane !== 'amber_bus_only')) throw new Error('non-Amber-Bus source found in overview');
const nonGreenSources = overview.sources.filter(source => source.state !== 'ok' && source.state !== 'deferred');
const expectedProgrammeBlockers = nonGreenSources.filter(source => ['epic27_l9_status', 'epic27_windows_runtime_proof'].includes(source.id));
const degradedSignals = nonGreenSources.filter(source => source.state === 'degraded' && !['epic27_l9_status', 'epic27_windows_runtime_proof'].includes(source.id));
const unexpectedUnavailable = nonGreenSources.filter(source => source.state !== 'degraded' && !['epic27_l9_status', 'epic27_windows_runtime_proof'].includes(source.id));
const deferredSources = overview.sources.filter(source => source.state === 'deferred');
const busBackedSources = overview.sources.filter(source => source.data_plane === 'amber_bus_only');
if (expectedProgrammeBlockers.length < 2) {
  throw new Error(`expected Epic 27 programme blockers missing: ${nonGreenSources.map(source => source.id).join(', ')}`);
}
if (unexpectedUnavailable.length) {
  throw new Error(`unexpected unavailable sources present: ${unexpectedUnavailable.map(source => source.id).join(', ')}`);
}

const nativeHealth = await getJson('/api/console/source?target=amber_bus_native_health&logger_evidence=0');
if (!nativeHealth.ok || nativeHealth.http_status !== 200 || nativeHealth.data_plane !== 'amber_bus_only') {
  throw new Error(`Amber Bus native health source failed: ${JSON.stringify(nativeHealth)}`);
}
if (nativeHealth.payload?.overall_state !== 'healthy') {
  throw new Error(`Amber Bus native health is not healthy: ${JSON.stringify(nativeHealth.payload)}`);
}

const stableSource = await getJson('/api/console/source?target=memorr_email_timeline');
if (!stableSource.ok || stableSource.http_status !== 200) throw new Error(`stable source failed: ${JSON.stringify(stableSource)}`);

const archiveSource = await getJson('/api/console/source?target=memorr_archive');
if (!archiveSource.ok || archiveSource.http_status !== 200) throw new Error(`Memorr archive source failed: ${JSON.stringify(archiveSource)}`);

const processingSource = await getJson('/api/console/source?target=memorr_mirror');
if (!processingSource.ok || processingSource.http_status !== 200) throw new Error(`Memorr processing source failed: ${JSON.stringify(processingSource)}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1500 } });
const failures = [];
const nonConsoleRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.startsWith(baseUrl)) return;
  if (url.startsWith('data:')) return;
  nonConsoleRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Freshness and Click-Through Gates' }).waitFor({ timeout: 30000 });
const reliabilityPanel = page.locator('.reliability-panel');
await reliabilityPanel.getByText('shared sources').waitFor({ timeout: 15000 });
await reliabilityPanel.getByText('unexpected unavailable').first().waitFor({ timeout: 15000 });
await reliabilityPanel.getByText('expected programme blockers').first().waitFor({ timeout: 15000 });
await reliabilityPanel.getByRole('heading', { name: 'Bus Resilience Ledger' }).waitFor({ timeout: 15000 });
await reliabilityPanel.getByRole('heading', { name: 'Expected Programme Blockers' }).waitFor({ timeout: 15000 });
await reliabilityPanel.getByRole('heading', { name: 'Unexpected Source Outages' }).waitFor({ timeout: 15000 });
await reliabilityPanel.getByRole('heading', { name: 'Owner Degraded Signals' }).waitFor({ timeout: 15000 });
const busLedger = reliabilityPanel.locator('.bus-resilience-ledger');
await busLedger.getByText('native edge').waitFor({ timeout: 15000 });
await busLedger.getByText(nativeHealth.payload.overall_state).first().waitFor({ timeout: 15000 });
await busLedger.getByText('source blast radius').waitFor({ timeout: 15000 });
await busLedger.getByText(/^0$/).first().waitFor({ timeout: 15000 });
await busLedger.getByText('no unexpected outage now').waitFor({ timeout: 15000 });
await busLedger.getByText('detail-only load').waitFor({ timeout: 15000 });
await busLedger.getByText(new RegExp(`^${deferredSources.length}$`)).first().waitFor({ timeout: 15000 });
await busLedger.getByText('expected blockers').waitFor({ timeout: 15000 });
await busLedger.getByText(new RegExp(`^${expectedProgrammeBlockers.length}$`)).first().waitFor({ timeout: 15000 });
await busLedger.getByText('Bus-only coverage').waitFor({ timeout: 15000 });
await busLedger.getByText(new RegExp(`^${busBackedSources.length}$`)).first().waitFor({ timeout: 15000 });
await busLedger.getByText('all operational sources').waitFor({ timeout: 15000 });
await reliabilityPanel.getByText('no unexpected unavailable sources in current overview').waitFor({ timeout: 15000 });
await reliabilityPanel.getByText('epic27_l9_status').first().waitFor({ timeout: 15000 });
await reliabilityPanel.getByText('epic27_windows_runtime_proof').first().waitFor({ timeout: 15000 });
if (degradedSignals.length) {
  for (const source of degradedSignals.slice(0, 4)) {
    await reliabilityPanel.getByText(source.id).first().waitFor({ timeout: 15000 });
  }
} else {
  await reliabilityPanel.getByText('no degraded live owner signals in current overview').waitFor({ timeout: 15000 });
}
await reliabilityPanel.screenshot({ path: screenshotPath });
await reliabilityPanel.locator('.reliability-list button').first().click();
await page.locator('.drawer.open').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('Owner Detail').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('HTTP').waitFor({ timeout: 15000 });
await browser.close();

if (nonConsoleRequests.length) {
  throw new Error(`browser made non-console requests: ${[...new Set(nonConsoleRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}

console.log(`source reliability regression: ok screenshot=${screenshotPath} sources=${overview.sources.length} expected_programme_blockers=${expectedProgrammeBlockers.length} degraded_signals=${degradedSignals.length} unexpected_unavailable=${unexpectedUnavailable.length} bus_native=${nativeHealth.payload.overall_state} bus_coverage=${busBackedSources.length} deferred=${deferredSources.length}`);
