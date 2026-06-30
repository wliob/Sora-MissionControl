# Sora-MissionControl — V1 Core Screens Visual Design Spec

**Author:** Korra (Creative & Media Lead)  
**Phase:** Phase F — Activity, Projects, Chat, Calendar Screen Design  
**Date:** 2026-06-29  
**Status:** Design spec — for Biscuit implementation  
**Context:** Design visual layouts, component trees, and empty states for the 4 remaining V1 core screens. These screens complete the V1 navigation surface alongside Team and Office (Phases A/B).  
**Visual Direction:** Three-way blend — Premium startup office (Vercel/Linear spatial foundation) × Anime guild HQ (Persona 5-style JRPG status screen personality) × VSCode Dark + cyberpunk-lite (terminal density, CRT glow, circuit traces). Carried forward from Phases A/B.

---

## 0. Design Principles (Carried Forward)

| Principle | Application |
|---|---|
| **Dark premium** | All screens use `--bg-1` to `--bg-3` depth layers, `--text-primary` through `--text-dim` hierarchy, `--term-border` panel frames |
| **Persona 5 × Linear × VSCode** | Sans-serif identity layer (Inter), monospace data layer (JetBrains Mono), terminal-chrome panel frames, CRT-phosphor accent colors |
| **Truth vocabulary** | Every data point carries provenance: `verified` / `live` / `stale` / `degraded` / `unknown` / `unavailable` / `mock/demo` |
| **Honest empty states** | Never fake healthy. Show "unavailable" when source not connected, "no data" when truly empty — never mock/demo-suggesting |
| **Team/Office visual continuity** | Same color palette, typography, panel chrome, freshness badges, status dots, guild-amber accents |

---

## 0.1 Codebase Context

All four screens render inside the existing `dashboard-main-frame` (flex: 1, padding: 24px, overflow: auto) with the left nav rail (232px) and MissionBar header unchanged.

### Files that DO NOT exist (need creation)

| File | Purpose |
|---|---|
| `src/pages/Activity.tsx` | Activity timeline page |
| `src/pages/Projects.tsx` | Projects portfolio page |
| `src/pages/Chat.tsx` | Decision/escalation records page |
| `src/pages/Calendar.tsx` | Calendar/warnings page |
| `src/components/activity/ActivityTimeline.tsx` | Activity timeline component |
| `src/components/activity/ActivityEntry.tsx` | Individual activity entry row |
| `src/components/projects/ProjectCard.tsx` | Project status card |
| `src/components/projects/ProjectGrid.tsx` | Project card grid layout |
| `src/components/chat/DecisionThread.tsx` | Decision thread component |
| `src/components/chat/DecisionEntry.tsx` | Individual decision/escalation entry |
| `src/components/calendar/CalendarTimeline.tsx` | Calendar timeline component |
| `src/components/calendar/CalendarEntry.tsx` | Individual calendar event entry |
| `src/components/common/ScreenEmptyState.tsx` | Reusable empty/unavailable state component |
| `src/state/activityStore.ts` | Activity event state |
| `src/state/projectStore.ts` | Project portfolio state |
| `src/state/chatStore.ts` | Decision record state |
| `src/state/calendarStore.ts` | Calendar event state |

### Files that need modification

| File | Change |
|---|---|
| `src/components/shell/ShellLayout.tsx` | Add routes for `/activity`, `/projects`, `/chat`, `/calendar`; add to `PrimaryView` union; wire page renders |
| `src/styles/theme.css` | Add screen-specific CSS classes (activity, projects, chat, calendar) |

---

## 1. Activity Screen

### 1.1 Purpose & Concept

**The Activity screen is the chronological operations log** — a filtered timeline of meaningful agent events across the system. Unlike the Team AttentionRail (which answers "what needs my attention now?"), Activity answers "what happened?" with a forensic, searchable event stream.

**Core idea:** A terminal-style `tail -f /var/log/mission-control` rendered as a premium operations console. Think Datadog event stream meets Bloomberg Terminal audit trail, with subtle guild framing.

**Default view:** Chronological timeline (newest-first).

**Secondary mode:** Operational-state grouping (filter/focus mode — a toggle, not the default).

### 1.2 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MissionBar: "ACTIVITY" │ [CONN: ● ACTIVE] │ [freshness: live]  │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐    │
│ │  FILTER BAR                                              │    │
│ │  [All Events ▾] [All Agents ▾] [Last 24h ▾]  [⟳ refresh]│    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │  ACTIVITY TIMELINE                                       │    │
│ │                                                          │    │
│ │  ┌── Today ──────────────────────────────────────────┐   │    │
│ │  │ ┌────────────────────────────────────────────────┐ │   │    │
│ │  │ │ 14:32:17.842  [TASK_STATE]  Cloud              │ │   │    │
│ │  │ │ mission-control#42 moved to in_progress  ⬤ live│ │   │    │
│ │  │ └────────────────────────────────────────────────┘ │   │    │
│ │  │ ┌────────────────────────────────────────────────┐ │   │    │
│ │  │ │ 14:28:01.104  [BLOCKER]     Biscuit            │ │   │    │
│ │  │ │ auth service unreachable · 2 tasks affected    │ │   │    │
│ │  │ │                               ⬤ live          │ │   │    │
│ │  │ └────────────────────────────────────────────────┘ │   │    │
│ │  │ ┌────────────────────────────────────────────────┐ │   │    │
│ │  │ │ 13:55:42.339  [DELEGATION]  Korra → Lelouch    │ │   │    │
│ │  │ │ design review handed off            ⬤ live     │ │   │    │
│ │  │ └────────────────────────────────────────────────┘ │   │    │
│ │  └────────────────────────────────────────────────────┘   │    │
│ │                                                          │    │
│ │  ┌── Yesterday ─────────────────────────────────────┐    │    │
│ │  │ ┌────────────────────────────────────────────────┐ │   │    │
│ │  │ │ 22:15:03.662  [AUTOMATION]  Sora               │ │   │    │
│ │  │ │ nightly health scan complete · 7/7 healthy     │ │   │    │
│ │  │ │                               ⬤ stale (18h)   │ │   │    │
│ │  │ └────────────────────────────────────────────────┘ │   │    │
│ │  └────────────────────────────────────────────────────┘    │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ╭──────────────────────────────────────────────────────────────╮ │
│  │ ⟐ 127 events │ filtered: all agents, all types │ 14:32 UTC  │ │
│  ╰──────────────────────────────────────────────────────────────╯ │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Component Hierarchy

```
ActivityPage (src/pages/Activity.tsx)
├── FilterBar
│   ├── EventTypeDropdown (multi-select chip group)
│   ├── AgentDropdown (multi-select chip group)
│   ├── TimeRangeSelector (preset buttons: 1h / 6h / 24h / 7d / all)
│   └── RefreshButton (terminal-style ⟳ icon)
├── ActivityTimeline
│   └── ActivityDayGroup[] (grouped by calendar day)
│       └── ActivityEntry[] (individual event rows)
│           ├── Timestamp (monospace, HH:MM:SS.mmm)
│           ├── EventTypeBadge (terminal-style tag, color-coded)
│           ├── SourceAgentBadge (guild house color chip + name)
│           ├── SummaryLine (sans-serif, max 2 lines)
│           └── FreshnessBadge (inline, right-aligned)
└── StatusBar (event count, filter summary, current time)
```

### 1.4 Event Type Taxonomy

| Event Type | Tag Text | Accent Color | Description |
|---|---|---|---|
| TASK_STATE | `[TASK_STATE]` | `#00d4ff` (cyan) | Task moved between Kanban states |
| BLOCKER | `[BLOCKER  ]` | `#ff4444` (red) | A task or agent became blocked |
| DELEGATION | `[DELEGATION]` | `#9944ff` (violet) | Work handed off between agents |
| AUTOMATION | `[AUTOMATION]` | `#00ff41` (green) | Automated action completed |
| VERIFICATION | `[VERIFY  ]` | `#00ff41` (green) | Health/data verification result |
| CALENDAR | `[CALENDAR ]` | `#ffb000` (amber) | Calendar event triggered |
| SOURCE_HEALTH | `[SRC_HEALTH]` | `#ffb000` (amber) | Data source health change |

**Excluded non-events:** cosmetic animation, page views, hover/clicks, raw chat volume, ambient idle.

All tags are fixed-width (12 characters, monospace, left-padded) for column alignment.

### 1.5 ActivityEntry Row Design

```
┌──────────────────────────────────────────────────────────────────┐
│ 14:32:17.842  [TASK_STATE]  ● Cloud   mission-control#42        │
│                              ⬤ live    moved to in_progress      │
└──────────────────────────────────────────────────────────────────┘
```

- **Timestamp:** JetBrains Mono 10px, `--text-muted`, width: 12ch. Format: `HH:MM:SS.mmm`.
- **Event type tag:** JetBrains Mono 10px, 12ch fixed-width, colored per §1.4. Background: accent at 6% opacity.
- **Source agent:** Guild house color dot (6px) + agent name in JetBrains Mono 10px. Color from agent guild house palette.
- **Summary:** Inter 12px, `--text-secondary`, max 2 lines. Truncates with "…" at 1 line in compact mode.
- **Freshness badge:** Right-aligned, 10px mono badge per existing FreshnessBadge spec (Phase A §5.6).
- **Row background:** `var(--team-card-bg)` (rgba(5,8,14,0.94)). Border-bottom: `1px solid var(--term-divider)`.
- **Hover:** Background lifts to `var(--team-card-hover-bg)`. Left edge accent bar (2px) in event type color appears.

**Blocker events** get a subtle red left-border accent (2px) and the summary text lifts to brighter red-tinted white.

### 1.6 Day Group Headers

```
┌── Today ────────────────────────────────────────────────────────┐
```

- **Format:** `┌── {label} ──` in JetBrains Mono 10px, `--text-muted`. Box-drawing characters for the tree/terminal feel.
- **Label logic:** "Today", "Yesterday", then absolute dates for older groups: "2026-06-27 (Fri)".
- **Sticky on scroll:** Day headers stick to the top of the viewport when scrolling through that day's events.

### 1.7 Filter Bar

```
┌──────────────────────────────────────────────────────────┐
│  [All Events ▾] [All Agents ▾] [Last 24h ▾]  [⟳ refresh]│
└──────────────────────────────────────────────────────────┘
```

- **Height:** 36px. Background: `rgba(8, 12, 20, 0.94)`. Border-bottom: `1px solid var(--term-border)`.
- **Dropdowns:** Terminal-style select menus. JetBrains Mono 10px. Arrow: `▾` character. Padding: 6px 12px.
- **Refresh button:** Terminal icon `⟳` (U+27F3) in amber. On click, re-fetches event stream. Subtle spin animation (400ms) on click.
- **Sticky:** Filter bar sticks below MissionBar on scroll.

### 1.8 Secondary Mode: Operational-State Grouping

**Toggle:** A small `[grouped ▸]` / `[timeline ▸]` toggle in the filter bar right side.

When grouped:
- Events cluster under operational state headers: `BLOCKED`, `IN PROGRESS`, `REVIEW`, `COMPLETED`, `IDLE`.
- Each cluster shows a count badge: e.g., `BLOCKED (3)`.
- Same event entry rows within each cluster, sorted newest-first within cluster.
- Cluster headers use the state's accent color with a subtle background wash.

### 1.9 States

#### 1.9.1 Loading State
- Timeline shows 8 skeleton rows with shimmer. Filter bar visible but dropdowns disabled. Status bar shows `⟐ loading…`.

#### 1.9.2 Empty State (No Events)
- Timeline shows a single centered message panel:
  ```
  ┌─────────────────────────────────────────────┐
  │                                             │
  │           No activity events recorded        │
  │                                             │
  │     The event log is empty. This means no   │
  │     task state changes, blocker events,     │
  │     delegations, or system events have      │
  │     occurred in the selected time range.    │
  │                                             │
  │                [⟳ refresh]                  │
  │                                             │
  └─────────────────────────────────────────────┘
  ```
- Panel uses double-line corner accents (guild amber at 7% opacity at rest).
- Filter bar remains interactive — user can widen time range.
- Status bar shows: `⟐ 0 events │ filtered: … │ 14:32 UTC`

#### 1.9.3 Unavailable State (Source Not Connected)
- Timeline shows a warning panel:
  ```
  ┌─────────────────────────────────────────────┐
  │  ⚠  Activity data unavailable               │
  │                                             │
  │     The activity event source is not        │
  │     connected. Check your connection to     │
  │     the Hermes runtime or admin proxy.      │
  │                                             │
  │     Source: dashboard-api                   │
  │     Status: offline                         │
  │                                             │
  │                [retry connection]           │
  │                                             │
  └─────────────────────────────────────────────┘
  ```
- Panel has a subtle red-tinted left border. Warning icon in amber.
- Filter bar shows dropdowns disabled with "unavailable" freshness badge.
- Status bar shows: `⟐ -- events │ system: OFFLINE`

#### 1.9.4 Degraded State (Partial Data)
- Events with `stale` or `degraded` freshness get a subtle amber tint overlay on their row.
- Freshness badge shows `stale` or `degraded` accordingly.
- Filter bar shows a small amber dot next to the refresh button.
- Status bar shows event count but marks it: `⟐ 89 events (12 stale)`

---

## 2. Projects Screen

### 2.1 Purpose & Concept

**The Projects screen is the portfolio/outcome layer** — it shows project status across the guild. Unlike Board/Kanban (which shows tasks), Projects shows the higher-level project containers: what's being worked on, by whom, and at what health.

**Core idea:** A premium startup project dashboard — think Linear project list meets Vercel deployment overview — rendered with guild class framing and terminal data density.

### 2.2 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MissionBar: "PROJECTS" │ [CONN: ● ACTIVE] │ [freshness: live]  │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  PROJECTS (3)                        [active ▾] [⇅ updated] │ │
│ │  ─────────────────────────────────────────────────────────── │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  PROJECT GRID (CSS Grid, 2 columns, 28px gap)                │ │
│ │                                                              │ │
│ │ ┌─────────────────────────┐ ┌─────────────────────────────┐ │ │
│ │ │ ╭─ project:mission-ctrl─┤ │ ╭─ project:hermes-dashboard │ │ │
│ │ │ │ ● ACTIVE     Cloud   │ │ │ │ ● ACTIVE     Biscuit    │ │ │
│ │ │ ╰───────────────────────┤ │ ╰───────────────────────────┤ │ │
│ │ │                         │ │                             │ │ │
│ │ │  Mission Control v2     │ │  Hermes Dashboard Rebuild   │ │ │
│ │ │  Systems & Infra        │ │  Architecture & Design      │ │ │
│ │ │                         │ │                             │ │ │
│ │ │  ──── tasks ────        │ │  ──── tasks ────            │ │ │
│ │ │  ██████░░░░  12 tasks   │ │  ██████████░  18 tasks      │ │ │
│ │ │  [!] BLOCKERS: 1        │ │  [!] BLOCKERS: 0            │ │ │
│ │ │                         │ │                             │ │ │
│ │ │  last: 14m ago          │ │  last: 2h ago               │ │ │
│ │ │  ⬤ verified             │ │  ⬤ live                     │ │ │
│ │ │                         │ │                             │ │ │
│ │ │  ╰── open board         │ │  ╰── open board             │ │ │
│ │ └─────────────────────────┘ └─────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ╭──────────────────────────────────────────────────────────────╮ │
│  │ ⟐ 3 projects │ 2 active · 1 paused · 0 completed │ 14:32 UTC│ │
│  ╰──────────────────────────────────────────────────────────────╯ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Component Hierarchy

```
ProjectsPage (src/pages/Projects.tsx)
├── ProjectFilterBar
│   ├── StatusFilter (chip group: All / Active / Paused / Completed)
│   ├── SortControl (updated / name / lead)
│   └── CountLabel (monospace project count)
├── ProjectGrid (CSS Grid, 2 columns)
│   └── ProjectCard[]
│       ├── TabHeader (status dot + status label + lead name, accent stripe)
│       ├── ProjectTitle (Inter 15px, bold)
│       ├── DepartmentLabel (Inter 11px, guild class format)
│       ├── SectionDivider (──┬─ tasks)
│       ├── TaskBar (htop-style bar, 6px)
│       ├── TaskCount (monospace, right-aligned)
│       ├── BlockerCount ([!] BLOCKERS: N)
│       ├── LastActivity (monospace, relative timestamp)
│       ├── FreshnessBadge (inline)
│       └── ActionButton (╰── open board)
└── StatusBar (project count, status breakdown, current time)
```

### 2.4 Project Status Colors

| Status | Dot Color | Bar Color | Text Label | Card Visual |
|---|---|---|---|---|
| `active` | `#00ff41` (green) | Green segments | `● ACTIVE` | Standard card, green accent left stripe, monitor glow |
| `paused` | `#ffb000` (amber) | Amber segments | `● PAUSED` | Slightly dimmed card, amber accent left stripe |
| `completed` | `#666666` (dim) | Dim segments | `● COMPLETED` | Faded card, dim accent stripe, reduced opacity (0.7) |

### 2.5 ProjectCard Design

```
┌─────────────────────────────────────┐
│ ╭─ project:mission-control ───────╮ │ ← tab header (28px), accent left stripe
│ │ ● ACTIVE               Cloud   │ │   status dot + lead name right-aligned
│ ╰────────────────────────────────╯ │
│                                     │
│  Mission Control v2                 │ ← Project title, Inter 15px, weight 600
│  Systems & Infrastructure           │ ← Department, Inter 11px, guild class
│                                     │
│  ──┬─ tasks ────────────────────── │ ← section divider
│    │ ████████████░░░░  12 tasks    │   htop bar: green-filled, 6px tall
│    │                               │
│    │ [!] BLOCKERS: 1               │   red [!] pip if >0, dim if 0
│    │                               │
│    │ last activity: 14m ago        │   monospace, relative time
│    │ ⬤ verified                    │   freshness badge
│    │                               │
│    ╰── open board ─────────────────│   terminal action, dim → accent on hover
└─────────────────────────────────────┘
```

- **Tab header:** 28px, status dot + label on left, lead name right-aligned. 2px accent left stripe in status color.
- **Department label:** "Systems & Infrastructure" — Inter 11px, `--text-muted`. Uses the lead's guild class metadata for consistent labeling.
- **Task bar:** htop-style filled bar, 6px. Segment widths proportional to task status counts. Bar color matches project status (green/amber/dim). Empty segments: `#1a1a2e`.
- **Task count:** "12 tasks" in JetBrains Mono 10px, right-aligned alongside the bar.
- **Blocker count:** `[!] BLOCKERS: N` in JetBrains Mono 10px. Red `[!]` when N > 0, dim otherwise.
- **Last activity:** Relative timestamp (e.g., "14m ago", "2h ago", "3d ago"). JetBrains Mono 10px, `--text-dim`.
- **Freshness badge:** Inline, 10px mono badge per existing spec.
- **Action:** `╰── open board` — terminal tree-menu style. Inter 11px lowercase. Transparent background → `rgba(255,255,255,0.04)` on hover.
- **Card dimensions:** Same as LeadCard — `min-height: 200px`, padding: 14px. Background: `var(--team-card-bg)`. Border: `1px solid var(--team-card-border)`. Hover: `var(--team-card-hover-bg)` + `var(--team-card-hover-border)`.
- **Double-line corners:** Subtle guild amber corner accents at 7% opacity (rest) → 18% (hover).

### 2.6 ProjectGrid Layout

- **CSS Grid:** `grid-template-columns: repeat(2, 1fr)` with 28px gap.
- **Responsive breakpoints:**
  - ≥ 1200px: 2 columns
  - 768-1199px: 1 column (full-width cards)
  - < 768px: 1 column, reduced padding

### 2.7 States

#### 2.7.1 Loading State
- Grid shows 4 skeleton cards (shimmer). Filter bar visible, count shows "…". Status bar shows "loading…".

#### 2.7.2 Empty State (No Projects)
- Grid area shows centered panel:
  ```
  ┌─────────────────────────────────────────────┐
  │                                             │
  │           No projects tracked               │
  │                                             │
  │     No projects are currently registered    │
  │     in the system. Projects will appear     │
  │     here once work is organized into        │
  │     tracked project containers.             │
  │                                             │
  │                                             │
  └─────────────────────────────────────────────┘
  ```
- Panel uses double-line corner accents (guild amber at 7% opacity at rest).
- Status bar shows: `⟐ 0 projects │ -- active · -- paused · -- completed │ 14:32 UTC`

#### 2.7.3 Unavailable State (Source Not Connected)
- Grid area shows warning panel:
  ```
  ┌─────────────────────────────────────────────┐
  │  ⚠  Project data unavailable               │
  │                                             │
  │     The project data source is not          │
  │     connected. Check your connection to     │
  │     the Hermes runtime or admin proxy.      │
  │                                             │
  │     Source: dashboard-api                   │
  │     Status: offline                         │
  │                                             │
  │                [retry connection]           │
  │                                             │
  └─────────────────────────────────────────────┘
  ```
- Panel has subtle red-tinted left border. Warning icon in amber.
- Status bar shows: `⟐ -- projects │ system: OFFLINE`

#### 2.7.4 Degraded State
- Project cards with stale data get a subtle amber tint overlay (2px amber border on card, 8% opacity).
- Freshness badge shows `stale` or `degraded`.
- Status bar shows: `⟐ 3 projects (1 stale) │ 2 active · 1 paused │ 14:32 UTC`

---

## 3. Chat Screen

### 3.1 Purpose & Concept

**The Chat screen is the decision/escalation layer** — it surfaces decision threads, escalation items, and action items extracted from conversations. It is NOT a general chat room or casual messaging UI (that's the FloatingChatOverlay's role). This screen answers "what was decided?" and "what needs escalation review?"

**Core idea:** A command-console decision log — think a military comms room dispatch board meets a corporate board meeting minutes log — rendered in the three-way blend. Unlike the FloatingChatOverlay (which is a real-time messaging panel with amber bubble styling), this screen is a structured decision archive with terminal-style log formatting.

**Visual distinction from FloatingChatOverlay/ChatPanel:**
- No amber bubble launcher button
- No resizable floating panel
- No real-time message input
- Instead: full-page structured timeline of decision records with participant avatars, topic headers, and action item checklists
- Uses the standard page shell (MissionBar + dashboard-main-frame), not fixed-position floating UI

### 3.2 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MissionBar: "CHAT" │ [CONN: ● ACTIVE] │ [freshness: live]      │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  FILTER BAR                                                  │ │
│ │  [All Threads ▾] [All Agents ▾] [Last 7d ▾]    [⟳ refresh] │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  DECISION TIMELINE                                           │ │
│ │                                                              │ │
│ │ ┌── Today ──────────────────────────────────────────────┐   │ │
│ │ │                                                       │   │ │
│ │ │ ┌─────────────────────────────────────────────────────┐│   │ │
│ │ │ │ 14:32  ⚡ ESCALATION                               ││   │ │
│ │ │ │ ┌──────┐ ┌──────┐                                  ││   │ │
│ │ │ │ │ CLOUD│ │BISCUT│  Auth service timeout            ││   │ │
│ │ │ │ └──────┘ └──────┘                                  ││   │ │
│ │ │ │                                                     ││   │ │
│ │ │ │  Decision: Roll back to v2.3.1, monitor for 1h     ││   │ │
│ │ │ │                                                     ││   │ │
│ │ │ │  ☐ Notify Tifa (deployment rollback) → assigned    ││   │ │
│ │ │ │  ☑ Verify health endpoint → resolved               ││   │ │
│ │ │ │                                                     ││   │ │
│ │ │ │  14:32 ⬤ live         ╰── view thread              ││   │ │
│ │ │ └─────────────────────────────────────────────────────┘│   │ │
│ │ │                                                       │   │ │
│ │ │ ┌─────────────────────────────────────────────────────┐│   │ │
│ │ │ │ 11:15  📋 DECISION                                ││   │ │
│ │ │ │ ┌──────┐ ┌──────┐ ┌──────┐                        ││   │ │
│ │ │ │ │ KORRA│ │Lelouc│ │ SORA │  Design system update  ││   │ │
│ │ │ │ └──────┘ └──────┘ └──────┘                        ││   │ │
│ │ │ │                                                     ││   │ │
│ │ │ │  Decision: Adopt guild amber palette for all       ││   │ │
│ │ │ │  new screens; Korra to produce updated tokens      ││   │ │
│ │ │ │                                                     ││   │ │
│ │ │ │  ☐ Update theme.css tokens → assigned (Korra)      ││   │ │
│ │ │ │  ☐ Review contrast compliance → pending            ││   │ │
│ │ │ │                                                     ││   │ │
│ │ │ │  11:15 ⬤ stale (3h)   ╰── view thread              ││   │ │
│ │ │ └─────────────────────────────────────────────────────┘│   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ╭──────────────────────────────────────────────────────────────╮ │
│  │ ⟐ 7 decisions │ 2 escalations · 5 decisions │ 14:32 UTC     │ │
│  ╰──────────────────────────────────────────────────────────────╯ │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Component Hierarchy

```
ChatPage (src/pages/Chat.tsx)
├── ChatFilterBar
│   ├── ThreadTypeDropdown (All / Decisions / Escalations)
│   ├── AgentDropdown (multi-select)
│   ├── TimeRangeSelector
│   └── RefreshButton
├── DecisionTimeline
│   └── ChatDayGroup[] (grouped by calendar day)
│       └── DecisionEntry[]
│           ├── HeaderRow (timestamp + thread type badge)
│           ├── ParticipantRow (small portrait avatars + names)
│           ├── TopicLine (Inter 14px, bold-ish)
│           ├── DecisionOutcome (Inter 13px, "Decision: …")
│           ├── ActionItems (checklist of action items)
│           ├── FooterRow (timestamp + freshness + action link)
│           └── FreshnessBadge
└── StatusBar (decision count, escalation count, current time)
```

### 3.4 Thread Type Taxonomy

| Type | Tag Text | Accent Color | Icon | Description |
|---|---|---|---|---|
| ESCALATION | `[ESCALATION]` | `#ff4444` (red) | `⚡` | Issue raised to Sora/guild-master from a department lead |
| DECISION | `[DECISION ]` | `#00d4ff` (cyan) | `📋` | Group decision reached on a topic |
| ACTION | `[ACTION   ]` | `#ffb000` (amber) | `▶` | Action item extracted from a conversation |
| REVIEW | `[REVIEW   ]` | `#9944ff` (violet) | `◎` | Review request or feedback thread |

**Tags are fixed-width (12 characters, monospace, left-padded) for column alignment.**

### 3.5 DecisionEntry Design

```
┌──────────────────────────────────────────────────────────────┐
│ 14:32  ⚡ [ESCALATION]                                       │
│ ┌──────┐ ┌──────┐                                           │
│ │ CLOUD│ │BISCUT│  Auth service timeout                     │
│ └──────┘ └──────┘                                           │
│                                                              │
│  Decision: Roll back to v2.3.1, monitor for 1h              │
│                                                              │
│  ☐ Notify Tifa (deployment rollback) → assigned             │
│  ☑ Verify health endpoint → resolved                        │
│                                                              │
│  14:32 ⬤ live                          ╰── view thread      │
└──────────────────────────────────────────────────────────────┘
```

**Entry elements (top to bottom):**

1. **Header row:** Timestamp (JetBrains Mono 10px, `--text-muted`) + thread type icon + tag badge (colored per §3.4).
2. **Participant row:** Small circular avatars (24px) of participants, side by side (gap: 6px). Each with agent guild house color ring (1.5px). Name labels below in JetBrains Mono 9px, agent accent color. Max 4 shown; "+2" overflow badge for more.
3. **Topic line:** Inter 14px, weight 500, `--text-primary`. Max 1 line, truncation with "…".
4. **Decision outcome:** "Decision: {text}" in Inter 13px, `--text-secondary`. Max 3 lines. This is the core content — what was actually decided.
5. **Action items:** Checklist-style items, each on its own line.
   - `☐` (unchecked, U+2610) — pending/assigned
   - `☑` (checked, U+2611) — resolved
   - `☒` (X-marked, U+2612) — blocked/abandoned
   - Item text in Inter 11px, `--text-secondary`. Status tag (→ assigned / → resolved / → blocked) in JetBrains Mono 9px, dim.
6. **Footer row:** Timestamp repeated + freshness badge + `╰── view thread` action link.

**Entry background:** `var(--team-card-bg)`. Border: `1px solid var(--team-card-border)`. Padding: 14px.
**Hover:** Background lifts to `var(--team-card-hover-bg)`. Left edge accent bar (2px) in thread type color appears.
**Escalation entries** get a subtle red left-border accent (2px) at all times (not just hover) to visually distinguish them as urgent.

### 3.6 Participant Avatars

- **Size:** 24×24px circular.
- **Ring:** 1.5px solid agent guild house color at 40% opacity.
- **Initials fallback:** 2 characters in JetBrains Mono 9px, agent accent color on `#0a0a0a` background.
- **Grouping:** Avatars clustered with 6px gap. If >4 participants, show 4 + a "+N" badge (18px circle, `--text-muted`, mono).

### 3.7 Visual Distinction from FloatingChatOverlay

| Feature | FloatingChatOverlay/ChatPanel | Chat Screen (this spec) |
|---|---|---|
| **Position** | Fixed overlay, bottom-right | Full page inside shell |
| **Purpose** | Real-time messaging | Decision archive |
| **Input** | Message composer | None (read-only archive) |
| **Styling** | Amber bubble launcher, rounded floating panel, dark glass | Terminal-panel page, structured log entries, standard page chrome |
| **Content** | Raw conversation stream | Structured: topic → decision → action items |
| **Interaction** | Type, send, resize, drag | Browse, filter, view thread details |
| **Navigation** | Always accessible via floating button | Nav rail route: /chat |

### 3.8 States

#### 3.8.1 Loading State
- Timeline shows 5 skeleton entry cards with shimmer. Filter bar visible but disabled. Status bar shows `⟐ loading…`.

#### 3.8.2 Empty State (No Decision Records)
- Timeline area shows centered panel:
  ```
  ┌─────────────────────────────────────────────┐
  │                                             │
  │           No decision records               │
  │                                             │
  │     No escalation items, decision threads,  │
  │     or action items have been recorded.     │
  │     Decisions will appear here as they      │
  │     are captured from conversations.        │
  │                                             │
  └─────────────────────────────────────────────┘
  ```
- Panel uses double-line corner accents (guild amber at 7% at rest).
- Status bar shows: `⟐ 0 decisions │ 0 escalations │ 14:32 UTC`

#### 3.8.3 Unavailable State (Source Not Connected)
- Timeline area shows warning panel:
  ```
  ┌─────────────────────────────────────────────┐
  │  ⚠  Chat data unavailable                   │
  │                                             │
  │     The decision-records source is not      │
  │     connected. Check your connection to     │
  │     the Hermes runtime or admin proxy.      │
  │                                             │
  │     Source: dashboard-api                   │
  │     Status: offline                         │
  │                                             │
  │                [retry connection]           │
  └─────────────────────────────────────────────┘
  ```
- Panel has subtle red-tinted left border. Warning icon in amber.
- Status bar shows: `⟐ -- decisions │ system: OFFLINE`

#### 3.8.4 Degraded State
- Entries with stale data get a subtle amber tint overlay. Freshness badge shows `stale` or `degraded`.
- Status bar shows: `⟐ 7 decisions (2 stale) │ 2 escalations · 5 decisions │ 14:32 UTC`

---

## 4. Calendar Screen

### 4.1 Purpose & Concept

**The Calendar screen serves a dual role:** it is both a **ranking input** (time constraints can change priority) AND a **continuous warning system** (upcoming deadlines, meetings, stale recurring work, missed runs, time-sensitive blockers). It answers "what's coming up?" and "what's overdue?"

**Core idea:** A terminal-style cron monitor meets a premium calendar timeline — think `crontab -l` fused with a corporate deadline tracker — rendered in the three-way blend. Time is rendered as a threat vector, not a friendly agenda.

**Rank impact only when** a time constraint changes priority — otherwise entries are informational warnings, not ranking signals.

### 4.2 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MissionBar: "CALENDAR" │ [CONN: ● ACTIVE] │ [freshness: live]  │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  WARNING BAR                                                │ │
│ │  ⚠ 3 overdue · 2 approaching · 1 missed run    [dismiss all]│ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  FILTER BAR                                                  │ │
│ │  [All Events ▾] [All Types ▾] [Upcoming ▾]     [⟳ refresh] │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  CALENDAR TIMELINE                                          │ │
│ │                                                              │ │
│ │ ┌── Today · 2026-06-29 (Mon) ───────────────────────────┐   │ │
│ │ │                                                       │   │ │
│ │ │ ┌─────────────────────────────────────────────────────┐│   │ │
│ │ │ │ 14:00  [MEETING]   ▲ HIGH                          ││   │ │
│ │ │ │ Design review: Phase F screens           ⬤ live     ││   │ │
│ │ │ │ ╰── open detail                                    ││   │ │
│ │ │ └─────────────────────────────────────────────────────┘│   │ │
│ │ │                                                       │   │ │
│ │ │ ┌─────────────────────────────────────────────────────┐│   │ │
│ │ │ │ 18:00  [DEADLINE]  ■ CRITICAL                      ││   │ │
│ │ │ │ Phase F merge cutoff · 3h 28m remaining  ⬤ live    ││   │ │
│ │ │ │ ⚡ Affects rank: Cloud's review task               ││   │ │
│ │ │ │ ╰── open detail                                    ││   │ │
│ │ │ └─────────────────────────────────────────────────────┘│   │ │
│ │ │                                                       │   │ │
│ │ │ ┌─────────────────────────────────────────────────────┐│   │ │
│ │ │ │ 23:59  [DEADLINE]  ◆ WARNING                       ││   │ │
│ │ │ │ Tifa: vendor contract renewal window      ⬤ live    ││   │ │
│ │ │ │ ╰── open detail                                    ││   │ │
│ │ │ └─────────────────────────────────────────────────────┘│   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ │                                                              │ │
│ │ ┌── Tomorrow · 2026-06-30 (Tue) ────────────────────────┐   │ │
│ │ │ ┌─────────────────────────────────────────────────────┐│   │ │
│ │ │ │ 09:00  [SCHEDULED] ▶ SCHEDULED                     ││   │ │
│ │ │ │ Biscuit: weekly architecture sync        ⬤ live     ││   │ │
│ │ │ │ ╰── open detail                                    ││   │ │
│ │ │ └─────────────────────────────────────────────────────┘│   │ │
│ │ │                                                       │   │ │
│ │ │ ┌─────────────────────────────────────────────────────┐│   │ │
│ │ │ │ 12:00  [RECURRING] ◆ WARNING                       ││   │ │
│ │ │ │ Stale recurring: "health scan report"              ││   │ │
│ │ │ │ Missed 2 runs. Last ran: 2026-06-26    ⬤ stale     ││   │ │
│ │ │ │ ╰── open detail                                    ││   │ │
│ │ │ └─────────────────────────────────────────────────────┘│   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ╭──────────────────────────────────────────────────────────────╮ │
│  │ ⟐ 12 events │ 3 overdue · 2 approaching · 1 missed │ 14:32  │ │
│  ╰──────────────────────────────────────────────────────────────╯ │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Component Hierarchy

```
CalendarPage (src/pages/Calendar.tsx)
├── WarningBar (sticky summary of urgent items)
│   ├── WarningCountBadges (overdue count / approaching count / missed runs)
│   └── DismissAllButton
├── CalendarFilterBar
│   ├── EventTypeDropdown
│   ├── UrgencyFilter (All / Critical / High / Warning / Scheduled)
│   ├── TimeRangeSelector
│   └── RefreshButton
├── CalendarTimeline
│   └── CalendarDayGroup[] (grouped by calendar day)
│       └── CalendarEntry[]
│           ├── Timestamp (HH:MM, monospace)
│           ├── EventTypeBadge (terminal-style tag)
│           ├── UrgencyIndicator (▲ HIGH / ■ CRITICAL / ◆ WARNING / ▶ SCHEDULED)
│           ├── TitleLine (Inter 13px)
│           ├── DetailLine (monospace, secondary info)
│           ├── RankImpactLine (⚡ Affects rank: … — only when applicable)
│           ├── FreshnessBadge
│           └── ActionLink (╰── open detail)
└── StatusBar (event count, urgency breakdown, current time)
```

### 4.4 Event Type Taxonomy

| Event Type | Tag Text | Accent Color | Description |
|---|---|---|---|
| DEADLINE | `[DEADLINE ]` | `#ff4444` (red) | Time-sensitive task or project deadline |
| MEETING | `[MEETING  ]` | `#00d4ff` (cyan) | Scheduled meeting/sync |
| SCHEDULED | `[SCHEDULED]` | `#ffb000` (amber) | Scheduled job or automation run |
| RECURRING | `[RECURRING]` | `#9944ff` (violet) | Recurring work item (stale/missed detection) |
| MILESTONE | `[MILESTONE]` | `#00ff41` (green) | Project milestone marker |
| REMINDER | `[REMINDER ]` | `#ffb000` (amber) | General reminder alert |

**Tags are fixed-width (12 characters, monospace, left-padded) for column alignment.**

### 4.5 Urgency Indicators

| Urgency Level | Icon | Color | Visual | Rank Impact? |
|---|---|---|---|---|
| CRITICAL | `■` | `#ff4444` (red) | Red-tinted card, subtle red glow. Pulsing urgency dot. | **Yes** — reprioritizes tasks |
| HIGH | `▲` | `#ff4444` (red) | Red left-border accent (2px). Static. | **Yes** — may affect priority |
| WARNING | `◆` | `#ffb000` (amber) | Amber left-border accent (1px). Static. | No — informational only |
| SCHEDULED | `▶` | `#00d4ff` (cyan) | Standard card, no accent border. | No — routine scheduling |

**Rank impact callout:** When an event affects task ranking, a dedicated line appears:
```
⚡ Affects rank: Cloud's review task (priority bumped from NORMAL → HIGH)
```
- Icon: `⚡` (U+26A1, high voltage) in `#ffb000` (amber).
- Text: Inter 11px, `--text-secondary`.
- Only shown on CRITICAL and HIGH urgency events where the time constraint actually changes a task's computed priority.

### 4.6 CalendarEntry Design

```
┌──────────────────────────────────────────────────────────────┐
│ 18:00  [DEADLINE]  ■ CRITICAL                               │
│                                                              │
│  Phase F merge cutoff                                        │
│  3h 28m remaining                                  ⬤ live    │
│                                                              │
│  ⚡ Affects rank: Cloud's review task                        │
│                                                              │
│  ╰── open detail                                            │
└──────────────────────────────────────────────────────────────┘
```

**Entry elements (top to bottom):**

1. **Header row:** Timestamp (JetBrains Mono 11px, `--text-primary`, weight 500) + event type tag (colored per §4.4) + urgency indicator (icon + label in urgency color).
2. **Title line:** Inter 14px, weight 500, `--text-primary`. The event name/title. Max 1 line.
3. **Detail line:** JetBrains Mono 11px, `--text-dim`. Context-specific:
   - For deadlines: "3h 28m remaining" (countdown) or "OVERDUE by 2h" (red tint when past).
   - For meetings: "Weekly architecture sync — 30min"
   - For recurring: "Missed 2 runs. Last ran: 2026-06-26" (amber tint for missed).
   - For scheduled jobs: "Next run: 09:00" or "Running now…" (green if active).
4. **Freshness badge:** Right-aligned inline with detail line.
5. **Rank impact line:** (Optional) `⚡ Affects rank: {description}` — only when applicable. Inter 11px, amber icon + dim text.
6. **Action link:** `╰── open detail` — terminal tree-menu style. Inter 11px lowercase, dim → accent on hover.

**Entry background:** `var(--team-card-bg)`. Border: `1px solid var(--team-card-border)`. Padding: 14px.
**Hover:** Background lifts to `var(--team-card-hover-bg)`. 

**Critical entries** get a subtle red left-border + a subtle red glow shadow (`box-shadow: 0 0 12px rgba(255,68,68,0.06)`). Urgency dot pulses (opacity animation, 2s period).
**Overdue entries** get an additional amber tint overlay (2px amber border, 8% opacity) on top of the critical styling. Title text may shift to red tint.

### 4.7 Warning Bar

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠ 3 overdue · 2 approaching · 1 missed run    [dismiss all]│
└──────────────────────────────────────────────────────────────┘
```

- **Position:** Below MissionBar, above filter bar. Sticky. Height: 32px.
- **Background:** `rgba(255, 68, 68, 0.08)` (subtle red wash) when critical items exist; `rgba(255, 176, 0, 0.06)` when only warnings.
- **Icon:** `⚠` (U+26A0) in amber or red depending on highest urgency.
- **Text:** JetBrains Mono 10px, `--text-secondary`. Count badges in urgency colors.
- **Dismiss button:** Right-aligned. JetBrains Mono 10px, `--text-dim`. Terminal-style lowercase.
- **Interaction:** Clicking a count badge scrolls to that category. Dismiss hides the bar for the session.

### 4.8 Continuous Warning Behaviors

The calendar screen provides continuous warnings about:

| Warning Type | Detection | Visual | Priority |
|---|---|---|---|
| **Upcoming deadlines** | Deadline within 24h → warn; within 4h → critical | Amber → Red urgency | High |
| **Overdue items** | Deadline passed, task not completed | Red CRITICAL with "OVERDUE by Xh" | Critical |
| **Scheduled meetings** | Meeting starting within 30m | Amber WARNING | Low |
| **Stale recurring work** | Recurring job missed ≥2 runs | Amber WARNING with missed count | Medium |
| **Missed runs** | Scheduled automation did not execute | Red CRITICAL with "MISSED" | High |
| **Time-sensitive blockers** | Blocker with deadline approaching | Red CRITICAL with rank impact | Critical |

### 4.9 Rank Impact Mechanism

**When a time constraint changes priority:**
1. Calendar entry shows the `⚡ Affects rank` line.
2. The affected agent's TaskBoard/Kanban item gets a priority bump (backend logic — not calendar UI concern).
3. On the Team screen, the agent's AttentionRail item may elevate.
4. The calendar entry serves as the **audit trail** for why priority changed.

**When time does NOT affect rank:**
- Entry shows WARNING or SCHEDULED urgency.
- No `⚡ Affects rank` line.
- Purely informational — no priority side effects.

### 4.10 States

#### 4.10.1 Loading State
- Timeline shows 5 skeleton entry cards with shimmer. Warning bar hidden. Filter bar visible but disabled. Status bar shows `⟐ loading…`.

#### 4.10.2 Empty State (No Calendar Data)
- Timeline area shows centered panel:
  ```
  ┌─────────────────────────────────────────────┐
  │                                             │
  │           No calendar data                  │
  │                                             │
  │     No deadlines, meetings, scheduled       │
  │     jobs, or recurring work items are       │
  │     currently registered.                   │
  │                                             │
  └─────────────────────────────────────────────┘
  ```
- Panel uses double-line corner accents (guild amber at 7% at rest).
- Warning bar: hidden (no items to warn about).
- Status bar shows: `⟐ 0 events │ -- overdue · -- approaching · -- missed │ 14:32 UTC`

#### 4.10.3 Unavailable State (Source Not Connected)
- Timeline area shows warning panel:
  ```
  ┌─────────────────────────────────────────────┐
  │  ⚠  Calendar unavailable                   │
  │                                             │
  │     The calendar data source is not         │
  │     connected. Check your connection to     │
  │     the Hermes runtime or admin proxy.      │
  │                                             │
  │     Source: dashboard-api                   │
  │     Status: offline                         │
  │                                             │
  │                [retry connection]           │
  └─────────────────────────────────────────────┘
  ```
- Panel has subtle red-tinted left border. Warning icon in amber.
- Warning bar shows: `⚠ Source offline — calendar data unavailable`
- Status bar shows: `⟐ -- events │ system: OFFLINE`

#### 4.10.4 Degraded State
- Calendar entries with stale data get subtle amber tint overlay.
- Freshness badge shows `stale` or `degraded`.
- Countdown timers may be frozen or show "~" prefix (approximate).
- Warning bar shows amber-tinted with "(stale data)" suffix.
- Status bar shows: `⟐ 12 events (4 stale) │ 3 overdue · 2 approaching │ 14:32 UTC`

---

## 5. Shared Design Tokens (Add to theme.css)

### 5.1 New CSS Custom Properties

```css
/* ── Activity screen tokens ─────────────────────────────────── */
--activity-row-bg: rgba(5, 8, 14, 0.94);
--activity-row-hover-bg: rgba(8, 12, 20, 0.94);
--activity-row-border: rgba(60, 90, 130, 0.12);
--activity-tag-width: 12ch;
--activity-timestamp-width: 12ch;
--activity-source-width: 10ch;
--activity-filter-height: 36px;
--activity-day-header-sticky-top: calc(var(--missionbar-height) + 36px); /* MissionBar + FilterBar */

/* ── Projects screen tokens ─────────────────────────────────── */
--project-card-bg: var(--team-card-bg);
--project-card-hover-bg: var(--team-card-hover-bg);
--project-card-border: var(--team-card-border);
--project-card-hover-border: var(--team-card-hover-border);
--project-grid-gap: 28px;
--project-card-min-height: 200px;

/* ── Chat screen tokens ─────────────────────────────────────── */
--chat-entry-bg: var(--team-card-bg);
--chat-entry-hover-bg: var(--team-card-hover-bg);
--chat-entry-border: var(--team-card-border);
--chat-participant-avatar-size: 24px;
--chat-avatar-gap: 6px;
--chat-tag-width: 12ch;

/* ── Calendar screen tokens ─────────────────────────────────── */
--calendar-entry-bg: var(--team-card-bg);
--calendar-entry-hover-bg: var(--team-card-hover-bg);
--calendar-entry-border: var(--team-card-border);
--calendar-warning-bar-height: 32px;
--calendar-warning-bar-bg-critical: rgba(255, 68, 68, 0.08);
--calendar-warning-bar-bg-amber: rgba(255, 176, 0, 0.06);
--calendar-urgency-critical: var(--crt-red);
--calendar-urgency-high: var(--crt-red);
--calendar-urgency-warning: var(--crt-amber);
--calendar-urgency-scheduled: var(--crt-cyan);
--calendar-tag-width: 12ch;
```

### 5.2 Reused Existing Tokens

All four screens reuse the following from the existing design system:
- **Color:** `--bg-0` through `--bg-3`, `--text-primary` through `--text-dim`, `--agent-*` guild house colors, `--crt-*` phosphor accents, `--term-border`, `--term-divider`, `--guild-amber` through `--guild-amber-ember`
- **Typography:** `--font-mono`, `--font-sans`, `--text-xs` through `--text-xl`
- **Spacing:** `--space-*` scale, `--team-card-*` dimensions, `--team-tab-height`
- **Motion:** `--dur-micro`, `--dur-panel`, `--dur-reveal`, `--ease-out`, `--ease-in-out`
- **Shared components:** FreshnessBadge (Phase A §5.6), status dot, guild-amber corner accents

---

## 6. Typography Hierarchy (Cross-Screen Summary)

| Usage | Size | Font | Weight | Applies To |
|---|---|---|---|---|
| Page section header | 11px (`--text-xs`) | JetBrains Mono | 500, uppercase | Day group headers, section labels |
| Entry header/timestamp | 10-11px | JetBrains Mono | 400 | Activity timestamps, calendar times, chat timestamps |
| Event type tag | 10px | JetBrains Mono | 400 | Activity tags, chat thread types, calendar event types |
| Primary title | 14-15px | Inter | 500-600 | Project titles, decision topics, calendar titles |
| Body/summary | 12-13px | Inter | 400 | Activity summaries, decision outcomes, detail lines |
| Meta/data label | 9-10px | JetBrains Mono | 400 | Counts, durations, source labels, status text |
| Action link | 11px | Inter | 500, lowercase | `╰── open *` links |
| Status bar | 10px | JetBrains Mono | 400 | Bottom status bar text |
| Empty/unavailable title | 14px | Inter | 500 | Empty state panel headers |
| Empty/unavailable body | 12px | Inter | 400 | Empty state panel descriptions |

---

## 7. Responsive Behavior

All four screens follow the existing shell responsive breakpoints:

| Breakpoint | Behavior |
|---|---|
| ≥ 1400px | Full layouts as designed |
| 1200-1399px | ProjectGrid: 1 column. Timelines: reduced padding |
| 900-1199px | All screens: single column. Filter bars stack vertically |
| < 900px | Left rail becomes top bar. Cards/timelines full-width. Reduced font sizes. |

---

## 8. Accessibility Notes

- All status indicators include text labels (not color-only): urgency levels, event types, freshness states.
- Tags are text, not images — fully accessible to screen readers.
- Day group headers and urgency indicators use both color and icon for dual-channel communication.
- Focus order: Filter bar → Timeline entries top-to-bottom → Status bar.
- `prefers-reduced-motion`: All animations disabled. Pulse/blink disabled. Shimmer replaced with static skeleton.
- Minimum contrast: All text meets AA against card backgrounds. Warning bar text meets AA against its background.
- Screen reader: Activity entries have `role="listitem"` within a `role="list"`. Project cards have `role="article"` with descriptive aria-labels. Chat entries read as "Escalation: Auth service timeout — Decision: Roll back to v2.3.1". Calendar entries read urgency + title + time remaining.
- Timeline containers use `role="log"` with `aria-live="polite"` for new entry announcements.

---

## 9. Implementation Notes for Biscuit

### 9.1 File Creation Order (Recommended)

1. `src/components/common/ScreenEmptyState.tsx` — reusable empty/unavailable state component
2. `src/state/activityStore.ts` + `src/types/activity.ts` — activity event types and state
3. `src/state/projectStore.ts` + `src/types/projects.ts` — project portfolio types and state
4. `src/state/chatStore.ts` + `src/types/chat.ts` — decision record types and state
5. `src/state/calendarStore.ts` + `src/types/calendar.ts` — calendar event types and state
6. `src/components/activity/ActivityEntry.tsx` → `ActivityTimeline.tsx` → `src/pages/Activity.tsx`
7. `src/components/projects/ProjectCard.tsx` → `ProjectGrid.tsx` → `src/pages/Projects.tsx`
8. `src/components/chat/DecisionEntry.tsx` → `DecisionTimeline.tsx` → `src/pages/Chat.tsx`
9. `src/components/calendar/CalendarEntry.tsx` → `CalendarTimeline.tsx` → `src/pages/Calendar.tsx`
10. Modify `src/components/shell/ShellLayout.tsx` — add routes, extend `PrimaryView`
11. Add CSS to `src/styles/theme.css` — screen-specific tokens (see §5)

### 9.2 Data Dependencies

- **Activity:** Events stream from dashboard-api/kanban-ws. Filter/sort client-side.
- **Projects:** Project list from projectControlStore/dashboard-api. Task counts derived from boardStore.
- **Chat:** Decision records from a to-be-defined chat log source or extracted from conversation data.
- **Calendar:** Calendar events from a to-be-defined calendar source or cron/schedule introspection.

All four screens consume:
- `shellStore` for connection status + selectedOwner
- `AGENTS[]` from `src/types/agents.ts` for agent metadata, guild colors, avatars
- Existing `FreshnessBadge` component
- Existing `--team-card-*` and `--term-*` design tokens

### 9.3 Empty State Component (Reusable)

All four screens share the same empty/unavailable state panel pattern. Build a single `ScreenEmptyState` component:

```typescript
interface ScreenEmptyStateProps {
  mode: 'empty' | 'unavailable' | 'degraded';
  title: string;             // e.g., "No activity events recorded"
  description: string;       // body text
  sourceName?: string;       // for unavailable mode: "dashboard-api"
  sourceStatus?: string;     // for unavailable mode: "offline"
  actionLabel?: string;      // e.g., "refresh" or "retry connection"
  onAction?: () => void;
}
```

The component renders:
- **Empty mode:** Centered panel, double-line corners (guild amber at 7%), title + description, optional action button.
- **Unavailable mode:** Same panel with red-tinted left border, warning icon (⚠) in amber, source info, retry action.
- **Degraded mode:** Amber-tinted variant with count of stale items.

### 9.4 Performance Considerations

- All four screens are DOM-based (no PixiJS). Standard React rendering.
- Timeline virtualization: For Activity and Calendar screens with potentially many events, use a virtualized list library or `content-visibility: auto` CSS.
- Memoize entry components (ActivityEntry, DecisionEntry, CalendarEntry, ProjectCard).
- Filter state lives in URL search params for shareable/bookmarkable filtered views.
- StatusBar and WarningBar use `position: sticky`.
- Follow existing motion rules: only animate opacity and transform.

---

## 10. Visual Precedents & References

**Tone references for implementation:**

- **Datadog Event Stream** — chronological log density, severity color coding, filter bar UX
- **Bloomberg Terminal** — monospace data alignment, phosphor-on-black, columnar layout
- **Linear project list** — clean project cards, status labels, task count summaries
- **Vercel deployment overview** — card grid with status indicators and timestamps
- **Jira roadmaps / Notion timelines** — calendar timeline with urgency color coding
- **Military comms dispatch board** — escalation framing, decision records, action item checklists
- **`crontab -l` / systemd timers** — scheduled job monitoring, missed-run detection
- **Persona 5 calendar UI** — date-grouped timeline, subtle day headers, JRPG calendar framing (restrained)

**Avoid looking like:**
- Google Calendar / Outlook (too consumer, too colorful, too friendly)
- Generic chat app (Slack, Discord, Teams)
- Trello boards (too task-card-focused, not timeline/portfolio)
- Todoist / task manager (not a personal to-do list)
- Fantasy calendar / RPG quest log (no ornate timeline decorations)

---

*End of Phase F visual design spec. Ready for Biscuit implementation review.*
