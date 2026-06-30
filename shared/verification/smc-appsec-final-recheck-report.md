# SMC Final AppSec Recheck Report (HTTP Health-Only Deploy)

## Verdict
**APPROVED**

## Evidence Reviewed
- `shared/verification/sora-http-healthonly-final-local-gates.log`
- `shared/verification/smc-cloud-http-healthonly-deploy-report.md`
- `shared/verification/sora-final-live-transport-security.log`
- `shared/verification/smc-live-browser-gate-csp-deploy/summary.json`

## Gate Results
- Local LAN verification (`3188`) shows security-sensitive routes on plain HTTP returning `403`:
  - `/api/keys` 403
  - `/config` 403
  - `/cron` 403
  - `/health` 200
  - `/office` 200
  - Unit: `49/49 test files`, `761 tests` passed; lint/build passed.

- Cloud deploy report (`Tower`, HTTPS/WAN exposure + HTTP fallback):
  - HTTPS `:3443`:
    - `/health` 200
    - `/office` 200 (serves `index-k2GobxlW.js`)
    - `/admin/keys` no token 401
  - HTTP `:3187`:
    - `/health` 200
    - `/api/keys` 403
    - `/config` 403
    - `/cron` 403
    - `/admin/keys` 403
  - CSP in report includes `script-src 'self' 'unsafe-inline'` and explicitly no `unsafe-eval`.

- Live transport snapshot corroborates deploy status:
  - HTTPS `https://192.168.10.5:3443/health` 200
  - HTTPS `.../office` 200
  - HTTPS `.../admin/keys` 401
  - HTTP `http://192.168.10.5:3187`:
    - `/health` 200
    - `/api/keys` 403
    - `/config` 403
    - `/cron` 403
    - `/admin/keys` 403
  - CSP remains `script-src 'self' 'unsafe-inline'`, no `unsafe-eval`.

- Browser gate/e2e summary:
  - PASS.
  - Route checks: `/team`, `/kanban`, `/office` all `200`.
  - `badRequests: []`, `networkTo3187: []`, `fatalConsole: []`, `pageErrors: []`.
  - Script source includes expected bundle `index-k2GobxlW.js`.

## AppSec Risk Decision
No remaining security blocker from these recheck artifacts. Sensitive API/admin endpoints are no longer exposed with 200 on HTTP listener, secure transport and CSP posture align with health-only policy, and e2e/browser security checks show no runtime violations.

## Blockers (if any)
- None.
