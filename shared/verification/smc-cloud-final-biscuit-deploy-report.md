# SMC Cloud Final Biscuit Deploy Report

**Date:** 2026-06-30  
**Deploy Lead:** Cloud (Systems & Infrastructure)  
**Kanban Card:** t_91c5a917  
**Trigger:** User-approved deploy of Biscuit's live integration repair build

## Deployment Summary

| Step | Operation | Result |
|------|-----------|--------|
| 1 | Verify local dist/ has index-BeYnVHoz.js | PASS — confirmed |
| 2 | rsync dist/ → Tower v2/dist/ (--delete) | PASS — stale assets removed |
| 3 | rsync missionControlProxy.js → Tower v2/ | PASS |
| 4 | rsync full source → Tower v2/ (excl. node_modules, .git) | PASS — fresh source synced |
| 5 | Docker build --no-cache on Tower | PASS — produced index-BeYnVHoz.js |
| 6 | Docker compose up -d --force-recreate | PASS — container restarted |

## Live Verification Gates

| Gate | Expected | Actual | Status |
|------|----------|--------|--------|
| HTTPS /health | 200 | 200 | PASS |
| HTTP /health | 200 | 200 | PASS |
| HTTP /admin/keys | 403 | 403 | PASS |
| HTTPS /admin/keys (no token) | 401 | 401 | PASS |
| CSP: no unsafe-eval | absent | absent | PASS |
| Asset hash in HTML | index-BeYnVHoz.js | index-BeYnVHoz.js | PASS |
| Container running | Up | Up 41s | PASS |

## CSP (Live)

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:3187 wss://127.0.0.1:3443
http://127.0.0.1:3187 https://127.0.0.1:3443; font-src 'self' data:;
frame-ancestors 'none'; form-action 'self'
```

**No `unsafe-eval` present.**

## Deployed Artifact

- **Canonical URL:** https://192.168.10.5:3443
- **HTTP fallback (health only):** http://192.168.10.5:3187/health
- **Container:** sora-missioncontrol-proxy (image: v2-sora-missioncontrol-proxy)
- **Asset:** /assets/index-BeYnVHoz.js (was: index-Cl9liJlb.js)

## Files Changed

- `/mnt/user/appdata/sora-missioncontrol/v2/dist/**` — full dist refresh
- `/mnt/user/appdata/sora-missioncontrol/v2/missionControlProxy.js` — proxy updated
- `/mnt/user/appdata/sora-missioncontrol/v2/src/**` — source synced
- Docker image rebuilt and container recreated

## No secrets were exposed. CSP was not weakened.
