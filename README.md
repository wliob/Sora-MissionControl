# Sora-MissionControl

Custom Hermes mission-control dashboard for the local LAN.

**GitHub:** https://github.com/wliob/Sora-MissionControl
**Release:** https://github.com/wliob/Sora-MissionControl/releases/tag/v1.0.0
**Version:** v1.0.0

## Status

v1.0.0 released. Phases 0-5 are complete for the current scope. Phase 6 and Phase 7 are live with verified safe subsets and honest unavailable states for unsupported backend actions. Phase 8 has browser proof coverage. 753/753 tests passing. CSP-compliant (no unsafe-eval).

**Primary deployment:** Docker container `sora-missioncontrol-proxy` on Unraid Tower (192.168.10.5).

## Connection URLs

| Endpoint | URL | Notes |
|----------|-----|-------|
| **App (HTTPS)** | `https://192.168.10.5:3443` | Primary — all user traffic |
| **Health (HTTPS)** | `https://192.168.10.5:3443/health` | Returns `{"ok":true,"service":"sora-mission-control-admin-proxy"}` |
| **Health (HTTP)** | `http://192.168.10.5:3187/health` | Health check only — sensitive routes blocked |
| **SPA (HTTP fallback)** | `http://192.168.10.5:3187` | Static assets only — admin/auth/login return 403 |
| **Hermes Dashboard/Kanban source** | `http://192.168.0.85:9119/kanban` | Hermes host (baset-ai) backend API |

**Security:** Plain HTTP on port 3187 blocks all sensitive routes (admin, login, session, Kanban API) with HTTP 403. The `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT=true` gate is active. All user-facing access must use HTTPS on port 3443.

Development-host test URLs used by Playwright and smoke checks:

- Temporary app + admin proxy during local test runs: `http://127.0.0.1:3187`
- Development host LAN smoke: `http://192.168.10.18:3187`

## Run Locally

```bash
npm ci
npm run build
MISSION_CONTROL_PROXY_HOST=0.0.0.0 \
MISSION_CONTROL_PROXY_PORT=3187 \
MISSION_CONTROL_PROXY_AUTH_MODE=required \
MISSION_CONTROL_ADMIN_PROXY_KEY=<runtime-secret> \
node missionControlProxy.js
```

The browser admin UI accepts the proxy token through the `Systems proxy token` password field for the current tab only. Do not bake real tokens into source, docs, built assets, `.env.proxy`, or `window.__SORA_ADMIN_PROXY_KEY__`.

**Security warning:** Running without `MISSION_CONTROL_PROXY_AUTH_MODE=required` leaves admin routes unprotected. Always set `MISSION_CONTROL_PROXY_AUTH_MODE=required` and a strong `MISSION_CONTROL_ADMIN_PROXY_KEY` for any deployment that is reachable beyond localhost.

## Verification

```bash
npm run lint
npm test -- --run
npm run build
npm run test:e2e
```

### Smoke tests — deployed container

```bash
# HTTPS health (canonical)
curl -fsk https://192.168.10.5:3443/health

# HTTP health (allowed)
curl -fsS http://192.168.10.5:3443/health

# HTTP sensitive routes MUST return 403
curl -s -o /dev/null -w '%{http_code}' http://192.168.10.5:3187/admin/keys   # → 403
curl -s -o /dev/null -w '%{http_code}' http://192.168.10.5:3187/login         # → 403
curl -s -o /dev/null -w '%{http_code}' http://192.168.10.5:3187/api/session   # → 403

# Spoof attempts MUST return 403
curl -s -H 'X-Forwarded-Proto: https' -o /dev/null -w '%{http_code}' http://192.168.10.5:3187/login  # → 403

# HTTPS admin (no token) → 401
curl -sk -o /dev/null -w '%{http_code}' https://192.168.10.5:3443/admin/keys  # → 401

# HTTPS admin (with token) → 200
curl -sk -H "X-Mission-Control-Key: <runtime-secret>" https://192.168.10.5:3443/admin/keys  # → 200
```

`npm run test:e2e` starts `missionControlProxy.js` in required-token mode and verifies desktop/mobile browser behavior through the Node proxy.

## Deployment

**Production:** Docker container on Unraid Tower (192.168.10.5). Container name: `sora-missioncontrol-proxy`. Ports: 3443 (HTTPS), 3187 (HTTP, locked). Runtime secrets in `/mnt/user/appdata/sora-missioncontrol/runtime/proxy.env` (mode 0600). See `deploy/OPERATOR-RUNBOOK.md` for the full deployment procedure.

**Staging (baset-ai):** systemd user service at `192.168.0.85:3187`. Used for development and testing before Unraid deployment.

### Container operations (Unraid Tower)

```bash
# Status
ssh root@192.168.10.5 'docker ps --filter name=sora-missioncontrol-proxy'

# Logs
ssh root@192.168.10.5 'docker logs --tail 50 -f sora-missioncontrol-proxy'

# Restart
ssh root@192.168.10.5 'docker restart sora-missioncontrol-proxy'

# Rebuild from v2 directory
ssh root@192.168.10.5 'cd /mnt/user/appdata/sora-missioncontrol/v2 && \
  source ../runtime/proxy.env && \
  MISSION_CONTROL_ADMIN_PROXY_KEY="$MISSION_CONTROL_ADMIN_PROXY_KEY" \
  HERMES_DASHBOARD_URL=http://192.168.0.85:9119 \
  HERMES_DASHBOARD_PROXY_TARGET=http://192.168.0.85:9119 \
  docker compose up -d --build'
```

### Rollback (Unraid)

```bash
ssh root@192.168.10.5 'cd /mnt/user/appdata/sora-missioncontrol/v2 && docker compose down'
# Then start previous version from v1 backup or pre-built image — see OPERATOR-RUNBOOK.md
```

## Operations

Full operator runbook: `deploy/OPERATOR-RUNBOOK.md`. Covers Unraid production deployment, baset-ai staging deployment, NGINX reverse proxy options, SSH bridge setup, security model, health checks, and rollback procedures.

The runtime secret file must never be printed, committed, or included in documentation. Use `<runtime-secret>` or equivalent placeholders in all docs. The active admin proxy token was rotated 2026-06-29.
