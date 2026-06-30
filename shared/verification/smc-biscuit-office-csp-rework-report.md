# SMC Biscuit Office CSP Rework Report

Date: 2026-06-30
Kanban card: t_42907006
Repo: /home/wliob/llm-brain/Projects/Active/Sora-MissionControl

## Verdict

Local build/browser proof: PASS.
Live production browser gate: still FAILS because Tower is still serving the pre-fix asset `/assets/index-BeYnVHoz.js`.

Cloud redeploy needed: YES. Deploy the new build that emits `/assets/index-k2GobxlW.js`, then rerun `node shared/verification/smc_live_browser_gate.mjs` against `https://192.168.10.5:3443`.

## Fix

Implemented the PixiJS v8 CSP-safe workaround without weakening CSP:

- `src/office/engine/GameRuntime.ts` now imports `pixi.js/unsafe-eval` before the Pixi `Application` import/use.
- Despite its confusing name, Pixi's `pixi.js/unsafe-eval` subpath installs static no-runtime-eval polyfills for shader/uniform/UBO/particle sync and bypasses Pixi's unsafe-eval environment check. It does not add `unsafe-eval` to CSP.
- `missionControlProxy.js` CSP was not changed and still omits `unsafe-eval`.

## Files changed/created by this rework

Focused code/test/doc changes:

- `src/office/engine/GameRuntime.ts`
- `src/office/engine/gameRuntimePerfMode.test.ts`
- `AGENTS.md`
- `OVERVIEW.md`

Verification artifacts:

- `shared/verification/local-office-csp-20260630/summary.json`
- `shared/verification/local-office-csp-20260630/office-local.png`
- `shared/verification/live-browser-gate-20260630/summary.json`
- `shared/verification/live-browser-gate-20260630/team.png`
- `shared/verification/live-browser-gate-20260630/kanban.png`
- `shared/verification/live-browser-gate-20260630/office.png`
- `shared/verification/smc-biscuit-office-csp-rework-report.md`

Note: the repository already had a broad dirty tree before this card. I preserved unrelated existing changes.

## Targeted test / runtime guard

`src/office/engine/gameRuntimePerfMode.test.ts` now mocks `pixi.js/unsafe-eval` and asserts that the shim loads at the `GameRuntime` boundary.

Focused verification command:

```bash
pnpm test -- src/office/engine/gameRuntimePerfMode.test.ts --run
```

Observed output summary:

```text
Test Files  49 passed (49)
Tests       759 passed (759)
```

The package script expands this invocation into a full Vitest run in this project, so it covered the new CSP guard plus the full current test inventory.

## Required gates

### 1. Lint

Command:

```bash
pnpm run lint
```

Output:

```text
$ tsc --noEmit
```

Result: PASS.

### 2. Full tests

Command:

```bash
pnpm test -- --run
```

Output summary:

```text
Test Files  49 passed (49)
Tests       759 passed (759)
Duration    20.90s
```

Result: PASS.

### 3. Production build

Command:

```bash
pnpm run build
```

Output summary:

```text
$ tsc -b && vite build
vite v6.4.3 building for production...
✓ 858 modules transformed.
dist/assets/index-k2GobxlW.js                  799.15 kB │ gzip: 239.60 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 8.18s
```

Result: PASS with the existing large-chunk warning.

## Local browser CSP proof

Started the local proxy from the freshly built `dist/`:

```bash
MISSION_CONTROL_PROXY_HOST=127.0.0.1 MISSION_CONTROL_PROXY_PORT=3187 node missionControlProxy.js
curl -fsS http://127.0.0.1:3187/health
```

Health output:

```json
{"ok":true,"service":"sora-mission-control-admin-proxy"}
```

Then ran a Playwright smoke against `http://127.0.0.1:3187/office`.

Saved summary: `shared/verification/local-office-csp-20260630/summary.json`
Screenshot: `shared/verification/local-office-csp-20260630/office-local.png`

Observed local browser summary:

```json
{
  "base": "http://127.0.0.1:3187",
  "status": 200,
  "finalUrl": "http://127.0.0.1:3187/office",
  "canvasCount": 1,
  "cspHasUnsafeEval": false,
  "scripts": ["http://127.0.0.1:3187/assets/index-k2GobxlW.js"],
  "networkToTower3187": [],
  "unsafeEvalConsole": [],
  "pageErrors": []
}
```

Result: PASS.

Security/transport assertions from local browser proof:

- Office rendered a canvas: `canvasCount = 1`.
- CSP did not contain `unsafe-eval`.
- No unsafe-eval console errors remained.
- No browser requests went to `192.168.10.5:3187`.

## Live browser gate

Command:

```bash
node shared/verification/smc_live_browser_gate.mjs
```

Saved summary: `shared/verification/live-browser-gate-20260630/summary.json`
Screenshots:

- `shared/verification/live-browser-gate-20260630/team.png`
- `shared/verification/live-browser-gate-20260630/kanban.png`
- `shared/verification/live-browser-gate-20260630/office.png`

Observed live result:

```json
{
  "verdict": "FAIL",
  "failed": [
    "fatal console messages: GameRuntime init failed: Error: Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.",
    "office route did not render canvas"
  ],
  "summary": {
    "base": "https://192.168.10.5:3443",
    "scripts": ["https://192.168.10.5:3443/assets/index-BeYnVHoz.js"],
    "networkTo3187": [],
    "badRequests": []
  }
}
```

Interpretation: live is reachable, but it is still serving old asset `index-BeYnVHoz.js`, not the new local build `index-k2GobxlW.js`. Therefore the live failure is expected until Cloud redeploys the new build to Tower.

## CSP status

Current proxy CSP source remains:

```text
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'
```

It does not contain `unsafe-eval`.

## Remaining action

Cloud needs to redeploy the freshly built app/proxy bundle to Tower so production serves `/assets/index-k2GobxlW.js` or a later asset containing the `pixi.js/unsafe-eval` shim. After that, rerun:

```bash
node shared/verification/smc_live_browser_gate.mjs
```

Do not mark the live browser gate complete until `/office` on `https://192.168.10.5:3443` reports `canvasCount >= 1` and no unsafe-eval fatal console messages.
