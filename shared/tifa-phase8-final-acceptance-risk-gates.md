# Tifa Phase 8 Final Acceptance Risk Gates

Owner: Tifa / Finance & Risk
Scope: Phase 8 final acceptance risk prep for Sora-MissionControl. Docs/audit only. No trading actions taken.
Reviewed at: 2026-06-21T19:30:04-04:00

## Executive risk call

Sora should not tell the user the completed app is ready yet. The app can continue toward Phase 8 final acceptance, but final readiness is blocked by unresolved operational-risk gates:

- Phase 6 Admin remains partial unless real adapters are bound or unavailable/mock states are unmistakable.
- Phase 7 Kanban/project control is still a placeholder route in current source (`ShellLayout.tsx` renders `EmptyView label="kanban"` for wide, medium, and narrow layouts).
- No Playwright/e2e acceptance harness or `test:e2e` script is present in current project files.
- Build/test are currently green, but the production build emits a large-chunk warning that should be tracked before final acceptance.
- Deployment artifacts are minimal (`Dockerfile`, `docker-compose.yml`) and do not yet show final Unraid/LAN rollback, healthcheck, log, backup, or observability controls.

Finance/trading surface remains no-op. I found no new trading controls in this Phase 8 prep. If future trading controls appear, they must stay separate from project/admin controls, paper-first, platform-isolated, live-disabled by deterministic approval flags, and reviewed by Tifa before exposure.

## Sources reviewed

Required project and handoff context:
- `AGENTS.md`
- `OVERVIEW.md`
- `shared/tifa-phase6-risk-approval-audit.md`
- `shared/tifa-phase7-kanban-risk-audit.md`
- `shared/korra-phase8-polish-cohesion-prep.md`
- `shared/lelouch-phase8-final-copy-cohesion-prep.md`
- `shared/README.md`

Deployment / execution artifacts reviewed:
- `Dockerfile`
- `docker-compose.yml`
- `package.json`
- Search for deploy/deployment artifacts returned no additional deploy-specific files.
- Search for `playwright.config.*` returned no Playwright config.

Current implementation/evidence inspected:
- `src/components/shell/ShellLayout.tsx`
- `src/components/admin/KeyMcpAdminPanel.tsx`
- `src/state/cwsAdminStore.test.ts`
- Searches for Playwright/e2e, Kanban placeholder, mock/unknown/unavailable/quota/secret strings, and secret-like tokens.

## Current verification evidence from this prep

Commands run from `/home/wliob/projects/Active/Sora-MissionControl`:

- `npm run lint`
  - Exit code: 0
  - Output: `tsc --noEmit` completed cleanly.

- `npm run test`
  - Exit code: 0
  - Output: `Test Files 25 passed (25)`, `Tests 502 passed (502)`.
  - Expected stderr appeared from tests that intentionally exercise office asset failure/error-boundary/multi-instance warning paths; tests still passed.

- `npm run build`
  - Exit code: 0
  - Output: Vite transformed 827 modules and built `dist/` successfully.
  - Warning: `dist/assets/index-BQkVOPWK.js` is 695.27 kB / gzip 210.16 kB, above Vite's 500 kB chunk warning threshold. This is not a hard build failure, but final acceptance should track whether code-splitting or an accepted-size decision is needed.

Secret exposure scan:
- A targeted source search found synthetic/test secret examples only, not an obvious critical real secret exposure in reviewed project source files.
- No emergency secret-remediation action was taken.

## Final acceptance status

Not ready for user-facing "completed app is ready" language.

Use this wording until gates pass:

> Sora-MissionControl has passing lint/test/build evidence for the current codebase, but final app acceptance is not complete. Admin adapter readiness, real Kanban/project-control implementation, Playwright/browser proof, and Unraid deployment rollback/observability gates still need verification before calling it ready.

## Gate 1 — Admin mutations and approval discipline

Final app review risk: Admin controls can mutate model routing, credentials, MCP endpoints, crons, webhooks, or skills. These changes can cause downtime, cost increase, credential exposure, degraded model behavior, or repeated LLM/API spend.

Must be verified before ready:
- Model admin is bound to a verified safe adapter or clearly renders unavailable.
- Key/MCP data is adapter-backed, or mock rows are clearly labeled `(MOCK)`/unavailable and mutating controls are disabled.
- Crons, webhooks, and skills surfaces are implemented with verified Hermes CLI/API adapter paths, or explicitly descoped by Sora for this release.
- All mutating admin actions route through trusted backend/adapter code, not direct browser-side filesystem/CLI/profile writes.
- Confirmation gates exist for every action that is destructive, credential-touching, routing-changing, endpoint-changing, schedule-changing, cost-affecting, or externally triggering.
- Confirmation copy includes target, scope/blast radius, operation, reversibility/rollback, source/freshness/confidence, and cost/quota state or `unknown` when relevant.
- Dangerous actions require typed confirmation where appropriate; destructive confirms must not be triggered by global Enter key behavior.
- Mutating controls are disabled or elevated when adapter state is mock, stale, unavailable, unauthorized, unverified, or unknown.
- Post-action UI distinguishes `requested`, `attempted`, `completed`, and `failed`; no action is called complete without an explicit adapter success signal and refreshed state.

Hard reject conditions:
- Mock key/MCP rows look production-real.
- Browser UI can directly mutate local Hermes config/profile state.
- Credential create/update/regenerate/delete flows execute without explicit confirmation and one-time secret handling.
- Model default/fallback/provider changes lack rollback/cost/quota context.

## Gate 2 — Kanban process controls

Final app review risk: The Kanban/project-control UI can accidentally dispatch agents, decompose tasks, reclaim/terminate active work, hide blockers, or create a second source of truth if it bypasses Hermes Kanban APIs.

Current finding:
- `ShellLayout.tsx` still renders `EmptyView label="kanban"` for `view === 'kanban'` in wide, medium, and narrow layouts. The final Kanban/project-control surface is not present in reviewed source.

Must be verified before ready:
- Kanban route renders a real Project Control surface, not `EmptyView`.
- Read state comes from verified `/api/plugins/kanban` REST/WS stores or a reviewed Cloud adapter.
- Board/task/worker/profile/event states show source, freshness, confidence, and last checked/received time.
- Stale, unknown, unauthorized, degraded, mock, or disconnected board/worker/event sources never render as green/all-clear.
- Empty board is distinguished from unavailable/unauthorized/stale data.
- Mutations route only through `/api/plugins/kanban` or a verified adapter. No direct DB, filesystem, PID, or profile-state writes from the app.
- No auto-dispatch from page load, route change, drag/drop, selection, websocket reconnect, filter changes, stale cleanup, or opening a drawer.
- Dispatch/decompose/reclaim/terminate/reassign/done/archive/delete require explicit confirmations when they can affect live work, model spend, process state, or artifact visibility.
- Terminate/reclaim confirmations show task id/title, current assignee, run id, PID if known, last heartbeat, workspace path if known, logs/artifacts availability, and data-loss/duplicate-work risk.
- Mark-done requires a result/handoff or explicit reason, and must flag active/stale/unknown worker state.
- Archive/delete must not hide or terminate active runs as a side effect.
- Optimistic UI remains pending until server/event reconciliation confirms final state.

Hard reject conditions:
- Kanban mutations write directly to DB/filesystem/profile state.
- Any UI interaction dispatches/decomposes/terminates/reclaims without a deliberate confirmation.
- Running tasks with no fresh worker/heartbeat appear healthy.
- Board fetch failures render as an empty healthy board.

## Gate 3 — Credential and secret handling

Final app review risk: Admin, deploy, webhook, MCP, chat, or adapter error paths can leak tokens/secrets into DOM, store snapshots, logs, screenshots, raw URLs, test snapshots, or user-facing error text.

Must be verified before ready:
- Normal UI stores and rows contain masked fingerprints/status only, never raw secret values.
- One-time secret reveal appears only after verified create/regenerate flows, with clear warning, short TTL or lifecycle cleanup, and dismiss/route/unmount cleanup.
- Raw secret values do not persist in ordinary store snapshots after reveal dismissal.
- Raw URLs with embedded credentials are rejected or treated as secrets; masked display values cannot be edited back as source-of-truth URLs.
- Adapter/backend error text is sanitized before entering UI state, logs, toasts, or action results.
- Redaction tests cover store serialization, DOM render paths, action logs, adapter responses, and thrown errors containing secret-like substrings.
- Clipboard copy failure has visible non-secret failure state if copy is offered.
- `.env` or runtime secret files are not included in production image/build context unless intentionally and safely excluded from client bundle.

Hard reject conditions:
- Raw provider key/token/password appears in rendered DOM outside one-time reveal.
- Raw secret appears in persistent Zustand/store JSON, localStorage/sessionStorage, console logs, test snapshots, or adapter error UI.
- Client bundle includes real credentials or production tokens.

## Gate 4 — Cost, quota, and rate-limit unknowns

Final app review risk: MissionControl can imply safe capacity or low cost when live provider quota/rate-limit sources are not verified.

Must be verified before ready:
- Provider quota/rate-limit remains `unknown` unless sourced from a verified provider/Hermes endpoint or adapter contract.
- Historical `hermes insights` usage is labeled historical and is not treated as live quota.
- Any LLM/API-triggering admin or Kanban action shows cost/quota/rate-limit state or `unknown` before execution.
- Batch/repeating actions show count, recurrence, schedule frequency, target scope, and blast radius. If estimates are unavailable, they display `unknown` instead of implied safe values.
- Cron/webhook/skill actions that can trigger recurring LLM/API work include schedule/frequency and cost/rate-limit warnings before enabling.
- No fake quota, fake latency, fake health, fake trend, fake SLA, or random-generated success values feed production health.
- Overall status badges cannot hide per-source unknowns.

Hard reject conditions:
- UI says quota/rate-limit is OK without a verified source.
- Historical spend is used as remaining quota.
- Mock/random MCP or provider tests update production health as verified.

## Gate 5 — Playwright/browser proof

Final app review risk: Unit tests and TypeScript success do not prove the final browser experience works across routes, breakpoints, motion preferences, confirmations, and deploy mode.

Current finding:
- No `playwright.config.*` file found.
- `package.json` has `dev`, `build`, `preview`, `lint`, `test`, and `test:watch`, but no `test:e2e`/Playwright script.

Must be verified before ready:
- A Playwright or equivalent browser acceptance harness exists and is committed/configured.
- It can run against `npm run preview` or the final container/LAN URL.
- It captures proof for desktop, tablet, and mobile breakpoints, at minimum 375px, 768px, 1024px, 1200px, and 1440px.
- It verifies routes: Office/default, Chat, Telemetry/Ops, Admin, Kanban/Project Control, and any deployment/status route if present.
- It verifies reduced-motion mode and keyboard/focus behavior for dialogs/drawers.
- It verifies no horizontal scroll at mobile width and touch-safe controls for destructive actions.
- It exercises unknown/stale/unavailable/mock states visually enough to prove they do not render as green/all-clear.
- It captures screenshots/traces/artifacts and exact command output for the final acceptance packet.

Hard reject conditions:
- Final acceptance relies only on Vitest/unit tests for browser/UI readiness.
- Kanban/admin confirmations are not exercised in a real browser.
- Mobile and reduced-motion states are not tested.

## Gate 6 — Build/test evidence

Current evidence from this prep is positive but not final-release sufficient by itself.

Must be verified before Sora tells the user the app is ready:
- `npm run lint` passes from a clean checkout/worktree.
- `npm run test` passes with exact test file/test counts recorded.
- `npm run build` passes with exact output recorded.
- Any build warnings are triaged: fixed, accepted with rationale, or tracked as release blocker. Current large-chunk warning needs a final decision.
- If Playwright/e2e is added, `npm run test:e2e` or equivalent passes with artifacts recorded.
- If Docker/Unraid deploy is the user-facing release path, the container build is run and the served app is smoke-tested via browser or HTTP health check.
- Test logs are reviewed for unexpected stderr/warnings. Expected test-only warnings should be called out explicitly.
- The final evidence packet includes command, cwd, timestamp, exit code, and summarized output.

Hard reject conditions:
- Any final lint/test/build/e2e command fails.
- Build output is asserted without actual command output.
- Production deploy artifact differs from tested artifact without a rebuild/retest.

## Gate 7 — Unraid deployment, rollback, and observability

Final app review risk: A visually complete app can still fail operational acceptance if the LAN deployment cannot be rolled back, observed, or safely restarted.

Current deployment artifact findings:
- `Dockerfile` builds with `node:20-alpine`, installs pnpm globally, runs `pnpm install`, then `pnpm run build`, and serves static `dist/` with `nginx:alpine`.
- `docker-compose.yml` defines one service, `sora-mission-control`, building from `.`, mapping host `80:80`, and `restart: unless-stopped`.
- No compose healthcheck, explicit image tag, versioned release tag, network policy, env-file handling, log policy, rollback notes, backup notes, or Unraid-specific appdata path is present in reviewed files.
- Port 80 on the host can conflict with other LAN services; final target port remains TBD in `OVERVIEW.md`.

Must be verified before ready:
- Final LAN host, port, protocol, and URL are declared and match the user's Unraid/Hermes host plan.
- Compose uses an explicit image/tag or reproducible build artifact tied to the tested commit/artifact.
- Rollback path is documented: prior image/tag, previous compose file, exact restart commands, and expected downtime.
- Healthcheck exists or external monitor checks the served app and records pass/fail.
- Logs are accessible through Docker/Unraid and have a retention/log-size policy.
- Static asset cache behavior is safe for rollback; old JS/CSS chunks are not referenced after rollback without corresponding files.
- Nginx/container restart behavior is verified after host reboot or Docker restart.
- Environment/secrets are not baked into the client bundle. Any dashboard API URL/token plan is explicit and safe for LAN/client exposure.
- Observability covers app availability, stale data/source health in UI, and container health/restart count.
- Deployment smoke test confirms the same artifact that passed build is what the browser serves.
- If port 80 is used, Sora verifies it does not conflict with existing Unraid services; otherwise map to a chosen app port.

Hard reject conditions:
- No rollback command/path exists.
- No health/observability path exists.
- Final deployment requires real secrets in the React client bundle.
- The deployed artifact is not tied to the tested build.

## What Sora must verify before telling the user "ready"

Sora can tell the user the completed app is ready only after all of the following are true and evidenced:

1. Product completeness
   - Phase 6 Admin is complete for the decided scope, with real adapters or clearly unavailable/descoped surfaces.
   - Phase 7 Kanban/Project Control is implemented and no longer placeholder-only.
   - Phase 8 cohesion/copy/risk reviews are performed against the completed app, not placeholders.

2. Risk controls
   - Admin and Kanban mutations use verified adapter/API paths only.
   - Destructive, credential, routing, endpoint, schedule, cost, and process-control actions require confirmations with target/scope/rollback/source/cost context.
   - No auto-dispatch, direct DB writes, hidden termination, or green stale/unknown state exists.

3. Secret controls
   - Raw secrets are absent from persistent stores, normal render paths, logs/errors, test snapshots, and production bundles.
   - One-time reveal behavior is ephemeral and tested.
   - Secret-like adapter errors are redacted.

4. Cost/quota controls
   - Provider quota/rate-limit is verified or explicitly unknown.
   - Historical usage is not treated as live quota.
   - LLM/API-triggering actions show cost/quota state or `unknown` before execution.

5. Browser proof
   - Playwright/e2e or equivalent browser acceptance exists and passes across required routes, breakpoints, mobile/touch, reduced-motion, and confirmation flows.
   - Screenshots/traces/artifacts are saved or at least command output is recorded.

6. Build/test proof
   - Final `npm run lint`, `npm run test`, `npm run build`, and e2e/container-smoke commands pass with exact outputs.
   - The current large production chunk warning is either fixed or accepted with rationale.

7. Deployment proof
   - Unraid/LAN deploy path is documented, smoke-tested, observable, restart-safe, and rollback-ready.
   - Final URL/port is known and conflict-free.
   - The deployed artifact is the same build that passed acceptance.

8. Trading/finance no-op
   - No trading controls are present, or any new trading surface is separately reviewed by Tifa and remains paper-first/live-disabled.
   - Sora does not frame this dashboard as a live finance/trading control system.

## Blocker loop results

Loop 1 — required docs and current source inspection:
- Read required handoffs and Phase 6/7/8 prep docs.
- Read deploy artifacts (`Dockerfile`, `docker-compose.yml`) and scripts (`package.json`).
- Confirmed Kanban still renders placeholder `EmptyView label="kanban"` in `ShellLayout.tsx`.
- Confirmed Key/MCP admin currently displays a mock seed data warning, so final operational acceptance still depends on adapter binding or explicit unavailable/mock behavior.
- Confirmed no Playwright config/script was present in project files.

Loop 2 — independent verification commands/searches:
- Ran `npm run lint`: pass.
- Ran `npm run test`: 25 files / 502 tests pass.
- Ran `npm run build`: pass with large-chunk warning.
- Ran targeted source secret search: no critical real secret exposure found in reviewed source; only synthetic/test secret strings surfaced.
- Searched for additional deploy artifacts; none found beyond Dockerfile/compose-style files.

Conclusion:
- This Tifa Phase 8 prep task is complete and not blocked, so no `shared/tifa-phase8-blocker.md` was created.
- Final app acceptance remains blocked until the gates above are actually verified against the completed app.

## Handoff to Sora / Cloud / Biscuit / Korra / Lelouch

Sora:
- Do not announce the app as ready yet. Use the readiness wording above until Admin, Kanban, Playwright, and Unraid deployment gates pass.
- Decide whether crons/webhooks/skills are required for Phase 6 v1 or explicitly descoped.

Cloud:
- Provide verified adapters and capability/provenance metadata for Admin and Kanban.
- Keep provider quota/rate-limit unknown until a verified source exists.
- Provide deploy/observability/rollback notes for the final Unraid target.

Biscuit:
- Finish Admin/Kanban UI implementation before final visual/copy/risk acceptance.
- Add/coordinate browser proof for final routes and confirmation flows.

Korra:
- Use this risk gate as the operational companion to the visual cohesion checklist.

Lelouch:
- Keep final copy from implying readiness where these gates are not yet verified.
