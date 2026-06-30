# Sora-MissionControl Reset 01 — Product / Design Contract

Owner: Korra — Creative & Media
Card: `smc-reset-01-korra-product-spec`
Date captured: 2026-06-22T21:26:36-04:00
Scope: docs/artifacts only. No app implementation code was edited.

## 0. Non-negotiable product target

Sora-MissionControl must read first as a faithful Hermes Dashboard TUI clone, then as Hermes upgraded with a built-in 3D office visual component.

This reset is not a premium bespoke "Mission Control" SPA. The binding product shape is:

1. Hermes Dashboard shell and information architecture are the source of truth.
2. The 3D office is a built-in dashboard panel, not a separate app, hero page, floating toy, or custom replacement shell.
3. The main data surfaces stay honest: live/unknown/unavailable/stale are visually distinct; fake telemetry is forbidden.
4. Sora must be able to compare screenshots to this contract without a taste debate.

## 1. Reference evidence captured this session

### 1.1 Commands / runtime proof

A temporary local Hermes Dashboard reference instance was started so the dashboard could be captured without relying on the protected deployed LAN URL:

```bash
hermes dashboard --port 9121 --host 127.0.0.1 --no-open --skip-build --insecure
```

Readiness check:

```bash
for i in $(seq 1 10); do code=$(curl --max-time 2 -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9121/ || true); echo "try=$i http=$code"; [ "$code" = "200" -o "$code" = "302" ] && break; sleep 1; done
```

Observed output:

```text
try=1 http=000
try=2 http=200
```

Playwright/browser dependency had to be installed for the active Korra profile:

```bash
npx playwright install chromium
```

Observed result: Chromium, FFmpeg, and Chromium headless shell downloaded successfully under `/home/wliob/.hermes/profiles/korra/home/.cache/ms-playwright/`.

Reference capture script:

```bash
node /tmp/capture-hermes-reference.mjs
```

Observed output excerpt:

```json
{
  "outDir": "/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference",
  "rootTitle": "Hermes Agent - Dashboard",
  "kanbanTitle": "Hermes Agent - Dashboard",
  "rootTextPrefix": "HERMES\nAGENT\nthis dashboard (default)\nbiscuit\ncloud\nkorra\nlelouch\nrain\ntifa\nCHAT\nSESSIONS...",
  "kanbanTextPrefix": "HERMES\nAGENT\nthis dashboard (default)\nbiscuit\ncloud\nkorra\nlelouch\nrain\ntifa\nCHAT\nSESSIONS...",
  "consoleCount": 2
}
```

### 1.2 Reference artifacts

Screenshots:

- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference/hermes-dashboard-root-1440x950.png`
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference/hermes-dashboard-kanban-1440x950.png`

DOM notes:

- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference/hermes-dashboard-root-1440x950-dom-notes.json`
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference/hermes-dashboard-kanban-1440x950-dom-notes.json`
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference/hermes-dashboard-console.json`

Note: the capture script redacted long token-like strings in visible text/ARIA output. Do not paste raw dashboard session tokens into project docs.

### 1.3 Hermes Dashboard reference inventory

Captured at 1440×950.

Global shell:

- Page title: `Hermes Agent - Dashboard`.
- Fixed left navigation rail:
  - x: 0, y: 0, width: 240 px, height: 950 px.
  - DOM role/aria: `aside` with `aria="Navigation"`.
  - Class fingerprint includes fixed left rail, full viewport height, right border, dark base, light backdrop blur.
- Main header:
  - x: 240, y: 0, width: 1200 px, height: 53 px.
  - `role="banner"`.
  - Thin bottom border; dark translucent base.
- Main content:
  - x: 240, y: 53, width: 1200 px, height: 898 px.
  - Scrollable vertical main region.
- Base visual language:
  - Body background: near black `color(srgb 0.0156863 0.0235294 0.0313726)`.
  - Primary foreground: mint terminal green `color(srgb 0.607843 1 0.811765)`.
  - Header background: dark translucent `oklab(... / 0.4)`.
  - Primary font: `Share Tech Mono`, fallback `JetBrains Mono`, system monospace.
  - Display/nav accent font: `Mondwest`.
  - Shapes: mostly square / radius 0. Roundness is rare and semantic; the floating chat button is the obvious circular exception.

Left rail exact visible order:

1. HERMES / AGENT brand lockup.
2. Managing profile selector: `this dashboard (default)`, `biscuit`, `cloud`, `korra`, `lelouch`, `rain`, `tifa`.
3. Core nav:
   - CHAT
   - SESSIONS
   - FILES
   - MODELS
   - LOGS
   - CRON
   - SKILLS
   - PLUGINS
   - MCP
   - CHANNELS
   - WEBHOOKS
   - PAIRING
   - PROFILES
   - CONFIG
   - KEYS
   - SYSTEM
   - DOCUMENTATION
4. Plugins group:
   - KANBAN
   - ACHIEVEMENTS
5. Footer/system:
   - Gateway Status: Running
   - Active Sessions: 1
   - Restart Gateway
   - CYBERPUNK theme switch
   - EN language switch
   - v0.17.0
   - Nous Research

Root/default route reference:

- `/` redirected to `/sessions` in the capture.
- Header text: `Sessions` with count.
- Content begins with numeric summary cards/blocks: Total, Active in store, Archived, Messages.
- Secondary structure: Overview/History tabs, connected platforms, recent sessions.
- Floating Hermes chat button exists at bottom-right: x 1364, y 874, 52×52.

Kanban route reference:

- `/kanban` header text: `Kanban`.
- Main content text starts:
  - Board
  - Default · 126
  - 126 tasks
  - `?` docs link
  - `+ New board`
  - Orchestration: Auto
  - Orchestration settings
  - SEARCH / TENANT / ASSIGNEE
  - All tenants / All profiles
  - Show archived
  - Lanes by profile
  - Nudge dispatcher / Refresh / Clear filters
- Columns visible through horizontal board overflow include:
  - Triage
  - Todo
  - Scheduled
  - Ready
  - In Progress
  - Blocked
  - review
  - Done
- Kanban cards are compact, square-cornered `.hermes-kanban-card` blocks, about 262 px wide in the reference, with task id, priority, tenant, title, assignee, comment/dependency badges, and timestamp.

## 2. Binding product IA

### 2.1 Shell contract

The implementation must clone the Hermes Dashboard shell before adding Sora-specific affordances.

Required desktop shell at 1440×950:

- Left rail:
  - width: 240 px target; pass range 232–256 px.
  - fixed from top to bottom.
  - HERMES / AGENT brand at top.
  - profile selector directly below brand.
  - nav order must match the reference inventory above.
  - Sora-MissionControl may not replace the rail with a custom "Mission Control" navigation system.
- Header:
  - x starts at the end of the rail.
  - height: 53–56 px.
  - contains only the active Hermes page title and compact page-level status/actions.
  - no tall marketing hero, no command-center banner, no large custom brand strip.
- Main area:
  - begins below the header at y≈53–56.
  - background remains near-black; surface borders are mint/foreground at low opacity.
  - page content uses Hermes density, square geometry, and terminal typography.

### 2.2 Route / label contract

Keep Hermes route labels as the primary language. Sora-specific names may appear as task/project content, not as the top-level product frame.

Required visible labels:

- `HERMES AGENT`, not `Sora Mission Control` as the brand lockup.
- `CHAT`, `SESSIONS`, `FILES`, `MODELS`, `LOGS`, `CRON`, `SKILLS`, `PLUGINS`, `MCP`, `CHANNELS`, `WEBHOOKS`, `PAIRING`, `PROFILES`, `CONFIG`, `KEYS`, `SYSTEM`, `DOCUMENTATION`, `KANBAN`, `ACHIEVEMENTS`.
- Active Kanban page uses `Kanban` / `Board` / `Orchestration` / `Search` / `Tenant` / `Assignee` language.

Forbidden top-level labels unless inside task copy or lower-detail explanatory text:

- Mission Control
- Command Center
- War Room
- Ops Cockpit
- Agent Command Deck
- Executive Control
- Admin Console as the primary home frame

### 2.3 Primary target screen

The primary acceptance screenshot for reset implementation should be `/kanban` at 1440×950 because it is the live Hermes work-control surface and the reset cards are visible there.

Target first impression:

- Left rail and header look like Hermes Dashboard.
- `KANBAN` is present in the Plugins group and the main header says `Kanban`.
- Board controls and at least the first few lanes/cards are visible.
- The office panel is visible as a built-in dashboard panel, not as a separate full-screen route.

## 3. Exact office panel placement and behavior

### 3.1 Desktop placement: `/kanban`, 1440×950 reference size

The office panel is integrated into the Kanban page as a right-side dashboard panel inside the main content area.

Coordinate contract at 1440×950:

- Sidebar: x 0–240.
- Header: x 240–1440, y 0–53/56.
- Main content safe inset: x 264–1416, y 77–926.
- Office panel:
  - target x: 1008 px
  - target y: 77 px
  - target width: 408 px
  - target height: 360–420 px
  - pass range:
    - left edge x 984–1032
    - top edge y 68–92
    - width 380–440
    - height 320–460
  - It must be inside the main content flow/rail, not fixed over the nav, not floating over the chat launcher, and not an iframe-looking foreign rectangle.
- Kanban board/controls:
  - Board title and filters remain visible to the left of the office panel.
  - At least `Board`, board selector, task count, orchestration state, tenant/assignee filters, and refresh/clear actions remain visible on the first screen.
  - At least two Kanban columns with real cards or honest empty states remain visible without scrolling the page vertically.

Rationale: this preserves the Hermes Dashboard/Kanban shell while making the office visible immediately. The office is an upgrade panel, not a replacement for Hermes IA.

### 3.2 Desktop fallback placement when `/sessions` is the default route

If implementation keeps `/` redirecting to `/sessions`, the same office panel geometry applies on the Sessions overview:

- x: 1008 ±24
- y: 77 ±15
- w: 408 ±32
- h: 360–420

In that case, the left content column must preserve Hermes session summary blocks and connected-platform/recent-session content. The screenshot may pass only if the shell still reads as Hermes Dashboard and the office is the only major new visual component.

### 3.3 Tablet placement

For viewport width 768–1199 px:

- Keep Hermes nav behavior first: collapsed rail or drawer behavior may mirror the native dashboard responsive shell.
- Office becomes a full-width panel directly below the header/page controls and before the scroll-heavy Kanban lanes.
- Target height: 300–360 px.
- Chat/floating overlays must not cover the office controls.
- If horizontal Kanban lanes are present, the office should not create double horizontal scrolling.

### 3.4 Mobile placement

For viewport width 375–767 px:

- Shell must still look like Hermes Dashboard mobile, not a new mobile app.
- Office panel appears after the active page title and primary connection/board state.
- Office panel height: 240–320 px.
- Kanban controls/lists follow below.
- Minimum touch targets: 44×44 px for office focus/expand/minimize controls.
- The office must have a clear `Pause motion`/reduced-motion-respecting behavior.

### 3.5 Office panel visual grammar

Panel title:

- Use `OFFICE` or `LIVE OFFICE` in the same uppercase terminal style as Hermes nav labels.
- Do not call it `3D Mission Control`, `Agent HQ`, or `Command Room`.

Frame:

- Square-cornered or minimally chamfered TUI border.
- Border color: same mint/foreground as Hermes at low opacity, with brighter state line only for live/selected state.
- Background must grade the Pixi/canvas scene into the black dashboard with vignette/edge fade, not show a bright standalone app rectangle.

Scene:

- Isometric 2.5D office from Hermes 3D Office v2/PixiJS lineage.
- Five agent identities: cloud, biscuit, korra, lelouch, tifa.
- Warm scene colors are allowed inside the office, but the shell remains Hermes cyberpunk terminal black/mint.
- No chroma/green-screen corruption. Any opaque neon green blocks/tiles behind furniture or sprites are a fail.

### 3.6 Office behavior contract

Required behavior:

- Data linkage:
  - Office activity is derived from real Kanban/profile state when available.
  - If live data/auth is unavailable, the panel must state `unavailable`, `unauthorized`, `stale`, or `demo` explicitly.
  - It must not show fake-live agent movement as if sourced from Hermes.
- Selection:
  - Selecting an agent in the office highlights that same assignee/profile in visible page context when possible.
  - Selecting a Kanban card/assignee may focus the matching office agent.
- Motion:
  - Idle motion is subtle.
  - Working/review/blocked/done states use the existing office state semantics.
  - Blocked/review states may glow/pulse, but no endless attention animation.
  - Honor `prefers-reduced-motion`; listen for mid-session preference changes, not only initial load.
- Performance:
  - Desktop target: 60 fps when idle/light activity.
  - Minimum pass: 30 fps and no visible UI jank on resize/scroll.
  - WebGL/Pixi initialization failure must render an honest fallback panel, not a blank black rectangle.
- Lifecycle:
  - No `window.__*` globals for cross-component communication.
  - No direct auth/session/localStorage ownership inside office module.
  - No REST/WS transport inside the office component; shared adapters feed board snapshots/events.
  - Destroy/remount must clean up Pixi resources.

## 4. Visual system contract

### 4.1 Tokens to preserve from Hermes reference

Binding look:

- Base background: near black, approximately `#040608` / `color(srgb 0.0156863 0.0235294 0.0313726)`.
- Primary text/accent: mint terminal green, approximately `color(srgb 0.607843 1 0.811765)`.
- Header/panel backgrounds: translucent near-black, low opacity.
- Borders: `currentColor` at 10–20% opacity.
- Typography:
  - body/data: `Share Tech Mono`, `JetBrains Mono`, or equivalent monospace stack.
  - nav/display: `Mondwest` or visually equivalent angular terminal display face.
  - fallback must still look terminal/TUI, not generic SaaS.
- Geometry: radius 0 for most surfaces; avoid rounded SaaS cards.
- Density: compact controls and cards; do not add oversized dashboard cards.

### 4.2 Allowed enhancements

- Office panel frame and small state indicators.
- Subtle scanline/noise texture if it does not reduce readability.
- Small agent-color accents inside the office and selected-state chip only.
- A compact `LIVE`, `STALE`, `DEMO`, or `UNAVAILABLE` badge on the office panel.
- One expand/minimize control for the office panel, styled like Hermes buttons.

### 4.3 Forbidden drift list

Implementation fails visual/product acceptance if any of these are present in the primary screenshot:

1. Custom top-level brand/shell that reads as `Sora Mission Control` instead of `HERMES AGENT`.
2. Reordered/renamed nav replacing Hermes labels with Mission-Control labels.
3. Sidebar width or placement that no longer resembles Hermes Dashboard.
4. Tall hero banner, marketing copy, or bespoke landing page before dashboard content.
5. Generic admin template layout: left sidebar + topbar + KPI card grid with no Hermes TUI language.
6. Purple/blue AI gradients, neural-line backgrounds, generic particle fields, or glossy SaaS glassmorphism.
7. KPI spam: fake or decorative metric cards dominating first screen.
8. Fake telemetry, fake quota, fake cost, fake health, or fake-live office movement.
9. Admin/model/key controls as the default first impression.
10. Office rendered as a separate iframe/app with mismatched fonts, rounded cards, bright backdrop, or its own nav.
11. Office canvas covering the Hermes sidebar, header, filters, or floating chat button.
12. Chroma-key/green corruption in office assets.
13. Rainbow agent UI splashed across the shell; agent colors must stay small and semantic.
14. Consumer chat bubbles as a primary visual motif.
15. Raw JSON dumps as final UI.
16. Secret values, tokens, or credentials shown in screenshots/docs.
17. A screenshot that only proves demo mode while claiming product parity.

## 5. Implementation dependencies for Biscuit

Biscuit should not begin shell rebuild until these dependencies are acknowledged.

### 5.1 Shell / IA dependencies

- Clone the Hermes Dashboard shell layout from reference artifacts:
  - fixed 240 px left rail,
  - 53–56 px header,
  - exact nav label order,
  - terminal fonts and mint/black theme.
- Route target for first acceptance: `/kanban` with built-in office panel.
- Keep floating Hermes chat launcher position if using native dashboard behavior; office must not collide with it.

### 5.2 Office module dependencies

Reuse the frozen Office v2/Pixi contract from prior docs:

- `pixi.js@^8.4.0` already present in `package.json`.
- `xstate@^5.19.0` already present in `package.json`.
- `@use-gesture/react@^10.3.0` already present in `package.json`.
- Office assets/atlases must be served through a configurable `assetBaseUrl`.
- Office API shape:

```ts
interface OfficeModuleApi {
  init(options: OfficeInitOptions): Promise<void>;
  applyBoardSnapshot(board: KanbanBoardResponse): void;
  applyWsEvent(event: KanbanEvent): void;
  focusAgent(agentId: AgentId | null): void;
  focusZone(zoneId: OfficeZoneId | null): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
```

Do not import auth, REST/WS, chat, ops, admin, or Kanban UI modules into the office renderer. Shared adapters feed data to it.

### 5.3 Data/auth dependencies

From Cloud/reset card:

- Browser app must have a verified way to read live Hermes/Kanban state or must label it unavailable/unauthorized.
- Office panel must receive real board snapshots/events from the same source the Kanban board uses.
- Do not rely on undeclared `window.__HERMES_SESSION_TOKEN__` in a standalone external app.
- Do not invent model/admin/usage backend support.

### 5.4 Verification dependencies

Biscuit implementation handoff must include:

- Desktop screenshot at 1440×950 of target `/kanban`.
- Mobile screenshot at 375×812.
- Screenshot or visual diff showing office is not green/corrupted.
- DOM notes or Playwright assertions for sidebar/header dimensions and labels.
- `npm run lint`, `npm test -- --run`, and `npm run build` output.
- If using Playwright, a non-demo browser proof unless Sora explicitly waives live-data proof.

## 6. Visual acceptance rubric

Each item is pass/fail. A screenshot cannot pass by taste alone.

### 6.1 Desktop screenshot: `/kanban`, 1440×950

Pass if all are true:

- HERMES / AGENT brand visible in left rail.
- Left rail width is 232–256 px and starts at x=0.
- Main header starts at x≈240 and height is 53–56 px.
- Header title reads `Kanban`.
- Nav labels include the exact reference order through `ACHIEVEMENTS`.
- Theme is black/mint terminal/TUI with monospace/display terminal fonts.
- Board controls visible: `Board`, board selector, task count, `Orchestration`, `SEARCH`, `TENANT`, `ASSIGNEE`, refresh/clear actions.
- At least two Kanban lanes/cards or honest empty columns are visible.
- Office panel visible within x 984–1032, y 68–92, width 380–440, height 320–460.
- Office panel title uses `OFFICE` or `LIVE OFFICE`.
- Office scene shows coherent isometric room/agents or an honest unavailable/error fallback.
- No chroma green blocks, no blank WebGL rectangle, no fake-live claim.
- Floating chat launcher, if present, is not covered by the office.

Fail if any are true:

- Product reads first as bespoke Sora Mission Control SPA.
- Office is the whole page and Hermes dashboard shell is missing.
- Admin/model/key controls dominate first screen.
- Fake telemetry or fake live status appears.
- Office panel obscures Kanban controls or nav.

### 6.2 Mobile screenshot: 375×812

Pass if all are true:

- Hermes mobile shell/nav affordance is recognizable.
- Page title and live/board state appear before deep content.
- Office panel is visible with height 240–320 px or explicitly collapsed with a visible `OFFICE` affordance.
- No horizontal page overflow caused by the office panel.
- Controls are keyboard/touch accessible; no sub-44 px custom office controls.
- Reduced-motion path is present or documented in the UI/test proof.

### 6.3 Office visual pass/fail

Pass:

- Isometric office reads as intentional room, not broken atlas pieces.
- Five-agent roster is supported or unavailable state explains missing data/assets.
- Selected/blocked/reviewing/working states use small, consistent cues.
- Scene is visually integrated with Hermes panel frame.

Fail:

- Opaque green/chroma backgrounds.
- Sprites/furniture fragmented into atlas chunks.
- Scene cropped so agents cannot be understood.
- Camera endlessly pans/orbits by default.
- Office uses unrelated bright UI chrome.

## 7. Sora screenshot verification checklist

Sora can verify a candidate implementation with only screenshots plus command output:

1. Open reference screenshot:
   - `shared/reference/hermes-dashboard-kanban-1440x950.png`.
2. Open implementation desktop screenshot.
3. Check shell geometry:
   - left rail ≈240 px;
   - header ≈53–56 px;
   - main starts at x≈240, y≈53.
4. Check nav labels and order against Section 1.3.
5. Check active page title is `Kanban` for `/kanban` acceptance.
6. Check black/mint terminal visual grammar; reject generic SaaS/admin styling.
7. Check office panel bounding box and title from Section 3.1.
8. Check office is coherent and not green/corrupted.
9. Check unsupported data is labeled explicitly (`unavailable`, `unauthorized`, `stale`, `demo`, or `unknown`).
10. Reject if screenshot relies on demo-only proof without clear label or Sora waiver.

## 8. Notes from UI/UX skill search

`ui-ux-pro-max` guidance used for this contract:

- Data-dense dashboards may use compact grids and 8–12 px gaps, but this project must avoid KPI spam and preserve Hermes TUI density.
- Cyberpunk/TUI styling is acceptable only with accessibility discipline; neon/glow must be restrained and readable.
- Keyboard navigation, skip links, visible focus, loading states, and no keyboard traps are high-severity requirements.
- 3D/web visual components must honor `prefers-reduced-motion` reactively and avoid blank/frozen loading states.

## 9. Done criteria for reset-01

This card is complete when the following artifacts exist:

- Korra spec: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/korra/reset-01-product-spec.md`
- Shared handoff copy: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/korra-reset01-product-spec.md`
- Reference screenshots under `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference/`
- DOM notes under `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/reference/`

No implementation code changes are required or allowed for this card.
