# Sora-MissionControl — Project Overview

> **Status:** IN PROGRESS — Phases 0-5 are complete; Phase 6 adapter boundary is done (UI/store/types/panels/576 tests); real adapters from Cloud remain; Phase 7+ remain.
> **Last Updated:** 2026-06-21
> **Created:** 2026-06-18
> **Deployment Target:** Local LAN dashboard on the Hermes host (`192.168.0.85`), app port TBD
> **Stack:** React 18 + TypeScript + Vite, PixiJS v8 for 3D office, Zustand + XState for state, GSAP for motion, CSS theme tokens, optional local proxy for Hermes/CLI transport
> **Data Source:** Hermes dashboard APIs + live agent/runtime state + Hermes 3D Office v2 assets/code + Hermes Kanban + usage/rate-limit signals; OpenClaw Mission Control remains a UX reference only
> **Repo/Vault:** `/Users/wliob/LLM Brain/Projects/Active/Sora-MissionControl`

---

## Current Status Snapshot

**Summary:** Phases 0-5 are complete for the current scope. Phase 6 admin adapter boundary is now fully implemented: all admin panels (CWS + Key/MCP) have explicit adapter boundary with unavailable states, provenance tracking, and "NO ADAPTER BOUND" banners when no backend is connected. Mock seed data is TEST ONLY with placeholder confidence. The KeyMcpAdminAdapter interface is defined and ready for Cloud implementation. 576 total tests passing. Real backend adapters from Cloud are the remaining blocker to close Phase 6. Profile chat UI, profile listing, demo fallback labeling, and the floating chat surface are integrated; direct dashboard chat REST/WS routes are verified unavailable, and live message sending still requires an injected verified transport/proxy. The required 3D office regression/stability sweep before Phase 5 is complete. Phase 5 live ops / usage visibility is fully active with provenance-aware usage snapshots, adapter-backed fetch, unknown-safe quota confidence, alert generation, and validated stale/degraded handling.

**Verified latest stats:**
- Core recent Kanban stabilization/chat cards: **15/15 done**.
- Office test suite from Biscuit final review: **180/180 passing**.
- Full test suite: **576/576 passing** (27 test files).
- TypeScript verification from Biscuit final review: **`npx tsc --noEmit` clean**.
- Reconnect catch-up targeted verification: **14/14 `catchUpAnimation`**, **36/36 `office.regression`**, **13/13 `gameRuntimePerfMode`**.
- Admin safety tests: **134 passing** (48 CWS store + 43 CWS UI + 56 Key/MCP boundary + provenance + adapter + redaction tests).
- Active blocker: real backend adapters from Cloud needed to close Phase 6.

**Completed since the previous overview update:**
- Chat route behavior was verified: dashboard `/api/plugins/chat/*` routes are unavailable, profile listing uses `/api/plugins/kanban/profiles`, and the app labels demo chat fallback honestly until a verified live transport is injected.
- Biscuit updated `docs/api-reference.md` with verified chat/auth/runtime findings.
- Biscuit completed and reviewed the 3D office stability/performance card batch:
- Biscuit completed Phase 7a for the Kanban route: the reserved EmptyView was replaced with a real read-only Project Control surface, a typed read-only store/adapter boundary, disabled mutation placeholders, and verification coverage for unhealthy/mobile states.
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

---

## Pending Work / Phase Tracker

- [x] **Phase 0:** Research real Hermes endpoints, inspect Hermes 3D Office v2, and freeze interface contracts.
- [x] **Phase 1:** Lock visual system and dashboard shell so the UI stops feeling generic.
- [x] **Phase 2:** Extract/reuse Hermes 3D Office v2 core and make it performant inside the dashboard.
- [x] **Phase 3:** Build live data/auth backbone and shared app state.
- [x] **Phase 4:** Ship chat with all agent profiles for current scope: profile chat surface, floating bubble, profile roster integration, and honest demo fallback when live transport is unavailable.
- [x] **Phase 4b:** Integrate floating chat bubble overlay and complete the required Phase 2/office regression + stability sweep before Phase 5.
- [x] **Phase 5:** Ship live ops / usage visibility with rate limits, token spend, API usage, health, and alerts. **Status:** complete.
- [ ] **Phase 6:** Ship admin controls for models, crons, webhooks, keys, skills, and MCPs. **Status:** Adapter boundary done — all panels have unavailable states, provenance, and explicit "NO ADAPTER BOUND" banners; 134 admin tests passing; real adapters from Cloud remain.
- [ ] **Phase 7:** Ship Kanban / project control with clear ownership and active-work visibility.
- [ ] **Phase 8:** Final polish, performance acceptance, and cohesion review. Note: the office-specific stability slice is already complete; the remaining Phase 8 scope is whole-product polish/cohesion.

---

## Next Projected Steps

### 1. Phase 6 — Admin / Control Module
**Owner:** Cloud primary (adapters); Biscuit (UI/store/tests) — UI layer complete.

**Completed by Biscuit:**
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

**Remaining (Cloud-owned):**
1. Bind model admin store to a verified adapter.
2. Implement `KeyMcpAdminAdapter` (listKeys, listMcpEntries, executeAction) against real Hermes backend.
3. Bind CWS adapter to Hermes CLI/API routes for cron, webhook, skill management.

**Gate:** destructive or high-risk actions must require confirmation; secrets must never appear in UI payloads/logs. ✅ (enforced at type/store/panel level)
**Gate:** missing backend capability is rendered as unavailable, not silently mocked. ✅
**Gate:** mock seed data is marked with placeholder confidence. ✅
**Gate:** no browser filesystem/CLI/profile writes from store. ✅

### 2. Phase 7 — Kanban / Project Control
**Owner:** Biscuit UI, Cloud adapter.

**Completed in Phase 7a:**
1. Real read-only Project Control route in the shell (desktop/tablet/mobile), replacing the reserved EmptyView.
2. Overview, ownership, status-lane, blocker, selected-task drawer-shell, and source-health panels.
3. Typed Kanban read boundary in `projectControlStore`/`project-control` types with `source`, `freshness`, `confidence`, and `lastError`.
4. Explicit unavailable/unknown/stale handling: no fake healthy state when backend/task-detail reads are missing.
5. Disabled dispatch/decompose/reclaim/terminate action placeholders with confirmation-copy stubs only.
6. Tests covering route replacement, unhealthy-state honesty, read-only API surface, and narrow/mobile rendering.

**Remaining:**
1. Bind verified read adapters for task comments/runs/logs.
2. Add safe mutation flows only through verified Kanban API/adapter paths.
3. Cross-link selected agent, office presence, chat, and current work.
4. Add richer drawer interactions once real read adapters exist.

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
| Admin controls | 🟡 Adapter boundary done, real adapters pending | Models + keys/MCP UI/store with adapter boundary, provenance, and unavailable states; CWS panels with RiskConfirmDialog; KeyMcpAdminAdapter interface defined; real adapters from Cloud remain. |
| Kanban / project overview | 🟡 Phase 7a read-only complete | Real Project Control shell route, honest unhealthy states, typed read-only boundary, and drawer shell are in place; verified live reads and safe mutations remain. |
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
| Admin / control module | Cloud | Hermes config surfaces, model/runtime controls | Manage models, crons, webhooks, keys, skills, MCPs | Data/auth backbone | Adapter boundary done; 134 admin tests passing; real adapters from Cloud remain |
| Kanban / project control | Biscuit UI + Cloud adapter | Board data, active task state, owner metadata | Who-is-working-on-what overview | Data/auth backbone + shell | Phase 7a read-only surface complete; live read adapters + safe mutations pending |

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
- Keys/MCP admin UI/store now has adapter boundary: `KeyMcpAdminAdapter` interface with `setKeyMcpAdminAdapter`/`hasKeyMcpAdapter` binding. Store starts empty (no mock seed). Mock seed is TEST ONLY via `_resetToSeed()` with `placeholder` confidence. `KeyMcpAdminState` has `keysProvenance`, `mcpProvenance`, and `lastError` fields.
- KeysPanel/McpPanel disable all mutating controls when no adapter bound. KeyMcpAdminPanel renders "NO ADAPTER BOUND" banner.
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
- 56 new Key/MCP boundary tests covering: adapter boundary, unavailable state does not look healthy, no browser fs/cli writes, redaction, confirmation gates, creation flows, provenance tracking, adapter failure handling, JSON serialization safety.
- Real backend adapters are still required before this phase can be considered complete.

**Remaining tasks (Cloud-owned):**
1. Bind model management to a verified Cloud-owned adapter.
2. Implement `KeyMcpAdminAdapter` (listKeys, listMcpEntries, executeAction) against real Hermes backend.
3. Bind CWS adapter to real Hermes CLI/API routes for cron, webhook, skill management.

**Optional follow-up:**
4. Full ConfirmDialog consolidation: migrate Keys/MCP/Models panels from old ConfirmDialog to shared RiskConfirmDialog.

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

# Optional proxy mode
DASHBOARD_TOKEN=***
LOCAL_PASSWORD=***

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
