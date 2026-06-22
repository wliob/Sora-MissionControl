# Sora-MissionControl Phase 6: Lelouch Admin Workflow Copy

## 1. Admin Workflow Rules

### Model Switch
- **Rule**: Only switch models during low-activity periods (outside 9 AM–5 PM ET) to minimize disruption.
- **Procedure**:
  1. Notify team via the designated ops-alerts Discord channel 15 minutes prior.
  2. In the Admin Console, select the new model from the Model dropdown and confirm.
  3. Verify switch in the Model Status panel.
  4. Monitor error rates for 10 minutes post-switch.
- **Fallback**: If error rate >5%, revert to previous model and alert on-call.

### Cron Pause/Resume/Delete
- **Pause**:
  - Pause the cron job via the Admin Console.
  - Add comment: "Paused by <your-name> at <timestamp> for reason: <reason>".
  - Maximum pause duration: 72 hours; auto-resume after if not extended.
- **Resume**:
  - Resume the cron job via the Admin Console.
  - Verify next run time in the Cron Jobs panel.
- **Delete**:
  - Requires two-factor confirmation (see Section 3).
  - Delete the cron job via the Admin Console.
  - Archive job definition to `~/cron-archive/<job_id>-<timestamp>.yaml` before deletion (if needed for audit).
  - Never delete production cron jobs without Sora approval.

### Webhook Create/Remove/Test
- **Create**:
  - Create a webhook subscription via the Hermes webhook interface in the Admin Console.
  - Add description: "Created by <your-name> for <purpose>".
  - Set retry policy: 3 attempts with exponential backoff.
- **Remove**:
  - Same confirmation as cron delete (Section 3).
  - Remove the webhook subscription via the Admin Console; verify no active executions.
- **Test**:
  - Test the webhook subscription via the Admin Console.
  - Test payload must mirror production structure.
  - Log test results to `~/webhook-tests/<webhook_id>-<timestamp>.log` (if logging enabled).

### Key/MCP Status
- **Key Rotation**:
  - Rotate API keys quarterly via the Admin Console (status-only until verified adapter).
  - Notify dependent services 24 hours before rotation.
  - Old keys valid for 24 hours post-rotation for rollback.
- **MCP (Model Context Protocol) Status**:
  - Check MCP server status via the Admin Console.
  - If MCP reports "unavailable", trigger runbook via the Admin Console.
  - Label MCP endpoints as "mock" in dev/staging; production must use real keys.

### Skills Install/Update/Remove
- **Install**:
  - Install a skill via the Skills section in the Admin Console after testing in isolation.
  - Document skill in `SKILL.md` with trigger conditions and pitfalls.
  - Run skill-linter before submission.
- **Update**:
  - Update a skill via the Skills section in the Admin Console for minor fixes; use edit for major changes.
  - Increment version in SKILL.md frontmatter.
  - Test with skill view and related tools before deploying.
- **Remove**:
  - Only if skill is deprecated and not referenced by any cron job or workflow.
  - Remove skill via the Skills section in the Admin Console.
  - If content merged, use absorbed_into=<umbrella-skill>.
  - If purely pruning, use absorbed_into="".
  - Notify team via the designated skill-deprecations Discord channel.

## 2. User-Facing Labels & States

### Labels
- **Environment**: [DEV] [STAGING] [PROD] prefixed to all admin tool outputs.
- **Mock Data**: Label any mock/mocked output with `(MOCK)`.
- **Unavailable Service**: Label as `(UNAVAILABLE)` with suggested workaround.
- **Experimental Feature**: Tag as `[EXPERIMENTAL]` with link to documentation.

### Empty States
- **No Cron Jobs**: "No scheduled cron jobs. Create one via the Admin Console."
- **No Webhooks**: "No webhooks configured. Create a new webhook subscription via the Admin Console."
- **No Skills**: "No skills installed. Browse skills or install via the Admin Console."
- **Empty Search**: "No results found. Try broadening your query or checking spelling."

### Warning/Error Copy
- **Warning (Non-blocking)**: "⚠️ Warning: [description]. Action may have unintended side effects. Proceed?"
- **Error (Blocking)**: "❌ Error: [description]. [Suggested fix or escalation path]."
- **Deprecation**: "⚠️ Deprecated: [feature] will be removed on [date]. Use [alternative] instead."
- **Rate Limit**: "🚦 Rate limit exceeded. Retry after [seconds] seconds or contact admin."

## 3. Confirmation Language for Risky/Destructive Actions

### High-Risk Actions (Require Explicit Confirmation)
- **Model Switch in Prod**: "This will switch the AI model in PRODUCTION. Potential service disruption. Type 'CONFIRM MODEL SWITCH' to proceed."
- **Cron Delete**: "This will permanently delete cron job '<job_id>'. Type 'CONFIRM DELETE <job_id>' to proceed."
- **Webhook Remove**: "This will remove webhook '<webhook_id>' and stop all associated automations. Type 'CONFIRM WEBHOOK REMOVE <webhook_id>' to proceed."
- **Key Rotation (Immediate)**: "This will rotate API keys for <service> now, invalidating existing keys in 5 minutes. Type 'CONFIRM KEY ROTATE <service>' to proceed."
- **Skill Remove**: "This will permanently delete skill '<skill-name>'. Type 'CONFIRM SKILL REMOVE <skill-name>' to proceed."

### Medium-Risk Actions (Require Yes/No)
- **Cron Pause >24h**: "Pausing cron job for >24 hours may cause data backlog. Continue? [y/N]"
- **Skill Update (Major)**: "This update may break existing workflows. Review changelog first. Continue? [y/N]"

### Low-Risk Actions (No Confirmation)
- **Cron Resume**: Safe to resume paused jobs.
- **Webhook Test**: Test uses sandbox endpoint; no production impact.
- **Skill Install**: Installs to isolated namespace; conflicts noted on install.

## 4. Agent Completion/Report Template

```
[PHASE 6 ADMIN CONTROL] - <DATE> <TIME> ET
Agent: Lelouch
Task: <brief task description>

## Actions Taken
- <action 1> (tool used: <tool>)
- <action 2> (tool used: <tool>)
- ...

## Results
- <outcome 1>
- <outcome 2>
- ...

## Verification
- <verification step 1>: <result>
- <verification step 2>: <result>
- ...

## Next Steps / Follow-up
- <item 1> (owner: <name>, due: <date>)
- <item 2> (owner: <name>, due: <date>)

## Notes
- Any anomalies or observations
- Links to logs, artifacts, or documentation

---
Report generated by Hermes Agent (Lelouch profile)
```

## 5. Ambiguities Causing Accidental Destructive Actions

1. **Cron Job ID Reuse**:
   - Ambiguity: After deleting a cron job, creating a new job with the same ID may reuse unintended schedules.
   - Mitigation: Always verify cron job list before create; use UUIDs for job IDs when possible.

2. **Webhook Test vs. Production**:
   - Ambiguity: Webhook test executions may accidentally use production credentials if not isolated.
   - Mitigation: Use separate environments for test/dev; label test webhooks explicitly as `(TEST)`.

3. **Skill Namespace Collision**:
   - Ambiguity: Installing a skill with an existing name silently overwrites it.
   - Mitigation: Skill install in Admin Console fails if skill exists; use edit only after viewing skill to confirm.

4. **Model Switch Delayed Effect**:
   - Ambiguity: Model switch may not propagate to all agents immediately (caching).
   - Mitigation: Wait 2 minutes after switch before considering it complete; check agent logs.

5. **Key Rotation Grace Period Overlap**:
   - Ambiguity: 24-hour grace period may cause concurrent use of old/new keys, leading to auth errors.
   - Mitigation: Stagger rotation by service; monitor auth logs during grace period.

6. **Cron Pause Inheritance**:
   - Ambiguity: Pausing a parent cron job in a chain may not pause child jobs (if using context_from).
   - Mitigation: Document job chains in `~/cron-chains.md`; pause/resume entire chain manually.

7. **Empty State Misinterpretation**:
   - Ambiguity: "No results" may be mistaken for system failure rather than empty dataset.
   - Mitigation: Always prefix empty states with context: "No [items] found for [query] in [scope]".

---
*Copy last updated: 2026-06-21 by Lelouch for Sora-MissionControl Phase 6*