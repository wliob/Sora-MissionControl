import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('shared/verification/smc-live-browser-gate-csp-deploy');
fs.mkdirSync(outDir, { recursive: true });
const base = 'https://192.168.10.5:3443';
const badRequests = [];
const requests = [];
const consoleMessages = [];
const pageErrors = [];
const routes = [
  { name: 'team', path: '/team', screenshot: 'team.png' },
  { name: 'kanban', path: '/kanban', screenshot: 'kanban.png' },
  { name: 'office', path: '/office', screenshot: 'office.png' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('request', (request) => {
  const url = request.url();
  requests.push(url);
  try {
    const u = new URL(url);
    if (u.hostname === '192.168.10.5' && u.port === '3187') badRequests.push(url);
  } catch {}
});
page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));

const routeResults = [];
for (const route of routes) {
  const response = await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(route.name === 'office' ? 8000 : 4000);
  const text = await page.locator('body').innerText({ timeout: 10000 }).catch((err) => `TEXT_ERROR:${err.message}`);
  const canvasCount = await page.locator('canvas').count().catch(() => -1);
  const screenshotPath = path.join(outDir, route.screenshot);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  routeResults.push({ route: route.path, status: response?.status() ?? null, finalUrl: page.url(), canvasCount, textSample: text.slice(0, 1200), screenshotPath });
}
const scripts = await page.evaluate(() => Array.from(document.scripts).map((s) => s.src).filter(Boolean));
const fatalConsole = consoleMessages.filter((m) => /unsafe-eval|Refused to evaluate|ERR_CERT|Uncaught/i.test(m.text));
const networkTo3187 = requests.filter((url) => url.includes('192.168.10.5:3187'));
const summary = { base, routeResults, scripts, badRequests, networkTo3187, consoleCount: consoleMessages.length, fatalConsole, pageErrors };
const summaryPath = path.join(outDir, 'summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
await browser.close();

const failed = [];
if (!scripts.some((s) => s.includes('/assets/index-k2GobxlW.js'))) failed.push('expected built asset index-k2GobxlW.js not loaded');
if (badRequests.length) failed.push(`bad direct requests to 192.168.10.5:3187: ${badRequests.join(', ')}`);
if (pageErrors.length) failed.push(`page errors: ${pageErrors.join('\n---\n')}`);
if (fatalConsole.length) failed.push(`fatal console messages: ${fatalConsole.map((m) => m.text).join('\n---\n')}`);
const office = routeResults.find((r) => r.route === '/office');
if (!office || office.status !== 200 || office.canvasCount < 1) failed.push('office route did not render canvas');
console.log(JSON.stringify({ verdict: failed.length ? 'FAIL' : 'PASS', failed, summaryPath, screenshots: routeResults.map((r) => r.screenshotPath), summary }, null, 2));
process.exit(failed.length ? 1 : 0);
