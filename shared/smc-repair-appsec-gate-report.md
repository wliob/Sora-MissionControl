# SMC Repair AppSec Gate — Sora Mission Control Repair

Task / Kanban card: `t_f3992c82`
Reviewer: AppSec
Date: 2026-06-30
Scope: read-only security gate for Sora Mission Control secure transport guard, CSP posture, and Pixi unsafe-eval repair path.
Decision: CONDITIONAL APPROVAL

Bottom line:

- APPROVE the current secure-transport guard design for production only if `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT=true` is enabled and Cloud proves the non-loopback HTTP 3187 sensitive-route smoke tests below return 403.
- REJECT any production fix that adds `script-src 'unsafe-eval'` to the canonical SMC origin that handles login/session/admin/Kanban/PTY.
- CONDITIONALLY APPROVE a Pixi fix that keeps CSP without `'unsafe-eval'`, preferably by using Pixi's no-eval compatibility path or another runtime/build approach that avoids dynamic code execution, with browser proof.

## 1. Current secure transport guard and CSP posture

Primary repo files reviewed:

- `missionControlProxy.js`
  - Sensitive-route classifier: `isSensitivePlainHttpPath()` lines 441-449.
  - `X-Forwarded-Proto` trusted-peer handling: `isTrustedProxySource()` lines 460-471.
  - Secure-transport decision: `connectionIsSecure()` lines 473-478.
  - Plain HTTP sensitive-route middleware: `buildSensitivePlainHttpGuard()` lines 480-487.
  - CSP and security headers: `createMissionControlProxyApp()` lines 760-771.
  - PTY WebSocket upgrade transport block: `bindWebSocketUpgrade()` lines 990-1001.
  - HTTPS listener support: `startMissionControlProxy()` lines 1072-1090.
- `src/services/hermes/missionControlProxy.test.ts`
  - Sensitive path coverage lines 65-76.
  - Host spoof / X-Forwarded-Proto spoof / trusted peer regression tests lines 544-640.
- `.env.proxy`
  - Template only; contains a development placeholder and warns not to use it in production.
- `deploy/OPERATOR-RUNBOOK.md`
  - Documents HTTPS 3443 as canonical and HTTP 3187 as health/static-only with sensitive routes blocked.

Current CSP in `missionControlProxy.js`:

```text
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'
```

CSP/security-header assessment:

- Good: no `'unsafe-eval'` is present in current source CSP.
- Good: `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Permitted-Cross-Domain-Policies: none`, and `X-Powered-By` removal are present.
- Existing hardening gap: `script-src 'unsafe-inline'` weakens XSS blast-radius reduction. Do not expand this risk by adding `'unsafe-eval'`. Create a follow-up hardening item for nonce/hash-based scripts when the Vite/runtime path supports it.
- Existing deployment caveat: HSTS is not set. That is acceptable for a self-signed IP-based LAN deployment, but if Cloud moves to a stable DNS name with a trusted cert, add `Strict-Transport-Security` on HTTPS only.
- Important functional issue: the CSP `connect-src` is loopback-specific. If the canonical deployed URL is not loopback, Biscuit/Cloud must confirm the app only uses same-origin API/WebSocket paths or add exact HTTPS/WSS production origins. Do not add broad wildcards.

Transport-guard assessment:

- Sensitive HTTP 3187 routes are correctly classified: `/login`, `/logout`, `/session`, `/healthz`, `/api/session`, `/api/auth/*`, `/api/plugins/kanban*`, `/admin*`, and `/api/pty`.
- The guard is effective only when enabled. Production must set `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT=true`.
- Loopback sockets are intentionally treated as secure to support local/SSH-tunnel access. This is acceptable only for local access and does not satisfy the LAN production user path by itself.
- PTY WebSocket upgrade has a separate transport block when `blockUnsecured` is true, which is required because Express middleware does not process WebSocket upgrade frames.

## 2. Acceptable Pixi unsafe-eval fixes

Evidence reviewed:

- Current app imports Pixi from `pixi.js` in `src/office/entities/Agent.ts`, `src/office/engine/GameRuntime.ts`, `src/office/engine/AmbientLighting.ts`, and `src/office/engine/DeskIndicators.ts`.
- There is no current source import of `pixi.js/unsafe-eval`.
- Installed Pixi version is `pixi.js@8.19.0`.
- Pixi package export evidence:
  - `node_modules/pixi.js/package.json` exports `./unsafe-eval` at lines 407-414.
  - `node_modules/pixi.js/lib/rendering/renderers/shared/system/AbstractRenderer.mjs` throws when `unsafeEvalSupported()` fails: `Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.`
  - `node_modules/pixi.js/lib/unsafe-eval/init.mjs` is misleadingly named: it overrides Pixi runtime checks and swaps generated-code paths for polyfills that avoid eval (`_generateUniformsSync`, `_generateUboSync`, `_generateShaderSync`, particle update generation).
- Built output still contains `new Function` strings in Pixi chunks (`dist/assets/BufferResource-*.js`, `dist/assets/WebGLRenderer-*.js`) after `pnpm run build`. Presence in the bundle is not automatically exploitable, but runtime must prove those code paths are not invoked under CSP.

Production-approved fix path, in order of preference:

1. Prefer a no-eval Pixi runtime path while keeping canonical CSP without `'unsafe-eval'`:
   - Add Pixi's compatibility import before any Pixi renderer/Application construction, e.g. an office/app entrypoint import of `pixi.js/unsafe-eval`.
   - Despite the module name, the reviewed `init.mjs` installs polyfills that avoid the dynamic eval paths.
   - Biscuit must prove this fixes the office canvas with the existing no-`unsafe-eval` CSP.
2. If the compatibility import is insufficient, use a build/runtime approach that removes the need for dynamic code generation:
   - upgrade/downgrade Pixi only with documented no-eval behavior,
   - disable or replace Pixi features that invoke generated shader/uniform/particle sync functions,
   - or replace the office rendering path for production.
3. Add a Playwright/browser regression that fails if:
   - Office canvas does not render or does not show an explicit safe fallback,
   - response CSP contains `'unsafe-eval'`, or
   - browser console contains Pixi's unsafe-eval fatal error.

Rejected production fix path:

- Do not add `script-src 'unsafe-eval'` to the canonical SMC app origin. This origin handles login/session bootstrap, session cookies/headers, admin proxy token headers, Kanban data, and PTY forwarding. Enabling eval would materially increase the impact of any XSS or compromised dependency on a privileged operator surface.

If Biscuit/Cloud claim unsafe-eval is genuinely unavoidable, AppSec rejects it on the canonical production origin. It can only be reconsidered in a separated render-only origin with all of these compensating controls:

- Separate origin has no `/admin/*`, `/login`, `/logout`, `/session`, `/api/session`, `/api/auth/*`, `/api/plugins/kanban*`, or `/api/pty` routes.
- No admin proxy tokens, Hermes session tokens, cookies, localStorage/sessionStorage credentials, or sensitive Kanban payloads are exposed to that origin.
- `connect-src` on that origin is minimum necessary for static render assets only; no admin/session/dashboard mutation APIs.
- Parent/canonical app has explicit embedding policy and trust-boundary documentation.
- AppSec re-reviews the design before integration.

## 3. Host / X-Forwarded-Proto spoof verification

Verified with unit/regression suite:

```text
Command: pnpm test -- --run src/services/hermes/missionControlProxy.test.ts
Observed result: 48 test files passed, 735 tests passed
Relevant file: src/services/hermes/missionControlProxy.test.ts passed 42 tests
```

Note: the command syntax used by Vitest in this repo ran the full suite rather than only the requested file; that is stronger coverage than intended, not a failure.

Additional direct helper verification run against `buildSensitivePlainHttpGuard()`, `connectionIsSecure()`, and `parseTrustedProxyPeers()` with fake non-loopback request objects:

```text
host-spoof-login: {"statusCode":403,"nextCalled":false,"error":"Sensitive Mission Control routes are unavailable on this plain HTTP listener. Use an HTTPS reverse proxy or SSH tunnel before sending dashboard credentials, session cookies, or admin proxy tokens."}
xfp-spoof-session: {"statusCode":403,"nextCalled":false,"error":"Sensitive Mission Control routes are unavailable on this plain HTTP listener. Use an HTTPS reverse proxy or SSH tunnel before sending dashboard credentials, session cookies, or admin proxy tokens."}
xfp-spoof-admin: {"statusCode":403,"nextCalled":false,"error":"Sensitive Mission Control routes are unavailable on this plain HTTP listener. Use an HTTPS reverse proxy or SSH tunnel before sending dashboard credentials, session cookies, or admin proxy tokens."}
trusted-proxy-https-kanban: {"statusCode":null,"nextCalled":true,"error":null}
non-sensitive-health: {"statusCode":null,"nextCalled":true,"error":null}
connectionIsSecure host spoof: false
connectionIsSecure xfp spoof untrusted: false
```

Verification conclusion:

- Host header spoofing does not make a non-loopback plain HTTP request secure.
- `X-Forwarded-Proto: https` does not make a non-loopback plain HTTP request secure unless the TCP peer IP is listed in `MISSION_CONTROL_TRUSTED_PROXY_PEERS`.
- A configured trusted proxy peer plus first forwarded proto value `https` is accepted.
- Non-sensitive `/health` remains allowed.
- This matches the required model: HTTP 3187 blocks login/session/admin/Kanban/PTY with 403 for non-loopback clients; HTTPS 3443 is the canonical user-facing app.

Build verification:

```text
Command: pnpm run build
Result: PASS — tsc -b and Vite production build completed successfully.
Observation: generated Pixi chunks still contain `new Function` code, so runtime browser proof under no-unsafe-eval CSP remains mandatory before final deploy.
```

## 4. Exact gates Biscuit / Cloud must pass

Biscuit gates before integration:

1. Must not add `'unsafe-eval'` to canonical `missionControlProxy.js` CSP.
2. Must implement a Pixi fix using a no-eval runtime/build path; preferred first attempt is Pixi's `pixi.js/unsafe-eval` compatibility import loaded before any Pixi Application/renderer construction, because reviewed Pixi code uses it to install no-eval polyfills.
3. Must prove in browser/e2e output that:
   - the office canvas renders, or an explicit safe fallback renders for no-WebGL only,
   - the HTTP response CSP does not include `'unsafe-eval'`,
   - browser console has no `Current environment does not allow unsafe-eval` Pixi fatal error.
4. Must add a regression check that fails if production CSP contains `'unsafe-eval'`.
5. Should open a follow-up hardening item to remove `script-src 'unsafe-inline'` using nonces/hashes or another Vite-compatible strict-CSP pattern.

Cloud gates before final deploy:

1. Must run production with `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT=true`.
2. Must keep canonical user-facing app on HTTPS 3443.
3. Must keep HTTP 3187 available only for health/static fallback; sensitive routes must return 403 from a non-loopback LAN client.
4. Must keep admin auth required: `MISSION_CONTROL_PROXY_AUTH_MODE=required` and a strong `MISSION_CONTROL_ADMIN_PROXY_KEY` injected only through runtime secret management, never source, built assets, docs, or browser storage.
5. If a reverse proxy forwards to plain 3187, must set `MISSION_CONTROL_TRUSTED_PROXY_PEERS` only to exact proxy source IPs; never use a wildcard; the client-facing proxy must be HTTPS-only.
6. Must run these non-loopback LAN smoke tests before cutover and include exact HTTP status output in final acceptance:

```bash
curl -s -o /dev/null -w '%{http_code}' http://<host>:3187/login
curl -s -o /dev/null -w '%{http_code}' http://<host>:3187/api/session
curl -s -o /dev/null -w '%{http_code}' http://<host>:3187/api/plugins/kanban/board
curl -s -o /dev/null -w '%{http_code}' http://<host>:3187/admin/keys
curl -s -H 'Host: 127.0.0.1:3187' -o /dev/null -w '%{http_code}' http://<host>:3187/login
curl -s -H 'X-Forwarded-Proto: https' -o /dev/null -w '%{http_code}' http://<host>:3187/login
curl -sk -o /dev/null -w '%{http_code}' https://<host>:3443/admin/keys
```

Required statuses:

- First six HTTP 3187 commands: `403`.
- HTTPS 3443 unauthenticated `/admin/keys`: `401`, proving HTTPS reached the auth gate rather than the transport gate.

Final AppSec gate outcome:

- Transport guard: CONDITIONAL APPROVAL, pending Cloud production env and non-loopback smoke proof.
- CSP/Pixi: CONDITIONAL APPROVAL only for no-`unsafe-eval` fixes with browser proof.
- Canonical-origin `'unsafe-eval'`: REJECTED for production.
