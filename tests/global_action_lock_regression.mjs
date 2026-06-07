import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-global-action-lock.png';

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

async function ownerActionSource() {
  const failures = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const source = await getJson('/api/console/source?target=owner_action_readiness&logger_evidence=0');
    if (source.schema === 'amber.console.source_detail.v1' && source.data_plane === 'amber_bus_only' && source.ok && source.http_status === 200) {
      return source;
    }
    failures.push({ attempt, ok: source.ok, http_status: source.http_status, error: source.error || source.payload });
    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
  }
  throw new Error(`owner_action_readiness source unavailable after retries: ${JSON.stringify(failures)}`);
}

const ownerSource = await ownerActionSource();
if (ownerSource.schema !== 'amber.console.source_detail.v1' || ownerSource.data_plane !== 'amber_bus_only') {
  throw new Error(`owner_action_readiness source envelope invalid: ${JSON.stringify(ownerSource).slice(0, 500)}`);
}
const ownerPayload = ownerSource.payload || {};
if (ownerPayload.schema !== 'amber.owner_action.readiness.v1' || ownerPayload.data_plane !== 'amber_bus_only') {
  throw new Error(`owner action payload invalid: ${JSON.stringify(ownerPayload).slice(0, 500)}`);
}
if (ownerPayload.summary?.go_no_go !== 'no_go') throw new Error(`owner action readiness unexpectedly green: ${ownerPayload.summary?.go_no_go}`);
if (ownerPayload.summary?.ready_for_action_dispatch !== false) throw new Error('action dispatch unexpectedly ready');
if (ownerPayload.summary?.mutation_allowed !== false) throw new Error('mutation unexpectedly allowed');
if (ownerPayload.owners?.some(owner => owner.action_ready || owner.action_dispatch_allowed)) {
  throw new Error('at least one owner reports action dispatch allowed');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1900 } });
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
await page.getByRole('heading', { name: 'Owner action readiness and rollback proof' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Go / No-Go and Rollback Proof' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Camera Boundary + Hazard Vision' }).waitFor({ timeout: 30000 });

const ownerPanel = page.locator('.owner-action-readiness-panel');
await ownerPanel.getByText('mutationblocked').waitFor({ timeout: 15000 });
await ownerPanel.getByText('dispatch ready').waitFor({ timeout: 15000 });
await ownerPanel.getByText('owner preview contract').first().waitFor({ timeout: 15000 });
await ownerPanel.getByText('blocked').first().waitFor({ timeout: 15000 });
await ownerPanel.locator('.owner-action-card').first().waitFor({ timeout: 45000 });

const promotionPanel = page.locator('.promotion-panel');
const openCount = await promotionPanel.evaluate(element => Number(element.getAttribute('data-promotion-open') || '0'));
if (openCount < 6) throw new Error(`promotion panel no-go blockers unexpectedly low: ${openCount}`);
await promotionPanel.getByText('rollback gates blocked').waitFor({ timeout: 15000 });
await promotionPanel.getByText('Owner Apply Rollback').waitFor({ timeout: 15000 });

const lawnPanel = page.locator('.lawn-panel');
const saveGated = lawnPanel.getByRole('button', { name: 'Save gated', exact: true });
await saveGated.waitFor({ timeout: 15000 });
if (!(await saveGated.isDisabled())) throw new Error('lawn owner save gate is enabled');

const proof = await page.evaluate(() => {
  const exactDanger = /^(start|stop|restart|apply|save|promote|retire|rollback|dispatch|execute|run|load|unload|retry|silence|ack|nack|drain|kill)$/i;
  const allowedDisabledDanger = /^(delete point|reset preview|save gated)$/i;
  const buttons = Array.from(document.querySelectorAll('button')).map((button, index) => ({
    index,
    text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: button.disabled,
    className: String(button.className || '')
  }));
  const executable = buttons.filter(button => {
    const text = button.text.toLowerCase();
    if (!text || text.length > 80) return false;
    if (allowedDisabledDanger.test(text)) return !button.disabled;
    return exactDanger.test(text) && !button.disabled;
  });
  return {
    actionCards: document.querySelectorAll('.owner-action-card').length,
    promotionOpen: Number(document.querySelector('.promotion-panel')?.getAttribute('data-promotion-open') || '0'),
    ownerText: document.querySelector('.owner-action-readiness-panel')?.textContent || '',
    promotionText: document.querySelector('.promotion-panel')?.textContent || '',
    disabledSave: Array.from(document.querySelectorAll('button')).some(button => (button.textContent || '').trim() === 'Save gated' && button.disabled),
    executable
  };
});
await page.screenshot({ path: screenshotPath, fullPage: false });
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.executable.length) {
  throw new Error(`unexpected executable action buttons: ${JSON.stringify(proof.executable)}`);
}
if (proof.actionCards < 6) throw new Error(`too few owner action cards: ${proof.actionCards}`);
if (proof.promotionOpen < 6) throw new Error(`promotion blockers unexpectedly low: ${proof.promotionOpen}`);
if (!proof.disabledSave) throw new Error('disabled Save gated button not found');
for (const text of ['no_go', 'mutationblocked', 'rollback execution proof missing', 'Owner Apply Rollback', 'Promote / Retire']) {
  if (!proof.ownerText.includes(text) && !proof.promotionText.includes(text)) {
    throw new Error(`action lock proof missing text: ${text}`);
  }
}

const ownerBackgroundRequests = [...new Set(sourceRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('target') === 'owner_action_readiness';
}))];
const withoutFastPath = ownerBackgroundRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('logger_evidence') !== '0';
});
if (withoutFastPath.length) {
  throw new Error(`owner_action_readiness background requests missing logger_evidence=0: ${withoutFastPath.join(', ')}`);
}

console.log(`global action lock regression: ok owners=${ownerPayload.summary.owner_count} blocked=${ownerPayload.summary.blocked_action_count} promotion_open=${proof.promotionOpen} screenshot=${screenshotPath}`);
