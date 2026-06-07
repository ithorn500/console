import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-stream-reconnect-proof.png';

const streamResponse = await fetch(`${baseUrl}/api/console/events`, { cache: 'no-store' });
if (!streamResponse.ok) throw new Error(`/api/console/events -> HTTP ${streamResponse.status}`);
const streamText = await streamResponse.text();
if (!streamText.includes('event: console.heartbeat')) throw new Error('missing heartbeat SSE event');
if (!streamText.includes('event: console.source_summary')) throw new Error('missing source summary SSE event');
if (!streamText.includes('"data_plane":"amber_bus_only"')) throw new Error('stream event missing Amber Bus data-plane marker');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1400 } });
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
await page.getByRole('heading', { name: 'Console EventSource Reconnect' }).waitFor({ timeout: 30000 });
const panel = page.locator('.stream-proof-panel');
await panel.waitFor({ timeout: 15000 });
await page.waitForFunction(() => {
  const element = document.querySelector('.stream-proof-panel');
  const events = Number(element?.getAttribute('data-stream-events') || '0');
  const reconnects = Number(element?.getAttribute('data-stream-reconnects') || '0');
  return events >= 6 && reconnects >= 1;
}, null, { timeout: 12000 });
await page.getByText('reconnect proven').waitFor({ timeout: 5000 });
await panel.screenshot({ path: screenshotPath });
const proof = await panel.evaluate(element => ({
  events: Number(element.getAttribute('data-stream-events') || '0'),
  reconnects: Number(element.getAttribute('data-stream-reconnects') || '0'),
  text: element.textContent || ''
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (!proof.text.includes('Amber Bus contracts only')) {
  throw new Error('stream proof panel did not show Amber Bus contract text');
}

console.log(`stream reconnect regression: ok events=${proof.events} reconnects=${proof.reconnects} screenshot=${screenshotPath}`);
