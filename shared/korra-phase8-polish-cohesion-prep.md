# Korra Phase 8 Final Polish / Cohesion Prep — smc-p8-korra-polish-cohesion-prep

Owner: Korra / Creative & Media
Date: 2026-06-21
Scope: Phase 8 prep only. This is not final visual QA, because Biscuit Phase 6 build/admin is still in progress and the real Phase 7 Kanban/project-control route is not implemented.

## Executive status

Phase 8 final acceptance is blocked until the real Phase 6 admin surfaces and Phase 7 Kanban/project-control surface land. This document prepares the final cohesion pass so Korra/Biscuit/Cloud can verify the finished product without inventing readiness.

Current truth from inspection:
- Shell: first-screen Office / Chat / Telemetry shell exists and still follows the premium dark mission-control direction.
- Admin: Models and Keys/MCP are scaffolded; real adapters plus crons/webhooks/skills are still required before operational acceptance.
- Ops: telemetry panel is store-driven and keeps quota/rate-limit data unknown unless verified.
- Kanban: nav item exists, but `ShellLayout.tsx` still routes `view === 'kanban'` to `EmptyView label="kanban"` in wide, medium, and narrow layouts. Phase 7 is not implemented.
- Motion: theme and motion CSS include reduced-motion handling; final route-level behavior still needs browser verification once all modules exist.
- Channel report: no verified direct channel-post helper was found for `#korra-creative`. `channel_directory.json` lists the channel and the Korra Discord gateway is connected, but this CLI session has no verified send helper/tool for a safe channel report, so no channel post was attempted.

## Sources audited

Project guidance:
- `AGENTS.md`
- `OVERVIEW.md`
- `shared/korra-phase7-kanban-ux.md`
- `shared/korra-phase6-admin-ux.md`
- `docs/phase1-shell-review.md`
- `shared/README.md`

Current implementation inspected:
- `src/components/shell/ShellLayout.tsx`
- `src/components/shell/MissionBar.tsx`
- `src/components/shell/OpsPanel.tsx`
- `src/components/shell/AdminPanel.tsx`
- `src/components/admin/UnifiedAdminSurface.tsx`
- `src/components/admin/KeyMcpAdminPanel.tsx`
- `src/components/admin/KeysPanel.tsx`
- `src/components/admin/McpPanel.tsx`
- `src/components/admin/AdminSectionShell.tsx`
- `src/components/admin/ConfirmDialog.tsx`
- `src/components/common/ConfirmDialog.tsx`
- `src/styles/theme.css`
- `src/styles/motion.css`

Design guidance loaded:
- `ui-ux-pro-max`, UX query for premium dark mission-control admin/Kanban/ops/accessibility/mobile/reduced-motion.
- Relevant retrieved guidance: respect `prefers-reduced-motion`, avoid excessive animation, use easing intentionally, and keep mobile form/input behavior explicit.

## Phase 8 readiness gate

Do not start final visual QA until all of these are true:

1. Phase 6 implementation readiness
   - Model admin has a verified adapter bound or clearly renders unavailable.
   - Key/MCP mock seed data is removed or clearly impossible to confuse with operational data.
   - Crons, webhooks, and skills surfaces are implemented or explicitly descoped by Sora.
   - Secret redaction tests are green after real adapters are wired.
   - Confirmation behavior is consistent across Models, Keys, MCP, Crons, Webhooks, Skills.

2. Phase 7 implementation readiness
   - `view === 'kanban'` no longer renders `EmptyView`.
   - Real Project Control/Kanban surface exists and is backed by `/api/plugins/kanban` or a verified Cloud adapter.
   - Read-only overview, blocker queue, selected-owner focus, and task drawer exist before mutations.
   - Dispatch/decompose/reclaim/terminate actions are disabled until verified adapters and confirmations exist.

3. Whole-product readiness
   - App starts successfully in a browser.
   - No TypeScript/build blockers remain from parallel Biscuit work.
   - Latest tests/lint/build are reported by Biscuit/Cloud with exact output.
   - Final data source labels remain honest: `verified`, `unknown`, `unavailable`, `mock`, `stale`, and `degraded` mean the same thing across Ops, Admin, and Kanban.

## Final cohesion checklist

### 1. Product silhouette and first-screen hierarchy

Verify:
- Desktop first screen still reads as one mission-control room, not a generic dashboard.
- Office remains the visual anchor on the default route; Chat and Telemetry support it instead of competing for equal card-grid weight.
- MissionBar stays thin and quiet with connection state first, then product identity/nav.
- Admin and Kanban are deeper control routes, not first-screen card spam.
- Floating chat overlay does not duplicate the docked Chat route when Chat is active.
- No route introduces a hero gradient, marketing stats, generic AI motif, or unrelated illustration layer.

Reject if:
- The default route becomes a KPI dashboard.
- Kanban opens with decorative analytics instead of ownership/blockers/current work.
- Admin crons/webhooks/skills arrive as a stock settings-page grid unrelated to existing row/strip language.

### 2. Cross-module visual language

Verify:
- Same dark depth stack everywhere: `--bg-0`, `--bg-1`, `--bg-2`, `--surface-base`, `--surface-active`.
- Same status color meanings everywhere:
  - cyan/green: live or verified movement,
  - amber: stale, warning, rate/cost uncertainty,
  - red: blocked, failed, destructive/danger,
  - violet: command/control/review context,
  - dim grey: unknown/unavailable/disabled.
- Status pills, mono metadata, alert strips, source/freshness/confidence labels, and confirmation panels share one grammar.
- No module introduces raw one-off hex colors, ad-hoc badge shapes, or new visual metaphors without Korra review.
- Agent accents stay small and harmonized; no rainbow agent UI.

### 3. Provenance and anti-fake-data cohesion

Verify every live-looking value has visible source context when it matters:
- Source name or adapter route.
- Freshness: live/fresh/stale/missing/unknown.
- Confidence: verified/partial/degraded/unknown/mock.
- Last checked/received timestamp or age.
- Disabled action reason when capability is unavailable.

Reject if:
- Missing source renders as `0` instead of `unknown` or `unavailable`.
- Stale source renders as green/all-clear.
- Mock seeded rows look operational.
- Historical usage is visually treated as real-time quota.
- Provider quota/rate-limit shows a healthy value without verified source.
- Kanban failed fetch renders as an empty board.

### 4. Confirmation and risk hierarchy

Verify:
- One shared confirmation behavior is used or intentionally equivalent across Admin and Kanban.
- Cancel receives initial focus for risk/danger/cost actions.
- Escape cancels.
- Backdrop dismiss cancels only; never confirms.
- Enter does not globally confirm destructive/cost actions.
- Only one confirmation surface is active at a time.
- Confirm copy includes target, operation, impact, reversibility, source/freshness/confidence, secret exposure if relevant, and cost/rate-limit state when LLM/API work may run.
- Header primary buttons are never destructive.

Specific actions requiring this standard:
- Admin: set default, set fallback, disable/enable runtime-impacting controls, reset credential, delete, revoke, regenerate, remove MCP, future cron/webhook/skill destructive actions.
- Kanban: dispatch, decompose, reclaim, terminate, delete/archive, dependency mutation, reassign/status changes if adapter writes real state.

### 5. Secret and credential visual rules

Verify:
- Lists show masked fingerprints only.
- Raw secret/token/raw URL appears only in one-time reveal UI after create/regenerate, never in ordinary rows, logs, toasts, or persistent store snapshots.
- Dismissing one-time reveal clears raw values from visible state.
- Clipboard failure has a visible inline failure state if copy is offered.
- Any raw URL with embedded credentials is treated as a secret, not ordinary metadata.
- Searching UI text and store snapshots after reveal dismissal does not expose secret-like prefixes.

### 6. Ops/Telemetry final checks

Exact screens/states to verify:
- Fresh usage snapshot with known token/cost/call metrics.
- Empty usage payload.
- Malformed/partial usage payload.
- Missing usage adapter.
- Provider quotas unavailable/no verified live source.
- Source health: connected, degraded, offline, unknown.
- Alert strip with warning/critical alerts and acknowledged alert state.
- Medium layout ops dock under Office.
- Narrow/mobile Telemetry route.

Acceptance points:
- Risk-first order remains: alerts, source health, consumption, provider quotas.
- Unknown quota text remains explicit.
- Alert colors are paired with labels/messages, not color-only meaning.
- Long source names and notes truncate/wrap without horizontal page scroll.

### 7. Admin final checks

Exact screens/states to verify:
- Models: adapter unavailable empty state.
- Models: loaded model list with active/available/disabled/error/unknown statuses.
- Models: selected model detail with missing credential, configured credential, and error credential states.
- Models: edit label/config flow with disabled controls when adapter missing.
- Models: each risk/danger confirmation.
- Keys: mock/adapterless state if still present; real adapter state when landed.
- Keys: empty list, create form, one-time reveal, revoke/regenerate/delete confirmations, post-action non-secret result message.
- MCP: empty list, create form, token reveal, test success/failure, edit, remove confirmation.
- Future Crons/Webhooks/Skills: unavailable, empty verified, loaded verified, mutation pending, mutation failed, mutation succeeded.

Acceptance points:
- Crons/webhooks/skills should join the existing admin section rail; avoid adding a third tab layer.
- Row/action atoms should feel identical between Keys and MCP.
- Disabled controls name why they are disabled.
- Accessibility attributes are present on confirmation dialogs.
- Any adapter error shown to the user is sanitized.

### 8. Kanban / Project Control final checks

Exact screens/states to verify after Phase 7 lands:
- Fresh verified board with mixed statuses.
- Verified empty board.
- Source unavailable.
- Unauthorized/session invalid.
- Stale board snapshot.
- Event stream disconnected with fresh REST snapshot.
- Partial task detail load failure.
- Owner focus for known leads: Cloud, Biscuit, Korra, Lelouch, Tifa.
- Unknown/custom assignee.
- Blocker queue with explicit blocked status.
- Blocker queue with stale/missing heartbeat.
- Review-needed tasks.
- Active worker without matching running task.
- Task drawer Details / Activity / Comments / Run-Logs / Links sections.
- Dispatch confirmation with provider quota unknown.
- Decompose confirmation with provider quota unknown.
- Reclaim/terminate failure and success response distinction: `request sent` versus `board updated`.

Acceptance points:
- The first scan answers who owns what, what is moving now, what is blocked/stale, and what is safe to do next.
- Board columns follow canonical order: `triage`, `todo`, `scheduled`, `ready`, `running`, `blocked`, `review`, `done`.
- Counts do not imply health unless provenance is fresh/verified.
- Blocker data stale is not all-clear.
- Cross-links use shared selected-agent state, not a private drifting Kanban selection state.

### 9. Chat / Office / cross-link final checks

Exact screens/states to verify:
- Default Office route with active avatars.
- Office fallback/error and low-FPS/perf mode states.
- Chat profile list and selected profile.
- Chat demo/unavailable transport copy.
- Floating chat closed, open, repositioned, resized, and mobile clamped.
- Selected office avatar -> Chat profile focus where supported.
- Selected owner in Kanban -> Office focus / Chat action where supported.

Acceptance points:
- Chat remains command-console-like, not consumer bubbles.
- Demo/unavailable chat transport stays honestly labeled.
- Office remains the living truth source; Kanban/Chat cross-link to it instead of duplicating presence UI.

## Responsive, mobile, touch, and reduced-motion checks

### Breakpoints to test

- 375px width: phone minimum.
- 430px width: larger phone.
- 768px width: tablet transition.
- 1024px width: tablet/compact laptop.
- 1200px width: wide layout threshold.
- 1440px+ width: intended desktop review.

### Mobile/touch checklist

Verify at 375px:
- No horizontal page scroll on Office, Chat, Telemetry, Admin, or Kanban.
- Mission title truncates cleanly and MissionBar still shows highest-priority health state.
- Segmented nav remains tappable; each tab is at least 44px tall or has an equivalent safe hit target.
- Dense row actions collapse into a labeled `Actions` affordance or bottom sheet where inline buttons become too small.
- Touch targets for destructive/admin/Kanban actions are at least 44x44px with at least 8px separation from adjacent destructive or safe-primary actions.
- Drawers/bottom sheets respect safe area and can be dismissed with visible Close, Escape where available, and cancel-only backdrop.
- Long paths, URLs, task titles, errors, and model IDs wrap/truncate with accessible full text and do not force horizontal scroll.
- Mobile form inputs use appropriate keyboard/input behavior where relevant, especially URL/token/numeric fields.

### Reduced-motion checklist

Verify with `prefers-reduced-motion: reduce` enabled:
- Entrance animations are disabled or instant.
- Floating chat pop animation is disabled.
- Office scene respects reduced motion/perf mode behavior.
- Shimmer/pulse animations stop or become static.
- Drawer/bottom-sheet motion avoids sweeping movement; use instant state or minimal opacity change.
- No scroll-jacking, parallax, or spectacle animation appears in final modules.

### Keyboard/focus checklist

Verify:
- Tab order matches visual order.
- Focus outline is visible on dark surfaces.
- Opening a drawer/dialog moves focus into it.
- Closing drawer/dialog returns focus to the originating control.
- Escape closes dialogs/drawers where expected.
- Icon-only controls have accessible names.
- Disabled controls either remain focus-skipped or expose the disabled reason near the control.

## Anti-fake-data visual rules

These are hard rules for Phase 8 acceptance:

1. Never use fake trend arrows, fake velocity, fake SLA, fake completion rate, fake quota, or fake health charts.
2. Never style `unknown`, `mock`, `missing`, `stale`, or `unavailable` as green or calm all-clear.
3. Never show `0` as a substitute for missing data.
4. Never show seeded demo/admin rows without a visible mock/seed label.
5. Never infer provider quota safety from historical token/cost usage.
6. Never allow actions against stale/mock/unavailable sources unless Sora explicitly enables a read-only/demo mode and the UI labels it as such.
7. Never bury source/capability uncertainty in console logs only.
8. Never make charts without real data, provenance, and table/text fallback.
9. Never show raw JSON as the primary task/admin UI, except behind an explicit debug/details disclosure.
10. Never use visuals to imply implementation readiness before Biscuit/Cloud have verified adapters and builds.

## Low-risk fix applied now

Applied one doc-only/comment fix:
- `src/components/common/ConfirmDialog.tsx`: updated the header comment so it no longer claims Enter confirms. Current behavior focuses Cancel and only Escape is globally handled.

No code-heavy Phase 7 surface was implemented. No design-token changes were made.

## Blocker loop results

Loop 1 — project/file inspection:
- Read required handoffs and audited shell/admin/ops components.
- Confirmed Kanban remains placeholder-only via `EmptyView` in `ShellLayout.tsx`.
- Confirmed Phase 6 admin remains partial: model adapter absent in current UI, Keys/MCP mock seed banner present, crons/webhooks/skills absent.

Loop 2 — independent verification searches:
- Searched source for `ProjectControlSurface`, `src/modules/kanban`, and `view === 'kanban'`; only placeholder route matches were found.
- Searched source for mock/unknown/unavailable/rate-limit language; current Ops/Admin warnings are present and should be preserved until real adapters land.
- Searched source for reduced-motion/touch evidence; reduced-motion CSS and floating chat mobile constraints exist, but final browser/mobile QA must wait for completed routes.

Conclusion:
- Phase 8 prep is complete and not blocked.
- Final Phase 8 visual QA remains intentionally not started because Phase 6/7 implementation is incomplete.
- No `shared/korra-phase8-blocker.md` was created because this prep task itself was not blocked; the implementation readiness blockers are recorded above.

## Handoff to Biscuit / Cloud / Sora

Biscuit:
- Finish Phase 6 build/admin work and Phase 7 Kanban UI before requesting final Korra QA.
- Preserve the anti-fake-data and confirmation hierarchy rules above.
- Re-run focused tests first, then lint/build, and report exact outputs.

Cloud:
- Provide verified adapters with provenance/capability metadata for Admin and Kanban.
- Keep provider quota/rate-limit unknown until a real source exists.
- Sanitize adapter errors before UI state.

Sora:
- Treat this as Phase 8 preparation only, not final acceptance.
- Decide whether crons/webhooks/skills are required for Phase 6 v1 or explicitly descoped before final cohesion review.
- If channel reports are required from CLI sessions, provide/verify a direct channel-post helper for department channels.
