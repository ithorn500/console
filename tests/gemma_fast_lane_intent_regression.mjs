import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-gemma-fast-lane-intent.png';

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
    throw new Error(`${target} missing Amber Bus-only marker`);
  }
  if (!json.ok || json.http_status !== 200) {
    throw new Error(`${target} not ok: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json.payload || {};
}

function requireWorker(workers, handle, expected) {
  const worker = workers.find(item => item.handle === handle || item.lane === handle);
  if (!worker) throw new Error(`missing ${handle} worker`);
  for (const [key, value] of Object.entries(expected)) {
    if (worker[key] !== value) {
      throw new Error(`${handle} worker ${key} expected ${value}, got ${worker[key]}`);
    }
  }
  return worker;
}

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const lanes = await source('gemma_lanes');
const models = await source('gemma_models');
const ops = await source('gemma_ops_state');
const hardware = await source('gemma_hardware');

const laneRows = lanes.lanes || [];
const workers = models.workers || lanes.workers?.workers || [];
for (const lane of ['chat', 'embed', 'fast']) {
  if (!laneRows.some(item => item.lane === lane)) throw new Error(`missing ${lane} lane row`);
}

const chat = requireWorker(workers, 'chat', { port: 21434, device: 'cuda0', engine: 'llama_cpp' });
const embed = requireWorker(workers, 'embed', { port: 21435, device: 'hip0', engine: 'llama_cpp' });
const fast = requireWorker(workers, 'fast', { port: 21436, device: 'hip0', engine: 'llama_cpp' });

if (!String(chat.model_path || '').includes('gemma-4-31B')) {
  throw new Error(`chat lane model does not preserve 31B intent: ${chat.model_path}`);
}
if (!String(embed.model_path || '').includes('bge-m3')) {
  throw new Error(`embed lane model does not preserve BGE intent: ${embed.model_path}`);
}
if (!String(fast.model_path || '').includes('gemma-4-e4b')) {
  throw new Error(`fast lane model does not preserve e4B/4B-class intent: ${fast.model_path}`);
}
if (fast.device === 'cuda0') {
  throw new Error('fast lane drifted onto CUDA/3090');
}
if (hardware.workers?.workers?.some(worker => worker.handle === 'fast' && worker.device !== 'hip0')) {
  throw new Error('hardware worker mirror disagrees with fast HIP lane intent');
}
if (!ops.veliai_manager?.profile_keys?.includes('fast')) {
  throw new Error('ops profile keys do not expose fixed fast profile');
}

const fastLane = laneRows.find(item => item.lane === 'fast');
if (!fastLane) throw new Error('fast lane row missing after worker validation');
if (fastLane.circuit_open) {
  throw new Error('fast lane circuit is unexpectedly open; Console must show this as unavailable before this proof can pass');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1400 } });
const failures = [];
const offHostRequests = [];
const sourceRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/console/source?')) sourceRequests.push(url);
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Lane, Queue, Hardware, and Provider Mirror' }).waitFor({ timeout: 30000 });
const panel = page.locator('.gemma-ops-panel');
await panel.locator('.gemma-lane-card').filter({ hasText: 'fast' }).first().waitFor({ timeout: 15000 });
await panel.getByText('AMD / HIP lane').waitFor({ timeout: 15000 });
await panel.getByText('Gateway lane proof').waitFor({ timeout: 15000 });
await panel.screenshot({ path: screenshotPath });

const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  laneCards: element.querySelectorAll('.gemma-lane-card').length,
  buttonTexts: Array.from(element.querySelectorAll('button')).map(button => (button.textContent || '').trim())
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.laneCards < 3) {
  throw new Error(`too few lane cards rendered: ${proof.laneCards}`);
}
for (const text of ['chat', 'embed', 'fast', 'circuit closed', 'AMD / HIP lane', 'Gateway lane proof']) {
  if (!proof.text.includes(text)) throw new Error(`Gemma panel missing text: ${text}`);
}
for (const action of ['Start', 'Restart', 'Load', 'Unload']) {
  if (proof.buttonTexts.some(text => text === action)) {
    throw new Error(`unexpected lane/model action control rendered: ${action}`);
  }
}

const gemmaBackgroundRequests = [...new Set(sourceRequests.filter(url => {
  const parsed = new URL(url);
  return ['gemma_lanes', 'gemma_hardware', 'gemma_models', 'gemma_activity', 'gemma_ops_state'].includes(parsed.searchParams.get('target') || '');
}))];
const withoutFastPath = gemmaBackgroundRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('logger_evidence') !== '0';
});
if (withoutFastPath.length) {
  throw new Error(`Gemma background source requests missing logger_evidence=0: ${withoutFastPath.join(', ')}`);
}

console.log(`gemma fast lane intent regression: ok fast_port=${fast.port} fast_device=${fast.device} fast_model=${fast.model_path} lane_cards=${proof.laneCards} screenshot=${screenshotPath}`);
