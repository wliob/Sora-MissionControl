import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SHARED = '/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/verification';
mkdirSync(SHARED, { recursive: true });

const HTTPS = 'https://localhost:13443';
const HTTP = 'http://localhost:13187';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);

async function shot(page, name, url) {
  console.log(`Navigating: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 }).catch(e => console.log(`  goto warning: ${e.message}`));
  await page.waitForTimeout(2000);
  const path = join(SHARED, `smc-cloud-https-${name}-${TS}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  -> ${path}`);
  return path;
}

async function checkCanvas(page) {
  const info = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    return {
      canvasCount: canvases.length,
      officeText: document.body.innerText.includes('Office canvas offline') ? 'OFFLINE' : 
                  document.body.innerText.includes('Office') ? 'has Office text' : 'no Office text',
      hasPixiError: document.body.innerText.includes('unsafe-eval') || document.body.innerText.includes('pixi'),
    };
  });
  console.log(`  Canvas check: ${JSON.stringify(info)}`);
  return info;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
  });
  
  try {
    // HTTPS lane - Team
    const page = await context.newPage();
    await shot(page, 'team-desktop', `${HTTPS}/team`);
    
    // HTTPS lane - Kanban with Office panel
    await shot(page, 'kanban-desktop', `${HTTPS}/kanban`);
    const kanbanCanvas = await checkCanvas(page);
    
    // HTTPS lane - Office full screen
    await page.goto(`${HTTPS}/office`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const officePath = join(SHARED, `smc-cloud-https-office-desktop-${TS}.png`);
    await page.screenshot({ path: officePath, fullPage: false });
    console.log(`  -> ${officePath}`);
    const officeCanvas = await checkCanvas(page);
    
    // HTTPS lane - Admin (auth state)
    await shot(page, 'admin-desktop', `${HTTPS}/admin`);
    
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await shot(page, 'kanban-mobile', `${HTTPS}/kanban`);
    await shot(page, 'team-mobile', `${HTTPS}/team`);
    await shot(page, 'admin-mobile', `${HTTPS}/admin`);
    
    // HTTP locked lane
    const page2 = await context.newPage();
    await shot(page2, 'http-locked-kanban', `${HTTP}/kanban`);
    await shot(page2, 'http-locked-admin', `${HTTP}/admin`);
    
    console.log('\n=== RESULTS ===');
    console.log(`Kanban canvas: ${JSON.stringify(kanbanCanvas)}`);
    console.log(`Office canvas: ${JSON.stringify(officeCanvas)}`);
    console.log('All screenshots captured.');
  } finally {
    await browser.close();
  }
})();
