import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-background-logger-fast-path.png';

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

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const directProof = await getJson('/api/console/source?target=amber_bus_apps');
if (directProof.schema !== 'amber.console.source_detail.v1' || !directProof.logger_call_evidence) {
  throw new Error('explicit source detail no longer emits Logger call evidence');
}
const loggerEvidence = directProof.logger_call_evidence;
if (loggerEvidence.schema !== 'amber.console.source_fetch_logger_evidence.v1') {
  throw new Error(`Logger evidence schema mismatch: ${loggerEvidence.schema}`);
}
if (!loggerEvidence.request_id || !loggerEvidence.correlation_id || !loggerEvidence.ingest_ok) {
  throw new Error(`Logger evidence receipt incomplete: ${JSON.stringify(loggerEvidence).slice(0, 500)}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1500 } });
const browserFailures = [];
const offHostRequests = [];
const sourceRequests = [];

page.on('pageerror', error => browserFailures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') browserFailures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/console/source?')) sourceRequests.push(url);
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Amber Console' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Owner Status' }).waitFor({ timeout: 30000 });
await page.waitForTimeout(12000);

const panel = page.locator('.reliability-panel');
await panel.screenshot({ path: screenshotPath });
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (browserFailures.length) {
  throw new Error(browserFailures.join('\n'));
}
if (sourceRequests.length < 25) {
  throw new Error(`too few background source requests observed: ${sourceRequests.length}`);
}

const withoutFastPath = [...new Set(sourceRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('logger_evidence') !== '0';
}))];
if (withoutFastPath.length) {
  throw new Error(`background source requests missing logger_evidence=0: ${withoutFastPath.slice(0, 8).join(', ')}`);
}

console.log(`background logger fast-path regression: ok source_requests=${sourceRequests.length} explicit_request_id=${loggerEvidence.request_id} screenshot=${screenshotPath}`);
