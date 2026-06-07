import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-promotion-gate-proof.png';

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
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
if (health.endpoint_count < 57) {
  throw new Error(`unexpected source count: ${health.endpoint_count}`);
}

const ownerActions = await source('owner_action_readiness');
const windowsProof = await source('epic27_windows_runtime_proof');
const loggerRequestProof = await getJson('/api/console/logger-request-proof-depth');

if (ownerActions.summary?.go_no_go !== 'no_go' || ownerActions.summary?.action_ready_count !== 0) {
  throw new Error(`owner action readiness should remain no_go: ${JSON.stringify(ownerActions.summary)}`);
}
if ((ownerActions.owners || []).some(owner => owner.comparison?.runtime_proof_status !== 'missing')) {
  throw new Error('an owner reports source-native compare proof unexpectedly present');
}
if ((ownerActions.owners || []).some(owner => owner.rollback?.execution_proof_status !== 'missing')) {
  throw new Error('an owner reports rollback execution proof unexpectedly present');
}
if (loggerRequestProof.request_specific_ready !== false || loggerRequestProof.request_id_count !== 0 || loggerRequestProof.correlation_id_count !== 0) {
  throw new Error(`Logger request proof unexpectedly green: ${JSON.stringify(loggerRequestProof).slice(0, 500)}`);
}
if (windowsProof.status !== 'windows_runtime_execution_open' || windowsProof.final_l9_windows_runtime_proof_green !== false) {
  throw new Error(`Windows runtime proof unexpectedly green: ${JSON.stringify(windowsProof).slice(0, 500)}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1600 } });
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
await page.getByRole('heading', { name: 'Go / No-Go and Rollback Proof' }).waitFor({ timeout: 30000 });
const panel = page.locator('.promotion-panel');
await page.getByText('release slices not green').waitFor({ timeout: 15000 });
await page.getByText('rollback gates blocked').waitFor({ timeout: 15000 });
await panel.getByText('Owner Apply Rollback').waitFor({ timeout: 15000 });
await panel.getByText('Promote / Retire').waitFor({ timeout: 15000 });
const residualLedger = panel.locator('.residual-blocker-ledger');
for (const text of ['owner action dispatch', 'source-native compare', 'rollback execution', 'Logger request IDs', 'Windows runtime', 'retire controls']) {
  await residualLedger.getByText(text).waitFor({ timeout: 15000 });
}
await residualLedger.getByText(`${ownerActions.summary.blocked_action_count} blocked action owners`).waitFor({ timeout: 15000 });
await residualLedger.getByText(`${ownerActions.summary.owner_count}/${ownerActions.summary.owner_count} owner truth fallbacks`).waitFor({ timeout: 15000 });
await residualLedger.getByText('execution proof required').waitFor({ timeout: 15000 });
await residualLedger.getByText(/0 correlations · (blocked|unavailable)/).waitFor({ timeout: 30000 });
await residualLedger.getByText('windows_runtime_execution_open').waitFor({ timeout: 15000 });
await residualLedger.getByText('disabled until contracts green').waitFor({ timeout: 15000 });
const ownerContractMap = panel.locator('.owner-contract-map');
await ownerContractMap.getByRole('heading', { name: 'Owner Contract Dependency Map' }).waitFor({ timeout: 15000 });
await ownerContractMap.getByText(`${ownerActions.summary.owner_count + 2} contract dependencies open`).waitFor({ timeout: 15000 });
for (const text of ['guardian', 'memorr', 'veliai', 'logger', 'homeassistant', 'actorr', 'Logger targeted proof', 'Windows runtime']) {
  await ownerContractMap.getByText(text).first().waitFor({ timeout: 15000 });
}
await ownerContractMap.getByText('owner native compare proof missing').first().waitFor({ timeout: 15000 });
await ownerContractMap.getByText('owner preview contract missing').first().waitFor({ timeout: 15000 });
await ownerContractMap.getByText('0 request ids').waitFor({ timeout: 15000 });
await ownerContractMap.getByText(/0 correlations · (blocked|unavailable)/).waitFor({ timeout: 15000 });
await ownerContractMap.getByText('windows_runtime_execution_open').waitFor({ timeout: 15000 });

const openCount = await panel.evaluate(element => Number(element.getAttribute('data-promotion-open') || '0'));
if (openCount < 6) throw new Error(`promotion gate unexpectedly green: ${openCount}`);
const residualOpen = await panel.locator('.residual-blocker-ledger').evaluate(element => Number(element.getAttribute('data-residual-open') || '0'));
if (residualOpen !== 6) throw new Error(`residual blocker ledger unexpectedly green: ${residualOpen}`);
const ownerContractOpen = await ownerContractMap.evaluate(element => Number(element.getAttribute('data-owner-contract-open') || '0'));
if (ownerContractOpen !== ownerActions.summary.owner_count + 2) {
  throw new Error(`owner contract dependency map unexpectedly green: ${ownerContractOpen}`);
}
const proofChain = panel.locator('.promotion-proof-chain');
await proofChain.getByRole('heading', { name: 'Promotion Proof Chain Gap' }).waitFor({ timeout: 15000 });
await proofChain.getByText(`${ownerActions.summary.owner_count} prove-before-promote links open`).waitFor({ timeout: 15000 });
for (const text of ['source-native compare', 'preview/apply/verify', 'rollback execution', 'Logger identifiers', 'Windows runtime', 'promotion controls']) {
  await proofChain.getByText(text).waitFor({ timeout: 15000 });
}
await proofChain.getByText(`${ownerActions.summary.owner_count}/${ownerActions.summary.owner_count}`).first().waitFor({ timeout: 15000 });
await proofChain.getByText('owner preview, confirmation, apply endpoint, and verify proof required').waitFor({ timeout: 15000 });
await proofChain.getByText('execution proof required before any retire or dispatch path').waitFor({ timeout: 15000 });
await proofChain.getByText('0/0').waitFor({ timeout: 15000 });
await proofChain.getByText(/runtime observed=no · \d+ protected sources/).waitFor({ timeout: 15000 });
await proofChain.getByText('disabled until proof chain is green').waitFor({ timeout: 15000 });
const proofChainOpen = await proofChain.evaluate(element => Number(element.getAttribute('data-proof-chain-open') || '0'));
if (proofChainOpen !== ownerActions.summary.owner_count) {
  throw new Error(`proof chain unexpectedly green: ${proofChainOpen}`);
}
const proofChainControls = await proofChain.evaluate(element => Number(element.getAttribute('data-proof-chain-controls') || '0'));
if (proofChainControls !== 0) {
  throw new Error(`proof chain exposed controls: ${proofChainControls}`);
}

const proof = await panel.evaluate(element => ({
  residualCards: element.querySelectorAll('.residual-blocker-ledger button').length,
  ownerContractCards: element.querySelectorAll('.owner-contract-grid button').length,
  proofChainCards: element.querySelectorAll('.promotion-proof-chain-grid button').length,
  enabledDangerButtons: Array.from(element.querySelectorAll('button'))
    .map(button => ({ text: button.textContent?.trim() || '', disabled: button.disabled }))
    .filter(button => /^(promote|retire|rollback|apply|save|dispatch|execute|run)$/i.test(button.text) && !button.disabled)
}));
await proofChain.screenshot({ path: screenshotPath });

await panel.getByRole('button', { name: /Promote \/ Retire/ }).click();
await page.locator('.drawer.open').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('Owner Detail').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('epic26_tasks').waitFor({ timeout: 15000 });
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.residualCards !== 6) {
  throw new Error(`expected 6 residual blocker cards, saw ${proof.residualCards}`);
}
if (proof.ownerContractCards !== ownerActions.summary.owner_count + 2) {
  throw new Error(`expected ${ownerActions.summary.owner_count + 2} owner contract cards, saw ${proof.ownerContractCards}`);
}
if (proof.proofChainCards !== 6) {
  throw new Error(`expected 6 proof chain cards, saw ${proof.proofChainCards}`);
}
if (proof.enabledDangerButtons.length) {
  throw new Error(`unexpected enabled promotion/action controls: ${JSON.stringify(proof.enabledDangerButtons)}`);
}

console.log(`promotion gate regression: ok open=${openCount} residual_open=${residualOpen} owner_contract_open=${ownerContractOpen} proof_chain_open=${proofChainOpen} blocked_actions=${ownerActions.summary.blocked_action_count} request_ids=${loggerRequestProof.request_id_count} screenshot=${screenshotPath}`);
