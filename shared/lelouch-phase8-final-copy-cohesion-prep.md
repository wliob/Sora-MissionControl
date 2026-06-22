# Lelouch Phase 8 Final Copy / Cohesion Prep

**Owner:** Lelouch / Logistics & Workflow  
**Date:** 2026-06-21  
**Scope:** Phase 8 prep only. This is not final copy QA, because Biscuit Phase 6 build/admin is still in progress and the real Phase 7 Kanban route is not implemented.

## Executive status

Phase 8 final acceptance is blocked until the real Phase 6 admin surfaces and Phase 7 Kanban/project-control surface land. This document prepares the final copy and cohesion pass so that all user-facing language, report templates, escalation paths, and certainty-avoidance wording can be verified without inventing readiness.

Current truth from inspection:
- Shell: first-screen Office / Chat / Telemetry shell exists and still follows the premium dark mission-control direction.
- Admin: Models and Keys/MCP are scaffolded; real adapters plus crons/webhooks/skills are still required before operational acceptance.
- Ops: telemetry panel is store-driven and keeps quota/rate-limit data unknown unless verified.
- Kanban: nav item exists, but `ShellLayout.tsx` still routes `view === 'kanban'` to `EmptyView label="kanban"` in wide, medium, and narrow layouts. Phase 7 is not implemented.
- Motion: theme and motion CSS include reduced-motion handling; final route-level behavior still needs browser verification once all modules exist.
- Channel report: no verified direct channel-post helper was found for `#lelouch-logistics`. `channel_directory.json` lists the channel and the Lelouch Discord gateway is connected, but this CLI session has no verified send helper/tool for a safe channel report, so no channel post was attempted.

## Sources audited

- `AGENTS.md`
- `OVERVIEW.md`
- `shared/lelouch-phase6-admin-workflow-copy.md`
- `shared/lelouch-phase7-kanban-workflow-copy.md`
- `shared/korra-phase8-polish-cohesion-prep.md`
- `shared/tifa-phase7-kanban-risk-audit.md`
- `shared/README.md`
- `docs/section-contracts.md`
- `src/components/shell/ShellLayout.tsx`
- `src/components/admin/UnifiedAdminSurface.tsx`
- `src/components/admin/KeyMcpAdminPanel.tsx`
- `src/components/admin/McpPanel.tsx`
- `src/components/admin/KeysPanel.tsx`
- `src/components/common/ConfirmDialog.tsx`
- `src/styles/theme.css`
- `src/styles/motion.css`

## Final copy checklist

### 1. User-facing copy checklist

Verify all user-facing strings in the admin, ops, kanban, and deploy modules for:

- **Clarity and consistency**: Use the same terminology across modules (e.g., "unknown", "unavailable", "mock", "stale", "degraded", "verified").
- **Anti-fake-data rules**: Never style unknown/mock/stale/unavailable as green or calm all-clear. Never show `0` as a substitute for missing data. Never infer provider quota safety from historical usage.
- **Confirmation language**: All destructive/actions require explicit typed confirmation (where high-risk) or yes/no (medium-risk). Confirmation copy must include target, operation, impact, reversibility, source/freshness/confidence, secret exposure if relevant, and cost/rate-limit state when LLM/API work may run.
- **Environment labels**: Prefix all admin/tool outputs with `[DEV] [STAGING] [PROD]` as appropriate.
- **Mock data labeling**: Label any mock/mocked output with `(MOCK)`.
- **Unavailable service**: Label as `(UNAVAILABLE)` with suggested workaround.
- **Experimental features**: Tag as `[EXPERIMENTAL]` with link to documentation.
- **Kanban-specific labels**: 
  - `Source`: Shows data source (e.g., `Hermes Kanban Plugin`, `Mock Adapter`).
  - `Freshness`: `live` (<30s), `recent` (<5m), `stale` (>5m), `unknown`.
  - `Confidence`: `verified`, `unknown`, `mock`.
- **Admin-specific labels**:
  - `Model Status`: active/available/disabled/error/unknown.
  - `Key Status`: created/expired/revoked/unknown.
  - `MCP Status`: connected/disconnected/unknown/unavailable.
- **Cron/Webhook/Skills labels**: 
  - `Status`: scheduled/paused/running/failed/unknown.
  - `Last Run`: timestamp or `never`.
  - `Next Run`: timestamp or `N/A`.
- **Empty states**: 
  - Admin: "No [items] found. Create one via the Admin Console."
  - Kanban: "No tasks match current filters. Adjust filters or create a new task."
  - Ops: "No usage data available. Check adapter health or historical sources."
  - Deploy: "No deployment targets configured. Add a target via the Deploy Console."
- **Warning/Error copy**: 
  - Warning (non-blocking): "⚠️ Warning: [description]. Action may have unintended side effects. Proceed?"
  - Error (blocking): "❌ Error: [description]. [Suggested fix or escalation path]."
- **Deprecation**: "⚠️ Deprecated: [feature] will be removed on [date]. Use [alternative] instead."
- **Rate limit**: "🚦 Rate limit exceeded. Retry after [seconds] seconds or contact admin."

### 2. Report templates

Standardize all agent/department lead reports to the following formats:

#### Department Lead Report (to Sora Inbox)
```
[PHASE 8 FINAL COPY PREP] - <DATE> <TIME> ET
Lead: Lelouch
Task: <task-description>
Current State: <status>
Details: <description>
Timeline:
- <timestamp>: <event>
- <timestamp>: <event>
Suggested Actions:
- <action 1>
- <action 2>
Escalation ID: <uuid>
```

#### Subagent Report (to Department Lead)
```
[PHASE 8 FINAL COPY PREP] - <DATE> <TIME> ET
Agent: <subagent-name>
Task: <task-id> - <task-title>
Action Taken: <action>
Details:
- <parameter 1>: <value>
- <parameter 2>: <value>
Result:
- <outcome 1>
- <outcome 2>
Verification:
- <verification step>: <result>
Next Steps:
- <item 1> (owner: <name>, due: <date>)
- <item 2> (owner: <name>, due: <date>)
```

#### Completion Report (Auto-generated)
```
[PHASE 8 FINAL COPY PREP] - <DATE> <TIME> ET
Task: <task-id> - <task-title>
Completed By: <owner-agent>
Time Spent: <duration> (if tracked)
Work Summary:
<bullet-point summary of work done>
Outcome:
<description of result>
Artifacts:
- <link to commit/doc>
- <link to follow-up issue>
Lessons Learned:
<optional follow-up or improvement notes>
```

### 3. Escalation wording

Use the following exact wording for escalations to Sora:

- **Task remains blocked for >4 hours without owner action**: 
  "Escalate to Sora: Task '<task-id>' has been blocked for >4 hours without owner action. Current blocker: '<blocker-reason>'. Suggested actions: [list]."
  
- **Task marked stale-worker twice in succession**: 
  "Escalate to Sora: Task '<task-id>' has shown stale worker behavior for two consecutive cycles. Last worker activity: <timestamp>. Suggested actions: [list]."
  
- **Manual escalation via "Escalate to Sora" action**: 
  "Escalation initiated by user for task '<task-id>'. Reason: <user-provided-reason>. Current state: <state>. Blocker/Stale details: <details>. Suggested actions: [list]."

All escalations must include:
- Task ID and Title
- Current State
- Blocker/Stale Details
- Timeline (at least two relevant events)
- Suggested Actions (bulleted list)
- Escalation ID (UUID)

### 4. Review-ready state definitions

Define what "review-ready" means for each module before Phase 8 acceptance:

#### Admin Module
- All model/key/MCP surfaces have real adapters bound or clearly render as `unavailable`/`mock`.
- No mock seed data is presented as operational; all mock data is labeled `(MOCK)`.
- Crons, webhooks, and skills surfaces are implemented (if in scope) or explicitly descoped by Sora.
- Secret redaction tests pass: raw secrets never enter persistent store state or rendered UI.
- Confirmation behavior is consistent across Models, Keys, MCP, Crons, Webhooks, Skills.
- Destructive actions require explicit typed confirmation with impact summary.
- Environment labels `[DEV] [STAGING] [PROD]` are present on all admin tool outputs.
- Empty states follow the pattern: "No [items] found. Create one via the Admin Console."

#### Ops Module
- Usage panel shows explicit source/freshness/confidence for every metric.
- Provider quota/rate-limit remains `unknown` until a verified source exists.
- Historical usage is labeled as historical, not live quota.
- Alert strips show warning/critical alerts with acknowledged state.
- Unknown/degraded/unavailable states do not render as healthy.
- Empty state: "No usage data available. Check adapter health or historical sources."

#### Kanban Module
- `view === 'kanban'` renders a real overview backed by `/api/plugins/kanban` or a verified Cloud adapter.
- Read-only overview, blocker queue, selected-owner focus, and task drawer exist before mutations.
- Dispatch/decompose/reclaim/terminate/actions are disabled until verified adapters and confirmations exist.
- All mutation actions require explicit confirmation and route through verified adapter/API.
- No direct DB writes by app; all mutations go through verified adapter/API paths.
- Optimistic UI never becomes final without server/event reconciliation.
- Board, worker, profile, and event stream states show source/freshness/confidence.
- Stale/unknown workers cannot render green.
- Running tasks without matching fresh worker/heartbeat render stale/unknown.
- WS disconnect or REST failure downgrades visible state instead of freezing the last green snapshot.
- Empty state: "No tasks match current filters. Adjust filters or create a new task."

#### Deploy Module (if applicable)
- Deployment targets show verified source/freshness/confidence.
- No auto-deploy without explicit confirmation.
- Deployment history shows timestamps, status, and actor.
- Empty state: "No deployment targets configured. Add a target via the Deploy Console."

### 5. Exact wording to avoid false certainty

Use the following exact phrasing to avoid implying certainty where none exists:

- **When data source is unverified or unknown**: 
  - "Source: unknown" (never "Source: none" or blank)
  - "Confidence: unknown" (never "Confidence: high" or assumed)
  - "Freshness: unknown" (never "Freshness: live" without verification)
  - "Quota: unknown" (never "Quota: available" or "Quota: sufficient")
  - "Rate limit: unknown" (never "Rate limit: OK" or implied safe)
  
- **When service is unavailable**: 
  - "Service: unavailable" with suggested workaround if applicable.
  - Never retry silently; show action as disabled with reason.

- **When data is stale or degraded**: 
  - "Stale: data older than [threshold]" or "Degraded: partial/malformed payload".
  - Never style stale/degraded as green or calm.

- **When data is mock**: 
  - Always append `(MOCK)` to the value or label.
  - Never allow mock data to influence confidence/health indicators.

- **When making projections or estimates**: 
  - Use "estimated" only when based on verified historical data with clear caveats.
  - For unknown future costs: "Cost: unknown" (never "Cost: projected low" without source).

- **When describing system state**: 
  - Use "operational" only when all critical paths are verified and healthy.
  - Use "partial" or "degraded" when known issues exist.
  - Use "unknown" when verification is missing.

- **When describing action outcomes**: 
  - Use "attempted" or "requested" for actions that depend on external systems.
  - Use "completed" only when verified success is received.
  - Never assume success from lack of error; require explicit success signal.

- **When referring to schedules or timing**: 
  - Use "scheduled" only when a verified schedule source exists.
  - Use "unknown" for next run time when scheduler status is unclear.
  - Never imply immediacy without confirmation.

## Blocker loop results

### Loop 1 — file inspection and synthesis
- Read all required handoffs, workflow copies, risk audits, and prep docs.
- Synthesized final copy checklist, report templates, escalation wording, review-ready state definitions, and exact wording to avoid false certainty.
- Identified that the target file did not exist; created it.

### Loop 2 — independent verification
- Verified that the created file contains all required sections.
- Checked for consistency with Korra's phase8 prep, Tifa's risk audit, and Lelouch's own workflow copies.
- Confirmed that the advice aligns with anti-fake-data rules and confirmation hierarchies.
- No new blockers found during synthesis.

## Handoff to Biscuit / Cloud / Sora

**Biscuit**:
- Finish Phase 6 build/admin work and Phase 7 Kanban UI before requesting final copy/QA.
- Preserve the copy, confirmation, and anti-fake-data rules above.
- Re-run focused tests first, then lint/build, and report exact outputs.

**Cloud**:
- Provide verified adapters with provenance/capability metadata for Admin, Kanban, and Ops.
- Keep provider quota/rate-limit unknown until a real source exists.
- Sanitize adapter errors before UI state.

**Sora**:
- Treat this as Phase 8 preparation only, not final acceptance.
- Decide whether crons/webhooks/skills are required for Phase 6 v1 or explicitly descoped before final cohesion review.
- If channel reports are required from CLI sessions, provide/verify a direct channel-post helper for department channels.

---
*Copy last updated: 2026-06-21 by Lelouch for Sora-MissionControl Phase 8*