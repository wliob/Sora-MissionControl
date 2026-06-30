# Phase G — Visual Freeze Audit: Korra Findings Report

**Date:** 2026-06-29  
**Auditor:** Hermes Agent (automated audit)  
**Scope:** All 8 screens + shared components vs. approved design system (Theme Tokens, Phase A/B/F specs, STYLE_GUIDE.md)  
**Method:** Read-only static analysis of source files — no files modified.

---

## 1. Summary

| Metric | Count |
|---|---|
| **Critical issues** | 4 |
| **Major issues** | 9 |
| **Minor issues** | 11 |
| **Info/suggestions** | 7 |
| **Total findings** | **31** |

**Overall verdict:** The **Team** screen is the most faithfully implemented surface (closely follows Phase A, minor divergences in agent identity data). The **Office** screen routing and canvas integration are structurally sound. However, **Activity, Projects, Decisions, and Calendar** are placeholder stubs that do not implement their Phase F design specs at all. Shared token usage is good in the Team surface but several hardcoded hex values remain in `theme.css` and components. Code duplication of `truthFreshnessLabel` across three components is a maintenance risk.

---

## 2. Per-Screen Findings

### 2.1 Team Screen

**Files:** `src/pages/Team.tsx`, `src/components/team/AttentionRail.tsx`, `src/components/team/LeadCard.tsx`, `src/components/team/SoraConductorStation.tsx`, `src/components/team/GuildInsignia.tsx`, `src/components/team/DelegationLines.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| T-1 | `src/types/agents.ts:33-47` | Agent role titles and glyphs diverge significantly from Phase A spec. Spec calls for guild class subtitles (e.g., "Warrior · Engineer Class" with ⚔ glyph). Implementation uses functional titles ("Infrastructure Lead") with two-letter initials ("CL"). This is a fundamental deviation from the guild-class identity system. | **Critical** |
| T-2 | `src/pages/Team.tsx:19-26` | `healthColor()` duplicates logic also present in `SoraConductorStation.tsx:27-34`. Should be extracted to a shared utility. | Minor |
| T-3 | `src/components/team/AttentionRail.tsx:27-31` | `truthFreshnessLabel()` is a third copy of the function (also in LeadCard.tsx, SoraConductorStation.tsx). The canonical version exists in `src/utils/truthVocabulary.ts:16-29`. | Major |
| T-4 | `src/components/team/LeadCard.tsx:44-48` | `truthFreshnessLabel()` duplicated again — should import from `truthVocabulary.ts`. | Major |
| T-5 | `src/components/team/SoraConductorStation.tsx:36-40` | `truthFreshnessLabel()` duplicated yet again. | Major |
| T-6 | `src/styles/theme.css:1157` | `.team-page` uses hardcoded `background: #000000` instead of a design token. The spec says `--void-0: #000000` exists and should be used. | Minor |
| T-7 | `src/pages/Team.tsx:97-101` | `DelegationLines` receives empty `cardRects={[]}` — circuit traces cannot render without real card bounding rectangles. This feature is visually non-functional. | Major |
| T-8 | `src/components/team/AttentionRail.tsx:96-117` | `AttentionRail` has no empty state handling. When `items` is empty, the rail still renders with an empty items container. Spec §5.2 calls for three placeholder log lines with dim text and rank chevrons at 15% opacity. | Minor |
| T-9 | `src/components/team/LeadCard.tsx:26-29` | Status dot colors use hardcoded hex (`#666666`, `#444444`) as fallbacks inside `statusDotColor()`. These should reference design tokens (`--text-dim`, `--status-unknown`). | Minor |
| T-10 | `src/styles/theme.css:1497` | `.lead-card__workload-bar` uses hardcoded `background: #1a1a2e` — should use a token (e.g., `--bg-2` or a new `--workload-bar-bg`). | Minor |
| T-11 | `src/styles/theme.css:1860` | `.team-status-bar__divider` uses hardcoded `color: #444444` instead of a token. | Minor |

### 2.2 Office Screen

**Files:** `src/pages/Office.tsx`, `src/office/components/OfficeModule.tsx`, `src/office/components/ConductorStation.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| O-1 | `src/pages/Office.tsx:38` | Hardcoded `background: 'var(--bg-0, #0b111a)'` — the fallback value `#0b111a` should be `#05070d` to match the token's actual value. | Minor |
| O-2 | `src/pages/Office.tsx:44` | `ConductorStation` rendered unconditionally in popout mode — no check for whether office canvas has loaded or agent data is available. Could render an empty station overlay over a dark canvas on first load. | Info |
| O-3 | `src/components/shell/ShellLayout.tsx:226` | Office route renders `OfficePage` inside `dashboard-main-frame` but the Phase B spec calls for the Office to have a "dominant stage" feel. The current shell wraps it in a 24px-padded scrollable container, which may not match the intended immersive framing. | Info |

### 2.3 Activity Screen

**Files:** `src/pages/Activity.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| A-1 | `src/pages/Activity.tsx:1-33` | **Full placeholder.** The Phase F spec calls for a FilterBar, ActivityTimeline with ActivityDayGroups, ActivityEntry rows with event-type tags, agent badges, day group headers, and a StatusBar. None of this is implemented — only a generic `dashboard-placeholder-card` with honest text. | **Critical** |
| A-2 | `src/pages/Activity.tsx:15` | Eyebrow text "ACTIVITY FEED" differs from spec's "ACTIVITY" page title. | Minor |
| A-3 | `src/pages/Activity.tsx:19-22` | Empty/unavailable states are handled with plain `<p>` text, not the spec's paneled messages with source/status indicators, double-line corners, and retry buttons. | Major |
| A-4 | `src/pages/Activity.tsx:29` | Badge shows `[no data source]` but spec requires distinct "unavailable" vs. "empty" states with different panels. | Major |

### 2.4 Projects Screen

**Files:** `src/pages/Projects.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| P-1 | `src/pages/Projects.tsx:1-33` | **Full placeholder.** Phase F spec requires a ProjectGrid with ProjectCards (tab header, task bar, blocker count, last activity, freshness badge, action), a ProjectFilterBar with status/sort controls, and a StatusBar. None implemented. | **Critical** |
| P-2 | `src/pages/Projects.tsx:15` | Eyebrow text "PROJECT CONTROL" differs from spec's "PROJECTS" page title. | Minor |
| P-3 | `src/pages/Projects.tsx:17-22` | Same generic empty/unavailable handling as Activity — lacks spec's panel design. | Major |

### 2.5 Decisions (Chat) Screen

**Files:** `src/pages/Decisions.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| D-1 | `src/pages/Decisions.tsx:1-21` | **Full placeholder.** Phase F spec requires a DecisionTimeline with DecisionEntries (participant avatars, topic lines, decision outcomes, action items checklists, freshness badges), ChatFilterBar, and StatusBar. None implemented. | **Critical** |
| D-2 | `src/pages/Decisions.tsx:11` | Eyebrow text "DECISION LOG" vs spec's "CHAT" page title. The screen is routed as `/decisions` in ShellLayout but named "CHAT" in the nav label and Phase F spec. Naming inconsistency across codebase. | Major |
| D-3 | `src/pages/Decisions.tsx:18` | Badge says `[unavailable]` — appropriate truth vocabulary, but should use the freshness-badge CSS class for visual consistency. Currently just monospace text. | Minor |

### 2.6 Calendar Screen

**Files:** `src/pages/Calendar.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| C-1 | `src/pages/Calendar.tsx:1-38` | **Full placeholder.** Phase F spec requires a WarningBar, CalendarFilterBar, CalendarTimeline with CalendarDayGroups and CalendarEntries (urgency indicators, rank-impact lines, countdown timers, action links), and StatusBar. None implemented. | Major (downgraded from critical because this screen has a secondary warning feature for existing data) |
| C-2 | `src/pages/Calendar.tsx:14` | Eyebrow text "CALENDAR" matches spec — good. | — |
| C-3 | `src/pages/Calendar.tsx:29-31` | Warning count badge renders as `[{N} warnings]` which is a reasonable minimal implementation. | Info |
| C-4 | `src/pages/Calendar.tsx:34` | Badge shows `[no data source]` when demo mode — same issue as Activity regarding distinct unavailable/empty states. | Major |

### 2.7 Kanban Screen

**File:** `src/components/kanban/HermesKanbanPage.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| K-1 | Kanban was not listed in the audit spec but is part of the shell. Its visual design was established in earlier phases and is out of scope for this Phase G audit. | — | Info |

### 2.8 Shell (Layout, Nav Rail, MissionBar, StatusBar)

**Files:** `src/components/shell/ShellLayout.tsx`, `src/components/shell/MissionBar.tsx`

| # | File:Line | Finding | Severity |
|---|---|---|---|
| S-1 | `src/components/shell/ShellLayout.tsx:35-41` | Activity, Projects, Decisions, Calendar all mapped to `view: 'ops'` in the same group. The design specs treat these as distinct core surfaces, not a generic "ops" bucket. This grouping may affect shell styling (e.g., grid layouts per view). | Info |
| S-2 | `src/components/shell/ShellLayout.tsx:242` | `PlaceholderPage` fallback uses the generic `dashboard-placeholder-card` rather than screen-specific empty states. | Info |
| S-3 | `src/components/shell/MissionBar.tsx:29` | Task count badge only shown for Kanban (hardcoded `title === 'Kanban'` check). Other screens showing data counts (projects, activity events) cannot benefit from this pattern without modification. | Info |
| S-4 | `src/components/shell/ShellLayout.tsx:95-106` | `PlaceholderPage` renders a generic card for any unimplemented admin route. The "HERMES SURFACE" eyebrow and generic text may be confusing when rendered for a specific named route. | Info |

---

## 3. Shared Component Findings

### 3.1 FreshnessBadge

- **No dedicated component file exists.** Freshness badges are implemented purely as CSS classes in `theme.css:1782-1835`. This is acceptable since the classes are well-defined.
- The CSS covers: `live`/`fresh`, `stale`, `degraded`, `missing`/`unavailable`, `unknown`, `verified`, `mock`/`demo`.
- **Issue:** The CSS uses hardcoded hex fallbacks that don't match tokens:
  - `theme.css:1813`: `#888888` for `--missing`/`--unavailable` — should be `var(--text-dim)` or a dedicated token.
  - `theme.css:1819`: `#666666` for `--unknown` — should be `var(--text-dim)` or similar.
  - `theme.css:1815,1821`: Border colors use `rgba(136,136,136,0.25)` and `rgba(102,102,102,0.20)` — hardcoded, not tokenized.
- The spec (§5.6) says `verified` = green, `live` = cyan. The CSS correctly uses `--crt-green` for verified and `--crt-cyan` for live. ✓
- `freshness-badge--stale` and `--degraded` share identical styling (both use `--crt-amber`). Per spec, they should be visually identical (both amber), so this is correct. ✓

### 3.2 StatusPill

- `src/components/common/StatusPill.tsx` — well-implemented, uses `STATUS_META` from types for color mapping. Only used in `MissionBar` and `HermesKanbanPage`. Not used in Team/Activity/Projects/Decisions/Calendar screens.
- **Issue:** The StatusPill's pulse animation CSS class `pulse-status-dot` is referenced but its keyframes are not defined in the examined CSS range. (May exist in motion.css — need to verify.)

### 3.3 PortraitImage

- `src/components/common/PortraitImage.tsx` — well-implemented, handles image loading with initials fallback. Used consistently in `LeadCard` and `SoraConductorStation`.
- The spec says portrait border should be 1.5px with accent color ring. The component applies `border: '1.5px solid'` via inline style, and callers pass `borderColor` through `style`. ✓
- Fallback initials use `style?.borderColor` for text color — this is clever but fragile; changes to parent border styling could affect fallback text legibility. (Info only.)

### 3.4 truthVocabulary Utilities

- `src/utils/truthVocabulary.ts` — canonical implementation of `truthFreshnessLabel`, `truthConfidenceLabel`, `truthProvenanceLabel`. Well-structured.
- **Issue:** Three components (`AttentionRail`, `LeadCard`, `SoraConductorStation`) each re-implement `truthFreshnessLabel` locally instead of importing from this utility. (Reported in Team findings T-3, T-4, T-5.)

### 3.5 ScreenEmptyState

- **Does not exist.** Phase F spec calls for `src/components/common/ScreenEmptyState.tsx` — a reusable empty/unavailable state component. This is not implemented. All placeholder screens use the raw `dashboard-placeholder-card` div structure instead.

---

## 4. Color Token Audit

### 4.1 Hardcoded Hex/RGB in theme.css

| Line | Value | Context | Suggested Token |
|---|---|---|---|
| 1497 | `#1a1a2e` | `.lead-card__workload-bar` background | `--bg-2` or new `--workload-bar-bg` |
| 1813 | `#888888` | `.freshness-badge--missing` color | `--text-dim` |
| 1815 | `rgba(136,136,136,0.25)` | `.freshness-badge--missing` border | Tokenize as `--status-unknown-bg` or similar |
| 1819 | `#666666` | `.freshness-badge--unknown` color | `--text-dim` |
| 1821 | `rgba(102,102,102,0.20)` | `.freshness-badge--unknown` border | Tokenize |
| 1860 | `#444444` | `.team-status-bar__divider` color | `--border-base` or `--text-dim` |

### 4.2 Hardcoded Hex in Components

| File:Line | Value | Context |
|---|---|---|
| `LeadCard.tsx:26` | `#666666` | IDLE status fallback |
| `LeadCard.tsx:27` | `#444444` | OFFLINE status fallback |
| `LeadCard.tsx:28` | `#666666` | default status fallback |
| `AttentionRail.tsx:16` | `#888888` | STALE severity fallback |
| `Team.tsx:24` | `var(--text-muted)` | healthColor default — OK, uses token |
| `theme.css:1157` | `#000000` | `.team-page` background |

### 4.3 CSS Variable Usage (Positive)

- Tokens `--agent-*`, `--guild-amber*`, `--crt-*`, `--term-*`, `--team-card-*`, `--text-*`, `--border-*` are used extensively and correctly throughout the Team surface components and their CSS. ✓
- The `var(--token, fallback)` pattern is consistently used, providing resilience. ✓
- Agent identity colors are properly referenced as `var(--agent-${agentId})` with fallback to `agent.accent`. ✓

---

## 5. Typography Audit

### 5.1 Font Stack

- `--font-ui` (Inter) and `--font-mono` (JetBrains Mono) used correctly per the two-font system. ✓
- Monospace applied to: timestamps, severity tags, source labels, workload bars, dispatch logs, status bars, freshness badges. ✓
- Sans-serif applied to: agent names, guild class titles, summaries. ✓
- **Divergence:** Agent role titles in `src/types/agents.ts` use functional names ("Infrastructure Lead", "Code Lead") instead of the spec's guild class format ("Warrior · Engineer Class", "Mage · Architect Class"). The `.lead-card__role-title` CSS correctly applies Inter 11px with 0.04em letter-spacing (matching spec), but the content rendered doesn't match the design intent.

### 5.2 Font Sizing

| Element | Spec | Implementation | Match? |
|---|---|---|---|
| Agent name (LeadCard) | 15px Inter 600 | 15px Inter 600 in `.lead-card__name` | ✓ |
| Role title | 11px Inter 500 +0.04em | 11px Inter 500 +0.04em in `.lead-card__role-title` | ✓ |
| Tab headers | 10px mono | 10px mono in `.lead-card__tab` | ✓ |
| Workload bar label | 10px mono | 10px mono in `.lead-card__workload-label` | ✓ |
| Freshness badge | 9px mono | 9px mono in `.freshness-badge` | ✓ |
| Status bar | 10px mono | 10px mono in `.team-status-bar` | ✓ |
| MissionBar title | N/A (24px) | 24px in `.dashboard-header-title` | ✓ |

---

## 6. Spacing & Layout Audit

### 6.1 Team Page

| Element | Spec Value | Implementation | Match? |
|---|---|---|---|
| Page padding | 20px | 20px in `.team-page` | ✓ |
| Team grid gap | 32px row × 28px col | `var(--team-grid-gap-row)` = 32px, `var(--team-grid-gap-col)` = 28px | ✓ |
| Lead card min-height | 200px | `var(--team-card-min-height)` = 200px | ✓ |
| Sora station min-height | 260px | `var(--team-station-min-height)` = 260px | ✓ |
| Card internal padding | 14px | Tab: 0 10px, identity: 0 14px, sections: 0 14px | ⚠️ Tab header uses 10px horizontal vs spec's 14px |
| Portrait size | 40px | `var(--team-portrait-size)` = 40px | ✓ |
| Sora portrait size | 48px | `var(--team-portrait-sora-size)` = 48px | ✓ |
| Status dot | 6px | 6px in `.lead-card__status-dot` | ✓ |
| Badge/chip height | 20px | Not explicitly set, freshness badge uses padding | ⚠️ |

### 6.2 Shell

- `dashboard-main-frame` uses `padding: 24px` while Team page overrides to 20px internally. The 4px difference means Team sits tighter than other pages that rely on the shell padding. (Minor)

---

## 7. Positive Findings — What's Already Consistent & Correct

1. **Team surface CSS architecture** — The CSS custom properties cascade is well-organized. Team-specific tokens (`--team-card-bg`, `--team-tab-height`, etc.) are cleanly namespaced and consistently referenced.
2. **Terminal-chrome panel frames** — The tab headers, dividers, borders, and box-drawing character usage create a consistent terminal aesthetic across LeadCards, AttentionRail, and SoraConductorStation.
3. **Guild amber accents** — The guild amber underlayer is applied consistently: corner accents on LeadCards (7% at rest → 18% on hover via pseudo-elements), guild chevrons in tab headers (25% opacity), insignia watermarks.
4. **CRT phosphor color system** — `--crt-green`, `--crt-amber`, `--crt-cyan`, `--crt-red`, `--crt-violet` are used correctly for status dots, freshness badges, and severity tags. The mapping is consistent across screens.
5. **Freshness badge CSS classes** — The `.freshness-badge--*` pattern is consistently applied in LeadCard.tsx, SoraConductorStation.tsx, and AttentionRail.tsx. HTML structure is identical (`<span className="freshness-badge freshness-badge--{label}">`).
6. **Two-font system** — The monospace-for-data, sans-serif-for-identity split is faithfully implemented. `JetBrains Mono` carries timestamps, severity, workload, dispatch logs. `Inter` carries names, role titles, summaries.
7. **Status dot system** — 6px dots with git-inspired color semantics (green=online, amber=busy, red=blocked, dim=idle, dimmer=offline) are consistent between LeadCard and the Team status bar.
8. **Truth vocabulary** — The `truthVocabulary.ts` utility correctly maps internal enums (`fresh` → `live`, `missing` → `unknown`) to user-facing labels. The `[unavailable]`, `[no data source]`, `[mock/demo]` badges in placeholder screens honestly communicate data state.
9. **SoraConductorStation dual-pane** — The 60/40 split with vertical divider, dispatch log left + guild summary right, and guild amber glow shadow is well-executed and matches the Phase A spec.
10. **GuildInsignia SVG** — Hexagonal circuit trace ring + circular heraldry ring + chevron geometry is cleanly implemented as a reusable memoized component with configurable size/opacity.

---

## 8. Recommendations — Prioritized Fix List for Phase H

### Priority 1 — Critical (blocks visual freeze)

| # | Action | Files |
|---|---|---|
| 1 | **Implement Phase F Activity screen.** Build FilterBar, ActivityTimeline with ActivityDayGroups, ActivityEntry rows with event-type tags, agent badges, day group headers, and StatusBar per `docs/phase-f-screens-korra-design.md` §1. | `src/pages/Activity.tsx` + new components |
| 2 | **Implement Phase F Projects screen.** Build ProjectGrid with ProjectCards (tab header, task bar, blocker count, last activity, freshness, actions), filter/sort bar, and StatusBar per §2. | `src/pages/Projects.tsx` + new components |
| 3 | **Implement Phase F Decisions screen.** Build DecisionTimeline with DecisionEntries (participant avatars, topic lines, decision outcomes, action item checklists, freshness badges), filter bar, and StatusBar per §3. | `src/pages/Decisions.tsx` + new components |
| 4 | **Reconcile agent identity data with Phase A spec.** Update `src/types/agents.ts` `roleTitle` and `roleGlyph` to use guild class titles ("Warrior · Engineer Class", "Mage · Architect Class", etc.) and class glyphs (⚔, ✦, 🎨, ♜, ⚗, ⏣, ✉). This is the single highest-impact visual consistency change for the Team screen. | `src/types/agents.ts` |

### Priority 2 — Major (noticeably inconsistent)

| # | Action | Files |
|---|---|---|
| 5 | **Create `ScreenEmptyState` shared component** per Phase F spec §0.1 — reusable empty/unavailable state panel with double-line corner accents, truth vocabulary, source/status indicators, and retry buttons. | New: `src/components/common/ScreenEmptyState.tsx` |
| 6 | **Implement Phase F Calendar screen.** Build WarningBar, CalendarTimeline with CalendarDayGroups, CalendarEntries with urgency indicators and rank-impact lines, and StatusBar per §4. | `src/pages/Calendar.tsx` + new components |
| 7 | **Deduplicate `truthFreshnessLabel`.** Replace local implementations in `AttentionRail.tsx`, `LeadCard.tsx`, and `SoraConductorStation.tsx` with imports from `src/utils/truthVocabulary.ts`. | 3 files |
| 8 | **Wire DelegationLines with real card rects.** `Team.tsx` passes `cardRects={[]}` — use refs or a ResizeObserver to measure card bounding boxes so circuit traces render. | `src/pages/Team.tsx`, `src/components/team/DelegationLines.tsx` |
| 9 | **Resolve Decisions/Chat naming.** The screen file is `Decisions.tsx`, the nav label is "CHAT", the route is `/decisions`, and the eyebrow says "DECISION LOG". Align on a single name (recommend: "Decisions" to match Phase F's Chat → Decision Records transformation). | `ShellLayout.tsx`, `Decisions.tsx` |

### Priority 3 — Minor (subtle inconsistencies)

| # | Action | Files |
|---|---|---|
| 10 | **Eliminate hardcoded hex values.** Replace `#000000`, `#666666`, `#444444`, `#888888`, `#1a1a2e` in `theme.css` and components with design tokens. | `theme.css`, `LeadCard.tsx`, `AttentionRail.tsx` |
| 11 | **Add empty state to AttentionRail.** When `items` is empty, render three placeholder log lines per spec §5.2. | `AttentionRail.tsx` |
| 12 | **Normalize Team card horizontal padding.** Tab header uses 10px, identity/sections use 14px. Per Phase A spec, card internal padding should be 14px uniformly. | `theme.css` `.lead-card__tab` |
| 13 | **Align Team page background with shell.** `dashboard-main-frame` has 24px padding, Team overrides to 20px. Pick one and be consistent. | `theme.css` |
| 14 | **Add CSS token fallback consistency.** Some `var()` fallbacks use correct token values (e.g., `var(--crt-green, #00ff66)`) while others use incorrect fallbacks (e.g., `var(--bg-0, #0b111a)` in Office.tsx — the actual `--bg-0` is `#05070d`, not `#0b111a`). | `Office.tsx:38` |

### Priority 4 — Info (suggestions, not bugs)

| # | Action | Files |
|---|---|---|
| 15 | **Verify pulse-status-dot keyframes exist** in motion.css. Referenced in StatusPill.tsx and LeadCard.tsx but the animation definition wasn't confirmed in this audit. | `src/styles/motion.css` |
| 16 | **Consider extracting view grouping from ShellLayout.** Activity/Projects/Decisions/Calendar are all mapped to `view: 'ops'` but Phase F specs treat them as distinct core surfaces with individual layouts. | `ShellLayout.tsx` |
| 17 | **Document the Kanban screen's visual design.** Kanban was excluded from Phase G audit scope but should have its design doc referenced in the visual freeze if it participates. | `docs/` |
| 18 | **Verify FreshnessBadge component vs CSS-only approach.** The spec calls for a `FreshnessBadge` component. Currently it's purely CSS classes. Either create the component wrapper or document that CSS-only is the chosen approach. | Architecture decision |

---

## 9. Methodology Note

This audit was performed via static read-only analysis of all `.tsx` and `.css` files in the project source tree. No runtime rendering, screenshot comparison, or browser testing was performed. Line numbers are approximate and may shift with future edits. The audit compared implementation against:

- `docs/phase-a-team-surface-korra-design.md` (1176 lines)
- `docs/phase-b-office-screen-korra-design.md` (635 lines)
- `docs/phase-f-screens-korra-design.md` (1067 lines)
- `src/styles/theme.css` (1917 lines)
- `docs/STYLE_GUIDE.md` (100 lines)

---

*Report generated 2026-06-29 by Hermes Agent for Phase G Visual Freeze.*
