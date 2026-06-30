# SMC Cloud Office CSP Deploy Report

**Date:** 2026-06-30 14:43 UTC  
**Deployer:** Cloud (Hermes Agent, cloud profile)  
**Card:** t_b7d26ee0 — Office PixiJS CSP shim deploy  
**Verdict:** PASS

---

## What Changed

- **dist/** — new Vite build containing `index-k2GobxlW.js` with PixiJS v8 `pixi.js/unsafe-eval` shim at the GameRuntime boundary, enabling WebGL initialization under `no-unsafe-eval` CSP.
- **v2/docker-compose.yml** — pinned to existing image `v2-sora-missioncontrol-proxy` (was `build: .`); added reboot-survivable bind mount `../runtime/dist:/app/dist:ro`.
- **shared/verification/smc_live_browser_gate.mjs** — updated expected asset from `index-BeYnVHoz.js` to `index-k2GobxlW.js`.

## Deploy Path

| Step | Detail |
|------|--------|
| Source | `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/dist/` |
| Target | `192.168.10.5:/mnt/user/appdata/sora-missioncontrol/runtime/dist/` |
| Compose | `192.168.10.5:/mnt/user/appdata/sora-missioncontrol/v2/docker-compose.yml` |
| Container | `sora-missioncontrol-proxy` (image: v2-sora-missioncontrol-proxy) |
| Mount | `../runtime/dist:/app/dist:ro` (reboot-survivable) |

## Verification Results

### curl (from Tower)
- **Served asset:** `index-k2GobxlW.js`
- **Health:** `{"ok":true,"service":"sora-mission-control-admin-proxy"}`
- **CSP:** `script-src 'self' 'unsafe-inline'` — **NO unsafe-eval**
- **Bind mount:** `index-k2GobxlW.js` visible inside container at `/app/dist/assets/`

### Playwright Browser Gate (`shared/verification/smc_live_browser_gate.mjs`)
```
verdict: PASS
failed: []
base: https://192.168.10.5:3443
routes:
  /team     → 200, canvasCount 0
  /kanban   → 200, canvasCount 1
  /office   → 200, canvasCount 1  ← PixiJS WebGL renders under CSP!
scripts: [index-k2GobxlW.js]
badRequests: []
networkTo3187: []
fatalConsole: []
pageErrors: []
consoleCount: 33 (no unsafe-eval, no ERR_CERT, no Uncaught)
```

## Constraints Kept
- No unsafe-eval in CSP
- No unrelated host/service/firewall changes
- Only SMC proxy/container touched
- Bind mount is reboot-survivable (compose + host path)
- Read-only mount preserves container immutability
- Existing TLS (self-signed, :3443) and HTTP health (:3187) unchanged

## Rollback
```bash
ssh root@192.168.10.5
cd /mnt/user/appdata/sora-missioncontrol/v2
# Revert compose to build from source (remove image: + dist bind mount)
docker compose up -d
```
Or simply remove the `../runtime/dist:/app/dist:ro` volume line and revert `image:` back to `build: .`.

## Files Changed
- `/mnt/user/appdata/sora-missioncontrol/runtime/dist/` (all files) — new dist deployed
- `/mnt/user/appdata/sora-missioncontrol/v2/docker-compose.yml` — pinned image + dist bind mount
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/verification/smc_live_browser_gate.mjs` — asset name updated
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/verification/smc-live-browser-gate-csp-deploy/` — screenshots + summary.json
- `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl/shared/verification/smc-cloud-office-csp-deploy-report.md` — this report
