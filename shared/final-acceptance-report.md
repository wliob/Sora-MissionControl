# Final Acceptance Report

## Reset07 Sora addendum — 2026-06-22

This report contains earlier deployment proof, but Sora's fresh reset07 final check could **not** restamp deployed acceptance: `127.0.0.1:3187` and `192.168.0.85:3187` were not listening from this host, and `ssh wliob@192.168.0.85` failed with `Permission denied (publickey,password)`. Treat the deployed-target sections below as historical proof until target access/service is restored and reverified. Current status: local code/test/build is green; full deployed final acceptance is blocked. See `shared/sora-reset07-final-acceptance-status.md` and `shared/cloud-reset07-target-recovery-proof.md`.

Date: 2026-06-22  
Project: Sora-MissionControl  
Workdir: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`

## Scope Verified

- Same-origin Node proxy deployment path (`missionControlProxy.js`) serving built `dist/` assets and `/admin/*`.
- Required-token admin proxy mode with unauthenticated `401` behavior and session-only browser token staging.
- Desktop/mobile browser proof through Playwright.
- Static nginx-only Docker path replaced with Node proxy container path.
- Unsupported admin/Kanban actions remain unavailable or disabled unless already covered by verified adapter paths.

## URLs

- Playwright/local app/proxy while `npm run test:e2e` is running: `http://127.0.0.1:3187`
- Previous current-host LAN app/proxy while a local smoke proxy was running: `http://192.168.10.18:3187`
- Hermes/Unraid app/proxy target: `http://192.168.0.85:3187`
- Target-local Hermes/Unraid app/proxy over SSH: `http://127.0.0.1:3187`
- Hermes Dashboard/Kanban source: `http://192.168.0.85:9119/kanban`
- Health route: `/health`
- Admin proxy routes: `/admin/*` with `X-Mission-Control-Key` when `MISSION_CONTROL_PROXY_AUTH_MODE=required`

## Verification Commands

```text
npm run lint
```

Observed output:

```text
> sora-missioncontrol@0.1.0 lint
> tsc --noEmit
```

Exit code: `0`

```text
npm test -- --run
```

Observed output:

```text
Test Files  40 passed (40)
Tests       642 passed (642)
```

Exit code: `0`

```text
npm run build
```

Observed output:

```text
✓ 837 modules transformed.
✓ built in 8.33s
```

Exit code: `0`

Known build note: Vite still reports the existing large chunk warning for `dist/assets/index-*.js` above 500 kB after minification.

```text
npm run test:e2e
```

Observed output:

```text
2 passed
2 skipped
```

Exit code: `0`

The skipped cases are intentional project splits: the desktop proof runs only in the desktop project and the mobile overflow proof runs only in the mobile project.

Deployed target browser proof:

```text
PLAYWRIGHT_BASE_URL=http://192.168.0.85:3187 PLAYWRIGHT_SKIP_WEBSERVER=1 MISSION_CONTROL_ADMIN_PROXY_KEY=<runtime-secret> npm run test:e2e
```

Observed output:

```text
2 passed
2 skipped
```

Exit code: `0`

## Browser Proof Artifacts

- `shared/e2e-chromium-desktop-systems-proof.png`
- `shared/e2e-chromium-mobile-mobile-proof.png`

The Playwright suite verifies:

- app loads through `missionControlProxy.js`;
- `/health` is public;
- `/admin/keys` returns `401` without `X-Mission-Control-Key`;
- `/admin/keys` no longer returns `401` when a runtime token header is supplied;
- Office panel mounts;
- Chat demo fallback is labeled `DEMO MODE`;
- admin required-token affordance is visible;
- operator token staging clears the password input and remains session-only;
- Project Control route renders through the shell;
- 375px mobile layout has no horizontal page overflow.

## Smoke Tests

Temporary smoke command used a placeholder token, not a production secret:

```text
MISSION_CONTROL_PROXY_HOST=0.0.0.0 \
MISSION_CONTROL_PROXY_PORT=3187 \
MISSION_CONTROL_PROXY_AUTH_MODE=required \
MISSION_CONTROL_ADMIN_PROXY_KEY=<placeholder> \
node missionControlProxy.js
```

Development-host local health from the earlier temporary smoke proxy:

```text
curl -fsS http://127.0.0.1:3187/health
{"ok":true,"service":"sora-mission-control-admin-proxy"}
```

Development-host LAN health from the earlier temporary smoke proxy:

```text
curl -fsS http://192.168.10.18:3187/health
{"ok":true,"service":"sora-mission-control-admin-proxy"}
```

Unauthenticated admin route:

```text
curl -s -o /tmp/sora-admin-status.txt -w '%{http_code}' http://127.0.0.1:3187/admin/keys
401
```

Hermes/Unraid target health before operator firewall follow-through:

```text
curl --max-time 5 -fsS http://192.168.0.85:3187/health
curl: (28) Connection timed out after 5002 milliseconds
LAN_HEALTH_FAILED_28
```

Hermes/Unraid target health after operator firewall follow-through:

```text
curl --max-time 8 -fsS http://192.168.0.85:3187/health
{"ok":true,"service":"sora-mission-control-admin-proxy"}
```

Hermes Kanban source:

```text
curl --max-time 5 -fsS http://192.168.0.85:9119/kanban
KANBAN_085_OK
```

Host address evidence:

```text
hostname -I
192.168.10.18 172.17.0.1 172.18.0.1 172.19.0.1 ...
```

Target-host SSH deployment attempt:

```text
ssh -o BatchMode=yes -o ConnectTimeout=5 wliob@192.168.0.85 'hostname'
baset-ai
wliob
/home/wliob

ssh -o BatchMode=yes -o ConnectTimeout=5 root@192.168.0.85 'hostname'
root@192.168.0.85: Permission denied (publickey,password).
```

Target-host service correction after `wliob` access was granted:

```text
systemctl --user status sora-missioncontrol-proxy.service
Active: active (running)
Main PID: 2788998 (node)

systemctl --user is-active sora-missioncontrol-proxy.service
active

systemctl --user is-enabled sora-missioncontrol-proxy.service
enabled

ss -ltnp | grep ':3187'
LISTEN ... 0.0.0.0:3187 ... users:(("node",pid=2788998,...))
```

The target service now uses:

- user service: `/home/wliob/.config/systemd/user/sora-missioncontrol-proxy.service`;
- runtime secret env file: `/home/wliob/.config/sora-missioncontrol/proxy.env`;
- `MISSION_CONTROL_PROXY_AUTH_MODE=required`;
- explicit Hermes PATH in the service environment so CLI-backed admin reads keep working.

Latest target-local smoke after service correction:

```text
ssh wliob@192.168.0.85 'curl -fsS http://127.0.0.1:3187/health'
{"ok":true,"service":"sora-mission-control-admin-proxy"}

ssh wliob@192.168.0.85 'curl -fsS http://192.168.0.85:3187/health'
{"ok":true,"service":"sora-mission-control-admin-proxy"}

ssh wliob@192.168.0.85 'curl -s -o /tmp/smc-admin-unauth.txt -w "%{http_code}" http://127.0.0.1:3187/admin/keys'
401

ssh wliob@192.168.0.85 'curl -s -o /tmp/smc-admin-auth.txt -w "%{http_code}" -H "X-Mission-Control-Key: <runtime-secret>" http://127.0.0.1:3187/admin/keys'
200

systemctl --user is-active sora-missioncontrol-proxy.service
active

systemctl --user is-enabled sora-missioncontrol-proxy.service
enabled
```

## Deployment Artifacts

- Service/container name: `sora-missioncontrol-proxy`
- Systemd template: `deploy/sora-missioncontrol-proxy.service`
- Container deployment: `Dockerfile` + `docker-compose.yml`
- Operator runbook: `deploy/OPERATOR-RUNBOOK.md`
- Release bundle script: `deploy/create-release-bundle.sh`
- Runtime secret source: `/etc/sora-missioncontrol/proxy.env`, Docker/Unraid runtime environment, or equivalent secret manager.
- Real admin proxy tokens must not be stored in source, docs, built assets, `.env.proxy`, screenshots, or reports.

Latest release bundle verification:

```text
bash -n deploy/create-release-bundle.sh
deploy/create-release-bundle.sh
```

Observed result:

```text
npm run build completed successfully with the existing large-chunk warning.
/home/wliob/Projects/Active/Sora-MissionControl/shared/releases/sora-missioncontrol-20260622T215753Z.tar.gz
```

Tarball spot-check confirmed these files are present:

```text
package-lock.json
missionControlProxy.js
src/main.tsx
Dockerfile
docker-compose.yml
deploy/sora-missioncontrol-proxy.service
deploy/OPERATOR-RUNBOOK.md
dist/index.html
```

Start/restart examples:

```text
sudo systemctl enable --now sora-missioncontrol-proxy.service
sudo systemctl restart sora-missioncontrol-proxy.service
MISSION_CONTROL_ADMIN_PROXY_KEY=<runtime-secret> docker compose up -d --build
docker compose restart sora-missioncontrol-proxy
```

Rollback example:

```text
sudo systemctl stop sora-missioncontrol-proxy.service
sudo rsync -a --delete /opt/sora-missioncontrol/releases/<previous-release>/ /home/wliob/Projects/Active/Sora-MissionControl/
sudo systemctl start sora-missioncontrol-proxy.service
```

## Known Limitations

- `sora-missioncontrol-proxy` is active/enabled as a `wliob` user service on `192.168.0.85`; target-local health, LAN health, required-token admin behavior, and deployed Playwright proof are verified.
- Operator firewall follow-through opened inbound TCP `3187`; `http://192.168.0.85:3187/health` now returns JSON ok from this development host.
- Hermes Kanban at `http://192.168.0.85:9119/kanban` is reachable from this host.
- Model-admin backend binding remains unavailable because no verified noninteractive Hermes model-list/capability endpoint is available.
- Unsupported admin mutations remain unavailable/`501` until Hermes exposes contract-safe semantics.
- Provider quota/rate-limit remains unknown until a verified live source exists.
- The Vite large-chunk warning remains accepted for this pass; it is not a build failure.
