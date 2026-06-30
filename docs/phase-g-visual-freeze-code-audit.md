# Phase G Visual Freeze — Code Pattern & Build Gate Audit

**Date:** 2026-06-29
**Auditor:** Hermes Agent (read-only)
**Scope:** Sora-MissionControl v2 — `src/` codebase + build toolchain
**Result:** ✅ ALL GATES PASS — 0 errors, 663 tests, build ~11.7s

---

## 1. Build Gate Results

| Gate | Command | Result | Details |
|------|---------|--------|---------|
| Lint | `pnpm run lint` (`tsc --noEmit`) | ✅ **PASS** | 0 TypeScript errors. Strict mode (`strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`) enforced. |
| Test | `pnpm test -- --run` (`vitest run`) | ✅ **PASS** | 42 test files, **663 tests**, all passing. Duration: ~21s. |
| Build | `pnpm run build` (`tsc -b && vite build`) | ✅ **PASS** | 847 modules transformed, built in **11.65s**. One advisory: main bundle is 729 KB (gzip: 224 KB) — consider code-splitting for larger apps. Non-blocking. |

**Summary:** All three build gates pass cleanly. The project is in a deployable state. No warnings or errors block the freeze.

---

## 2. Pattern Consistency Findings

### 2.1 State Stores (`src/state/`)

**Verdict:** ✅ **Highly consistent.** All 11 stores follow the `useSyncExternalStore` + manual listener pattern established in `teamStore.ts`.

**Stores audited:**

| Store | File | Hook | Pattern Match |
|-------|------|------|---------------|
| Shell | `shellStore.ts` | `useShellState()` | ✅ Emit/subscribe/snapshot |
| Board | `boardStore.ts` | `useBoardStoreSnapshot()` | ✅ |
| Team | `teamStore.ts` | `useTeamState()` | ✅ Reference pattern |
| Activity | `activityStore.ts` | `useActivityState()` | ✅ |
| Projects | `projectsStore.ts` | `useProjectsState()` | ✅ |
| Calendar | `calendarStore.ts` | `useCalendarState()` | ✅ |
| Session/Connection | `sessionConnectionStore.ts` | `useAuthSessionState()` + `useConnectionStateValue()` | ✅ Two hooks, same pattern |
| Project Control | `projectControlStore.ts` | `useProjectControlState()` | ✅ |
| Usage | `usageStore.ts` | `useUsageState()` | ✅ |
| Admin (models) | `adminStore.ts` (under `modules/admin/`) | `useAdminState()` | ✅ |
| Admin Key/MCP | `adminKeyMcpStore.ts` | `useKeyMcpAdminState()` | ✅ |
| CWS Admin | `cwsAdminStore.ts` | `useCwsAdminState()` | ✅ |
| Chat | `chatStore.ts` (under `modules/chat/`) | `useChatState()` | ✅ |

**Pattern consistency notes:**
- All stores use `const listeners = new Set<() => void>()`, `emit()`, `subscribe()`, `getSnapshot()`.
- All stores export a React hook that calls `useSyncExternalStore(subscribe, getSnapshot)`.
- All stores have a module-level `let state` / `let snapshot` variable (no class-based stores).
- Slight variation: `shellStore` and `boardStore` use a `.state` getter property on an exported object; `adminKeyMcpStore` uses a `.state` getter + method delegation. All are functionally equivalent.

**Default state honesty:** ✅ All default states are honest.
- Empty arrays (`[]`) where no data exists.
- `freshness: 'missing'` where no data source is connected.
- `isDemo: false` by default (truthful; demo mode is only set when `boardFreshness === 'missing'`).
- `calendarStore` starts empty; events are only pushed via `pushCalendarEvent()`.
- `adminStore`, `cwsAdminStore`, `adminKeyMcpStore` all start with empty lists and no adapter bound — they render unavailable state honestly.

### 2.2 Type Definitions (`src/types/`)

**Verdict:** ✅ **Well co-located.** 17 type files in `src/types/`, each corresponding to a domain.

**Co-location map:**

| Domain | Type File | State Store |
|--------|-----------|-------------|
| Agents | `types/agents.ts` | Shared across stores |
| Team | `types/team.ts` | `state/teamStore.ts` |
| Activity | `types/activity.ts` | `state/activityStore.ts` |
| Projects | `types/projects.ts` | `state/projectsStore.ts` |
| Calendar | `types/calendar.ts` | `state/calendarStore.ts` |
| Board/Kanban | `types/board.ts` | `state/boardStore.ts` |
| Provenance | `types/provenance.ts` | Shared across stores |
| Auth | `types/auth.ts` | `state/sessionConnectionStore.ts` |
| Connection | `types/connection.ts` | `state/sessionConnectionStore.ts` |
| Usage | `types/usage.ts` | `state/usageStore.ts` |
| Project Control | `types/project-control.ts` | `state/projectControlStore.ts` |
| Admin (models) | `types/admin.ts` | `modules/admin/adminStore.ts` |
| Admin Key/MCP | `types/admin-keymcp.ts` | `state/adminKeyMcpStore.ts` |
| Admin CWS | `types/admin-cws.ts` | `state/cwsAdminStore.ts` |
| Work State | `types/workState.ts` | Office module |
| Barrel | `types/index.ts` | Re-exports all canonical types |

**Notes:**
- `types/index.ts` is a well-maintained barrel with clear canonical-source annotations.
- The Phase 1 compatibility alias (`ConnectionState = TransportState`) is documented with migration notes — no confusion.
- Initial state factories (e.g., `initialActivityState()`, `initialCalendarState()`) are co-located in their type files, which is a clean pattern.
- No inline types in stores — all types are imported from `@/types/`.

### 2.3 Page Components (`src/pages/`)

**Verdict:** ✅ **Consistent structure.** 6 page components, all following the same pattern.

**Pages:**

| File | Export | Registered in ShellLayout? | Structure |
|------|--------|---------------------------|-----------|
| `Team.tsx` | `TeamPage` | ✅ Line 224 | Full page with data hook, eyebrow, status bar |
| `Office.tsx` | `OfficePage` | ✅ Line 226 | Full page with popout mode support |
| `Activity.tsx` | `ActivityPage` | ✅ Line 232 | Placeholder card with data hook |
| `Projects.tsx` | `ProjectsPage` | ✅ Line 234 | Placeholder card with data hook |
| `Decisions.tsx` | `DecisionsPage` | ✅ Line 236 | Static placeholder |
| `Calendar.tsx` | `CalendarPage` | ✅ Line 238 | Placeholder card with data hook |

**Route registration:** All 6 page components are registered in `ShellLayout.tsx` (lines 223–239). 18 admin routes render the shared `PlaceholderPage` component with honest unavailable messaging. 2 additional routes (kanban → `HermesKanbanPage`, chat → `ChatPanel`, achievements → `OpsPanel`) are also registered.

**Pattern consistency:**
- All pages use the `dashboard-placeholder-card` / `dashboard-placeholder-eyebrow` CSS classes for the shell header/eyebrow pattern.
- Pages with live data use their respective store hooks (`useTeamState()`, `useActivityState()`, etc.).
- Pages without data sources (`DecisionsPage`) render static unavailable messaging.
- No stale/unused imports detected (TypeScript `noUnusedLocals` enforces this).

### 2.4 Component Structure (`src/components/`)

**Verdict:** ✅ **Well-organized domain folders.** 47 files across 5 domains.

| Domain | Files | Purpose |
|--------|-------|---------|
| `shell/` | 14 | Navigation, layout, MissionBar, OpsPanel, ChatPanel, FloatingChatOverlay, AdminPanel |
| `admin/` | 16 | Cron, Webhooks, Skills, Keys, MCP, UnifiedAdmin, Confirm dialogs, Risk dialogs |
| `kanban/` | 4 | ProjectControlSurface, HermesKanbanPage |
| `team/` | 5 | AttentionRail, LeadCard, SoraConductorStation, DelegationLines, GuildInsignia |
| `common/` | 6 | PortraitImage, ProfileSelector, Panel, StatusPill, AlertStrip, CommandInput |

**Notes:**
- Components are properly contained within their domain folders.
- Test files are co-located with their components (e.g., `MissionBar.test.tsx` next to `MissionBar.tsx`).
- No duplicated logic across pages — derived pages (Activity, Projects, Calendar) share the same store→derive→render pattern established by `teamStore`.

### 2.5 TypeScript Health

**Verdict:** ✅ **Clean. Strict mode passes with zero suppressions.**

| Check | Result |
|-------|--------|
| `any` types in source code | **0** — None in non-test source files |
| `any` types in test files | **~35** — Acceptable (test mocks, private member access). All in `*.test.ts(x)` files. |
| `// @ts-ignore` | **0** |
| `// @ts-nocheck` | **0** |
| Import cycles | **0** detected. All imports use `@/` path aliases; the only relative import (`../../../missionControlProxy.js`) is a test referencing the proxy root file. |
| Unused imports | **0** — enforced by `noUnusedLocals: true` |

---

## 3. Issues Found

### 3.1 Dead Code — Unused ConfirmDialog Variants (MEDIUM)

**Files:**
- `src/components/admin/ConfirmDialog.tsx` (172 lines)
- `src/components/common/ConfirmDialog.tsx` (185 lines)

**Description:** Two older `ConfirmDialog` components exist alongside the consolidated `RiskConfirmDialog.tsx`. These are **not imported by any source file** — only `RiskConfirmDialog` is actively used (6 import sites). The `RiskConfirmDialog` header comment explicitly states it "Consolidates the two prior ConfirmDialog variants."

**Impact:** Dead code adds maintenance burden and could confuse new developers. TypeScript `noUnusedLocals` doesn't catch unused exports by default.

**Severity:** MEDIUM — non-blocking; won't cause bugs but should be cleaned in Phase H.

**Recommendation:** Remove both unused files in Phase H cleanup pass.

### 3.2 Large Main Bundle (LOW)

**File:** `dist/assets/index-BNjAnlt5.js` — 729 KB (224 KB gzip)

**Description:** The main application bundle exceeds 500 KB. Vite warns about this. This is expected for a PixiJS v8 + React 18 app but should be monitored.

**Severity:** LOW — non-blocking advisory. The app loads and runs correctly.

**Recommendation:** Consider dynamic `import()` for the office module (PixiJS) to split it from the main dashboard shell. Not required for freeze.

### 3.3 Test Stderr Noise (LOW)

**Files:** `src/office/office.regression.test.ts`, `src/office/components/OfficeErrorBoundary.test.ts`

**Description:** Office regression and error boundary tests emit intentional stderr output ("[3D Office] Agent \"test\" spritesheet...", "OfficeErrorBoundary caught..."). These are expected — the tests exercise error paths. 0 test failures.

**Severity:** LOW — cosmetic. Tests pass correctly.

**Recommendation:** Consider `vi.spyOn(console, 'error').mockImplementation(() => {})` to suppress intentional error output during tests. Optional.

### 3.4 Placeholder Admin Routes (INFO)

**Files:** `src/components/shell/ShellLayout.tsx` lines 51–57 (18 routes)

**Description:** 18 admin routes (sessions, files, models, logs, cron, skills, plugins, mcp, channels, webhooks, pairing, profiles, config, keys, system, documentation) render `PlaceholderPage` with honest "truthful placeholder until its feature pass lands" messaging. This is by design per the project's phased delivery.

**Severity:** INFO — intentional design pattern.

**Recommendation:** Continue phased implementation. No action required for freeze.

---

## 4. Positive Findings

1. **Store pattern is exemplary.** All 11+ stores use the same `useSyncExternalStore` pattern with manual listeners, making the codebase predictable and easy to extend. New developers can copy any store as a template.

2. **Honest unavailable states.** Every page and store surfaces truthful `'missing'`, `'unknown'`, or `'unavailable'` states rather than faking data. This is a key architectural invariant maintained consistently.

3. **Secret redaction defense-in-depth.** Admin stores (`adminStore`, `cwsAdminStore`, `adminKeyMcpStore`) all implement ingest guards that reject unmasked secrets. The `looksUnmasked()`, `assertMasked()`, and `assertCwsFieldMasked()` functions provide compile-time+run-time protection.

4. **Confirmation gates for destructive actions.** Every destructive admin action is gated behind a `PendingConfirmation` / `CwsPendingConfirmation` with typed-phrase gates for the most dangerous operations (delete, revoke, remove).

5. **Type co-location.** Types are domain-organized, initial state factories live alongside type definitions, and the barrel file (`types/index.ts`) is well-documented with canonical-source annotations.

6. **Component domain organization.** Components are cleanly separated into `shell/`, `admin/`, `kanban/`, `team/`, and `common/` domains. No cross-domain coupling beyond shared store hooks.

7. **Test coverage.** 663 tests across 42 test files including unit tests for stores, adapters, components, and regression tests for the office module.

8. **Strict TypeScript.** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true` — all enforced without suppressions.

9. **Zero import cycles.** All imports use `@/` path aliases; no circular dependencies detected.

10. **Documentation quality.** File header comments consistently describe the module's role, owned vs. non-owned state, and invariants.

---

## 5. Recommendations for Phase H

### Must Fix (before production deploy)
- None identified. All build gates pass; no blocking issues.

### Should Fix (cleanup)
1. **Remove dead ConfirmDialog files** — Delete `src/components/admin/ConfirmDialog.tsx` and `src/components/common/ConfirmDialog.tsx`. All consumers use `RiskConfirmDialog` already. Verify no remaining imports, then remove.

### Could Improve (code quality)
2. **Code-split PixiJS** — Use `React.lazy()` + dynamic `import()` for the office module to reduce the main bundle by ~200+ KB. The office is a heavy dependency that doesn't need to load on the initial shell render.
3. **Suppress test stderr noise** — Add `console.error` mocks in office tests that intentionally trigger error paths.
4. **Mark `_resetForTest`, `_resetToSeed`, `_ingest*` as deprecated** — These test-only exports are already prefixed with `_` and documented, but adding `@deprecated` JSDoc tags would make tooling more explicit about their test-only nature.

### Continue (phased delivery)
5. **Implement admin route pages** — The 18 placeholder admin routes are by design. Continue phased implementation per the project roadmap.
6. **Calendar/Decisions backend integration** — These pages render honest unavailable states. Integrate when backend sources are verified.

---

## Appendix A: File Inventory

### State Stores (11 files)
```
src/state/shellStore.ts
src/state/boardStore.ts
src/state/teamStore.ts
src/state/activityStore.ts
src/state/projectsStore.ts
src/state/calendarStore.ts
src/state/sessionConnectionStore.ts
src/state/projectControlStore.ts
src/state/usageStore.ts
src/state/adminKeyMcpStore.ts
src/state/cwsAdminStore.ts
src/state/backbone.ts
src/state/attentionRankingEngine.ts
src/modules/admin/adminStore.ts
src/modules/chat/chatStore.ts
```

### Type Definitions (17 files)
```
src/types/index.ts               (barrel)
src/types/agents.ts
src/types/team.ts
src/types/activity.ts
src/types/projects.ts
src/types/calendar.ts
src/types/board.ts
src/types/provenance.ts
src/types/auth.ts
src/types/connection.ts
src/types/usage.ts
src/types/project-control.ts
src/types/admin.ts
src/types/admin-keymcp.ts
src/types/admin-cws.ts
src/types/workState.ts
src/types/missionControlProxy-test.d.ts
```

### Page Components (6 files)
```
src/pages/Team.tsx
src/pages/Office.tsx
src/pages/Activity.tsx
src/pages/Projects.tsx
src/pages/Decisions.tsx
src/pages/Calendar.tsx
```

## Appendix B: Build Commands (Reproducible)

```bash
cd /home/wliob/llm-brain/Projects/Active/Sora-MissionControl
pnpm run lint           # tsc --noEmit → 0 errors
pnpm test -- --run      # vitest run → 663 passed
pnpm run build          # tsc -b && vite build → 11.65s
```
