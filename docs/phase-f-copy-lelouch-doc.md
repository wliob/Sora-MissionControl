# Sora-MissionControl — Phase F: Screen Copy & UI Text Contract

**Author:** Lelouch (Strategy & Analysis Lead)  
**Phase:** Phase F — Activity, Projects, Chat, Calendar Copy  
**Date:** 2026-06-29  
**Status:** Copy contract — for Biscuit implementation  
**Context:** User-facing text, workflow labels, and UI copy for the four remaining V1 core screens. All copy follows the Sora-MissionControl style guide: professional ops tone, CLI-inspired concision, truth vocabulary, no emoji/fantasy/RPG language.  
**Style Authority:** `docs/STYLE_GUIDE.md` Phase A/B tone rules; `docs/canonical-model-invariants.md` provenance vocabulary.

---

## 0. Style Guardrails

| Rule | Applies |
|------|---------|
| Tone | Professional ops — command center / trading terminal density |
| Voice | Direct, concise, CLI-inspired. Short labels. Monospace where possible |
| Truth vocabulary | `verified`, `live`, `stale`, `degraded`, `unknown`, `unavailable`, `mock`/`demo` |
| Severity tags | `[CRITICAL]` `[WARNING]` `[INFO]` — fixed-width monospace, 10ch |
| Timestamps | `HH:MM:SS` format; optional `.mmm` precision for event streams |
| Status dots | ● (live/active), ◐ (degraded/stale), ○ (offline/unknown), ⬤ (verified) |
| Forbidden | Emoji chatter, casual text, fantasy/RPG terms, XP/leveling language, marketing fluff |

---

## 1. Activity Screen

### 1.1 Purpose Statement

> Operational event log — chronological trace of state changes across the mission-control system. Answers: *"What happened, when, and from which source?"*

### 1.2 Screen Header Copy

| Component | Label Text |
|-----------|------------|
| Page title (MissionBar) | `ACTIVITY` |
| Subtitle / description | `operational event log — chronological trace of state changes` |
| Connection status pill | `● LIVE` / `◐ DEGRADED` / `○ OFFLINE` |
| Freshness label | `freshness: live` / `freshness: stale` / `freshness: unknown` |

### 1.3 Column Headers

| Column | Header Text | Width | Alignment |
|--------|-------------|-------|-----------|
| Timestamp | `TIMESTAMP` | 10ch monospace | Left |
| Source | `SOURCE` | 10ch monospace | Left |
| Event | `EVENT` | Fluid (min 30ch) | Left |
| Freshness | `FRESHNESS` | 10ch monospace | Right |

### 1.4 Event Type Labels

Each event type maps to a concise, CLI-style label rendered in the `EVENT` column.

| Event Type | Label | Severity / Tone |
|------------|-------|-----------------|
| `task.status_change` | `task.status_change` | neutral |
| `blocker.created` | `blocker.created` | `[WARNING]` prefix |
| `blocker.resolved` | `blocker.resolved` | `[INFO]` prefix |
| `delegation.dispatched` | `delegation.dispatched` | neutral |
| `delegation.returned` | `delegation.returned` | neutral |
| `automation.failed` | `automation.failed` | `[CRITICAL]` prefix |
| `automation.recovered` | `automation.recovered` | `[INFO]` prefix |
| `verification.requested` | `verification.requested` | neutral |
| `verification.passed` | `verification.passed` | neutral |
| `verification.failed` | `verification.failed` | `[WARNING]` prefix |
| `calendar.urgency_entered` | `calendar.urgency_entered` | `[WARNING]` prefix |
| `calendar.urgency_exited` | `calendar.urgency_exited` | `[INFO]` prefix |
| `source.degraded` | `source.degraded` | `[WARNING]` prefix |
| `source.recovered` | `source.recovered` | `[INFO]` prefix |

### 1.5 Filter / Toggle Labels

| Component | Label Text |
|-----------|------------|
| Default sort toggle (active) | `Chronological` |
| Alternate sort toggle | `Group by state` |
| Filter clear label | `clear filters` |
| Severity filter dropdown label | `severity:` |
| Source filter dropdown label | `source:` |

### 1.6 Empty / Unavailable States

| State | Copy |
|-------|------|
| No events recorded (empty) | `no activity events recorded` |
| Activity data unavailable | `activity data unavailable` |
| Source degraded | `source degraded — partial event stream` |
| Source offline | `source offline — no events received` |

### 1.7 Row-Level Copy (Per Event Entry)

| Element | Format / Example |
|---------|------------------|
| Timestamp | `14:32:17.842` (monospace, dim) |
| Source label | `kanban.ws` / `profile.cli` / `calendar` / `automation` |
| Event text | `[WARNING] blocker.created · TIFA · "api key rotation pending"` |
| Freshness badge | `● live` / `◐ stale 12m` / `○ unknown` |

### 1.8 Action Labels

| Component | Label |
|-----------|-------|
| Inspect event detail | `inspect` |
| Copy event ID | `copy id` |
| Export log (CSV) | `export` |

---

## 2. Projects Screen

### 2.1 Purpose Statement

> Project inventory and status board — tracks all active, paused, and completed projects under mission control. Answers: *"What projects exist, who leads them, and what is their operational health?"*

### 2.2 Screen Header Copy

| Component | Label Text |
|-----------|------------|
| Page title (MissionBar) | `PROJECTS` |
| Subtitle / description | `project inventory — active, paused, and completed work streams` |
| Connection status pill | `● LIVE` / `◐ DEGRADED` / `○ OFFLINE` |
| Freshness label | `freshness: live` / `freshness: stale` / `freshness: unknown` |

### 2.3 Column Headers

| Column | Header Text | Width | Alignment |
|--------|-------------|-------|-----------|
| Project name | `PROJECT` | Fluid (min 18ch) | Left |
| Status | `STATUS` | 10ch monospace | Center |
| Lead | `LEAD` | 10ch monospace | Left |
| Task count | `TASKS` | 6ch monospace | Right |
| Blocker count | `BLOCKERS` | 8ch monospace | Right |
| Last activity | `ACTIVITY` | 12ch monospace | Right |
| Data freshness | `FRESHNESS` | 10ch monospace | Right |

### 2.4 Status Labels

| Status Value | Display Label |
|--------------|---------------|
| Active | `ACTIVE` |
| Paused | `PAUSED` |
| Completed | `COMPLETED` |

### 2.5 Row-Level Copy (Per Project Entry)

| Element | Format / Example |
|---------|------------------|
| Project name | `mission-control-v2` (monospace, accent color) |
| Status badge | `● ACTIVE` / `◐ PAUSED` / `○ COMPLETED` |
| Lead name | `CLOUD` / `BISCUIT` / `KORRA` / `LELOUCH` / `TIFA` |
| Task count | `18` (if 0, render as `—`) |
| Blocker count | `2` (if >0, red pip prefix `[!] 2`; if 0, render as `—`) |
| Last activity | `14:32:17` (timestamp of most recent event) |
| Freshness badge | `● live` / `◐ stale 8m` / `○ unknown` |

### 2.6 Empty / Unavailable States

| State | Copy |
|-------|------|
| No projects tracked | `no projects tracked` |
| Project data unavailable | `project data unavailable` |
| Source degraded | `source degraded — project list may be incomplete` |
| Source offline | `source offline — project data not available` |

### 2.7 Action Labels

| Component | Label |
|-----------|-------|
| Drill into project detail | `inspect` |
| Sort by column | (column header click, no label) |
| Filter by status | `status:` |

---

## 3. Chat Screen (Decision & Escalation Log)

### 3.1 Purpose Statement

> Decision and escalation log — action items extracted from conversations. This is **NOT a chat room.** It is a structured record of decisions made, escalations raised, and actions committed during operational discussions. Answers: *"What was decided, who was involved, and what actions followed?"*

### 3.2 Screen Header Copy

| Component | Label Text |
|-----------|------------|
| Page title (MissionBar) | `DECISIONS` |
| Subtitle / description | `decision & escalation log — action items from conversations` |
| Clarifier (rendered beneath subtitle as small dim text) | `This is not a chat room. Records are structured decisions extracted from operational conversations.` |
| Connection status pill | `● LIVE` / `◐ DEGRADED` / `○ OFFLINE` |
| Freshness label | `freshness: live` / `freshness: stale` / `freshness: unknown` |

### 3.3 Column Headers

| Column | Header Text | Width | Alignment |
|--------|-------------|-------|-----------|
| Timestamp | `TIMESTAMP` | 12ch monospace | Left |
| Participants | `PARTICIPANTS` | 16ch monospace | Left |
| Topic | `TOPIC` | Fluid (min 20ch) | Left |
| Decision | `DECISION` | Fluid (min 20ch) | Left |
| Actions | `ACTIONS` | 6ch monospace | Right |

### 3.4 Decision Status Labels

| Status Value | Display Label | Style |
|--------------|---------------|-------|
| Resolved | `RESOLVED` | green phosphor `#00ff41` |
| Pending | `PENDING` | amber CRT `#ffb000` |
| Escalated | `ESCALATED` | red LED `#ff4444` |
| No decision recorded | `NO DECISION` | dim grey |

### 3.5 Row-Level Copy (Per Decision Entry)

| Element | Format / Example |
|---------|------------------|
| Timestamp | `14:32:17` (monospace, dim) |
| Participants | `CLOUD, TIFA` (truncate >2 with `+N`) |
| Topic | `"api key rotation schedule for Q3"` (truncate >48ch) |
| Decision | `RESOLVED: rotate keys on 07-15` / `ESCALATED: pending Sora review` / `NO DECISION` |
| Actions count | `3` (if 0, `—`) |

### 3.6 Empty / Unavailable States

| State | Copy |
|-------|------|
| No decision records | `no decision records` |
| Chat data unavailable | `chat data unavailable` |
| Source degraded | `source degraded — decision log may be incomplete` |
| Source offline | `source offline — decision log not available` |

### 3.7 Action Labels

| Component | Label |
|-----------|-------|
| View decision detail | `inspect` |
| View linked actions | `actions` |
| Filter by status | `status:` |
| Filter by participant | `participant:` |

---

## 4. Calendar Screen

### 4.1 Purpose Statement

> Time constraints and scheduled work — a deadline pressure warning system. The calendar does not manage schedules; it surfaces urgency to rank operational impact. Answers: *"What time constraints exist, and which ones should change priority right now?"*

### 4.2 Screen Header Copy

| Component | Label Text |
|-----------|------------|
| Page title (MissionBar) | `CALENDAR` |
| Subtitle / description | `time constraints & scheduled work — deadline pressure warning system` |
| Purpose distinction (rendered beneath subtitle) | `Rank impact only when time changes priority. This is not a scheduling tool.` |
| Connection status pill | `● LIVE` / `◐ DEGRADED` / `○ OFFLINE` |
| Freshness label | `freshness: live` / `freshness: stale` / `freshness: unknown` |

### 4.3 Column Headers

| Column | Header Text | Width | Alignment |
|--------|-------------|-------|-----------|
| Time / Date | `TIME` | 12ch monospace | Left |
| Entry type | `TYPE` | 10ch monospace | Center |
| Title | `TITLE` | Fluid (min 20ch) | Left |
| Urgency | `URGENCY` | 10ch monospace | Center |
| Status | `STATUS` | 10ch monospace | Right |

### 4.4 Urgency Labels

| Urgency Level | Display Label | Style |
|---------------|---------------|-------|
| Urgent (within 24h or past due) | `URGENT` | red LED `#ff4444`, `[CRITICAL]` prefix on row |
| Soon (within 72h) | `SOON` | amber CRT `#ffb000`, `[WARNING]` prefix on row |
| Upcoming (within 7 days) | `UPCOMING` | cyan data `#00d4ff` |
| Unknown (no timestamp or unparseable) | `UNKNOWN` | dim grey |

### 4.5 Status Labels

| Status Value | Display Label | Style |
|--------------|---------------|-------|
| Confirmed | `confirmed` | green phosphor |
| Tentative | `tentative` | amber CRT |
| Missed | `missed` | red LED, `[CRITICAL]` row prefix |
| Completed | `completed` | dim (muted, de-emphasized) |
| Stale (data aged beyond freshness threshold) | `stale` | dim grey, italic |

### 4.6 Row-Level Copy (Per Calendar Entry)

| Element | Format / Example |
|---------|------------------|
| Time | `07-15 09:00` (monospace, dim) |
| Type label | `deadline` / `milestone` / `review` / `meeting` |
| Title | `Q3 API key rotation deadline` (truncate >48ch) |
| Urgency badge | `● URGENT` / `◐ SOON` / `○ UPCOMING` / `— UNKNOWN` |
| Status badge | `confirmed` / `tentative` / `missed` / `completed` / `stale` |

### 4.7 Empty / Unavailable States

| State | Copy |
|-------|------|
| No calendar data | `no calendar data` |
| Calendar unavailable | `calendar unavailable` |
| Source degraded | `source degraded — calendar data may be incomplete` |
| Source offline | `source offline — calendar data not available` |

### 4.8 Action Labels

| Component | Label |
|-----------|-------|
| Inspect entry detail | `inspect` |
| Filter by urgency | `urgency:` |
| Filter by status | `status:` |
| Filter by type | `type:` |

---

## 5. Cross-Screen Shared Copy

### 5.1 Universal State Labels

These labels appear across all four screens (and beyond) for consistency.

| State | Label | Usage |
|-------|-------|-------|
| Live / healthy | `● live` | Connection status, freshness, active data |
| Stale (data aged) | `◐ stale` | Freshness column, data indicators |
| Degraded | `◐ degraded` | Source health, partial data |
| Unknown | `○ unknown` | Uninitialized or unverified data |
| Unavailable | `○ unavailable` | Source down or endpoint unreachable |
| Mock / demo data | `○ demo` | Training or simulation data only |
| Verified | `● verified` | Data confirmed by a trusted source |

### 5.2 Severity Tag Templates

Used as row prefixes in Activity and Calendar screens.

| Severity | Tag (10ch monospace) | Color |
|----------|----------------------|-------|
| Critical | `[CRITICAL]` | `#ff4444` red LED |
| Warning | `[WARNING ]` | `#ffb000` amber CRT |
| Info | `[INFO    ]` | `#00d4ff` cyan data |

### 5.3 Connection Status Pill Copy

| State | Label | Dot |
|------|-------|-----|
| Connected | `LIVE` | ● green |
| Degraded | `DEGRADED` | ◐ amber |
| Offline | `OFFLINE` | ○ red |
| Unknown | `UNKNOWN` | ○ grey |

### 5.4 Button / Action Microcopy (Shared)

| Action | Label | Context |
|--------|-------|---------|
| Navigate back | `← back` | Detail views |
| Close panel | `× close` | Overlay / drawer dismiss |
| Refresh data | `refresh` | Manual data reload |
| Toggle view | `toggle view` | Alternate display modes |
| Copy to clipboard | `copy` | IDs, timestamps, reference strings |
| Export data | `export` | CSV/JSON download affordance |

---

## 6. Typography & Formatting Rules

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Column headers | JetBrains Mono | 11px | 500 | Uppercase, dim text |
| Data cells (monospace) | JetBrains Mono | 11px | 400 | Column-aligned where widths are fixed |
| Data cells (text) | Inter | 12px | 400 | For fluid-width columns (topic, title, decision) |
| Severity tags | JetBrains Mono | 10px | 500 | Exactly 10 characters, fixed-width alignment |
| Status badges | JetBrains Mono | 10px | 500 | Uppercase, color-coded |
| Timestamps | JetBrains Mono | 11px | 400 | `HH:MM:SS` or `HH:MM:SS.mmm`, dimmed |
| Action labels | Inter | 11px | 500 | Lowercase, terminal-link style |
| Page titles | JetBrains Mono | 15px | 600 | Uppercase, in MissionBar |
| Subtitles | Inter | 12px | 400 | Dim text, sentence case |
| Empty states | Inter | 13px | 400 | Centered, dim text, 40% opacity |
| Clarifier / distinction text | Inter | 11px | 400 | Small dim text, italic, beneath subtitle |

---

## 7. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Chat screen is titled `DECISIONS` not `CHAT` | Reinforces that this is a structured log, not a chat room. The navigation rail icon can remain a chat bubble, but the screen label must communicate purpose. |
| 2 | `NO DECISION` is a first-class status, not a null | Conversations happen without formal decisions; surfacing this honestly prevents the log from looking broken. |
| 3 | Calendar purpose line is mandatory beneath the subtitle | Users will otherwise expect a scheduling tool. The distinction `"Rank impact only when time changes priority"` must be visible on screen at all times. |
| 4 | Blocker counts use `[!] N` prefix only when >0 | Zero blockers renders as `—` (em-dash). The red `[!]` draws attention only when it matters. |
| 5 | Event type labels are lowercase dot-separated identifiers, not sentence descriptions | Matches CLI/log output conventions. Machine-readable, human-scannable. |
| 6 | `URGENT` / `SOON` / `UPCOMING` use tiered severity colors rather than ordinal numbers | A numbered ranking implies more precision than calendar urgency can provide. Tiered urgency is honest about the fuzziness of time-based priority. |
| 7 | The `DECISIONS` screen subtitle includes the explicit clarifier text | Because the screen may be navigated to from a chat-labeled nav rail, the subtitle must disambiguate on arrival. |
| 8 | Freshness column appears on every screen | Consistent with the provenance invariants (`docs/canonical-model-invariants.md` §P2): every data surface must expose freshness. |

---

*Generated: Phase F, Sora-MissionControl · Lelouch Copy Contract · 2026-06-29*
