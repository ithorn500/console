import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-windows-runtime-handoff.png';

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
    throw new Error(`${target} missing Amber Bus data-plane marker`);
  }
  if (!json.ok || json.http_status !== 200) {
    throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json.payload || {};
}

function assertOpenRuntimeProof(label, payload) {
  if (payload.status !== 'windows_runtime_execution_open') {
    throw new Error(`${label} status is not open: ${payload.status}`);
  }
  if (payload.windows_runtime_execution_observed !== false) {
    throw new Error(`${label} unexpectedly reports Windows execution observed`);
  }
  if (payload.final_l9_windows_runtime_proof_green !== false) {
    throw new Error(`${label} unexpectedly reports final Windows runtime proof green`);
  }
}

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}
if (Number(health.endpoint_count || 0) < 70) {
  throw new Error(`unexpected source count: ${health.endpoint_count}`);
}

const proof = await source('epic27_windows_runtime_proof');
const readiness = await source('epic27_windows_runtime_readiness');
const handoff = await source('epic27_windows_runtime_handoff');

if (proof.schema !== 'amber.console.windows.epic27_runtime_proof.status.v1') {
  throw new Error(`proof schema mismatch: ${proof.schema}`);
}
if (readiness.schema !== 'amber.epic27.windows_runtime_readiness.v1') {
  throw new Error(`readiness schema mismatch: ${readiness.schema}`);
}
if (handoff.schema !== 'amber.epic27.windows_runtime_handoff.v1') {
  throw new Error(`handoff schema mismatch: ${handoff.schema}`);
}

assertOpenRuntimeProof('proof', proof);
assertOpenRuntimeProof('readiness', readiness);
assertOpenRuntimeProof('handoff', handoff);

if (readiness.aigateway_dotnet_available !== false || handoff.aigateway_dotnet_available !== false) {
  throw new Error('AIGateway dotnet availability should remain false in handoff proof');
}
if (Number(handoff.required_source_count || 0) !== 21) {
  throw new Error(`unexpected handoff required source count: ${handoff.required_source_count}`);
}
if (!Array.isArray(handoff.operator_commands) || handoff.operator_commands.length < 3) {
  throw new Error('handoff operator commands are missing');
}
if (handoff.guards?.data_plane !== 'amber_bus_only') {
  throw new Error('handoff guards do not preserve Amber Bus-only data plane');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1500 } });
const browserFailures = [];
const offHostRequests = [];

page.on('pageerror', error => browserFailures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') browserFailures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Go / No-Go and Rollback Proof' }).waitFor({ timeout: 30000 });

const panel = page.locator('.promotion-panel');
const rollbackGrid = panel.locator('.rollback-grid');
await panel.getByText('70 shared sources').first().waitFor({ timeout: 30000 });
await rollbackGrid.getByText('Windows Runtime Proof', { exact: true }).waitFor({ timeout: 15000 });
await rollbackGrid.getByText('windows_runtime_execution_open').waitFor({ timeout: 15000 });
await rollbackGrid.getByText('dotnet unavailable').waitFor({ timeout: 15000 });
const handoffGrid = panel.locator('.windows-handoff-grid');
await handoffGrid.getByText('Windows Operator Handoff').waitFor({ timeout: 15000 });
await handoffGrid.getByText('21 protected sources').waitFor({ timeout: 15000 });
await handoffGrid.getByText('3 handoff commands').waitFor({ timeout: 15000 });
await handoffGrid.getByText('Reachable Windows Hosts').waitFor({ timeout: 15000 });
await handoffGrid.getByText('adserver.amber.com').waitFor({ timeout: 15000 });
await handoffGrid.getByText('exchangesrv2019.amber.com').waitFor({ timeout: 15000 });
await handoffGrid.getByText('No Remote Execution').waitFor({ timeout: 15000 });
await handoffGrid.getByText('remote=not attempted').waitFor({ timeout: 15000 });
await handoffGrid.getByText('winrm=not attempted').waitFor({ timeout: 15000 });
await handoffGrid.getByText('Green Evidence Required').waitFor({ timeout: 15000 });

const openCount = await panel.evaluate(element => Number(element.getAttribute('data-promotion-open') || '0'));
if (openCount < 5) throw new Error(`promotion gate unexpectedly close to green: ${openCount}`);

const visualProof = await panel.evaluate(element => ({
  text: element.textContent || '',
  windowsCards: element.querySelectorAll('.windows-handoff-grid button').length
}));
if (visualProof.windowsCards !== 4) {
  throw new Error(`expected 4 Windows handoff cards, saw ${visualProof.windowsCards}`);
}
for (const text of ['70 shared sources', 'Windows Operator Handoff', '21 protected sources', '3 handoff commands', 'Reachable Windows Hosts', 'adserver.amber.com', 'exchangesrv2019.amber.com', 'No Remote Execution', 'remote=not attempted', 'winrm=not attempted', 'Green Evidence Required']) {
  if (!visualProof.text.includes(text)) throw new Error(`Windows handoff surface missing text: ${text}`);
}

await panel.screenshot({ path: screenshotPath });
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (browserFailures.length) {
  throw new Error(browserFailures.join('\n'));
}

const summary = {
  status: proof.status,
  dotnet_available: readiness.aigateway_dotnet_available,
  required_source_count: Number(handoff.required_source_count || 0),
  operator_command_count: handoff.operator_commands.length,
  open_promotion_gates: openCount,
  screenshot: screenshotPath
};

console.log(`windows runtime handoff regression: ok ${JSON.stringify(summary)}`);
