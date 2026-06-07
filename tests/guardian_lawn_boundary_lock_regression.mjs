import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-guardian-lawn-boundary-lock.png';

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

async function postJsonAbsolute(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error(`${url} returned non-JSON HTTP ${response.status}: ${String(err)}`);
  }
  return { response, json };
}

async function source(target) {
  const failures = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const json = await getJson(`/api/console/source?target=${encodeURIComponent(target)}&logger_evidence=0`);
    if (json.schema !== 'amber.console.source_detail.v1') {
      throw new Error(`${target} source schema mismatch: ${json.schema}`);
    }
    if (json.data_plane !== 'amber_bus_only') {
      throw new Error(`${target} source data plane mismatch: ${json.data_plane}`);
    }
    if (json.ok && json.http_status === 200) {
      return { payload: json.payload || {}, attempts: attempt, failures };
    }
    failures.push({ attempt, http_status: json.http_status, duration_ms: json.duration_ms, error: json.error || json.payload });
    await new Promise(resolve => setTimeout(resolve, 400 * attempt));
  }
  throw new Error(`${target} did not recover after retries: ${JSON.stringify(failures)}`);
}

const health = await getJson('/health');
if (!health.ok || health.data_plane !== 'amber_bus_only') {
  throw new Error(`health gate failed: ${JSON.stringify(health)}`);
}

const outlineRead = await source('guardian_lawn_outline');
const outline = outlineRead.payload;
const savedBoundary = outline.saved_boundary || outline.current_boundary || [];
const guardBoundary = outline.guard_boundary || outline.live_boundary || [];
if (outline.schema !== 'guardian.http_engine.action.v1') throw new Error(`outline schema mismatch: ${outline.schema}`);
if (outline.action !== 'lawn_outline_get') throw new Error(`outline action mismatch: ${outline.action}`);
if (!Array.isArray(savedBoundary) || savedBoundary.length < 10) throw new Error(`saved boundary too small: ${savedBoundary.length}`);
if (!Array.isArray(guardBoundary) || guardBoundary.length < 3) throw new Error(`guard boundary too small: ${guardBoundary.length}`);
if (outline.outline_state?.schema !== 'guardian.lawn_outline.v1') throw new Error(`outline_state schema mismatch: ${outline.outline_state?.schema}`);
if (Number(outline.outline_state?.point_count || 0) !== savedBoundary.length) {
  throw new Error(`outline point_count ${outline.outline_state?.point_count} does not match saved boundary ${savedBoundary.length}`);
}

const visionRead = await source('guardian_lawn_vision');
const vision = visionRead.payload;
const attrs = vision.attributes || {};
if (vision.entity_id !== 'sensor.lawn_poo_detection') throw new Error(`vision entity mismatch: ${vision.entity_id}`);
if (!attrs.scenario_id || !attrs.scenario_label) throw new Error('vision scenario metadata missing');
if (!Array.isArray(attrs.hazard_boxes)) throw new Error('vision hazard_boxes is not an array');
if (attrs.ok !== true) throw new Error(`vision ok drifted: ${attrs.ok}`);
if (!String(attrs.vision_preview_url || '').includes('guardian_lawn_vision')) {
  throw new Error(`vision preview URL missing expected owner image reference: ${attrs.vision_preview_url}`);
}
const frameAgeHours = attrs.when_utc ? (Date.now() - Date.parse(attrs.when_utc)) / 3600000 : null;
if (frameAgeHours == null || !Number.isFinite(frameAgeHours) || frameAgeHours < 24) {
  throw new Error(`expected current Guardian lawn frame to be stale for this proof; age_hours=${frameAgeHours}`);
}

const localImageResponse = await fetch(`${baseUrl}/local/guardian_lawn_vision_last.jpg`, { cache: 'no-store' });
if (localImageResponse.status !== 404) {
  throw new Error(`Console unexpectedly serves direct local lawn image: HTTP ${localImageResponse.status}`);
}
const imageBusProbe = await postJsonAbsolute(
  'http://amber-bus.amber.com:8080/api/bus/invoke/guardian.c2.ui.invoke',
  { method: 'GET', path: '/local/guardian_lawn_vision_last.jpg' }
);
if (imageBusProbe.response.status !== 404 || imageBusProbe.json?.error !== 'unsupported_ui_route') {
  throw new Error(`Guardian image Bus route unexpectedly changed: HTTP ${imageBusProbe.response.status} ${JSON.stringify(imageBusProbe.json)}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1500 } });
const failures = [];
const offHostRequests = [];
const sourceRequests = [];
const forbiddenImageRequests = [];

page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.includes('/api/console/source?')) sourceRequests.push(url);
  if (url.includes('/local/guardian_lawn_vision_last.jpg')) forbiddenImageRequests.push(url);
  if (url.startsWith(baseUrl) || url.startsWith('data:')) return;
  offHostRequests.push(url);
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.getByRole('heading', { name: 'Camera Boundary + Hazard Vision' }).waitFor({ timeout: 30000 });
const panel = page.locator('.lawn-panel');
await panel.locator('.lawn-canvas svg').waitFor({ timeout: 15000 });
await panel.locator('.lawn-camera-strip').waitFor({ timeout: 15000 });
await panel.locator('.preview-boundary-point').first().waitFor({ timeout: 45000 });
await panel.getByText('owner frame reference present').waitFor({ timeout: 15000 });
await panel.getByText('image proxy pending').waitFor({ timeout: 15000 });
await panel.getByRole('heading', { name: 'Annotated Image Proxy Blocker' }).waitFor({ timeout: 15000 });
await panel.getByText('owner frame reference', { exact: true }).waitFor({ timeout: 15000 });
await panel.getByText('Bus image proxy', { exact: true }).waitFor({ timeout: 15000 });
await panel.getByText('proxy route pending').waitFor({ timeout: 15000 });
await panel.getByText('direct browser image', { exact: true }).waitFor({ timeout: 15000 });
await panel.getByText('blocked by policy').waitFor({ timeout: 15000 });
await panel.getByText('save and rollback', { exact: true }).waitFor({ timeout: 15000 });
await panel.getByText('local preview only').waitFor({ timeout: 15000 });
await panel.getByText('preview metadata ok').waitFor({ timeout: 15000 });
await panel.getByText('stale frame').waitFor({ timeout: 15000 });
await panel.getByText('owner save gated').first().waitFor({ timeout: 15000 });
await panel.getByText('mow block').waitFor({ timeout: 15000 });
await panel.getByText('hazard boxes', { exact: true }).waitFor({ timeout: 15000 });
await panel.locator('.router-chip').filter({ hasText: /^hazard / }).first().waitFor({ timeout: 15000 });

const saveGated = panel.getByRole('button', { name: 'Save gated', exact: true });
await saveGated.waitFor({ timeout: 15000 });
if (!(await saveGated.isDisabled())) throw new Error('Guardian lawn owner save gate is enabled');

const beforePreviewCount = await panel.locator('.preview-boundary-point').count();
if (beforePreviewCount !== savedBoundary.length) {
  throw new Error(`preview point count ${beforePreviewCount} does not match owner boundary ${savedBoundary.length}`);
}

const addPoint = panel.getByRole('button', { name: 'Add point' });
if (!(await addPoint.isEnabled())) throw new Error('Add point local preview control is disabled');
await addPoint.click();
await panel.getByText('preview changed').waitFor({ timeout: 15000 });

const resetPreview = panel.getByRole('button', { name: 'Reset preview' });
if (!(await resetPreview.isEnabled())) throw new Error('Reset preview did not enable after local-only preview edit');

const afterPreviewCount = await panel.locator('.preview-boundary-point').count();
if (afterPreviewCount !== beforePreviewCount + 1) {
  throw new Error(`Add point did not update local preview count: before=${beforePreviewCount} after=${afterPreviewCount}`);
}

const proof = await panel.evaluate(element => ({
  text: element.textContent || '',
  guardPolygons: element.querySelectorAll('.guard-boundary').length,
  savedPolygons: element.querySelectorAll('.saved-boundary').length,
  previewPolygons: element.querySelectorAll('.preview-boundary').length,
  previewPoints: element.querySelectorAll('.preview-boundary-point').length,
  cameraStrip: element.querySelectorAll('.lawn-camera-strip').length,
  cameraReadoutCells: element.querySelectorAll('.lawn-camera-readout div').length,
  imageContractCards: element.querySelectorAll('.lawn-image-contract-card').length,
  imageContractAttrs: {
    proxyPending: element.querySelector('.lawn-image-contract-ledger')?.getAttribute('data-image-proxy-pending'),
    directImageBlocked: element.querySelector('.lawn-image-contract-ledger')?.getAttribute('data-direct-image-blocked'),
    saveGated: element.querySelector('.lawn-image-contract-ledger')?.getAttribute('data-save-gated'),
    ownerFrameRef: element.querySelector('.lawn-image-contract-ledger')?.getAttribute('data-owner-frame-ref')
  },
  staleFrame: element.querySelectorAll('.lawn-camera-frame.stale').length,
  disabledSave: Array.from(element.querySelectorAll('button')).some(button => (button.textContent || '').trim() === 'Save gated' && button.disabled),
  executableActionButtons: Array.from(element.querySelectorAll('button')).map(button => ({
    text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: button.disabled
  })).filter(button => /^(save|apply|dispatch|execute|rollback|run)$/i.test(button.text) && !button.disabled)
}));

await panel.screenshot({ path: screenshotPath });
await browser.close();

if (offHostRequests.length) {
  throw new Error(`browser made off-host requests: ${[...new Set(offHostRequests)].join(', ')}`);
}
if (forbiddenImageRequests.length) {
  throw new Error(`browser requested direct owner/local image instead of Bus metadata: ${[...new Set(forbiddenImageRequests)].join(', ')}`);
}
if (failures.length) {
  throw new Error(failures.join('\n'));
}
if (proof.executableActionButtons.length) {
  throw new Error(`unexpected executable owner action buttons: ${JSON.stringify(proof.executableActionButtons)}`);
}
if (!proof.disabledSave) throw new Error('disabled Save gated button not found in lawn panel');
if (proof.guardPolygons < 1 || proof.savedPolygons < 1 || proof.previewPolygons < 1) {
  throw new Error(`loaded boundary polygons missing: ${JSON.stringify(proof)}`);
}
if (proof.cameraStrip < 1 || proof.cameraReadoutCells < 6) {
  throw new Error(`camera evidence strip incomplete: ${JSON.stringify(proof)}`);
}
if (proof.imageContractCards !== 4) {
  throw new Error(`image contract ledger incomplete: ${JSON.stringify(proof)}`);
}
if (
  proof.imageContractAttrs.proxyPending !== 'true' ||
  proof.imageContractAttrs.directImageBlocked !== 'true' ||
  proof.imageContractAttrs.saveGated !== 'true' ||
  proof.imageContractAttrs.ownerFrameRef !== 'present'
) {
  throw new Error(`image contract attributes drifted: ${JSON.stringify(proof.imageContractAttrs)}`);
}
if (proof.staleFrame < 1) {
  throw new Error(`camera stale visual class missing: ${JSON.stringify(proof)}`);
}
if (!proof.text.includes('preview changed') || !proof.text.includes('owner save gated')) {
  throw new Error('lawn panel did not show local preview change and owner save gate together');
}
for (const text of ['frame age', 'annotation', 'confidence', 'stale frame', 'image proxy pending', 'Annotated Image Proxy Blocker', 'proxy route pending', 'blocked by policy', 'Amber Bus-only data plane']) {
  if (!proof.text.includes(text)) throw new Error(`camera evidence strip missing text: ${text}`);
}

const lawnBackgroundRequests = [...new Set(sourceRequests.filter(url => {
  const parsed = new URL(url);
  return ['guardian_lawn_outline', 'guardian_lawn_vision'].includes(parsed.searchParams.get('target') || '');
}))];
const withoutFastPath = lawnBackgroundRequests.filter(url => {
  const parsed = new URL(url);
  return parsed.searchParams.get('logger_evidence') !== '0';
});
if (withoutFastPath.length) {
  throw new Error(`Guardian lawn background requests missing logger_evidence=0: ${withoutFastPath.join(', ')}`);
}
for (const target of ['guardian_lawn_outline', 'guardian_lawn_vision']) {
  if (!lawnBackgroundRequests.some(url => new URL(url).searchParams.get('target') === target)) {
    throw new Error(`Guardian lawn panel did not request ${target}`);
  }
}

console.log(`guardian lawn boundary lock regression: ok saved=${savedBoundary.length} guard=${guardBoundary.length} hazards=${attrs.hazard_boxes.length} render=owner_boundary_loaded camera_contract=unsupported_ui_route stale_frame=visible source_attempts=${outlineRead.attempts}/${visionRead.attempts} preview_after_local_add=${proof.previewPoints} screenshot=${screenshotPath}`);
