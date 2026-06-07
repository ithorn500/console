import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-owner-retirement-compare.png';
const parityScreenshotPath = screenshotPath.replace(/\.png$/i, '-parity.png');

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

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const memorrArchive = await source('memorr_archive');
const memorrMirror = await source('memorr_mirror');
const memorrSource = await source('memorr_source');
const actorrSnapshot = await source('actorr_operator_snapshot');
const actorrClient = await source('actorr_client_bootstrap');
const ownerActions = await source('owner_action_readiness');

if (memorrArchive.schema !== 'memorr.email_archive.status.v1' || Number(memorrArchive.email_count || 0) < 1) {
  throw new Error(`Memorr archive proof invalid: ${JSON.stringify(memorrArchive).slice(0, 400)}`);
}
if (memorrMirror.schema !== 'memorr.processing.status.v1') {
  throw new Error(`Memorr mirror schema mismatch: ${memorrMirror.schema}`);
}
if (memorrSource.schema !== 'memorr.sleep.status.v1') {
  throw new Error(`Memorr source schema mismatch: ${memorrSource.schema}`);
}
if (actorrSnapshot.schema !== 'actorr.c2.operator_snapshot.v1' || actorrSnapshot.ok !== true) {
  throw new Error(`Actorr snapshot proof invalid: ${JSON.stringify(actorrSnapshot).slice(0, 400)}`);
}
if (actorrClient.ok !== true || !actorrClient.latest_version) {
  throw new Error(`Actorr client proof invalid: ${JSON.stringify(actorrClient).slice(0, 400)}`);
}
if (ownerActions.summary?.go_no_go !== 'no_go' || ownerActions.summary?.ready_for_action_dispatch !== false) {
  throw new Error(`owner action readiness should remain no_go: ${JSON.stringify(ownerActions.summary)}`);
}
if (ownerActions.summary?.action_ready_count !== 0) {
  throw new Error(`owner action readiness unexpectedly has action-ready owners: ${JSON.stringify(ownerActions.summary)}`);
}
if ((ownerActions.owners || []).some(owner => owner.comparison?.runtime_proof_status !== 'missing')) {
  throw new Error('an owner reports source-native compare proof unexpectedly present');
}
if ((ownerActions.owners || []).some(owner => owner.rollback?.execution_proof_status !== 'missing')) {
  throw new Error('an owner reports rollback execution proof unexpectedly present');
}
if ((ownerActions.owners || []).some(owner => owner.rollback?.preserves_owner_truth !== true)) {
  throw new Error('an owner rollback fallback does not preserve owner truth');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1700 } });
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
await page.getByRole('heading', { name: 'Owner Panel Retirement Board' }).waitFor({ timeout: 30000 });
await page.getByRole('heading', { name: 'Owner Panels vs Console Mirrors' }).waitFor({ timeout: 30000 });

const retirementPanel = page.locator('.owner-retirement-panel');
await retirementPanel.getByText('Actorr Operator Surface').waitFor({ timeout: 15000 });
await retirementPanel.getByText(`${actorrClient.latest_version} latest`).waitFor({ timeout: 15000 });
await retirementPanel.getByText('source-native compare').waitFor({ timeout: 15000 });
await retirementPanel.getByText('rollback execution').waitFor({ timeout: 15000 });
await retirementPanel.getByText('owner truth fallback').waitFor({ timeout: 15000 });
await retirementPanel.getByText('retire actions ready').waitFor({ timeout: 15000 });
await retirementPanel.getByText(`${ownerActions.summary.owner_count} owner proofs required`).waitFor({ timeout: 15000 });
await retirementPanel.getByText('execution proof required').waitFor({ timeout: 15000 });
await retirementPanel.getByText(`${ownerActions.summary.owner_count}/${ownerActions.summary.owner_count}`).waitFor({ timeout: 15000 });
await retirementPanel.getByText('no retire controls enabled').waitFor({ timeout: 15000 });
await retirementPanel.getByText('owner compare proof missing').waitFor({ timeout: 15000 });
await retirementPanel.getByText('mutating media/action soak missing').waitFor({ timeout: 15000 });
await retirementPanel.screenshot({ path: screenshotPath });

const parityPanel = page.locator('.owner-parity-panel');
await parityPanel.getByText('Memorr OCR Retry').waitFor({ timeout: 15000 });
await parityPanel.getByText('Actorr Media Action').waitFor({ timeout: 15000 });
await parityPanel.getByText('archive ok').waitFor({ timeout: 15000 });
await parityPanel.getByText('operator snapshot live').waitFor({ timeout: 15000 });
await parityPanel.getByText('Actorr action contract absent').waitFor({ timeout: 15000 });
await parityPanel.screenshot({ path: parityScreenshotPath });

const proof = await page.evaluate(() => ({
  retirementCards: document.querySelectorAll('.owner-retirement-panel .retirement-card').length,
  ledgerCards: document.querySelectorAll('.owner-retirement-panel .compare-rollback-ledger button').length,
  parityCards: document.querySelectorAll('.owner-parity-panel .parity-card').length,
  actionCards: document.querySelectorAll('.owner-parity-panel .action-authority-card').length,
  enabledDangerButtons: Array.from(document.querySelectorAll('.owner-retirement-panel button, .owner-parity-panel button'))
    .map(button => ({ text: button.textContent?.trim() || '', disabled: button.disabled }))
    .filter(button => /^(promote|retire|rollback|apply|save|dispatch|execute|run)$/i.test(button.text) && !button.disabled),
  retirementText: document.querySelector('.owner-retirement-panel')?.textContent || '',
  parityText: document.querySelector('.owner-parity-panel')?.textContent || ''
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (browserFailures.length) {
  throw new Error(browserFailures.join('\n'));
}
if (proof.retirementCards < 7 || proof.ledgerCards !== 4 || proof.parityCards < 6 || proof.actionCards < 8) {
  throw new Error(`unexpected card counts: ${JSON.stringify(proof)}`);
}
if (proof.enabledDangerButtons.length) {
  throw new Error(`unexpected enabled owner retire/action controls: ${JSON.stringify(proof.enabledDangerButtons)}`);
}
for (const stale of ['operator snapshot unavailable', 'memorr.status missing on Bus', 'Memorr status source 404']) {
  if (proof.retirementText.includes(stale) || proof.parityText.includes(stale)) {
    throw new Error(`stale blocker still visible: ${stale}`);
  }
}

console.log(`owner retirement compare regression: ok memorr_emails=${memorrArchive.email_count} actorr_version=${actorrClient.latest_version} compare_missing=${ownerActions.summary.owner_count} rollback_missing=${ownerActions.summary.owner_count} blocked_actions=${ownerActions.summary.blocked_action_count} ledger_cards=${proof.ledgerCards} screenshots=${screenshotPath},${parityScreenshotPath}`);
