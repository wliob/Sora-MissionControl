# Sora-MissionControl Research Adaptation Product Spec

**Created:** 2026-06-29T10:44:00-04:00  
**Stage:** research-to-spec; no implementation authorized yet  
**Source research:** `/home/wliob/hermes-docs/research/mission-control-dashboard/RhLpV6QDBFE/`  
**Active repo:** `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/`  
**Review inputs:** user interview + Korra design review + Biscuit architecture feasibility + Lelouch workflow review

## 1. Product Thesis

Sora-MissionControl v1 should be a **premium dark AI guild command room**: a serious operational dashboard first, with a truthful living-office layer second.

The product should answer one daily decision fast:

> **Where should my attention go next?**

The user should feel like they are entering a disciplined command center disguised as a restrained guild HQ, not a generic AI SaaS dashboard and not a toy office sim.

## 2. Locked User Decisions

| Area | Decision |
|---|---|
| Default landing | **Team** |
| Office vibe | **Modern premium startup office × anime/JRPG guild HQ** |
| Agent style | **Portrait + tiny office sprite**, anime-guild flavor with premium restraint |
| Sora visual role | **Conductor/guild-master station**, visually central, not cartoonish |
| Team screen priority | **Org chart + workload/blockers + delegation lines**, light personality |
| Desk indicators | **Monitor glow + work animation + blocker icon + active project badge** |
| Office live truth | **Truth + ambient idle; never fake active work** |
| V1 screens after Team + Office | **Tasks/Kanban, Activity, Projects, Chat, Calendar** |
| Daily decision | **Where should my attention go next?** |
| Hard lines | **No fake activity, no generic AI dashboard look, not too corporate, not too cluttered** |

## 3. Information Architecture

### Primary hierarchy

1. **Team** — default home / command surface.
2. **Office** — ambient spatial truth layer.
3. **Tasks/Kanban** — execution control and work queue.
4. **Activity** — evidence/provenance trail.
5. **Projects** — portfolio/outcome layer.
6. **Chat** — decision/escalation layer.
7. **Calendar** — time-constraint and scheduled-work layer.

### Team is not a profile gallery

Team must not become static “Meet the Team.” It must be the home command surface that answers:

- Who is active?
- Who is blocked?
- Who is overloaded?
- What is waiting on the user?
- What is delegated to whom?
- What needs attention next?
- Which signals are verified vs stale/unknown?

### Office is not source of truth

Office should reinforce state through space, motion, desk status, and presence. The source of truth remains task/project/activity/calendar/chat data.

## 4. Daily Attention Model

The top Team surface should rank attention targets by explicit signals, not opaque AI vibes.

**Display decision:** Team landing shows a **ranked top three** attention list, not a single winner. The top item can be visually primary, but #2 and #3 must stay visible so the user can compare urgency and avoid tunnel vision.

**Active project badge decision:** A desk project badge means the project is **currently assigned to that department lead**. It does not mean merely last touched, currently executing, or user-pinned unless that project is also the lead's current assignment.

**Workload metric decision:** Use a **hybrid weighted workload score with sub-agent load included**. The Team screen should show a simple workload label/bar, but the underlying metric should weight responsibility by state and include work delegated under each department lead. Blockers remain a separate visible count so workload does not hide risk.

Recommended v1 weighting:

| Work item state | Weight |
|---|---:|
| running / active | 3 |
| review / verification needed | 2 |
| blocked / waiting-on-user | 2 |
| stale / waiting | 1.5 |
| ready / queued / todo | 1 |
| scheduled soon | 1 |
| done / cancelled | 0 |

Sub-agent work counts toward the parent department lead at reduced weight, default **0.5×**, unless the lead is directly blocked by or responsible for resolving it.

**Attention ranking event decision:** The ranked top three may change only on **real operational state-change events** with provenance. Cosmetic activity, raw chat volume, ambient animation, page views, and unverified signals must not affect ranking.

**Calendar decision:** Calendar is **both** a ranking input and a warning system. It should affect attention ranking only when a time constraint changes priority, but it should continuously warn about upcoming deadlines, meetings, scheduled jobs, stale recurring work, missed runs, and time-sensitive blockers.

**Activity default decision:** Activity should be **chronological by default**. Grouping by operational state change can exist as a filter/focus mode, but the default view should preserve time order so the user can audit what happened and when.

**Lead personality decision:** Team cards may show **one concise role phrase** for personality/identity; richer lead profiles live only on detail pages. The default Team screen must prioritize operational state over bios, jokes, lore, mottos, or decorative chatter.

**Office presentation decision:** Office should be a **separate immersive screen only**, not a persistent side preview on Team. Viewing Office is intentional and focused. Office should also support a **pop-out mechanic** that opens the Office view in its own window for dedicated monitoring.

**Sora identity decision:** Sora should have a **portrait in addition to the conductor/guild-master station identity**. The station remains the primary visual metaphor for orchestration; the portrait gives Sora a human-readable identity for cards, detail views, chat/context, and focused Office moments.

Allowed ranking-change events:

- blocker created, escalated, aged past threshold, reassigned, or resolved
- waiting-on-user / pending-decision created or resolved
- verification/review requested, passed, failed, or expired/stale
- task status changes across active, blocked, review, waiting, stale, done, cancelled
- task/project priority, owner, department lead assignment, or dependency changes
- calendar deadline/meeting/job enters or exits a configured urgency window
- scheduled job or automation succeeds, fails, becomes stale, or recovers
- source health/freshness changes: live, stale, degraded, unavailable, recovered
- new inbound item explicitly classified as urgent or decision-affecting
- project risk/drift signal crosses threshold

Non-events for ranking:

- raw message count or chat noise
- cosmetic animation / sprite motion
- monitor glow / ambient idle
- page views, hover/clicks, or UI focus
- generic “AI insight” text without linked source state
- demo/mock data unless explicitly in demo mode and labeled non-authoritative

Recommended ranking order:

1. Waiting on user / pending user decision.
2. Blockers that stop agents/projects.
3. Failed, stale, or degraded automation.
4. Review/verification needed.
5. Overloaded or stalled lead.
6. Scheduled item due soon.
7. High-priority active project with drift/dependency pressure.
8. New urgent inbound that changes priority.

Suggested formula:

```text
attention_score = blocker_severity
                + decision_urgency
                + deadline_pressure
                + dependency_impact
                + ownership_gap
                + project_importance
                - stale_or_low_confidence_penalty
                - noise_penalty
```

Do **not** rank by raw message volume, cosmetic motion, generic health scores, or busy-looking activity.

## 5. Screen Contracts

### Team — default landing

Role: command surface and attention router.

Required components:

- Sora central conductor/guild-master station.
- Department lead portrait nodes/cards.
- Sparse delegation lines: active handoff, dependency, escalation, blocked relation, or selected context only.
- Attention rail: waiting on user, blockers, stale work, verification failures, risky actions.
- Weighted workload distribution, separate blocker counts, and active project badges.
- Freshness/source labels.

Team card minimum:

- Portrait or identity mark.
- Role/domain.
- One concise role phrase.
- Current status.
- Weighted workload score/label.
- Blocker count.
- Active project badge if verified.
- Last verified activity timestamp or stale/unknown.
- One clear action: inspect, open task, chat, or focus in office.

Acceptance: Team answers **“Where should my attention go next?” within 5 seconds**.

### Office

Role: intentional immersive spatial overview and product identity layer.

Presentation rules:

- Office is a separate immersive screen, not a persistent side preview on Team.
- Opening Office is an intentional mode switch for focused viewing.
- Team may deep-link/focus an agent or project in Office, but should not embed Office as ambient side chrome.
- Office should support pop-out/open-in-own-window behavior for dedicated monitoring.
- Pop-out Office remains read/observe-first unless a future spec explicitly permits commands there.

Visual stance:

- Modern premium startup office with restrained guild HQ cues.
- Sora central command/conductor station.
- Sora portrait available as secondary identity layer; station remains primary in Office.
- Agents have desks/zones.
- Tiny office sprites share identity cues with portraits.

Allowed cues:

- Insignia.
- Conductor station.
- Warm office light pools.
- Role titles.
- Subtle banners.
- Desk/project artifacts.

Forbidden cues:

- Fantasy tavern.
- Ornate RPG frames.
- Cartoon mascots.
- XP bars.
- Emoji chatter.
- Chibi chaos.

Desk indicators:

- Monitor glow: verified active task/session/project or neutral idle ambiance only.
- Work animation: verified active work, transition, or harmless idle only.
- Blocker icon: real blocker/stale/error state only.
- Project badge: project currently assigned to that department lead, with verified assignment source.
- Unknown state: quiet idle/unknown label, never busy animation.

### Tasks/Kanban

Role: execution control.

Required states:

- running/active
- blocked
- review/verification
- waiting-on-user
- stale/waiting
- done

Task card should show owner, project, current gate, freshness, next action, and source confidence.

### Activity

Role: evidence trail, not social feed.

Default ordering: **chronological**, newest-first unless the user chooses historical replay. Operational-state grouping can be offered as a secondary filter/focus mode, not the default.

Required event fields:

- timestamp
- source/provenance
- agent/project/task relation
- severity/state-change type
- link to related agent/task/project

Activity must explain why Team/Office says something is blocked, active, stale, or waiting.

### Projects

Role: portfolio and dependency view.

Project card should show:

- owner lead
- status
- active tasks
- blockers
- last artifact/update
- next action
- dependency pressure if known

No fake progress percentages unless backed by real milestones.

### Chat

Role: command/escalation layer, not generic inbox.

Rules:

- Entry from Team/Office carries context: selected lead, task, blocker, or project.
- Unavailable/demo/fallback state clearly labeled.
- Visual style should be command-console-like, not consumer messenger.

### Calendar

Role: time constraints and scheduled work.

Calendar should feed attention ranking when deadlines/jobs affect priority. It should show next run, owner, last result, stale/failure state, and time pressure.

Calendar is both:

- **Ranking input** when a meeting, deadline, scheduled job, or stale recurring item changes what needs attention next.
- **Warning system** for time pressure even when it does not yet outrank current top items.

Calendar can stay in primary nav for v1 because user picked it as v1 core, but it should not dominate unless scheduled work materially affects attention ranking.

## 6. Truth Vocabulary

Use the same labels across Team, Office, Tasks, Activity, Projects, Chat, and Calendar:

| Label | Meaning |
|---|---|
| verified | confirmed by live source or successful command/API response |
| live | currently receiving fresh data/events |
| stale | source exists but timestamp is old or reconnect gap exists |
| degraded | partial source failure; some data valid, some missing |
| unknown | system cannot determine state yet |
| unavailable | source/route unsupported or offline |
| mock/demo | explicitly non-authoritative placeholder/demo data |

Rules:

- No green/healthy state without evidence.
- Failed fetch must not render as empty healthy state.
- Mock/demo must be visually distinct from live.
- Silence is allowed; simulated busyness is not.

## 7. Visual System Direction

### Style

- Premium custom dark mission-control base.
- Near-black/navy depth.
- Precise typography.
- Low-glow status accents.
- Restrained borders.
- Tabular data for numeric/status surfaces.
- Warm pools of light for office/guild ambience.

### Color grammar

- Cyan/green: live/verified movement.
- Amber: stale/warning/uncertain.
- Red: blocked/failed/danger.
- Violet: command/review/delegation.
- Grey: unknown/unavailable/disabled.

Avoid:

- generic purple-blue AI gradient blobs.
- robot/brain icons.
- stock SaaS card grid.
- decorative charts with no decision value.
- rainbow agent identities.
- glowing everything.

Accessibility requirements:

- AA contrast.
- visible focus states.
- status not color-only.
- reduced-motion mode.
- pause/reduce behavior for live areas.
- safe truncation/wrapping for task names, paths, model IDs, and errors.

## 8. Architecture Feasibility Summary

Biscuit found feasibility is strong for the existing data/event/office backbone, but incomplete for the full new spec.

Reusable assets likely present:

- `src/types/board.ts` — board/task/event contracts.
- `src/adapters/boardAdapter.ts` — runtime normalization/validation.
- `src/state/boardStore.ts` — board/events/profiles/workers snapshot store.
- `src/services/hermes/dashboardClient.ts` — Kanban REST/WS wrappers with cursor handling.
- `src/components/shell/ShellLayout.tsx` — shell route switch/event wiring.
- `src/office/adapter.ts`, `src/office/store.ts`, `src/office/engine/AgentStateMachine.ts` — board-to-office bridge and agent FSM.
- `src/components/chat/ChatPanel.tsx` — command-console chat surface with board-linked context.

Known gaps:

- Route reality mismatch: current shell centers on `/kanban`; Activity/Projects/Calendar may still be placeholders.
- No dedicated global “attention next” recommendation pipeline identified.
- Office adapter may collapse richer task statuses too early for attention routing.
- Demo/mock mode must be verified not to leak into non-demo runtime.
- End-to-end cursor replay/reconnect behavior needs command-level tests.

## 9. Implementation Sequence Proposal

No implementation should begin until user approves this spec.

### Phase 0 — contract freeze

Goal: freeze product/data contracts before UI rebuild.

Deliverables:

- Attention ranking contract.
- Truth vocabulary constants.
- Active project badge definition.
- Workload metric definition.
- Screen route list and source-of-truth map.

### Phase 1 — Team command surface

Goal: make Team the default decision surface.

Deliverables:

- Default route points to Team.
- Sora conductor station layout.
- Lead cards with workload/blockers/delegation/freshness.
- Attention rail with ranked top items.
- Sparse delegation-line focus behavior.

### Phase 2 — attention engine

Goal: implement explicit “Where should my attention go next?” logic.

Deliverables:

- Deterministic ranking function.
- Unit tests for blocker/decision/deadline/stale priority ordering.
- Provenance/freshness shown with each recommendation.
- No opaque AI-only ranking in v1.

### Phase 3 — Office truth adaptation

Goal: upgrade Office to premium guild-command ambience without fake work.

Deliverables:

- Agent desk/sprite identity mapping.
- Verified-only monitor glow, blocker icon, project badge.
- Ambient idle animations that never imply active work.
- Demo/mock separation verified.

### Phase 4 — V1 route completion

Goal: complete selected v1 screens.

Deliverables:

- Tasks/Kanban deep links from Team attention items.
- Activity as evidence trail.
- Projects as portfolio layer.
- Chat as contextual escalation/command layer.
- Calendar as schedule/constraint layer.

### Phase 5 — verification and polish

Goal: prove truthful runtime and visual quality.

Deliverables:

- Build/tests pass.
- WS reconnect/cursor replay proof.
- Anti-fake-live proof.
- Playwright visual proof for Team + Office + core routes.
- Korra visual acceptance.
- Sora final acceptance report.

## 10. Verification Gates

Before implementation sign-off:

- **Route/scaffold gate:** `/team`, `/office`, `/kanban`, `/activity`, `/projects`, `/chat`, `/calendar` exist or route aliases are explicitly documented.
- **Event gate:** `latestEventId` monotonic behavior, gap handling, disconnect/reconnect replay verified.
- **Anti-fake-live gate:** no synthetic movement/events in non-demo mode across Office + Kanban surfaces.
- **Recommendation gate:** attention-priority computation defined and tested.
- **Regression gate:** board normalization, WS merge, shell route fallback tests pass.
- **Visual gate:** no generic AI-dashboard look, no corporate org-chart feel, no cluttered delegation spaghetti.
- **Accessibility gate:** contrast, focus, color-independent status, reduced motion.

Project-level commands from repo docs before final acceptance:

```bash
npm run lint
npm test -- --run
npm run build
```

Runtime smoke depends on final host/port; current docs mention `http://192.168.0.85:3187` and `/health`, but deployment target must be verified before running deployment work.

## 11. Guild Cues for Visual QA (Finalized)

### Approved (5)

| Cue | Rationale |
|---|---|
| **Insignia** | Subtle guild/heraldic mark reinforces identity without screaming "fantasy." Works as a watermark, favicon, or small nav emblem. |
| **Conductor station** | Sora's central command position is the visual anchor — a raised/central desk, conductor podium, or guild-master table. Defines the spatial hierarchy. |
| **Warm office light pools** | Desk lamps, monitor glows, ambient warm highlights against the dark theme. Creates depth and a premium "late-night ops room" feel. |
| **Role titles** | Brief, restrained titles under each agent's portrait (e.g., "Infrastructure," "Finance"). Replaces label tags; signals guild rank without ornament. |
| **Subtle banners** | Narrow accent bars — color-coded per department — used for section headers, card tops, or active-agent indicators. Not full-width; not ornate. |

### Forbidden (5)

| Cue | Why |
|---|---|
| **Fantasy tavern** | Too on-the-nose. Wooden tables, candlelight, potion bottles, rustic interiors — undermines the serious ops dashboard first. |
| **Ornate RPG frames** | Gold borders, filigree, elaborate character sheet frames. Suffocates the clean dark UI with decoration. |
| **Cartoon mascots / chibi chaos** | Oversized chibi sprites, expressive emoji heads, googly eyes. Breaks the premium restraint contract. |
| **XP bars / leveling** | Progress bars for agent "levels," numerical stats, skill points. Gives the wrong signal — this is an ops dashboard, not a game. |
| **Emoji chatter / decorative chatter** | Floating emoji reactions, speech bubbles with "lol" / "brb," decorative chat noise in the main view. Destroys the command-room tone. |

### Hard line

If a visual element could be described as "cute," "cartoony," or "RPG character sheet," it's off the table. If it could be described as "premium," "restrained," or "command center with soul," it's on it.

## 12. Sora Recommendation

Proceed, but do **not** start coding yet.

Recent decision: Team landing should show a **ranked top three** attention list.

Recent decision: Desk project badges mean projects currently assigned to the department lead.

Recent decision: Workload metric is a hybrid weighted score with sub-agent load included.

Recent decision: Attention ranking changes only on real operational state-change events with provenance; cosmetic/activity noise does not affect ranking.

Recent decision: Calendar is both a ranking input and a warning system; it ranks only when time changes priority, while continuously warning about scheduled risk.

Recent decision: Activity is chronological by default; operational-state grouping is optional secondary filter/focus mode.

Recent decision: Each department lead gets one concise role phrase on Team; richer profile/personality details live only on detail pages.

Recent decision: Office is a separate immersive screen only, with an open-in-own-window pop-out mechanic for dedicated viewing.

Recent decision: Sora needs a portrait in addition to the conductor/guild-master station identity; the station remains primary in Office.

Recent decision: Guild cues finalized — 5 approved (insignia, conductor station, warm office light pools, role titles, subtle banners) and 5 forbidden (fantasy tavern, ornate RPG frames, cartoon mascots/chibi chaos, XP bars/leveling, emoji chatter/decorative chatter).

Next best step: invite user to decide whether to route a narrow implementation plan to Korra + Biscuit: Korra freezes the visual contract, Biscuit maps required changes to files/tests. Sora verifies and synthesizes; Sora does not code.
