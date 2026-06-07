import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-owner-action-readiness.png';

const response = await fetch(`${baseUrl}/api/console/source?target=owner_action_readiness&logger_evidence=0`, { cache: 'no-store' });
const source = await response.json();
if (!response.ok) throw new Error(`owner_action_readiness -> HTTP ${response.status}`);
if (source.schema !== 'amber.console.source_detail.v1') throw new Error(`source schema mismatch: ${source.schema}`);
if (source.data_plane !== 'amber_bus_only') throw new Error(`source data plane mismatch: ${source.data_plane}`);
if (!source.ok || source.http_status !== 200) throw new Error(`source not ok: ${JSON.stringify(source).slice(0, 500)}`);

const payload = source.payload;
if (payload.schema !== 'amber.owner_action.readiness.v1') throw new Error(`payload schema mismatch: ${payload.schema}`);
if (payload.data_plane !== 'amber_bus_only') throw new Error(`payload data plane mismatch: ${payload.data_plane}`);
if (payload.summary?.go_no_go !== 'no_go') throw new Error(`go/no-go should remain no_go: ${payload.summary?.go_no_go}`);
if (payload.summary?.ready_for_action_dispatch !== false) throw new Error('action dispatch must remain blocked');
if (payload.summary?.mutation_allowed !== false) throw new Error('mutation must remain blocked');
if (Number(payload.summary?.owner_count || 0) < 6) throw new Error(`too few owners: ${payload.summary?.owner_count}`);
if (Number(payload.summary?.blocked_action_count || 0) < 5) throw new Error(`too few blocked action owners: ${payload.summary?.blocked_action_count}`);
if (payload.source_fixture?.status !== 'fixture_ready_not_runtime' || payload.source_fixture?.non_runtime_contract !== true) {
  throw new Error(`owner action contract should remain fixture/not runtime: ${JSON.stringify(payload.source_fixture)}`);
}
if (payload.summary?.action_ready_count !== 0) throw new Error(`action ready count should stay zero: ${payload.summary?.action_ready_count}`);
if (payload.summary?.raw_private_payload_visible !== false) throw new Error('raw private payload became visible');
if (payload.owners.some(owner => owner.action_dispatch_allowed || owner.action_ready)) {
  throw new Error('owner readiness projection marked an action owner ready');
}
if (payload.owners.some(owner => owner.rollback?.execution_proof_status !== 'missing')) {
  throw new Error('an owner reports rollback execution proof unexpectedly present');
}
if (payload.owners.some(owner => owner.comparison?.runtime_proof_status !== 'missing')) {
  throw new Error('an owner reports owner-native compare proof unexpectedly present');
}
if (payload.owners.some(owner => owner.rollback?.preserves_owner_truth !== true)) {
  throw new Error('an owner fallback no longer preserves owner truth');
}

for (const ownerId of ['guardian', 'memorr', 'veliai', 'logger', 'actorr']) {
  const owner = payload.owners.find(item => item.owner_id === ownerId);
  if (!owner) throw new Error(`missing owner ${ownerId}`);
  for (const gate of ['owner_preview_contract_missing', 'apply_endpoint_not_proven', 'rollback_execution_proof_missing', 'logger_action_evidence_missing']) {
    if (!owner.missing_gates.includes(gate)) throw new Error(`${ownerId} missing gate ${gate}`);
  }
}

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
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Owner action readiness and rollback proof' }).waitFor({ timeout: 30000 });
const panel = page.locator('.owner-action-readiness-panel');
await panel.getByText('owner_preview_contract_missing'.replaceAll('_', ' ')).first().waitFor({ timeout: 30000 });
await panel.getByText('runtime action contract').waitFor({ timeout: 30000 });
await panel.getByText('not live').waitFor({ timeout: 30000 });
await panel.getByText('fixture_ready_not_runtime').first().waitFor({ timeout: 30000 });
await panel.getByText('dispatch owners ready').waitFor({ timeout: 30000 });
await panel.getByText('0/6').waitFor({ timeout: 30000 });
await panel.getByText('compare proof missing').first().waitFor({ timeout: 30000 });
await panel.getByText('rollback proof missing').first().waitFor({ timeout: 30000 });
await panel.getByText('owner truth fallback').waitFor({ timeout: 30000 });
const handoffMatrix = panel.locator('.action-handoff-matrix');
await handoffMatrix.getByRole('heading', { name: 'Preview, apply, verify, rollback, and proof contracts' }).waitFor({ timeout: 30000 });
for (const text of ['source-native compare', 'preview', 'confirm', 'apply', 'verify', 'rollback', 'Logger proof']) {
  await handoffMatrix.getByText(text).first().waitFor({ timeout: 30000 });
}
await handoffMatrix.getByText('owner runtime parity proof').waitFor({ timeout: 30000 });
await handoffMatrix.getByText('owner preview contract').waitFor({ timeout: 30000 });
await handoffMatrix.getByText('operator confirmation contract').waitFor({ timeout: 30000 });
await handoffMatrix.getByText('owner apply endpoint proof').waitFor({ timeout: 30000 });
await handoffMatrix.getByText('post-apply verification proof').waitFor({ timeout: 30000 });
await handoffMatrix.getByText('rollback execution proof').waitFor({ timeout: 30000 });
await handoffMatrix.getByText('targeted action evidence').waitFor({ timeout: 30000 });
await handoffMatrix.getByText('6/6').first().waitFor({ timeout: 30000 });
await panel.screenshot({ path: screenshotPath });
const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  cards: element.querySelectorAll('.owner-action-card').length,
  contractCards: element.querySelectorAll('.action-contract-card').length,
  handoffCards: element.querySelectorAll('.action-handoff-grid button').length,
  handoffOpen: Number(element.querySelector('.action-handoff-matrix')?.getAttribute('data-action-handoff-open') || '0'),
  exactExecutableButtons: Array.from(element.querySelectorAll('button')).map(button => ({
    text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: button.disabled
  })).filter(button => /^(start|stop|restart|apply|save|promote|retire|rollback|dispatch|execute|run|load|unload|retry|silence|ack|nack|drain|kill)$/i.test(button.text) && !button.disabled)
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.cards < 6) {
  throw new Error(`too few owner readiness cards rendered: ${proof.cards}`);
}
if (proof.contractCards < 7) {
  throw new Error(`too few contract ledger cards rendered: ${proof.contractCards}`);
}
if (proof.handoffCards !== 7) {
  throw new Error(`expected 7 handoff phase cards, saw ${proof.handoffCards}`);
}
if (proof.handoffOpen !== 7) {
  throw new Error(`handoff matrix unexpectedly green: ${proof.handoffOpen}`);
}
if (proof.exactExecutableButtons.length) {
  throw new Error(`owner action panel exposed executable controls: ${JSON.stringify(proof.exactExecutableButtons)}`);
}
for (const text of ['no_go', 'dispatch ready', 'blocked actions', 'owner native compare proof missing', 'rollback execution proof missing', 'runtime action contract', 'not live', 'dispatch disabled', 'no owner apply endpoint proven', 'owner-native visual/runtime compare', 'execution proof required before actions', 'raw payload hidden', 'Preview, apply, verify, rollback, and proof contracts', 'owner preview contract', 'targeted action evidence']) {
  if (!proof.text.includes(text)) throw new Error(`panel missing text: ${text}`);
}

console.log(`owner action readiness regression: ok owners=${payload.summary.owner_count} blocked=${payload.summary.blocked_action_count} runtime_ready=${payload.summary.action_ready_count} contract_cards=${proof.contractCards} handoff_open=${proof.handoffOpen} screenshot=${screenshotPath}`);
