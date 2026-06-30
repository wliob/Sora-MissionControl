# Biscuit Codex Sidecar Hardening Report

Date: 2026-06-22
Workdir: `/home/wliob/projects/Active/Sora-MissionControl`

## Scope Completed

Implemented the Phase 6 sidecar production hardening slice without adding new admin capabilities.

Completed:
1. Added explicit production auth mode for the local admin sidecar.
2. `MISSION_CONTROL_PROXY_AUTH_MODE=required` now requires `MISSION_CONTROL_ADMIN_PROXY_KEY`.
3. In required mode, `/admin/*` routes require `X-Mission-Control-Key` matching the configured key.
4. Missing and invalid request tokens are rejected.
5. Valid request tokens pass through to the existing route handlers.
6. Token enforcement is scoped to admin routes; health/static routes remain outside the admin token gate.
7. Existing local development ergonomics are preserved when no auth mode/key is configured.
8. Default same-host/loopback CORS behavior remains intact and covered by focused tests.

## Files Changed

Code:
- `missionControlProxy.js`

Tests:
- `src/services/hermes/missionControlProxy.test.ts`
- `src/types/missionControlProxy-test.d.ts`

Docs:
- `AGENTS.md`
- `OVERVIEW.md`
- `shared/biscuit-codex-sidecar-hardening-report.md`

## TDD Notes

Tests were added before implementation.

Initial RED:
- The first HTTP-level test harness failed because this sandbox disallows binding a local TCP listener (`listen EPERM`). The tests were converted to pure proxy helper tests to avoid network binding.
- The focused RED run then failed for the expected implementation reason: `resolveProxyAuthConfig` and `isAdminProxyRequestAuthorized` did not exist.

Implementation:
- Added `resolveProxyAuthConfig` for `required`/`production`/`token-required`, optional/default, and explicit disabled modes.
- Added constant-time token comparison.
- Added `isAdminProxyRequestAuthorized` and wired it into the existing Express middleware.
- Kept CORS middleware behavior unchanged.

GREEN:
- Focused proxy tests pass after implementation.

## Verification Performed

Commands run:

```bash
npm run test -- src/services/hermes/missionControlProxy.test.ts --run
npm run lint
npm test -- --run
npm run build
```

Results:
- Initial RED run failed because the new auth helpers were absent.
- Final GREEN run: 23 passing in `src/services/hermes/missionControlProxy.test.ts`.
- `npm run lint`: passed (`tsc --noEmit` clean).
- `npm test -- --run`: passed, 631/631 tests across 35 files.
- `npm run build`: passed with the existing large-chunk warning.

## Deployment Requirement

For production-like sidecar deployments:

```env
MISSION_CONTROL_PROXY_AUTH_MODE=required
MISSION_CONTROL_ADMIN_PROXY_KEY=***
```

Use `MISSION_CONTROL_CORS_ORIGIN` only when the browser origin differs from the proxy host and must be explicitly allowed. Otherwise the proxy keeps the default same-host/loopback CORS behavior.

LAN/firewall policy, secret injection, and process supervision remain deployment responsibilities outside the app.

## Blockers

1. Model-admin backend binding remains blocked on a verified noninteractive Hermes model-list/capability endpoint.
2. Unsupported Key/MCP actions still require verified backend semantics before being enabled or broadened: `key.create`, `key.update`, `key.revoke`, `key.regenerate`, `mcp.update`, and token/note-backed MCP create flows.
3. Unsupported CWS actions still require verified contract alignment before being enabled or broadened: `cron.update`, `cron.create` with model override, `webhook.create`, `webhook.update`, `skill.enable`, and `skill.disable`.
4. LAN/firewall policy and process supervision for production sidecar deployment remain external deployment work.

## Next Recommended Slice

Phase 6 deployment follow-through: document or implement the chosen sidecar deployment wrapper for the Hermes host, including process supervision, secret injection for `MISSION_CONTROL_ADMIN_PROXY_KEY`, network binding/firewall assumptions, and the exact browser-side injection path for `window.__SORA_ADMIN_PROXY_KEY__`.
