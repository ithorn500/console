import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-soak-regression.png';
const durationSeconds = Number(process.argv[4] || '120');
const pollIntervalMs = Number(process.argv[5] || '2500');

const sourceTargets = [
  'amber_bus_client_health',
  'logger_ops_dashboard',
  'logger_evidence_proof',
  'logger_correlation_query',
  'memorr_archive',
  'memorr_mirror',
  'memorr_source',
  'actorr_operator_snapshot',
  'epic26_tasks',
  'guardian_c2_snapshot',
  'gemma_ops_state',
  'veliai_route_plan_memory'
];

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

async function timedText(path) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  const text = await response.text();
  const duration = performance.now() - started;
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return { text, duration };
}

const initialHealth = await timedJson('/health');
if (!initialHealth.json?.ok || initialHealth.json?.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(initialHealth.json)}`);
}
if (Number(initialHealth.json?.endpoint_count || 0) < 57) {
  throw new Error(`unexpected source count: ${initialHealth.json?.endpoint_count}`);
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
  if (url.startsWith(baseUrl)) return;
  if (url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Amber Console' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Go / No-Go and Rollback Proof' }).waitFor({ timeout: 30000 });

const deadline = Date.now() + durationSeconds * 1000;
const healthDurations = [];
const overviewDurations = [];
const sourceDurations = [];
const streamDurations = [];
const observedSources = new Set();
let iterations = 0;
let overviewSourceCount = 0;
let degradedOrUnavailable = 0;
let streamChecks = 0;

while (Date.now() < deadline) {
  const health = await timedJson('/health');
  healthDurations.push(health.duration);
  if (!health.json?.ok || health.json?.data_plane !== 'amber_bus_only') {
    throw new Error(`health invariant failed: ${JSON.stringify(health.json)}`);
  }
  if (Number(health.json?.endpoint_count || 0) < 57) {
    throw new Error(`source count dropped during soak: ${health.json?.endpoint_count}`);
  }

  const overview = await timedJson('/api/console/overview');
  overviewDurations.push(overview.duration);
  if (overview.json?.schema !== 'amber.console.overview.v1') {
    throw new Error(`overview schema mismatch: ${overview.json?.schema}`);
  }
  const sources = Array.isArray(overview.json?.sources) ? overview.json.sources : [];
  overviewSourceCount = sources.length;
  degradedOrUnavailable = sources.filter(source => source.state !== 'ok' && source.state !== 'deferred').length;
  if (overviewSourceCount < 57) {
    throw new Error(`overview source count dropped during soak: ${overviewSourceCount}`);
  }
  if (sources.some(source => source.data_plane !== 'amber_bus_only')) {
    throw new Error('non-Amber-Bus source found during soak');
  }

  const target = sourceTargets[iterations % sourceTargets.length];
  const source = await timedJson(`/api/console/source?target=${encodeURIComponent(target)}`);
  sourceDurations.push(source.duration);
  if (source.json?.schema !== 'amber.console.source_detail.v1') {
    throw new Error(`source schema mismatch for ${target}: ${source.json?.schema}`);
  }
  if (source.json?.data_plane !== 'amber_bus_only') {
    throw new Error(`source ${target} missing Amber Bus data-plane marker`);
  }
  observedSources.add(target);

  if (iterations % 8 === 0) {
    const stream = await timedText('/api/console/events');
    streamDurations.push(stream.duration);
    if (!stream.text.includes('event: console.heartbeat') || !stream.text.includes('"data_plane":"amber_bus_only"')) {
      throw new Error('Console event stream lost heartbeat or data-plane marker');
    }
    streamChecks += 1;
  }

  iterations += 1;
  await page.waitForTimeout(pollIntervalMs);
}

await page.locator('.promotion-panel').screenshot({ path: screenshotPath });
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (browserFailures.length) {
  throw new Error(browserFailures.join('\n'));
}
if (observedSources.size < Math.min(sourceTargets.length, Math.ceil(iterations / 2))) {
  throw new Error(`too few source probes during soak: ${observedSources.size}`);
}

const summary = {
  duration_seconds: durationSeconds,
  iterations,
  overview_sources: overviewSourceCount,
  degraded_or_unavailable: degradedOrUnavailable,
  source_targets_observed: observedSources.size,
  stream_checks: streamChecks,
  health_p95_ms: Math.round(percentile(healthDurations, 0.95)),
  overview_p95_ms: Math.round(percentile(overviewDurations, 0.95)),
  source_p95_ms: Math.round(percentile(sourceDurations, 0.95)),
  stream_p95_ms: Math.round(percentile(streamDurations, 0.95)),
  screenshot: screenshotPath
};

console.log(`console soak regression: ok ${JSON.stringify(summary)}`);
