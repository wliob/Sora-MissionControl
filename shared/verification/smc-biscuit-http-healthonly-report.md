# SMC Biscuit HTTP Health-Only Regression — Card `t_437da1df`

**Date (UTC):** 2026-06-30 15:08:29 UTC
**Verifier:** biscuit
**Deployment:** Not deployed (no deploy performed)

## Summary
I fixed the plaintext LAN runtime gap where `/api/keys`, `/config`, and `/cron` were falling through to SPA fallback when the proxy is started with plain HTTP (`MISSION_CONTROL_PROXY_HOST=0.0.0.0 ... node missionControlProxy.js`).

Behavior is now correct for plain HTTP from non-loopback sources:
- `/api/keys` → `403`
- `/config` → `403`
- `/cron` → `403`
- `/health` → `200`
- `/office` remains `200` (SPA fallback preserved)

Additionally, the CSP still contains no `unsafe-eval`.

## Code changes
1. `missionControlProxy.js`
   - Added `resolveRequireSecureTransport()` defaulting `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT` behavior to **enabled** when unset.
   - Plain HTTP sensitive-route guard now defaults-on for normal startup/CLI usage, so protected endpoints are filtered before SPA fallback.

2. `src/services/hermes/missionControlProxy.test.ts`
   - Added `getFirstNonLoopbackIpv4Address()` helper (runtime integration path host selection).
   - Added `blocks sensitive runtime plaintext routes while keeping health and office accessible` test:
     - Starts the real app server.
     - Calls live HTTP endpoints over non-loopback host.
     - Asserts `/api/keys`, `/config`, `/cron` return `403`, while `/health` and `/office` return `200` and HTML for `/office`.

## Verification commands executed

1) Targeted runtime-relevant proxy test
- Command: `npm run test -- src/services/hermes/missionControlProxy.test.ts`
- Result: **PASS** (`45 tests`)

2) Full test suite
- Command: `npm run test`
- Result: **PASS** (`49 test files`, `761 tests`)

3) Lint
- Command: `npm run lint`
- Result: **PASS** (`tsc --noEmit`)

4) Build
- Command: `npm run build`
- Result: **PASS** (`tsc -b && vite build`)

5) Runtime probe matching Sora check command
- Command:
  - `MISSION_CONTROL_PROXY_HOST=0.0.0.0 MISSION_CONTROL_PROXY_PORT=3188 node missionControlProxy.js`
  - then `curl` checks against `192.168.0.85:3188`
- Observed status/content-type:
  - `/api/keys` → `403` `application/json; charset=utf-8`
  - `/config` → `403` `application/json; charset=utf-8`
  - `/cron` → `403` `application/json; charset=utf-8`
  - `/health` → `200` `application/json; charset=utf-8`
  - `/office` → `200` `text/html; charset=utf-8`

## CSP check
`missionControlProxy.js` still serves:
`script-src 'self' 'unsafe-inline'`
(no `unsafe-eval` present)

## Final verdict
**PASS for card scope**
- Runtime LAN/plain HTTP behavior now matches expected route hardening while preserving `/health` and HTTPS/SPA `/office` behavior and CSP posture.
