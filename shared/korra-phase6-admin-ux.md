# Korra Phase 6 Admin UX Audit — smc-p6-korra-admin-ux

Owner: Korra / Creative & Media
Date: 2026-06-21
Scope: Phase 6 Admin Controls visual clarity, safety affordances, confirmation hierarchy, secret redaction cues, non-generic mission-control styling, low-clutter cohesion.

## Executive acceptance

Phase 6 admin/control is visually directionally acceptable as a scaffold, but not accepted as operationally complete.

Current acceptance state:
- Models surface: conditionally acceptable for scaffold review. It has mission-control styling, masked credential display, disabled controls when the model adapter is absent, and confirmation gates for risky model actions.
- Keys/MCP surface: conditionally acceptable for scaffold review only. It now labels the current rows as mock seed data, preserves masked-list behavior, and gates revoke/regenerate/delete/remove. It must not ship as live admin until Cloud/Biscuit replace the mock store path with a verified adapter.
- Crons, webhooks, and skills: not reviewable because the surfaces are absent.
- Phase 6 overall: remains partial.

## Source files audited

- `src/components/admin/UnifiedAdminSurface.tsx`
- `src/components/shell/AdminPanel.tsx`
- `src/components/admin/KeyMcpAdminPanel.tsx`
- `src/components/admin/KeysPanel.tsx`
- `src/components/admin/McpPanel.tsx`
- `src/components/admin/ConfirmDialog.tsx`
- `src/components/common/ConfirmDialog.tsx`
- `src/components/admin/SecretReveal.tsx`
- `src/components/admin/MaskedField.tsx`
- `src/modules/admin/adminStore.ts`
- `src/state/adminKeyMcpStore.ts`
- `src/types/admin.ts`
- `src/types/admin-keymcp.ts`
- `src/styles/theme.css`

UI/UX guidance checked from `ui-ux-pro-max`:
- Confirmation dialogs must prevent accidental destructive actions.
- Successful actions should not be silent.

## Edits made by Korra

1. Safer confirmation focus hierarchy.
   - `src/components/common/ConfirmDialog.tsx`
   - `src/components/admin/ConfirmDialog.tsx`
   - Changed destructive dialogs so the safe Cancel button receives initial focus instead of the destructive Confirm button.
   - Removed the model dialog's global Enter-to-confirm behavior. Escape still cancels. This reduces accidental destructive activation from stray Enter keypresses.

2. Adapter absence is now visible on model admin.
   - `src/components/shell/AdminPanel.tsx`
   - Added a quiet mono banner: `MODEL ADAPTER UNAVAILABLE · controls are disabled until Cloud binds a verified backend` when no adapter is bound and no explicit error is present.
   - This prevents a blank model list from looking like a legitimate empty system.

3. Mock key/MCP data is now visibly labeled.
   - `src/components/admin/KeyMcpAdminPanel.tsx`
   - Added a compact amber banner: `MOCK SEED DATA · replace with verified key/MCP adapter before operational use`.
   - This directly addresses the Phase 6 risk that seeded credentials/MCP rows could look operationally real.

## Verification run

Passed:

```text
npm run test -- src/modules/admin/adminStore.test.ts src/state/adminKeyMcpStore.test.ts

Test Files  2 passed (2)
Tests       54 passed (54)
```

Blocked / pre-existing:

```text
npm run lint
```

`npm run lint` currently fails on pre-existing Phase 5 usage/telemetry TypeScript errors in `src/adapters/usageAdapter.ts`, `src/state/backbone.ts`, `src/state/usageStore.ts`, `src/state/usageStore.test.ts`, and `src/types/usage.ts`. No lint errors referenced the files edited in this audit.

Biscuit/Cloud must re-run full `npm run lint` after the usage typing blockers are resolved. For these Korra edits, the targeted admin store tests are green.

## Acceptance findings

### 1. Visual clarity

Pass with caveats.

What works:
- Admin is kept as a deeper control view, not a first-screen KPI/dashboard grid.
- Models use a compact split-list/detail frame, which fits the control-surface mental model.
- Keys/MCP use dense rows with inline metadata instead of generic oversized cards.
- Status labels are compact and tied to existing tokens (`accent-cyan`, `accent-violet`, `accent-amber`, `accent-red`, `accent-green`).
- The new adapter/mock banners clarify when data is unavailable or seeded.

Caveats:
- The admin module has two confirmation implementations (`components/common/ConfirmDialog.tsx` and `components/admin/ConfirmDialog.tsx`). Their behavior is now safer, but Biscuit should consolidate them before Phase 8 to avoid drift.
- Keys and MCP rows use locally duplicated `ActionButton` and `EditField` atoms in both panels. This is acceptable for scaffold speed but increases visual drift risk.

Concrete Biscuit changes:
1. Consolidate admin confirmation into one shared `RiskConfirmDialog` API with props for `severity`, `targetLabel`, `targetId`, `impact`, `confirmLabel`, and `requiresTypedPhrase?`.
2. Extract repeated key/MCP row actions and edit fields into shared admin atoms so hover/focus/disabled states stay identical.
3. Add one compact status/provenance strip per admin subsection: `source`, `freshness`, `confidence`, and `last checked`.

### 2. Safety affordances

Partial pass.

What works:
- Destructive model actions go through `pendingConfirmations` in `adminStore`.
- Key revoke/regenerate/delete and MCP remove go through pending confirmation in `adminKeyMcpStore`.
- Confirm dialogs now focus Cancel first.
- Delete/credential actions are visually red; routing/fallback changes are not over-red but still confirmed.
- Empty/unavailable model state is now clearly labeled when no adapter is present.

Gaps:
- Model `Set Default` and `Set Fallback` are marked `destructive` and display a warning icon, but visually share the same action row as more severe destructive actions. They need a clearer hierarchy: routing change is high-risk, delete/reset credential is danger.
- Key/MCP create flows execute immediately. That may be fine when using a trusted adapter, but while still mock/adapterless they should remain visually marked as scaffold-only.
- MCP update can include token/url changes in the type/store, but the current UI edit form does not expose token changes. If Biscuit later adds token edit, it must be confirmed and one-time revealed like regenerate.

Concrete Biscuit changes:
1. Split action tiers:
   - Safe: Edit label/note, Test MCP.
   - Risk: Set Default, Set Fallback, Disable, Enable/Disable MCP.
   - Danger: Delete, Revoke, Regenerate, Reset Credential, Remove MCP.
2. Use copy that names blast radius in confirmation detail blocks, e.g. `Affects default routing for all profiles using default model`.
3. For irreversible actions, consider a typed phrase only for `Delete`, `Reset Credential`, and `Regenerate Key`, not for every warning. Keep the UI calm.
4. Add post-action feedback in the visible surface for key/MCP non-secret results; store has `lastResult.message`, but the current panels mostly use it only for one-time reveal.

### 3. Confirmation hierarchy

Improved by Korra edit; still needs consolidation.

Current good state:
- Cancel is now the default focused action.
- Escape cancels model confirmations.
- Backdrop click cancels, never confirms.
- Confirm buttons remain visually differentiated.

Remaining issues:
- `components/admin/ConfirmDialog.tsx` has no explicit `role="dialog"`, `aria-modal`, or label ids. The common model dialog does. Biscuit should add the same accessibility attributes.
- Confirmation copy is generally clear, but lacks structured impact fields. Right now the user must parse the sentence.
- Multiple pending confirmations can render multiple modal instances. The store allows it; UI should render one queue item at a time or prevent a second modal until the first resolves.

Concrete Biscuit changes:
1. Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby` to the admin key/MCP confirmation dialog.
2. Render only the first pending confirmation per subsection or use a shared confirmation queue. Avoid modal stacking.
3. Add a detail panel to every confirmation:
   - Target
   - Operation
   - Impact
   - Reversibility
   - Secret exposure: `none` / `one-time reveal` / `invalidates existing credential`

### 4. Secret redaction cues

Partial pass.

What works:
- Persistent model entries use `apiKeyMasked` and `credentialPresence`, not raw values.
- Key and MCP list rows use `MaskedField` and masked fingerprints.
- One-time secret reveal is explicit and amber.
- Store tests prove persistent key/MCP collections do not contain raw secret values.
- MCP URLs with embedded credentials are masked via `maskUrl`.

Gaps:
- `lastResult.createdKey.secret` and `lastResult.createdMcp.token/rawUrl` intentionally carry raw values ephemerally. That is acceptable only if adapters treat `lastResult` as volatile and never log it.
- `McpEntryCreated.rawUrl` may include embedded credentials. If the UI later displays raw URL, it needs the same one-time reveal treatment as token.
- SecretReveal has a copy affordance, but no failure state if Clipboard API fails.

Concrete Biscuit/Cloud changes:
1. Add tests that full `JSON.stringify(adminKeyMcpStore.state)` after `clearLastResult()` contains no generated secret/token/raw URL.
2. Ensure adapter logging excludes `createdKey.secret`, `createdMcp.token`, and `createdMcp.rawUrl`.
3. In `SecretReveal.copy()`, show a small inline failure state if clipboard write rejects; do not silently fail.
4. If raw MCP URL must be shown after create/update, show it only in `SecretReveal` and clear it with `lastResult`.

### 5. No generic AI dashboard patterns

Pass for the audited scaffold.

The admin module avoids:
- KPI card spam.
- Marketing analytics charts.
- Generic AI hero gradients or magic-particle motifs.
- Stock sidebar + card-grid admin template as the primary layout.
- Emoji-heavy personality UI.

The main styling remains low-chrome mission control: dense rows, mono metadata, quiet tabs, dark panel surfaces, and state-color restraint.

Risks to watch:
- Adding crons/webhooks/skills as independent card grids would break cohesion.
- Adding provider logos or colorful model badges everywhere would push toward generic AI SaaS.
- Overusing red for every admin action would create alarm fatigue.

### 6. Low-clutter mission-control styling

Pass with caveats.

What works:
- The admin route occupies the full shell panel, avoiding modal-driven primary work.
- Rows are information-dense but not noisy.
- Tabs are quiet and do not compete with the mission bar.
- Mock/unavailable warnings are compact and scoped.

Caveats:
- Nested tabs (`UnifiedAdminSurface` then Key/MCP tabs) are acceptable now but may become cluttered when crons/webhooks/skills arrive.
- Admin route currently hides office/chat/ops context entirely on desktop. That is acceptable for risky admin work, but Phase 8 should verify whether global connection/risk state remains visible enough in MissionBar.

Concrete Biscuit changes:
1. When crons/webhooks/skills land, avoid a third tab layer. Prefer one top-level admin section rail: Models, Keys, MCP, Crons, Webhooks, Skills.
2. Keep section headers to one line: title, count, source/freshness, primary safe action.
3. Keep destructive actions at row/detail edge, not in the header primary-action slot.

## Blockers

1. Real admin adapters missing.
   - Models have an adapter seam but no bound backend in current UI state.
   - Keys/MCP still run from mock seed data and local mock mutations.

2. Crons, webhooks, and skills surfaces are absent.
   - Phase 6 cannot be accepted until these are implemented or explicitly descoped by Sora.

3. Full lint/build verification is blocked by existing usage/telemetry TypeScript errors unrelated to the admin UX edits.
   - Targeted admin tests passed.
   - Full `npm run lint` must be re-run after Phase 5 typing cleanup.

4. Two confirmation dialog implementations create drift risk.
   - Behavior was made safer in both, but Phase 8 should consolidate.

## Exact next actions for Biscuit

1. Keep Korra's confirmation focus behavior: Cancel first, no global Enter-to-confirm for destructive actions.
2. Consolidate confirmation UI into one shared component before adding crons/webhooks/skills.
3. Add accessibility attributes to the key/MCP confirmation dialog.
4. Add one-at-a-time pending confirmation rendering to prevent modal stacking.
5. Surface `lastResult.message` as a compact non-secret toast/strip after create/update/test/revoke/delete actions.
6. Add source/freshness/confidence metadata to each admin subsection header.
7. Do not remove the mock/adapter banners until real Cloud adapters are wired and tested.
8. If a new credential or token edit flow is added, route it through one-time reveal and clear raw values from `lastResult` immediately after dismissal.

## Exact next actions for Cloud

1. Provide real adapters for:
   - model list/switch/fallback/credential reset
   - key status/create/revoke/regenerate/delete
   - MCP list/test/create/update/remove
   - cron manager
   - webhook manager
   - skills manager
2. Adapter responses must include provenance fields or enough metadata for UI to display source/freshness/confidence.
3. Never return raw secret values except one-time create/regenerate payloads; never log those payloads.
4. Missing backend capability must return unavailable/unknown state, not mock healthy rows.

## Phase 8 cohesion checklist updates to carry forward

Add these to Phase 8 final cohesion review:

1. Admin provenance consistency:
   - Every admin subsection must show `source`, `freshness`, `confidence`, and `last checked` in the same visual pattern as ops telemetry.

2. Confirmation consistency:
   - One shared confirmation component across Models, Keys, MCP, Crons, Webhooks, Skills, and later Kanban controls.
   - Cancel/default-safe focus required.
   - No modal stacking.

3. Secret surface audit:
   - Search rendered UI and store JSON for secret-like prefixes after each create/regenerate flow.
   - Confirm only the one-time reveal contains raw secret text.
   - Confirm raw values are gone after dismiss.

4. Admin action hierarchy:
   - Safe, Risk, and Danger actions must look distinct without overusing red.
   - Header primary buttons must never be destructive.

5. Cross-module state language:
   - `unknown`, `unavailable`, `mock`, `stale`, `degraded`, and `verified` must mean the same thing in Ops, Admin, and future Kanban.

6. No generic dashboard regression:
   - Crons/webhooks/skills must not become a stock card grid or settings-page clone.
   - Keep mission-control density: rows, strips, precise labels, no decorative charts.

7. Mobile/touch check:
   - Verify admin row actions remain reachable at 375px without horizontal scroll.
   - Destructive controls must have at least 44px touch target when in mobile mode or move into an overflow/action sheet.

## Phase status note

No root project status change recommended from this audit. Phase 6 remains partial scaffold: improved visual/safety cues, but real adapters and missing admin surfaces are still blockers.
