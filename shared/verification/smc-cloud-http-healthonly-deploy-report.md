# SMC HTTP Health-Only Deploy Report — Cloud

> **Date:** 2026-06-30
> **Kanban Card:** t_f0f3a522
> **Parent Cards:** AppSec conditional t_d063acbf, Biscuit hardening t_437da1df
> **Deployer:** Cloud (Systems & Infrastructure Lead)

## Summary

Deployed verified SMC HTTP health-only hardening from local development to production Tower (Unraid 192.168.10.5). The hardened `missionControlProxy.js` (with `MISSION_CONTROL_REQUIRE_SECURE_TRANSPORT=true` enforcement) is now live in the `sora-missioncontrol-proxy` Docker container.

**Result: ALL 9 acceptance gates PASS.**

## Files Synced to Tower

| Local File | Tower Path |
|---|---|
| `missionControlProxy.js` | `/mnt/user/appdata/sora-missioncontrol/v2/missionControlProxy.js` |
| `src/services/hermes/missionControlProxy.test.ts` | `/mnt/user/appdata/sora-missioncontrol/v2/src/services/hermes/missionControlProxy.test.ts` |
| `dist/` (full) | `/mnt/user/appdata/sora-missioncontrol/runtime/dist/` (live bind mount) |
| `dist/` (full) | `/mnt/user/appdata/sora-missioncontrol/v2/dist/` (source-of-truth) |

Stale chunks removed from v2/dist: `index-BeYnVHoz.js`, `browserAll-Deoo-T0y.js`, `WebGPURenderer-ChZgtTXk.js`, `WebGLRenderer-Gfb1s0-9.js`, `RenderTargetSystem-__X4AlJS.js`, `Filter-DS2gVH0V.js`, `CanvasRenderer-B3CY_eDq.js`, `BufferResource-Ceqx0pTY.js`, `BitmapFont-J2KZ-LP0.js`, `webworkerAll-CbiB0Y7V.js`.

## Container Rebuild

- Image: `v2-sora-missioncontrol-proxy` rebuilt from `/mnt/user/appdata/sora-missioncontrol/v2/Dockerfile`
- Multi-stage build used: Builder (npm ci, npm run build, npm prune) → Runtime (alpine + hardened missionControlProxy.js)
- Dist is bind-mounted from `../runtime/dist` (survives container rebuild)
- Recreated via `docker compose up -d --force-recreate sora-missioncontrol-proxy`
- Container name: `sora-missioncontrol-proxy`

## Pre-Deploy Local Verification (from Biscuit)

- `pnpm run test` → 49 files / 761 tests PASS
- `pnpm run lint` → PASS
- `pnpm run build` → PASS, asset `index-k2GobxlW.js` (md5: `243eb4c33b3a269587dc9afb836420a5`)

## Live Acceptance Gates (Tower 192.168.10.5)

### HTTPS (port 3443)

| # | Check | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | `GET /health` | 200 | 200 `{"ok":true,"service":"sora-mission-control-admin-proxy"}` | ✅ PASS |
| 2 | `GET /office` | 200 + serves `index-k2GobxlW.js` | 200, serves `index-k2GobxlW.js` | ✅ PASS |
| 3 | CSP `unsafe-eval` | absent | CSP: `script-src 'self' 'unsafe-inline'` — no `unsafe-eval` | ✅ PASS |
| 8 | `GET /admin/keys` (no token) | 401 | 401 | ✅ PASS |

### HTTP (port 3187)

| # | Check | Expected | Actual | Status |
|---|---|---|---|---|
| 4 | `GET /health` | 200 | 200 `{"ok":true,"service":"sora-mission-control-admin-proxy"}` | ✅ PASS |
| 5 | `GET /api/keys` | 403 | 403 | ✅ PASS |
| 6 | `GET /config` | 403 | 403 | ✅ PASS |
| 7 | `GET /cron` | 403 | 403 | ✅ PASS |
| 9 | `GET /admin/keys` | 403 | 403 | ✅ PASS |

## CSP (Full)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; 
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; 
connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443 http://127.0.0.1:3187 https://127.0.0.1:3443; 
font-src 'self' data:; frame-ancestors 'none'; form-action 'self'
```

- ✅ No `unsafe-eval` in script-src
- ✅ `frame-ancestors 'none'` — prevents clickjacking
- ✅ `form-action 'self'` — prevents form exfiltration

## Architecture Notes

- **Runtime dist survives rebuilds** — bind-mounted at `/mnt/user/appdata/sora-missioncontrol/runtime/dist:/app/dist:ro`
- **missionControlProxy.js baked into image** — requires image rebuild on change
- **TLS self-signed** — served from `/mnt/user/appdata/sora-missioncontrol/runtime/tls/`
- **Hermes bridge SSH** — key at `/var/run/secrets/hermes_tunnel`, restricted to `wliob@192.168.0.85`
- **Container security**: `no-new-privileges:true`, all capabilities dropped, read-only root filesystem, non-root `missioncontrol` user (UID 1001)

## Rollback

To revert to previous image:
```bash
cd /mnt/user/appdata/sora-missioncontrol/v2
docker tag v2-sora-missioncontrol-proxy v2-sora-missioncontrol-proxy-pre-http-healthonly
# Rebuild from prior source, or restore from backup image
docker compose up -d --force-recreate
```
