import { expect, test, type Locator, type Page } from '@playwright/test';

const adminKey = process.env.MISSION_CONTROL_ADMIN_PROXY_KEY ?? 'playwright-admin-token';
const honestBoardState = /Authentication required|Live Hermes Kanban snapshot|Kanban REST bridge is currently unavailable|Waiting for the first verified Kanban snapshot/i;
const officeFallbackState = /Office canvas offline|WebGL unavailable|Office assets unavailable/i;

function missionTitle(page: Page, name: string): Locator {
  return page.locator('header .dashboard-header-title').filter({ hasText: new RegExp(`^${name}$`) });
}

function railButton(page: Page, label: string): Locator {
  return page.getByRole('button', { name: label, exact: true });
}

async function expectOfficeCanvasOrFallback(container: Locator) {
  const canvas = container.locator('canvas').first();
  if (await canvas.count()) {
    await expect(canvas).toBeVisible();
    return;
  }
  await expect(container.getByRole('heading', { name: officeFallbackState })).toBeVisible();
}

// ────────────────────────────────────────────────────────────────────
// 1. Navigation tests
// ────────────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('default route / redirects to /team', async ({ page }) => {
    await page.goto('/');
    // URL should be normalized to /team
    await expect(page).toHaveURL(/\/team/);
    await expect(missionTitle(page, 'Team')).toBeVisible();
  });

  test('unknown route redirects to /team', async ({ page }) => {
    await page.goto('/nonexistent-route-xyz');
    await expect(page).toHaveURL(/\/team/);
    await expect(missionTitle(page, 'Team')).toBeVisible();
  });

  const coreScreenRoutes = [
    { path: '/team', label: 'Team' },
    { path: '/office', label: 'Office' },
    { path: '/activity', label: 'Activity' },
    { path: '/projects', label: 'Projects' },
    { path: '/decisions', label: 'Decisions' },
    { path: '/calendar', label: 'Calendar' },
    { path: '/kanban', label: 'Kanban' },
  ];

  for (const { path, label } of coreScreenRoutes) {
    test(`navigates to ${path} via URL and updates heading`, async ({ page }) => {
      await page.goto(path);
      await expect(missionTitle(page, label)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
    });
  }

  test('all 7 core screens reachable via nav rail clicks', async ({ page }) => {
    await page.goto('/team');

    const screenLabels = ['TEAM', 'OFFICE', 'ACTIVITY', 'PROJECTS', 'DECISIONS', 'CALENDAR', 'KANBAN'];
    for (const label of screenLabels) {
      const navButton = railButton(page, label);
      await navButton.click();
      // Verify the button becomes active
      await expect(navButton).toHaveAttribute('data-active', 'true');
    }
  });

  test('desktop viewport shows nav rail with HERMES/AGENT branding', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'desktop-only test');
    await page.goto('/team');
    await expect(page.locator('.dashboard-brand-wordmark').first()).toContainText('HERMES');
    await expect(page.locator('.dashboard-brand-submark')).toContainText('AGENT');
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Team screen tests
// ────────────────────────────────────────────────────────────────────

test.describe('Team screen', () => {
  test('renders agent cards for all 7 agents', async ({ page }) => {
    await page.goto('/team');
    // Six department leads render as lead cards; Sora renders as the central Conductor Station.
    const agentIds = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa', 'rain'];
    for (const id of agentIds) {
      await expect(page.locator(`[data-agent="${id}"]`)).toBeVisible();
    }
    await expect(page.locator('.sora-station')).toBeVisible();
    // Should have exactly 6 lead cards + 1 Sora conductor station
    await expect(page.locator('.lead-card')).toHaveCount(6);
  });

  test('Sora Conductor Station is present', async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('.sora-station')).toBeVisible();
    await expect(page.locator('.sora-station')).toContainText('SORA');
    await expect(page.locator('.sora-station')).toContainText('CONDUCTING');
  });

  test('agent names are visible on lead cards', async ({ page }) => {
    await page.goto('/team');
    const agentNames = ['Cloud', 'Biscuit', 'Korra', 'Lelouch', 'Tifa', 'Rain'];
    for (const name of agentNames) {
      await expect(page.locator('.lead-card__name', { hasText: name })).toBeVisible();
    }
  });

  test('freshness badges are visible on agent cards', async ({ page }) => {
    await page.goto('/team');
    // Freshness badges show on each lead card
    const freshnessBadges = page.locator('.lead-card .freshness-badge');
    await expect(freshnessBadges.first()).toBeVisible();
  });

  test('status bar shows agent count and system health', async ({ page }) => {
    await page.goto('/team');
    const statusBar = page.locator('.team-status-bar');
    await expect(statusBar).toBeVisible();
    // Should show "X/7 agents"
    await expect(statusBar).toContainText(/agents/);
    await expect(statusBar).toContainText(/delegations/);
    await expect(statusBar).toContainText(/system:/);
  });

  test('AttentionRail is present', async ({ page }) => {
    await page.goto('/team');
    // When data is missing, attention items may be empty, but the rail element should exist
    await expect(page.getByRole('region', { name: 'Attention items' })).toBeVisible();
  });

  test('layout is responsive at desktop viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'desktop-only test');
    await page.goto('/team');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Office screen tests
// ────────────────────────────────────────────────────────────────────

test.describe('Office screen', () => {
  test('renders office page with full shell mode', async ({ page }) => {
    await page.goto('/office');
    await expect(page.locator('[data-office-page="full"]')).toBeVisible();
    await expect(missionTitle(page, 'Office')).toBeVisible();
  });

  test('canvas element is present (WebGL or fallback)', async ({ page }) => {
    await page.goto('/office');
    // The OfficeErrorBoundary wraps the OfficeModule which renders canvas
    // Playwright may run under a CSP/GPU fallback, so accept either canvas or honest fallback panel.
    await expectOfficeCanvasOrFallback(page.locator('[data-office-page="full"]'));
  });

  test('pop-out mode renders via ?popout=1', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'desktop-only test');
    await page.goto('/office?popout=1');
    // Should render popout mode (full-viewport overlay)
    await expect(page.locator('[data-office-page="popout"]')).toBeVisible();
    // Should have ConductorStation overlay
    await expect(page.locator('[data-conductor-station="overlay"]')).toBeVisible();
  });

  test('full office page has ConductorStation overlay', async ({ page }) => {
    await page.goto('/office');
    // ConductorStation should be rendered
    await expect(page.locator('[data-conductor-station="overlay"]')).toBeVisible();
  });

  test('office nav button has data-active when on office route', async ({ page }) => {
    await page.goto('/office');
    const officeNav = railButton(page, 'OFFICE');
    await expect(officeNav).toHaveAttribute('data-active', 'true');
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Activity screen tests
// ────────────────────────────────────────────────────────────────────

test.describe('Activity screen', () => {
  test('renders with correct title', async ({ page }) => {
    await page.goto('/activity');
    await expect(missionTitle(page, 'Activity')).toBeVisible();
    await expect(page.locator('.dashboard-placeholder-eyebrow')).toContainText('ACTIVITY FEED');
  });

  test('shows unavailable state when no data', async ({ page }) => {
    await page.goto('/activity');
    // Activity data source is not connected in test env
    await expect(page.locator('.activity-empty-state')).toBeVisible();
  });

  test('unavailable state shows warning message', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('.activity-empty-panel')).toContainText(/Activity data unavailable/i);
  });

  test('filter bar is present', async ({ page }) => {
    await page.goto('/activity');
    // Even in unavailable state, the filter bar should be present or the unavailable state is shown
    // Check for either filter bar OR empty-state panel
    const hasFilterBar = await page.locator('.activity-filter-bar').count();
    const hasEmptyState = await page.locator('.activity-empty-state').count();
    expect(hasFilterBar + hasEmptyState).toBeGreaterThanOrEqual(1);
  });

  test('freshness badge shows unavailable', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('.freshness-badge--unavailable')).toBeVisible();
  });

  test('status bar shows offline status', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('.activity-status-bar')).toContainText(/OFFLINE|events/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 5. Projects screen tests
// ────────────────────────────────────────────────────────────────────

test.describe('Projects screen', () => {
  test('renders with correct title', async ({ page }) => {
    await page.goto('/projects');
    await expect(missionTitle(page, 'Projects')).toBeVisible();
    await expect(page.locator('.dashboard-placeholder-eyebrow')).toContainText('PROJECT CONTROL');
  });

  test('shows unavailable state when no data', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('.projects-empty-state')).toBeVisible();
  });

  test('unavailable state shows warning message', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('.projects-empty-panel')).toContainText(/Project data unavailable/i);
  });

  test('freshness badge shows unavailable', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('.freshness-badge--unavailable')).toBeVisible();
  });

  test('status bar shows offline status', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('.projects-status-bar')).toContainText(/OFFLINE|projects/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 6. Decisions screen tests
// ────────────────────────────────────────────────────────────────────

test.describe('Decisions screen', () => {
  test('renders with correct title', async ({ page }) => {
    await page.goto('/decisions');
    await expect(missionTitle(page, 'Decisions')).toBeVisible();
    await expect(page.locator('.dashboard-placeholder-eyebrow')).toContainText('DECISION LOG');
  });

  test('always shows unavailable state (no backend)', async ({ page }) => {
    await page.goto('/decisions');
    await expect(page.locator('.freshness-badge--unavailable')).toBeVisible();
    await expect(page.locator('.decisions-empty-state')).toBeVisible();
  });

  test('unavailable panel shows decision data unavailable message', async ({ page }) => {
    await page.goto('/decisions');
    await expect(page.locator('.decisions-empty-panel')).toContainText(/Decision data unavailable/i);
  });

  test('terminal-panel style is correct — filter bar is present', async ({ page }) => {
    await page.goto('/decisions');
    // Decisions page has a disabled filter bar even in unavailable state
    await expect(page.locator('.decisions-filter-bar')).toBeVisible();
    await expect(page.locator('.decisions-filter-bar')).toContainText('All Threads');
  });

  test('status bar shows offline status', async ({ page }) => {
    await page.goto('/decisions');
    await expect(page.locator('.decisions-status-bar')).toContainText(/OFFLINE|decisions/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 7. Calendar screen tests
// ────────────────────────────────────────────────────────────────────

test.describe('Calendar screen', () => {
  test('renders with correct title', async ({ page }) => {
    await page.goto('/calendar');
    await expect(missionTitle(page, 'Calendar')).toBeVisible();
    await expect(page.locator('.dashboard-placeholder-eyebrow')).toContainText('CALENDAR');
  });

  test('shows unavailable state when no data', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('.calendar-empty-state')).toBeVisible();
  });

  test('unavailable panel shows calendar unavailable message', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('.calendar-empty-panel')).toContainText(/Calendar unavailable/i);
  });

  test('warning bar area is present', async ({ page }) => {
    await page.goto('/calendar');
    // The warning bar shows "Source offline" in unavailable state
    await expect(page.locator('.calendar-warning-bar')).toBeVisible();
    await expect(page.locator('.calendar-warning-bar')).toContainText(/Source offline/i);
  });

  test('filter bar is present', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('.calendar-filter-bar')).toBeVisible();
  });

  test('freshness badge shows unavailable', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('.freshness-badge--unavailable')).toBeVisible();
  });

  test('status bar shows offline status', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('.calendar-status-bar')).toContainText(/OFFLINE|events/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 8. Admin panel tests
// ────────────────────────────────────────────────────────────────────

test.describe('Admin panels', () => {
  test('admin /admin/keys returns 401 without proxy token', async ({ request }) => {
    const response = await request.get('/admin/keys');
    expect(response.status()).toBe(401);
  });

  test('admin /admin/mcp returns 401 without proxy token', async ({ request }) => {
    const response = await request.get('/admin/mcp');
    expect(response.status()).toBe(401);
  });

  test('admin /admin/cron returns 401 without proxy token', async ({ request }) => {
    const response = await request.get('/admin/cron');
    expect(response.status()).toBe(401);
  });

  test('admin /admin/webhooks returns 401 without proxy token', async ({ request }) => {
    const response = await request.get('/admin/webhooks');
    expect(response.status()).toBe(401);
  });

  test('admin /admin/skills returns 401 without proxy token', async ({ request }) => {
    const response = await request.get('/admin/skills');
    expect(response.status()).toBe(401);
  });

  test('admin /admin/keys returns non-401 with valid proxy token', async ({ request }) => {
    const response = await request.get('/admin/keys', {
      headers: { 'X-Mission-Control-Key': adminKey },
    });
    expect(response.status()).not.toBe(401);
  });

  test('admin /admin/mcp returns non-401 with valid proxy token', async ({ request }) => {
    const response = await request.get('/admin/mcp', {
      headers: { 'X-Mission-Control-Key': adminKey },
    });
    expect(response.status()).not.toBe(401);
  });

  test('admin /admin/cron returns non-401 with valid proxy token', async ({ request }) => {
    const response = await request.get('/admin/cron', {
      headers: { 'X-Mission-Control-Key': adminKey },
    });
    expect(response.status()).not.toBe(401);
  });

  test('admin SPA routes render placeholder page', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('.dashboard-placeholder-card')).toBeVisible();
    await expect(missionTitle(page, 'Sessions')).toBeVisible();
  });

  test('admin nav buttons exist in the rail', async ({ page }) => {
    await page.goto('/team');
    // Admin routes are in the core nav group
    const adminLabels = ['SESSIONS', 'FILES', 'MODELS', 'KEYS', 'MCP', 'CRON', 'SKILLS'];
    for (const label of adminLabels) {
      await expect(railButton(page, label)).toBeVisible();
    }
  });

  test('clicking admin nav button navigates to placeholder page', async ({ page }) => {
    await page.goto('/team');
    await railButton(page, 'MODELS').click();
    await expect(page.locator('.dashboard-placeholder-card')).toBeVisible();
    await expect(missionTitle(page, 'Models')).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────
// 9. Existing coverage: Kanban + Office panel proof
// ────────────────────────────────────────────────────────────────────

test('serves the rebuilt Hermes /kanban shell through the Node proxy with honest non-demo states', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'covered by the dedicated mobile proof');

  const health = await request.get('/health');
  await expect(health).toBeOK();
  await expect(await health.json()).toMatchObject({
    ok: true,
    service: 'sora-mission-control-admin-proxy',
  });

  const blockedAdmin = await request.get('/admin/keys');
  expect(blockedAdmin.status()).toBe(401);

  const authorizedAdmin = await request.get('/admin/keys', {
    headers: { 'X-Mission-Control-Key': adminKey },
  });
  expect(authorizedAdmin.status()).not.toBe(401);

  await page.goto('/kanban');
  await expect(page.getByText('HERMES', { exact: true })).toBeVisible();
  await expect(page.getByText('AGENT')).toBeVisible();
  await expect(missionTitle(page, 'Kanban')).toBeVisible();
  await expect(page.locator('[data-office-panel="phase-b"]')).toBeVisible();
  await expect(railButton(page, 'KANBAN')).toHaveAttribute('data-active', 'true');
  await expect(page.getByText('Sora Mission Control')).toHaveCount(0);
  await expect(page.locator('.kanban-status-note').first()).toContainText(honestBoardState);

  const officeFrame = page.locator('.kanban-office-frame');
  await expectOfficeCanvasOrFallback(officeFrame);
  await expect(officeFrame.getByText('Initializing office canvas…')).toHaveCount(0);
  await expect(officeFrame).toContainText(/Cloud.*break-room standby/);

  await officeFrame.screenshot({
    path: `shared/e2e-${testInfo.project.name}-kanban-office-panel-proof.png`,
  });

  await page.screenshot({
    path: `shared/e2e-${testInfo.project.name}-kanban-shell-proof.png`,
    fullPage: true,
  });
});

test('mobile /kanban shell keeps the rebuilt controls reachable without horizontal page overflow', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'covered by the dedicated desktop proof');

  await page.goto('/kanban');
  await expect(page.getByText('HERMES', { exact: true })).toBeVisible();
  await expect(missionTitle(page, 'Kanban')).toBeVisible();
  await expect(page.locator('[data-office-panel="phase-b"]')).toBeVisible();
  await expect(page.locator('.kanban-status-note').first()).toContainText(honestBoardState);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: `shared/e2e-${testInfo.project.name}-kanban-mobile-proof.png`,
    fullPage: true,
  });
});
