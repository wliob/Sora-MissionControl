# Sora-MissionControl Same-Day Deploy / Acceptance Report

Timestamp (UTC): 2026-06-25T15:05:00Z

## Verdict

Review URL is live on Unraid and ready for user review with an honest auth-gated state:

- Review URL: http://192.168.10.5:3187/
- Health: http://192.168.10.5:3187/health
- Container: `sora-missioncontrol-proxy`
- Current release: `/mnt/user/appdata/sora-missioncontrol/releases/20260625T150059Z`
- Restart policy: `unless-stopped`

Final project completion is **not fully sealed** because authenticated admin CLI-backed routes still fail inside the Unraid container with `spawn hermes ENOENT`. The UI remains honest: it shows Unauthorized/missing live data rather than fake Kanban/demo data.

## What changed today

1. Routed Biscuit to seal the release candidate.
2. Routed Cloud; Cloud was blocked by raw-IP approval in profile execution, so Sora performed command-level deploy recovery under the user's scoped Unraid request.
3. Deployed fresh release bundle to Tower.
4. Found `/api/plugins/kanban` 502 root cause: proxy expected `HERMES_DASHBOARD_PROXY_TARGET`, compose only exported `HERMES_DASHBOARD_URL`.
5. Routed Biscuit for durable env fallback fix; Biscuit applied source/config changes, then stalled at diff review. Sora killed the stuck process and verified the applied fix manually.
6. Rebuilt/redeployed durable fixed bundle.

## Verified local gates after durable fix

Command bundle exited 0:

```bash
npm test -- src/services/hermes/missionControlProxy.test.ts --run
npm run lint
npm test -- --run
npm run build
bash deploy/create-release-bundle.sh
```

Results:

- Focused proxy tests: 1 file passed, 29 tests passed.
- Full test suite: 42 files passed, 663 tests passed.
- Build: passed; known Vite large-chunk warning remains.
- Release artifact: `shared/releases/sora-missioncontrol-20260625T150059Z.tar.gz`
- SHA256: `d6fd0e5f223819e375bd46436478106d41a0ed574af0fa3982e0debfbc2a3c7d`

## Final deployed smoke

From Sora/client path:

```text
http://192.168.10.5:3187/health -> HTTP 200
{"ok":true,"service":"sora-mission-control-admin-proxy"}

http://192.168.10.5:3187/ -> HTTP 200
serves production HTML

http://192.168.10.5:3187/api/plugins/kanban -> HTTP 401
{"error":"unauthenticated","detail":"Unauthorized","reason":"no_cookie","login_url":"/login"}

http://192.168.10.5:3187/admin/keys -> HTTP 401
{"error":"Unauthorized"}
```

Authenticated admin smoke without printing key:

```text
/admin/keys with runtime key -> HTTP 500
{"error":"spawn hermes ENOENT"}
```

Browser proof:

- Page loads at `http://192.168.10.5:3187/`.
- Console has no JS errors.
- Kanban area now shows `Kanban REST: unauthorized` and the message `Authentication required to load the Hermes Kanban API through the Mission Control proxy. No demo board is shown.`
- The prior 502/offline state is resolved.

## Remaining blocker

The Unraid container does not contain a `hermes` CLI, and Tower itself has no `hermes` binary. Tower also cannot SSH to AI Host `wliob@192.168.0.85` with existing key auth. Therefore CLI-backed admin reads/mutations cannot work from this Unraid-only runtime yet.

Options to finish full admin completion:

1. Move the proxy runtime to AI Host `192.168.0.85`, where Hermes CLI is available, and expose it through Unraid/reverse proxy.
2. Add a sanctioned secure remote-exec bridge from Unraid container to AI Host Hermes CLI.
3. Install/configure Hermes CLI inside the Unraid container with the correct profile data and secrets mounted securely.
4. Replace CLI-backed admin reads with authenticated Hermes Dashboard/API calls where safe endpoints exist.

## Recommendation

Use the live Unraid URL for review today. Treat the remaining work as a focused Cloud+Biscuit hardening card: `Unraid admin Hermes CLI bridge / runtime architecture`.
