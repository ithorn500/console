import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-memorr-evidence-lineage.png';

const sourceIds = [
  'memorr_archive',
  'memorr_mirror',
  'memorr_source',
  'memorr_exchange_backfill',
  'memorr_exchange_pim_context',
  'memorr_formulated_memory',
  'memorr_email_timeline'
];

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
    throw new Error(`${target} source detail schema mismatch: ${json?.schema}`);
  }
  if (json.data_plane !== 'amber_bus_only') {
    throw new Error(`${target} data plane drift: ${json.data_plane}`);
  }
  if (!json.ok || json.http_status !== 200) {
    throw new Error(`${target} not live: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json.payload || {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const payloads = Object.fromEntries(await Promise.all(sourceIds.map(async id => [id, await source(id)])));
const archive = payloads.memorr_archive;
const mirror = payloads.memorr_mirror;
const sleep = payloads.memorr_source;
const backfill = payloads.memorr_exchange_backfill;
const pim = payloads.memorr_exchange_pim_context;
const recall = payloads.memorr_formulated_memory;
const timeline = payloads.memorr_email_timeline;

if (archive.schema !== 'memorr.email_archive.status.v1' || Number(archive.email_count || 0) < 1) {
  throw new Error(`archive payload invalid: ${JSON.stringify(archive).slice(0, 400)}`);
}
if (mirror.schema !== 'memorr.processing.status.v1' || Number(mirror.ready_job_count || 0) < 1) {
  throw new Error(`mirror payload invalid: ${JSON.stringify(mirror).slice(0, 400)}`);
}
if (sleep.schema !== 'memorr.sleep.status.v1' || !sleep.latest_run_id) {
  throw new Error(`sleep payload invalid: ${JSON.stringify(sleep).slice(0, 400)}`);
}
if (backfill.schema !== 'memorr.exchange_backfill.status.v1' || backfill.exchange_mutation_allowed !== false) {
  throw new Error(`backfill payload invalid: ${JSON.stringify(backfill).slice(0, 400)}`);
}
if (pim.schema !== 'memorr.exchange_pim_context.status.v1' || pim.exchange_mutation_allowed !== false) {
  throw new Error(`PIM payload invalid: ${JSON.stringify(pim).slice(0, 400)}`);
}
if (recall.schema !== 'memorr.formulated_memory.recall.v1' || Number(recall.candidate_count || 0) < 1) {
  throw new Error(`recall payload invalid: ${JSON.stringify(recall).slice(0, 400)}`);
}
if (timeline.schema !== 'memorr.email_timeline_retrieval.v1' || timeline.privacy?.raw_payload_available !== false) {
  throw new Error(`timeline payload invalid: ${JSON.stringify(timeline).slice(0, 400)}`);
}

const lineageCandidate = asArray(recall.candidates).find(candidate => candidate.gemma_index_ref || candidate.memorr_asset_refs || text(candidate.namespace).includes('exchange_pim')) || asArray(recall.candidates)[0] || {};
const lineageArtifact = text(lineageCandidate.artifact_ref);
const lineagePim = asArray(pim.contextual_memories).find(row => text(row.memory_ref) === lineageArtifact) || asArray(pim.contextual_memories).find(row => row.memory_ref) || {};
const gemmaIndex = text(lineagePim.gemma_index_ref || lineageCandidate.gemma_index_ref || 'absent');
const rawVisible = Boolean(
  timeline.privacy?.raw_payload_available ||
  timeline.privacy?.raw_mime_visible ||
  pim.raw_payload_available_to_gemma ||
  backfill.raw_payload_stored ||
  backfill.raw_filter_output_visible_to_intelligence
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1800 } });
const failures = [];
const offHostRequests = [];
const memorrSourceRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.startsWith(baseUrl)) {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/console/source' && (parsed.searchParams.get('target') || '').startsWith('memorr_')) {
      memorrSourceRequests.push({
        target: parsed.searchParams.get('target'),
        loggerEvidence: parsed.searchParams.get('logger_evidence')
      });
    }
    return;
  }
  if (url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
const panel = page.locator('.memorr-panel');
await panel.getByRole('heading', { name: 'Provenance Workbench' }).waitFor({ timeout: 30000 });
const lineage = panel.locator('.memorr-lineage-stage');
await lineage.getByRole('heading', { name: 'Memorr Evidence Lineage' }).waitFor({ timeout: 30000 });
await page.waitForFunction(
  ({ liveCount, rawState }) => {
    const node = document.querySelector('.memorr-lineage-stage');
    return node?.getAttribute('data-memorr-lineage-steps') === '7' &&
      node?.getAttribute('data-memorr-lineage-live') === String(liveCount) &&
      node?.getAttribute('data-memorr-lineage-raw-visible') === String(rawState);
  },
  { liveCount: sourceIds.length, rawState: rawVisible },
  { timeout: 30000 }
);

for (const label of ['Exchange Capture', 'Archive Boundary', 'Semantic Mirror', 'Formulated Memory', 'PIM Promotion', 'Privacy Boundary', 'Sleep Lifecycle']) {
  await lineage.getByRole('button', { name: new RegExp(label) }).waitFor({ timeout: 15000 });
}
await lineage.getByText(`${archive.email_count} archived emails`).waitFor({ timeout: 15000 });
await lineage.getByText(`${mirror.ready_job_count} ready jobs`).waitFor({ timeout: 15000 });
await lineage.getByText(`${recall.candidate_count} candidates`).first().waitFor({ timeout: 15000 });
await lineage.getByText(`${pim.promoted_memory_count} promoted`).waitFor({ timeout: 15000 });
await lineage.getByText('raw payload hidden').first().waitFor({ timeout: 15000 });
await lineage.getByText('Gateway index ref only').waitFor({ timeout: 15000 });
await lineage.getByText('actions still owner-gated').waitFor({ timeout: 15000 });
if (lineageArtifact) {
  await lineage.getByText(lineageArtifact.slice(0, 24)).waitFor({ timeout: 15000 });
}
if (gemmaIndex !== 'absent') {
  await lineage.getByText(gemmaIndex.slice(0, 24)).waitFor({ timeout: 15000 });
}
await lineage.screenshot({ path: screenshotPath });
const backgroundMemorrSourceRequests = memorrSourceRequests.slice();

await lineage.getByRole('button', { name: /Formulated Memory/ }).click();
await page.locator('.drawer.open').waitFor({ timeout: 15000 });
await page.locator('.drawer.open').getByText('memorr_formulated_memory').waitFor({ timeout: 15000 });

const proof = await page.evaluate(() => ({
  cardCount: document.querySelectorAll('.memorr-lineage-stage .memorr-lineage-card').length,
  enabledExecutableControls: Array.from(document.querySelectorAll('.memorr-panel button'))
    .map(button => ({ text: button.textContent?.trim() || '', disabled: button.disabled }))
    .filter(button => /^(promote|retire|rollback|apply|save|dispatch|execute|run|delete|export|scrub|repair|retry)$/i.test(button.text) && !button.disabled)
}));
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.cardCount !== 7) {
  throw new Error(`expected 7 lineage cards, rendered ${proof.cardCount}`);
}
if (proof.enabledExecutableControls.length) {
  throw new Error(`unexpected enabled Memorr action controls: ${JSON.stringify(proof.enabledExecutableControls)}`);
}
if (!backgroundMemorrSourceRequests.length || backgroundMemorrSourceRequests.some(request => request.loggerEvidence !== '0')) {
  throw new Error(`Memorr background source requests did not stay on logger_evidence=0: ${JSON.stringify(backgroundMemorrSourceRequests)}`);
}

console.log(`memorr evidence lineage regression: ok sources=${sourceIds.length} archive_emails=${archive.email_count} ready_jobs=${mirror.ready_job_count} candidates=${recall.candidate_count} promoted=${pim.promoted_memory_count} raw_visible=${rawVisible} screenshot=${screenshotPath}`);
