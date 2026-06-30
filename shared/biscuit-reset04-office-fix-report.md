# Biscuit Reset 04 — Office Fix Report

Date: 2026-06-22
Project root: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`
Card: `smc-reset-04-biscuit-office-fix`

## Summary

Result: office asset corruption was confirmed and fixed on the asset side.

Confirmed root causes:
1. Office atlases contained millions of opaque chroma-key green pixels that were rendering directly into the live office panel.
2. Three static atlas JSON/image pairs had invalid bounds (`agents`, `furniture-0`, `furniture-1`) where frame rectangles extended past the actual image dimensions, which can produce clipped/fractured props.
3. Live `/kanban` office rendering itself was not blocked by auth. The office panel reached a cohesive rendered idle state without demo mode; live task-driven movement remained unavailable in this environment because the Kanban REST source stayed honestly unauthorized.

## Files changed

Code / checks:
- `scripts/check_office_atlases.py`
- `tests/e2e/mission-control.spec.ts`
- `package.json`

Atlas metadata:
- `public/assets/atlases/agents.json`
- `public/assets/atlases/furniture-0.json`
- `public/assets/atlases/furniture-1.json`

Atlas images repaired in place:
- `public/assets/atlases/agents.webp`
- `public/assets/atlases/furniture-0.webp`
- `public/assets/atlases/furniture-1.webp`
- `public/assets/atlases/fx.webp`

Generated proof artifacts:
- `shared/reset04-office-panel-baseline.png`
- `shared/e2e-chromium-desktop-kanban-office-panel-proof.png`
- `shared/e2e-chromium-desktop-kanban-shell-proof.png`

## What changed

- Added a reusable office atlas validator/repair script.
- Used it to detect the failing pre-fix state.
- Repaired office atlases by:
  - converting opaque pure-chroma pixels to transparent alpha
  - padding atlas images to fully cover declared frame bounds
  - updating affected atlas `meta.size` values to the corrected dimensions
- Strengthened Playwright coverage so `/kanban` now asserts that the office panel actually reaches a rendered canvas state, not just that the right rail exists.
- Captured fresh real browser proof after the repair.

## Commands and exact outputs

### 1) Pre-fix failure proof (RED)

Command:
```bash
python3 scripts/check_office_atlases.py
```

Output:
```text
OFFICE ATLAS CHECK FAILED
Atlas dir: public/assets/atlases
Frames scanned: 176
Opaque chroma pixels found: 3083844
- agents:biscuit_base -> 7683 opaque chroma pixels remain in frame rect
- agents:biscuit_block -> 7509 opaque chroma pixels remain in frame rect
- agents:cloud_base -> 7190 opaque chroma pixels remain in frame rect
- agents:cloud_block -> 6897 opaque chroma pixels remain in frame rect
- agents:korra_base -> 7893 opaque chroma pixels remain in frame rect
- agents:korra_block -> 5709 opaque chroma pixels remain in frame rect
- agents:lelouch_base -> 6077 opaque chroma pixels remain in frame rect
- agents:lelouch_block -> 3579 opaque chroma pixels remain in frame rect
- agents:tifa_base -> 7856 opaque chroma pixels remain in frame rect
- agents:tifa_block -> frame rect {'x': 0, 'y': 318, 'w': 95, 'h': 128} exceeds image bounds (380, 413)
- furniture-0:wall_back -> 2182488 opaque chroma pixels remain in frame rect
- furniture-0:wall_side -> frame rect {'x': 0, 'y': 1536, 'w': 321, 'h': 768} exceeds image bounds (2048, 1983)
- furniture-0:couch -> 31446 opaque chroma pixels remain in frame rect
- furniture-0:window_large -> 36285 opaque chroma pixels remain in frame rect
- furniture-0:bookshelf -> 23485 opaque chroma pixels remain in frame rect
- furniture-0:door -> 20214 opaque chroma pixels remain in frame rect
- furniture-0:floor_archive -> 15617 opaque chroma pixels remain in frame rect
- furniture-0:floor_break_room -> 15400 opaque chroma pixels remain in frame rect
- furniture-0:floor_collaboration -> frame rect {'x': 1823, 'y': 1536, 'w': 256, 'h': 126} exceeds image bounds (2048, 1983)
- furniture-0:floor_workstations -> 16484 opaque chroma pixels remain in frame rect
- furniture-0:plant_large -> frame rect {'x': 1220, 'y': 1792, 'w': 160, 'h': 256} exceeds image bounds (2048, 1983)
- furniture-0:round_table -> 32102 opaque chroma pixels remain in frame rect
- furniture-0:rug_break -> 24197 opaque chroma pixels remain in frame rect
- furniture-0:lamp_floor -> 13857 opaque chroma pixels remain in frame rect
- furniture-0:meeting_chair -> frame rect {'x': 256, 'y': 1857, 'w': 97, 'h': 160} exceeds image bounds (2048, 1983)
- furniture-0:plant_small -> frame rect {'x': 416, 'y': 1857, 'w': 95, 'h': 128} exceeds image bounds (2048, 1983)
- furniture-1:light_rays -> 507832 opaque chroma pixels remain in frame rect
- furniture-1:kanban_board_prop -> 17956 opaque chroma pixels remain in frame rect
- furniture-1:whiteboard -> 23242 opaque chroma pixels remain in frame rect
- furniture-1:chair -> 16110 opaque chroma pixels remain in frame rect
- furniture-1:coffee_machine -> 15262 opaque chroma pixels remain in frame rect
- furniture-1:desk -> 23583 opaque chroma pixels remain in frame rect
- furniture-1:monitor -> frame rect {'x': 0, 'y': 992, 'w': 129, 'h': 160} exceeds image bounds (1024, 1121)
- fx:emote_block -> 2328 opaque chroma pixels remain in frame rect
- fx:emote_sparkle -> 3303 opaque chroma pixels remain in frame rect
- fx:emote_thought -> 2260 opaque chroma pixels remain in frame rect
```

### 2) Asset repair

Command:
```bash
python3 scripts/check_office_atlases.py --rewrite-chroma
```

Output:
```text
Repairing opaque chroma pixels and atlas bounds in public/assets/atlases...
  fixed agents              69080 pixels size (380, 413) -> (380, 446)
  fixed furniture-0       2578139 pixels size (2048, 1983) -> (2079, 2304)
  fixed furniture-1        618235 pixels size (1024, 1121) -> (1024, 1152)
  fixed fx                   7891 pixels
Rewrite summary: 3273345 pixels sanitized across 4 atlas image(s).
OFFICE ATLAS CHECK PASSED
Atlas dir: public/assets/atlases
Frames scanned: 176
Opaque chroma pixels found: 0
Pixels sanitized in this run: 3273345
```

### 3) Final source-asset check

Command:
```bash
npm run check:office-assets
```

Output:
```text
> sora-missioncontrol@0.1.0 check:office-assets
> python3 scripts/check_office_atlases.py

OFFICE ATLAS CHECK PASSED
Atlas dir: public/assets/atlases
Frames scanned: 176
Opaque chroma pixels found: 0
```

### 4) Final office-focused vitest gate

Command:
```bash
npm test -- src/office/office.regression.test.ts src/office/lib/assetValidator.test.ts src/office/components/OfficeModule.test.tsx
```

Output:
```text
> sora-missioncontrol@0.1.0 test
> vitest run src/office/office.regression.test.ts src/office/lib/assetValidator.test.ts src/office/components/OfficeModule.test.tsx

 RUN  v4.1.9 /home/wliob/llm-brain/Projects/Active/Sora-MissionControl

 ✓ src/office/lib/assetValidator.test.ts (25 tests) 53ms
 ✓ src/office/office.regression.test.ts (36 tests) 89ms
 ✓ src/office/components/OfficeModule.test.tsx (1 test) 147ms

 Test Files  3 passed (3)
      Tests  62 passed (62)
   Duration  1.83s
```

Note: `office.regression.test.ts` still emits the pre-existing expected test stderr about synthetic `test_idle.json` URL parsing inside catch-up animation tests; the suite passed.

### 5) Production build gate

Command:
```bash
pnpm build
```

Output:
```text
$ tsc -b && vite build
vite v6.4.3 building for production...
transforming...
✓ 822 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                               0.50 kB │ gzip:   0.32 kB
dist/assets/index-CC7Y0XDO.css               20.75 kB │ gzip:   5.02 kB
dist/assets/index-CY2XUeYp.js               676.26 kB │ gzip: 209.47 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 7.61s
```

### 6) Built output asset check

Command:
```bash
python3 scripts/check_office_atlases.py --atlas-dir dist/assets/atlases
```

Output:
```text
OFFICE ATLAS CHECK PASSED
Atlas dir: dist/assets/atlases
Frames scanned: 176
Opaque chroma pixels found: 0
```

### 7) Real browser proof gate

Command:
```bash
npm run test:e2e -- --project=chromium-desktop
```

Output:
```text
> sora-missioncontrol@0.1.0 test:e2e
> playwright test --project=chromium-desktop

Running 2 tests using 1 worker

  ✓  1 [chromium-desktop] › tests/e2e/mission-control.spec.ts:6:1 › serves the rebuilt Hermes /kanban shell through the Node proxy with honest non-demo states (3.3s)
  -  2 [chromium-desktop] › tests/e2e/mission-control.spec.ts:55:1 › mobile /kanban shell keeps the rebuilt controls reachable without horizontal page overflow

  1 skipped
  1 passed (23.3s)
```

## Live office verification

Verified against real `/kanban` in browser, not demo mode.

What was verified:
- the `/kanban` right rail office panel mounted a real `<canvas>`
- the panel no longer showed the initialization spinner
- the panel no longer showed office asset / canvas / WebGL error overlays
- the panel rendered a cohesive idle office state with honest standby text for agents
- the shell still honestly reported Kanban auth state instead of fabricating live data

Observed state in this environment:
- `/kanban` board/auth stayed unauthorized through the proxy during proof
- office rendering still succeeded and showed an honest idle state
- live task-driven office movement beyond idle remains blocked by missing authorized live Kanban data in this environment

## Screenshot / proof paths

Pre-fix visual evidence:
- `shared/reset04-office-panel-baseline.png`

Final proof:
- `shared/e2e-chromium-desktop-kanban-office-panel-proof.png`
- `shared/e2e-chromium-desktop-kanban-shell-proof.png`

## Remaining blocker

No asset/render blocker remains for the built-in office itself.

Still blocked in this environment:
- proving non-idle live office movement from real Kanban tasks requires authorized live Kanban data through the proxy. The app correctly refused to fake that state.

## If Korra should review anything

If Korra wants a visual QA pass after this fix, review:
- `shared/e2e-chromium-desktop-kanban-office-panel-proof.png`
- `shared/e2e-chromium-desktop-kanban-shell-proof.png`

Suggested Korra review question:
- Is the repaired office panel visually cohesive and on-brand now that chroma corruption is removed and the office reaches an honest rendered idle state?
