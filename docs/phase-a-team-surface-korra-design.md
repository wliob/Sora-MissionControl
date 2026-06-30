# Sora-MissionControl — Team Command Surface Visual Design Spec

**Author:** Korra (Creative & Media Lead)  
**Phase:** Phase A — Visual Design Contract  
**Date:** 2026-06-29  
**Status:** Design spec — for Biscuit implementation  
**Context:** Rebuild Team as the default command surface that answers "Where should my attention go next?" within 5 seconds.  
**Visual Direction:** Three-way blend — Premium startup office (Vercel/Linear spatial foundation) × Anime guild HQ (Persona 5-style JRPG status screen personality) × VSCode Dark + cyberpunk-lite (terminal density, CRT glow, circuit traces).

---

## 0. Codebase Reconnaissance

### Files that exist today
| File | Role |
|---|---|
| `src/app/App.tsx` | Root — boots backbone, renders `ShellLayout` |
| `src/components/shell/ShellLayout.tsx` | Shell with left nav rail (232px), stage, floating chat |
| `src/components/shell/MissionBar.tsx` | Page header — title, status pill, freshness label |
| `src/styles/theme.css` | CSS custom properties (dark tokens, shell chrome, dashboard classes) |
| `src/styles/motion.css` | Animation keyframes, utility classes, reduced-motion |
| `src/types/index.ts` | Type barrel — re-exports from agent, provenance, board, connection modules |
| `src/types/agents.ts` | `AgentId` (5 leads), `AgentMeta`, `AGENTS[]`, `AgentActivity`, `ACTIVITY_META` |
| `src/types/provenance.ts` | `DataSource`, `Freshness`, `Confidence`, `Provenance`, `Tracked<T>` |
| `src/types/board.ts` | `KanbanStatus` (8 values), `KanbanTaskCard`, board snapshot types |
| `src/state/shellStore.ts` | Shell state: view (`PrimaryView`), selectedOwner, selectedAgent, connection |
| `src/state/boardStore.ts` | Board snapshot store (exists, referenced by `MissionBar`) |
| `src/state/projectControlStore.ts` | Project control data (Phase 7a read surface) |

### Files that DO NOT exist (need creation)
| File | Purpose |
|---|---|
| `src/pages/Team.tsx` | Team command surface page component |
| `src/components/team/AttentionRail.tsx` | Ranked attention items strip |
| `src/components/team/LeadCard.tsx` | Individual department lead card |
| `src/components/team/SoraConductorStation.tsx` | Sora central terminal station |
| `src/components/team/DelegationLines.tsx` | Circuit-trace connection overlay (SVG layer) |
| `src/components/team/FreshnessBadge.tsx` | Per-datum freshness label |
| `src/state/teamStore.ts` | Team-specific derived state (attention items, workload scores) |
| `src/types/team.ts` | Team-specific types (AttentionItem, LeadSnapshot, WorkloadScore) |

### Files that need modification
| File | Change |
|---|---|
| `src/components/shell/ShellLayout.tsx` | Add `/team` route as default (replace `/kanban` default); add `'team'` to `PrimaryView`; wire Team page render |
| `src/app/App.tsx` | No changes needed — renders `ShellLayout` unchanged |
| `src/types/agents.ts` | Extend `AgentId` union to include `'sora'` and `'rain'`; add them to `AGENTS[]`; add `AgentStatus` type; add agent terminal status types |
| `src/types/index.ts` | Extend `PrimaryView` to include `'team'`; re-export new team types |
| `src/styles/theme.css` | Add team-specific CSS classes; add guild-amber + CRT-glow color tokens; add terminal-chrome + guild-chevron layout styles |
| `src/state/shellStore.ts` | No type changes needed if `PrimaryView` extended in barrel — shellStore uses `PrimaryView` from barrel |

---

## 1. The Blend Concept

**Core idea:** What if a JRPG guild menu was designed by a premium SaaS startup's design team, running in a terminal emulator at 3AM?

Each of the three influences pulls its weight:

| Direction | What it contributes | How it manifests |
|---|---|---|
| 🏢 **Premium startup office** (Vercel / Linear) | Spatial foundation, clean layout, confident negative space, the "desk" feeling | Grid proportions, Inter display type for identity, refined card chrome, subtle depth shadows |
| 🎮 **Anime guild HQ** (Persona 5 / JRPG status screen) | Personality, mystique, guild identity, class framing, emotional temperature | Class subtitles per agent, rank chevrons in attention rail, guild heraldry in insignia, dual-pane guild master station |
| 💻 **VSCode dark × cyberpunk-lite** | Data density, terminal elements, CRT glow, circuit traces, hacker precision | Monospace data layer, `tail -f` log format, htop workload bars, circuit-board delegation lines, phosphor accent colors |

**The result feels like:** a premium dark startup office dashboard that happens to be run by an anime guild — not a cosplay terminal, not a fantasy tavern. The guild cues are restrained, refined, and sit *on top of* a clean operational foundation.

### The Forbidden Line

Despite the anime guild infusion, these remain **FORBIDDEN**:
- ❌ Fantasy tavern (no wooden tables, candles, potion bottles, rustic interiors)
- ❌ Ornate RPG frames (no gold filigree, elaborate character sheet borders)
- ❌ Cartoon mascots / chibi chaos
- ❌ XP bars / leveling progress bars
- ❌ Emoji chatter / decorative speech bubbles

The guild cues stay **restrained and premium** — think Persona 5 UI meets Linear dashboard, not World of Warcraft UI.

---

## 2. Layout Architecture

### 2.1 Component Hierarchy

```
ShellLayout (existing shell chrome)
└── main.dashboard-main-frame
    └── TeamPage (new src/pages/Team.tsx)
        ├── GuildInsignia (subtle background watermark emblem)
        ├── AttentionRail          ← ranked top 3 items, log-style strip with guild rank framing
        ├── TeamGrid               ← CSS Grid, 2-row × 4-column dense layout
        │   ├── LeadCard (Cloud)
        │   ├── LeadCard (Biscuit)
        │   ├── LeadCard (Korra)
        │   ├── LeadCard (Lelouch)
        │   ├── LeadCard (Tifa)
        │   ├── LeadCard (Rain)
        │   └── SoraConductorStation  ← spans center two columns, dual-pane guild master desk
        └── DelegationLines (SVG overlay — circuit traces with guild-house colors)
```

### 2.2 Shell Integration

The Team page renders inside the existing `dashboard-main-frame` (flex: 1, padding: 24px, overflow: auto). The left nav rail (232px) and MissionBar header remain unchanged from the existing shell.

**Route:** `/team` → `ShellLayout` → `MissionBar(title="TEAM")` → `main` → `TeamPage`

**Default:** `/` and unrecognized routes redirect to `/team` (change from current `/kanban` default in `normalizeRoutePath`).

### 2.3 Zone Map

```
┌──────────────────────────────────────────────────────────────────┐
│  MissionBar: "TEAM" │ [CONN: ● ACTIVE] │ [freshness: live]     │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  ATTENTION LOG — tail -f /dev/attention                      │ │
│ │  «❶» [CRITICAL] 14:32:17.842  BISCUIT  waiting on decision  │ │
│ │  «❷» [WARNING ] 14:28:01.104  TIFA     agent blocked 2      │ │
│ │  «❸» [INFO    ] 13:55:42.339  KORRA    review queue aged    │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  TEAM GRID (2 rows × 4 columns, 32px gap)                   │ │
│ │                                                              │ │
│ │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │ │
│ │  │ ☁ Cloud│ │ ✦Biscuit│ │ 🎨Korra│ │ ♜Lelouch│   Row 1     │ │
│ │  │ Warrior│ │   Mage │ │ Artist │ │Strategist│             │ │
│ │  │▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓│              │ │
│ │  │ MOD(18)│ │ LIT(7) │ │ HYY(28)│ │ MOD(15)│               │ │
│ │  └────────┘ └────────┘ └────────┘ └────────┘               │ │
│ │                                                              │ │
│ │  ┌────────┐                ┌────────┐ ┌────────┐            │ │
│ │  │ ⚗ Tifa│  ┌──────────┐ │ ✉ Rain│ │ (empty)│            │ │
│ │  │Merchant│  │  SORA    │ │Messenger│ │        │   Row 2    │ │
│ │  │▓▓▓▓▓▓▓▓│  │GUILD MASTER│▓▓▓▓▓▓▓▓│ │        │            │ │
│ │  │ MOD(11)│  │          │ │ IDLE(0)│ │        │            │ │
│ │  └────────┘  │ [log]    │ └────────┘ └────────┘            │ │
│ │              │ [insignia]│                                    │ │
│ │              │ health: ▓▓│                                    │ │
│ │              └──────────┘                                    │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  [Circuit traces rendered as sparse SVG overlay — guild house colors]│
│  ╭────────────────────────────────────────────────────────────╮  │
│  │ ⟐ 7/7 agents │ 3 delegations │ system: HEALTHY │ 14:32 UTC │  │
│  ╰────────────────────────────────────────────────────────────╯  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.4 Spacing & Sizing (Data-Dense, Guild-Refined)

| Element | Value |
|---|---|
| Page padding | 20px (inherited from `dashboard-main-frame`) |
| Attention rail margin-bottom | 16px |
| Team grid gap | 32px row × 28px column |
| Lead card width | minmax(260px, 1fr) per grid column |
| Lead card min-height | 200px |
| Sora station width | spans 2 columns + 1 gap (calc(2 * 260px + 28px) min; flexes with grid) |
| Sora station min-height | 260px |
| Card internal padding | 14px |
| Portrait size | 40×40px (circular, border-radius: 50%) |
| Sprite/class-icon size | 20×20px (alongside portrait) |
| Status dot | 6×6px |
| Badge/chip height | 20px |
| Font sizes | `--text-xs` (11px) for meta/mono data, `--text-sm` (12px) for body mono, `--text-md` (13px) for class subtitles, `--text-lg` (15px) for agent name, `--text-xl` (18px) for section headers |
| Terminal border | 1px solid rgba(96, 120, 150, 0.18) |
| Tab chrome height | 28px |
| Double-line corner accent | 6×6px corner marks |

---

## 3. Color Palette — Guild Amber × CRT Glow

### 3.1 Design Tokens (add to theme.css)

```css
:root {
  /* ── Guild-amber warm underlayer ─────────────────────────── */
  /* Prevents the palette from feeling cold/stark. */
  /* Amber sits beneath the surface, warming the dark base. */
  --guild-amber: #d4943a;                /* warm guild gold */
  --guild-amber-dim: rgba(212, 148, 58, 0.12);
  --guild-amber-glow: rgba(212, 148, 58, 0.05);
  --guild-amber-ember: rgba(212, 148, 58, 0.20);

  /* ── CRT monitor glow palette ──────────────────────────── */
  --crt-amber: #ffb000;                  /* amber phosphor glow */
  --crt-amber-dim: rgba(255, 176, 0, 0.15);
  --crt-amber-glow: rgba(255, 176, 0, 0.06);
  --crt-green: #00ff41;                 /* terminal green (classic P1) */
  --crt-green-dim: rgba(0, 255, 65, 0.15);
  --crt-green-glow: rgba(0, 255, 65, 0.06);
  --crt-cyan: #00d4ff;                  /* cyan data-stream */
  --crt-cyan-dim: rgba(0, 212, 255, 0.15);
  --crt-cyan-glow: rgba(0, 212, 255, 0.06);
  --crt-red: #ff4444;                   /* red LED alert */
  --crt-red-dim: rgba(255, 68, 68, 0.15);
  --crt-red-glow: rgba(255, 68, 68, 0.06);
  --crt-violet: #9944ff;                /* violet accent */
  --crt-violet-dim: rgba(153, 68, 255, 0.15);
  --crt-violet-glow: rgba(153, 68, 255, 0.06);
  --crt-white: #e8e8e8;                 /* bright phosphor white */

  /* ── Surface depths ─────────────────────────────────────── */
  --void-0: #000000;                     /* true black — page void / CRT bezel */
  --void-1: #04070c;                     /* near-black with warm-amber hint */
  --void-2: #080c14;                     /* terminal surface — cards */
  --void-3: #0c101a;                     /* hover surface */

  /* ── Agent guild-house accents ──────────────────────────── */
  /* Each department has a guild house color + glow */
  --agent-cloud: #4488ff;
  --agent-cloud-glow: rgba(68, 136, 255, 0.25);
  --agent-biscuit: #ffb000;              /* reuses crt-amber */
  --agent-biscuit-glow: rgba(255, 176, 0, 0.25);
  --agent-korra: #ff4499;
  --agent-korra-glow: rgba(255, 68, 153, 0.25);
  --agent-lelouch: #9944ff;              /* reuses crt-violet */
  --agent-lelouch-glow: rgba(153, 68, 255, 0.25);
  --agent-tifa: #00ff66;
  --agent-tifa-glow: rgba(0, 255, 102, 0.25);
  --agent-rain: #00ccff;
  --agent-rain-glow: rgba(0, 204, 255, 0.25);
  --agent-sora: #f0e8d8;                 /* warm guild platinum (not cold white) */
  --agent-sora-glow: rgba(240, 232, 216, 0.20);

  /* ── Terminal chrome tokens ────────────────────────────── */
  --term-border: rgba(60, 90, 130, 0.20);
  --term-border-active: rgba(80, 120, 170, 0.35);
  --term-tab-bg: rgba(10, 16, 26, 0.95);
  --term-tab-height: 28px;
  --term-divider: rgba(80, 110, 150, 0.13);
  --term-scanline: rgba(0, 0, 0, 0.02);

  /* ── Guild heraldry tokens ──────────────────────────────── */
  --guild-crest-color: rgba(212, 148, 58, 0.08);    /* guild amber crest watermark */
  --guild-crest-cyan: rgba(0, 212, 255, 0.06);     /* cyan circuit overlay */
  --guild-chevron-color: rgba(212, 148, 58, 0.30);  /* rank chevron */

  /* ── Team surface dimensions ───────────────────────────── */
  --team-card-bg: rgba(5, 8, 14, 0.94);
  --team-card-border: rgba(60, 90, 130, 0.18);
  --team-card-hover-bg: rgba(8, 12, 20, 0.94);
  --team-card-hover-border: rgba(80, 120, 170, 0.30);
  --team-tab-height: 28px;
  --team-card-min-height: 200px;
  --team-station-min-height: 260px;
  --team-portrait-size: 40px;
  --team-portrait-sora-size: 48px;
  --team-grid-gap-row: 32px;
  --team-grid-gap-col: 28px;
  --team-circuit-line-opacity: 0.55;
  --team-log-severity-width: 10ch;
  --team-log-timestamp-width: 12ch;
  --team-log-source-width: 10ch;
}
```

### 3.2 Palette System — The Three-Way Blend

**Depth layers (premium dark startup office foundation):**
- `--void-0: #000000` — page void (true black, like a powered-off CRT bezel)
- `--void-1: #04070c` — app base (near-black with a whisper of warm amber underlayer)
- `--void-2: #080c14` — elevated surface / terminal panel
- `--void-3: #0c101a` — hover surface

**Semantic CRT accents (phosphor-inspired, cyberpunk-lite):**
- Cyan data: `#00d4ff` — live/active/data-stream
- Green phosphor: `#00ff41` — healthy/verified/online
- Amber phosphor: `#ffb000` — warning/stale/moderate
- Red LED: `#ff4444` — danger/blocked/critical/offline
- Violet: `#9944ff` — command/review/escalation

**Guild-amber underlayer (warmth without fantasy):**
- Guild amber: `#d4943a` — a warmer, richer gold than CRT amber. Used sparingly as an underlayer glow, rank chevron tint, and heraldry accent. Never the primary surface color. This is the color that prevents the palette from feeling like a cold server room. It sits beneath the dark base — think of it as the "guild hall's ambient light" rendered as a digital underlayer, not a physical glow.

**The key technique:** The dark base (`#04070c`) has a subtle warm undertone (not pure blue-black). CRT accents provide the data-layer punch. Guild amber provides the atmospheric warmth beneath. The result: a premium startup office that happens to belong to a guild — warm without being cozy, digital without being cold.

### 3.3 CRT Scanline Effect (Optional, Subtle)

Cards can carry an extremely subtle scanline texture — a `repeating-linear-gradient` at 2-3px intervals with ~1.5% opacity. Togglable via CSS class `.crt-scanlines` on the TeamPage container.

```css
.team-page.crt-scanlines::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  pointer-events: none;
  z-index: 9999;
}
```

**Performance rule:** Single fixed overlay, not per-card. Disabled when `prefers-reduced-motion` is active.

---

## 4. Typography — The Blend

### 4.1 Font Strategy

The team surface uses a deliberate two-font system that embodies the blend:

```css
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
--font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
```

| Layer | Font | What it renders | Why |
|---|---|---|---|
| **Data** | JetBrains Mono (monospace) | Timestamps, severity tags, source labels, workload scores, blocker counts, dispatch log, status bar, role prompts, tab headers, freshness badges | Terminal / cyberpunk — data density, column alignment, hacker precision |
| **Identity** | Inter (sans-serif) | Agent names, guild class titles, attention item summaries, action labels | Premium startup / Persona 5 — clean, refined, confident identity layer |

**The blend effect:** Monospace carries the data; sans-serif carries the personality. You read the numbers in a terminal font, but you recognize the agents by their clean display names and subtle class titles.

**Column alignment:** All tabular data (severity + timestamp + source) uses monospace with explicit `ch` unit widths. Severity tags: exactly 10 characters. Timestamps: exactly 12 characters. Source labels: exactly 10 characters (truncated/padded).

### 4.2 Font Sizing Hierarchy

| Usage | Size | Font | Weight |
|---|---|---|---|
| Agent name (card) | 15px (`--text-lg`) | Inter | 600 |
| Guild class title | 11px (`--text-xs`) | Inter | 500, letter-spacing: +0.04em |
| Section headers | 13px (`--text-md`) | JetBrains Mono | 500, uppercase |
| Attention summary | 12px (`--text-sm`) | Inter | 400 |
| All data (timestamps, scores, etc.) | 10-11px (`--text-xs`) | JetBrains Mono | 400 |
| Status bar | 10px (`--text-xs`) | JetBrains Mono | 400 |
| Action labels | 11px (`--text-xs`) | Inter | 500, lowercase |
| Dispatch log entries | 10px (`--text-xs`) | JetBrains Mono | 400 |

---

## 5. Component Inventory — Re-Themed

### 5.1 Guild Insignia (Background Watermark)

**Purpose:** A single, subtle, non-interactive emblem rendered as a background watermark on the TeamPage. Combines circuit-board geometry with guild heraldry — executed at the level of a premium startup logo. This is the visual anchor that says "this is a guild" without being a fantasy banner.

**Design:**
- **Shape:** Hex-stamped circular emblem (like a premium game guild crest rendered as a startup's brand mark). Outer ring: circuit-trace hexagon. Inner: stylized chevron geometry suggesting both a guild hall roof and a data-flow diagram.
- **Position:** Bottom-right of the TeamPage viewport, large (200-300px), centered on the empty grid cell (column 4, row 2).
- **Opacity:** 0.03-0.04. Barely visible — a watermark you notice on second glance, not a logo you read.
- **Color:** `var(--guild-crest-color)` (guild amber) with `var(--guild-crest-cyan)` circuit overlay lines.
- **Interaction:** None. `pointer-events: none`. Purely atmospheric.
- **Motion:** Pulsing very subtly (3% opacity oscillation over 10s) if not `prefers-reduced-motion`.

**Implementation:** Inline SVG, memoized, rendered once. Not part of the grid — positioned absolutely behind the grid content.

### 5.2 AttentionRail — Guild-Ranked Attention Log

**Purpose:** Surface the top 3 items demanding user attention — displayed as a live `tail -f` log stream with subtle guild ranking framing. The direct answer to "Where should my attention go next?"

**Position:** Full-width strip between MissionBar and TeamGrid. Sticky on scroll.

**Chrome:** A terminal-panel frame with a dim title bar reading `ATTENTION LOG — tail -f /dev/attention` in monospace, top-left. A subtle blinking cursor (█) sits at the end of the title bar. **Guild addition:** A small guild chevron `⟐` precedes the title, rendered in guild amber at 30% opacity.

**Structure:**
```
AttentionRail (flex row, gap: 12px, padding: 12px 0)
├── Panel chrome: title bar with guild chevron + "ATTENTION LOG"
├── AttentionItem #1 (flex: 1, max-width: 400px)
│   ├── «❶» Rank chevron (left edge, guild amber)
│   ├── [CRITICAL] severity tag (monospace, 10ch wide)
│   ├── Timestamp (14:32:17.842, monospace, dim)
│   ├── Source label (e.g., BISCUIT, monospace, accent color)
│   ├── Summary line (max 1 line, Inter sans-serif, truncation with …)
│   ├── Duration badge ("pending 45m", mono)
│   ├── Action button ("respond" / "inspect" / "resolve", terminal-style lowercase)
│   └── FreshnessBadge (inline, right-aligned)
├── AttentionItem #2 (same structure, «❷»)
├── AttentionItem #3 (same structure, «❸»)
```

**Guild rank framing:** The top three items get subtle rank indicators:
- `«❶»` — #1 (top priority): guild amber, sits as a small prefix before the severity tag. The `«»` chevrons suggest guild ranking without being ornate.
- `«❷»` — #2: guild amber at 60% opacity
- `«❸»` — #3: guild amber at 35% opacity

These rank chevrons are refined and restrained — dual-angle quotes in a premium sans-serif weight, not gold medals or numbered badges. Think Persona 5 stat screen numeral treatment, not Olympic podium.

**Log-format layout (internal to each item):**
```
┌──────────────────────────────────────────────────────────────┐
│ «❶» [CRITICAL] 14:32:17.842  BISCUIT  waiting on decision   │
│              pending 45m                          [respond]  │
│                                                ⬤ live       │
└──────────────────────────────────────────────────────────────┘
```

**Severity colors (terminal-inspired):**

| Severity | Tag text | Accent color | Left border | Rank chevron |
|---|---|---|---|---|
| CRITICAL | `[CRITICAL]` | `#ff4444` (red LED) | 2px solid red | guild amber full |
| WARNING | `[WARNING ]` | `#ffb000` (amber CRT) | 2px solid amber | guild amber 60% |
| INFO | `[INFO    ]` | `#00d4ff` (cyan data) | 2px solid cyan | guild amber 35% |
| STALE | `[STALE   ]` | `#888888` (dim grey) | 2px solid dim | none (stale items don't get rank chevrons) |

Severity tags are fixed-width (10 chars, left-padded monospace) so all items align in a column.

**Guild visual layering in the attention rail:**
- Rank chevrons create a subtle visual hierarchy — your eye catches «❶» first, then scans down.
- The guild amber rank chevrons are color-coded for severity too: critical items get full guild amber on the chevron, creating a warm "this is important" signal that complements the red severity tag.
- The layering communicates both *operational severity* (red/amber/cyan) and *guild attention priority* (chevron opacity) simultaneously.

**Item card background:** `rgba(5, 8, 14, 0.92)` — near-black terminal surface with warm underlayer. Border: `1px solid rgba(60, 90, 130, 0.20)`. Left border accent bar overrides with severity color.

**Interaction:**
- Hover: background lifts to `rgba(8, 12, 20, 0.94)`, border glows subtly in severity color, rank chevron brightens
- Click action button: navigates/inspects
- Click card body: same as action button
- Keyboard: Tab through items, Enter to activate

**Empty state:** Three placeholder log lines with `[INFO    ] --:--:--.---  --------  no attention items` in dim text. Rank chevrons still present but at 15% opacity. Blinking cursor on title bar still active.

**Degraded state:** Items render but severity shows `[DEGRADE ]` with amber tag. Rank chevrons still present. Timestamps may be stale.

### 5.3 LeadCard — Guild-Class Agent Card

**Purpose:** Compact operational summary of one department lead. Answers: status, workload, blockers, active project, last verified. Styled like a premium tech badge with a subtle anime guild class frame — not a character card, but a personnel status panel from a premium game's inventory screen.

**The key differentiator:** Each agent card carries a **guild class subtitle** — a refined, one-word class designation that adds personality without becoming an RPG character sheet. These class tags are styled like premium game UI elements: small, restrained, using Inter sans-serif at 11px with +0.04em letter-spacing.

**Agent → Guild Class mapping:**

| Agent | Department | Guild Class | Class icon | Accent |
|---|---|---|---|---|
| Cloud | Systems & Infrastructure | Warrior · Engineer Class | `⚔` (subtle) | `#4488ff` |
| Biscuit | Architecture & Design | Mage · Architect Class | `✦` (diamond spark) | `#ffb000` |
| Korra | Creative & Media | Artist · Creator Class | `🎨` (palette, restrained) | `#ff4499` |
| Lelouch | Strategy & Analysis | Strategist · Tactician Class | `♜` (rook) | `#9944ff` |
| Tifa | Commerce & Resources | Merchant · Alchemist Class | `⚗` (alembic) | `#00ff66` |
| Rain | Communications & Intel | Messenger · Rogue Class | `✉` (envelope) | `#00ccff` |
| Sora | Operations & Orchestration | Guild Master · Conductor Class | `⏣` (hex node) | `#f0e8d8` |

**How class tags are styled (subtle, not loud):**
- Positioned directly beneath the agent name, on its own line
- Font: Inter, 11px, weight 500, letter-spacing: +0.04em
- Color: accent color at 55% opacity (muted, not shouty)
- Format: e.g., `Warrior · Engineer Class` — the dot separator is a mid-dot (·), not a pipe, giving it a refined inventory-menu feel
- The class icon (e.g., `⚔`) is rendered at 14px, same color as the class text, sitting inline before the class name. NOT emoji-sized — it's small and typographic, like a UI glyph.
- Background: none. These are text-only tags — no pill, no badge, no frame. They float as clean typography beneath the name, exactly like a premium game's character stat screen labeling.

**Structure (visual order, top to bottom):**

```
┌─────────────────────────────────────┐
│ ╭─ agent:cloud ─────────── ✦ ────╮ │ ← tab header (28px), guild chevron right
│ │ ● ONLINE  │  WORKLOAD ▓▓▓▓▓▓▓░│ │   accent left stripe, status+workload
│ ╰────────────────────────────────╯ │
│                                     │
│ ┌──────┐ ┌────┐                    │
│ │PORT- │ │ ⚔  │  CLOUD            │ ← portrait (40px) + sprite/class icon (20px)
│ │RAIT  │ │icon│  Warrior · Engineer│   side by side. Name in Inter, class below
│ │ 40px │ │20px│  Class             │
│ └──────┘ └────┘                    │
│                                     │
│ ──┬─ workload ──────────────────── │ ← divider with mono label
│   │ ████████████░░░░  MODERATE 18  │   htop-style bar: 6px tall
│   │ ████████░░░░░░░░  active tasks │   block chars, full width
│   │                                │
│   │ [!] BLOCKERS: 2                │   blocker count (red pip if >0)
│   │                                │
│   │ PROJECT: mission-control       │   active project line
│   │                                │
│   │ verified 2m ago · live         │   timestamp + freshness
│   │                                │
│   ╰── inspect ─────────────────────│ ← action: terminal-style lowercase
└─────────────────────────────────────┘
```

**Portrait + Sprite layout:** The portrait and class icon sit side-by-side in a compact row:
- Portrait: circular, 40×40px, LED-ring border in accent color
- Class icon: 20×20px, rendered as a small glyph in a subtle container (not a circle — a soft square with 3px border-radius). The icon sits to the right of the portrait, gap: 8px. Color: accent at 50% opacity. This is a refined UI element, not a game sprite — think Persona 5 menu iconography, scaled down.
- Name + class title: sit to the right of the icon, vertically centered on the portrait+icon row

**Portrait spec:**
- Container: 40×40px, `border-radius: 50%`
- Image: `object-fit: cover`, centered
- Border: 1.5px solid accent color at 40% opacity (LED ring effect)
- Shadow (when active): subtle glow in accent color (`0 0 6px` at 15% opacity)
- Fallback: 2-3 character initials in monospace, accent color text on `#0a0a0a` background

**Agent ID tab header:** Each card has a thin tab-style header (28px tall). Shows `● STATUS` on the left (git-style indicator) and a compact workload summary on the right. The left edge has a 2px accent stripe (department color / guild house color). **Guild addition:** A small guild chevron (✦ or similar) sits at the far right of the tab header, rendered in guild amber at 25% opacity — subtle, like a guild insignia watermark on each tab.

**Department accent colors (guild house colors):**

| Lead | Accent | Color value | Glow |
|---|---|---|---|
| Cloud | `var(--agent-cloud)` | #4488ff | `rgba(68,136,255,0.25)` |
| Biscuit | `var(--agent-biscuit)` | #ffb000 | `rgba(255,176,0,0.25)` |
| Korra | `var(--agent-korra)` | #ff4499 | `rgba(255,68,153,0.25)` |
| Lelouch | `var(--agent-lelouch)` | #9944ff | `rgba(153,68,255,0.25)` |
| Tifa | `var(--agent-tifa)` | #00ff66 | `rgba(0,255,102,0.25)` |
| Rain | `var(--agent-rain)` | #00ccff | `rgba(0,204,255,0.25)` |
| Sora | `var(--agent-sora)` | #f0e8d8 | `rgba(240,232,216,0.20)` |

**Status dot (git-inspired):** 6×6px circle with thin border. Colors and labels:
- `● ONLINE` → `#00ff66` (terminal green) with subtle pulse, label in green mono
- `● BUSY` → `#ffb000` (amber), no pulse
- `● BLOCKED` → `#ff4444` (red) with pulse
- `● IDLE` → `#666666` (dim), no pulse
- `● OFFLINE` → `#444444` (dimmer), no pulse

**Workload bar (htop-inspired):** Full-width horizontal bar, 6px tall. Background: `#1a1a2e`. Fill segments in accent color. Label alongside: e.g., `MODERATE 18` in monospace, right-aligned. Segment widths proportional to task count per status.

```
████████████░░░░  MODERATE 18
```

Color transitions match score thresholds:
- 0 → `#444444` (dim, labeled IDLE)
- 1-10 → `#00ff41` (terminal green, labeled LIGHT)
- 11-25 → `#ffb000` (amber, labeled MODERATE)
- 26-50 → `#ff4444` (red, labeled HEAVY)
- 51+ → `#ff4444` pulsing (red blink, labeled CRITICAL)

**Role phrase:** Not used in the re-themed version. The guild class subtitle replaces the shell-prompt role phrase. This shifts the personality from "terminal command" to "guild status screen" while keeping operational meaning.

**Blocker count:** Displayed as `[!] BLOCKERS: N` in monospace. The `[!]` pip uses red (`#ff4444`) if N > 0, dim otherwise. Only shown when relevant.

**Active project badge:** Rendered as a single monospace line: `PROJECT: {name}`. Uses accent color for the project name. Hidden if no active project.

**Last verified timestamp:** Monospace, `--text-xs`, dim color. Format: relative (e.g., `2m ago`, `1h ago`) or absolute for >24h (`2026-06-27 14:32`). Paired with `FreshnessBadge`.

**Action button:** Terminal-style lowercase text, full width, no border — dim background that brightens on hover. Background: `transparent` default, `rgba(255,255,255,0.04)` on hover. Text: dim default, accent color on hover. The action label sits on its own line with a `╰──` box-drawing character prefix to look like a tree/terminal menu item.

### 5.4 SoraConductorStation — Guild Master's Desk

**Purpose:** Sora's card — the central station. This is simultaneously an ops terminal (dispatch log, system health) AND a guild master's desk (insignia display, aggregate stats, elevated presence). The dual-pane layout is the key: left = terminal log, right = guild master's summary.

**Position:** In the TeamGrid, Sora occupies columns 2-3 of row 2 (the center of the 4-column grid). Visually elevated via:
- Slightly larger dimensions (min-height 260px vs 200px)
- Elevated z-index with warm guild-amber glow (`box-shadow: 0 0 40px rgba(212,148,58,0.04)`)
- Distinct double-line tab header with guild master chevron
- Dual-pane internal layout (terminal left, insignia right)
- Warm platinum/cream accent (`var(--agent-sora)`) — softer than pure white, more guild-masterly

**Structure — Dual-Pane Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ ╔══ sora:guild-master ═══════════════════════ ✦ ✦ ✦ ═══╗  │ ← double-line header
│ ║ ● CONDUCTING  │  SYSTEM ▓▓▓▓▓▓▓▓▓▓ HEALTHY  ⟐ GUILD ║  │   guild chevrons right
│ ╚════════════════════════════════════════════════════════╝  │
│                                                             │
│ ┌──────────────────────┐ ┌──────────────────────────────┐  │
│ │  ┌──────┐ ┌────┐    │ │                              │  │
│ │  │SORA  │ │ ⏣  │    │ │   ╭────────────────────────╮│  │
│ │  │ 48px │ │icon│    │ │   │    GUILD INSIGNIA      ││  │
│ │  └──────┘ └────┘    │ │   │                        ││  │
│ │  SORA               │ │   │   ⟐ 7 agents active    ││  │
│ │  Guild Master       │ │   │   3 delegations live   ││  │
│ │  Conductor Class    │ │   │   health: HEALTHY      ││  │
│ │                     │ │   │   uptime: 14d 3h       ││  │
│ │  ── dispatch log ── │ │   │                        ││  │
│ │  14:32 deleg:bis→cld│ │   │   [circuit + heraldry  ││  │
│ │  14:28 deleg:sra→tfa│ │   │    crest emblem]      ││  │
│ │  14:15 health:korra │ │   │                        ││  │
│ │                     │ │   ╰────────────────────────╯│  │
│ │  verified 12s · live│ │                              │  │
│ │                     │ │                              │  │
│ │  ╰── open terminal  │ │                              │  │
│ └──────────────────────┘ └──────────────────────────────┘  │
│   LEFT PANE (log)          RIGHT PANE (guild summary)      │
└─────────────────────────────────────────────────────────────┘
```

**Dual-pane proportions:** Left pane (terminal log): 60% width. Right pane (guild summary + insignia): 40% width. Separated by a thin 1px vertical divider in `var(--term-divider)`.

**Left pane — Dispatch Log (ops terminal):**
- Portrait (48px) + class icon (24px) side by side, same pattern as LeadCard but larger
- Name "SORA" in Inter, 15px, weight 600, color `var(--agent-sora)`
- Class subtitle: "Guild Master · Conductor Class" in Inter, 11px, weight 500
- Dispatch log: 3-5 most recent entries in monospace columns. Each entry: `TIMESTAMP  OPERATION  RESULT`. 10px JetBrains Mono, dim but readable. Log auto-scrolls to newest entry.
- Freshness: `verified 12s ago · live`
- Action: `╰── open terminal`

**Right pane — Guild Master's Summary (heraldry):**
- A small frame (`╭──╮` style box-drawing corners) containing the guild summary
- Title: "GUILD INSIGNIA" in Inter, 10px, weight 500, uppercase, guild amber at 50% opacity
- Aggregate stats (monospace, 10px):
  - `⟐ 7 agents active`
  - `3 delegations live`
  - `health: HEALTHY` (in green)
  - `uptime: 14d 3h`
- A small rendered guild crest emblem (32-40px) — the same hex-stamped circular emblem from the background watermark, but rendered at higher opacity (0.15) as part of the summary panel. Circuit traces + chevron geometry.
- The right pane has a subtle warm background tint: `rgba(212, 148, 58, 0.03)` — barely perceptible guild-amber wash that distinguishes this pane from the terminal left pane.

**Key differences from LeadCard:**
- Double-line border tab header (╔══╗ style) with guild chevrons at right
- Larger portrait (48px vs 40px), larger class icon (24px vs 20px)
- Dual-pane layout — the defining visual feature
- No workload bar — shows system health aggregate bar instead (below the log)
- Dispatch log in left pane
- Guild insignia + summary stats in right pane
- Warm platinum/cream accent (`var(--agent-sora)`) with guild-amber glow, not cold white
- Subtle background glow: `radial-gradient(circle at 50% 0%, rgba(240,232,216,0.04), transparent 60%)`
- Action: `open terminal` (leads to Sora-focused detail/chat)

**The dispatch log format:**
```
14:32:17.842  delegation:biscuit→cloud     ok
14:28:01.104  health:tifa                  warn  2 blockers
14:15:42.339  review:korra                 stale 3 items
```

The dispatch log makes Sora's station feel like an actual operations terminal while the right pane reminds you this is the guild master's desk. The blend: operational data + guild identity, side by side.

### 5.5 DelegationLines — Guild-House Circuit Traces

**Purpose:** Sparse SVG overlay showing only *active* connections between agents — rendered as angular circuit traces with guild house color coding. Think PCB traces that happen to be color-coded by allied guild house.

**Rendering:** An absolutely-positioned SVG layer over the TeamGrid, with `pointer-events: none`. Lines use orthogonal routing (Manhattan-style) with sharp 90° corners — like a circuit board or network topology graph.

**Line styles (with guild heraldry):**

| Relation type | Stroke color | Stroke style | Opacity | Animation | Guild meaning |
|---|---|---|---|---|---|
| Active handoff (task delegated) | Source agent's house color | solid, 1px | 0.55 | packet dots flowing | Allied house connection |
| Dependency (lead B blocked on lead A) | Target agent's house color | dashed, 1px | 0.60 | slow pulse | Pending house favor |
| Escalation (issue raised to Sora) | Guild amber `#d4943a` | solid, 1.5px | 0.65 | packet dots flowing (faster) | Raised to guild master |
| Blocked relation (lead blocked by external) | `#ff4444` (red) | dashed, 1px | 0.70 | fast blink dots | External threat |

**Guild heraldry touch:** Lines use the *source agent's guild house color* for handoffs and dependencies, making the circuit map read like allied guild house connections. Escalation lines to Sora use guild amber — the guild master's color. This subtly reinforces the guild metaphor through the connection lines themselves, without making them read as "magical ley lines" or fantasy elements.

**Routing (orthogonal / Manhattan):**
1. Lines route in 90° segments — horizontal then vertical (or vice versa) like PCB traces.
2. Up to 2 bends per line. Avoid diagonals.
3. Lines use small corner radius (2px) at bend points to soften the sharp angles slightly.
4. Lines never cross card interiors — they route around card bounding boxes.
5. At most 8 lines visible. If >8 edges, sort by priority (escalation > blocked > dependency > handoff) and render top 8.
6. Lines with `freshness: 'stale'` or worse render at reduced opacity (0.20), packet dots stop.

**Data-transfer indicators (packet dots):** Each active line has 2-4 small dots (3px circles) traveling along the path from source to destination. Dots use the line's stroke color at full opacity, giving them a slight glow. Animation: `stroke-dashoffset` or CSS `offset-path` travel. Duration varies by line type (1.5s for handoff, 3s for dependency, 0.8s for escalation). This visually communicates "data is flowing" — or in guild terms, "messengers carrying tasks between houses."

**Line drawing animation:** On page load, lines draw in simultaneously with a 400ms `stroke-dashoffset` animation. New lines appear with a brief 200ms draw. Removed lines fade out over 400ms.

**Interaction:** Lines are non-interactive (`pointer-events: none`). Hovering a card highlights its connected lines by increasing opacity to 0.85 and briefly brightening the packet dots.

### 5.6 FreshnessBadge

**Purpose:** Tiny label attached to every data point indicating source confidence. Mono, compact, like a git tag or npm version badge.

**Design:** Monospace, `--text-xs` (10px), lowercase. Compact pill: 2px vertical padding, 5px horizontal. Border-radius: 3px. Like a small npm version tag or git ref badge.

**Color mapping (terminal-inspired):**

| Freshness | Text color | Background | Border | Visual |
|---|---|---|---|---|
| `verified` | `#00ff66` | `rgba(0,255,102,0.08)` | `rgba(0,255,102,0.25)` | green tag |
| `live` | `#00d4ff` | `rgba(0,212,255,0.08)` | `rgba(0,212,255,0.25)` | cyan tag |
| `stale` | `#ffb000` | `rgba(255,176,0,0.08)` | `rgba(255,176,0,0.25)` | amber tag |
| `degraded` | `#ffb000` | `rgba(255,176,0,0.08)` | `rgba(255,176,0,0.25)` | amber tag (same) |
| `unknown` | `#888888` | `transparent` | `rgba(136,136,136,0.25)` | dim tag |
| `unavailable` | `#666666` | `transparent` | `rgba(102,102,102,0.25)` | dimmer tag |
| `mock/demo` | `#9944ff` | `rgba(153,68,255,0.08)` | `rgba(153,68,255,0.25)` | violet tag |

**Position:** Inline with data it qualifies — right-aligned or immediately following the value. In LeadCards: next to "verified X ago". In AttentionRail: bottom-right corner of each log item. In Sora station: right-aligned after dispatch log header.

---

## 6. Window Chrome — Terminal × JRPG Double-Line

### 6.1 Card Borders

All team panels use terminal-window-style borders as the foundation:
- 1px solid `var(--term-border)` around each card/panel
- Tab-style headers at card tops (28px tall, `var(--term-tab-bg)`)

### 6.2 Double-Line Corner Accents

**Guild addition:** Each card has subtle double-line corner accents at the four corners — not ornate gold filigree, but pixel-perfect double-line marks like a premium JRPG status screen's window chrome. Think Persona 5 menu window corners, executed with the restraint of a design system.

Implementation:
- 6×6px corner marks using box-drawing characters or CSS pseudo-elements
- Color: `rgba(212, 148, 58, 0.18)` (guild amber at 18% — very subtle)
- Only visible on hover at full opacity; at rest: 40% of that (amber at ~7% — barely there, just enough to add the double-line texture)
- The corners are implemented via `::before` / `::after` pseudo-elements or as a thin border-image approach

**Visual effect:**
```
╭──────────────────────────╮
│                          │
│    CARD CONTENT          │
│                          │
╰──────────────────────────╯
```

The corners use `╭` `╮` `╰` `╯` unicode box-drawing characters rendered as 1-2px decorative elements, NOT as actual text content. They're visual corner marks only — not a full ornate frame.

**Where double-line corners appear:**
- LeadCards: subtle double-line corners at all four corners (7% amber opacity at rest, 18% on hover)
- SoraConductorStation: slightly more prominent double-line corners (12% amber opacity at rest, 25% on hover) — befitting the guild master's station
- AttentionRail panel: double-line corners only at the title bar level (not the individual log items)

**What we avoid:** Full ornate borders, gold filigree, connecting lines between corners, corner flourishes, or any decorative medieval/RPG framing. Just the corners themselves — minimalist, typographic, restrained.

### 6.3 Tab-Style Headers

Each card has a tab header at the top (28px tall):
- Left: status dot + status label (e.g., `● ONLINE`)
- Right: compact workload summary or system health
- Left edge: 2px accent stripe in guild house color
- **Guild addition:** A small guild chevron marker at the far right of the tab header, rendered in guild amber at 25% opacity
- Format: `agent:{id}` or `{id}:{role}` — monospace, 10px, dim

**Sora's tab header** uses double-line characters (╔══╗) with guild chevron decorations at the right:
```
╔══ sora:guild-master ═══════════════════════ ✦ ✦ ✦ ═══╗
```

### 6.4 Section Dividers

Section dividers use monospace labels with box-drawing characters for a terminal tree-menu feel:
```
──┬─ workload ────────────────────────────
──┬─ dispatch log ────────────────────────
```

The `──┬─` prefix is a box-drawing character sequence rendered in `var(--term-divider)`. Labels are monospace, 10px, uppercase, dim.

### 6.5 Panel Background

The overall page background: `#000000` (true black) with the page content sitting on `#04070c` panels — the "CRT bezel" effect of true black around the terminal content. A very subtle warm-amber underlayer tint (barely perceptible) prevents the true black from feeling cold.

---

## 7. Guild Insignia — Crest Design

### 7.1 The Emblem

The guild insignia is a hex-stamped circular emblem that combines circuit-board geometry with guild heraldry — executed at the level of a premium startup logo.

**Design elements:**
- **Outer ring:** A thin hexagonal circuit trace (1px, `var(--crt-cyan)` at 15% opacity), with small nodes at each vertex (2px dots). The hexagon represents both technology (circuit node) and guild structure (six departments reporting to a central guild master).
- **Middle ring:** A subtle circular border (1px, guild amber at 12% opacity) — the heraldry ring.
- **Inner geometry:** Two intersecting chevrons (∧ shapes) forming a stylized "guild hall roof" — rendered as thin lines (1px, guild amber at 15% opacity) with a circuit-trace node at the apex.
- **Center:** Empty — negative space. The emblem is a frame, not a filled icon. This keeps it restrained and logo-like.
- **Overall size:** 200-300px for the background watermark; 32-40px for the Sora station right-pane version.

**Color strategy:**
- Primary: guild amber (`#d4943a`) at 8-15% opacity — warm, heraldic
- Secondary: CRT cyan (`#00d4ff`) at 6-12% opacity — technical, circuit-like
- The two colors overlay: cyan circuit traces running through an amber heraldry frame

**The blend effect:** It reads as both a tech company logo AND a guild crest, without being fully either. The circuit traces say "startup engineering team." The chevron geometry says "guild hall." Together they say "tech guild."

### 7.2 Placement

- **Background watermark:** Bottom-right of the TeamPage viewport, large (200-300px), opacity 0.03-0.04. Centered on the empty grid cell (col 4, row 2). `pointer-events: none`.
- **Sora station right pane:** Small (32-40px), opacity 0.15. Rendered inside the guild summary frame.
- **Status bar:** A tiny 14px version at the leftmost position (replacing the `⟐` if the emblem version is used).

---

## 8. Status Bar

**Purpose:** A thin status bar (24px) at the bottom of the TeamPage, styled like a terminal emulator status line or tmux bar. Shows aggregate system state at a glance with guild framing.

**Position:** Bottom of the TeamPage viewport, below the TeamGrid. Sticky.

**Contents (left to right, monospace, `--text-xs`):**
```
⟐ 7/7 agents │ 3 delegations │ system: HEALTHY │ 14:32 UTC
```

**Guild addition:** The leftmost element is now `⟐ 7/7 agents` — a guild member count with a small hex-node emblem (`⟐`). This is the guild equivalent of "party status" in a JRPG, rendered as a tmux status element.

**Element breakdown:**
- `⟐` — guild hex emblem, rendered in guild amber at 35% opacity. A tiny 12×12px inline SVG or unicode character.
- `7/7 agents` — agent count, monospace. Green (`#00ff66`) when all online, amber when any degraded, red when any offline.
- `│` — divider pipes in `#444444`
- `3 delegations` — active delegation count
- `system: HEALTHY` — system status: green for HEALTHY, amber for DEGRADED, red for OFFLINE
- `14:32 UTC` — current time, dim

**Colors:**
- Background: `#000000` (true black bar)
- Text: `#888888` (dim phosphor)
- Status labels: accent colors
- Divider pipes: `#444444`

**Behavior:** Always visible. Updates live alongside data refreshes. On scroll, remains sticky at the bottom.

---

## 9. States

### 9.1 Loading State

**When:** Initial page load, data fetching in progress, no cached data available.

**Visual:**
- AttentionRail: Three skeleton log lines with shimmer — rectangular placeholder blocks matching column widths. Title bar shows blinking cursor with guild chevron present at 15% opacity.
- LeadCards: Seven skeleton cards — tab header bar visible with dim placeholder text and guild chevron right-aligned. Shimmer rectangles for portrait, name, class subtitle, workload bar.
- Sora station: Skeleton terminal with shimmer, dual-pane placeholder rectangles.
- GuildInsignia: Rendered at 0.02 opacity (present but barely visible).
- DelegationLines: None rendered.
- MissionBar title: "TEAM" with "loading…" in monospace.

**Animation:** Existing `.shimmer` class from `motion.css`. Skeleton layout preserves exact dimensions for no layout shift.

### 9.2 Empty State

**When:** Data sources connected but return zero results.

**Visual:**
- AttentionRail: Three log entries reading `[INFO    ] --:--:--.---  --------  no attention items — all clear` in dim monospace. Rank chevrons present at 15% opacity.
- LeadCards: All seven render with zero workload, zero blockers, no active project. Status shows `● IDLE`. Class subtitles visible.
- "verified X ago" shows actual timestamp; freshness badge shows "live" if source is responding.
- No "empty state takeover" — the grid still feels like a live guild ops dashboard, just with nothing to report.

### 9.3 Populated State (Normal)

All components render with real data. Circuit traces connect active relations in guild house colors. Attention log shows ranked items with guild rank chevrons. Sora's dual-pane station shows dispatch log + guild summary.

**Freshness expectation:** Most data should show `live` or `verified`. Occasional `stale` is acceptable but visually distinguished.

### 9.4 Error State (Partial)

**When:** Some data sources fail (e.g., board API 500, WS disconnected).

**Visual:**
- Affected LeadCards: Workload shows `--` in red mono with `degraded` badge. Tab header gets a subtle red-tinted stripe. Last verified may show old timestamp with `stale` badge.
- AttentionRail: Items show `[DEGRADE ]` severity tag instead of their normal severity. Rank chevrons remain at 35% opacity.
- DelegationLines: Only lines backed by live sources render. Stale lines fade to 0.20 opacity, packet dots stop animating.
- MissionBar status pill: Shows "degraded" with amber, monospace.
- No crash. The page degrades gracefully per-source.

### 9.5 Full Error State

**When:** All data sources fail (complete disconnection).

**Visual:**
- All cards show `unavailable` freshness. Tab headers tint red. Guild chevrons still present.
- AttentionRail shows single log entry: `[CRITICAL] --:--:--.---  SYSTEM   connection lost — check gateway` with a `retry` action. No rank chevrons (nothing to rank).
- LeadCards render with portraits and names visible, class subtitles visible, but all metrics show `--` with `unavailable` badge.
- MissionBar status pill: "offline" with red.
- DelegationLines: None rendered.
- Status bar: shows `⟐ -- agents │ -- delegations │ system: OFFLINE │ --:-- UTC`

### 9.6 Demo/Mock Mode

**When:** Running with mock/demo data.

**Visual:**
- Every data point displays `mock/demo` FreshnessBadge (violet).
- TeamGrid has a subtle violet dashed border (1px) with a monospace label `[DEMO MODE]` in the top-right corner, styled like a terminal status indicator.
- Guild class subtitles and rank chevrons still render — the guild identity persists even in demo mode.
- Makes it impossible to mistake demo data for live ops data.

---

## 10. Agent Card Layout Spec (Detailed)

### 10.1 Portrait + Class Icon + Name Layout

The portrait, class icon, and name sit together in a compact row:

```
┌──────────────────────────────────┐
│ ┌────────┐ ┌────┐              │
│ │        │ │ ⚔  │  CLOUD       │ ← portrait (40px circle)
│ │ 40×40  │ │icon│  Warrior ·   │   class icon (20px) right of portrait
│ │ circle │ │20px│  Engineer     │   name + class title stacked right
│ │        │ │    │  Class        │   gap: 10px from portrait, 8px portrait→icon
│ └────────┘ └────┘              │
└──────────────────────────────────┘
```

**Portrait spec:**
- Container: 40×40px, `border-radius: 50%`
- Image: `object-fit: cover`, centered
- Border: 1.5px solid accent color at 40% opacity (LED ring effect)
- Shadow (when active): subtle glow in accent color (`0 0 6px` at 15% opacity)
- Fallback: 2-3 character initials in monospace, accent color text on `#0a0a0a` background

**Class icon spec:**
- Container: 20×20px, 3px border-radius (soft square, not a circle)
- The icon glyph: rendered as text or inline SVG, 12-14px visual size, centered in container
- Color: accent color at 50% opacity
- Background: `rgba(accent, 0.06)` — barely-there tint
- Border: 1px solid accent at 15% opacity
- This is designed to look like a UI element, not a character sprite

### 10.2 Class Subtitle Format

```
CLOUD                          ← Inter, 15px, weight 600, --text-primary
Warrior · Engineer Class       ← Inter, 11px, weight 500, letter-spacing: +0.04em, accent at 55%
```

The class subtitle uses a mid-dot (·) separator between the short name and the full class designation. The short name is the "vibe" (Warrior, Mage, Artist, etc.); the full designation is the formal title. Together they create a refined JRPG status screen feel without being an RPG character sheet.

### 10.3 Indicator Placement

```
┌─────────────────────────────────┐
│ ╭─ agent:cloud ─────────✦────╮ │ ← tab header, guild chevron right
│ │ ● ONLINE   WORKLOAD ▓▓▓▓▓▓▓│ │   28px, accent left stripe
│ ╰─────────────────────────────╯ │
│                                 │
│ ┌────────┐ ┌────┐              │
│ │PORTRAIT│ │ ⚔  │  CLOUD       │
│ │  40px  │ │20px│  Warrior ·   │
│ └────────┘ └────┘  Engineer    │
│                     Class       │
│                                 │
│ ──┬─ workload ──────────────── │ ← section divider with label
│   │ ████████████░░  MODERATE 18│   htop bar, 6px
│   │ ████████░░░░░░  active tsk │
│   │                            │
│   │ [!] BLOCKERS: 2            │   blocker pip + count
│   │                            │
│   │ PROJECT: mission-control   │   active project
│   │                            │
│   │ verified 2m ago · live     │   timestamp + freshness
│   │                            │
│   ╰── inspect ─────────────────│   action line
└─────────────────────────────────┘
```

---

## 11. Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| ≥ 1400px | 4 columns as designed |
| 1200-1399px | 3 columns, Sora spans 2 in row 2 |
| 900-1199px | 2 columns, Sora full-width card between rows |
| < 900px | 1 column, vertical stack. Sora card at top. AttentionRail collapses to horizontal scroll. |

At < 900px, the left rail becomes a top bar (existing behavior in theme.css at 920px breakpoint).

---

## 12. Workload Score Display Formula

For reference in implementing the visual:

```typescript
// Weight mapping (from product spec §4)
const STATE_WEIGHT: Record<KanbanStatus, number> = {
  running:   3.0,
  review:    2.0,
  blocked:   2.0,
  triage:    1.5,  // "stale/waiting"
  todo:      1.0,
  ready:     1.0,
  scheduled: 1.0,
  done:      0.0,
};

// Sub-agent work counts at 0.5× toward parent lead
const SUB_AGENT_MULTIPLIER = 0.5;
```

**Display thresholds (terminal-style labels):**

| Score range | Label | Bar color | Bar style |
|---|---|---|---|
| 0 | `IDLE` | `#444444` (dim) | empty bar, dim segments |
| 1 - 10 | `LIGHT` | `#00ff41` (terminal green) | solid green segments |
| 11 - 25 | `MODERATE` | `#ffb000` (amber) | solid amber segments |
| 26 - 50 | `HEAVY` | `#ff4444` (red) | solid red segments |
| 51+ | `CRITICAL` | `#ff4444` (red pulse) | blinking red segments |

**Bar rendering:** The htop-style bar uses CSS with segment blocks:
- Each "block" represents ~2-3 workload points
- Filled blocks use the score color
- Empty blocks use `#1a1a2e` (dark terminal surface)
- Bar height: 6px
- Label is monospace, right-aligned alongside the bar (e.g., `MODERATE 18`)

---

## 13. Delegation Line Algorithm (Visual Rules)

Lines connect card center points using orthogonal (Manhattan) routing. The SVG viewport matches the TeamGrid bounds.

```typescript
interface DelegationEdge {
  from: AgentId;
  to: AgentId;
  type: 'handoff' | 'dependency' | 'escalation' | 'blocked';
  taskCount: number;     // number of items on this edge
  freshness: Freshness;
}
```

**Orthogonal routing rules:**
1. Determine center points of source and destination cards.
2. Route using 90° bends: horizontal segment → vertical segment → horizontal segment (or vice versa).
3. Maximum 2 bends per line. No diagonals.
4. Lines route around card bounding boxes (push bends outward by 12px from card edges).
5. Bend points use 2px corner radius for slight visual softening.
6. At most 8 lines visible. If >8 edges, sort by priority (escalation > blocked > dependency > handoff) and render top 8.
7. Lines with `freshness: 'stale'` or worse render at 0.20 opacity, packet dots stop.

**Guild house color mapping for lines:**
- Handoff: source agent's guild house color
- Dependency: target agent's guild house color
- Escalation (to Sora): guild amber (`#d4943a`)
- Blocked: red (`#ff4444`)

**Packet dot animation:**
- 2-4 dots per active line (3px circles, full opacity line color).
- Dots travel from source to destination.
- Speed varies: 1.5s for handoff, 3s for dependency, 0.8s for escalation.
- Implemented via CSS `offset-path` with the SVG path, or via `stroke-dasharray` trick with animated `stroke-dashoffset`.
- Stale/disconnected lines: dots removed.

---

## 14. Tech Cues Conformance

### 14.1 Approved Cues — How Applied in This Blend

| Cue | Application |
|---|---|
| **Circuit-board insignia** | Hex-stamped circular guild emblem — circuit traces overlaid on heraldic chevron geometry. Used as background watermark (0.03 opacity), Sora station right-pane icon (0.15 opacity), and status bar hex emblem. |
| **Conductor terminal / Guild master desk** | Sora's card — dual-pane layout (dispatch log left, guild summary right), elevated position, warm platinum accent, double-line tab header, guild chevrons. |
| **CRT monitor glow** | Amber, green, cyan phosphor accents against true black. Subtle text-shadow glow on accent-colored elements. Optional scanline overlay. Warm guild-amber underlayer in the void depths. |
| **Tab-style headers with guild chevrons** | 28px tab headers with `agent:{id}` format, git-style status dot, workload summary. Small guild chevron (✦) at far right in guild amber. |
| **Anime guild class framing** | Each agent card carries a refined class subtitle (e.g., "Warrior · Engineer Class") with a subtle class icon glyph. Styled like premium game UI, not RPG badges. |
| **Guild rank chevrons** | Attention rail uses «❶» «❷» «❸» rank indicators in guild amber — premium stat-screen numeral treatment, not medals. |
| **Double-line window corners** | Subtle JRPG window double-line corner accents at card corners — pixel-perfect, 6×6px, guild amber at 7-18% opacity. |
| **Guild house color delegation lines** | Circuit traces color-coded by source agent's guild house color. Escalation lines to Sora use guild amber. |

### 14.2 Forbidden Cues — Compliance

| Forbidden | Why it doesn't appear |
|---|---|
| **Fantasy tavern** | No wood, candlelight, potion bottles, or rustic interiors. The guild identity is carried by typography, geometric heraldry, and refined class titles — not set dressing. |
| **Ornate RPG frames** | Card borders are simple 1px terminal lines with subtle double-line corners. No gold filigree, no character sheet borders, no decorative framing connecting the corners. |
| **Cartoon mascots / chibi** | Portraits are small circular avatars (40px). Class icons are refined 20×20px UI glyphs — not character sprites. No oversized art, no chibi. |
| **XP bars / leveling progress bars** | The htop workload bar shows operational load (IDLE → LIGHT → MODERATE → HEAVY → CRITICAL). These are ops terms, not game levels. No XP, no level numbers. |
| **Emoji chatter** | Zero emoji. Class icons use typographic/unicode glyphs (⚔ ✦ ♜ ⚗ ✉ ⏣ 🎨) rendered small and restrained — like UI glyphs, not emoji stickers. |
| **Fantasy heraldry** | The insignia uses circuit traces arranged in chevron geometry — a tech/heraldry hybrid executed at startup-logo quality. No lions, no Latin mottos, no medieval crests. |

### 14.3 The Hard Line Test

> "If it could be described as 'warm tavern,' 'cozy RPG,' 'Discord community,' or 'cosplay terminal,' it's off the table."

This design passes: the foundation is a premium dark startup dashboard (Vercel/Linear spatial discipline). The guild layer adds personality through restrained JRPG UI cues (class subtitles, rank chevrons, heraldry emblem, double-line corners). The terminal layer provides operational data density (monospace data, phosphor accents, circuit traces). The blend lands at "Persona 5 UI meets Linear dashboard" — refined, operational, with personality.

---

## 15. Accessibility Notes

- All status indicators include text labels (not color-only): the status dot is paired with a word label in monospace.
- Guild class subtitles are text, not images — fully accessible to screen readers.
- Rank chevrons («❶») are accompanied by the severity tag text, so the ranking information is conveyed both visually and textually.
- Focus order: AttentionRail → LeadCards left-to-right, top-to-bottom → Sora station → Status bar.
- `prefers-reduced-motion`: All entrance animations disabled. Pulse/blink animations disabled. Packet dot animations replaced with static dots at midpoint. Scanline effect disabled. Shimmer replaced with static skeleton.
- Minimum contrast: All text meets AA against `--void-2` (#080c14). The dim text color (#888888) passes AA for 11px+ monospace text.
- Screen reader: Cards have `role="article"` with `aria-label="Cloud — Warrior Engineer Class — online — moderate workload 18"`.
- Attention items have `role="listitem"` within a `role="list"` container. Severity tags read as text, not decorative.
- The dispatch log in Sora's station uses `role="log"` with `aria-live="polite"` for screen reader announcements of new entries.

---

## 16. Implementation Notes for Biscuit

### 16.1 File Creation Order (Recommended)

1. `src/types/team.ts` — AttentionItem, LeadSnapshot, WorkloadScore, DelegationEdge, TeamPageState
2. Extend `src/types/agents.ts` — add Sora + Rain to AgentId, add AgentStatus type, add guild class metadata
3. `src/state/teamStore.ts` — derived state from boardStore + projectControlStore
4. `src/components/team/FreshnessBadge.tsx` — reusable
5. `src/components/team/AttentionRail.tsx` + `AttentionItem.tsx`
6. `src/components/team/LeadCard.tsx`
7. `src/components/team/SoraConductorStation.tsx`
8. `src/components/team/DelegationLines.tsx`
9. `src/components/team/GuildInsignia.tsx` — background watermark + small emblem variant
10. `src/pages/Team.tsx` — composition + status bar
11. Modify `src/components/shell/ShellLayout.tsx` — add /team route, change default
12. Add CSS to `src/styles/theme.css` — team-specific classes + guild-amber + CRT glow tokens + double-line corner styles

### 16.2 Data Dependencies

- `boardStore` (existing): provides task counts per lead per status for workload calculation
- `projectControlStore` (existing): provides active project assignments per lead
- `sessionConnectionStore` (existing): provides connection/freshness state per source
- `shellStore` (existing): provides selectedOwner context
- Agent metadata from `AGENTS[]` (existing, to be extended with guild class fields)

### 16.3 Agent Metadata Extension

Extend the `AgentMeta` type to include guild class information:

```typescript
interface AgentMeta {
  id: AgentId;
  name: string;
  role: string;           // e.g., "systems & infrastructure"
  // NEW — guild class fields:
  guildClass: string;     // e.g., "Warrior · Engineer Class"
  guildClassIcon: string; // e.g., "⚔" — unicode glyph, not emoji
  guildHouseColor: string; // e.g., "var(--agent-cloud)"
}
```

### 16.4 Portraits

Portrait images: Not yet created. Use initials fallback until Korra's art pipeline produces them. Placeholder path: `src/assets/portraits/{agentId}.webp`. Fallback: 2-3 character initials in monospace, accent color on near-black circle with LED-ring border.

### 16.5 Class Icons

Class icons use unicode/typographic glyphs, not emoji, not sprite images:
- Cloud: `⚔` (U+2694, crossed swords) — rendered as text, 12-14px, in a 20×20px soft-square container
- Biscuit: `✦` (U+2726, black four-pointed star)
- Korra: `🎨` (U+1F3A8, artist palette) — the only emoji-category glyph, rendered at 12px to keep it UI-scale, not emoji-scale
- Lelouch: `♜` (U+265C, black rook)
- Tifa: `⚗` (U+2697, alembic)
- Rain: `✉` (U+2709, envelope)
- Sora: `⏣` (U+23E3, benzene ring / hex node)

These are styled as UI glyphs: small, mono-colored (accent at 50% opacity), no emoji presentation. Use `font-variant-emoji: text` or explicit text rendering to prevent the OS from converting them to colorful emoji.

### 16.6 Performance Considerations

- No PixiJS sprites in the team page (unlike the 3D office module). All card content is DOM-based.
- GuildInsignia SVG: Rendered once, memoized. Two variants (large watermark, small emblem) can be the same component with a `size` prop.
- DelegationLines SVG: Re-render only when edge data changes. Memoize SVG path computation.
- TeamStore: Derive attention items and workload scores with memoized selectors.
- CSS: Use `contain: layout style paint` on cards for isolation.
- CRT scanline overlay: Single fixed pseudo-element, not per-card. Disabled on `prefers-reduced-motion`.
- Follow existing motion rules: only animate opacity and transform.

### 16.7 Typography Setup

```css
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
--font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
```

- **Monospace primary:** All data displays — severity tags, timestamps, source labels, workload scores, blocker counts, dispatch log, status bar, tab headers, freshness badges.
- **Sans-serif primary:** Card names, guild class titles, attention item summaries, action labels.
- **Column alignment:** All tabular data uses monospace with explicit `ch` unit widths.

---

## 17. Visual Precedents & References

**Tone references for implementation (updated for three-way blend):**
- **Linear / Vercel dashboards** — spatial discipline, clean grid proportions, confident negative space, sans-serif identity layer, premium dark surfaces
- **Persona 5 UI** — refined menu aesthetics, stat-screen typography, restrained JRPG window chrome (double-line corners), class/faction labeling, guild identity through graphic design (not fantasy set dressing)
- **VSCode Dark Modern** — panel borders, tab chrome, monospace data density, command-palette minimalism, terminal-native UI patterns
- **Bloomberg Terminal** — data-first density, column-aligned data, phosphor-on-black aesthetic
- **htop / btop** — CPU-style workload bars, process-list density
- **Cyberpunk-lite engineering dens** — subtle glow, circuit traces, dark-room monitor aesthetics without neon excess

**Avoid looking like:**
- Generic SaaS dashboard (DataDog / New Relic clones — too much whitespace, too corporate)
- Discord / Slack (too casual, too much color noise, emoji-heavy)
- Jira / Linear boards (too task-management-oriented, not ops-focused)
- World of Warcraft UI (ornate RPG frames, gold filigree, fantasy textures)
- Fantasy tavern / cozy startup office (warm light pools, wood grain, candle glow, papyrus)
- Cosplay terminal (novelty CRT filters, excessive glow, hacker-movie aesthetics)

**The target aesthetic:** A premium dark startup dashboard with guild personality. Data-dense and operational (the terminal layer), refined and confident (the startup office layer), with restrained anime guild identity (the Persona 5 layer). It should feel like a premium SaaS team's internal tool that happens to use guild metaphors for team structure — not a game UI ported to the browser, not a terminal emulator pretending to be a dashboard.

---

*End of visual design spec. Ready for Biscuit implementation review.*
