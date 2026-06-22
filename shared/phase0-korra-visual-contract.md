# Phase 0 Korra Visual Contract — Sora Mission Control

Status: Contract draft for Phase 0 research handoff; no implementation in this file.
Owner: Korra, Creative & Media
Sources reviewed: `/home/wliob/projects/Sora-MissionControl/OVERVIEW.md`, `/home/wliob/projects/hermes-3d-office-v2/PLAN.md`
Preference lock: premium dark mission-control, highly custom, aesthetic, clutter-free, not generic AI-looking. OpenClaw Mission Control is UX inspiration only; do not copy its visuals.

## 0. Creative thesis

Sora Mission Control should feel like a private operations room for one human orchestrating many specialized agents: quiet, precise, alive, and expensive. The first screen must not read as a generic SaaS dashboard. It should read as a custom command surface where the 3D office is the living truth source, chat is the direct control channel, and live ops is the risk/cost telemetry layer.

Design posture:
- Native dark interface, not a light app inverted to dark.
- Near-black/navy depth with restrained cyan, violet, and per-agent accents.
- Luminance, spacing, and typography create hierarchy before cards, icons, or charts do.
- 3D office warmth is allowed inside the scene; surrounding UI chrome stays cool, technical, and quiet.
- Every visible element must answer: Who is active? What is moving? What needs attention? What can I command next?

### Gundam 00 Exia Influence (Mecha Style)
- Primary inspiration: Mobile Suit Gundam 00, Exia / Celestial Being aesthetic.
- Obvious mecha/HUD cues: sharp angular lines, green/blue particle accents, visor-style HUD overlays, GN drive glow effects.
- Color palette: Exia's primary white/gold/blue with GN drive green; adapt to mission control: keep dark base, add Exia green as active accent, gold for highlights, blue for secondary.
- UI elements: panel borders with GN drive hex patterns, status indicators shaped like GN condensers, chat input reminiscent of Exia's cockpit HUD.
- Motion: subtle particle bursts on state changes, gentle oscillating glow on active elements.
- Ensure mecha enhancements do not compromise clarity or increase clutter; keep them as refined accents, not overwhelming decoration.

## 1. Visual system direction for the first-screen trio

The first screen is a three-part operational composition:
1. Center: 3D Office / live presence layer.
2. Left or lower-left: Chat / command layer.
3. Right or lower-right: Live Ops / telemetry layer.

The trio must feel like one instrument panel, not three embedded apps.

### 1.1 Global atmosphere

Required qualities:
- Premium mission-control darkness: charcoal, black-blue, and graphite surfaces.
- Thin atmospheric borders: subtle rgba white/cyan lines, never heavy boxes.
- Precision typography: Inter/Geist-style sans for UI, JetBrains Mono/Geist Mono for tokens, IDs, cost, limits, timestamps, and technical telemetry.
- Sparse glow language: cyan = live/connected, violet = command/focus, amber = warning, red = blocked/risk. Glow is a state indicator, not decoration.
- Deep negative space: allow the office and critical telemetry to breathe.
- No rainbow palette. Agent colors exist, but they must be harmonized through muted chips, hairlines, small badges, and scene sprites.

Suggested token posture, to be refined in Phase 1:
- Background base: near-black navy/charcoal, e.g. `#05070d`, `#080b12`, `#0b111a`.
- Elevated surface: low-luminance slate, e.g. `rgba(255,255,255,0.035)` to `rgba(255,255,255,0.07)`.
- Border: `rgba(255,255,255,0.07)` baseline; cyan/violet border only for active state.
- Primary text: softened white, not pure white.
- Muted text: blue-gray, readable but clearly secondary.
- Accent: cyan for live system energy, violet for Sora/command focus.
- Status: green only for healthy/connected, amber for attention, red for failure/blocked.

### 1.2 Chat module visual direction

Role: Direct command and conversation surface.

The chat module should feel like a command console with human warmth, not a generic messenger clone.

Required treatment:
- Visually subordinate to the 3D office on first load, but instantly legible and reachable.
- Use a compact profile/agent rail or selector with per-agent accent markers; avoid large avatars unless the conversation state demands it.
- Message groups should be calm, high-contrast, and low-chrome. Avoid bubbly consumer-chat styling.
- Input area should feel like a command bar: focused, keyboard-friendly, with a strong but quiet active state.
- Show agent status in the chat header using the same presence semantics as the office and ops panel.
- If chat is idle, show one useful prompt or last active thread. Do not fill space with fake suggestions.

Hierarchy within chat:
1. Current selected profile and status.
2. Latest actionable message / active thread.
3. Composer / command input.
4. Thread navigation / history.
5. Secondary metadata.

### 1.3 3D office visual direction

Role: Living proof of system state and active work.

The office remains the emotional center of the product. It is not decorative wallpaper. It is the presence model.

Required treatment:
- Center-stage on desktop/tablet first screen unless constrained by viewport.
- Preserve v2 intent: isometric 2.5D, PixiJS scene, avatars, movement, zones, speech/status cues, activity bubbles, and camera feel.
- Surrounding dashboard UI must frame the office like an observation deck: dark, quiet, technical, not cartoonish.
- The office scene may retain warmer cozy startup tones, but the dashboard shell must grade it into the premium mission-control aesthetic through vignette, edge fade, overlay labels, and restrained chrome.
- Agent identity colors from v2 are allowed, but never let them become a scattered rainbow UI. Use them in small, repeated anchors: sprite palette, status line, chip, focus halo.

Hierarchy inside office:
1. Current agent positions and movement.
2. Blocked/review/completed state cues.
3. Active zone identity.
4. Agent name/task details on selection.
5. Ambient texture/light.

### 1.4 Live ops visual direction

Role: Risk, cost, rate-limit, and connection telemetry.

The live ops module should be the quiet instrument cluster: glanceable, credible, and impossible to confuse with vanity analytics.

Required treatment:
- No marketing charts. No fake analytics. No generic KPI grid.
- Prioritize risk state over raw quantity. The user should first know whether anything is near a limit, burning budget, disconnected, or blocked.
- Use compact meters, threshold bands, and event strips instead of large decorative graphs.
- Use mono numerals for tokens, spend, rate-limit windows, queue depth, and retry timing.
- Use color only at thresholds. Normal state should be mostly neutral/cyan, not green everywhere.

Hierarchy within live ops:
1. Critical alerts / threshold breaches.
2. Connection health and live sync state.
3. Rate-limit pressure and reset windows.
4. Token/cost burn and recent deltas.
5. Low-priority logs or historical sparkline context.

## 2. Layout priorities and information hierarchy

### 2.1 First-screen priority order

The first screen must answer these in order:
1. Is Hermes connected and live?
2. Which agents are active, blocked, reviewing, or idle?
3. What can I command or ask right now?
4. Are costs, rate limits, or system health risky?
5. Where do I navigate for deeper admin/project control?

This priority order overrides visual symmetry. A beautiful layout that delays these answers fails the contract.

### 2.2 Desktop / wide layout

Preferred wide composition:
- Center: 3D office as dominant canvas, approximately 45–60% of visual weight.
- Left: chat rail/panel, approximately 24–30% width, optimized for direct interaction.
- Right: live ops rail/panel, approximately 20–26% width, optimized for scan and alerts.
- Top: minimal mission bar with product identity, global connection state, current mode, and primary navigation. Keep it thin.
- Bottom/edge: optional event ticker only if it carries real, deduplicated information.

Rules:
- Do not equalize all panels. The office is the anchor.
- Do not create a dense 12-card overview grid above the office.
- Navigation should be present but quiet; first screen is an operating surface, not a site map.
- Put admin/Kanban deeper unless there is an active alert or active ownership state that belongs on first screen.

### 2.3 Tablet / medium layout

Preferred medium composition:
- Office remains primary, with chat and ops as docked drawers or stacked side panels.
- Chat should be one gesture away; ops alerts should remain visible as a compressed strip/pill.
- If only two modules can be visible, show office + the currently active control surface, with ops critical state promoted to the mission bar.

### 2.4 Mobile / narrow layout

Preferred narrow composition:
- Use a mode switch or segmented navigation: Office, Chat, Ops.
- Mission bar always shows connection and highest-risk ops state.
- Office overview remains first unless the user arrives from a chat/alert deep link.
- Chat composer must not fight the viewport; use a bottom command surface.

### 2.5 Density rules

Use density only where it improves operations:
- Dense: log strips, message metadata, rate-limit windows, task IDs.
- Medium: chat messages, selected agent detail, ops summaries.
- Spacious: office canvas, primary status, first-screen composition.

No module may add filler cards to balance layout. Empty space is acceptable when state is empty.

## 3. Motion and 3D office integration rules

### 3.1 Motion purpose

Motion must do one of four jobs:
1. Confirm state changed.
2. Show continuity between modules.
3. Direct attention to risk or activity.
4. Make the living office feel alive without stealing focus.

Motion that only adds spectacle is forbidden.

### 3.2 3D office integration rules

Required:
- The office scene is a single living canvas embedded in the shell; it should not be visually treated like an iframe or unrelated app.
- React/DOM overlays may label selected agents, states, and mission chrome, but they must match the same token system as chat and ops.
- Agent state semantics must match across modules:
  - Idle = muted/neutral, low motion.
  - Working = subtle cyan/agent-accent activity cue.
  - Blocked = red/amber pulse, immediate ops and chat correlation.
  - Reviewing = violet/amber collaborative cue.
  - Done = short celebration, then settle; no endless confetti.
- Clicking/selecting an agent in the office should visually bind chat and ops to that agent using the same accent color and label language.
- Live ops alerts should be able to annotate the office lightly, but not cover it with badges.

Prohibited:
- Free-flying camera as default. Maintain the v2 fixed overview gestalt.
- Constant panning, orbiting, or parallax that makes the office harder to read.
- Canvas effects that obscure agent movement or task-state cues.
- Treating the 3D office as a decorative hero image with no data linkage.

### 3.3 Timing and easing

Baseline rules:
- Micro-interactions: 120–220ms.
- Panel open/close: 180–280ms.
- Office reveal: up to 800ms on initial load, only after real data/demo mode is ready.
- Agent movement follows v2 state-machine timing and queues; do not interrupt with frantic UI animation.
- Alerts should appear fast but calm: no shake except authentication/input failure.

### 3.4 Reduced motion and performance

Required:
- Honor `prefers-reduced-motion` across shell and office.
- Reduced motion mode: no decorative sweeps, slow/disable idle loops, fade/teleport office movement where v2 already specifies.
- Motion must be transform/opacity-based in DOM surfaces.
- No module may introduce a looping animation without an idle budget and reduced-motion behavior.
- 3D office performance budget from v2 remains binding: 30fps minimum on iPad-class devices, 60fps target desktop, no per-frame allocation patterns.

## 4. Forbidden generic dashboard patterns

The following patterns are disallowed unless explicitly approved in a later design review:

- Generic AI SaaS hero gradients: oversized purple/blue blobs, particle fields, neural-network lines, magic sparkles.
- Glassmorphism by default: frosted panels, heavy backdrop blur, translucent cards stacked everywhere.
- KPI card spam: four/eight metric cards across the top with arbitrary numbers.
- Chart wallpaper: donut charts, radial gauges, and decorative sparklines that do not drive decisions.
- Stock admin-template layout: sidebar + topbar + card grid with no custom composition.
- Emoji-heavy AI personality UI outside intentional v2 office moments.
- Random icon grids and colorful badges for every label.
- Heavy rounded rectangle syndrome: large pill/card shapes used as a substitute for hierarchy.
- Rainbow agent UI: every module splashed with all five agent colors at once.
- Fake data or placeholder metrics that look real.
- Copy like “insights,” “optimize,” “unlock productivity,” or “AI-powered” unless tied to a real action.
- OpenClaw visual cloning. Its clarity and one-screen discipline are the reference, not its exact screen style.
- Overbuilt navigation that makes the first screen feel like an admin portal before it feels like mission control.
- Modal stacking for primary work. Primary command/chat/ops should stay spatially grounded.

## 5. Handoff rules for Biscuit and Cloud modules

These rules are binding for implementation workstreams so design stays cohesive.

### 5.1 Shared design source of truth

Biscuit and Cloud must consume the same Phase 1 token file(s) once created. Until then, use this contract as the visual source of truth.

All modules must share:
- Background/surface/border tokens.
- Text hierarchy and mono numeric styles.
- Status semantics and threshold colors.
- Agent identity accents.
- Radius scale.
- Focus states.
- Motion durations/easing.
- Empty/error/loading tone.

No module may introduce a new accent color, font, card style, chart style, or glow behavior without Korra review.

### 5.2 Biscuit handoff rules: shell, chat, office, Kanban

Biscuit-owned UI must:
- Build the shell around the first-screen trio, not around a generic route grid.
- Keep chat visually command-like and operational, not consumer-messenger-like.
- Preserve v2 office behavior and visual storytelling where reused.
- Make selected agent state propagate across office, chat, and Kanban/project surfaces.
- Use shared primitives for panels, pills, alerts, input, profile selector, and status chips.
- Avoid creating module-specific mini design systems.

Biscuit must not:
- Rebuild the v2 office as a static illustration.
- Add generic placeholder dashboards to fill space.
- Use a default component library look without retheming every primitive to this contract.
- Let chat, Kanban, and office disagree about agent names, colors, status labels, or selected state.

### 5.3 Cloud handoff rules: data, auth, ops, admin

Cloud-owned surfaces must:
- Treat ops/admin data as instrument telemetry, not analytics marketing.
- Expose uncertainty honestly: unknown, disconnected, stale, unauthenticated, unavailable, and estimated states must be visually distinct.
- Provide design-ready data shape for severity, freshness, source, and confidence so UI can style states consistently.
- Keep secrets/key/admin controls visually calm and least-privilege; no loud red unless there is actual risk.
- Provide normalized status semantics that Biscuit can reuse in shell/chat/office.
- Keep health and rate-limit alert thresholds consistent across mission bar, live ops, and admin details.

Cloud must not:
- Ship raw JSON-looking UI as the final ops/admin surface.
- Add unrelated charts because data exists.
- Invent endpoint states that are not verified.
- Expose secrets, tokens, or sensitive values in decorative cards.
- Use backend/service-specific names as primary user labels when a clearer operational label exists.

### 5.4 Cross-module cohesion checks

Before a module is accepted, it must pass this design checklist:
- Does it preserve first-screen hierarchy: office, command, risk?
- Does it use shared tokens and state colors only?
- Does it avoid generic AI/dashboard tropes listed above?
- Does it have real empty, loading, stale, error, and disconnected states?
- Does it respect reduced motion and touch targets?
- Does it read as part of one mission-control surface when placed beside the other modules?
- Does it avoid fake metrics and filler UI?

### 5.5 Review gates

Required review moments:
1. Phase 1 visual token/shell review before module implementation expands.
2. First-screen trio review with real or demo data before admin/Kanban surfaces are visually finalized.
3. 3D office integration review after embedding but before polish.
4. Final cohesion review before Phase 8 closes.

Korra owns visual acceptance. Biscuit and Cloud own implementation correctness within these constraints.