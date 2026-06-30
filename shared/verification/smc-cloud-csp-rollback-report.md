# SMC Cloud CSP Rollback Report

Date (UTC): 2026-06-30
Task: `t_20872ee6` — Emergency containment for Sora Mission Control live CSP regression
Worker: Cloud
Workdir: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`

## Verdict: PASS

The live production `Content-Security-Policy` has been rolled back to the security-approved configuration with **NO `'unsafe-eval'`** in `script-src`. All route verification criteria pass.

## Root Cause

1. **Previous Cloud card `t_e602b14f`** (2026-06-30) added `'unsafe-eval'` to the CSP to fix PixiJS/Office canvas rendering. This was accepted as "done" at the time but **AppSec explicitly rejected production `'unsafe-eval'`**.

2. **Biscuit repair** (also 2026-06-30) updated `missionControlProxy.js` in the repo to remove `'unsafe-eval'` (line 770), passed lint/test/build gates, but **never synced the file to Tower or rebuilt the Docker image**.

3. The live Docker container image (SHA `96faa9f4a47c`, built 2026-06-25) continued serving the old CSP with `'unsafe-eval'`.

## CSP Before/After

### Before (live production, stale):
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'
```

### After (deployed, AppSec-approved):
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'
```

**Change:** Removed `'unsafe-eval'` from `script-src` directive.

## Deployment Commands

```bash
# 1. Build from repo (development host, baset-ai)
cd /home/wliob/llm-brain/Projects/Active/Sora-MissionControl
pnpm run build

# 2. Sync missionControlProxy.js to Tower v2 build context
ssh root@192.168.10.5 'cat > /mnt/user/appdata/sora-missioncontrol/v2/missionControlProxy.js' < missionControlProxy.js

# 3. Sync dist/ to Tower v2 build context
tar cz dist/ | ssh root@192.168.10.5 'tar xz -C /mnt/user/appdata/sora-missioncontrol/v2/'

# 4. Rebuild Docker image on Tower
ssh root@192.168.10.5 'cd /mnt/user/appdata/sora-missioncontrol/v2 && docker compose build --no-cache'

# 5. Restart container with new image
ssh root@192.168.10.5 'cd /mnt/user/appdata/sora-missioncontrol/v2 && docker compose up -d --force-recreate'
```

## Verification Results

All tests run from Tower via `ssh root@192.168.10.5`:

| Route | Transport | Expected | Actual | Status |
|---|---|---|---|---|
| `/health` | HTTPS 3443 | 200 OK | `{"ok":true,...}` | PASS |
| `/health` | HTTP 3187 | 200 OK | `{"ok":true,...}` | PASS |
| `/` (SPA) | HTTPS 3443 | 200 | 200 | PASS |
| `/kanban` (SPA) | HTTPS 3443 | 200 | 200 | PASS |
| `/admin/keys` | HTTPS 3443 (no token) | 401 | 401 | PASS |
| `/login` | HTTP 3187 | 403 | 403 | PASS |
| `/admin/keys` | HTTP 3187 | 403 | 403 | PASS |
| `/api/session` | HTTP 3187 | 403 | 403 | PASS |
| `/api/plugins/kanban/board` | HTTP 3187 | 403 | 403 | PASS |
| CSP `unsafe-eval` present | HTTPS 3443 | NO | NO | PASS |
| CSP `unsafe-eval` present | HTTP 3187 | NO | NO | PASS |

### Exact verification commands (no secrets):

```bash
# CSP check (both lanes)
ssh root@192.168.10.5 'curl -sk -I https://127.0.0.1:3443/ | grep -i content-security-policy'
ssh root@192.168.10.5 'curl -s -I http://127.0.0.1:3187/ | grep -i content-security-policy'

# Health checks
ssh root@192.168.10.5 'curl -sk https://127.0.0.1:3443/health'
ssh root@192.168.10.5 'curl -s http://127.0.0.1:3187/health'

# SPA routes (HTTPS)
ssh root@192.168.10.5 'curl -sk -o /dev/null -w "%{http_code}" https://127.0.0.1:3443/'
ssh root@192.168.10.5 'curl -sk -o /dev/null -w "%{http_code}" https://127.0.0.1:3443/kanban'

# Admin auth gate (HTTPS, no token)
ssh root@192.168.10.5 'curl -sk -o /dev/null -w "%{http_code}" https://127.0.0.1:3443/admin/keys'

# Sensitive routes (HTTP, must 403)
ssh root@192.168.10.5 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3187/login'
ssh root@192.168.10.5 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3187/admin/keys'
ssh root@192.168.10.5 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3187/api/session'
ssh root@192.168.10.5 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3187/api/plugins/kanban/board'
```

## Container State Post-Deploy

- Container: `sora-missioncontrol-proxy`, Up and healthy
- Image: `v2-sora-missioncontrol-proxy` (new build SHA `1a51425331a5`)
- Ports: 3443 HTTPS, 3187 HTTP
- Env: `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT=true`, `MISSION_CONTROL_PROXY_AUTH_MODE=required`

## Remaining Blocker

Per the Kanban card: **PixiJS/Office canvas may now fail to render** without `'unsafe-eval'`. PixiJS v8 WebGL renderer requires `unsafe-eval` for `new Function()`-based shader compilation. This is recorded as **Biscuit/AppSec follow-up** — the CSP must not be weakened. Possible resolutions:

1. Use `pixi.js/unsafe-eval` module (PixiJS provides this for CSP-restricted environments)
2. Pre-compile shaders at build time
3. Switch to Canvas2D fallback renderer

This report does NOT attempt any of these. Cloud scope is deploy/runtime rollback + CSP verification only.
