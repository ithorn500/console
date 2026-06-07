import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-guardian-c2-fault-chain.png';

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

const source = await getJson('/api/console/source?target=guardian_c2_snapshot&logger_evidence=0');
if (source.schema !== 'amber.console.source_detail.v1') {
  throw new Error(`guardian source detail schema mismatch: ${source.schema}`);
}
if (source.data_plane !== 'amber_bus_only') {
  throw new Error(`guardian source data plane mismatch: ${source.data_plane}`);
}
if (!source.ok || source.http_status !== 200) {
  throw new Error(`guardian_c2_snapshot not live: ${JSON.stringify(source).slice(0, 600)}`);
}

const payload = source.payload || {};
const chain = payload.chain || {};
const route = Array.isArray(chain.order) ? chain.order.slice(0, 10) : [];
const mergedHints = Array.isArray(chain.hints?.merged_structural_errors) ? chain.hints.merged_structural_errors : [];
const structuralHints = Array.isArray(chain.hints?.structural_errors) ? chain.hints.structural_errors : [];
const hintCount = [ ...mergedHints, ...structuralHints, chain.hints?.neo4j_last_error, chain.hints?.neo4j_last_action ].filter(Boolean).slice(0, 4).length;

if (!route.length) throw new Error('Guardian C2 chain did not include a route');
if (!chain.first_fault_node) throw new Error('Guardian C2 chain did not include first_fault_node');
if (!chain.summary) throw new Error('Guardian C2 chain did not include summary');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1600 } });
const failures = [];
const offHostRequests = [];
const guardianSourceRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.startsWith(baseUrl)) {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/console/source' && parsed.searchParams.get('target') === 'guardian_c2_snapshot') {
      guardianSourceRequests.push(url);
    }
    return;
  }
  if (url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Control Chain and Apply Gate' }).waitFor({ timeout: 30000 });
const panel = page.locator('.guardian-c2-panel');
const faultChain = panel.locator('.guardian-fault-chain');
await faultChain.getByRole('heading', { name: 'Owner-reported break route' }).waitFor({ timeout: 30000 });
await faultChain.getByText(chain.summary).waitFor({ timeout: 15000 });
await faultChain.getByText(chain.first_fault_node).first().waitFor({ timeout: 15000 });
await faultChain.getByText('first fault').first().waitFor({ timeout: 15000 });

for (const id of route.slice(0, 6)) {
  await faultChain.getByText(id).first().waitFor({ timeout: 15000 });
}
if (hintCount) {
  await faultChain.getByText('owner hint').first().waitFor({ timeout: 15000 });
}

const proof = await faultChain.evaluate(element => ({
  state: element.getAttribute('data-guardian-fault-state'),
  firstFault: element.getAttribute('data-guardian-first-fault'),
  routeCount: Number(element.getAttribute('data-guardian-fault-route-count') || '0'),
  hints: Number(element.getAttribute('data-guardian-fault-hints') || '0'),
  routeCards: element.querySelectorAll('.guardian-fault-route button').length,
  hintCards: element.querySelectorAll('.guardian-fault-hints button').length,
  text: element.textContent || '',
  enabledDangerButtons: Array.from(element.querySelectorAll('button'))
    .map(button => ({ text: button.textContent?.trim() || '', disabled: button.disabled }))
    .filter(button => /^(promote|retire|rollback|apply|save|dispatch|execute|run)$/i.test(button.text) && !button.disabled)
}));
await faultChain.screenshot({ path: screenshotPath });

const backgroundGuardianRequests = [...guardianSourceRequests];
if (backgroundGuardianRequests.some(url => new URL(url).searchParams.get('logger_evidence') !== '0')) {
  throw new Error(`guardian background source requests missing logger_evidence=0: ${backgroundGuardianRequests.join(', ')}`);
}
guardianSourceRequests.length = 0;

await faultChain.getByRole('button').first().click();
await page.locator('.drawer.open').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('Owner Detail').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('guardian_c2_snapshot').waitFor({ timeout: 15000 });
await browser.close();

if (failures.length) throw new Error(failures.join('\n'));
if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (proof.routeCount !== route.length || proof.routeCards !== route.length) {
  throw new Error(`fault route card mismatch: source=${route.length} attr=${proof.routeCount} rendered=${proof.routeCards}`);
}
if (proof.firstFault !== chain.first_fault_node) {
  throw new Error(`first fault mismatch: source=${chain.first_fault_node} rendered=${proof.firstFault}`);
}
if (proof.hints !== hintCount) {
  throw new Error(`hint count mismatch: source=${hintCount} rendered=${proof.hints}`);
}
if (!proof.text.includes('Fault Chain') || !proof.text.includes('Owner-reported break route')) {
  throw new Error('fault chain strip missing title text');
}
if (proof.enabledDangerButtons.length) {
  throw new Error(`unexpected enabled action controls in fault chain: ${JSON.stringify(proof.enabledDangerButtons)}`);
}

console.log(`guardian c2 fault chain regression: ok state=${proof.state} first_fault=${proof.firstFault} route=${proof.routeCount} hints=${proof.hints} screenshot=${screenshotPath}`);
