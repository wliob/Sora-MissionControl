# Sora-MissionControl Phase 7: Lelouch Kanban Workflow Copy

## 1. Kanban Workflow Rules

### Ownership Overview
- **Rule**: The ownership overview panel displays all active tasks with current owner, status, and blocker status.
- **Procedure**:
  1. Data sourced from `/api/plugins/kanban/board` via Cloud adapter.
  2. Each task row shows: Task ID, Title, Owner (agent/profile), Status (blocked/running/review/done/todo/scheduled), and Blocker indicator.
  3. Clicking a task opens the task drawer for details.
  4. Refresh interval: 30 seconds (configurable via admin settings).
  5. Empty state: "No active tasks. Check filters or create a new task via the task drawer."
- **Labels**:
  - `Owner`: Displayed as `agent-name` or `unassigned`.
  - `Status`: Uses color-coded pills: blocked (red), running (yellow), review (blue), done (green), todo (gray), scheduled (purple).
  - `Blocker`: Shown as ⚠️ icon with tooltip on hover.

### Task Drawer
- **Rule**: The task drawer provides detailed view and controls for a selected task.
- **Procedure**:
  1. Opened by clicking a task in the ownership overview or via `kanban.task.selected` event.
  2. Sections: Task Metadata, Description, Comments, Reports, Diagnostics, Actions.
  3. Task Metadata includes: Task ID, Created/Updated timestamps, Owner, Priority, Estimated Effort, Tags.
  4. Description field is read-only; edit via decompose action if needed.
  5. Comments section shows chronological discussion; add new comment via input at bottom.
  6. Reports section shows completion reports and stale-worker reports (see below).
  7. Diagnostics panel shows runtime logs, worker status, and resource usage (if available).
  8. Actions button group: Dispatch, Decompose, Reclaim Owner, Terminate Worker, Move to Done, Reopen, Archive/Delete.
  9. Close drawer via ESC or clicking outside.

### Comments/Reports
- **Rule**: Comments are for discussion; reports are for structured outcomes.
- **Procedure**:
  1. Comments:
     - Added via input box at bottom of comments section.
     - Supports basic markdown (bold, italic, code).
     - Each comment shows author name/agent and timestamp.
     - Edit/delete own comments only (with confirmation for delete).
  2. Reports:
     - Generated automatically upon task completion (see Completion Reports).
     - Manual report generation via "Generate Report" action in drawer.
     - Report types: Completion Report, Stale Worker Report, Blocker Report.
     - Reports are immutable once generated; can be copied or referenced.

### State Transitions (blocked/running/review/done)
- **Rule**: State changes flow through verified Kanban API/adapter only.
- **Procedure**:
  1. Blocked → Running: When a blocker is resolved, owner or lead can transition via "Start Working" action (requires confirmation if task has assignee).
  2. Running → Review: Owner transitions when work is complete and ready for review via "Submit for Review" action.
  3. Review → Done: Reviewer transitions after approval via "Approve & Done" action.
  4. Review → Running: Reviewer sends back for revisions via "Request Changes" action.
  5. Any state → Blocked: Owner or lead can add blocker via "Add Blocker" action (requires blocker description).
  6. Blocked → Any: Requires blocker resolution confirmation.
  7. All transitions require explicit user action; no automatic state changes except via verified webhook events from Hermes Kanban plugin.
  8. State change confirmation: For transitions that affect assignee or deadlines, show confirmation dialog with impact summary.

### Actions (dispatch/decompose/reclaim/terminate)
- **Rule**: All mutation actions require explicit confirmation and route through `/api/plugins/kanban` or verified Cloud adapter.
- **Procedure**:
  1. Dispatch: Break a parent task into sub-tasks. Opens dispatch configuration modal.
  2. Decompose: Break a task into smaller pieces or redefine scope. Opens decompose editor.
  3. Reclaim Owner: Take ownership of a stuck or unassigned task.
  4. Terminate Worker: Stop a worker process attached to a task (requires running state).
  5. Move to Done: Mark task as completed only after a result/handoff or explicit completion reason is recorded.
  6. Reopen: Reopen a done task for further work.
  7. Archive/Delete: Remove task from active board (archive preserves history; delete removes permanently).
  8. Each action shows a confirmation dialog with specific language (see Section 3).

### Completion Reports
- **Rule**: Upon task completion (state → done), a completion report will be auto-generated.
- **Procedure**:
  1. Will be triggered when task state transitions to done via any valid path.
  2. Report will include:
     - Task ID and Title
     - Completion timestamp
     - Owner(s) who worked on it
     - Time spent (if tracked)
     - Summary of work done (from comments or owner input)
     - Outcome/result (e.g., feature delivered, bug fixed)
     - Links to relevant artifacts (code commits, documents)
     - Lessons learned or follow-up items
  3. Report will be added to the Reports section of the task drawer.
  4. Notification: Post completion report to the designated Discord channel for kanban updates (optional config).
  5. Template: See Section 4 for agent completion report format.

### Stale-worker Handling
- **Rule**: Detect and handle tasks with no worker activity for extended period.
- **Procedure**:
  1. Stale threshold: Configurable (default 2 hours) via admin settings.
  2. System checks for tasks in running state with no worker heartbeat or log update beyond threshold.
  3. Stale tasks are highlighted in ownership overview with ⏳ icon and tooltip "Stale worker detected".
  4. Actions available for stale tasks:
     - Reclaim Owner: Allow another agent to take over.
     - Terminate Worker: Force-stop the worker process.
     - Add Blocker: Mark as blocked with reason "Stale worker - possible issue".
     - Escalate to Sora: Automatic escalation after 2 stale cycles (see Sora Escalation).
   5. Stale worker report: Will be generated when stale task is acted upon, includes:
     - Task ID and Title
     - Stale duration
     - Last worker activity
     - Action taken (reclaim/terminate/etc.)
     - Owner who took action

### Sora Escalation
- **Rule**: Escalate persistent blockers or stalled tasks to Sora for intervention.
- **Procedure**:
  1. Automatic escalation triggers:
     - Task remains blocked for >4 hours without owner action.
     - Task marked stale-worker twice in succession.
     - Manual escalation via "Escalate to Sora" action in task drawer.
  2. Escalation action:
     - Creates a post in Sora's inbox via the Hermes inbox webhook.
     - Includes: Task ID, Title, Current State, Blocker/Stale details, Timeline, Suggested Actions.
     - Format matches Sora inbox workflow (see Section 4).
  3. Sora responds via same channel; resolution updates are added to task comments.
  4. Escalation history is visible in task drawer under "Escalations" subsection.

## 2. User-Facing Labels & States

### Labels
- **Environment**: [DEV] [STAGING] [PROD] prefixed to all admin tool outputs.
- **Mock Data**: Label any mock/mocked output with `(MOCK)`.
- **Unavailable Service**: Label as `(UNAVAILABLE)` with suggested workaround.
- **Experimental Feature**: Tag as `[EXPERIMENTAL]` with link to documentation.
- **Kanban-specific**:
  - `Source`: Shows data source (e.g., `Hermes Kanban Plugin`, `Mock Adapter`).
  - `Freshness`: `live` (<30s), `recent` (<5m), `stale` (>5m), `unknown`.
  - `Confidence`: `verified`, `unknown`, `mock`.

### Empty States
- **Ownership Overview**: "No tasks match current filters. Adjust filters or create a new task."
- **Task Drawer (when no task selected)**: "Select a task from the overview to view details."
- **Comments Section**: "No comments yet. Add a comment to start discussion."
- **Reports Section**: "No reports generated for this task."
- **Diagnostics Panel**: "No diagnostics available for this task."

### Warning/Error Copy
- **Warning (Non-blocking)**: "⚠️ Warning: [description]. Action may have unintended side effects. Proceed?"
- **Error (Blocking)**: "❌ Error: [description]. [Suggested fix or escalation path]."
- **Stale Worker**: "⏳ Stale worker detected: No activity for [duration]. Consider reclaiming or terminating."
- **Blocked Task**: "🚫 Task blocked: [blocker reason]. Resolve blocker to proceed."
- **Confirmation Required**: "This action requires confirmation. Please read carefully and confirm."

## 3. Confirmation Language for Risky Kanban Actions

### High-Risk Actions (Require Explicit Typed Confirmation)
- **Dispatch**: 
  "This will dispatch task '<task-id>' into sub-tasks. Scope: <scope>, Target tasks/count: <target-tasks>, Assignee: <assignee>, Model/skills/goal mode: <if present>, Cost/quota/rate-limit: <state or unknown>, Idempotency/dedup note: <note>, Rollback/stop path: <path>. Type 'CONFIRM DISPATCH' to proceed."
- **Decompose**: 
  "This will decompose task '<task-id>' into child tasks. Parent id/title: <parent-id-title>, Expected child-task creation: <expected-children>, LLM/API cost warning: <cost-warning>, Quota/rate-limit: <quota-state>, Children may auto-dispatch: <auto-dispatch-flag>. Type 'CONFIRM DECOMPOSE' to proceed."
- **Reassign Owner**:
  "This will change the owner of task '<task-id>' from '<current-owner>' to '<new-owner>'. Type 'CONFIRM REASSIGN <new-owner>' to proceed."
- **Reclaim Stuck Task**:
  "This will reclaim ownership of task '<task-id>' from '<current-owner>' to you. Type 'CONFIRM RECLAIM' to proceed."
- **Terminate Worker/Process**:
  "This will terminate the worker process attached to task '<task-id>'. This may interrupt ongoing work. Type 'CONFIRM TERMINATE' to proceed."
- **Move to Done**:
  "This will mark task '<task-id>' as done after recording a result, handoff, or explicit completion reason. Active/stale/unknown worker state: <worker-state>. Type 'CONFIRM MOVE TO DONE' to proceed."
- **Reopen**:
  "This will reopen task '<task-id>' from done state to todo for further work. Type 'CONFIRM REOPEN' to proceed."
- **Archive/Delete**:
  - Archive: "This will archive task '<task-id>' and remove it from active board. Type 'CONFIRM ARCHIVE' to proceed."
  - Delete: "This will permanently delete task '<task-id>' and all associated data. Type 'CONFIRM DELETE' to proceed."

### Medium-Risk Actions (Require Yes/No Confirmation)
- **Add Blocker**: "Adding a blocker may affect task priority and SLA. Continue? [y/N]"
- **Request Changes (Review)**: "Sending this task back for revisions will reset progress. Continue? [y/N]"

### Low-Risk Actions (No Confirmation)
- **Add Comment**: Safe to add discussion comments.
- **Generate Report**: Safe to generate completion or stale worker report.
- **Refresh Overview**: Safe to manually refresh task list.

## 4. Agent Completion/Report Template

### Department Lead Report (to Sora Inbox)
```
[PHASE 7 KANBAN ESCALATION] - <DATE> <TIME> ET
Lead: Lelouch
Task: <task-id> - <task-title>
Current State: <blocked/running/review/done>
Blocker/Stale Details: <description>
Timeline:
- <timestamp>: <event>
- <timestamp>: <event>
Suggested Actions:
- <action 1>
- <action 2>
Escalation ID: <uuid>
```

### Subagent Report (to Department Lead)
```
[PHASE 7 KANBAN ACTION] - <DATE> <TIME> ET
Agent: <subagent-name>
Task: <task-id> - <task-title>
Action Taken: <dispatch/decompose/reclaim/terminate/etc.>
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

### Completion Report (Auto-generated)
```
[PHASE 7 KANBAN COMPLETION] - <DATE> <TIME> ET
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

## 5. Ambiguities Causing Accidental Destructive Actions

1. **Task ID Reuse**:
   - Ambiguity: After deleting a task, creating a new task with the same ID may confuse reports and logs.
   - Mitigation: Always verify task list before create; use UUIDs for task IDs when possible.

2. **Dispatch vs. Decompose Confusion**:
   - Ambiguity: Users may mistake dispatch (create sub-tasks) for decompose (redefine scope) leading to unintended task splits.
   - Mitigation: Clear labeling in action buttons and confirmation modals; show preview of changes before confirmation.

3. **Reclaim Owner Race Condition**:
   - Ambiguity: Two agents attempting to reclaim the same stuck task simultaneously.
   - Mitigation: Reclaim action checks current owner at moment of execution; fails if ownership changed during action with retry prompt.

4. **Terminate Worker Impact**:
   - Ambiguity: Terminating a worker may interrupt unrelated processes if worker ID is misassigned.
   - Mitigation: Terminate action shows worker PID and associated task details; requires explicit typed confirmation.

5. **Move to Done Abuse**:
   - Ambiguity: Using move to done to bypass review process, leading to quality issues.
   - Mitigation: Action labeled as "Move to Done (Skip Review)" with warning in confirmation; admin can disable via feature flag.

6. **Archive/Delete Ambiguity**:
   - Ambiguity: Users may confuse archive (preserves history) with delete (permanent removal).
   - Mitigation: Separate action buttons with distinct icons and colors; confirmation dialogs clearly state outcome.

7. **Stale Worker Auto-escalation Loop**:
   - Ambiguity: Misconfigured stale thresholds causing repetitive Sora escalations.
   - Mitigation: Escalation cooldown period (default 1 hour) after each escalation; max 3 escalations per task per day.

8. **Comment Edit/Delete**:
   - Ambiguity: Editing or deleting comments after others have replied can break conversation flow.
   - Mitigation: Show comment thread context before edit/delete; delete requires confirmation and shows impact.

-- 
*Copy last updated: 2026-06-21 by Lelouch for Sora-MissionControl Phase 7*