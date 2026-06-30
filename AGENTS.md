# Sora-MissionControl Agent Handoff

> **Last Updated:** 2026-06-30
> **Project State:** Phases 0-5 complete; Phase 6/7 have verified safe subsets and honest unavailable states; Phase 8 has browser/e2e proof. **Canonical production deployment:** Docker container `sora-missioncontrol-proxy` on Unraid Tower (192.168.10.5), HTTPS on port 3443, plain HTTP on port 3187 locked to health-only (sensitive routes return 403). A development/staging systemd service exists on `192.168.0.85:3187` but the primary user-facing URL is `https://192.168.10.5:3443`.
> **Companion Status File:** Keep `OVERVIEW.md` updated after each meaningful task with current status, next steps, and blockers.

---

## How To Use This File

This is the root handoff for agents working in this repository. Update it whenever a task changes project direction, phase status, blockers, verification results, or the next best action. Profile-specific handoffs live in `biscuit/`, `cloud/`, `korra/`, `lelouch/`, and `tifa/`; this file is the shared project-level compass.

When you finish a task:
1. Update the phase/status notes in this file if anything changed.
2. Update `OVERVIEW.md` with the same current-status truth.
3. Record blockers plainly instead of hiding them behind optimistic language.
4. Keep unverified runtime data labeled `unknown`, `unavailable`, or `mock`.

---

## Codex Coding Agent Takeover Directive

You are the coding agent finishing Sora-MissionControl. This project has already had multiple agents and Kanban workers touch it. Your first job is to reconcile, not blindly continue.

### Operating rules

1. Read `OVERVIEW.md` first, especially **Codex Takeover Brief — Remaining Work To Finish + Deploy**.
2. Treat `OVERVIEW.md` as the project compass and update it after every meaningful change.
3. Do not fake backend support. If Hermes does not expose a verified safe route, keep the UI `unknown`, `unavailable`, disabled, or `501`.
4. Never store, print, render, commit, or document real admin proxy tokens. Use placeholders in docs and runtime env/secret injection for actual values.
5. Preserve existing dirty work until reviewed. Do not mass-reformat or delete unrelated changes.
6. Keep changes small enough to verify. After each slice, run the narrow relevant tests before full gates.
7. Before final completion, produce `shared/final-acceptance-report.md` with exact commands, outputs, deployed URLs, and known limitations.

### Current known state

- Phases 0-5 are complete for current scope.
- Phase 6 has a live audited `missionControlProxy.js` safe subset for keys/MCP/cron/webhooks/skills, required-token mode, and session-only browser token entry.
- Phase 6 still blocks on contract-safe model-admin backend and unsupported mutations. Keep these unavailable unless verified.
- Phase 7 has live Project Control task detail reads, guarded safe mutation bindings, and current-work cross-links.
- Phase 8 polish has Codex browser proof through Playwright desktop/mobile checks.
- Final deployment is verified on Unraid Tower (192.168.10.5): Docker container `sora-missioncontrol-proxy` with HTTPS on 3443 (canonical user-facing) and plain HTTP on 3187 (health-only, sensitive routes blocked with 403). A development/staging systemd service is also available on `192.168.0.85:3187`.
- 2026-06-30 Biscuit live integration repair: admin/calendar browser defaults now use same-origin HTTPS on `:3443` instead of cross-port `:3187`; secure-transport `403` produces an HTTPS-required admin UX instead of credential entry; proxy CSP no longer includes `unsafe-eval`; the existing same-origin Kanban WebSocket proxy remains the selected live-data path; attention/office controls now navigate real URL paths or render disabled with a reason; office attention focus only maps canonical agents with verified board tasks. `pnpm run lint`, `pnpm test -- --run` (753/753), and `pnpm run build` pass. Playwright against `https://192.168.10.5:3443` is blocked by Chromium certificate trust: `net::ERR_CERT_AUTHORITY_INVALID`.
- 2026-06-30 Kanban `t_42907006`: Office PixiJS now imports Pixi v8's official no-runtime-eval shim (`pixi.js/unsafe-eval`) at the `GameRuntime` boundary so `/office` can initialize WebGL under the production CSP without adding `unsafe-eval`. Local proxy browser proof rendered one canvas at `http://127.0.0.1:3187/office` with CSP still omitting `unsafe-eval`; unrelated local auth/offline console errors remain outside this fix.

### Files likely relevant

- `missionControlProxy.js` — Node app serving admin routes and `dist/` static assets; default port `3187`.
- `.env.proxy` — local template only; do not place production secrets here in git.
- `src/services/hermes/adminProxyAdapter.ts` — browser adapter for admin proxy + session-only token header.
- `src/services/hermes/projectControlAdapter.ts` — Project Control/Kanban adapter boundary.
- `src/components/admin/*` — admin UI, auth affordance, risk confirmations.
- `src/components/kanban/*` — Project Control surface.
- `src/components/shell/*` and `src/components/common/*` — final polish/navigation/presence.
- `Dockerfile` / `docker-compose.yml` — same-origin Node proxy deployment path for `missionControlProxy.js` + built `dist/`.
- `deploy/sora-missioncontrol-proxy.service` — systemd template using runtime secret injection.
- `deploy/OPERATOR-RUNBOOK.md` and `deploy/create-release-bundle.sh` — operator handoff path for target-host deployment when SSH is unavailable from this session.
- `shared/` reports — prior agent handoffs and verification notes.

### Required verification gates

Run before final handoff:

```bash
npm run lint
npm test -- --run
npm run build
# If you add Playwright/e2e:
npm run test:e2e
```

Also smoke test deployed runtime:

```bash
# Production — Unraid Tower
curl -fsk https://192.168.10.5:3443/health
curl -fsS http://192.168.10.5:3187/health
# Sensitive routes on HTTP MUST return 403:
curl -s -o /dev/null -w '%{http_code}' http://192.168.10.5:3187/admin/keys

# Staging — baset-ai (if reachable)
curl -fsS http://192.168.0.85:3187/health

# Local test
curl -fsS http://127.0.0.1:3187/health
```

If the final port/host differs, update both commands and docs with the real values.

### Final connection docs to write before completion

Update `README.md`, `OVERVIEW.md`, and this file with:

- final app URL: `https://192.168.10.5:3443`
- health URL: `https://192.168.10.5:3443/health` (HTTP fallback: `http://192.168.10.5:3187/health`)
- Hermes dashboard/Kanban source URL: `http://192.168.0.85:9119/kanban`
- admin proxy URL: `https://192.168.10.5:3443/admin/*` (token required)
- service/container name: `sora-missioncontrol-proxy` (Docker on Unraid)
- start/stop/restart commands: via `ssh root@192.168.10.5 'docker restart sora-missioncontrol-proxy'`
- where runtime secrets come from: `/mnt/user/appdata/sora-missioncontrol/runtime/proxy.env` (mode 0600 on Unraid)
- rollback command: see `deploy/OPERATOR-RUNBOOK.md`
- smoke-test output: see `shared/smc-repair-cloud-runtime-report.md`

Expected defaults:

- Playwright/local test app + proxy: `http://127.0.0.1:3187` while `npm run test:e2e` is running
- Development host LAN smoke: `http://192.168.10.18:3187` while a local proxy is running
- **Canonical production app + proxy:** `https://192.168.10.5:3443`
- **Production health (HTTPS):** `https://192.168.10.5:3443/health`
- **Production health (HTTP):** `http://192.168.10.5:3187/health`
- Staging (baset-ai): `http://192.168.0.85:3187`
- Hermes Dashboard/Kanban source: `http://192.168.0.85:9119/kanban`

---

## Current Understanding

Sora-MissionControl is a local LAN Hermes mission-control dashboard built with React 18, TypeScript, Vite, PixiJS v8, Zustand, and XState. It combines a premium dark dashboard shell, a reused Hermes 3D Office scene, profile chat, live Kanban/runtime state, telemetry, admin controls, and project-control views.

The app already has:
- Shell/navigation and design-system baseline.
- Embedded 3D office module with stability and performance guardrails.
- Dashboard REST/WS backbone for Kanban/session state.
- Profile chat UI plus floating chat overlay.
- Admin model store/UI scaffolding with secret-redaction and confirmation gates.
- API key and MCP admin UI/store with adapter boundaries, unavailable-state handling, secret redaction, and shared risk confirmations.
- Ops panel shell that honestly renders unknown telemetry until sources are verified.

The next remaining theme is finishing Phase 6 adapter coverage plus any still-unverified Phase 7 Kanban routes or richer navigation follow-through. Phase 5 live-ops is complete with unknown-safe telemetry behavior, and the selected-agent/current-work cross-link slice is now wired through shared shell state.

---

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| Phase 0: Research + contracts | Complete | Verified source maps and section contracts exist in `docs/`. |
| Phase 1: Visual system + shell | Complete | First-screen dashboard frame and shared primitives are in place. |
| Phase 2: 3D office reuse | Complete | Office module, assets, runtime, and regression suite are present. |
| Phase 3: Data/auth/live sync | Complete for current scope | REST board/profile/worker sync and Kanban WS connection path exist. |
| Phase 4: Chat | Complete for current scope | UI and fallback behavior exist; direct chat plugin routes are verified unavailable. |
| Phase 4b: Office stability gate | Complete | Context loss, atlas retry, FPS/memory/idle/resume safeguards are covered. |
| Phase 5: Live ops/usage | Complete | Source and alert model are live, partial-degraded handling is in place, and quota remains unknown until verified. |
| Phase 6: Admin controls | Live local proxy subset + adapter boundary; model admin backend and unsupported mutations pending | Key/MCP + CWS stores are bound through `missionControlProxy.js` + `MissionControlAdminProxyAdapter` for verified reads and a narrow safe CLI-backed mutation subset. Webhook platform-disabled reads now surface as unavailable instead of fake-empty, default CORS now allows same-host/loopback only unless configured, unsupported actions return honest `501` responses, and production deployments can require `X-Mission-Control-Key` on `/admin/*` routes with `MISSION_CONTROL_PROXY_AUTH_MODE=required` plus `MISSION_CONTROL_ADMIN_PROXY_KEY`. The client now has an operator-entered, session-only in-memory token control that attaches `X-Mission-Control-Key` only when configured; no-token local dev remains unchanged, and the legacy `window.__SORA_ADMIN_PROXY_KEY__` path is deprecated/limited to localhost operator use. The systemd service now uses Hermes's stable Node runtime for `ExecStart`. Model-admin and Keys/MCP confirmations are unified on `RiskConfirmDialog` with risk/danger tiers; model delete/reset-credential and Key/MCP danger actions (`key.delete`, `mcp.remove`) require typed confirmation gates. Model backend binding remains blocked because the verified Hermes model surfaces are interactive `hermes model`, mutation-only `hermes config set model.default <MODEL_NAME>`, and no verified noninteractive model-list/capability endpoint.
| Phase 7: Kanban/project control | Live task reads + verified safe mutation bindings partial; cross-links landed | Shell route renders a real Project Control surface with overview, ownership, status, blockers, source health, current-work focus, and a selected-task drawer. Verified task comments/runs/logs now flow through the dashboard adapter, supported Kanban mutations route through guarded adapter-only bindings, office/chat/current-work handoff now shares shell selection state, and unsupported paths remain honestly disabled. |
| Phase 8: Final polish/cohesion | Browser + LAN acceptance complete for current scope; Cloud runtime repair 2026-06-30 reconciled HTTPS primary | Playwright desktop/mobile checks pass through the Node proxy deployment path locally and against deployed URLs. Target-local and LAN proxy health are verified. Canonical production at `https://192.168.10.5:3443` with HTTP 3187 locked fallback. |

---

## Priority Plan

### 1. Phase 5: Live Ops / Usage Visibility

This is the next most important lane because it answers the dashboard's core operational questions: what is active, what is costing money, and what needs attention.

Immediate tasks:
1. Convert `docs/telemetry_sources.md` into concrete adapter requirements for `hermes insights`, Kanban diagnostics/stats/workers, and any verified local telemetry.
2. Add a typed ops/usage domain model with provenance, freshness, confidence, and timestamps.
3. Build a store/adapter boundary for usage snapshots, source health, and alerts.
4. Replace the static `OpsPanel` source list with live store-driven rows.
5. Add consumption cards for historical token/cost/tool usage from verified sources.
6. Keep provider rate limits as `unknown` until a real quota/rate-limit source is verified.
7. Add tests proving unknown, stale, degraded, and unavailable states do not render as healthy.

Completion gate:
- No fake quota data.
- Every metric has source/freshness/confidence.
- Real-time provider quota remains visibly unknown unless actually verified.

### 2. Phase 6: Admin Controls

Admin has UI, store, types, tests, and panels. Remaining work is real adapter binding from Cloud.

Completed:
1. CWS types, store, and 48 tests in place (`src/types/admin-cws.ts`, `src/state/cwsAdminStore.ts`).
2. CWS UI panels built: CronPanel, WebhookPanel, SkillsPanel, CwsAdminPanel (`src/components/admin/`).
3. Shared RiskConfirmDialog with tier-based severity (safe/risk/danger) and typed-phrase gates for destructive actions.
4. CWS panels integrated into UnifiedAdminSurface as "Cron & Webhooks" tab.
5. 43 new UI-layer tests (`CwsPanels.test.ts`) proving unavailable states, redaction, confirmation gates, tier mapping, and cross-domain isolation.
6. Unavailable banner rendered when no adapter bound (no mock healthy data).
7. Raw secrets never persist in store state or rendered UI; one-time reveal only via lastResult/clearLastResult.
8. KeyMcpAdminAdapter interface added to `adminKeyMcpStore.ts` with `setKeyMcpAdminAdapter`/`hasKeyMcpAdapter` binding.
9. KeyMcpAdminState now has `keysProvenance`, `mcpProvenance`, and `lastError` fields for per-subsection freshness tracking.
10. Store starts empty (no mock seed data). Mock seed accessible via `_resetToSeed()` (TEST ONLY) with `placeholder` confidence.
11. KeysPanel and McpPanel disable all mutating controls when `hasKeyMcpAdapter()` is false.
12. KeyMcpAdminPanel renders "NO ADAPTER BOUND" banner when adapter is not set.
13. 56 new store tests covering: adapter boundary, unavailable state does not look healthy, no browser fs/cli writes, redaction, confirmation gates, creation flows, provenance tracking, adapter failure handling, JSON serialization safety.
14. `missionControlProxy.js` now exposes an audited allowlist only: reads for keys/MCP/cron/webhooks/skills plus verified action subset (`key.delete`; `mcp.test`/`mcp.remove`/`mcp.create` without token/note; `cron.pause`/`resume`/`run`/`remove`/`create` without model override; `webhook.remove`).
15. The local proxy now treats disabled webhook platform output as unavailable instead of a healthy empty list, keeps `key.revoke`, `webhook.create`, and skill toggles explicitly unsupported when Hermes CLI semantics do not match Mission Control contracts, and reloads authoritative cron/webhook lists after successful actions instead of persisting provisional rows.
16. Added proxy-side hardening/tests for default same-host/loopback CORS behavior, exact allowlist/wildcard env handling, and verified action-planning coverage (`src/services/hermes/missionControlProxy.test.ts`).
17. Model-admin confirmations now use the shared `RiskConfirmDialog`; model action helpers map safe/risk/danger tiers, danger actions (`model.delete`, `model.resetCredential`) require typed model-id confirmation, and confirmation copy includes target provider/model, routing scope, provenance source/freshness/confidence, explicit unknown cost/quota notes, and rollback guidance.
18. KeysPanel and McpPanel now use shared `RiskConfirmDialog` instead of the old admin `ConfirmDialog`. Key/MCP pending confirmations carry tier metadata; `key.revoke`/`key.regenerate` remain risk-tier confirmations without typed phrases, while `key.delete` and `mcp.remove` are danger-tier typed gates using the affected key label or MCP name. Focused tests preserve adapter-unavailable, redaction, and one-time-secret guarantees.
19. Phase 6 sidecar production hardening added explicit `MISSION_CONTROL_PROXY_AUTH_MODE=required` support. In required mode, `/admin/*` routes require `X-Mission-Control-Key` matching `MISSION_CONTROL_ADMIN_PROXY_KEY`; missing or invalid tokens are rejected, health/static routes stay outside the admin token scope, and unset auth mode/key preserves current local development ergonomics. Same-host/loopback default CORS behavior remains covered by focused tests.
20. Client-side admin proxy auth hook added: `MissionControlAdminProxyAdapter` now exposes session-only in-memory token helpers, sends `X-Mission-Control-Key` only when an operator token is explicitly configured, avoids storage/log/state exposure of raw tokens, keeps no-token local development behavior, and treats `window.__SORA_ADMIN_PROXY_KEY__` as a deprecated localhost-only fallback instead of a build-asset secret injection path.

Remaining:
1. Bind `src/modules/admin/adminStore.ts` to a verified model/admin backend adapter only after a noninteractive model-list/capability endpoint exists. Current verified Hermes model surfaces are insufficient for an honest adapter: `hermes model` is interactive, `hermes config set model.default <MODEL_NAME>` is mutation-only, and no verified noninteractive model-list/capability endpoint is available.
2. Fill only the remaining unsupported Key/MCP actions after Hermes exposes verified safe semantics (`key.create`, `key.update`, `key.revoke`, `key.regenerate`, `mcp.update`, and token/note-backed MCP create flows).
3. Fill only the remaining unsupported CWS actions after verified contract alignment (`cron.update`, `cron.create` with model override, `webhook.create`, `webhook.update`, `skill.enable`, `skill.disable`).
    1. The sidecar deployment follow-through (process supervision, secret injection, network/firewall, operator runbook) has been implemented and documented. The systemd service `sora-missioncontrol-proxy.service` now uses `/home/wliob/.hermes/node/bin/node` for `ExecStart`. The `.env.proxy` file now explicitly comments out `MISSION_CONTROL_PROXY_AUTH_MODE=required` and provides `your_development_key_here` as a clear development placeholder for `MISSION_CONTROL_ADMIN_PROXY_KEY`. Browser-side build/global injection of `window.__SORA_ADMIN_PROXY_KEY__` should not be used for real secrets; the app now provides an operator-entered session-only token path instead.

Completion gate:
- Secrets are status-only except one-time creation/regeneration result. ✅
- Risky operations require confirmation. ✅
- Missing backend capability is rendered as unavailable, not silently mocked. ✅
- No browser filesystem/CLI/profile writes from store. ✅
- Mock seed data marked with placeholder confidence. ✅
- Real adapters bound to verified backends. ❌ (blocked on Cloud)

### 3. Phase 7: Kanban / Project Control

Kanban is strategically important, but it should follow live ops/admin because the shared adapter and confirmation patterns need to be settled first.

Completed in Phase 7:
1. Replaced the reserved Kanban shell route with a real Project Control surface.
2. Added overview, ownership, status-lane, blocker, source-health, and selected-task drawer shell panels.
3. Added a typed read-only store/adapter boundary with provenance (`source`/`freshness`/`confidence`) and `lastError`.
4. Bound verified task-detail reads for comments, runs, logs, and diagnostics through `/api/plugins/kanban` adapter routes; timestamps normalize both second- and millisecond-based payloads.
5. Guarded dispatch/decompose/reclaim/terminate actions now route only through the verified dashboard Kanban adapter paths, with explicit confirmation and disabled states when source health or ids are missing.
6. Added tests proving the route no longer renders the EmptyView placeholder, unhealthy states stay visibly unhealthy, live adapter payloads normalize correctly, and no browser DB/filesystem writes are exposed.
7. Shared shell selection now carries `selectedAgent` + `selectedOwner` between Project Control, office, and chat so current-work focus can move across surfaces without inventing a second selection store. Non-canonical owners stay filterable in Project Control but honestly disable office/chat routes when no verified mapping exists.

Remaining tasks:
1. Add any further Kanban mutations only after their backend routes and payload contracts are explicitly verified.
2. Expand non-canonical owner navigation only if verified backend/profile mappings are introduced.
3. Add richer task navigation/filters if Phase 7 scope expands beyond the current control surface.

Completion gate:
- No direct DB writes.
- Dispatch/decompose/reclaim/terminate controls require explicit confirmation.
- Route must stay honest about unavailable/unknown/stale Kanban state. ✅

### 4. Phase 8: Final Polish / Cohesion

Do this after the major modules have real data paths. Earlier polish risks hiding structural gaps.

Immediate tasks:
1. Review the full first screen on desktop/tablet/mobile.
2. Tighten spacing, hierarchy, motion, empty states, and reduced-motion behavior.
3. Verify office + chat + ops/admin/kanban performance together.
4. Remove duplicate surfaces and stale placeholder copy.
5. Run final acceptance against the original premium dark mission-control brief.

Completion gate:
- The app feels like one coherent control surface rather than separate modules.

---

## Active Blockers / Unknowns

| Blocker / Unknown | Impact | Next Action |
|---|---|---|
| Real-time provider quota/rate-limit source is not verified | Ops remains historical/usage-only; live quota state remains unknown until verified. | Continue treating provider quotas as unknown confidence sources until a dedicated endpoint lands. |
| Model-admin backend lacks a verified noninteractive list/capability surface | Model confirmations are risk-aware, but model reads/mutations cannot be bound honestly through the local proxy yet; `hermes model` is interactive and `hermes config set model.default <MODEL_NAME>` only covers one mutation | Keep model backend unavailable until Hermes exposes a contract-safe noninteractive model endpoint; do not fake model list, cost, quota, or capability data. |
| Several admin mutations still lack verified backend semantics | Phase 6 can manage only the audited safe subset today; unsupported operations intentionally return unavailable/`501` instead of pretending to work | Keep unsupported actions disabled/honest until Hermes exposes a contract-safe path, then extend the adapter one route at a time. |
| Production sidecar exposure still depends on operator deployment controls | The proxy can enforce a scoped admin token and the browser can attach it from session-only operator entry, but LAN/firewall policy, process supervision, and secret distribution remain deployment responsibilities | Use `deploy/sora-missioncontrol-proxy.service` or `docker-compose.yml`, set `MISSION_CONTROL_PROXY_AUTH_MODE=required` plus a runtime-injected `MISSION_CONTROL_ADMIN_PROXY_KEY`, keep default same-host/loopback CORS unless a precise allowlist is needed, and enter the token in the admin UI for the current tab. |
| Git tree is currently dirty/untracked from the enclosing `/home/wliob` git root | `git status` from the project resolves to `/home/wliob` and the project directory is untracked there, so no commit status should be inferred from docs alone | Preserve current files, use command/test evidence for reconciliation, and restore a real project VCS baseline before relying on `git diff` for release management. |

---

## Verification Notes

Known scripts from `package.json`:
- `npm run lint` runs `tsc --noEmit`.
- `npm run test` runs Vitest.
- `npm run build` runs TypeScript build plus Vite build.

Before claiming implementation work complete, run the narrowest relevant tests first, then `npm run lint` or `npm run build` when the change touches shared types, stores, shell behavior, or build configuration.

Latest verified run after Codex e2e/deployment reconciliation:
- `npm run test -- src/components/admin/UnifiedAdminSurface.test.tsx --run` ✅ (3 passing in focused auth/UI file)
- `npm run lint` ✅ (`tsc --noEmit` clean)
- `npm test -- --run` ✅ (642 passing across 40 files)
- `npm run build` ✅ (Vite build completed; existing large-chunk warning still present)
- `npm run test:e2e` ✅ (2 passed, 2 intentional project skips; desktop/mobile screenshots written to `shared/e2e-*.png`)
- Playwright/local `/health` ✅ while `npm run test:e2e` web server is running (`{"ok":true,"service":"sora-mission-control-admin-proxy"}`)
- Target-host local/self-LAN smoke over SSH ✅ (`127.0.0.1:3187/health` ok; `192.168.0.85:3187/health` ok from target; unauthenticated `/admin/keys` returned `401`; token-authenticated `/admin/keys` returned `200`; user service active/enabled and listening on `0.0.0.0:3187`)
- `curl --max-time 8 -fsS http://192.168.0.85:3187/health` ✅ returned `{"ok":true,"service":"sora-mission-control-admin-proxy"}` after operator firewall follow-through.
- Deployed Playwright proof ✅ with `PLAYWRIGHT_BASE_URL=http://192.168.0.85:3187` and `PLAYWRIGHT_SKIP_WEBSERVER=1` (2 passed, 2 intentional project skips).
- `deploy/create-release-bundle.sh` ✅ created `shared/releases/sora-missioncontrol-20260622T215753Z.tar.gz`; tarball spot-check includes proxy, built `dist/`, Docker/Compose, systemd template, and operator runbook.

Previously verified after Phase 6 sidecar production hardening:
- `npm run test -- src/services/hermes/missionControlProxy.test.ts --run` ✅ (23 passing in focused proxy file)
- `npm run lint` ✅ (`tsc --noEmit` clean)
- `npm test -- --run` ✅ (631 passing across 35 files)
- `npm run build` ✅ (Vite build completed; existing large-chunk warning still present)

Previously verified after Phase 6 Keys/MCP risk-dialog consolidation:
- `npm run test -- src/state/adminKeyMcpStore.test.ts src/components/admin/KeyMcpPanels.test.tsx --run` ✅ (63 passing across 2 files)
- `npm run test -- src/components/admin/KeyMcpPanels.test.tsx src/components/admin/CwsPanels.test.ts src/state/adminKeyMcpStore.test.ts src/state/cwsAdminStore.test.ts --run` ✅ (154 passing across 4 files)
- `npm run lint` ✅ (`tsc --noEmit` clean)
- `npm test -- --run` ✅ (624 passing across 35 files)
- `npm run build` ✅ (Vite build completed; existing large-chunk warning still present)
