import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-ha-evidence-readonly.png';

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

const source = await getJson('/api/console/source?target=guardian_c2_snapshot&logger_evidence=0');
if (source.schema !== 'amber.console.source_detail.v1') throw new Error(`source schema mismatch: ${source.schema}`);
if (source.data_plane !== 'amber_bus_only') throw new Error(`source data plane mismatch: ${source.data_plane}`);
if (!source.ok || source.http_status !== 200) throw new Error(`guardian_c2_snapshot not ok: ${JSON.stringify(source).slice(0, 500)}`);

const payload = source.payload || {};
if (payload.schema !== 'guardian.c2.deck.snapshot.v1') throw new Error(`Guardian snapshot schema mismatch: ${payload.schema}`);
const ha = payload.live?.ha_control_plane_status;
if (!ha) throw new Error('Guardian snapshot missing live.ha_control_plane_status');
if (ha.mode !== 'monitor') throw new Error(`HA mode drifted from monitor: ${ha.mode}`);
if (ha.actuation_mode !== 'dry_run') throw new Error(`HA actuation mode drifted from dry_run: ${ha.actuation_mode}`);
if (ha.ha_state_fetch?.ok !== true || ha.ha_state_fetch?.all_entities !== true) throw new Error('HA state fetch is not a full ok evidence read');
if (Number(ha.ha_entity_catalog?.entity_count || ha.ha_state_fetch?.entity_count || 0) < 1000) throw new Error(`HA entity count too small: ${ha.ha_entity_catalog?.entity_count || ha.ha_state_fetch?.entity_count}`);
if (ha.ha_probe?.rest?.ok !== true || ha.ha_probe?.websocket?.ok !== true) throw new Error('HA REST/WebSocket probe is not green');
if (ha.ha_subscription?.ok !== true || !Array.isArray(ha.ha_subscription?.tracked_entities) || ha.ha_subscription.tracked_entities.length < 10) {
  throw new Error('HA subscription proof missing tracked entities');
}
if (!Array.isArray(ha.ha_trigger_events) || ha.ha_trigger_events.length < 5) throw new Error('HA trigger event watch list is too small');
if (!ha.snapshot || !ha.decision_output) throw new Error('HA energy snapshot or Guardian decision output missing');
if (ha.actuation_attempt?.dry_run !== true) throw new Error('HA actuation attempt is not dry-run gated');
if ((ha.actuation_attempt?.applied || []).length !== 0) throw new Error('dry-run HA actuation unexpectedly applied actions');
if ((ha.actuation_allowlist?.blocked_count || 0) < 1) throw new Error('HA actuation allowlist does not expose blocked policy count');
if ((ha.ha_state_fetch?.missing || []).length !== 0 || (ha.snapshot?.missing_entities || []).length !== 0) {
  throw new Error('HA evidence currently reports missing entities');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1500 } });
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
await page.getByRole('heading', { name: 'Entity Fabric Consumed by Guardian' }).waitFor({ timeout: 30000 });
const panel = page.locator('.ha-evidence-panel');
await panel.getByText('monitor').waitFor({ timeout: 15000 });
await panel.getByText('dry_run').waitFor({ timeout: 15000 });
await panel.getByText('HA entities').waitFor({ timeout: 15000 });
await panel.getByText('REST ok').waitFor({ timeout: 15000 });
await panel.getByText('WS ok').waitFor({ timeout: 15000 });
await panel.getByText('subscription ok').waitFor({ timeout: 15000 });
await panel.getByText('read-only evidence').waitFor({ timeout: 15000 });
await panel.screenshot({ path: screenshotPath });

const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  domainCards: element.querySelectorAll('.ha-domain-strip button').length,
  watchCards: element.querySelectorAll('.ha-watch-list button').length,
  exactActionButtons: Array.from(element.querySelectorAll('button')).map(button => (button.textContent || '').replace(/\s+/g, ' ').trim()).filter(text => /^(apply|save|dispatch|execute|run|service call|turn on|turn off)$/i.test(text))
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.exactActionButtons.length) {
  throw new Error(`HA panel exposed exact executable controls: ${proof.exactActionButtons.join(', ')}`);
}
if (proof.domainCards < 5 || proof.watchCards < 5) {
  throw new Error(`HA panel rendered too little evidence: ${JSON.stringify(proof)}`);
}
for (const text of ['Energy Snapshot', 'Guardian Decision Context', 'Connectivity and Watches', 'missing entities0']) {
  if (!proof.text.includes(text)) throw new Error(`HA panel missing text: ${text}`);
}

const guardianBackgroundRequests = [...new Set(sourceRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('target') === 'guardian_c2_snapshot';
}))];
const withoutFastPath = guardianBackgroundRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('logger_evidence') !== '0';
});
if (withoutFastPath.length) {
  throw new Error(`guardian_c2_snapshot background requests missing logger_evidence=0: ${withoutFastPath.join(', ')}`);
}

console.log(`ha evidence readonly regression: ok entities=${ha.ha_entity_catalog?.entity_count || ha.ha_state_fetch?.entity_count} watch=${ha.ha_subscription.tracked_entities.length} events=${ha.ha_trigger_events.length} blocked=${ha.actuation_allowlist.blocked_count} screenshot=${screenshotPath}`);
