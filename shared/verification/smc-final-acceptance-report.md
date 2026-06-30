# SMC Final Acceptance Report — Office CSP/Pixi + HTTP Health-Only Hardening

Date: 2026-06-30
Orchestrator: Sora
Live URL: https://192.168.10.5:3443

## Final Verdict

APPROVED / DONE.

All required code, deploy, browser, visual, Windows, and AppSec gates are green.

## Final Live State

- HTTPS `:3443 /health` -> 200
- HTTPS `:3443 /office` -> 200
- HTTPS `:3443 /admin/keys` without token -> 401
- HTTP `:3187 /health` -> 200
- HTTP `:3187 /api/keys` -> 403
- HTTP `:3187 /config` -> 403
- HTTP `:3187 /cron` -> 403
- HTTP `:3187 /admin/keys` -> 403
- Live asset: `assets/index-k2GobxlW.js`
- CSP: `script-src 'self' 'unsafe-inline'`; no `unsafe-eval`

## Work Completed

1. Biscuit repaired the `/office` CSP/Pixi failure without weakening CSP.
2. Sora verified local tests/build/browser.
3. Cloud deployed the Office CSP/Pixi repair to Tower.
4. AppSec identified a plaintext HTTP health-only condition: `/api/keys`, `/config`, `/cron` returned SPA 200 on HTTP `:3187`.
5. Biscuit hardened `missionControlProxy.js` so plaintext non-loopback HTTP blocks those paths with 403 while preserving `/health` and `/office`.
6. Sora caught an insufficient first fix via real runtime LAN probe, routed iteration, then verified the corrected fix.
7. Cloud deployed the HTTP health-only hardening to Tower.
8. Sora reran live transport/security and browser gates.
9. AppSec recheck approved.
10. Korra visual recheck approved using Playwright, Windows, and screenshot artifact evidence.

## Key Artifacts

- Biscuit HTTP hardening report: `shared/verification/smc-biscuit-http-healthonly-report.md`
- Sora local hardening gates: `shared/verification/sora-http-healthonly-final-local-gates.log`
- Cloud deploy report: `shared/verification/smc-cloud-http-healthonly-deploy-report.md`
- Sora live transport/security: `shared/verification/sora-final-live-transport-security.log`
- Sora live browser summary: `shared/verification/smc-live-browser-gate-csp-deploy/summary.json`
- Live screenshots:
  - `shared/verification/smc-live-browser-gate-csp-deploy/team.png`
  - `shared/verification/smc-live-browser-gate-csp-deploy/kanban.png`
  - `shared/verification/smc-live-browser-gate-csp-deploy/office.png`
- Windows screenshots:
  - `shared/verification/windows-final-gate-20260630b/team.png`
  - `shared/verification/windows-final-gate-20260630b/kanban.png`
  - `shared/verification/windows-final-gate-20260630b/office.png`
- Windows report: `shared/verification/smc-windows-final-gate-report.md`
- AppSec final approval: `shared/verification/smc-appsec-final-recheck-report.md`
- Korra final approval: `shared/verification/smc-korra-final-recheck-report.md`

## Verification Summary

### Code Quality

- `pnpm run test` -> 49 test files / 761 tests passed
- `pnpm run lint` -> passed
- `pnpm run build` -> passed

### Browser Gate

`node shared/verification/smc_live_browser_gate.mjs` -> PASS

- `/team` 200
- `/kanban` 200, `canvasCount=1`
- `/office` 200, `canvasCount=1`
- `badRequests=[]`
- `networkTo3187=[]`
- `fatalConsole=[]`
- `pageErrors=[]`

### AppSec

Final verdict: APPROVED.

No remaining security blocker. Plain HTTP sensitive routes no longer return SPA 200, and CSP remains no-`unsafe-eval`.

### Korra Visual

Final verdict: APPROVED.

No remaining visual blocker. Live and Windows screenshot artifacts render non-blank Team/Kanban/Office surfaces; `/office` canvas route is accepted.

## Notes

- The earlier Cloud completion mentioning asset `index-BeYnVHoz.js` was a delayed/superseded deploy notification. Final accepted live asset is `index-k2GobxlW.js`.
- Windows proof is based on Chrome-generated screenshot artifacts and Sora visual inspection/report; Korra recheck used those reports/artifacts and noted no native image preview in that worker environment.
