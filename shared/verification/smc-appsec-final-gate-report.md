# SMC AppSec Final Gate Report — Office CSP/Pixi Repair

**Card:** `t_d063acbf`  
**Verifier:** appsec-engineer  
**Timestamp (UTC):** 2026-06-30T14:49:53Z  
**Canonical live URL:** `https://192.168.10.5:3443`  
**Final live asset:** `/assets/index-k2GobxlW.js`  
**Scope:** Final AppSec verification for CSP/PixiJS v8 repair. No destructive actions performed. No response bodies for potentially sensitive endpoints were printed in this report.

## Final AppSec Gate

**Verdict: CONDITIONAL**

The CSP/Pixi repair itself is AppSec-approved: the live production CSP still omits `unsafe-eval`, the PixiJS v8 no-runtime-eval shim is implemented at the `GameRuntime` boundary, and the browser evidence shows `/office` renders without unsafe-eval/page-error failures or direct browser requests to `192.168.10.5:3187`.

The only condition is HTTP `:3187` route hygiene: `/api/keys`, `/config`, and `/cron` returned `200`, but command evidence shows they are the same static SPA fallback HTML as `/`, not JSON/API data. This is not a secrets exposure blocker for the tested paths, but it conflicts with the stronger “HTTP health-only” posture unless intentionally documented. Recommended follow-up: return `403` or `404` for unknown/API-like plaintext HTTP paths, or explicitly document that HTTP `:3187` serves static SPA fallback while sensitive routes are blocked.

## Evidence Summary

### 1. Production CSP excludes `unsafe-eval`

Verified live headers from `https://192.168.10.5:3443/office`:

```text
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'
```

Verified live headers from the deployed asset:

```text
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'
Content-Type: text/javascript; charset=utf-8
Content-Length: 799152
```

Assessment: **PASS**. `script-src` is exactly `'self' 'unsafe-inline'`; it does **not** include `'unsafe-eval'`. The Pixi repair did not weaken the deployed CSP.

### 2. Code-level Pixi fix is the no-runtime-eval shim, not a CSP relaxation

Verified source in `src/office/engine/GameRuntime.ts`:

```ts
// Pixi v8 uses generated shader/uniform sync functions by default. Under the
// production CSP (no `unsafe-eval`), Pixi's official workaround is this
// side-effect module, which swaps those runtime generators for no-eval
// polyfills. This does not require weakening missionControlProxy.js CSP.
import 'pixi.js/unsafe-eval';
import {
  Application,
  Container,
  Sprite,
  Assets,
  Texture,
  Spritesheet,
  Text,
  Ticker,
} from 'pixi.js';
```

Verified server CSP implementation in `missionControlProxy.js`:

```js
res.setHeader(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'"
);
```

Assessment: **PASS**. The repair uses PixiJS v8's side-effect compatibility module and leaves CSP unchanged with respect to `unsafe-eval`.

### 3. Browser evidence review

Reviewed `shared/verification/smc-live-browser-gate-csp-deploy/summary.json`:

```json
{
  "base": "https://192.168.10.5:3443",
  "scripts": ["https://192.168.10.5:3443/assets/index-k2GobxlW.js"],
  "badRequests": [],
  "networkTo3187": [],
  "fatalConsole": [],
  "pageErrors": []
}
```

Route results in the same summary:

```text
/team   -> status 200, canvasCount 0
/kanban -> status 200, canvasCount 1
/office -> status 200, canvasCount 1
```

Reviewed `shared/verification/smc-cloud-office-csp-deploy-report.md`, which records the Sora/Cloud Playwright gate as PASS with `/office` rendering a canvas under the no-unsafe-eval CSP.

Local attempted rerun of `node shared/verification/smc_live_browser_gate.mjs` did not complete because this verifier profile does not have the Playwright browser binary installed:

```text
browserType.launch: Executable doesn't exist at /home/wliob/.hermes/profiles/appsec-engineer/home/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
Please run: npx playwright install
```

Assessment: **PASS with existing Sora/Cloud browser artifact accepted**. The available browser artifact is directly relevant and shows no unsafe-eval/page errors and no direct browser requests to `192.168.10.5:3187`. The verifier-profile rerun blocker is tooling-local, not evidence of an application failure.

### 4. HTTP `:3187` plaintext exposure classification

Command-level probe, status and byte count only:

```text
/health -> http_code=200 size_download=56
/admin/keys -> http_code=403 size_download=208
/api/keys -> http_code=200 size_download=500
/config -> http_code=200 size_download=500
/cron -> http_code=200 size_download=500
```

Header-only probe for the questioned paths:

```text
-- /api/keys --
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 500

-- /config --
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 500

-- /cron --
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 500

-- /admin/keys --
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8
Content-Length: 208
```

Body hashes were compared without printing bodies:

```text
/         533a51476557a81108d073ed9690904894d6e46dfe382c73a29543a6a829908a
/api/keys 533a51476557a81108d073ed9690904894d6e46dfe382c73a29543a6a829908a
/config   533a51476557a81108d073ed9690904894d6e46dfe382c73a29543a6a829908a
/cron     533a51476557a81108d073ed9690904894d6e46dfe382c73a29543a6a829908a
```

Relevant code in `missionControlProxy.js`:

```js
export function isSensitivePlainHttpPath(requestPath) {
  const normalizedPath = String(requestPath ?? '');
  return (
    normalizedPath === '/api/pty'
    || normalizedPath.startsWith('/api/pty?')
    || normalizedPath.startsWith('/admin')
    || isKanbanProxyPath(normalizedPath)
    || isDashboardAuthBootstrapPath(normalizedPath)
  );
}

app.use(express.static(distDir));
app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
```

Classification for the named plaintext paths:

| Path | Result | Classification | Reason |
|---|---:|---|---|
| `/admin/keys` | `403` | PASS | Sensitive admin route is blocked on plaintext HTTP. |
| `/api/keys` | `200 text/html`, 500 bytes, same hash as `/` | CONDITIONAL | Not a secret/API exposure in current evidence; it is static SPA fallback. Conditional because an API-looking plaintext path returning 200 weakens the “health-only HTTP” claim and could confuse future route additions. |
| `/config` | `200 text/html`, 500 bytes, same hash as `/` | CONDITIONAL | Not a config-data exposure in current evidence; it is static SPA fallback. Conditional for the same HTTP route-hygiene reason. |
| `/cron` | `200 text/html`, 500 bytes, same hash as `/` | CONDITIONAL | Not a cron-data exposure in current evidence; it is static SPA fallback. Conditional for the same HTTP route-hygiene reason. |

Overall plaintext exposure assessment: **CONDITIONAL, not BLOCKER**. The probed paths did not return secrets or route-specific JSON data. The condition is to harden/document HTTP fallback behavior so “health-only” means health-only, or to explicitly accept static SPA fallback over plaintext while keeping sensitive routes blocked.

## Success Criteria Mapping

1. **Verify production CSP does not include unsafe-eval and Pixi fix does not weaken policy:** PASS.
2. **Verify browser evidence has no unsafe-eval/page errors and no direct browser requests to `192.168.10.5:3187`:** PASS based on existing Sora/Cloud browser artifact; local rerun blocked by missing Playwright browser binary in verifier profile.
3. **Review HTTP `:3187` plaintext exposure for `/api/keys`, `/config`, `/cron`:** CONDITIONAL, not blocker. They are static SPA fallback HTML by headers/hash, not sensitive JSON/API responses.
4. **State hard gate:** CONDITIONAL.
5. **Save report:** this file.

## Required Follow-up Before Full Unqualified Approval

Either:

1. Change the plaintext HTTP listener to return `403` or `404` for unknown/API-like paths such as `/api/keys`, `/config`, and `/cron`, leaving only `/health` and explicitly approved static assets; or
2. Update deployment/runbook language to accurately state that HTTP `:3187` serves static SPA fallback but blocks sensitive admin/auth/Kanban/PTY routes.

Preferred AppSec fix: option 1, because fail-closed route behavior is safer for future additions and matches the documented health-only intent.
