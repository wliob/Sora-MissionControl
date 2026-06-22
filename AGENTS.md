# Sora-MissionControl Agent Handoff

> **Last Updated:** 2026-06-21
> **Project State:** In progress. Phases 0-5 are complete; Phase 6 adapters remain partial, and Phase 7a read-only project control is now in place.
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

## Current Understanding

Sora-MissionControl is a local LAN Hermes mission-control dashboard built with React 18, TypeScript, Vite, PixiJS v8, Zustand, and XState. It combines a premium dark dashboard shell, a reused Hermes 3D Office scene, profile chat, live Kanban/runtime state, telemetry, admin controls, and project-control views.

The app already has:
- Shell/navigation and design-system baseline.
- Embedded 3D office module with stability and performance guardrails.
- Dashboard REST/WS backbone for Kanban/session state.
- Profile chat UI plus floating chat overlay.
- Admin model store/UI scaffolding with secret-redaction and confirmation gates.
- API key and MCP admin UI/store scaffolding using mock seed data.
- Ops panel shell that honestly renders unknown telemetry until sources are verified.

The next remaining theme is real adapter binding for Phase 6 plus Phase 7 follow-through (verified task-detail reads, cross-links, and safe mutations). Phase 5 live-ops is complete with unknown-safe telemetry behavior.

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
| Phase 6: Admin controls | Adapter boundary done; adapters pending | All admin panels have adapter boundary with unavailable states. CWS panels + KeyMcp panels both render "NO ADAPTER BOUND" when unbound. Mock seed is TEST ONLY with placeholder provenance. Real adapters from Cloud remain. |
| Phase 7: Kanban/project control | Phase 7a read-only surface complete; live reads/mutations pending | Shell route now renders a real Project Control surface with overview, ownership, status, blockers, source health, and a selected-task drawer shell. Verified task-detail adapters and any mutating controls remain pending. |
| Phase 8: Final polish/cohesion | Pending | Do after functional ops/admin/kanban modules are real enough to review together. |

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

Remaining:
1. Bind `src/modules/admin/adminStore.ts` to a verified model/admin backend adapter (Cloud).
2. Implement Cloud-owned KeyMcpAdminAdapter (listKeys, listMcpEntries, executeAction) against real Hermes backend.
3. Bind CWS adapter to real Hermes CLI/API routes (Cloud).
4. Full ConfirmDialog consolidation: migrate Keys/MCP/Models panels from old ConfirmDialog to shared RiskConfirmDialog.

Completion gate:
- Secrets are status-only except one-time creation/regeneration result. ✅
- Risky operations require confirmation. ✅
- Missing backend capability is rendered as unavailable, not silently mocked. ✅
- No browser filesystem/CLI/profile writes from store. ✅
- Mock seed data marked with placeholder confidence. ✅
- Real adapters bound to verified backends. ❌ (blocked on Cloud)

### 3. Phase 7: Kanban / Project Control

Kanban is strategically important, but it should follow live ops/admin because the shared adapter and confirmation patterns need to be settled first.

Completed in Phase 7a:
1. Replaced the reserved Kanban shell route with a real Project Control surface.
2. Added overview, ownership, status-lane, blocker, source-health, and selected-task drawer shell panels.
3. Added a typed read-only store/adapter boundary with provenance (`source`/`freshness`/`confidence`) and `lastError`.
4. Kept task comments/runs/logs explicitly unavailable until a verified read adapter is bound; no fake healthy drawer data.
5. Added tests proving the route no longer renders the EmptyView placeholder, unhealthy states stay visibly unhealthy, no browser DB/filesystem writes are exposed, and the shell renders on narrow/mobile widths.

Remaining tasks:
1. Bind verified read adapters for task comments/runs/logs.
2. Add safe task mutations through verified API/adapter only.
3. Cross-link selected agent/profile between office, chat, and current work.

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
| Admin adapter surfaces are defined but unimplemented | Phase 6 UI is adapter-boundary-safe but cannot manage real data | Cloud implements KeyMcpAdminAdapter and CwsAdminAdapter against Hermes backend. |
| Kanban live task-detail reads and safe mutations are still adapterless | Project Control is read-only for now; comments/runs/logs stay unavailable and actions stay disabled | Cloud/Biscuit follow with verified read adapters and confirmation-gated mutation paths only. |
| Repository folder is not currently a Git repository | No local commit/status history available here | Be careful with scoped edits and rely on file inspection rather than git status. |

---

## Verification Notes

Known scripts from `package.json`:
- `npm run lint` runs `tsc --noEmit`.
- `npm run test` runs Vitest.
- `npm run build` runs TypeScript build plus Vite build.

Before claiming implementation work complete, run the narrowest relevant tests first, then `npm run lint` or `npm run build` when the change touches shared types, stores, shell behavior, or build configuration.

Latest verified run for Phase 7a:
- `npm run test` ✅ (584 passing)
- `npm run build` ✅ (Vite build completed; existing large-chunk warning still present)
