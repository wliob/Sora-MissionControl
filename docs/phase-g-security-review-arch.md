# Phase G: Architecture & Infrastructure Security Review — Sora-MissionControl v2

> **Date:** 2026-06-29
> **Auditor:** Hermes Agent (read-only, no modifications)
> **Scope:** `missionControlProxy.js`, deployment artifacts, browser adapter, network topology
> **Threat Model:** Local LAN admin dashboard with backend Hermes CLI access; no public internet exposure

---

## 1. Summary

| Dimension | Rating | Rationale |
|-----------|--------|-----------|
| Overall Risk | **MEDIUM** | Strong defense-in-depth on the proxy auth boundary, timing-safe token comparison, and honest unavailable states. Risk elevated by plain-HTTP LAN traffic, no-token development-default fallback, and a deprecated `window.__SORA_ADMIN_PROXY_KEY__` path. |
| Confidentiality | MEDIUM | Admin token transmitted in cleartext over LAN HTTP. Secrets in env vars readable by any process as the service user. |
| Integrity | LOW | Hermes CLI commands are allowlisted server-side; unsupported actions return `501`. No path traversal or command-injection surfaces found. |
| Availability | LOW | No auth bypasses on admin routes when required mode is active. Health endpoint is unauthenticated (by design). |

**Bottom line:** The proxy is well-architected for its stated threat model (trusted LAN operator). The primary risks are LAN eavesdropping (plain HTTP) and misconfiguration (accidental no-token mode in production). The deprecated `window.__SORA_ADMIN_PROXY_KEY__` path should be removed before a production release.

---

## 2. Findings

### 2.1 CRITICAL — None found

No critical vulnerabilities (auth bypass, RCE, secret leakage in source) were identified.

---

### 2.2 HIGH Severity

#### H-1: Plain HTTP on LAN — Token and Session Data in Cleartext

- **File:** All network communication (implicit architecture)
- **Issue Type:** Network Exposure / Data-in-Transit
- **Description:** All traffic between the browser and `missionControlProxy.js` (port 3187), and between the proxy and the Hermes dashboard (port 9119), is plain HTTP. The admin token (`X-Mission-Control-Key`) and Hermes session token (`X-Hermes-Session-Token`) are transmitted in cleartext headers. Any device on the same LAN segment can passively capture these tokens via ARP spoofing or promiscuous-mode sniffing.
- **Impact:** An attacker on the same LAN can capture the admin proxy token and gain full administrative control over the Hermes CLI (key management, MCP servers, cron jobs, webhooks, skills). They can also capture session tokens for the Kanban dashboard.
- **Remediation:**
  1. Add HTTPS support to `missionControlProxy.js` (Express TLS with self-signed or LAN CA cert).
  2. Document `https://` endpoints in the operator runbook.
  3. Consider mutual TLS or client certificates for the admin proxy if the threat model later includes less-trusted LAN segments.
  4. At minimum, document this risk clearly in the operator runbook so operators understand the LAN trust requirement.

#### H-2: Deprecated `window.__SORA_ADMIN_PROXY_KEY__` Token Persistence Path

- **File:** `src/services/hermes/adminProxyAdapter.ts:21,50`
- **Issue Type:** Secrets Management / Authentication
- **Description:** The browser adapter supports a deprecated `window.__SORA_ADMIN_PROXY_KEY__` global variable as a token source. Tokens placed here persist for the lifetime of the page and are visible to any JavaScript running in the same origin (including browser extensions, XSS payloads, or compromised third-party scripts). The adapter itself labels this as `@deprecated` (line 20), but the code path remains active.
- **Impact:** If an operator or deployment script sets this global, the token remains in memory and is accessible to any same-origin script. This undermines the session-only design.
- **Remediation:**
  1. Remove the `legacy-window` code path entirely from `adminProxyAdapter.ts`.
  2. Remove the `__SORA_ADMIN_PROXY_KEY__` type declaration from the global interface.
  3. Remove the `legacyWindowToken()` function and `isLocalOperatorHost()` guard.
  4. Update tests that reference `__SORA_ADMIN_PROXY_KEY__`.

---

### 2.3 MEDIUM Severity

#### M-1: No-Token Fallback is the Default Behavior

- **File:** `missionControlProxy.js:114-138` (resolveProxyAuthConfig), `missionControlProxy.js:134-138` (isAdminProxyRequestAuthorized)
- **Issue Type:** Authentication / Misconfiguration Risk
- **Description:** When `MISSION_CONTROL_PROXY_AUTH_MODE` is not set AND `MISSION_CONTROL_ADMIN_PROXY_KEY` is empty, the proxy serves ALL `/admin/*` routes without authentication (`auth.required = false`). This is intentional for local development, but it is the DEFAULT behavior. A deployment that forgets to set the env vars will run with no admin auth.
- **Impact:** Accidental unauthenticated admin access if env vars are misconfigured in production.
- **Remediation:**
  1. Consider inverting the default: if `NODE_ENV=production`, require auth even without explicit `AUTH_MODE` (defense-in-depth).
  2. Add a startup log message when running without admin auth: `console.warn('Admin proxy running WITHOUT authentication — all /admin/* routes are open')`.
  3. Document this behavior prominently in the operator runbook and the `.env.proxy` template.

#### M-2: Docker Container Runs as Root

- **File:** `Dockerfile:1-37` (no `USER` directive)
- **Issue Type:** Operational Security / Container Hardening
- **Description:** The Docker image uses `node:20-alpine` as the base image and does not specify a non-root `USER`. The proxy process runs as `root` inside the container. While container isolation limits blast radius, a compromised proxy process would have root privileges within the container, including the ability to install packages, modify files, and potentially escape via kernel vulnerabilities.
- **Impact:** Elevated privileges within the container increase the risk of container breakout or lateral movement.
- **Remediation:**
  1. Add `USER node` (or create a dedicated user) after the final `COPY` in the Dockerfile.
  2. Ensure the SSH key mount (`/var/run/secrets/hermes_tunnel:ro`) is readable by the non-root user.
  3. Add `security_opt: ["no-new-privileges:true"]` to `docker-compose.yml`.

#### M-3: Error Messages Leak Internal Details to Clients

- **File:** `missionControlProxy.js:575-614` (all `/admin/*` GET routes), `missionControlProxy.js:617-637` (action POST routes)
- **Issue Type:** Information Disclosure
- **Description:** All admin route error handlers return `error.message` directly to the client. If `hermes` CLI fails, the error message could include file paths (e.g., `/home/wliob/.local/bin/hermes`), usernames, hostnames, or Hermes-internal error details.
- **Impact:** Information disclosure about the host environment (paths, users, Hermes internals) to anyone who can reach the proxy and has a valid admin token.
- **Remediation:**
  1. In production (`NODE_ENV=production`), return generic error messages: `{ error: 'Internal server error' }`.
  2. Log the full error server-side for operator debugging.
  3. Keep detailed errors in development mode.

#### M-4: WebSocket Token in URL Query String

- **File:** `src/services/hermes/dashboardClient.ts:291-303`
- **Issue Type:** Secrets Management / Data-in-Transit
- **Description:** The Kanban WebSocket connection URL is constructed with the Hermes session token as a query parameter: `url.searchParams.set('token', token)`. Query strings in WebSocket URLs are transmitted in cleartext (over `ws://`), and they may be logged by proxies, load balancers, or browser developer tools.
- **Impact:** Session token exposure in server logs, proxy logs, or developer console.
- **Remediation:**
  1. If possible, send the token via a custom header during the WebSocket upgrade handshake.
  2. If the Hermes dashboard requires the query parameter, document this limitation.
  3. Use `wss://` if the dashboard supports it.

#### M-5: SSH Bridge — StrictHostKeyChecking=no

- **File:** `deploy/hermes-bridge.sh:19`
- **Issue Type:** Network Security / Trust
- **Description:** The Hermes Runtime Bridge script uses `StrictHostKeyChecking=no` and `UserKnownHostsFile=/dev/null` for SSH connections to the AI host. This disables host key verification entirely, making the connection vulnerable to MITM attacks on the LAN segment between Unraid Tower and the AI host.
- **Impact:** An attacker who can intercept the SSH connection (ARP spoofing, DNS poisoning) could impersonate the AI host and execute arbitrary commands on the Unraid container or capture the Hermes CLI output.
- **Remediation:**
  1. Pre-seed the container's `known_hosts` with the AI host's public key during image build or container startup.
  2. Use `StrictHostKeyChecking=yes` and mount a `known_hosts` file.
  3. At minimum, document this as a LAN-trust requirement in the operator runbook.

---

### 2.4 LOW Severity

#### L-1: Health Endpoint is Unauthenticated

- **File:** `missionControlProxy.js:574`
- **Issue Type:** Information Disclosure (minor)
- **Description:** The `/health` endpoint returns service metadata (`ok: true, service: 'sora-mission-control-admin-proxy'`) without authentication. This is standard practice for health checks but reveals the service name and status to anyone on the LAN.
- **Impact:** Minimal — service name disclosure on a LAN-only service.
- **Remediation:** Acceptable as-is for LAN use. Consider removing the service name from the response or requiring a shared health-check key if the LAN segment becomes less trusted.

#### L-2: Vite Dev Server Binds to 0.0.0.0

- **File:** `vite.config.ts:12-15`
- **Issue Type:** Network Exposure
- **Description:** The Vite dev server (`npm run dev`) binds to `0.0.0.0:5180`, exposing the React dev server to all network interfaces. Dev servers often have hot module replacement and may expose source maps.
- **Impact:** Source code and development-only features exposed to LAN during development.
- **Remediation:** Default to `127.0.0.1` for the dev server. Operators who need LAN access can override via `--host`.

#### L-3: CORS Wildcard Support

- **File:** `missionControlProxy.js:80-82`
- **Issue Type:** Network Exposure
- **Description:** The CORS configuration supports an explicit `*` wildcard origin (`MISSION_CONTROL_CORS_ORIGIN=*`), which would allow any website to make cross-origin requests to the proxy. The documentation warns against this, but the code supports it.
- **Impact:** If an operator inadvertently sets `MISSION_CONTROL_CORS_ORIGIN=*`, any website on the internet could attempt requests (though still blocked by LAN isolation unless a reverse proxy/tunnel is in place).
- **Remediation:** Consider removing `*` support entirely and requiring explicit origin lists. At minimum, add a startup warning when wildcard CORS is enabled.

#### L-4: `.env.proxy` Placeholder Committed to Repository

- **File:** `.env.proxy:16`
- **Issue Type:** Secrets Management
- **Description:** The `.env.proxy` file contains a development placeholder: `MISSION_CONTROL_ADMIN_PROXY_KEY=your_development_key_here`. While not a real secret, the `.gitignore` uses `.env.*` pattern which excludes `.env.proxy` from git tracking. However, the `create-release-bundle.sh` script does NOT include `.env.proxy` in the release tarball — good.
- **Impact:** Minimal. Placeholder is clearly labeled.
- **Remediation:** Already well-handled. Confirm `.env.proxy` is listed in `.gitignore` (it is — `.env.*` pattern covers it).

#### L-5: WebSocket Direct to Port 9119 Bypasses Proxy

- **File:** `src/services/hermes/dashboardClient.ts:97-110`
- **Issue Type:** Network Exposure / Architecture
- **Description:** When the browser is served from port 3187, the WebSocket connection is redirected to port 9119 directly (`url.port = '9119'`). This means the browser must have direct network access to the Hermes dashboard on port 9119 (not just port 3187). The operator runbook mentions port 9119 is the "Hermes Dashboard/Kanban source" but doesn't explicitly note that the browser connects there directly for WebSockets.
- **Impact:** Requires additional firewall hole (port 9119) for full Kanban functionality. May surprise operators.
- **Remediation:** Document in the operator runbook that the browser needs access to both port 3187 (proxy + static) and port 9119 (WebSocket events) for full functionality. Alternatively, proxy WebSocket connections through the Node proxy.

---

### 2.5 INFO Severity

#### I-1: Token Comparison Uses `timingSafeEqual` — Good

- **File:** `missionControlProxy.js:107-112`
- **Issue Type:** Positive Finding
- **Description:** The admin token comparison uses Node.js's `crypto.timingSafeEqual()` with length-constant-time pre-check. This prevents timing side-channel attacks on the token comparison.
- **Rating:** Excellent. This is the correct implementation.

#### I-2: Unsupported Actions Return Honest 501 — Good

- **File:** `missionControlProxy.js:381-521` (planKeyMcpAction, planCwsAction)
- **Issue Type:** Positive Finding
- **Description:** Mutations that the verified Hermes CLI does not safely support (key revocation, MCP token/note storage, webhook creation with callbackUrl semantics, skill enable/disable, cron model overrides) return `501 Not Implemented` with honest descriptive messages. This prevents the UI from making promises it cannot keep and avoids unsafe pass-through behavior.
- **Rating:** Excellent. Defense-in-depth against unsafe operations.

#### I-3: Bitwarden Secret Sanitization — Good

- **File:** `missionControlProxy.js:16-22` (stripNoise)
- **Issue Type:** Positive Finding
- **Description:** The `stripNoise()` function filters out lines containing `Bitwarden Secrets Manager: applied` from Hermes CLI output before it reaches the browser. This prevents accidental secret leakage through CLI output parsing.
- **Rating:** Good defense-in-depth. Consider expanding to other known secret patterns if Hermes CLI adds more secret-related output.

#### I-4: Session-Only Token Design — Good

- **File:** `src/services/hermes/adminProxyAdapter.ts:34,61-68`
- **Issue Type:** Positive Finding
- **Description:** The primary token path (`setMissionControlAdminProxyToken`) stores the admin token in a module-level variable (`let sessionAdminProxyToken`) that is cleared on page unload. The browser admin UI uses an `<input type="password">` with `autoComplete="off"` and explicitly clears the input after staging. The "Clear staged token" button is clearly visible.
- **Rating:** Good. Minimizes token exposure in browser memory.

#### I-5: Allowlisted Hermes CLI Commands — Good

- **File:** `missionControlProxy.js:381-521`
- **Issue Type:** Positive Finding
- **Description:** The proxy does not execute arbitrary `hermes` commands from the browser. Each admin action is mapped through a planner function that constructs exact CLI arguments. Unrecognized action types return `unsupported`. This prevents command injection.
- **Rating:** Excellent. Strong command allowlisting.

#### I-6: Body Parser Size Limit — Good

- **File:** `missionControlProxy.js:545`
- **Issue Type:** Positive Finding
- **Description:** `bodyParser.json({ limit: '256kb' })` limits request body size, mitigating memory exhaustion attacks.
- **Rating:** Good.

#### I-7: SSH Key Mounted Read-Only — Good

- **File:** `docker-compose.yml:26`
- **Issue Type:** Positive Finding
- **Description:** The SSH key for the Hermes Runtime Bridge is mounted read-only: `:ro`. The container cannot modify or exfiltrate the key.
- **Rating:** Good.

#### I-8: SSH Authorized Keys Restrictions — Good

- **File:** `deploy/OPERATOR-RUNBOOK.md:30-31`
- **Issue Type:** Positive Finding
- **Description:** The documented SSH authorized_keys entry for the bridge includes restrictions: `no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty`. This limits what the bridge key can do on the AI host.
- **Rating:** Good. Follow the principle of least privilege.

#### I-9: Release Bundle Excludes Sensitive Files — Good

- **File:** `deploy/create-release-bundle.sh:14-38`
- **Issue Type:** Positive Finding
- **Description:** The release bundle explicitly excludes `node_modules`, `shared/releases`, `shared/playwright-results`, `coverage`, and `*.tsbuildinfo`. It does NOT include `.env.proxy`, `.env`, or any secret files.
- **Rating:** Good.

#### I-10: Systemd Service Uses EnvironmentFile with Dash Prefix — Good

- **File:** `deploy/sora-missioncontrol-proxy.service:15`
- **Issue Type:** Positive Finding
- **Description:** `EnvironmentFile=-/etc/sora-missioncontrol/proxy.env` — the dash prefix means systemd will not fail if the file is missing. The secret file is documented with `0600` permissions.
- **Rating:** Good pattern.

#### I-11: CORS Default Same-Host/Loopback Only — Good

- **File:** `missionControlProxy.js:77-99`
- **Issue Type:** Positive Finding
- **Description:** By default, CORS allows only same-host origins or loopback aliases. Foreign origins are rejected unless explicitly configured. This prevents cross-origin attacks from arbitrary websites.
- **Rating:** Good. Appropriate default for a LAN-only service.

---

## 3. Positive Findings Summary

The following design decisions are commendable:

| # | Pattern | Location |
|---|---------|----------|
| 1 | Timing-safe token comparison (`timingSafeEqual` + length check) | `missionControlProxy.js:107-112` |
| 2 | Honest 501 responses for unsupported mutations | `missionControlProxy.js:381-521` |
| 3 | Bitwarden secret output sanitization (`stripNoise`) | `missionControlProxy.js:16-22` |
| 4 | Session-only browser token storage (module variable, not localStorage) | `adminProxyAdapter.ts:34,61-68` |
| 5 | Allowlisted CLI command construction (no arbitrary execution) | `missionControlProxy.js:381-521` |
| 6 | Body parser size limit (256 KB) | `missionControlProxy.js:545` |
| 7 | SSH key mounted read-only in Docker | `docker-compose.yml:26` |
| 8 | SSH authorized_keys restrictions (no forwarding, no PTY) | `OPERATOR-RUNBOOK.md:30-31` |
| 9 | Release bundle excludes sensitive files | `create-release-bundle.sh:14-38` |
| 10 | EnvironmentFile with dash prefix (graceful missing file) | `sora-missioncontrol-proxy.service:15` |
| 11 | Default CORS same-host/loopback only | `missionControlProxy.js:77-99` |
| 12 | Password-type input with autocomplete off | `AdminProxyAuthControl.tsx:76-79` |
| 13 | Explicit token clear button in UI | `AdminProxyAuthControl.tsx:108-124` |

---

## 4. Recommendations — Prioritized Fix List

### Before Production Deploy (P0-P1)

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| **P0** | H-2 | Remove deprecated `window.__SORA_ADMIN_PROXY_KEY__` path from `adminProxyAdapter.ts`. Remove global type declaration, `legacyWindowToken()`, and `isLocalOperatorHost()` guard. Update tests. | Small |
| **P0** | H-1 | Document LAN cleartext risk in operator runbook. Add a "Trust Model" section explaining that all traffic is plain HTTP and the LAN must be trusted. | Small |
| **P1** | M-1 | Add startup warning when running without admin auth. Consider inverting the default in `NODE_ENV=production`. | Small |
| **P1** | M-2 | Add `USER node` to Dockerfile. Add `no-new-privileges` to docker-compose.yml. | Small |
| **P1** | M-3 | Sanitize error messages in production (return generic errors, log details server-side). | Medium |
| **P1** | M-5 | Pre-seed known_hosts in the Docker image or mount one. Remove `StrictHostKeyChecking=no`. | Small |

### Before Expanding Scope (P2)

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| **P2** | H-1 (extended) | Add HTTPS (self-signed or LAN CA) to `missionControlProxy.js`. | Medium |
| **P2** | M-4 | Investigate WebSocket token-in-header instead of query string. | Medium |
| **P2** | L-2 | Default Vite dev server to `127.0.0.1`. | Small |
| **P2** | L-5 | Document browser direct-connect to port 9119 for WebSocket in runbook. Or proxy WS. | Small |

### Low Priority (P3)

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| **P3** | L-3 | Remove CORS wildcard support or add startup warning. | Small |
| **P3** | L-1 | Consider reducing `/health` endpoint verbosity. | Small |

---

## 5. Trust Boundary Analysis

### 5.1 Trust Boundaries Diagram

```
┌─────────────────────────────────────────────────────────┐
│ LAN Segment (192.168.0.0/24)                             │
│                                                          │
│  ┌──────────┐    HTTP :3187    ┌──────────────────────┐ │
│  │ Browser  │ ◄──────────────► │ missionControlProxy  │ │
│  │ (any LAN │                  │   (Node.js)          │ │
│  │  device) │                  │                      │ │
│  └──────────┘                  │  ┌────────────────┐  │ │
│                                │  │ Admin routes    │  │ │
│                                │  │ (token-gated)   │──┼─► hermes CLI (local)
│                                │  └────────────────┘  │ │
│                                │  ┌────────────────┐  │ │
│                                │  │ /api/* routes   │──┼─► Hermes Dashboard
│                                │  │ (proxied)       │  │   :9119 (HTTP)
│                                │  └────────────────┘  │ │
│  ┌──────────┐                  └──────────────────────┘ │
│  │ Browser  │── ws://:9119 ─────────────────────────────┼──► Hermes Dashboard
│  └──────────┘                  (WebSocket bypasses proxy)│   :9119 (WS)
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Docker container (Unraid Tower 192.168.10.5)      │   │
│  │  missionControlProxy ──SSH bridge──► AI Host :22  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Trust Boundary Answers

| Question | Answer |
|----------|--------|
| **Is the browser a trusted component?** | Semi-trusted. Same LAN, but the admin token is session-only and must be entered by the operator. No persistent auth. |
| **What can an attacker on the same LAN do?** | Capture admin and session tokens via passive sniffing (plain HTTP). ARP-spoof the proxy or dashboard. Replay captured tokens. MitM the SSH bridge (due to StrictHostKeyChecking=no). |
| **What can an attacker with Hermes host access do?** | Full compromise — they already have shell access and can run `hermes` CLI directly. The proxy adds no additional risk in this scenario. |
| **Are there LAN → WAN jumps?** | No deliberate jumps. The Docker SSH bridge connects Unraid Tower → AI Host (both LAN). No Cloudflare Tunnel, reverse proxy, or public internet exposure is configured. |
| **Admin token storage** | Env var `MISSION_CONTROL_ADMIN_PROXY_KEY` in `/etc/sora-missioncontrol/proxy.env` (0600) or `/home/wliob/.config/sora-missioncontrol/proxy.env` (0600). Transmitted as `X-Mission-Control-Key` header. |
| **Timing-safe comparison?** | Yes — `crypto.timingSafeEqual()` with length pre-check. |
| **Auth scope** | All `/admin/*` routes. `/health`, static files, and `/api/*` (Kanban proxy) are NOT gated by the admin token. |
| **Session-only token?** | Yes for the primary path (module variable cleared on page unload). No for the deprecated `window.__SORA_ADMIN_PROXY_KEY__` path. |
| **No-token fallback** | When `MISSION_CONTROL_PROXY_AUTH_MODE` is unset and no key is configured, ALL admin routes are open. This is the default. |
| **Admin routes bypass?** | None found. `isAdminProxyRequestAuthorized` gates all `/admin/*` prefixes. |
| **CORS configuration** | Default same-host/loopback. Configurable via `MISSION_CONTROL_CORS_ORIGIN`. Supports explicit origin lists and `*` wildcard. |
| **Port 9119 isolation** | The proxy forward Kanban REST API calls to port 9119. The browser also connects directly to port 9119 for WebSocket events. Port 9119 must be accessible from browser for full Kanban functionality. |
| **Docker user** | Runs as `root` inside container. No `USER` directive. |
| **Logging** | `stripNoise()` removes Bitwarden secret lines. Error messages may leak paths/hostnames/CLI details. |
| **Release bundle secrets** | `.env.proxy` and `.env` files are excluded from the release tarball. No secrets in the bundle. |
| **Secrets in git/docs?** | No real secrets found. `.env.proxy` contains a `your_development_key_here` placeholder. All `MISSION_CONTROL_ADMIN_PROXY_KEY` references in docs use `<runtime-secret>` placeholders. |

---

## 6. Methodology

This review was conducted via static analysis of the complete codebase, focusing on:

1. **Trust boundary mapping** — all network connections, process boundaries, and data flows
2. **Authentication flow** — token generation, storage, transmission, comparison, and scope
3. **Authorization enforcement** — route gating, path checking, fallback behavior
4. **Network exposure** — port bindings, CORS, proxy forwarding, WebSocket topology
5. **Secrets lifecycle** — where secrets live on disk, in memory, in transit, in git, in release bundles
6. **Operational hardening** — process user, container isolation, error handling, logging

**Files reviewed:** 18 files, ~3,500 lines of code + documentation.

**Tools used:** `read_file`, `search_files`, `terminal` (hex dump verification), manual analysis.

**Limitations:** No dynamic testing (penetration testing, fuzzing, live traffic capture). No review of Hermes CLI internals or Hermes Dashboard source code. Docker image not built and scanned.

---

*End of Phase G Security Review*
