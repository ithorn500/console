import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8095';
const screenshotPath = process.argv[3] || '/tmp/amber-console-react-smoke.png';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

const failures = [];
page.on('pageerror', error => failures.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') failures.push(message.text());
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.getByRole('heading', { name: 'Amber Console' }).waitFor({ timeout: 15000 });
await page.getByRole('heading', { name: 'System Activity Map' }).waitFor({ timeout: 15000 });
await page.getByRole('heading', { name: 'Live Capability, Policy, Provider, and Heat-Relief Map' }).waitFor({ timeout: 15000 });
await page.locator('.react-flow').first().waitFor({ timeout: 15000 });
await page.getByText('Active Backends').waitFor({ timeout: 15000 });
await page.getByText('Route Pressure').waitFor({ timeout: 15000 });
await page.getByRole('heading', { name: 'Mail, Memory, LSB, NeuFab, Veliai' }).waitFor({ timeout: 15000 });
await page.getByText('Exchange deliveries').waitFor({ timeout: 15000 });
await page.locator('.lifecycle-drill-stage').waitFor({ timeout: 15000 });
await page.getByText('Quarantine Review').waitFor({ timeout: 15000 });
await page.getByText('Memorr Email Timeline').waitFor({ timeout: 15000 });
await page.getByText('Exchange PIM Context').waitFor({ timeout: 15000 });
await page.locator('.topbar').screenshot({ path: screenshotPath });

await page.goto(`${baseUrl}/architecture/#diagrams`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.getByRole('heading', { name: 'Architecture Docs' }).waitFor({ timeout: 15000 });
await page.getByRole('heading', { name: 'Diagram Gallery' }).waitFor({ timeout: 15000 });
await page.locator('.diagram-item').getByRole('heading', { name: 'Amber Network Diagram Source Pack v2' }).waitFor({ timeout: 15000 });
await page.locator('.diagram-item').getByRole('heading', { name: 'Generated Gateway Monolith Current' }).waitFor({ timeout: 15000 });
const diagramCards = await page.locator('.diagram-item').count();
if (diagramCards < 29) {
  throw new Error(`architecture diagram gallery rendered ${diagramCards} cards; expected at least 29`);
}

await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`amber-console browser smoke: ok screenshot=${screenshotPath}`);
