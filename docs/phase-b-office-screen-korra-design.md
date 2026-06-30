# Sora-MissionControl — Office Immersive Screen Visual Design Spec

**Author:** Korra (Creative & Media Lead)  
**Phase:** Phase B — Office Truth Layer Design Contract  
**Date:** 2026-06-29  
**Status:** Design spec — for implementation  
**Context:** The Office is the **spatial truth layer** — an isometric/PixiJS view showing agents at desks with live state indicators. It is a separate immersive screen for focused monitoring, not a side preview on Team.  
**Visual Direction:** Premium startup office × anime guild HQ × VSCode dark/cyberpunk-lite (carried forward from Phase A).

---

## 0. Existing Office Codebase Inventory

### 0.1 Files that exist today (in `src/office/` and related)

| File | Role | Reuse/Modify Status |
|---|---|---|
| `src/office/engine/iso.ts` | Isometric projection, grid constants (16×12 at 128×64), `ZONES[]`, `AGENT_DESKS[]`, `PROPS[]`, `getWorldBounds()` | **Heavily modify** — add Rain desk, Sora station prop, reconfigure zones/spacing |
| `src/office/engine/GameRuntime.ts` | PixiJS Application lifecycle, atlases, floor painting, props, agents, camera, FPS/sleep, context-loss recovery | **Modify** — add conductor station rendering, desk indicators, ambient FX, pop-out mode support |
| `src/office/engine/AgentStateMachine.ts` | XState per-agent FSM (idle/moving/working/blocked/reviewing/celebrating → zones) | **Reuse as-is** — solid truth model; needs Rain agent added |
| `src/office/engine/pathfinding.ts` | A* grid pathfinding with blocked-cell resolution | **Reuse as-is** |
| `src/office/engine/perfMode.ts` | `computePerformanceMode()` — sleep/idle/active throttle | **Reuse as-is** |
| `src/office/engine/contextLossRecovery.ts` | WebGL context-loss/recovery handler | **Reuse as-is** |
| `src/office/engine/QualityManager.ts` | FPS-based adaptive quality tiers | **Reuse as-is** |
| `src/office/engine/webglDetector.ts` | WebGL availability check | **Reuse as-is** |
| `src/office/engine/memoryMonitor.ts` | GPU memory tracking | **Reuse as-is** |
| `src/office/engine/catchUpAnimation.ts` | Reconnect lerp animation | **Reuse as-is** |
| `src/office/entities/Agent.ts` | PixiJS Agent class — sprite container, animations, halo, speech bubble, blocked FX | **Modify** — add presence indicator, monitor glow, project badge, work-anim trigger; agent colors from Phase A |
| `src/office/entities/AgentController.ts` | Movement controller, path walking, zone targeting, catch-up | **Reuse as-is** |
| `src/office/components/OfficeModule.tsx` | React integration — composes Canvas + RoomTabs + StatusBar + AgentInfoPanel | **Heavily modify** — add pop-out button, full-screen toggle, route registration, conductor station overlay |
| `src/office/components/OfficeCanvas.tsx` | Canvas host — boots GameRuntime, gesture handling, error/loading states | **Modify** — add pop-out contract awareness |
| `src/office/components/RoomTabs.tsx` | Zone navigation tab bar | **Reuse as-is** |
| `src/office/components/StatusBar.tsx` | Bottom activity bar with agent snippets and FPS stats | **Modify** — Phase A typography + colors |
| `src/office/components/OfficeErrorBoundary.tsx` | Error boundary for canvas init failures | **Reuse as-is** |
| `src/office/components/instanceGuard.ts` | Multi-instance WebGL context guard | **Reuse as-is** |
| `src/office/store.ts` | Zustand store — agent FSMs, board sync, demo mode | **Modify** — extend to 6 agents (add Rain) |
| `src/office/adapter.ts` | Dashboard→Office type adapter (KanbanTaskCard → Office Task) | **Reuse as-is** |
| `src/office/types.ts` | Internal office types (Task, Board, WsEvent) | **Reuse as-is** |
| `src/office/demoData.ts` | Scripted demo board + event stream | **Modify** — add Rain demo tasks |
| `src/office/lib/assetManifest.ts` | Atlas frame/agent manifest, validation expectations | **Modify** — add Rain to AGENT_IDS, Sora station frames |
| `src/office/lib/assetValidator.ts` | Atlas validation at load time | **Reuse as-is** |
| `src/office/lib/debounce.ts` | Debounce utility | **Reuse as-is** |
| `src/components/shell/OfficePanel.tsx` | Container component that mounts OfficeModule | **Modify** — wire to `/office` route |
| `src/components/shell/ShellLayout.tsx` | Shell with nav rail and route dispatch | **Modify** — add `/office` route |
| `src/types/agents.ts` | Agent roster, AgentMeta, AGENTS[], guild class data | **Reuse as-is** (already has Rain and Sora) |
| `src/types/team.ts` | Team surface types (LeadSnapshot, DispatchLogEntry, etc.) | **Reuse as-is** |
| `src/styles/theme.css` | CSS custom properties — Phase A palette | **Reuse as-is** (Phase A palette already applied) |

### 0.2 Files that DO NOT exist (need creation)

| File | Purpose |
|---|---|
| `src/office/components/ConductorStation.tsx` | Sora conductor station overlay (React layer above canvas) |
| `src/office/components/PopOutButton.tsx` | Pop-out + full-screen toggle button component |
| `src/office/engine/AmbientLighting.ts` | Warm light pool rendering, CRT glow accents |
| `src/office/engine/DeskIndicators.ts` | Monitor glow, work animation trigger, blocker icon, project badge rendering |
| `src/pages/Office.tsx` | Standalone office page for `/office` route |

### 0.3 Asset requirements for new agents/stations

| Asset | Description | Status |
|---|---|---|
| `rain_base` / `rain_block` | Rain agent base/block textures in `agents` atlas | **New** |
| `rain_idle` / `rain_walk` / `rain_work` / `rain_cheer` | Rain animation spritesheets | **New** (4 spritesheets) |
| `sora_base` / `sora_block` | Sora agent base/block textures for conductor station | **New** |
| `conductor_desk` | Sora's elevated desk prop in `furniture-1` atlas | **New** |
| `conductor_chair` | Sora's chair prop in `furniture-1` atlas | **New** |
| `conductor_monitor` | Sora's multi-monitor setup prop | **New** |
| `guild_banner` | Subtle guild banner/backdrop for conductor station | **New** in `furniture-0` |
| Light pool overlay texture | Soft radial gradient for warm light pools | **New** procedural or in `fx` atlas |
| CRT scanline texture | Subtle scanline overlay (procedural or 2px tile) | **New** procedural |

---

## 1. Spatial Layout — The Office Floor

### 1.1 Grid Configuration

The office floor lives on a **16×12 isometric grid** (col × row), tile size 128×64 pixels at 1× scale. The layout is visible from the default camera position centered on the floor.

### 1.2 Zone Map (Revised for 7 entities)

```
         COL →
         0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
ROW  ┌───────────────────────────────────────────────────────┐
 0   │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·   │
 1   │  ·  A  A  A  A  ·  ·  ·  ·  C  ·  B  ·  K  ·  R   │  ← Archive (left) + Workstations (right)
 2   │  ·  A  A  A  A  ·  ·  ┌──SORA──┐  K  ·  R  ·  ·   │     Agents at desks
 3   │  ·  ·  ·  ·  ·  ·  ·  │CONDUCTOR│  ·  L  ·  T  ·   │
 4   │  ·  ·  ·  ·  ·  ·  ·  │ STATION │  ·  ·  ·  ·  ·   │
 5   │  ·  ·  ·  ·  ·  ·  ·  └─────────┘  ·  ·  ·  ·  ·   │  ← Walkway (central)
 6   │  ·  ·  ·  C  C  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·   │
 7   │  ·  ·  ·  C  C  C  ·  ·  ·  ·  B  B  B  B  ·  ·   │  ← Collaboration (left) + Break Room (right)
 8   │  ·  ·  ·  ·  C  ·  ·  ·  ·  ·  B  B  B  B  ·  ·   │
 9   │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  B  B  B  B  ·  ·   │
10   │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·   │
11   │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·   │
     └───────────────────────────────────────────────────────┘

     A = Archive       C = Collaboration     B = Break Room
     Initials = Agent desks: Cloud, Biscuit, Korra, Lelouch, Tifa, Rain
```

### 1.3 Agent Desk Positions

| Agent | Guild Class | Desk Position (col, row) | Zone | Screen Position (offset from center) |
|---|---|---|---|---|
| **Cloud** | Warrior · Engineer | (9, 2) | Workstations | Upper-right quadrant |
| **Biscuit** | Mage · Architect | (11, 2) | Workstations | Upper-right quadrant |
| **Korra** | Artist · Creator | (13, 2) | Workstations | Far upper-right |
| **Lelouch** | Strategist · Tactician | (11, 3) | Workstations | Right-mid |
| **Tifa** | Merchant · Alchemist | (13, 3) | Workstations | Right-mid |
| **Rain** | Messenger · Rogue | (14, 1) | Workstations (edge) | Far-right corner |
| **Sora** | Guild Master · Conductor | (7.5, 5.5) — spans cols 6-9, rows 3-6 | Center walkway | Center of office |

### 1.4 Sightlines

- **Default camera:** Centered on the office floor, showing all 6 desks + conductor station in a single view
- **Primary sightline:** From the "camera" (south-west isometric edge), looking north-east across the office. The walkway acts as a visual axis
- **Sora's station** is the visual anchor — dead center, elevated on a raised platform (z-height offset). All agent desks face inward toward the conductor station
- **Workstations zone:** Three rows of desks along the right side, looking left toward the conductor station
- **Depth ordering:** Farthest agents (Cloud, Biscuit, Korra — col 9-13, row 1-2) render behind, nearest agents (Rain at col 14, row 1) render in front

### 1.5 Conductor Station Placement

- **Position:** Grid center at approximately (7.5, 5.5), spanning ~3×3 tile footprint
- **Platform:** Raised 1 tile-high platform (visual z-elevation via sprite offset at -24px Y)
- **Orientation:** Faces south-west (toward the camera), making Sora's monitors visible
- **Visual distinction:** Double-monitor setup, warm platinum under-glow, guild banner backdrop. Larger desk footprint than agent desks (uses a dedicated `conductor_desk` frame at 1.15× scale)
- **Relationship to agents:** All 6 agent desks are positioned in an arc around the station — agents "report to" the conductor position. The walkway forms a moat between workstations and the station

---

## 2. Desk Zone Specifications

### 2.1 Agent Desk Assembly

Each agent desk is a stack of 3 isometric props rendered in depth order:

```
Layer 3: Monitor (frame: 'monitor', offsetY: -28, scale: 0.9)
Layer 2: Chair   (frame: 'chair',   offsetY: +8,  scale: 0.95)
Layer 1: Desk    (frame: 'desk',    offsetY: -18, scale: 1.0)
```

Agent sprite renders between Layer 1 (desk) and Layer 2 (chair), offset Y: -40 from desk center — appearing to "sit" at the desk.

### 2.2 Desk Indicators Layout (per desk)

Each desk carries a visual indicator stack, positioned above the desk in the isometric view:

```
                    ┌──────────────┐
                    │  [!] BLOCKER  │  ← Blocker badge (amber/red, floating)
                    │  (if blocked) │     y-offset: -100px from desk center
                    └──────────────┘
                         ▲
                    ┌──────────────┐
                    │ PROJECT NAME │  ← Active project badge
                    │ (if assigned)│     y-offset: -82px from desk center
                    └──────────────┘
                         ▲
              ┌──────────────────────┐
              │  ██████████████████  │  ← Monitor screen (glow when active)
              │  ████ WORKING █████  │     y-offset: -28px (existing monitor frame)
              │  ██████████████████  │     emits CRT glow in agent's guild color
              └──────────────────────┘
                         ▲
                   , - ~ ~ ~ - ,
               , '     AGENT    ' ,    ← Agent sprite at desk
             ,         , ,         ,   y-offset: -40px from desk center
             |       (@ @)       |
             |        \|/        |
              \        |        /
               ',    ,─┴─,    ,'
                 '-,_____,-'
              ┌──────────────────────┐
              │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← Desk surface
              │  ▓▓▓▓ DESK   ▓▓▓▓▓  │     y-offset: -18px
              └──────────────────────┘
```

### 2.3 Indicator Specifications

#### Monitor Glow
- **Trigger:** Agent FSM state is `working` or `reviewing` → monitor emits a subtle CRT glow in the agent's guild house color
- **Visual:** Pulsing radial gradient behind the monitor sprite, opacity 0.08–0.18, period ~2.5s
- **Idle glow:** When agent is `idle` but at desk, monitor shows a dim neutral (white 10% opacity) glow
- **No glow:** Agent offline/absent → monitor is dark, no glow
- **Implementation:** Procedural Graphics circle drawn behind monitor sprite in the FX layer, alpha animation via RAF

#### Work Animation
- **Trigger:** Agent receives a WS event or snapshot that matches their assignee with status `in_progress`, `blocked`, or `review`
- **Visual:** Agent switches to `work` animation spritesheet (typing/processing frames) for 2-4 seconds, then returns to `idle` animation
- **Truth contract:** Only triggered by real board data events, never by demo idle loops or cosmetic activity
- **Ambient idle:** Agent uses `idle` spritesheet with slow breathing cycle (subtle scale oscillation, ±1%, period ~4s). This is environmental — not work activity

#### Blocker Icon
- **Trigger:** Agent FSM state is `blocked` → badge appears above monitor
- **Visual:** Red (`#ff4444`) circle badge with "!" glyph, pulsing alpha 0.6–1.0 at ~1.5Hz. If the block is stale/aged (>1hr), shifts to amber (`#ffb000`)
- **Position:** Floating 18px above the monitor (y-offset: −100px from desk center)
- **Implementation:** PixiJS Container with Graphics circle + Text, attached to agent's container. Existing `Agent.showBlockedFx()` already handles this — extend with amber aging

#### Active Project Badge
- **Trigger:** A verified project is currently assigned to this department lead (from board/kanban data — the project name linked to the lead's active task)
- **Visual:** Small pill-shaped badge with guild amber (`#d4943a`) background at 15% opacity, project name in JetBrains Mono 9px, white text at 85% opacity. Max 16 characters, truncated with "…"
- **Position:** Between blocker icon and monitor (y-offset: −82px from desk center)
- **No project:** Badge hidden entirely (not empty placeholder)
- **Implementation:** PixiJS Text in a rounded-rect Graphics background, attached to decorLayer (not per-agent to allow shared depth sorting)

#### Agent Presence
- **Present (online/active):** Agent sprite visible at desk, `idle` or `work` animation playing
- **Away (idle but online):** Agent sprite at desk, `idle` animation at reduced speed (0.5×), slightly dimmed (alpha: 0.7)
- **Absent (offline):** No agent sprite at desk. Desk renders with empty chair, dark monitor. Floor tile remains
- **Truth contract:** Presence is driven by store FSM zone — if zone is 'break_room' and no task, agent sprite renders at the break room couch prop instead of desk. If FSM reports no agent data, desk is empty
- **Implementation:** Agent sprite visibility toggled by controller; absent agents have their container alpha set to 0

### 2.4 Zone Summary Strip (StatusBar)

The StatusBar (bottom of OfficeModule) shows per-agent activity in a compact horizontal strip:

```
[● Cloud: working on "Refactor auth…"]  [✦ Biscuit: blocked — needs help]  [🎨 Korra: in break-room standby]  …
```

**Typography:** JetBrains Mono 10px for agent name + task title, Inter 10px for status text  
**Color:** Agent guild house color dot (8px), white text for agent name, dim (`var(--text-muted)`) for snippet  
**Guild framing:** Agent class icon (⚔ ✦ 🎨 ♜ ⚗ ✉) rendered as 12px glyph preceding agent name

---

## 3. Conductor Station Design

### 3.1 Visual Architecture

Sora's station is the **spatial anchor** of the office — a raised, central dual-pane desk visible from all agent positions.

```
                   ┌─────────────────────────────┐
                   │  ⏣ SORA · GUILD MASTER       │  ← Warm platinum tab header
                   │  Conductor Class              │
                   ├──────────────┬──────────────┤
                   │              │              │
                   │  DISPATCH    │  SYSTEM      │
                   │  LOG         │  HEALTH      │
                   │              │              │
                   │  14:32:17    │  ▓▓▓▓▓▓▓▓▓░ │  ← htop-style bars
                   │  Cloud:      │  HEALTHY     │
                   │  claim task  │              │
                   │              │  AGENTS      │
                   │  14:28:01    │  6/7 ONLINE  │
                   │  Biscuit:    │              │
                   │  blocked···  │  DELEGATIONS │
                   │              │  3 ACTIVE    │
                   │  14:25:44    │              │
                   │  Tifa:       │  UPTIME      │
                   │  review req  │  14:32 UTC   │
                   │              │              │
                   ├──────────────┴──────────────┤
                   │  ⏣  GUILD INSIGNIA (bg)     │  ← Subtle watermark
                   └─────────────────────────────┘
```

### 3.2 Dual-Pane Layout

**Left Pane — Dispatch Log:**
- **Title:** "DISPATCH" in JetBrains Mono 10px uppercase, guild amber tint
- **Content:** Live-scrolling log of the 5 most recent task events (created, claimed, started, blocked, completed, review_requested)
- **Format:** `HH:MM:SS  AGENT:  event description` — monospace, timestamp in dim text, agent name in guild house color
- **Updates:** Appends on WS events; scrolls oldest entries off top
- **Max entries:** 5 visible, with a subtle gradient fade at the top to indicate scroll

**Right Pane — System Health:**
- **Title:** "SYSTEM" in JetBrains Mono 10px uppercase, guild amber tint
- **Content:**
  - **System health bar:** htop-style filled bar (`▓▓▓▓▓▓░░`) in CRT green (`#00ff41`) when healthy, amber when degraded, red when offline. Label: "HEALTHY" / "DEGRADED" / "OFFLINE"
  - **Agent status:** "6/7 ONLINE" (or current count) in monospace
  - **Active delegations:** Count of active delegation edges from Team surface
  - **Uptime:** Current UTC time or system uptime string
- **Background:** Guild insignia watermark at 3% opacity behind the right pane

### 3.3 Warm Platinum Accent

- **Color:** `#f0e8d8` (warm platinum — not cold white, not gold)
- **Usage:**
  - Tab header border-bottom: 2px warm platinum at 35% opacity
  - Station desk surface: warm platinum under-glow (radial gradient, 5% opacity)
  - Sora's portrait ring: warm platinum 1.5px border (when portrait displayed)
  - Guild insignia lines: warm platinum at 8% opacity
- **Distinction:** This is NOT gold (`#d4943a` is guild amber, used elsewhere). Warm platinum is a cooler, parchment-toned white that signals "authority without royalty"

### 3.4 Rendering Approach

The conductor station is a **React overlay** rendered above the PixiJS canvas, not inside it:

- **Why React:** The station contains text-heavy UI (dispatch log, health stats) that benefits from DOM rendering (accessibility, crisp text at all zoom levels, easy styling)
- **Position:** Fixed at the center of the canvas viewport, positioned absolutely using the isometric-to-screen transform
- **Sync:** Station position recalculated on camera pan/zoom — it "sticks" to Sora's grid position
- **Prop layer:** Sora's physical desk, chair, and monitor props render in PixiJS (depth-sorted with other furniture). The UI overlay renders on top

### 3.5 Sora Portrait (Secondary Identity)

While the station is the primary visual metaphor, a small Sora portrait (24×24px circular) sits in the station tab header, left of the name. This is the same portrait identity used in Team cards. For Office, it's minimized — the station is the focus.

---

## 4. Pop-Out Mechanic UX

### 4.1 Button Design

**Position:** Top-right corner of the OfficeModule container, inside the RoomTabs bar area  
**Visual:**
```
┌──────────────────────────────────────┐
│  [WRK] [COL] [BRK] [ARC]     [⛶] [↗]│  ← RoomTabs row + pop-out buttons
└──────────────────────────────────────┘
```
- **[⛶] Full-screen:** Toggles full-screen mode on the current browser tab
- **[↗] Pop-out:** Opens the Office in a dedicated browser window

**Styling:** 28×28px icon buttons, monochrome warm-platinum tint. Hover: background `rgba(240, 232, 216, 0.08)`. Active: background `rgba(240, 232, 216, 0.15)`.

**Tooltip:** "Open Office in own window" / "Toggle full screen"

### 4.2 Pop-Out Window Behavior

**Trigger:** `window.open('/office?popout=1', 'sora-office', 'width=1200,height=800')`

**Window features:**
- Named window `sora-office` — subsequent clicks focus the existing window instead of opening duplicates
- Size: 1200×800 (resizable by user)
- No browser chrome features specified (uses browser default minimal)
- The `/office?popout=1` URL renders a minimal shell: **no left nav rail, no MissionBar, only the OfficeCanvas + ConductorStation + StatusBar**

**Pop-out page layout (OfficePopout shell):**
```
┌─────────────────────────────────────────────────────┐
│  ⏣ SORA-MISSIONCONTROL · OFFICE        [_] [□] [×] │  ← Minimal title bar
├─────────────────────────────────────────────────────┤
│                                                     │
│               OFFICE CANVAS                         │
│          (full viewport, no nav)                    │
│                                                     │
│         ┌── Conductor Station ──┐                   │
│         │  (React overlay)      │                   │
│         └───────────────────────┘                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [● Cloud: working…] [✦ Biscuit: idle…] … 24 FPS  │  ← StatusBar
└─────────────────────────────────────────────────────┘
```

### 4.3 Read-Only Contract

The pop-out Office window is **read/observe-first** at Phase B:

- ✅ View the office, pan/zoom, tap agents to select, view agent info panel
- ✅ Full-screen mode available
- ✅ Conductor station visible with live dispatch log + system health
- ✅ All desk indicators active and truthful
- ❌ No commands — cannot create tasks, reassign work, send chat messages
- ❌ No Team/AttentionRail — Office is spatial monitoring only
- ❌ No navigation to other screens — single-page office view
- 🔮 Future phase may add limited command actions (e.g., "focus agent in Team")

**Close behavior:** Closing the pop-out window has no effect on the main dashboard. The dashboard's Office tab (if open) continues independently.

### 4.4 Full-Screen Mode

**Trigger:** `element.requestFullscreen()` on the OfficeModule container  
**Exit:** ESC key or browser full-screen exit button  
**Behavior:** Office canvas expands to fill the entire screen. RoomTabs + StatusBar remain visible in overlay mode (auto-hide after 3s of no pointer movement, re-appear on pointer move). Conductor station overlay scales with viewport.

---

## 5. Ambient Lighting Design

### 5.1 Warm Light Pools

The premium startup office atmosphere comes from **warm light pools** — localized areas of soft illumination that create depth without fantasy decor.

**Implementation:**
- Procedural radial gradient sprites (256×256px, soft falloff) rendered on the FX layer
- 3-5 light pools placed at key locations:

| Light Pool | Position (col, row) | Color | Intensity | Source |
|---|---|---|---|---|
| Desk lamp (Cloud/Biscuit/Korra row) | (11, 2) | `#d4943a` (guild amber) | 6% opacity | Subtle warm glow over the workstations row |
| Desk lamp (Lelouch/Tifa row) | (11, 3) | `#d4943a` | 5% opacity | Lower row ambient |
| Conductor station under-glow | (7.5, 5.5) | `#f0e8d8` (warm platinum) | 4% opacity | Very subtle platinum aura beneath the station platform |
| Break room couch area | (10, 8) | `#d4943a` | 7% opacity | Warmest pool — the break zone |
| Collaboration table | (3, 7) | `#00d4ff` (CRT cyan, cool) | 4% opacity | Cooler light for the meeting area — intentional temperature contrast |

**Animation:** Light pools gently oscillate in intensity (±15%, period ~8s, out of phase with each other). This is ambient/environmental motion — it affects the room, not the agents.

### 5.2 CRT Glow Accents

CRT phosphor glow effects reinforce the cyberpunk-lite terminal aesthetic:

**Per-Monitor CRT Glow:**
- Each agent's monitor emits a subtle colored halo when active:
  - Active (working): 0.12 opacity glow in agent's guild house color, radius ~40px behind monitor
  - Blocked: Amber CRT (`#ffb000`) glow at 0.15 opacity
  - Idle: Neutral white at 0.05 opacity
- Implementation: Graphics circle rendered behind monitor sprite in FX layer

**Ambient Scanlines (Optional):**
- A single CSS overlay over the entire Office page: `repeating-linear-gradient` at 2px intervals, 1.5% opacity
- Togglable via URL param `?scanlines=1` or saved user preference
- Disabled when `prefers-reduced-motion` is active
- Performance: Single fixed-position element, not per-canvas

### 5.3 Particle / Atmospheric Float

- **Dust motes:** 6-10 tiny particles (2px circles) floating in the warm light pools. Very low opacity (4-8%). Slow drift (0.2px/frame). Reinforces the "late-night ops room" feel.
- **Data motes (near Sora station):** 3-4 cyan `#00d4ff` particles near the conductor station — like data fragments in the air. Very subtle.
- **Implementation:** PixiJS particle container or manual Graphics dots animated in GameRuntime ticker
- **Disabled:** When `prefers-reduced-motion` or quality tier is `low`

### 5.4 Desk Lamp Flicker

- **One lamp prop per desk area:** The `lamp_floor` prop in the break room, plus a procedural desk lamp glow
- **Animation:** Very subtle brightness oscillation (±8%, period ~6s with slight randomness). Feels like a real lamp, not a blinking alarm
- **Truth:** Ambient only — never synced to agent activity or task state

---

## 6. States

### 6.1 Loading State

- **Canvas:** Dark void background (`#0b111a`) with centered spinner
- **Spinner:** 32px circle, 2px cyan border with transparent top, CSS spin animation
- **Text:** "Initializing office canvas…" in JetBrains Mono 10px, dim text, centered below spinner
- **Duration:** Typically <2s for atlas loads; up to 15s if retrying
- **Transition:** Spinner fades out (300ms), canvas fades in (500ms)

### 6.2 Populated State (All Agents Present)

- **Visual:** All 6 agent desks occupied with sprites, Sora station active at center
- **Indicators:** Monitor glows reflecting current FSM state, work animations triggered by board events, blocker badges visible where applicable, project badges rendered
- **Conductor station:** Dispatch log scrolling, system health showing HEALTHY, 6/6 or 7/7 agents online
- **Ambient:** Light pools at full intensity, CRT glows active
- **StatusBar:** All 6 agent snippets visible with live FPS

### 6.3 Partial State (Some Agents Absent)

- **Visual:** Present agents at desks with full indicators; absent agents leave empty desks
- **Empty desk:** Desk + chair + dark monitor props remain (furniture stays). Agent sprite is hidden (alpha: 0). No monitor glow. No blocker/project badges
- **Conductor station:** Agent count reflects actual online count (e.g., "4/7 ONLINE"). System health may show DEGRADED if too many absences correlate with system issues
- **StatusBar:** Only present agents shown in the strip; absent agents omitted

### 6.4 Empty State (Offline Mode — No Data)

- **Visual:** All desks empty, all monitors dark, no agent sprites anywhere
- **Conductor station:** Dispatch log shows "No dispatch activity — system offline." System health shows OFFLINE in red. Agent count: "0/7 ONLINE"
- **Ambient:** Light pools still active (environmental, not agentic) but at reduced intensity (50%)
- **StatusBar:** "No active agent telemetry is reporting work right now." in dim text
- **Transition:** When data arrives, agents populate at their desks with the reconnect catch-up animation (1s ease-out lerp from edge of frame)

### 6.5 Degraded State (Partial Data Loss)

- **Trigger:** Some data sources report `degraded` or `stale` provenance
- **Visual:** Desks with stale data show a subtle amber tint overlay (2px amber border on desk footprint, 8% opacity)
- **Conductor station:** System health shows DEGRADED in amber CRT. Affected agents have "⚠" prefix in dispatch log
- **Indicator behavior:** Monitor glow may be slightly dimmed (70% of normal). Project badge may show "stale" in amber text
- **Truth:** Degraded agents do NOT show work animations — only verified-work drives animation
- **Recovery:** When data returns to `live`, amber tint fades over 1s, indicators return to full intensity

### 6.6 Error State

- **WebGL unavailable:** Full-screen error card: "WebGL Unavailable" with browser compatibility link and retry button
- **Atlas load failure:** "Office assets unavailable" with retry. Canvas does not render. RoomTabs and StatusBar still visible in empty state
- **Runtime crash:** OfficeErrorBoundary catches, shows graceful fallback card: "Office canvas offline — Runtime error: [message]" with retry
- **Per-agent asset error:** Individual agent renders with static fallback texture (no animation). Amber indicator in StatusBar: "⚠ ASSET 1 fallback" (existing behavior from Phase 2, audit #4 / R12)
- **Reconnect:** When Kanban WS reconnects after drop, catch-up animation lerps agents to new positions. No data loss — board re-fetches and FSM updates

---

## 7. Guild Cues Conformance for Office

### 7.1 Approved Cues (5 → applied to Office)

| Cue | Office Application |
|---|---|
| **Insignia** | Guild crest watermark at 3% opacity behind the conductor station right pane. Also rendered as a subtle backdrop behind the break room couch area. |
| **Conductor station** | The primary spatial anchor — Sora's raised central desk with dual-pane UI, warm platinum accent, dispatch log, and system health. |
| **Warm office light pools** | Radial gradient light pools at desks, break room, and conductor station. Guild amber tint (`#d4943a`). Gentle oscillation. |
| **Role titles** | Agent guild class subtitles rendered in the agent info panel and as small floating labels above desk (9px Inter, muted). |
| **Subtle banners** | Narrow accent bars (2px wide, guild house color) on the left edge of the conductor station tab header. Per-agent color dots in StatusBar. |

### 7.2 Forbidden Cues (5 → strictly avoided)

| Cue | Office Avoidance |
|---|---|
| **Fantasy tavern** | No wooden tables, candles, potion bottles. Clean modern desks with monitors. The "guild" is digital ops, not medieval fantasy. |
| **Ornate RPG frames** | No gold borders, filigree, or character sheets. Station uses clean terminal-panel borders, 1px rule lines. |
| **Cartoon mascots / chibi** | Agent sprites are 48×48 isometric pixel art, not oversized chibi characters. No expressive emoji faces. |
| **XP bars / leveling** | No progress bars for agent "levels." htop-style workload bars are used for system health only (functional, not gamey). |
| **Emoji chatter** | No speech bubbles, reaction emojis, or decorative chat noise. Agent speech bubbles (already implemented) are used only for task-status text in demo mode — not emoji reactions. |

### 7.3 The Hard Line (as defined in product spec §11)

> If a visual element could be described as "cute," "cartoony," or "RPG character sheet," it's off the table. If it could be described as "premium," "restrained," or "command center with soul," it's on it.

**Office-specific application:** The agent sprites are pixel-art isometric characters — they have personality but in a "premium pixel-art RPG" way, not a "cute chibi" way. The conductor station is a mission-control desk, not a throne. The light pools are architectural lighting, not magical auras.

---

## 8. Color & Typography Transfer from Phase A

### 8.1 Color Palette (carried forward unchanged)

**Dark base (depth layers):**
- `--void-0: #000000` — true black (CRT bezel)
- `--void-1: #04070c` — near-black with warm amber hint
- `--void-2: #080c14` — elevated surface (cards, panels)
- `--void-3: #0c101a` — hover surface

**Guild amber underlayer:**
- `--guild-amber: #d4943a` — warm guild gold, used for light pools, rank indicators, underlayer warmth
- `--guild-amber-dim: rgba(212, 148, 58, 0.12)` — subtle overlays
- `--guild-amber-glow: rgba(212, 148, 58, 0.05)` — ambient glows

**CRT phosphor accents:**
- `--crt-green: #00ff41` — healthy/verified/online, system health bar
- `--crt-amber: #ffb000` — warning/stale/degraded, aged blocker badges
- `--crt-cyan: #00d4ff` — live/active/data-stream, dispatch log highlights
- `--crt-red: #ff4444` — blocked/failed/offline, blocker icons
- `--crt-violet: #9944ff` — command/review/escalation

**Agent guild house colors (unchanged):**
- Cloud: `#4488ff` · Biscuit: `#ffb000` · Korra: `#ff4499`
- Lelouch: `#9944ff` · Tifa: `#00ff66` · Rain: `#00ccff` · Sora: `#f0e8d8`

**Office-specific additions:**
- `--office-light-pool: rgba(212, 148, 58, 0.06)` — warm light pool base opacity
- `--office-crt-scanline: rgba(0, 0, 0, 0.015)` — scanline stripe opacity
- `--office-station-glow: rgba(240, 232, 216, 0.04)` — conductor station under-glow
- `--office-desk-empty: rgba(100, 110, 130, 0.15)` — empty desk tint
- `--office-desk-degraded: rgba(255, 176, 0, 0.08)` — degraded desk tint

### 8.2 Typography Transfer

| Usage | Font | Size | Weight | Office Context |
|---|---|---|---|---|
| Agent name (info panel) | Inter | 15px | 600 | Agent info detail panel |
| Guild class subtitle | Inter | 11px | 500, +0.04em ls | Floating label above desk |
| Zone labels (canvas) | Inter | 14px | 400 | Existing zone name labels on canvas |
| Conductor station headers | JetBrains Mono | 10px | 500, uppercase | "DISPATCH" / "SYSTEM" labels |
| Dispatch log entries | JetBrains Mono | 10px | 400 | Timestamp, agent name, event |
| System health labels | JetBrains Mono | 10px | 400 | "HEALTHY" / "6/7 ONLINE" |
| Project badge | JetBrains Mono | 9px | 400 | Desk project name |
| StatusBar agent snippets | JetBrains Mono | 10px | 400 | Agent name + task title |
| StatusBar status text | Inter | 10px | 400 | Status snippet text |
| RoomTabs labels | Inter | 11px | 400 | Zone tab names |
| RoomTabs codes | JetBrains Mono | 9px | 650, +0.08em ls | "WRK" / "COL" / "BRK" / "ARC" |
| Pop-out button tooltips | Inter | 11px | 400 | "Open in own window" |
| Error/loading text | JetBrains Mono | 10px | 400 | Error messages, loading states |
| Blocker "!" glyph | Inter | 14px | 700 bold | Blocker icon text |

### 8.3 PixiJS Canvas Typography

Text rendered inside the PixiJS canvas (zone labels, floating desk labels, project badges) uses PixiJS Text objects with:
- `fontFamily: 'Inter, system-ui, sans-serif'` for identity text
- `fontFamily: '"JetBrains Mono", monospace'` for data text
- PixiJS `TextStyle.dropShadow` for readability against the dark office background

---

## 9. Implementation Notes

### 9.1 Route Registration

Add `/office` route to `ShellLayout.tsx`:
- Add `{ id: 'office', label: 'OFFICE', path: '/office', view: 'office' as const, title: 'Office' }` to `PLUGIN_ROUTES`
- Add `activeRoute.id === 'office'` branch in the main render to mount `OfficePanel`
- The existing `OfficePanel` wraps `OfficeModule` — no structural change needed

### 9.2 Pop-Out Route

Create a lightweight route/page at `/office?popout=1`:
- Minimal shell: no left nav, no MissionBar
- Full-viewport OfficeCanvas + ConductorStation overlay + StatusBar
- Read-only contract enforced by omitting action buttons

### 9.3 Rain Agent Integration

- Add `{ id: 'rain', name: 'Rain', color: 0x00ccff, deskCol: 14, deskRow: 1 }` to `AGENT_DESKS` in `iso.ts`
- Add Rain desk props (desk + chair + monitor) at `(14, 1)` in `PROPS[]`
- Add `'rain'` to `AGENT_IDS` in `assetManifest.ts`
- Add Rain base/block textures to `STATIC_ATLAS_FRAMES.agents`
- Create Rain animation spritesheets (idle, walk, work, cheer)
- Office store `initAgents()` already iterates `AGENT_DESKS` — Rain will be auto-included

### 9.4 Conductor Station — Dual Implementation

**PixiJS layer:** Sora's physical desk, chair, multi-monitor props (depth-sorted in decor layer)  
**React overlay:** ConductorStation component positioned absolutely based on grid-to-screen transform, re-rendered on camera change  
**Sync:** `GameRuntime` exposes `getScreenPosition(col, row)` → ConductorStation reads it via a ref or callback

### 9.5 Desk Indicators — Performance Notes

- Monitor glows, blocker badges, and project badges are lightweight PixiJS Graphics/Text objects
- Per-desk: ~3 additional display objects (glow circle, blocker container, project badge text)
- 6 desks × 3 objects = 18 additional display objects — negligible for PixiJS v8 WebGL
- Badge visibility toggled by store FSM state (React → runtime bridge via `syncAgentIndicators`)
- All desk indicators live in the `fxLayer` for proper depth sorting

---

## 10. Acceptance Criteria

- [ ] Office renders at `/office` route as a full-screen immersive view
- [ ] 6 agent desks visible with agents present/absent based on live data
- [ ] Sora conductor station renders at center with dispatch log + system health
- [ ] Desk indicators (monitor glow, blocker icon, project badge) reflect live truth
- [ ] Work animations trigger only on real board events, not idle loops
- [ ] Pop-out button opens Office in separate window at `/office?popout=1`
- [ ] Full-screen toggle works via browser API
- [ ] Pop-out mode is read-only (no commands)
- [ ] Warm light pools render with gentle ambient oscillation
- [ ] CRT monitor glow reflects agent activity state
- [ ] Loading, populated, partial, empty, degraded, and error states all render correctly
- [ ] No forbidden guild cues present (fantasy tavern, ornate frames, chibi, XP bars, emoji chatter)
- [ ] Phase A color palette applied consistently
- [ ] Phase A typography (JetBrains Mono for data, Inter for identity) applied consistently
- [ ] Reduced-motion mode disables ambient animations (light pool oscillation, particle float, scanlines)
- [ ] Build/tests pass; no regression in existing office tests

---

**End of Phase B Office Screen Design Spec.**  
Questions to Biscuit (Architecture) for feasibility checkpoint before implementation begins.
