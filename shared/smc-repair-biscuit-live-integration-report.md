# SMC Repair - Biscuit Live Integration

Date: 2026-06-30

## Scope Reconciled

- Preserved the existing dirty tree. Current repo state already had broad Phase 6/7/8 edits, an existing Kanban WebSocket proxy implementation, and prior dashboard same-origin tests.
- Reworked only the live-integration failure areas: admin/dashboard URL resolution, secure-transport handling, proxy CSP, attention/office route controls, and focused regression tests.
- Reviewer follow-up strengthened same-origin URL protection so HTTPS `:3443` ignores injected same-host `:3187` dashboard/admin proxy URLs while preserving explicit external operator overrides.
- Reviewer follow-up tightened ShellLayout route tests to assert real `window.location` paths plus visible headers/pages after nav clicks, instead of duplicating implementation state through `shellStore` assertions.
- Did not commit and did not print or store any admin proxy token.

## Files Changed

- `src/services/hermes/dashboardClient.ts`, `src/services/hermes/adminProxyAdapter.ts`, and `src/services/hermes/calendarAdapter.ts`
  - Added shared admin proxy base URL resolution so HTTPS `:3443` uses same-origin admin paths and does not construct `https://host:3187`.
  - Added guards so injected same-host port `3187` URLs are ignored when the browser is on HTTPS, preventing accidental calls to `https://host:3187` or the locked HTTP listener from the canonical origin.
  - Preserved explicit external operator overrides such as another host or another HTTPS port.
  - Added typed secure-transport errors for the HTTP `403` guard.
- `src/components/admin/AdminProxyAuthControl.tsx`
  - Replaced token-entry UX with an HTTPS-required notice when the browser is on locked LAN HTTP `:3187` or receives the secure-transport guard message.
- `missionControlProxy.js`
  - Removed `unsafe-eval` from `Content-Security-Policy`.
  - Kept existing same-origin Kanban WebSocket proxy path instead of weakening CSP or falling back to direct dashboard ports.
- `src/components/shell/AttentionWidget.tsx` and `src/office/components/OfficeModule.tsx`
  - Attention action buttons now either navigate to real app routes (`/kanban`, `/calendar`, `/system`, `/chat`) or render disabled with a reason.
  - Office current-work/chat actions now update the actual URL path.
  - Office attention focus only appears when a canonical agent source maps to a verified current board task.
- Focused tests added/updated:
  - `src/services/hermes/adminProxyAdapter.test.ts`
  - `src/services/hermes/dashboardClient.test.ts`
  - `src/services/hermes/missionControlProxy.test.ts`
  - `src/components/admin/UnifiedAdminSurface.test.tsx`
  - `src/components/shell/AttentionWidget.test.tsx`
  - `src/components/shell/ShellLayout.kanban.test.tsx`
  - `src/office/components/OfficeModule.test.tsx`

## Verification

- Focused regression command:
  - `pnpm test -- src/services/hermes/dashboardClient.test.ts src/services/hermes/adminProxyAdapter.test.ts src/components/shell/ShellLayout.kanban.test.tsx --run`
  - Result: `49 files passed`, `758 tests passed`.
- Required gates:
  - `pnpm run lint`: passed (`$ tsc --noEmit`).
  - `pnpm test -- --run`: passed, `49 files`, `758 tests`.
  - `pnpm run build`: passed (`tsc -b && vite build`); Vite built `850 modules`; existing `>500 kB` chunk warning remains.
- Playwright HTTPS 3443:
  - Command: `PLAYWRIGHT_BASE_URL='https://192.168.10.5:3443' PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm run test:e2e`
  - Result: failed before app assertions because Chromium rejected the deployed certificate: `page.goto: net::ERR_CERT_AUTHORITY_INVALID at https://192.168.10.5:3443/`.
  - Summary: `113 failed`, `5 skipped`; failures were the same certificate authority/self-signed certificate error on HTTPS navigation, so no app assertions were reached.

## Remaining Blockers

- Browser e2e proof against `https://192.168.10.5:3443` requires a trusted certificate or a deliberate Playwright config override for this deployment. I did not add a browser TLS bypass to the test config as part of the app repair.
- Unsupported backend/admin/Kanban actions remain unavailable by design.
