# Phase 1 — Shell Visual Review Checklist

Status: Biscuit self-review against `shared/phase0-korra-visual-contract.md`.
Korra owns visual acceptance; this is the implementation-side compliance audit.

## Deliverables

1. `src/styles/theme.css` — dark premium mission-control design tokens.
2. `src/styles/motion.css` — animation utilities with reduced-motion overrides.
3. `src/components/shell/ShellLayout.tsx` — responsive root frame for the first-screen trio.
4. `src/components/shell/MissionBar.tsx` — thin top chrome with identity, connection, nav.
5. `src/components/shell/OfficePanel.tsx` — placeholder frame for the 3D office (Phase 2 mounts here).
6. `src/components/shell/ChatPanel.tsx` — command-console chat surface (Phase 4 wires transport).
7. `src/components/shell/OpsPanel.tsx` — live ops telemetry panel with honest unknown states.
8. `src/components/common/Panel.tsx` — base surface primitive.
9. `src/components/common/StatusPill.tsx` — connection health indicator.
10. `src/components/common/CommandInput.tsx` — command-bar style input.
11. `src/components/common/ProfileSelector.tsx` — compact agent rail.
12. `src/components/common/AlertStrip.tsx` — quiet alert display.
13. `src/state/shellStore.ts` — local shell state (view, selected agent, connection, fps).
14. `src/types/index.ts` — type barrel integrating canonical Phase 4 models.
15. `src/types/agents.ts` — canonical agent roster (shared with Phase 4).
16. Project scaffold: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`.

## Visual Contract Compliance

### §1.1 Global atmosphere
- [x] Near-black navy/charcoal backgrounds: `#05070d`, `#080b12`, `#0b111a`.
- [x] Thin atmospheric borders: `rgba(255,255,255,0.05-0.07)` baseline.
- [x] Precision typography: Inter for UI, JetBrains Mono for tokens/IDs.
- [x] Sparse glow language: cyan=live, violet=command, amber=warning, red=blocked.
- [x] Deep negative space: office panel has vignette and breathing room.
- [x] No rainbow palette: agent colors are harmonized via small chips and dots.

### §1.2 Chat module visual direction
- [x] Visually subordinate to office on first load (26% width vs 50%).
- [x] Compact profile rail with per-agent accent markers, no large avatars.
- [x] Message groups are calm, high-contrast, low-chrome — no consumer bubbles.
- [x] Input feels like a command bar: `›` prefix, focused glow, kbd hint.
- [x] Agent status in chat header using same presence semantics.
- [x] Idle state shows demo messages, not fake suggestions.

### §1.3 3D office visual direction
- [x] Center-stage on desktop (~50% visual weight).
- [x] Placeholder renders an observation deck frame with vignette.
- [x] Surrounding chrome is dark, quiet, technical.
- [x] Phase 2 will mount the Pixi canvas inside the existing panel.

### §1.4 Live ops visual direction
- [x] No marketing charts, no fake analytics, no KPI grid.
- [x] Risk-first: alerts at top, then source health, then usage.
- [x] Mono numerals for technical telemetry (latency, timestamps).
- [x] Color only at thresholds; normal state is neutral/cyan.
- [x] Unknown states render as `unknown`, not green.

### §2.1 First-screen priority order
1. [x] Hermes connection state — MissionBar StatusPill (leftmost).
2. [x] Agent presence — office panel (center, dominant).
3. [x] Command availability — chat panel (left).
4. [x] Cost/risk — ops panel (right).
5. [x] Deeper admin/project nav — MissionBar nav items (quiet, right-aligned).

### §2.2 Desktop layout
- [x] Office center ~50%, chat left ~26%, ops right ~24%.
- [x] Office is the anchor; panels are not equalized.
- [x] No dense 12-card overview grid above the office.
- [x] Navigation is present but quiet.

### §2.3 Tablet layout
- [x] Office primary, chat docked, ops compressed strip.
- [x] Ops critical state promoted to its own section.

### §2.4 Mobile layout
- [x] Segmented nav: Office, Chat, Ops.
- [x] MissionBar shows connection and highest-risk state.
- [x] One panel at a time.

### §2.5 Density rules
- [x] No filler cards to balance layout.
- [x] Empty space acceptable when state is empty.
- [x] Spacious: office canvas. Medium: chat messages. Dense: ops strips.

### §3.1 Motion purpose
- [x] All motion is transform/opacity-based.
- [x] `prefers-reduced-motion` zeroes all durations globally.
- [x] No spectacle-only animations.

### §4 Forbidden patterns
- [x] No generic AI gradients (identity logo uses a subtle cyan→violet gradient, not a hero blob).
- [x] No glassmorphism / heavy backdrop blur.
- [x] No KPI card spam.
- [x] No chart wallpaper.
- [x] No stock admin template layout.
- [x] No emoji-heavy personality UI.
- [x] No heavy rounded rectangle syndrome.
- [x] No rainbow agent UI.
- [x] No fake data or placeholder metrics that look real.
- [x] No OpenClaw visual cloning.
- [x] No overbuilt navigation.
- [x] No modal stacking for primary work.

### §5.1 Shared design source of truth
- [x] All modules consume `theme.css` tokens.
- [x] Shared primitives (Panel, StatusPill, CommandInput, ProfileSelector, AlertStrip).
- [x] No module introduces new accent colors without review.

### §5.2 Biscuit handoff rules
- [x] Shell built around the first-screen trio, not a generic route grid.
- [x] Chat is command-like, not consumer-messenger-like.
- [x] Selected agent state propagates via `shellStore.selectedAgent`.
- [x] Shared primitives used across panels.

## Build verification
- `npm install` — 70 packages, 0 vulnerabilities.
- `npx tsc --noEmit` — 0 errors in shell/common/state/types code.
  - 9 remaining errors are in parallel Phase 4 worker files (chatStore, adminStore, admin.ts, workState.ts) — not this task's scope.
- `npx vite --port 5180` — dev server runs, all modules serve 200.

## Notes for Korra review
- The office placeholder uses a decorative grid hint with a radial mask. This is intentionally minimal — it reads as "space awaiting the living scene", not as a pattern or decoration.
- The identity logo uses a small 20px gradient square. If Korra wants a different mark, it's one component.
- The `unknown` connection state is the default on first load. This is honest per the contract — no fake "connected" green.
- FPS counter in the MissionBar is hidden until the office reports > 0 (Phase 2).