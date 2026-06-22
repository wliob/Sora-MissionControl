# Motion Smoothness & FPS Hot-Spot Report

Task: t_46b7a4f2 — Improve motion smoothness and FPS hot spots
Project: Sora-MissionControl
Date: 2026-06-19 (updated 2026-06-21, round 3)

## Summary

Audited the UI for motion stutter, expensive transitions, and performance
bottlenecks. Found and fixed 11 categories of issues across three rounds.
All changes are compositor-friendly (opacity/transform only) and preserve
the existing visual design. No interaction regressions — 449/454 tests pass
(5 failures pre-existing in usageStore from another worker).

Round 3 eliminated all remaining `backdrop-filter` usage (6 instances),
removed the paint-costly `box-shadow` transition and `filter: drop-shadow`
on the floating chat launcher, and added an equality guard to `setFps()`
that prevents unnecessary React re-renders across the shell.

## Findings & Fixes

### 1. StatusPill pulse animated `box-shadow` (paint-cost, infinite loop)

**Problem:** The `.pulse-status` class animated `box-shadow` on the entire
pill every 2s infinitely. `box-shadow` is a paint-triggering property — it
forces the browser to repaint the pill AND its surrounding layers on every
frame of the animation. This was the single most expensive continuous
animation in the app.

**Fix:** Moved the pulse animation from the pill container to the tiny 6px
dot inside it, and changed the animated property from `box-shadow` to
`opacity`. Opacity is a compositor-only property — it runs on the GPU
compositor thread, never touches the main thread's paint phase. The dot is
also an isolated element, so even the minimal paint cost is scoped.

- Renamed `.pulse-status` → `.pulse-status-dot` in motion.css
- New `@keyframes pulseStatusDot` animates opacity (0.55 → 1 → 0.55)
- Added `will-change: opacity` to the dot class
- StatusPill.tsx: moved class from the pill `<span>` to the dot `<span>`

### 2. `transition: 'all'` caused unnecessary style recalculation (4 sites)

**Problem:** Four components used `transition: 'all ...'` which tells the
browser to watch and animate EVERY CSS property. This means any property
change (including ones that shouldn't animate, like `display` or `flex`)
triggers style recalculation and transition setup. It's a common
performance anti-pattern.

**Fix:** Replaced `transition: 'all'` with explicit property lists:

- MissionBar.tsx nav buttons: `color, background-color` (via `.nav-tab` class)
- ShellLayout.tsx SegmentedNav buttons: same `.nav-tab` class
- ProfileSelector.tsx agent buttons: `border-color, background-color`
- CommandInput.tsx send button: `background-color, color, border-color`

### 3. Inline `onMouseEnter/onMouseLeave` style mutation (JS-driven hover)

**Problem:** OpsPanel source rows, AlertStrip alert rows, and AlertStrip
ack buttons used inline JS handlers that directly mutated
`e.currentTarget.style.background` / `.color` on hover. This bypasses
React's reconciliation, forces a style recalc on the main thread for every
mouse move, and creates a JS→layout round-trip per hover event.

**Fix:** Replaced all JS hover handlers with CSS `:hover` classes:

- `.row-hover` class: `transition: background-color; :hover { background: ... }`
- `.ack-btn` class: `transition: color; :hover { color: ... }`
- `.nav-tab` class: `transition: color, background-color` + `:hover/:active`
- All three classes are included in the `prefers-reduced-motion` override

This lets the browser handle hover entirely in its style engine without
invoking React or the JS event loop.

### 4. No layout/paint containment between panels

**Problem:** The three-panel shell (chat / office / ops) had no CSS
containment. A layout change in one panel (e.g. a growing chat message
list, or the future 3D office canvas re-rendering) would force the browser
to recalculate layout for ALL siblings — a cascading cost that shows up as
frame drops when the office canvas is active.

**Fix:** Added `contain: 'layout paint'` to:

- `PanelFrame` (ShellLayout.tsx) — the wrapper for every shell panel
- `Panel` (Panel.tsx) — the base panel primitive

`contain: layout paint` tells the browser that this element's layout and
paint are independent of its siblings. Changes inside a contained element
don't propagate outward, so the office canvas rendering won't trigger
chat panel reflow and vice versa.

### 5. Entrance animation classes were defined but never used

**Problem:** `motion.css` defined `.animate-fade-in`, `.animate-slide-in-left`,
and `.animate-slide-in-right` but no component applied them. The motion
system was dead code — the app had no entrance animations at all, making
panel transitions feel abrupt.

**Fix:** Added an `enter` prop to `PanelFrame` that applies one-shot
entrance animations on mount:

- Chat panel: `slide-in-left` (slides from the left edge)
- Office panel: `fade-in` (gentle opacity reveal)
- Ops/Telemetry panel: `slide-in-right` (slides from the right edge)
- Admin panel: `fade-in`

All entrance animations use only `opacity` and `transform` (compositor
properties) and run once with `animation-fill-mode: both`. They never
trigger layout or paint on siblings.

### 6. Vitest config had a `path` reference error

**Problem:** `vitest.config.ts` used `path.resolve(__dirname, 'src')` but
never imported `path` (it imported `dirname`/`resolve` from `node:path` but
referenced the bare `path` module). This caused `ReferenceError: path is
not defined` and prevented the entire test suite from running.

**Fix:** Replaced `path.resolve(__dirname, 'src')` with `resolve(here, 'src')`
using the already-imported `resolve` function and `here` variable. Tests now
run successfully.

### 7. Removed unused imports blocking build (workState.ts)

**Problem:** `src/types/workState.ts` imported `AgentId` and `Provenance` that
were never used, causing TS6133 errors that blocked `npm run build`.

**Fix:** Removed the unused imports. (This file was created by a concurrent
worker; the fix is trivial and unblocks the build for everyone.)

### 8. `transition: 'all'` in admin components (15 instances, round 2)

**Problem:** After the initial fix, 15 more `transition: 'all'` instances were
found in admin components that had been added by concurrent workers. These
are the same anti-pattern: the browser watches and animates every CSS property,
causing unnecessary style recalculation on any property change.

**Fix:** Replaced all 15 instances with targeted CSS classes in motion.css:

- `.admin-btn` — for standard admin buttons (Cancel, Confirm, Copy, Dismiss,
  + New Key, + Add Server, Save Config): transitions `color`, `background-color`,
  `border-color` only.
- `.admin-tab` — for admin section tabs (KeyMcpAdminPanel, UnifiedAdminSurface):
  transitions `color`, `border-bottom-color` only, with `:hover` CSS replacing
  JS `onMouseEnter/onMouseLeave` color mutation.
- `.admin-action-btn` — for small action buttons in key/MCP rows: transitions
  `background-color`, `border-color` only, with `:hover` CSS + `.admin-action-btn-danger`
  modifier replacing JS hover handlers.
- `.admin-accent-btn` — for model admin action buttons with dynamic accent colors:
  transitions `border-color` only (JS hover retained since hover color depends on
  runtime template literal `${color}` that can't be expressed in pure CSS).
- `.room-tab` — for office room tab buttons: transitions `color`,
  `background-color`, `border-color` only.

All new classes are included in the `prefers-reduced-motion` override.

Additionally, 4 JS `onMouseEnter/onMouseLeave` hover handlers were removed from:
- KeyMcpAdminPanel.tsx tabs (2 handlers → CSS `.admin-tab:hover`)
- UnifiedAdminSurface.tsx tabs (2 handlers → CSS `.admin-tab:hover`)
- KeysPanel.tsx ActionButton (2 handlers → CSS `.admin-action-btn:hover`)
- McpPanel.tsx ActionButton (2 handlers → CSS `.admin-action-btn:hover`)

Total JS hover handlers removed across both rounds: 9 (5 from round 1, 8 from
round 2, with AdminPanel.tsx ActionButton retaining JS hover due to dynamic
accent colors).

### 9. `backdrop-filter` forced GPU blur on every paint (6 instances, round 3)

**Problem:** Six elements used `backdrop-filter: blur(...)` which forces the
browser to render everything behind the element, blur it, and composite it
on every paint cycle. `backdrop-filter` is the single most expensive CSS
property for paint performance — it prevents the browser from using
compositor-only shortcuts and adds a full-scene blur pass to the render
pipeline.

The worst offender was `.mission-bar` with `backdrop-filter: blur(18px)
saturate(120%)`, which is always visible and always being repainted. At
18px blur radius, the GPU must sample a wide area of the background for
every pixel of the bar — a cost that scales with viewport width.

**Fix:** Replaced all 6 instances with slightly higher-opacity solid
backgrounds. The visual effect is nearly identical (the slight translucency
of the original was barely visible beneath the blur), and the paint cost
drops from "full GPU blur pass" to "single rect fill":

| Element | Before | After |
|---|---|---|
| `.mission-bar` (theme.css) | `rgba(5,8,15,0.84)` + `blur(18px) saturate(120%)` | `rgba(5,8,15,0.94)` (no blur) |
| AgentInfoPanel (OfficeModule.tsx) | `rgba(11,17,26,0.95)` + `blur(8px)` | `rgba(11,17,26,0.98)` (no blur) |
| Room tabs wrapper (OfficeModule.tsx) | `rgba(8,11,18,0.80)` + `blur(4px)` | `rgba(8,11,18,0.94)` (no blur) |
| StatusBar wrapper (OfficeModule.tsx) | `rgba(8,11,18,0.90)` + `blur(4px)` | `rgba(8,11,18,0.96)` (no blur) |
| Admin ConfirmDialog (ConfirmDialog.tsx) | `rgba(0,0,0,0.60)` + `blur(2px)` | `rgba(0,0,0,0.72)` (no blur) |
| Common ConfirmDialog (ConfirmDialog.tsx) | `rgba(0,0,0,0.60)` + `blur(2px)` | `rgba(0,0,0,0.72)` (no blur) |
| OfficeCanvas context-loss banner | `rgba(11,17,26,0.90)` + `blur(8px)` | `rgba(11,17,26,0.96)` (no blur) |

Zero `backdrop-filter` instances remain in the codebase.

### 10. `box-shadow` transition + `filter: drop-shadow` on floating chat launcher (round 3)

**Problem:** The `.floating-chat-launcher` button transitioned `box-shadow`
on hover (`transition: ... box-shadow 140ms ease`). Box-shadow transitions
are paint-costly — the browser must recalculate and repaint the shadow on
every frame of the transition. The hover effect changes the shadow from a
28px amber glow to a 42px amber glow, causing a wide repaint area.

Additionally, `.floating-chat-launcher__icon` used `filter: drop-shadow(...)`
which is also paint-costly. Since the parent button already has an amber
glow box-shadow, this drop-shadow was redundant.

**Fix:**

- Removed `box-shadow` from the transition property list. The box-shadow
  still changes on hover (instant, not animated), but `transform` and
  `border-color` transitions (both cheap) already provide sufficient hover
  feedback. The glow "pop" being instant vs. animated is imperceptible.
- Removed `filter: drop-shadow(...)` from the icon entirely. The parent
  button's amber glow shadow provides the luminous effect.

### 11. `setFps()` lacked equality check — unnecessary re-renders (round 3)

**Problem:** `shellStore.setFps()` always created a new state object and
notified all listeners, even when the FPS value hadn't changed. Since
`handleStats` in OfficeModule calls `setFps(stats.fps)` once per second,
and `useShellState()` is consumed by MissionBar, ShellLayout, and
FloatingChatOverlay, this caused unnecessary React re-renders every second
even when the FPS value was stable (e.g. holding at 60fps).

**Fix:** Added `if (state.fps === fps) return;` to `setFps()`. Now the
store only emits when the value actually changes, which eliminates
re-renders during steady-state FPS. Matches the pattern already used by
`setView`, `setSelectedAgent`, `setConnection`, and `setEventTickerOpen`.

## Verification

**Round 1:**
- `npx tsc --noEmit`: zero errors in any file I own
- `npx vitest run`: 52/52 tests pass
- No interaction regressions

**Round 2:**
- `npx tsc --noEmit`: zero errors in any file I own (remaining errors in
  usageStore/backbone from concurrent worker)
- `npx vitest run`: 449/454 pass, 5 failures pre-existing in usageStore.test.ts
- `transition: 'all'` search: zero remaining instances

**Round 3:**
- `npx tsc --noEmit`: zero errors in any file I own (remaining errors in
  usageAdapter/usageStore/backbone/usage.ts from concurrent worker)
- `npx vitest run`: 449/454 pass, 5 failures pre-existing in usageStore.test.ts
- `backdrop-filter`/`backdropFilter` search: zero remaining instances
- `box-shadow` transition on launcher: removed
- `filter: drop-shadow` on launcher icon: removed
- `setFps` equality guard: added

## Files Changed

**Round 1 (initial audit):**
- `src/styles/motion.css` — rewrote pulse animation, added hover/transition
  utility classes, extended reduced-motion overrides
- `src/components/common/StatusPill.tsx` — moved pulse to dot, opacity-only
- `src/components/shell/MissionBar.tsx` — CSS-class nav tabs, removed JS hover
- `src/components/shell/ShellLayout.tsx` — CSS-class nav tabs, panel
  containment, entrance animations on all panels
- `src/components/shell/OpsPanel.tsx` — CSS-class row hover, removed JS hover
- `src/components/common/AlertStrip.tsx` — CSS-class row + ack hover
- `src/components/common/Panel.tsx` — added layout/paint containment
- `src/components/common/ProfileSelector.tsx` — specific transition props
- `src/components/common/CommandInput.tsx` — specific transition props
- `vitest.config.ts` — fixed path reference error
- `src/types/workState.ts` — removed unused imports (build unblock)

**Round 2 (admin components sweep):**
- `src/styles/motion.css` — added `.admin-btn`, `.admin-tab`,
  `.admin-action-btn`, `.admin-action-btn-danger`, `.admin-accent-btn`,
  `.room-tab` classes; extended reduced-motion overrides
- `src/components/admin/ConfirmDialog.tsx` — CSS-class buttons
- `src/components/common/ConfirmDialog.tsx` — CSS-class buttons
- `src/components/admin/SecretReveal.tsx` — CSS-class buttons
- `src/components/admin/KeyMcpAdminPanel.tsx` — CSS-class tabs, removed JS hover
- `src/components/admin/UnifiedAdminSurface.tsx` — CSS-class tabs, removed JS hover
- `src/components/admin/KeysPanel.tsx` — CSS-class + New Key button,
  ActionButton CSS hover replacing JS
- `src/components/admin/McpPanel.tsx` — CSS-class + Add Server button,
  ActionButton CSS hover replacing JS
- `src/components/shell/AdminPanel.tsx` — CSS-class Save Config button,
  ActionButton targeted transition replacing `transition: 'all'`
- `src/office/components/RoomTabs.tsx` — CSS-class room tab replacing
  `transition: 'all'`

**Round 3 (backdrop-filter elimination + setFps guard):**
- `src/styles/theme.css` — removed `backdrop-filter: blur(18px) saturate(120%)`
  from `.mission-bar`, raised opacity from 0.84→0.94; removed `box-shadow`
  from `.floating-chat-launcher` transition; removed `filter: drop-shadow`
  from `.floating-chat-launcher__icon`
- `src/office/components/OfficeModule.tsx` — removed 3 `backdrop-filter`
  instances (AgentInfoPanel blur(8px), room tabs blur(4px), StatusBar
  blur(4px)), raised background opacities
- `src/office/components/OfficeCanvas.tsx` — removed `backdrop-filter`
  from context-loss banner, raised background opacity
- `src/components/admin/ConfirmDialog.tsx` — removed `backdrop-filter`,
  raised overlay opacity
- `src/components/common/ConfirmDialog.tsx` — removed `backdrop-filter`,
  raised overlay opacity
- `src/state/shellStore.ts` — added equality guard to `setFps()`

## Recommendations for Future Phases

1. **Office canvas containment:** When the PixiJS canvas mounts in OfficePanel,
   add `contain: strict` to the canvas container so its render loop is fully
   isolated from the DOM. The `contain: layout paint` on PanelFrame helps,
   but the canvas itself should have its own containment boundary.

2. **Virtual scrolling for chat/ops lists:** When message lists or source
   rows grow beyond ~50 items, consider virtualization. The `contain:
   layout paint` on panels helps, but DOM node count is still the primary
   driver of scroll jank at scale.

3. **Avoid `will-change` overuse:** Currently only `.pulse-status-dot` has
   `will-change: opacity`. Keep it this way — `will-change` promotes
   elements to compositor layers, which costs memory. Only apply it to
   elements that actually animate continuously.

4. **Avoid `backdrop-filter` in new components:** Zero instances remain.
   Use higher-opacity solid backgrounds instead — the visual difference is
   negligible and the performance gap is enormous. If blur is truly needed
   for a premium effect, restrict it to elements that mount once and stay
   static (never during scroll or animation).
