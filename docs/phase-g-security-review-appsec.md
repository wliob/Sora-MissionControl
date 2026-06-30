# Phase G — Application Security Review: Sora-MissionControl v2

**Audit date:** 2026-06-29  
**Auditor:** Hermes Agent (automated code-level review)  
**Scope:** Read-only audit of `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/`  
**Methodology:** Static analysis of all source files, deployment configs, Docker artifacts, and type definitions. No runtime testing performed.

---

## 1. Summary

| Rating | Definition |
|--------|-----------|
| **Overall Risk: MEDIUM** | No code-execution vulnerabilities found; several hardening gaps exist for a production LAN deployment |

The codebase demonstrates strong security awareness — constant-time token comparisons, session-only token handling, defense-in-depth secret masking, and confirmation-gate patterns are all present. However, the absence of security headers (CSP, HSTS, nosniff), lack of rate limiting, plain-HTTP transport, and error information leakage raise the risk level for a production deployment. The command injection surface via Hermes CLI arguments is mitigated by `execFile` (no shell), but the lack of argument sanitization for user-controlled fields remains a concern.

**Bottom line:** Safe to deploy on a trusted LAN with the current mitigations, but the HIGH-severity items below should be addressed before wider exposure.

---

## 2. Findings

### Finding A — CLI argument injection via admin action parameters
- **Severity:** HIGH
- **File:** `missionControlProxy.js:24–41, 381–521`
- **Type:** Argument injection (not shell injection — `execFile` avoids the shell)
- **Description:** The `runHermes(args)` function passes user-controlled values (e.g., `action.id`, `action.name`, `action.url`, `action.prompt`, `action.schedule`) directly into the `execFile` argument array without validation or escaping. While `child_process.execFile` does NOT invoke a shell, Hermes CLI may interpret positional arguments that start with `-` or `--` as flags. For example:
  - `action.id = "--config /etc/passwd"` injected into `['cron', 'pause', action.id]` → `['cron', 'pause', '--config', '/etc/passwd']`
  - `action.name = "--dangerous-flag"` injected into `['mcp', 'add', action.name]`
  
  The `planKeyMcpAction` and `planCwsAction` functions construct argument arrays directly from user-supplied action payloads.

- **Remediation:** Validate that all user-controlled values passed as CLI arguments do not start with `-` or `--`. Reject or strip leading dashes from `action.id`, `action.name`, `action.url`, `action.prompt`, `action.schedule`, `action.script`, and `action.skills[]` entries.

### Finding B — Missing security headers (CSP, HSTS, nosniff, frame-options)
- **Severity:** HIGH
- **File:** `missionControlProxy.js:534–649` (middleware chain), `dist/index.html`
- **Type:** Missing HTTP security headers
- **Description:** The Express proxy does not set any of the following security headers:
  - **Content-Security-Policy** — No CSP whatsoever. An XSS vector in the React app would have no browser-enforced mitigation.
  - **X-Content-Type-Options: nosniff** — Missing MIME-type sniffing protection.
  - **Strict-Transport-Security** — Not applicable currently (HTTP-only), but should be added if HTTPS is ever enabled.
  - **X-Frame-Options** — No clickjacking protection (though this is a dashboard, not a bank).
  - **Referrer-Policy** — Not set.
  
  The `dist/index.html` also has no `<meta http-equiv="Content-Security-Policy">` tag.

- **Remediation:** Add a middleware (or `helmet` npm package) to set:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://192.168.0.85:9119 http://192.168.0.85:9119; font-src 'self'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  ```

### Finding C — Plain HTTP transport (no TLS)
- **Severity:** HIGH
- **File:** `missionControlProxy.js:652–659`, `deploy/sora-missioncontrol-proxy.service`, `docker-compose.yml`
- **Type:** Cleartext transport
- **Description:** All traffic between the browser and the proxy, and between the proxy and the Hermes dashboard (192.168.0.85:9119), is HTTP. The admin proxy token (`X-Mission-Control-Key`) and dashboard session tokens traverse the LAN in cleartext. While this is acceptable on a fully trusted isolated LAN segment, any passive network observer on the same broadcast domain can capture tokens.
- **Remediation:** For production LAN use, either:
  - Accept the risk and document it as LAN-only with a trusted network assumption, OR
  - Add a reverse proxy (nginx/Caddy) with a self-signed certificate in front of the Express app, OR
  - Add native TLS support to the Express app.

### Finding D — Error information leakage to clients
- **Severity:** MEDIUM
- **File:** `missionControlProxy.js:579, 586, 593, 606, 613, 624, 635, 377`
- **Type:** Information disclosure
- **Description:** Multiple admin endpoints and the dashboard proxy route return raw error messages to clients:
  - `res.status(500).json({ error: error.message })` — on admin GET routes
  - `res.status(500).json(actionResult(action, false, error.message))` — on admin POST routes
  - `res.status(502).json({ error: error.message || 'Failed to reach Hermes dashboard target' })` — on dashboard proxy failure
  
  These error messages may contain filesystem paths, Hermes CLI internal details, or stack traces depending on the underlying error.

- **Remediation:** Log the full error server-side and return a generic message to clients:
  ```js
  console.error('Admin route error:', error);
  res.status(500).json({ error: 'Internal server error' });
  ```

### Finding E — No rate limiting on admin endpoints
- **Severity:** MEDIUM
- **File:** `missionControlProxy.js:534–649`
- **Type:** Missing rate limiting
- **Description:** There is no rate limiting on any route, including `/admin/keys`, `/admin/keymcp/actions`, `/admin/cws/actions`, or the token-authenticated endpoints. An attacker on the LAN could brute-force the admin token by rapidly sending requests with different `X-Mission-Control-Key` values. While the token comparison uses `timingSafeEqual` (constant-time), there is no attempt-limiting or lockout mechanism.
- **Remediation:** Add `express-rate-limit` middleware with a low cap (e.g., 5 requests per minute) on `/admin/*` routes, especially POST routes.

### Finding F — Docker container runs as root
- **Severity:** MEDIUM
- **File:** `Dockerfile:14–36`
- **Type:** Container privilege
- **Description:** The production stage (`FROM node:20-alpine`) does not create or switch to a non-root user. The container runs as root. While Docker provides some isolation, a container breakout or filesystem access vulnerability would have root privileges inside the container.
- **Remediation:** Add after line 14:
  ```dockerfile
  RUN addgroup -S app && adduser -S app -G app
  USER app
  ```

### Finding G — CORS wildcard support is dangerous if misconfigured
- **Severity:** LOW
- **File:** `missionControlProxy.js:80–82`
- **Type:** CORS misconfiguration risk
- **Description:** The `resolveCorsOrigin` function explicitly supports `configuredOrigins.includes('*')` which returns `'*'` as the `Access-Control-Allow-Origin`. This wildcard has legitimate use cases but could be accidentally enabled via the `MISSION_CONTROL_CORS_ORIGIN=*` environment variable, allowing any origin to make credentialed requests (note: `Access-Control-Allow-Origin: *` does NOT support credentials, but still broadens the attack surface).
- **Remediation:** Either remove wildcard support or add a runtime warning when `*` is used alongside token-required auth mode.

### Finding H — SSH bridge disables host key checking
- **Severity:** LOW
- **File:** `deploy/hermes-bridge.sh:19`
- **Type:** Weakened SSH security
- **Description:** The bridge script uses `StrictHostKeyChecking=no` and `UserKnownHostsFile=/dev/null`, which disables SSH host key verification. This is acceptable on a trusted LAN with known hosts, but an ARP spoofing attack could redirect the SSH connection to a malicious host.
- **Remediation:** Pre-populate `/etc/ssh/ssh_known_hosts` in the Docker image with the AI host's key and remove `StrictHostKeyChecking=no`.

### Finding I — Dev Vite server binds to all interfaces
- **Severity:** INFO
- **File:** `vite.config.ts:13`
- **Type:** Development exposure
- **Description:** The Vite dev server binds to `0.0.0.0:5180`, making it accessible from any host on the LAN during development. This is normal for LAN development but should be documented.
- **Remediation:** Document that `npm run dev` exposes port 5180 to the LAN. Consider binding to `127.0.0.1` by default and using `--host` only when needed.

### Finding J — Deprecated window token path still active
- **Severity:** INFO
- **File:** `src/services/hermes/adminProxyAdapter.ts:48–52`
- **Type:** Deprecated feature
- **Description:** The `legacyWindowToken()` function reads from `window.__SORA_ADMIN_PROXY_KEY__` when on localhost. This deprecated path is still functional and could be a vector if an XSS vulnerability existed on the page (an attacker could set `window.__SORA_ADMIN_PROXY_KEY__` to intercept admin requests). However, it's restricted to localhost-only.
- **Remediation:** Remove the legacy path entirely, or gate it behind an explicit opt-in flag.

---

## 3. Positive Findings

The following security practices are correctly implemented:

| # | Practice | Location |
|---|----------|----------|
| 1 | **Constant-time token comparison** — Uses `crypto.timingSafeEqual()` to prevent timing attacks on admin token validation. | `missionControlProxy.js:107–112` |
| 2 | **Session-only token storage** — Admin token held in a module-level variable (`sessionAdminProxyToken`), never written to `localStorage`/`sessionStorage`. Confirmed by test that verifies storage is empty after token set. | `adminProxyAdapter.ts:34, 62–63`, `adminProxyAdapter.test.ts:86–87` |
| 3 | **Password-type input field** — Token entry uses `<input type="password">` to prevent shoulder-surfing. | `AdminProxyAuthControl.tsx:78` |
| 4 | **CORS hardener** — Default policy allows only same-host and loopback origins. Foreign origins are rejected. Configurable allowlist requires exact match. | `missionControlProxy.js:77–99` |
| 5 | **Bitwarden secret stripping** — `stripNoise()` removes Bitwarden Secrets Manager output lines before sending data to clients. | `missionControlProxy.js:16–22` |
| 6 | **Masked secrets in store state** — `ApiKey.maskedSecret`, `McpEntry.maskedToken`, `WebhookEntry.maskedSecret` — raw values only appear in one-time creation payloads and are immediately dropped after display. | `admin-keymcp.ts:35–53`, `admin-cws.ts:86–117` |
| 7 | **Confirmation gates** — Destructive actions (key.delete, mcp.remove, cron.remove, webhook.remove) require explicit confirmation. Danger-tier actions additionally require typing the entity name. | `RiskConfirmDialog.tsx`, `adminKeyMcpStore.ts:269–298`, `cwsAdminStore.ts:201–219` |
| 8 | **Defense-in-depth secret validation** — `validateCronMasking()` and `validateWebhookMasking()` reject data from adapters if it appears to contain unmasked secrets. | `cwsAdminStore.ts:95–117` |
| 9 | **Honest unsupported pattern** — Backend paths not verified as safe return `{ unsupported: "reason" }` rather than silently succeeding or mocking data. | `missionControlProxy.js:308–310, 400–404, 450–454, 514–520` |
| 10 | **Body size limiting** — `bodyParser.json({ limit: '256kb' })` prevents oversized payload attacks. | `missionControlProxy.js:545` |
| 11 | **Read-only SSH key mount** — Docker mounts the SSH key as `:ro` (read-only). | `docker-compose.yml:26` |
| 12 | **SSH key restrictions** — `authorized_keys` entry restricts the bridge key: no port forwarding, no X11, no agent, no PTY. | `OPERATOR-RUNBOOK.md:30` |
| 13 | **No `dangerouslySetInnerHTML` or `eval()`** — Zero instances found in the entire `src/` tree. All rendering uses safe JSX. | Full codebase scan |
| 14 | **Runbook documents security** — Operator runbook includes explicit instructions for 0600 permissions on the env file, required auth mode for production, and smoke tests for 401 responses. | `deploy/OPERATOR-RUNBOOK.md` |
| 15 | **Test coverage for auth flows** — Tests verify token-required mode, unauthorized access returns 401, session token not persisted, and CORS enforcement. | `missionControlProxy.test.ts`, `adminProxyAdapter.test.ts` |

---

## 4. Recommendations — Prioritized Fix List

### Before Production Deploy (Blockers)

| # | Priority | Finding | Action |
|---|----------|---------|--------|
| 1 | **HIGH** | CLI argument injection | Add validation in `planKeyMcpAction` and `planCwsAction` to reject `action.id`, `action.name`, `action.url`, `action.prompt`, `action.schedule`, `action.script`, and `action.skills[]` entries that start with `-` or `--`. |
| 2 | **HIGH** | Missing security headers | Add CSP, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers via Express middleware. |
| 3 | **HIGH** | Plain HTTP | Document as LAN-only with trusted network assumption. Consider adding TLS if the service is ever exposed beyond the LAN. |
| 4 | **MEDIUM** | Error information leakage | Replace raw `error.message` in HTTP responses with generic "Internal server error" messages. Log the full error server-side. |
| 5 | **MEDIUM** | No rate limiting | Add `express-rate-limit` with 5 req/min on `/admin/*` POST routes and 20 req/min on GET routes. |

### Before Wider Exposure

| # | Priority | Finding | Action |
|---|----------|---------|--------|
| 6 | **MEDIUM** | Docker runs as root | Add `USER node` (or create a dedicated `app` user) in the Dockerfile. |
| 7 | **LOW** | SSH `StrictHostKeyChecking=no` | Pre-populate `known_hosts` in the Docker image and remove the flag. |
| 8 | **LOW** | CORS wildcard support | Add a warning log when `MISSION_CONTROL_CORS_ORIGIN=*` is used. |
| 9 | **INFO** | Deprecated window token | Remove `window.__SORA_ADMIN_PROXY_KEY__` support or gate it behind an explicit opt-in. |

### Nice-to-Haves

| # | Priority | Action |
|---|----------|--------|
| 10 | LOW | Add request ID (`X-Request-ID`) header to all responses for audit trail. |
| 11 | LOW | Add health check for dashboard connectivity (`/health/dashboard`) that probes the Hermes API. |
| 12 | INFO | Consider `helmet` npm package for one-liner security headers instead of manual middleware. |
| 13 | INFO | Add `.dockerignore` to prevent `.env.proxy` and test files from being copied into the Docker build context. |

---

## 5. Dependency Notes

- **package.json** dependencies are relatively recent (React 18.3, Express 5.2, PixiJS 8.4, Vite 6, TypeScript 5.6). No obviously end-of-life packages.
- **body-parser 2.3.0** is part of Express 5's bundled middleware — ensure it's the latest.
- No `npm audit` or `pnpm audit` output was checked; recommend running `pnpm audit` before deploy.
- `pnpm-lock.yaml` exists but was not analyzed for known-vulnerable transitive dependencies.

---

*End of report.*
