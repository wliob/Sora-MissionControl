# Tifa Reset 06 Risk Gate Report

Card: `smc-reset-06-tifa-risk-gate`
Date: 2026-06-22T22:59:27-04:00
Project root audited: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`
Scope: product risk / false-green acceptance audit only. No trading activity.

## Verdict

GO WITH CONDITIONS

Final acceptance can proceed for the current verified scope if Sora keeps the acceptance language narrow: Hermes Dashboard shell, repaired office idle rendering, same-origin proxy deployment, honest unauthorized/unavailable states, and the audited admin safe subset with the conditions below.

I did not find a normal-path false-green where unauthorized Kanban data is rendered as live board data, where disabled webhook support is rendered as healthy-empty, or where provider quota/rate limits are invented. I did find acceptance conditions that must remain visible because they are easy to overclaim in final wording.

## Sources read

- `shared/biscuit-reset03-shell-rebuild-report.md`
- `shared/biscuit-reset04-office-fix-report.md`
- `shared/korra-reset04-office-visual-review.md`
- `shared/lelouch-reset05-workflow-copy-report.md`
- `shared/cloud-reset02-access-bridge-proof.md`
- `shared/final-acceptance-report.md`

Relevant current files inspected included:

- `missionControlProxy.js`
- `src/services/hermes/dashboardClient.ts`
- `src/services/hermes/adminProxyAdapter.ts`
- `src/services/hermes/projectControlAdapter.ts`
- `src/state/backbone.ts`
- `src/state/adminKeyMcpStore.ts`
- `src/state/cwsAdminStore.ts`
- `src/state/projectControlStore.ts`
- `src/components/admin/*Panel.tsx`
- `src/components/kanban/ProjectControlSurface.tsx`
- `src/components/shell/OfficePanel.tsx`
- `src/office/components/OfficeModule.tsx`
- `tests/e2e/mission-control.spec.ts`
- `playwright.config.ts`
- `README.md`, `OVERVIEW.md`

## Targeted verification run by Tifa

1. Admin/auth/proxy/project-control targeted tests:

```text
npm test -- src/services/hermes/missionControlProxy.test.ts src/services/hermes/adminProxyAdapter.test.ts src/services/hermes/dashboardClient.test.ts src/state/adminKeyMcpStore.test.ts src/state/cwsAdminStore.test.ts src/state/projectControlStore.test.ts src/services/hermes/projectControlAdapter.test.ts -- --run

Test Files  7 passed (7)
Tests       152 passed (152)
```

2. Office asset gate:

```text
npm run check:office-assets

OFFICE ATLAS CHECK PASSED
Frames scanned: 176
Opaque chroma pixels found: 0
```

3. TypeScript/lint gate:

```text
npm run lint

> tsc --noEmit
```

Exit code 0.

4. Release-bundle spot check:

```text
shared/releases/sora-missioncontrol-20260622T215753Z.tar.gz exists
contains: package-lock.json, missionControlProxy.js, src/main.tsx, Dockerfile, docker-compose.yml, deploy/OPERATOR-RUNBOOK.md, dist/index.html
```

5. Current development-host local proxy check:

```text
curl http://127.0.0.1:3187/health
curl_failed=7
```

This is not a blocker by itself because the README/final report frame `127.0.0.1:3187` as local while the test proxy is running or as target-local over SSH. It does mean final acceptance should cite the deployed-target proof from Cloud/Codex, not imply a proxy is currently listening on this development host.

## Evidence supporting GO

- Reset 03 explicitly removed fake Kanban board injection when auth/bridge is missing and made `/kanban` state text distinguish live / unauthorized / offline / waiting.
- Reset 04 fixed the office atlas corruption with before/after asset proof, build proof, browser proof, and a real canvas-render assertion. Korra accepted the repaired office visually with only minor non-blocking edge-fringe notes.
- Reset 05 was copy-only and passed lint, full tests, and build; shipped UI title/branding now says Hermes Dashboard rather than leaving a false bespoke product label in the built app.
- `dashboardClient.ts` defaults browser REST to the same-origin proxy and refuses to invent a WebSocket path through the Mission Control proxy (`createKanbanEventsUrl` throws for port 3187).
- `missionControlProxy.js` returns `503` for disabled webhook platform output instead of healthy-empty, returns `501` for unsupported actions, and requires `X-Mission-Control-Key` for `/admin/*` when `MISSION_CONTROL_PROXY_AUTH_MODE=required`.
- `adminProxyAdapter.ts` stages the operator token in memory only; focused tests verify no localStorage/sessionStorage/log exposure.
- Key/MCP and CWS stores start empty with missing/unknown provenance and show unavailable/no-adapter states instead of production-looking seed data. Mock seed remains test-only.
- Project Control metrics remain null/unknown until a verified board snapshot exists, and mutation buttons are disabled unless the mutation adapter is bound and Kanban REST is connected.
- Chat demo fallback is explicitly labeled `DEMO MODE` in the UI and in Playwright proof expectations.
- Provider quota/rate-limit remains modeled as unknown unless a verified source exists.

## Conditions before Sora final acceptance language

1. Do not claim full Phase 6/admin completion. Say: live audited local proxy subset plus honest unavailable/501 states. Model-admin backend binding, unsupported Key/MCP/CWS actions, and provider quota/rate-limit remain unavailable/unknown.

2. Do not claim live Kanban task-driven office movement was proven in this environment. Reset 04 proved real idle office rendering and explicitly stated live task-driven movement still needs authorized Kanban data.

3. Keep deployed admin proxy in required-token mode for any operator-facing acceptance. Do not accept a deployment where `/admin/*` is reachable without an operator token outside local development.

4. Treat CWS cron actions as a remaining risk condition. Current UI allows `cron.create` and `cron.run` through the supported proxy path without the same explicit risk confirmation/cost-quota warning used elsewhere. That is acceptable only if final acceptance does not market cron mutation as fully risk-approved. Before broad/operator use, add confirmation/cost/quota/rollback copy for cron create/run or disable those buttons.

5. The office has an explicit URL-triggered demo path (`?demo=1`) that feeds scripted `DEMO_BOARD` data. Normal `/kanban` proof is non-demo, but if the demo query path remains accessible in accepted builds it should show an obvious `DEMO MODE` label or be excluded from final proof language.

6. Clean up stale path references in final docs when practical. Examples found: `shared/final-acceptance-report.md` says `/home/wliob/Projects/Active/Sora-MissionControl`; `OVERVIEW.md` still contains `/Users/wliob/...` and lowercase `/home/wliob/projects/...`. These are documentation accuracy issues, not runtime blockers.

7. State that the dev-host local proxy was not currently listening during this audit. Rely on the recorded deployed-target proof and/or rerun target health/e2e from Sora if Sora wants a fresh final stamp.

## No-go triggers

Switch to NO-GO if any final acceptance wording or deployment does one of these:

- Calls unauthorized/unavailable Kanban data “live” or “healthy”.
- Uses screenshots/proof from `?demo=1` without a visible demo label.
- Presents provider quota/rate-limit as known without a verified live source.
- Claims model-admin backend support exists.
- Ships admin routes without required-token protection on the LAN target.
- Treats cron create/run as risk-approved live mutation without either confirmation/cost warning or an explicit operator-only condition.

## Final risk call

GO WITH CONDITIONS. The reset can be accepted as an honest, verified subset. The remaining risk is not hidden test failure; it is scope wording and live-admin mutation discipline. Keep the limitations explicit and Sora can proceed to final acceptance for the current verified scope.
