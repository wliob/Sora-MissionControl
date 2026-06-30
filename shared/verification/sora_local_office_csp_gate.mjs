import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('shared/verification/sora-local-office-csp-20260630');
fs.mkdirSync(outDir, { recursive: true });
const base = 'http://127.0.0.1:3187';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleMessages = [];
const pageErrors = [];
const requests = [];
page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', err => pageErrors.push(String(err.stack || err.message || err)));
page.on('request', req => requests.push(req.url()));
const response = await page.goto(`${base}/office`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
const canvasCount = await page.locator('canvas').count();
const textSample = (await page.locator('body').innerText()).slice(0, 1800);
const csp = response?.headers()['content-security-policy'] || '';
const scripts = await page.$$eval('script[src]', nodes => nodes.map(n => n.src));
const screenshotPath = path.join(outDir, 'office.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
await browser.close();
const unsafeEvalConsole = consoleMessages.filter(m => /unsafe-eval|GameRuntime init failed/i.test(m.text));
const networkToTower3187 = requests.filter(u => /192\.168\.10\.5:3187/.test(u));
const summary = {
  base,
  status: response?.status() ?? null,
  finalUrl: page.url(),
  canvasCount,
  csp,
  cspHasUnsafeEval: /unsafe-eval/.test(csp),
  scripts,
  networkToTower3187,
  unsafeEvalConsole,
  pageErrors,
  consoleCount: consoleMessages.length,
  textSample,
  screenshotPath,
  verdict: (response?.status() === 200 && canvasCount >= 1 && !/unsafe-eval/.test(csp) && unsafeEvalConsole.length === 0 && pageErrors.length === 0 && networkToTower3187.length === 0) ? 'PASS' : 'FAIL',
};
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.verdict !== 'PASS') process.exit(1);
