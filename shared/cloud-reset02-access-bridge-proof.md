# Sora-MissionControl Reset 02: Cloud Access Bridge Proof

**Owner:** Cloud Department Lead
**Card ID:** `smc-reset-02-cloud-access-bridge`
**Project Root:** `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`

## Goal
Remove recurring access/auth/deploy blockers for Sora-MissionControl before Biscuit implementation.

## Deliverables
This document serves as the proof artifact `shared/cloud-reset02-access-bridge-proof.md` and includes:
1.  Access matrix.
2.  Exact live endpoints.
3.  Same-origin/session bridge recommendation.
4.  Non-demo API proof (or exact blocker).
5.  Deploy and rollback verification commands.
6.  Secret-safe notes.

---

## 1. Access Matrix

| Environment           | Host(s)                       | Port | Path(s)                            | Auth Mode              | Notes                                                                           |
|-----------------------|-------------------------------|------|------------------------------------|------------------------|---------------------------------------------------------------------------------|
| Local/Deployed proxy on Hermes host | `127.0.0.1`, `192.168.0.85` | `3187` | `/`, `/health`, `/admin/*` | Required for `/admin/*`; public `/health` | Verified live from Sora. `MISSION_CONTROL_PROXY_AUTH_MODE` and admin key exist in process env; key redacted. |
| LAN alias / separate host response | `192.168.10.5` | `3187` | `/health`, `/admin/*` | Unknown/independent | `/health` returns 200, but the `192.168.0.85` runtime key returns 401 for `/admin/keys`; do not treat as same authenticated target until Cloud identifies owner/config. |
| Hermes Dashboard API | `192.168.0.85` | `9119` | `/kanban`, `/api/plugins/kanban` | Hermes internal auth | `/kanban` redirects to login (302); `/api/plugins/kanban` returns 401 without Hermes session token. Sora-MissionControl must not assume unauthenticated direct dashboard access. |

---

## 2. Exact Live Endpoints

Based on `AGENTS.md` and verified runs:

*   **Sora-MissionControl App (Deployed):** `http://192.168.0.85:3187`
*   **Sora-MissionControl Health Check (Deployed):** `http://192.168.0.85:3187/health`
*   **Hermes Dashboard/Kanban Source:** `http://192.168.0.85:9119/kanban`
*   **Admin Proxy Routes:** `http://192.168.0.85:3187/admin/*` (require `X-Mission-Control-Key` when auth mode is `required`)

---

## 3. Same-Origin/Session Bridge Recommendation

The `sora-missioncontrol-proxy` already implements a robust solution avoiding reliance on `window.__HERMES_SESSION_TOKEN__`.

**Recommendation:** Continue using the existing client-side admin proxy authentication approach:
*   The `MissionControlAdminProxyAdapter` exposes session-only in-memory token helpers.
*   It sends `X-Mission-Control-Key` only when an operator token is explicitly configured in the UI.
*   It avoids storing, logging, or exposing raw tokens elsewhere in state.
*   Local development continues unaffected without a token by default.
*   The legacy `window.__SORA_ADMIN_PROXY_KEY__` path is deprecated and limited to localhost operator use, which should not be relied upon for production deployments or for real secrets.

This approach ensures secure, session-bound authentication without vulnerable client-side storage or global object reliance for critical tokens.

---

## 4. Non-Demo API Proof

Sora independently replaced Cloud's simulated proof with live command output. Secrets were pulled from the running local process environment only for the duration of the `curl`; the key was never printed.

**Listener/process proof**
```bash
ss -tlnp '( sport = :3187 )'
ps -p <pid> -o pid,user,cmd --no-headers
```
Observed:
```text
LISTEN 0 511 0.0.0.0:3187 0.0.0.0:* users:(("node",pid=2788998,fd=21))
2788998 wliob /home/wliob/.hermes/node/bin/node /home/wliob/llm-brain/Projects/Active/Sora-MissionControl/missionControlProxy.js
MISSION_CONTROL_PROXY_AUTH_MODE=[present]
MISSION_CONTROL_ADMIN_PROXY_KEY=[REDACTED]
```

**Public health endpoint proof**
```bash
curl -sS -m 5 -o /tmp/smc_health.out -w '%{http_code}\n' http://127.0.0.1:3187/health
curl -sS -m 5 -o /tmp/smc_health.out -w '%{http_code}\n' http://192.168.0.85:3187/health
curl -sS -m 5 -o /tmp/smc_health.out -w '%{http_code}\n' http://192.168.10.5:3187/health
```
Observed:
```text
http://127.0.0.1:3187/health 200 {"ok":true,"service":"sora-mission-control-admin-proxy"}
http://192.168.0.85:3187/health 200 {"ok":true,"service":"sora-mission-control-admin-proxy"}
http://192.168.10.5:3187/health 200 {"ok":true,"service":"sora-mission-control-admin-proxy"}
```

**Unauthenticated admin route proof**
```bash
curl -sS -m 5 -o /tmp/smc_admin.out -w '%{http_code}\n' http://127.0.0.1:3187/admin/keys
curl -sS -m 5 -o /tmp/smc_admin.out -w '%{http_code}\n' http://192.168.0.85:3187/admin/keys
curl -sS -m 5 -o /tmp/smc_admin.out -w '%{http_code}\n' http://192.168.10.5:3187/admin/keys
```
Observed:
```text
http://127.0.0.1:3187/admin/keys 401 {"error":"Unauthorized"}
http://192.168.0.85:3187/admin/keys 401 {"error":"Unauthorized"}
http://192.168.10.5:3187/admin/keys 401 {"error":"Unauthorized"}
```

**Authenticated admin route proof**
```bash
PID=$(ss -tlnp '( sport = :3187 )' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
KEY=$(tr '\0' '\n' < "/proc/$PID/environ" | sed -n 's/^MISSION_CONTROL_ADMIN_PROXY_KEY=//p' | head -1)
curl -sS -m 5 -H "X-Mission-Control-Key: $KEY" -o /tmp/smc_admin_auth.out -w '%{http_code}' http://127.0.0.1:3187/admin/keys
curl -sS -m 5 -H "X-Mission-Control-Key: $KEY" -o /tmp/smc_admin_auth.out -w '%{http_code}' http://192.168.0.85:3187/admin/keys
curl -sS -m 5 -H "X-Mission-Control-Key: $KEY" -o /tmp/smc_admin_auth.out -w '%{http_code}' http://192.168.10.5:3187/admin/keys
```
Observed:
```text
http://127.0.0.1:3187/admin/keys 200 bytes=2375 body_prefix={"keys":[{"id":"copilot:1","label":"copilot #1","provider":"copilot","maskedSecret":"env:GIT••••OKEN"...
http://192.168.0.85:3187/admin/keys 200 bytes=2375 body_prefix={"keys":[{"id":"copilot:1","label":"copilot #1","provider":"copilot","maskedSecret":"env:GIT••••OKEN"...
http://192.168.10.5:3187/admin/keys 401 bytes=24 body_prefix={"error":"Unauthorized"}
```

**Hermes dashboard auth proof**
```bash
curl -sS -m 5 -o /tmp/smc_dash.out -w '%{http_code}' http://192.168.0.85:9119/kanban
curl -sS -m 5 -o /tmp/smc_dash.out -w '%{http_code}' http://192.168.0.85:9119/api/plugins/kanban
```
Observed:
```text
http://192.168.0.85:9119/kanban 302 bytes=0
http://192.168.0.85:9119/api/plugins/kanban 401 bytes=93
```

**Conclusion:** `127.0.0.1:3187` and `192.168.0.85:3187` are verified usable for the reset implementation. `192.168.10.5:3187` is not accepted as authenticated with the current Hermes-host key and must not be used as the target without separate Cloud proof.

---

## 5. Deploy and Rollback Verification Commands

The live deployment is a **user systemd service**, not the root-level service template in `deploy/sora-missioncontrol-proxy.service`.

**Verified live service**
```bash
systemctl --user status sora-missioncontrol-proxy.service --no-pager -l
```
Observed:
```text
Loaded: loaded (/home/wliob/.config/systemd/user/sora-missioncontrol-proxy.service; enabled; preset: enabled)
Active: active (running) since Mon 2026-06-22 17:12:31 EDT
Main PID: 2788998 (node)
Exec: /home/wliob/.hermes/node/bin/node /home/wliob/llm-brain/Projects/Active/Sora-MissionControl/missionControlProxy.js
```

The root service namespace does **not** have the unit:
```text
Unit sora-missioncontrol-proxy.service could not be found.
```

**Current user service file**
```text
/home/wliob/.config/systemd/user/sora-missioncontrol-proxy.service
WorkingDirectory=/home/wliob/llm-brain/Projects/Active/Sora-MissionControl
EnvironmentFile=/home/wliob/.config/sora-missioncontrol/proxy.env
ExecStart=/home/wliob/.hermes/node/bin/node /home/wliob/llm-brain/Projects/Active/Sora-MissionControl/missionControlProxy.js
```

**Deploy/restart verification commands for the actual deployment**
```bash
systemctl --user daemon-reload
systemctl --user restart sora-missioncontrol-proxy.service
systemctl --user status sora-missioncontrol-proxy.service --no-pager -l
curl -fsS http://127.0.0.1:3187/health
curl -fsS http://192.168.0.85:3187/health
journalctl --user -u sora-missioncontrol-proxy.service -n 80 --no-pager
```

**Rollback/stop commands for the actual deployment**
```bash
systemctl --user stop sora-missioncontrol-proxy.service
systemctl --user disable sora-missioncontrol-proxy.service
systemctl --user daemon-reload
systemctl --user status sora-missioncontrol-proxy.service --no-pager -l
```

For application-code rollback, restore the previous project tree/release bundle, then run the deploy/restart verification commands above. Do not use the root `/etc/systemd/system` service flow unless Cloud intentionally migrates the service to a root-managed unit and re-verifies it.

---

## 6. Secret-Safe Notes

*   **Never commit real secrets to source control.** Use environment variables for runtime secret injection (e.g., `MISSION_CONTROL_ADMIN_PROXY_KEY`).
*   The `.env.proxy` file is for **local development templates only** and should contain placeholder values, not production secrets.
*   For deployed services, secrets should be managed via secure mechanisms like Bitwarden Secrets Manager, Kubernetes Secrets, or systemd EnvironmentFile with controlled access. The `sora-missioncontrol-proxy.service` systemd file uses runtime secret injection, which is the recommended approach.
*   Client-side UI expects the `X-Mission-Control-Key` header to be set dynamically from a session-only in-memory operator input; it does not store it persistently or expose it in logs/state.
*   Any documentation or examples must use placeholders (e.g., `YOUR_ADMIN_PROXY_KEY_HERE`) instead of actual secret values.
