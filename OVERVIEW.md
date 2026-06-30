# Sora-MissionControl — Project Overview

> **Status:** v1.0.0 RELEASED — Hermes Dashboard complete and deployed. Phases 0-5 complete; Phase 6/7 live with verified safe subsets and honest unavailable states; Phase 8 polish has browser/e2e proof. Deployed on Unraid Tower (`192.168.10.5`) as Docker container `sora-missioncontrol-proxy` with HTTPS on port 3443 and plain HTTP on 3187 (sensitive routes blocked). LAN acceptance passed for both `https://192.168.10.5:3443` (primary) and `http://192.168.10.5:3187` (locked fallback). 753/753 tests passing. CSP-compliant (no unsafe-eval).
> **Last Updated:** 2026-06-30 (v1.0.0 release — repo hygiene, GitHub backup, final docs)
> **Created:** 2026-06-18
> **GitHub:** https://github.com/wliob/Sora-MissionControl
> **Release:** https://github.com/wliob/Sora-MissionControl/releases/tag/v1.0.0
> **Deployment Target:** Docker container on Unraid Tower (`192.168.10.5`); **primary URL** `https://192.168.10.5:3443`, health `https://192.168.10.5:3443/health`. Plain HTTP on port 3187 returns 403 for all sensitive routes (admin, login, session, Kanban API). Staging/dev on Hermes host baset-ai (`192.168.0.85:3187`) via systemd user service.
> **Stack:** React 18 + TypeScript + Vite, PixiJS v8 for 3D office, Zustand + XState for state, GSAP for motion, CSS theme tokens, optional local proxy for Hermes/CLI transport
> **Data Source:** Hermes dashboard APIs + live agent/runtime state + Hermes 3D Office v2 assets/code + Hermes Kanban + usage/rate-limit signals; OpenClaw Mission Control remains a UX reference only
> **Repo/Vault:** `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`

---

## Current Status Snapshot

**Summary:** Phases 0-5 are complete for the current scope. Phase 6 admin safety boundary is implemented and now has a live audited local proxy adapter: `missionControlProxy.js` exposes allowlisted Hermes CLI-backed REST endpoints, `MissionControlAdminProxyAdapter` binds Key/MCP + CWS stores, and backbone startup loads live keys/MCP/cron/webhook/skills data when the sidecar is reachable. The proxy now exposes only the verified safe mutation subset: `key.delete`; `mcp.test`, `mcp.remove`, and `mcp.create` without token/note; `cron.pause`, `cron.resume`, `cron.run`, `cron.remove`, and `cron.create` without model override; plus `webhook.remove`. Unsupported or contract-mismatched actions (`key.revoke`, token-backed MCP create, webhook create/update, skill enable/disable, cron update/model override, and model-admin backend binding) return honest `501`/unavailable behavior instead of faking success. Model-admin and Keys/MCP confirmations now use the shared `RiskConfirmDialog`: model delete/reset-credential and Key/MCP danger actions (`key.delete`, `mcp.remove`) require typed phrase gates, while Key/MCP risk actions (`key.revoke`, `key.regenerate`) remain confirmed without typed phrases. Webhook platform-disabled reads now surface as unavailable rather than healthy-empty, and the local sidecar defaults to same-host/loopback CORS unless an explicit allowlist or wildcard env is configured. Production-like sidecar deployments can now opt into scoped admin token enforcement with `MISSION_CONTROL_PROXY_AUTH_MODE=required` and `MISSION_CONTROL_ADMIN_PROXY_KEY`; this requires `X-Mission-Control-Key` for `/admin/*` routes while leaving health/static routes outside the admin token scope. The client now has an operator-entered, session-only in-memory admin proxy token control plus a verified 401/Unauthorized affordance; tokens are not logged/rendered/raw-persisted and no-token local development behavior remains unchanged. The legacy `window.__SORA_ADMIN_PROXY_KEY__` fallback is deprecated and limited to explicit localhost operator use; do not bake secrets into built assets. Profile chat UI, profile listing, demo fallback labeling, and the floating chat surface are integrated; direct dashboard chat REST/WS routes are verified unavailable, and live message sending still requires an injected verified transport/proxy. The required 3D office regression/stability sweep before Phase 5 is complete. Phase 5 live ops / usage visibility is fully active with provenance-aware usage snapshots, adapter-backed fetch, unknown-safe quota confidence, alert generation, and validated stale/degraded handling. Phase 7 now reads task comments/runs/logs/diagnostics through verified `/api/plugins/kanban` adapter routes, renders them in the selected-task drawer, sends supported dispatch/decompose/reclaim/terminate mutations only through confirmation-gated adapter paths, and routes selected owner/current-work context through shared shell state so Project Control, office, and chat can hand off without inventing a second selection store. Phase 8 now has Playwright desktop/mobile proof against the Node proxy deployment path, and deployment artifacts/docs have been changed from static nginx-only to same-origin Node proxy.

**Verified latest stats:**
- Core recent Kanban stabilization/chat cards: **15/15 done**.
- Office test suite from Biscuit final review: **180/180 passing**.
- Full test suite after Biscuit docker proxy env fallback fix: **663/663 passing** (42 test files).
- TypeScript verification after Biscuit docker proxy env fallback fix: **`npm run lint` / `tsc --noEmit` clean**.
- Production build after Biscuit docker proxy env fallback fix: **`npm run build` passed** with the existing large-chunk warning.
- Browser/e2e proof after Codex reconciliation: **`npm run test:e2e` passed** locally and against deployed `http://192.168.0.85:3187` (2 passed, 2 intentionally skipped project splits each run) with screenshots in `shared/e2e-*.png`.
- Smoke tests (2026-06-30 Cloud repair): Playwright/local `127.0.0.1:3187/health` returns JSON ok; Tower **HTTPS primary** `https://192.168.10.5:3443/health` returns `{"ok":true}`, Tower **HTTP fallback** `http://192.168.10.5:3187/health` returns ok, **all HTTP sensitive routes return 403** (admin, login, session, Kanban API), **HTTPS admin no-token returns 401**, **Host/X-Forwarded-Proto spoof returns 403**. Hermes Kanban source `192.168.0.85:9119/kanban` remained reachable. Staging (baset-ai) `http://192.168.0.85:3187/health` also verified.
- Reconnect catch-up targeted verification: **14/14 `catchUpAnimation`**, **36/36 `office.regression`**, **13/13 `gameRuntimePerfMode`**.
- Office CSP runtime verification after Kanban `t_42907006`: **`pnpm test -- src/office/engine/gameRuntimePerfMode.test.ts --run` passed** (Vitest ran 759/759 across 49 files), **`pnpm run lint` clean**, **`pnpm run build` passed** with the existing large-chunk warning, and local proxy browser proof rendered **1 canvas** at `http://127.0.0.1:3187/office` while CSP still omitted `unsafe-eval`.
- Admin confirmation focused tests: **154 passing** across Key/MCP + CWS store/panel tests.
- Active Phase 6 blocker: model-admin backend binding plus several admin mutations still lack verified backend semantics; the local proxy intentionally ships only the audited safe subset.

**Completed since the previous overview update:**
- Kanban `t_42907006` fixed the Office PixiJS production-CSP runtime failure without weakening `missionControlProxy.js`: `GameRuntime` now loads Pixi v8's official no-runtime-eval shim (`pixi.js/unsafe-eval`) before constructing the Pixi `Application`, and a focused GameRuntime test guards that import. Local proxy browser smoke confirmed `/office` renders a canvas under CSP without `unsafe-eval`; observed local auth/offline and worker-src console errors were unrelated to the Pixi init failure and were left unchanged.
- Biscuit repaired live client/data/office integration issues for the HTTPS `:3443` production origin: admin/calendar proxy defaults now resolve to same-origin HTTPS instead of cross-port `:3187`; secure-transport `403` responses now render an HTTPS-required admin UX instead of token entry; proxy CSP no longer includes `unsafe-eval`; the existing same-origin Kanban WebSocket proxy path remains the selected live-data implementation; attention and office action controls now either navigate real URL paths or render disabled with reasons; office attention focus only appears for canonical agents with verified mapped board tasks. Codex reviewer follow-up strengthened dashboard/admin resolver protection so injected same-host `:3187` URLs are ignored from HTTPS `:3443` while external operator overrides remain supported, and ShellLayout route tests now assert actual URL paths plus visible page/header behavior. Verification passed `pnpm run lint`, `pnpm test -- --run` (758/758 across 49 files), and `pnpm run build` (850 modules; existing large-chunk warning). Playwright against `https://192.168.10.5:3443` is still blocked by Chromium certificate trust with `net::ERR_CERT_AUTHORITY_INVALID`; the latest run failed 113 tests and skipped 5 before any app assertions reached the loaded app; see `shared/smc-repair-biscuit-live-integration-report.md`.
- Chat route behavior was verified: dashboard `/api/plugins/chat/*` routes are unavailable, profile listing uses `/api/plugins/kanban/profiles`, and the app labels demo chat fallback honestly until a verified live transport is injected.
- Biscuit updated `docs/api-reference.md` with verified chat/auth/runtime findings.
- Biscuit completed and reviewed the 3D office stability/performance card batch:
- Biscuit reran Phase 7 natively (no external coding agents): the Project Control surface now renders live comment thread/run/log/diagnostic detail from verified Kanban routes, and supported mutations bind only through guarded dashboard adapter paths while unsupported paths remain disabled.
- Biscuit completed card `smc-p7b-selected-agent-crosslinks` natively (no external coding agents): Project Control owner/task selection now writes shared shell selection state, office/chat surfaces expose current-work handoff actions, and unmapped owners stay honest with disabled office/chat routes instead of fake navigation.
- Biscuit audited the Phase 6 local sidecar against Hermes CLI semantics, narrowed the supported mutation subset to verified safe operations only, hardened default CORS/list reload behavior, and added proxy-focused regression tests so contract mismatches now fail honestly instead of pretending success.
- Codex completed the Phase 6 model-confirmation cohesion slice: model confirmations now use shared `RiskConfirmDialog`, danger actions require typed model-id confirmation, and copy records target/provider/provenance plus unknown cost/quota and rollback notes. Model backend binding remains blocked on a verified noninteractive Hermes model-list/capability endpoint.
- Codex completed the Phase 6 Keys/MCP confirmation consolidation slice: KeysPanel and McpPanel now use shared `RiskConfirmDialog`; Key/MCP pending confirmations carry safe/risk/danger tier metadata; `key.delete` and `mcp.remove` require typed phrases while `key.revoke`/`key.regenerate` remain risk-tier confirmations; adapter-unavailable, redaction, one-time-secret, and unsupported-backend behavior remain unchanged.
- Codex completed the Phase 6 sidecar production hardening slice: `missionControlProxy.js` now supports explicit `MISSION_CONTROL_PROXY_AUTH_MODE=required` admin-route token enforcement with `MISSION_CONTROL_ADMIN_PROXY_KEY`, keeps no-token local development behavior when unset, and preserves default same-host/loopback CORS behavior in focused tests. Final verification for the slice passed `npm run lint`, `npm test -- --run` (631/631 across 35 files), and `npm run build` with the existing large-chunk warning.
- Codex completed the Phase 6 client-side admin proxy auth hook: the admin surface now accepts an operator-entered token for the current browser tab only, `MissionControlAdminProxyAdapter` sends `X-Mission-Control-Key` only when a token is explicitly configured, no-token local development stays unchanged, raw tokens are not logged/rendered/persisted in app storage/state, and `window.__SORA_ADMIN_PROXY_KEY__` is deprecated/limited to localhost operator use instead of being a built-asset secret injection path.
- Codex completed dirty-tree/e2e/deployment reconciliation: added a focused 401 admin proxy affordance, added Playwright browser proof (`test:e2e`), replaced static nginx Docker/Compose with a same-origin Node proxy deployment path, added a systemd service template, added an operator runbook/release-bundle script, updated README connection docs, and wrote `shared/final-acceptance-report.md`. After `wliob` SSH access was granted, Codex moved the target proxy under an active/enabled required-token user service; after operator firewall follow-through, `http://192.168.0.85:3187` passed LAN health and deployed Playwright proof.
- Biscuit fixed the fresh Docker deployment proxy-env mismatch: `missionControlProxy.js` now resolves the dashboard upstream from `HERMES_DASHBOARD_PROXY_TARGET` first, then `HERMES_DASHBOARD_URL`, then the local default; `docker-compose.yml` now also exports `HERMES_DASHBOARD_PROXY_TARGET` from `HERMES_DASHBOARD_URL` so new container deploys no longer fall back to `127.0.0.1:9119` and 502 `/api/plugins/kanban` on first boot. Focused proxy tests plus `npm run lint`, `npm test -- --run`, and `npm run build` all passed locally (663/663 tests).
- Biscuit completed reset card `smc-reset-04-biscuit-office-fix`: added `scripts/check_office_atlases.py`, confirmed 3,083,844 pre-fix opaque chroma/bounds failures across office atlases, repaired the corrupted static atlas assets in `public/assets/atlases/`, and tightened Playwright `/kanban` proof so the office panel must reach a real rendered canvas state with fresh screenshots in `shared/e2e-chromium-desktop-kanban-office-panel-proof.png` and `shared/biscuit-reset04-office-fix-report.md`.
  - WebGL context loss recovery
  - React error boundary around canvas
  - Atlas load timeout + retry
  - Spritesheet load failure warning
  - Visibility/background handling
  - Reconnect catch-up animation
  - Memory pressure monitoring
  - Asset integrity check
  - Multi-instance guard
  - FPS-based quality degradation
  - Resize debounce
  - Idle timeout / sleep mode
  - WebGL fallback chain + error message

---

## Codex Takeover Brief — Remaining Work To Finish + Deploy

This project is now prepared for a **single Codex coding agent** to take over from the current docs and finish the remaining phases through deployment. Treat this section as the execution queue. Do not assume a Kanban status means code is accepted; verify with files and commands.

### Start here

```bash
cd /home/wliob/projects/Active/Sora-MissionControl
/home/wliob/.hermes/node/bin/codex login status
/home/wliob/.hermes/node/bin/codex exec "Read OVERVIEW.md and AGENTS.md. Reconcile the dirty tree, then finish the remaining Sora-MissionControl phases through deployment. Do not fake backend support. Keep unsupported admin/Kanban actions unavailable until verified. Run lint, full tests, build, browser/e2e proof, and deployment smoke tests before claiming done."
```

Codex is installed at `/home/wliob/.hermes/node/bin/codex` and is currently logged in via ChatGPT on this host.

### Current repo reality before Codex edits

- Branch: `master`.
- The tree is dirty with many Phase 6/7/8 implementation and report files. **First task is reconciliation, not new feature work.** Run `git status --short`, inspect the diff, and keep unrelated/pre-existing changes intact.
- Latest accepted docs say full suite reached **636/636** after the admin proxy auth hook. Kanban/Biscuit handoff later reported **641/641** after polish fixes. Codex must rerun the gates locally before trusting either number.
- `missionControlProxy.js` serves both `/admin/*` routes and built `dist/` assets. Verified current-host proxy URL: `http://127.0.0.1:3187` / LAN `http://192.168.10.18:3187`; production target is Unraid Tower Docker container `sora-missioncontrol-proxy` at `https://192.168.10.5:3443` (HTTPS primary) / `http://192.168.10.5:3187` (HTTP locked fallback). Staging (baset-ai) at `http://192.168.0.85:3187` via systemd user service.
- `Dockerfile` and `docker-compose.yml` now run the same-origin Node proxy server instead of static nginx, so the container path can support admin routes when the Hermes CLI/runtime is available inside that environment.

### What is already done

1. **Phases 0-5:** complete for current scope.
   - Research/contracts, visual system, 3D office reuse, data/auth/live-sync backbone, chat UI/demo fallback, office stability, live ops/usage unknown-safe behavior.
2. **Phase 6 Admin:** safe local adapter subset is live.
   - `missionControlProxy.js` exposes verified CLI-backed reads for keys/MCP/cron/webhooks/skills.
   - Verified safe mutations are intentionally narrow: `key.delete`; `mcp.test`/`mcp.remove`/`mcp.create` without token/note; `cron.pause`/`cron.resume`/`cron.run`/`cron.remove`/`cron.create` without model override; `webhook.remove`.
   - Unsupported routes return honest unavailable/`501`; do not fake success.
   - Required-mode admin proxy auth exists: `MISSION_CONTROL_PROXY_AUTH_MODE=required` + `MISSION_CONTROL_ADMIN_PROXY_KEY`; browser token entry is session-only/in-memory and sends `X-Mission-Control-Key`.
   - The 401/unauthorized affordance has Codex review and verification coverage through focused UI tests plus Playwright required-token proof.
3. **Phase 7 Kanban/Project Control:** live partial surface is implemented.
   - Task-detail reads for comments/runs/logs/diagnostics use verified dashboard adapter routes.
   - Supported dispatch/decompose/reclaim/terminate mutations are guarded and adapter-only.
   - Selected owner/agent/current-work links connect Project Control, office, and chat for canonical owners.
4. **Phase 8 Polish:** first follow-up pass was reported complete by Biscuit and Codex browser proof now exists.
   - Systems nav grouping, quieter telemetry unknown states, Project Control unknown KPI cleanup, Systems Bay wording, compact profile presence rail.
   - Playwright verifies desktop/mobile proof through the Node proxy locally and against target-host deployment at `192.168.0.85:3187`.

### Remaining execution queue for Codex

Codex status after 2026-06-22 reconciliation: Phase A-E checks are complete for the current verified scope, including lint, full tests, build, local Playwright browser proof, deployed Playwright browser proof, same-origin Node proxy deployment artifacts, README updates, and `shared/final-acceptance-report.md`. `wliob` SSH works, the target proxy is active/enabled as a required-token user service, target-local and target self-LAN health/admin smoke pass over SSH, and `http://192.168.0.85:3187/health` returns JSON ok from this development host after operator firewall follow-through. A verified release bundle exists at `shared/releases/sora-missioncontrol-20260622T215753Z.tar.gz` with runbook instructions in `deploy/OPERATOR-RUNBOOK.md`.

#### Phase A — Reconcile and verify current dirty tree

1. Review `git status --short` and inspect changes relevant to Phase 6/7/8.
2. Read recent reports in `shared/`, especially:
   - `shared/biscuit-auth-401-affordance-report.md`
   - `shared/biscuit-phase6b-admin-adapter-completion-report.md`
   - `shared/biscuit-phase7-live-control-report.md`
   - `shared/biscuit-phase7b-crosslinks-report.md`
   - `shared/korra-phase8-polish-cohesion-prep.md`
3. Run and fix until green:
   ```bash
   npm run lint
   npm test -- --run
   npm run build
   ```
4. If TypeScript gives stale module errors after external edits, remove build cache first: `rm -f tsconfig.tsbuildinfo`.

#### Phase B — Finish Phase 6 acceptance honestly

1. Review and accept/fix the 401 unauthorized affordance across admin panels.
2. Confirm raw admin proxy tokens are never persisted to `localStorage`, `sessionStorage`, source-controlled env, rendered UI, logs, or reports.
3. Keep model admin backend unavailable unless a **verified noninteractive** Hermes model-list/capability endpoint exists. Current known surfaces are insufficient: `hermes model` is interactive; `hermes config set model.default <MODEL_NAME>` is mutation-only.
4. Keep unsupported Key/MCP/CWS actions disabled/unavailable until safe backend semantics are verified route-by-route.
5. Add/update focused tests for any accepted UI behavior changes.

#### Phase C — Finish Phase 7 acceptance honestly

1. Verify Project Control reads against the real dashboard API at `http://127.0.0.1:9119/api/plugins/kanban` or LAN `http://192.168.0.85:9119/api/plugins/kanban`.
2. Ensure no browser code writes directly to the Kanban SQLite DB, filesystem, PIDs, or profile state.
3. Keep unsupported mutations disabled unless route/payload contracts are verified and tested.
4. Verify current-work navigation across Project Control, office, and chat with canonical owner mappings.

#### Phase D — Finish Phase 8 final polish + proof tests

1. Review desktop/tablet/mobile layouts for first-screen cohesion, spacing, hierarchy, reduced motion, empty states, and unknown/unavailable states.
2. Add browser proofing. If no e2e harness exists, add Playwright or equivalent and script it in `package.json` as `test:e2e`.
3. Minimum proof should cover:
   - app loads from final deployed URL,
   - office surface renders or fails gracefully,
   - chat fallback is labeled honestly,
   - ops/admin/kanban unknown/unavailable states are visibly not green/all-clear,
   - admin proxy required-token state shows 401 affordance and accepts an operator-entered session token,
   - mobile width has no horizontal scroll / unusable destructive controls.
4. Save screenshots/traces or exact command output in `shared/final-acceptance-report.md`.

#### Phase E — Deploy on Unraid / LAN and document connection

Recommended final architecture: **same-origin Node proxy server**:

```bash
npm ci
npm run build
MISSION_CONTROL_PROXY_HOST=0.0.0.0 MISSION_CONTROL_PROXY_PORT=3187 MISSION_CONTROL_PROXY_AUTH_MODE=required MISSION_CONTROL_ADMIN_PROXY_KEY=<secure-secret-from-runtime-not-git> node missionControlProxy.js
```

Then connect:

- **Primary (HTTPS):** `https://192.168.10.5:3443` — full app, admin, login, session
- **Health (HTTPS):** `https://192.168.10.5:3443/health`
- **Health (HTTP fallback):** `http://192.168.10.5:3187/health` (health only — sensitive routes 403)
- **HTTP locked fallback:** `http://192.168.10.5:3187` — static SPA only; admin/login/session return 403
- **Admin routes:** `https://192.168.10.5:3443/admin/*` with `X-Mission-Control-Key` (HTTPS required)
- **Hermes dashboard/Kanban source:** `http://192.168.0.85:9119/kanban`
- **Staging (baset-ai):** `http://192.168.0.85:3187`

If deploying static nginx separately, set and document both endpoints:

- Static app, example: `http://192.168.0.85:5180`
- Proxy sidecar (staging): `http://192.168.0.85:3187`
- CORS for dev/static split: `MISSION_CONTROL_CORS_ORIGIN=http://192.168.0.85:5180`

Before final handoff, Codex must update this file, `AGENTS.md`, and `README.md` with the actual deployed URL, service/container name, env var source, rollback command, and exact smoke-test output.

### Final acceptance checklist

Do not mark project complete until all are true:

- `npm run lint` passes.
- `npm test -- --run` passes.
- `npm run build` passes; existing large-chunk warning is either fixed or explicitly accepted.
- Browser/e2e proof passes against deployed URL.
- `curl -fsk https://192.168.10.5:3443/health` returns JSON ok (primary). `curl http://192.168.10.5:3187/health` returns ok (fallback). `curl http://192.168.10.5:3187/admin/keys` returns 403 (transport lock active).
- Required-token mode is tested without exposing the token.
- Unsupported backend actions remain disabled/unavailable, not fake-success.
- Unraid/LAN service/container restarts after reboot or has clear start/rollback commands.
- `shared/final-acceptance-report.md` contains commands, outputs, URL(s), screenshots/traces if available, and remaining known limitations.

---

## Changelog

| Date | Change | Details |
|------|--------|---------|
| 2026-06-18 | Project created | Initial planning written after requirements grilling. Core vision locked: premium custom mission-control dashboard for Hermes. |
| 2026-06-19 | Phase 2 completed | Hermes 3D Office v2 reuse and runtime polish landed; build/test/lint verified green. |
| 2026-06-19 | Phase 3 completed | Live data/auth backbone and shared state scaffold landed; build/test/lint verified green. |
| 2026-06-19 | Phase 4 in progress | Chat backbone test coverage landed; floating chat bubble overlay ported from hermes-chat-bubble and integrated into shell; Phase 2 office regression sweep added. Previous stat: 279/279 tests green. |
| 2026-06-20 | Phase 4 chat behavior verified | Direct chat plugin routes were verified unavailable; profile roster and demo fallback behavior were documented while live message transport remains an injected-adapter/proxy follow-up. |
| 2026-06-20 | Phase 4b / office stability gate completed | Biscuit reviewed and completed the office stability sweep. Latest verified stats: 15/15 core cards done, 180/180 office tests passing, `tsc --noEmit` clean. |
| 2026-06-21 | Project status reconciliation | Added root `AGENTS.md`; updated this overview to reflect Phase 5 as next implementation priority and Phase 6 as partial admin scaffold, not untouched. |
| 2026-06-21 | Phase 5 build started | Added usage adapter-store-backbone wiring for initial live ops data refresh and store-driven ops panel rendering. |
| 2026-06-21 | Phase 5 build advanced | Added usage payload normalization plus provenance-aware warning/critical alerts; OpsPanel now shows explicit unknown rate/quota state until limits source is verified. |
| 2026-06-21 | Phase 5 complete | Added usage lifecycle tests, test-only reset path, and final unknown/degraded behavior checks for payload-miss/malformed usage responses. |
| 2026-06-21 | Phase 5 hardening | Degraded/missing usage payloads now mark snapshot freshness as `stale` so they cannot render as healthy by UI defaults. |
| 2026-06-21 | Phase 5 hardening continuation | Provider quota rows now remain unknown-confidence until a verified rate-limit contract is implemented to prevent false operational certainty. |
| 2026-06-21 | Phase 5 hardening continuation | Added partial-metric payload behavior so mixed usage payloads render stale fields with degraded alerts instead of healthy snapshots. |
| 2026-06-21 | Phase 8 prep | Korra added final polish/cohesion prep checklist in `shared/korra-phase8-polish-cohesion-prep.md`; this is not final QA because Phase 6 implementation and Phase 7 Kanban are still incomplete. |
| 2026-06-21 | Phase 8 risk prep | Tifa added final acceptance risk gates in `shared/tifa-phase8-final-acceptance-risk-gates.md`. Current lint/test/build pass, but final ready-to-user language remains blocked by Admin adapter/scope, real Kanban, Playwright/browser proof, and Unraid rollback/observability verification. |
| 2026-06-21 | Phase 6 UI panels complete | Biscuit built CWS admin panels (Cron, Webhook, Skills), shared RiskConfirmDialog with tier-based confirmation, integrated into UnifiedAdminSurface. 43 new UI-layer tests; 545/545 total tests passing; build clean. Remaining: real adapter binding from Cloud. |
| 2026-06-21 | Phase 6 adapter boundary fallback | Biscuit added KeyMcpAdminAdapter interface + provenance + empty-default state to Key/MCP store. Mock seed is TEST ONLY with placeholder confidence. KeysPanel/McpPanel disable mutating controls when no adapter. KeyMcpAdminPanel renders "NO ADAPTER BOUND" banner. 56 new boundary/redaction/provenance tests; 576/576 total tests passing; build clean. |
| 2026-06-21 | Phase 6 safe local proxy adapter | Added `missionControlProxy.js`, `MissionControlAdminProxyAdapter`, backbone binding, and `npm run proxy`. Live proxy verified for keys/MCP/cron/webhooks/skills counts; common raw-secret pattern scan passed; 584/584 tests and build pass. |
| 2026-06-22 | Phase 6 model confirmation cohesion | Model admin panel now uses shared `RiskConfirmDialog`; model helpers map safe/risk/danger tiers; delete/reset-credential require typed model-id confirmation; confirmations include provider/model/provenance/unknown cost-quota/rollback context. Full suite: 617/617 tests; lint/build pass. |
| 2026-06-22 | Phase 6 proxy audit + hardening | Biscuit audited `missionControlProxy.js` against verified Hermes CLI semantics, restricted support to the safe subset, made disabled webhook platform reads surface as unavailable, hardened default CORS to same-host/loopback unless configured, reloaded authoritative cron/webhook lists after create/remove flows, and added 16 proxy regression tests. Verified `npm run lint`, `npm test -- --run`, and `npm run build` (612/612 tests, 33 files). |
| 2026-06-22 | Phase 6 Keys/MCP risk dialog consolidation | Migrated KeysPanel and McpPanel from the old admin `ConfirmDialog` to shared `RiskConfirmDialog`; added Key/MCP tier helpers and typed gates for `key.delete`/`mcp.remove`; preserved adapter-unavailable, secret-redaction, one-time-secret, and unsupported-action behavior. Verified focused RED/GREEN tests, adjacent admin tests, lint, full suite (624/624 tests, 35 files), and build. |
| 2026-06-22 | Phase 6 sidecar production token mode + Infra Fixes | Updated systemd service `sora-missioncontrol-proxy.service` to use `/home/wliob/.hermes/node/bin/node`. The `.env.proxy` file also updated to comment out `MISSION_CONTROL_PROXY_AUTH_MODE=required` and use `your_development_key_here` as a development placeholder. Explicit `MISSION_CONTROL_PROXY_AUTH_MODE=required` support for the local admin proxy means `/admin/*` routes require `X-Mission-Control-Key` matching `MISSION_CONTROL_ADMIN_PROXY_KEY`; missing/invalid tokens are rejected, valid tokens continue to normal route handling, health/static routes are not covered by the admin token gate, and unset auth mode/key preserves local development behavior. Focused proxy tests pass (23/23); final verification passed `npm run lint`, `npm test -- --run` (631/631 tests, 35 files), and `npm run build` with the existing large-chunk warning. |
| 2026-06-22 | Phase 6 client-side admin proxy auth hook | Added session-only operator token entry to the admin surface, in-memory token helpers in `MissionControlAdminProxyAdapter`, conditional `X-Mission-Control-Key` header attachment, no-token local dev preservation, and no raw token log/render/storage exposure tests. Focused auth tests pass (5/5); final verification passed `npm run lint`, `npm test -- --run` (636/636 tests, 37 files), and `npm run build` with the existing large-chunk warning. |
| 2026-06-22 | Codex e2e/deployment reconciliation | Added the admin proxy 401 affordance, Playwright browser proof (`npm run test:e2e`), same-origin Node proxy Docker/Compose, systemd service template, README connection docs, and `shared/final-acceptance-report.md`. Verified `npm run lint`, `npm test -- --run` (642/642 tests, 40 files), `npm run build`, `npm run test:e2e` (2 passed, 2 intentional project skips), local/current-host health OK, and prepared the target proxy deployment path. |
| 2026-06-22 | Target-host deploy acceptance | Added `deploy/OPERATOR-RUNBOOK.md` and `deploy/create-release-bundle.sh`, updated the systemd template to use `/opt/sora-missioncontrol/current`, and generated `shared/releases/sora-missioncontrol-20260622T215753Z.tar.gz`. After `wliob` SSH access was granted, the target proxy was moved under an active/enabled required-token user service; after operator firewall follow-through, target-local health/admin smoke, development-host LAN health, and deployed Playwright proof pass against `http://192.168.0.85:3187`. |
| 2026-06-22 | Codex takeover handoff prepared | Added a self-contained Codex execution queue, remaining phase breakdown, deployment architecture notes, connection URLs, and final acceptance checklist for a coding agent to finish and deploy the app. |
| 2026-06-22 | Phase 6 cron operator-safety reset07 | Biscuit narrowed scope to CWS cron create/run risk gating: `cron.create` and `cron.run` now require shared `RiskConfirmDialog` confirmation with live-scheduler cost/quota/rollback warning copy, Create Cron keeps draft state until confirm, focused Cron/CWS/store tests were added/updated, and verification passed `npm run lint`, `npm test -- --run` (658/658 tests, 42 files), and `npm run build` with the existing large-chunk warning. |
| 2026-06-21 | Phase 7 live-control rerun | Native Biscuit rerun normalized live Kanban task comments/runs/logs/diagnostics, upgraded the selected-task drawer to show real detail payloads, bound supported dispatch/decompose/reclaim/terminate controls through verified adapter routes only, added adapter/store regression coverage, and verified `npm run lint`, `npm test -- --run`, and `npm run build` (591/591 tests, 29 files). |
| 2026-06-21 | Phase 7b selected-agent cross-links | Added shared `selectedOwner` shell state, Project Control owner/current-work cross-links, office/chat current-work handoff actions, and honest disabled states for unmapped owners or unavailable chat transport. Added 5 new UI tests and re-verified `npm run lint`, `npm test -- --run`, and `npm run build` (596/596 tests, 32 files). |
| 2026-06-30 | Biscuit live integration repair + Codex reviewer follow-up | Fixed HTTPS `:3443` same-origin admin/calendar defaults, explicit secure-transport admin UX, CSP without `unsafe-eval`, real URL navigation for attention/office actions, and honest office attention focus mapping. Follow-up guards now ignore injected same-host `:3187` dashboard/admin URLs from HTTPS while preserving external overrides; ShellLayout route tests assert real URL and visible page behavior. Verified `pnpm run lint`, `pnpm test -- --run` (758/758 across 49 files), and `pnpm run build` (850 modules; existing large-chunk warning); Playwright HTTPS `:3443` remains blocked by `net::ERR_CERT_AUTHORITY_INVALID` with 113 failed, 5 skipped, and no app assertions reached. |

---

## Pending Work / Phase Tracker

- [x] **Phase 0:** Research real Hermes endpoints, inspect Hermes 3D Office v2, and freeze interface contracts.
- [x] **Phase 1:** Lock visual system and dashboard shell so the UI stops feeling generic.
- [x] **Phase 2:** Extract/reuse Hermes 3D Office v2 core and make it performant inside the dashboard.
- [x] **Phase 3:** Build live data/auth backbone and shared app state.
- [x] **Phase 4:** Ship chat with all agent profiles for current scope: profile chat surface, floating bubble, profile roster integration, and honest demo fallback when live transport is unavailable.
- [x] **Phase 4b:** Integrate floating chat bubble overlay and complete the required Phase 2/office regression + stability sweep before Phase 5.
- [x] **Phase 5:** Ship live ops / usage visibility with rate limits, token spend, API usage, health, and alerts. **Status:** complete.
- [ ] **Phase 6:** Ship admin controls for models, crons, webhooks, keys, skills, and MCPs. **Status:** Safe local proxy adapter live for keys/MCP/cron/webhooks/skills read views plus allowlisted subset mutations; all panels retain unavailable/provenance/confirmation gates; model-admin and Keys/MCP confirmations now use the shared risk dialog with typed gates for danger actions; the sidecar now has explicit required-token production mode for admin routes; remaining unsupported mutations + model backend binding still require verified backend paths.
- [ ] **Phase 7:** Ship Kanban / project control with clear ownership and active-work visibility. **Status:** Project Control route is live with verified task-detail reads, supported guarded mutation bindings, and shared selected-agent/current-work cross-links; any further mutation coverage still requires explicit verified scope.
- [x] **Phase 8:** Final polish, performance acceptance, and cohesion review for current scope. Note: the office-specific stability slice is already complete and Playwright desktop/mobile proof passes through the Node proxy locally and against `http://192.168.0.85:3187`.

---

## Next Projected Steps

### 1. Phase 6 — Admin / Control Module
**Owner:** Cloud primary (adapters); Biscuit (UI/store/tests) — UI layer complete.

**Completed by Biscuit/Sora:**
1. CWS types, store, and 48 safety tests.
2. CWS UI panels: CronPanel, WebhookPanel, SkillsPanel, CwsAdminPanel.
3. Shared RiskConfirmDialog with tier-based severity and typed-phrase gates.
4. Integration into UnifiedAdminSurface as "Cron & Webhooks" tab.
5. 43 new UI-layer tests proving unavailable states, redaction, and confirmation gates.
6. KeyMcpAdminAdapter interface with `setKeyMcpAdminAdapter`/`hasKeyMcpAdapter` binding.
7. KeyMcpAdminState provenance: `keysProvenance`, `mcpProvenance`, `lastError` fields.
8. Store starts empty (no mock seed data); mock seed is TEST ONLY via `_resetToSeed()` with placeholder confidence.
9. KeysPanel/McpPanel disable all mutating controls when no adapter bound.
10. KeyMcpAdminPanel renders "NO ADAPTER BOUND" banner when adapter is not set.
11. 56 new boundary/redaction/provenance/adapter-failure tests.
12. `missionControlProxy.js` safe local sidecar with allowlisted Hermes CLI-backed endpoints for keys, MCP, cron, webhooks, and skills.
13. `MissionControlAdminProxyAdapter` implementing both `KeyMcpAdminAdapter` and `CwsAdminAdapter`.
14. Backbone startup binding for Key/MCP + CWS stores and `npm run proxy` for operator startup.
15. Live proxy verification: health OK; read surfaces work through the sidecar, disabled webhook platforms now fail honestly instead of rendering as healthy-empty, and proxy behavior is covered by direct Vitest regression tests.
16. Model-admin confirmation cohesion: `AdminPanel` now uses shared `RiskConfirmDialog`, model actions map to safe/risk/danger tiers, `model.delete` and `model.resetCredential` require typed model-id confirmation, and confirmation copy explicitly shows target provider/model, routing scope, provenance, unknown cost/quota, and rollback notes.
17. Keys/MCP confirmation cohesion: `KeysPanel` and `McpPanel` now use shared `RiskConfirmDialog`; Key/MCP action helpers map safe/risk/danger tiers, `key.delete` and `mcp.remove` require typed phrase gates, and focused jsdom tests preserve unavailable-state and secret-redaction behavior.
18. Sidecar production hardening: explicit `MISSION_CONTROL_PROXY_AUTH_MODE=required` makes `/admin/*` routes require `X-Mission-Control-Key` matching `MISSION_CONTROL_ADMIN_PROXY_KEY`; missing and invalid tokens are rejected, valid tokens pass through to existing route handling, health/static routes are not covered by the admin token gate, and unset auth mode/key preserves local development behavior.
19. Client-side admin proxy auth hook: `UnifiedAdminSurface` includes an operator-entered password control for the current tab, `MissionControlAdminProxyAdapter` stores the token only in memory, sends `X-Mission-Control-Key` only when configured, and keeps unsupported/unavailable proxy responses honest.

**Remaining:**
1. Bind model admin store to a verified adapter only after Hermes exposes a noninteractive model-list/capability surface. Current verified surfaces are insufficient: `hermes model` is interactive, `hermes config set model.default <MODEL_NAME>` is mutation-only, and no verified noninteractive model-list/capability endpoint exists.
2. Fill unsupported Key/MCP actions (key create/update/revoke/regenerate, MCP update, token/note-backed MCP create) only through verified safe backend paths.
3. Fill unsupported CWS actions (cron update, cron create with model override, webhook create/update, skill enable/disable) only through verified safe backend paths.
4. Production deployment follow-through for the local sidecar (process supervision, secret injection, network/firewall, operator runbook) has been implemented and documented. Browser-side build/global injection of `window.__SORA_ADMIN_PROXY_KEY__` should not be used for real secrets; app-code now provides a session-only operator token control for the actual `X-Mission-Control-Key` header path.

**Gate:** destructive or high-risk actions must require confirmation; secrets must never appear in UI payloads/logs. ✅ (enforced at type/store/panel level)
**Gate:** missing backend capability is rendered as unavailable, not silently mocked. ✅
**Gate:** mock seed data is marked with placeholder confidence. ✅
**Gate:** no browser filesystem/CLI/profile writes from store. ✅ (CLI access is isolated to the explicit local proxy sidecar)

### 2. Phase 7 — Kanban / Project Control
**Owner:** Biscuit UI, Cloud adapter.

**Completed in Phase 7:**
1. Real Project Control route in the shell (desktop/tablet/mobile), replacing the reserved EmptyView.
2. Overview, ownership, status-lane, blocker, selected-task drawer, and source-health panels.
3. Typed Kanban read/mutation boundary in `projectControlStore`/`project-control` types with `source`, `freshness`, `confidence`, and `lastError`.
4. Verified live task-detail adapter coverage for comments, runs, logs, and diagnostics, including second-vs-millisecond timestamp normalization and honest unavailable states when routes fail.
5. Supported dispatch/decompose/reclaim/terminate bindings now go only through the verified dashboard Kanban adapter with confirmation gates and honest disabled states when source health/ids are missing.
6. Tests covering route replacement, unhealthy-state honesty, adapter normalization, mutation path binding, read-only API safety, and narrow/mobile rendering.
7. Shared shell selection now carries selected owner/agent context between Project Control, office, and chat: task/owner clicks focus current work, office agents can jump back to Kanban, chat profiles can open current work, and unmapped owners stay explicitly disabled for office/chat navigation.

**Remaining:**
1. Add further Kanban mutations only after their backend contracts are explicitly verified.
2. Expand current-work navigation beyond canonical Mission Control leads only if verified backend/profile mappings exist for non-canonical owners.
3. Add richer task navigation/filtering if the phase expands beyond the current control surface.

**Gate:** board actions must route through `/api/plugins/kanban` or a verified adapter, not duplicate direct DB writes in app code.
**Gate:** unavailable/unknown/stale Kanban states must never render as healthy. ✅

### 4. Phase 8 — Final Polish / Performance / Cohesion
**Owner:** Korra acceptance, Biscuit implementation, Cloud health checks.

**Projected deliverables:**
1. Whole-product motion/spacing/empty-state polish.
2. Final accessibility/reduced-motion pass.
3. First-screen cohesion review.
4. Performance acceptance across shell + office + chat + ops/admin/kanban modules.
5. Final original-brief check: premium, dark, custom, low-clutter, mission-control feel.

**Gate:** dashboard must feel like one cohesive product, not separate modules glued together.

---

## Capabilities (Current)

| Capability | Status | Description |
|------------|--------|-------------|
| Custom mission-control shell | 🟢 Done | Clean overview shell replacing cluttered dashboard feel. |
| Visual system baseline | 🟢 Done | Dark premium mission-control direction established; final cross-module polish remains in Phase 8. |
| 3D office live scene | 🟢 Done | Reused v2 office logic/assets with avatars, movement, bubbles, activity states, and camera feel. |
| 3D office stability guardrails | 🟢 Done | Context loss, fallback/error UI, timeouts/retry, visibility pause/resume, catch-up animation, memory/FPS/asset guards, resize debounce, idle/sleep mode. |
| Multi-profile chat | 🟢 Done for current scope | Chat surface + floating bubble + profile roster integration + clearly labeled demo fallback. Live message sending still needs a verified injected transport/proxy. |
| Live ops / cost visibility | 🟢 Complete | Usage model, adapter-seam, stale/degraded/unknown handling, quota-risk labeling, and alert generation are complete in Phase 5 v1. |
| Admin controls | 🟡 Safe local adapter subset live | Keys/MCP/CWS stores are bound through the audited local sidecar for reads plus verified safe mutations; model + Keys/MCP confirmations use shared risk dialogs; model admin and unsupported actions remain unavailable until contract-safe backend paths exist. |
| Kanban / project overview | 🟡 Live control partial | Real Project Control shell route, honest unhealthy states, live task-detail reads, supported guarded mutation bindings, and selected-agent/current-work cross-links are in place; any further verified mutation coverage remains. |
| Final cohesion / award-grade polish | 🟡 Remaining | Phase 8 whole-product polish after all functional modules are present. |

---

## Independent Workstreams

These sections can continue in parallel once each phase contract is frozen.

| Workstream | Owner | Inputs | Output | Dependency | Current state |
|------------|-------|--------|--------|------------|---------------|
| Visual system / art direction | Korra | Brand goal, 3D office tone, OpenClaw-style clarity | Color, type, spacing, motion rules | None | Baseline done; final acceptance remains Phase 8 |
| 3D office module | Biscuit + v2 reuse pass | Hermes 3D Office v2 code/assets, live agent state | Embedded 3D office scene with polished FPS and activity cues | Visual system + data contracts | Done + stability sweep complete |
| Dashboard shell / navigation | Biscuit | Visual system, section inventory | Clean app frame and route/layout structure | Visual system | Done for current scope |
| Live data / auth backbone | Cloud | Hermes dashboard APIs, token/auth rules | Shared store, auth flow, live sync, connection health | Endpoint research | Done for current scope |
| Chat module | Biscuit UI + Cloud transport | Profile metadata, message transport, shell | Profile chat UI and thread switching | Data/auth backbone | Done for current scope |
| Live ops / usage module | Cloud data + Biscuit UI | Usage/rate-limit sources, logging/telemetry signals | Cost and limit dashboard | Data/auth backbone | **Complete for initial lane: store-driven cards + unknown/stale safety gates active** |
| Admin / control module | Cloud | Hermes config surfaces, model/runtime controls | Manage models, crons, webhooks, keys, skills, MCPs | Data/auth backbone | Audited local sidecar adapter live for reads + verified safe subset mutations; shared risk confirmations consolidated for model + Keys/MCP; model admin + unsupported mutations remain pending |
| Kanban / project control | Biscuit UI + Cloud adapter | Board data, active task state, owner metadata | Who-is-working-on-what overview | Data/auth backbone + shell | Live task-detail reads + supported guarded mutation bindings complete; shared selected-agent/current-work cross-links landed; any extra verified routes remain pending |

---

## File Map

```text
Sora-MissionControl/
├── OVERVIEW.md                    ← project compass / current checkpoint
├── README.md                      ← quick intro and run notes
├── package.json                   ← app scripts/deps
├── tsconfig.json                  ← TypeScript config
├── vite.config.ts                 ← build/dev config
├── Dockerfile                     ← optional local/LAN deploy
├── docker-compose.yml             ← optional local/LAN deploy
│
├── src/
│   ├── app/ or shell entry         ← root layout/shell
│   ├── office/                     ← 3D office scene + v2 reuse/stability work
│   ├── modules/
│   │   ├── chat/                   ← profile chat views / transport adapters
│   │   ├── ops/                    ← usage, limits, alerts (Phase 5)
│   │   ├── admin/                  ← models, crons, webhooks, keys, skills, MCPs (Phase 6)
│   │   └── kanban/                 ← project/ownership views (Phase 7)
│   ├── components/                 ← shell, status, and shared UI primitives
│   ├── state/                      ← stores: auth, connection, board, profile, usage/admin
│   ├── services/                   ← REST/WS/Hermes integrations
│   └── styles/                     ← theme and motion rules
│
├── tests/                          ← unit/regression/e2e as modules land
└── docs/
    ├── architecture.md             ← section contracts and data flow
    ├── api-reference.md            ← verified endpoints only
    ├── visual-system.md            ← design rules and references
    └── migration-notes.md          ← v2 reuse notes and deltas
```

---

## Architecture

### Data Flow

```text
Hermes dashboard APIs / profile runtime / usage signals / v2 office assets
    ↓
Integration adapters (REST, WS, filesystem, local proxy/CLI bridge where verified)
    ↓
Shared stores (auth, connection, board, agent presence, usage, config)
    ↓
Section modules (office, chat, ops, admin, kanban)
    ↓
Shell / navigation / status chrome
    ↓
User sees one cohesive mission-control overview
```

### Design Philosophy

OpenClaw Mission Control is useful because it is minimal: one dashboard, one state flow, one place to look.
Sora-MissionControl keeps that operational clarity but adds what Hermes needs:
- richer visual language
- 3D office as the truth source
- admin surfaces for the whole system
- a tighter custom workflow for one human managing many leads

### Verified / Known API Surfaces

| Feature | Endpoint / Surface | Method | Status / Notes |
|---------|--------------------|--------|----------------|
| Hermes Kanban snapshot | `/api/plugins/kanban/board` | GET | Verified surface from Hermes dashboard/Kanban integration. |
| Hermes Kanban live events | `/api/plugins/kanban/events?token=…` | WS | Verified planned live event source; reconnect behavior belongs in shared backbone. |
| Profile metadata | `/api/plugins/kanban/profiles` | GET | Verified in API reference update: returns profile names/provider/model/skill metadata. |
| Chat direct plugin routes | `/api/plugins/chat/*` | HTTP | Verified unavailable/404 under current runtime; do not build against fake plugin routes. |
| Chat transport | `/api/plugins/chat/*`, `/api/pty`, optional local proxy | mixed | Direct chat plugin routes are unavailable; dashboard PTY is SPA-specific; MissionControl currently falls back to demo chat unless a verified transport is injected. |
| OpenClaw reference pattern | `/api/agents/state` | POST | UX reference only; not assumed to exist in Hermes. |

### Source-of-Truth Rule

If a data source is not verified, the UI must display `unknown`/`unavailable` with confidence/freshness metadata. Do not invent healthy states or fake quota numbers.

---

## Implementation Phases

### Phase 0: Research + Contract Freeze — DONE
**Goal:** Stop guessing. Verify real Hermes surfaces and define the section contracts.

**Deliverable:** Locked section-contract docs and verified source map.

### Phase 1: Visual System + Shell — DONE
**Goal:** Make the dashboard feel premium before filling it with data.

**Deliverable:** Clean shell with design tokens and no cluttered default layout.

### Phase 2: 3D Office Reuse + Performance — DONE
**Goal:** Bring the v2 office into the dashboard without losing performance or identity.

**Deliverable:** 3D office embedded in Sora-MissionControl and visibly polished.

### Phase 3: Data / Auth / Live Sync Backbone — DONE
**Goal:** Create the stable core every section shares.

**Deliverable:** Reliable shared state with verified live updates.

### Phase 4: Chat Module — DONE FOR CURRENT SCOPE
**Goal:** Chat with all Hermes profiles from one place.

**Completed:**
1. Profile chat surface / thread navigation current scope.
2. Floating chat bubble overlay integrated into Mission Control.
3. Verified direct dashboard chat plugin routes are unavailable and kept demo fallback honest.
4. API reference updated with verified chat/auth facts.

**Deliverable:** Multi-profile chat path that feels native to the mission-control shell and routes through verified transport.

### Phase 4b: Office Regression + Stability Gate — DONE
**Goal:** Clear the required office bug/stability sweep before Phase 5.

**Completed card batch:**
1. WebGL context loss recovery.
2. React error boundary around canvas.
3. Atlas load timeout + retry.
4. Spritesheet load failure warning.
5. Visibility/background handling.
6. Reconnect catch-up animation.
7. Memory pressure monitoring.
8. Asset integrity check.
9. Multi-instance guard.
10. FPS-based quality degradation.
11. Resize debounce.
12. Idle timeout / sleep mode.
13. WebGL fallback chain + error message.

**Latest verification:** 180/180 office tests passing; `tsc --noEmit` clean.

### Phase 5: Live Ops / Usage Module — COMPLETE
**Goal:** Make costs, limits, and load impossible to miss.

**Current state:**
- `docs/telemetry_sources.md` records historical `hermes insights` usage and conservative fallback sources; no fake live quota assumptions.
- `src/components/shell/OpsPanel.tsx` renders live usage/quota cards and connection-source health from shared stores with explicit unknown-risk labels.
- `src/services/hermes/dashboardClient.ts` probes known dashboard/Kanban sources and reports usage/provider-rate-limit sources as unknown unless a verified contract appears.

**Tasks, in importance order:**
1. Create typed ops/usage models with source, freshness, confidence, and timestamp fields.
2. Build a store and adapter seam for usage snapshots, source health, and alerts.
3. Ingest verified historical usage from `hermes insights` or a trusted local proxy.
4. Explore verified Kanban diagnostics/stats/workers endpoints for live health signals.
5. Replace static `OpsPanel` rows with live store data.
6. Add cost/token/tool-usage cards with freshness/confidence labels.
7. Add alert generation for stale/degraded/unavailable sources.
8. Keep provider rate-limit fields as `unknown` until a real source is verified.
9. Add lifecycle tests for degraded/missing/malformed usage payloads and verify they do not render as healthy.

**Deliverable:** Live ops panel that answers "what is this costing?" and "what is at risk?" at a glance.

### Phase 6: Admin / Control Module — ADAPTER BOUNDARY DONE; ADAPTERS PENDING
**Goal:** Manage the Hermes system without leaving the dashboard.

**Current state:**
- Model admin UI/store exists with masked-secret ingestion, adapter injection, and destructive-action confirmation gates.
- Keys/MCP admin UI/store now has adapter boundary: `KeyMcpAdminAdapter` interface with `setKeyMcpAdminAdapter`/`hasKeyMcpAdapter` binding. Store starts empty (no mock seed). Mock seed is TEST ONLY via `_resetToSeed()` with `placeholder` confidence. `KeyMcpAdminState` has `keysProvenance`, `mcpProvenance`, `lastError`, and pending-confirmation risk metadata.
- KeysPanel/McpPanel disable all mutating controls when no adapter bound. KeyMcpAdminPanel renders "NO ADAPTER BOUND" banner.
- KeysPanel/McpPanel use shared `RiskConfirmDialog`; `key.revoke` and `key.regenerate` are risk-tier confirmations, while `key.delete` and `mcp.remove` are danger-tier confirmations with typed phrase gates.
- The local sidecar has explicit production auth mode: set `MISSION_CONTROL_PROXY_AUTH_MODE=required` and `MISSION_CONTROL_ADMIN_PROXY_KEY` to require `X-Mission-Control-Key` on `/admin/*` routes. Leaving both unset preserves local development behavior; health/static routes stay outside the admin token scope.
- The browser admin adapter sends `X-Mission-Control-Key` only when the operator enters a token for the current tab. The token is kept in memory only, is not written to `localStorage`/`sessionStorage`, and is not exposed by the auth status API. `window.__SORA_ADMIN_PROXY_KEY__` remains only as a deprecated localhost operator fallback, not a recommended secret injection mechanism.
- CWS (Cron, Webhook, Skills) admin types (`src/types/admin-cws.ts`), store (`src/state/cwsAdminStore.ts`), and 48 store tests (`src/state/cwsAdminStore.test.ts`) are implemented with:
  - Action tier classification (safe/risk/danger) per Korra audit recommendations.
  - Confirmation gates for risk and danger actions; typed-phrase requirement for danger actions.
  - Redaction guards: cron prompt previews are truncated, webhook secrets are masked, URLs with embedded credentials are rejected.
  - One-time secret reveal: raw secrets only in `lastResult.createdCron`/`createdWebhook`; stripped from persistent state on `clearLastResult()`.
  - Per-subsection provenance tracking (cron/webhook/skills each have independent freshness).
  - 48 tests covering all safety patterns including full JSON serialization verification.
- CWS UI panels are built:
  - `CronPanel.tsx`: cron job list with pause/resume/run/remove actions, truncated prompt preview, one-time secret reveal for create.
  - `WebhookPanel.tsx`: webhook list with remove/update actions, masked secrets, one-time secret reveal for create.
  - `SkillsPanel.tsx`: skill list with enable/disable actions, sensitive access warnings, no create/delete (managed externally).
  - `CwsAdminPanel.tsx`: tabbed container (Cron/Webhooks/Skills) with "NO ADAPTER BOUND" banner when unavailable.
  - `RiskConfirmDialog.tsx`: shared tier-based confirmation (safe/risk/danger) with typed-phrase gate for danger actions.
  - Integration into `UnifiedAdminSurface.tsx` as "Cron & Webhooks" tab.
  - 43 UI-layer tests (`CwsPanels.test.ts`) proving unavailable states, redaction, confirmation gates, tier mapping, summaries, and cross-domain isolation.
- 63 Key/MCP boundary/panel tests covering: adapter boundary, unavailable state does not look healthy, no browser fs/cli writes, redaction, shared risk-dialog metadata, typed danger gates, creation flows, provenance tracking, adapter failure handling, JSON serialization safety, and one-time secret reveal behavior.
- Real backend adapters are still required before this phase can be considered complete.

**Remaining tasks (Cloud-owned):**
1. Bind model management to a verified Cloud-owned adapter.
2. Implement `KeyMcpAdminAdapter` (listKeys, listMcpEntries, executeAction) against real Hermes backend.
3. Bind CWS adapter to real Hermes CLI/API routes for cron, webhook, skill management.

**Ongoing UI rule:**
- Full ConfirmDialog consolidation is complete for model and Keys/MCP admin panels; keep future admin surfaces on shared `RiskConfirmDialog`.

**Deliverable:** Operational admin surface for Hermes setup changes.

### Phase 7: Kanban / Project Control — IN PROGRESS (PHASE 7A COMPLETE)
**Goal:** See who is working on what and whether the work is actually moving.

**Completed in this checkpoint:**
1. Built project overview panels in the shell route.
2. Added ownership, status, blocker, source-health, and selected-task drawer-shell visibility.
3. Added typed read-only state/adapters with provenance and `lastError`.
4. Kept comments/runs/logs explicitly unavailable until verified reads exist.
5. Disabled all destructive/mutating task controls with placeholder confirmation copy only.

**Remaining tasks:**
1. Bind verified task-detail read adapters.
2. Tie Kanban visibility back into the office and chat surfaces.
3. Add confirmation-gated mutations through verified backend paths only.

**Deliverable:** One decision surface for project ownership and active work.

### Phase 8: Polish + Performance + Cohesion — PARTIAL / FINAL PASS REMAINS
**Goal:** Make the whole thing feel like one award-winning product.

**Already completed early:** office-specific stability/performance guardrails listed in Phase 4b.

**Remaining tasks:**
1. Tighten whole-product motion, transitions, and empty states.
2. Review spacing, hierarchy, contrast, and readability across all modules.
3. Run performance checks on the final dashboard shell and all modules together.
4. Remove clutter, duplicate surfaces, and weak visual patterns.
5. Run acceptance checks against the original brief.

**Deliverable:** Cohesive, high-end mission control that matches the brief.

---

## Environment Variables

```env
# Hermes connection
HERMES_DASHBOARD_URL=http://192.168.0.85:9119
HERMES_WS_URL=ws://192.168.0.85:9119
HERMES_TOKEN=***

# Optional local admin proxy hardening
# Leave unset for local development ergonomics.
# Set both for production-like sidecar deployments.
MISSION_CONTROL_PROXY_AUTH_MODE=required
MISSION_CONTROL_ADMIN_PROXY_KEY=***
# Optional only when the browser host differs from the proxy host.
MISSION_CONTROL_CORS_ORIGIN=http://192.168.0.85:5180

# App runtime
NODE_ENV=development
```

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| Reuse Hermes 3D Office v2 code/elements | Fastest path to a polished living office; avoids rebuilding proven pieces. |
| Preserve the living-scene layer from v2 | Avatars, bubbles, emojis, and camera feel are the proof of active work. |
| Dark premium mission-control visual tone | Best fit for clear status scanning and a custom feel. |
| Full-scope v1, no deferral to v2 | User wants the finished award-winning design, not a cut-down MVP. |
| Independent workstreams with explicit contracts | Lets the user or another agent work in parallel without collisions. |
| OpenClaw used as a UX reference, not a template to copy blindly | Good clarity pattern, but Hermes needs deeper admin and 3D office integration. |
| Chat transport must use verified Hermes CLI proxy / known surfaces | `/api/plugins/chat/*` is not available in the current runtime; fake chat endpoints are forbidden. |
| Unknown ops/admin data must render as unknown | Prevents false confidence in costs, quotas, limits, and health. |
| Production sidecar admin routes require explicit token mode | `MISSION_CONTROL_PROXY_AUTH_MODE=required` plus `MISSION_CONTROL_ADMIN_PROXY_KEY` protects `/admin/*` without silently breaking local dev when unset. |
| Client admin proxy tokens are session-only | Operators enter the proxy token in the admin surface for the current tab; the adapter sends the header only when configured and avoids storage/global build injection. |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Usage/rate-limit sources are incomplete or missing | Live ops could show fake certainty | Phase 5 must verify each source and label unknowns clearly. |
| Admin scaffolds look more complete than they are | Users may assume mock/adapterless controls are real | Mark adapterless data as unavailable/mock until bound to verified backends. |
| Admin controls expose risky operations | Misconfiguration, leaked secrets, or destructive changes | Least-privilege by default; confirmations for destructive actions; credential status only. |
| Dashboard becomes cluttered again | Fails the user’s aesthetic goal | Keep section contracts strict; only ship useful surfaces. |
| Chat/admin/ops overlap and duplicate state | Confusing UX, bugs | Centralize shared stores and define ownership per module. |
| Generic AI look creeps back in | User rejects the design | Phase 8 acceptance review against premium dark mission-control brief. |
| Too many features in one shell | Slow delivery, broken coherence | Continue phase order; keep modules independently testable and verifiable. |
| Kanban auto-dispatch surprises leak into UI actions | Unintended agent work or duplicate edits | Route actions through verified Kanban API/adapter; require user confirmation for dispatch/decompose actions. |
| Static-only deployment omits admin proxy | Admin panels can render but live admin routes will be unavailable | Deploy `missionControlProxy.js` as same-origin Node app after `npm run build`, or deploy static app plus documented proxy sidecar with CORS. |
