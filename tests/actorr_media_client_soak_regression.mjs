import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-actorr-media-client-soak.png';
const durationSeconds = Number(process.argv[4] || '180');
const pollIntervalMs = Number(process.argv[5] || '5000');

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

async function timedJson(path) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  const text = await response.text();
  const duration = performance.now() - started;
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${String(err)}`);
  }
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return { json, duration };
}

async function source(target) {
  const result = await timedJson(`/api/console/source?target=${encodeURIComponent(target)}&logger_evidence=0`);
  const json = result.json;
  if (json?.schema !== 'amber.console.source_detail.v1') {
    throw new Error(`${target} source schema mismatch: ${json?.schema}`);
  }
  if (json.data_plane !== 'amber_bus_only') {
    throw new Error(`${target} missing Amber Bus data-plane marker`);
  }
  if (!json.ok || json.http_status !== 200) {
    throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return { detail: json, payload: json.payload, duration: result.duration };
}

const health = await timedJson('/health');
if (!health.json?.ok || health.json?.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health.json)}`);
}
if (Number(health.json?.endpoint_count || 0) < 70) {
  throw new Error(`unexpected source count: ${health.json?.endpoint_count}`);
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
await page.getByRole('heading', { name: 'Velox Media Pipeline and Operator Evidence' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Install, update, and service package proof' }).waitFor({ timeout: 30000 });

const deadline = Date.now() + durationSeconds * 1000;
const snapshotDurations = [];
const clientDurations = [];
const observedStates = new Set();
const observedVersions = new Set();
let iterations = 0;
let lastSnapshot = null;
let lastClient = null;

while (Date.now() < deadline) {
  const snapshot = await source('actorr_operator_snapshot');
  const client = await source('actorr_client_bootstrap');
  snapshotDurations.push(snapshot.duration);
  clientDurations.push(client.duration);

  const snapshotPayload = snapshot.payload || {};
  const clientPayload = client.payload || {};
  const state = snapshotPayload.snapshot?.velox_dashboard?.system?.state || 'unknown';
  observedStates.add(String(state));
  observedVersions.add(String(clientPayload.latest_version || 'unknown'));

  if (snapshotPayload.schema !== 'actorr.c2.operator_snapshot.v1' || snapshotPayload.ok !== true) {
    throw new Error(`Actorr snapshot payload invalid: ${JSON.stringify(snapshotPayload).slice(0, 500)}`);
  }
  if (clientPayload.ok !== true || !clientPayload.latest_version) {
    throw new Error(`Actorr client payload invalid: ${JSON.stringify(clientPayload).slice(0, 500)}`);
  }
  if (!Array.isArray(clientPayload.runtime?.linux_components) || !clientPayload.runtime.linux_components.includes('actorr_clientd')) {
    throw new Error('Actorr Linux client runtime package proof missing');
  }
  if (!Array.isArray(clientPayload.runtime?.windows_components) || !clientPayload.runtime.windows_components.some(item => String(item).includes('ActorrClient'))) {
    throw new Error('Actorr Windows client runtime package proof missing');
  }
  if (Number(clientPayload.summary?.install_success || 0) < 1 || Number(clientPayload.summary?.update_success || 0) < 1) {
    throw new Error('Actorr client install/update telemetry missing');
  }

  lastSnapshot = snapshotPayload;
  lastClient = clientPayload;
  iterations += 1;
  await page.waitForTimeout(pollIntervalMs);
}

const panel = page.locator('.actorr-media-panel');
await panel.screenshot({ path: screenshotPath });
const panelText = await panel.evaluate(element => element.textContent || '');
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (browserFailures.length) {
  throw new Error(browserFailures.join('\n'));
}
for (const expected of ['Velox Media Pipeline', 'Client Bootstrap', 'latest stable client', 'install success', 'update success']) {
  if (!panelText.includes(expected)) throw new Error(`Actorr panel missing text: ${expected}`);
}
if (iterations < 2) {
  throw new Error(`too few soak iterations: ${iterations}`);
}

const summary = {
  duration_seconds: durationSeconds,
  iterations,
  observed_states: [...observedStates],
  observed_versions: [...observedVersions],
  latest_state: lastSnapshot?.snapshot?.velox_dashboard?.system?.state || 'unknown',
  latest_version: lastClient?.latest_version || 'unknown',
  install_success: Number(lastClient?.summary?.install_success || 0),
  update_success: Number(lastClient?.summary?.update_success || 0),
  diagnostics: Number(lastSnapshot?.snapshot?.runtime_diagnostics?.items?.length || 0),
  snapshot_p95_ms: Math.round(percentile(snapshotDurations, 0.95)),
  client_p95_ms: Math.round(percentile(clientDurations, 0.95)),
  screenshot: screenshotPath
};

console.log(`actorr media/client soak regression: ok ${JSON.stringify(summary)}`);
