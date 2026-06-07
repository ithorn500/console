import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-logger-request-proof-depth.png';

const response = await fetch(`${baseUrl}/api/console/logger-request-proof-depth`, { cache: 'no-store' });
const proof = await response.json();
if (!response.ok) throw new Error(`/api/console/logger-request-proof-depth -> HTTP ${response.status}`);
if (proof.schema !== 'amber.console.logger_request_proof_depth.v1') {
  throw new Error(`request proof schema mismatch: ${proof.schema}`);
}
if (proof.data_plane !== 'amber_bus_only') {
  throw new Error(`request proof data-plane mismatch: ${proof.data_plane}`);
}
if (![0, 200].includes(proof.http_status)) {
  throw new Error(`Logger evidence proof HTTP status mismatch: ${JSON.stringify(proof)}`);
}
if (proof.http_status === 0 && proof.state !== 'unavailable') {
  throw new Error(`Logger proof transport failure should be unavailable: ${JSON.stringify(proof).slice(0, 500)}`);
}
if (!['ready', 'blocked', 'unavailable'].includes(proof.state)) {
  throw new Error(`unexpected request proof state: ${proof.state}`);
}
if (proof.request_specific_ready !== false) {
  throw new Error(`request-specific proof unexpectedly ready: ${JSON.stringify(proof).slice(0, 500)}`);
}
if (proof.request_id_count !== 0 || proof.correlation_id_count !== 0) {
  throw new Error(`owner request/correlation identifiers unexpectedly present: request=${proof.request_id_count} correlation=${proof.correlation_id_count}`);
}
const acceptableOpenGate = /owner events currently lack emitted request_id\/correlation_id|no current events/i.test(proof.open_gate || '');
if (!acceptableOpenGate) {
  throw new Error(`open gate did not name owner-emitted id gap or no-current-events window: ${proof.open_gate}`);
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
await page.getByRole('heading', { name: 'Logger Request-Specific Proof Depth' }).waitFor({ timeout: 30000 });
const panel = page.locator('.logger-request-proof');
await panel.waitFor({ timeout: 15000 });
await page.waitForFunction(() => {
  const element = document.querySelector('.logger-request-proof');
  return ['ready', 'blocked', 'unavailable'].includes(element?.getAttribute('data-logger-request-proof-state') || '');
}, null, { timeout: 45000 });
const coverage = panel.locator('.logger-proof-coverage');
const proofWindow = panel.locator('.logger-proof-window');
await proofWindow.getByRole('heading', { name: 'Current Logger Proof Window' }).waitFor({ timeout: 15000 });
for (const text of ['window mode', 'route status', 'proof events', 'request/correlation ids', 'duration']) {
  await proofWindow.getByText(text, { exact: true }).waitFor({ timeout: 15000 });
}
await proofWindow.getByText(/no current events|identifier gap|ready/).first().waitFor({ timeout: 15000 });
await proofWindow.getByText(/^(0|200)$/).first().waitFor({ timeout: 15000 });
await proofWindow.getByText(`${proof.request_id_count || 0}/${proof.correlation_id_count || 0}`).waitFor({ timeout: 15000 });
await proofWindow.getByText(/\d+ms/).first().waitFor({ timeout: 15000 });
await coverage.getByRole('heading', { name: 'Identifier Coverage Matrix' }).waitFor({ timeout: 15000 });
for (const text of ['events', 'request ids', 'correlation ids', 'incident ids', 'migration ids', 'outcome ids', 'lifecycle stages']) {
  await coverage.getByText(text).first().waitFor({ timeout: 15000 });
}
await coverage.getByText('owner ids missing').waitFor({ timeout: 15000 });
await coverage.getByText('owner request id absent').waitFor({ timeout: 15000 });
await coverage.getByText('owner correlation id absent').waitFor({ timeout: 15000 });
await coverage.getByText(proof.open_gate).waitFor({ timeout: 15000 });
await panel.screenshot({ path: screenshotPath });
const surface = await panel.evaluate(element => ({
  state: element.getAttribute('data-logger-request-proof-state'),
  ready: element.getAttribute('data-logger-request-proof-ready'),
  events: Number(element.getAttribute('data-logger-request-proof-events') || '0'),
  windowAttrs: {
    mode: element.querySelector('.logger-proof-window')?.getAttribute('data-logger-proof-window-mode') || '',
    http: Number(element.querySelector('.logger-proof-window')?.getAttribute('data-logger-proof-window-http') || '-1'),
    events: Number(element.querySelector('.logger-proof-window')?.getAttribute('data-logger-proof-window-events') || '-1'),
    ready: element.querySelector('.logger-proof-window')?.getAttribute('data-logger-proof-window-ready') || ''
  },
  windowCards: element.querySelectorAll('.logger-proof-window-grid button').length,
  coverageOpen: Number(element.querySelector('.logger-proof-coverage')?.getAttribute('data-logger-proof-open') || '0'),
  coverageCards: element.querySelectorAll('.logger-coverage-grid button').length,
  text: element.textContent || ''
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (!surface.text.includes('Amber Bus contracts only') || !surface.text.includes('logger.evidence.proof')) {
  throw new Error('request proof panel did not show Bus/proof contract text');
}
for (const text of ['proof state', 'request-specific proof blocked', 'request identifiers', 'no request id emitted', 'correlation identifiers', 'no correlation id emitted', 'incident identifiers', 'owner emission gate']) {
  if (!surface.text.includes(text)) throw new Error(`request proof panel missing emission ledger text: ${text}`);
}
for (const text of ['Current Logger Proof Window', 'window mode', 'route status', 'proof events', 'request/correlation ids', 'duration']) {
  if (!surface.text.includes(text)) throw new Error(`request proof panel missing proof-window text: ${text}`);
}
for (const text of ['Identifier Coverage Matrix', 'owner request id absent', 'owner correlation id absent', 'migration proof identifier', 'action outcome identifier', 'owner lifecycle evidence']) {
  if (!surface.text.includes(text)) throw new Error(`request proof panel missing coverage text: ${text}`);
}
if (!['no_current_events', 'identifier_gap'].includes(surface.windowAttrs.mode)) {
  throw new Error(`proof window mode should remain blocked/unavailable, saw ${surface.windowAttrs.mode}`);
}
if (![0, 200].includes(surface.windowAttrs.http) || surface.windowAttrs.events < 0 || surface.windowAttrs.ready !== 'false') {
  throw new Error(`proof window attrs should show a blocked/unavailable window: ${JSON.stringify(surface.windowAttrs)}`);
}
if (surface.windowCards !== 5) {
  throw new Error(`expected 5 proof window cards, saw ${surface.windowCards}`);
}
if (surface.coverageOpen !== 1) {
  throw new Error(`coverage matrix unexpectedly green: ${surface.coverageOpen}`);
}
if (surface.coverageCards !== 7) {
  throw new Error(`expected 7 coverage cards, saw ${surface.coverageCards}`);
}
if (surface.text.includes('request proof ready')) {
  throw new Error('request proof panel incorrectly presents blocked proof as ready');
}

console.log(`logger request proof depth regression: ok state=${surface.state} ready=${surface.ready} http=${surface.windowAttrs.http} window=${surface.windowAttrs.mode} events=${surface.events} coverage_open=${surface.coverageOpen} coverage_cards=${surface.coverageCards} api_ready=${proof.request_specific_ready} screenshot=${screenshotPath}`);
