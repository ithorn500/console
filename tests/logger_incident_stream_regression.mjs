import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-logger-incident-stream.png';

async function proofRequest() {
  const response = await fetch(`${baseUrl}/api/console/logger-incident-stream-proof`, { cache: 'no-store' });
  const json = await response.json();
  if (!response.ok) throw new Error(`/api/console/logger-incident-stream-proof -> HTTP ${response.status}`);
  if (json.schema !== 'amber.console.logger_incident_stream_proof.v1') {
    throw new Error(`stream proof schema mismatch: ${json.schema}`);
  }
  if (json.data_plane !== 'amber_bus_only') {
    throw new Error(`stream proof data-plane mismatch: ${json.data_plane}`);
  }
  if (!json.ok || json.http_status !== 200 || Number(json.sse_event_count || 0) < 1) {
    throw new Error(`stream proof not live: ${JSON.stringify(json)}`);
  }
  if (!json.has_logs && !json.has_incident_timelines && !json.has_correlations) {
    throw new Error('stream proof did not expose Logger payload markers');
  }
  return json;
}

const first = await proofRequest();
const second = await proofRequest();
if (Number(second.sse_event_count || 0) < 1) {
  throw new Error('second stream proof did not reconnect');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1450 } });
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
await page.getByRole('heading', { name: 'Logger-Owned Incident Stream' }).waitFor({ timeout: 30000 });
const panel = page.locator('.logger-stream-proof:not(.logger-request-proof)');
await panel.waitFor({ timeout: 15000 });
await page.waitForFunction(() => {
  const element = document.querySelector('.logger-stream-proof:not(.logger-request-proof)');
  return element?.getAttribute('data-logger-stream-ok') === 'true' &&
    Number(element?.getAttribute('data-logger-stream-events') || '0') >= 1;
}, null, { timeout: 20000 });
await panel.screenshot({ path: screenshotPath });
const surface = await panel.evaluate(element => ({
  events: Number(element.getAttribute('data-logger-stream-events') || '0'),
  text: element.textContent || ''
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (!surface.text.includes('Amber Bus contracts only')) {
  throw new Error('Logger stream panel did not show Amber Bus contract text');
}

console.log(`logger incident stream regression: ok first_events=${first.sse_event_count} second_events=${second.sse_event_count} browser_events=${surface.events} screenshot=${screenshotPath}`);
