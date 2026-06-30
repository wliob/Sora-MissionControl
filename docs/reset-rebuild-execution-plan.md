# Sora-MissionControl Reset/Rebuild Execution Plan

Date: 2026-06-22
Owner: Sora / Central Command

## Non-negotiable product target

Build a faithful Hermes Dashboard TUI clone with a built-in 3D office visual component.

This is **not** a bespoke mission-control/admin SPA. The shell, information architecture, naming, and first impression must read as "Hermes dashboard, upgraded with a living office panel."

## Current failure being corrected

The current app is technically broad but product-wrong:

- It centers a custom Mission Control IA instead of Hermes dashboard parity.
- It ships demo/partial surfaces as if they were accepted product slices.
- Real chat/admin/model routes are unavailable or partial, while tests mostly prove demo behavior.
- The deployed office visual is corrupted by chroma/green asset rendering and fractured composition.
- Prior Kanban green statuses are not sufficient proof of real acceptance.

## Command operating model

Sora is executive command, not the implementation bottleneck.

1. Sora defines phase goals, acceptance gates, and dependencies.
2. Department leads own their domain phases.
3. Leads may use their own subagents/delegation and Codex CLI where appropriate.
4. Sora independently verifies outputs before accepting `done`.
5. No card is accepted from status alone; proof artifacts are required.

## Department responsibilities

### Korra — Product/design lead

Goal: produce the exact product/design contract.

Required skills:
- `kazekage-design`
- `ui-ux-pro-max`
- `dashboard-plugin-development`
- `popular-web-designs` only if reference styling is needed
- Codex optional for artifact drafting/review

Deliverables:
- Real Hermes dashboard reference inventory/screenshots.
- Layout contract for primary dashboard shell.
- Exact office component placement and behavior.
- Forbidden drift list: custom mission-control labels, decorative admin-first framing, fake telemetry.
- Visual acceptance rubric.

Exit criteria:
- Sora can compare implementation screenshot against spec and say pass/fail without taste debate.

### Cloud — Infrastructure/access lead

Goal: remove recurring auth/deploy/access blockers before implementation depends on them.

Required skills:
- `dashboard-plugin-development`
- `docker-management`
- `systemd-node-services`
- `hermes-auth-credentials`
- `homelab-reference`
- Codex optional for script/review work

Deliverables:
- Access matrix: local dev, Hermes dashboard API, Kanban API, proxy, Unraid deploy.
- Same-origin/session bridge plan that avoids undeclared `window.__HERMES_SESSION_TOKEN__` reliance.
- Verified non-demo API read from app/proxy context.
- Deploy and rollback runbook.

Exit criteria:
- Non-demo app can reach the required live Hermes data, or blocker is documented as true user-action requirement.

### Biscuit — Coding/implementation lead

Goal: rebuild the shell around Hermes TUI parity and integrate the fixed office.

Required skills:
- `codex`
- `subagent-driven-development`
- `test-driven-development`
- `react-frontend`
- `kazekage-coding`
- `dashboard-plugin-development`
- `systematic-debugging`

Codex strategy:
- Use Codex for scoped implementation/review loops, not broad vague rewrites.
- Each Codex run gets exact phase goal, files in scope, acceptance commands, and stop condition.
- Codex may run multiple loops until the phase passes local gates.
- Sora/Biscuit must still verify; Codex output is not accepted by claim alone.

Exit criteria:
- `npm run lint` passes.
- `npm test -- --run` passes.
- `npm run build` passes.
- Playwright/non-demo browser proof passes.
- Screenshot matches Korra spec and office is not green/corrupted.

### Lelouch — Workflow/copy/mental-model lead

Goal: make the product understandable and honest.

Required skills:
- `executive-operating-model`
- `humanizer`
- `google-workspace` or notes tooling only if external docs are needed

Deliverables:
- Dashboard labels and empty states aligned to Hermes concepts.
- Honest unavailable/demo/unknown copy.
- User-flow review for command/chat/Kanban/current-work interactions.

Exit criteria:
- No user-facing copy implies live support where only demo/unavailable support exists.

### Tifa — Risk/false-green audit lead

Goal: prevent another false pass.

Required skills:
- risk-gating style checklist skills
- `requesting-code-review` if available through coding profile support
- Codex review can be used read-only if auth is fixed for the profile

Deliverables:
- Stop-ship checklist.
- False-green audit: every green result maps to real proof.
- Risk signoff before deploy.

Exit criteria:
- Every accepted feature has a linked command output, screenshot, or live endpoint proof.

## Phase gates on Kanban

Tenant: `sora-missioncontrol-reset`

- `smc-reset-00-command-gate` — Sora command gate, current card.
- `smc-reset-01-korra-product-spec` — design/product target.
- `smc-reset-02-cloud-access-bridge` — access/auth/proxy/deploy proof.
- `smc-reset-03-biscuit-shell-rebuild` — shell implementation.
- `smc-reset-04-biscuit-office-fix` — office visual corruption fix.
- `smc-reset-05-lelouch-workflow-copy` — user mental model/copy.
- `smc-reset-06-tifa-risk-gate` — false-green audit.
- `smc-reset-07-sora-final-acceptance` — independent final acceptance/deploy proof.

Default statuses are scheduled except Sora command gate. No department implementation card should move to ready until its dependencies are satisfied.

## Anti-false-green rules

A card cannot be marked done unless it includes:

1. Exact commands run.
2. Exact result or artifact path.
3. Screenshot/video for visual work.
4. Live URL/API proof for integration work.
5. Clear list of unsupported/unavailable behavior.
6. Sora independent verification or explicit Sora waiver.

Forbidden acceptance evidence:

- Demo mode only (`?demo=1`) for final product claims.
- Unit tests alone for browser/rendering features.
- Build pass alone for product parity.
- Worker says "done" without file diff/artifact proof.
- Green Kanban status without verification.

## Codex utilization strategy

Use Codex subscription heavily but intelligently:

- Biscuit is primary Codex implementation owner.
- Korra can use Codex for spec drafting and visual review scripts, but design judgment remains Korra.
- Cloud can use Codex for proxy/deploy script review, but secrets/access stay human-audited.
- Tifa can use Codex read-only review once profile auth is fixed.

Codex prompt template per phase:

```text
Project: /home/wliob/llm-brain/Projects/Active/Sora-MissionControl
Role: [department lead]
Phase card: [card id]
Goal: [one bounded deliverable]
Constraints:
- Correct product target is Hermes dashboard TUI clone + built-in 3D office.
- Do not accept demo-only proof.
- Do not print or commit secrets.
- Keep changes small and verified.
Required checks:
- [phase-specific commands]
- [browser/screenshot/API proof]
Stop condition:
- Continue debugging until checks pass or produce exact blocker with command output.
```

## Readiness status verified 2026-06-22

- Main Codex auth works after fresh device login: `codex-cli 0.134.0`, logged in using ChatGPT.
- Biscuit/Cloud/Korra/Lelouch/Tifa profile Codex auth works from isolated profile HOME.
- Real `codex exec` smoke tests passed for Cloud, Korra, Lelouch, and Tifa with exact `CODEX_READY_<profile>` output.
- Cloud/Korra/Lelouch/Tifa profile Codex configs trust `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`.
- Role-relevant reset skills are present in each target profile.
- `kanban.dispatch_in_gateway` was set to `false` before reset cards were created to prevent surprise auto-dispatch.
- Existing Sora-MissionControl Kanban has many old done cards plus a few blocked/todo cards from the wrong product track. Treat old track as historical, not acceptance proof for reset.

## What Sora still needs from user

1. Confirmation whether to archive old Sora-MissionControl Kanban track or leave it as historical while the reset tenant is active.
2. Any must-have Hermes Dashboard TUI screenshots/behaviors if the live dashboard reference does not capture what you mean.

## Immediate next actions

1. Route `smc-reset-01` to Korra and `smc-reset-02` to Cloud first.
2. Hold Biscuit implementation until Korra+Cloud gates are accepted.
3. Run independent verification after every returned phase.
