# Biscuit Phase 6b — Admin Adapter Completion Report

Date: 2026-06-22
Project: Sora-MissionControl
Workdir: `/home/wliob/projects/Active/Sora-MissionControl`

## Scope

Audit the existing Phase 6 local admin sidecar/proxy path against verified Hermes CLI semantics, keep only the safe subset live, harden the sidecar defaults/behavior, add direct regression tests, and document what remains intentionally unsupported.

## What changed

1. Hardened `missionControlProxy.js` into an audited allowlist instead of a broad best-effort bridge.
2. Added direct proxy regression coverage in `src/services/hermes/missionControlProxy.test.ts`.
3. Updated `src/state/cwsAdminStore.ts` so successful cron/webhook actions reload authoritative backend lists instead of persisting provisional create rows.
4. Updated existing CWS store/UI tests to match the authoritative-reload behavior.
5. Updated `OVERVIEW.md` and `AGENTS.md` to reflect the audited safe subset and remaining gaps.

## Verified supported read surfaces

The local sidecar still supports these read endpoints:
- `GET /health`
- `GET /admin/keys` via `hermes auth list`
- `GET /admin/mcp` via `hermes mcp list`
- `GET /admin/cron` via `hermes cron list`
- `GET /admin/webhooks` via `hermes webhook list`
- `GET /admin/skills` via `hermes skills list --source all`

Additional truth enforced in this pass:
- If Hermes reports that the webhook platform is not enabled, `/admin/webhooks` now returns an unavailable error instead of a fake healthy empty list.

## Verified supported mutation subset

These actions remain live because the inspected Hermes CLI semantics match the Mission Control contract closely enough:

Key/MCP:
- `key.delete` → `hermes auth remove <provider> <index>`
- `mcp.test` → `hermes mcp test <name>`
- `mcp.remove` → `hermes mcp remove <name>`
- `mcp.create` only when:
  - transport/URL map directly to CLI flags, and
  - no token is supplied, and
  - no note is supplied

CWS:
- `cron.pause`
- `cron.resume`
- `cron.run`
- `cron.remove`
- `cron.create` only when:
  - the request fits the verified CLI flags, and
  - no `modelOverride` is supplied
- `webhook.remove`

## Intentionally unsupported after audit

These now stay explicitly unsupported because the current Hermes CLI behavior does not safely match the Mission Control contract:
- model admin binding
- `key.create`
- `key.update`
- `key.revoke`
- `key.regenerate`
- `mcp.update`
- `mcp.create` with token
- `mcp.create` with note
- `cron.update`
- `cron.create` with `modelOverride`
- `webhook.create`
- `webhook.update`
- `skill.enable`
- `skill.disable`

Behavior for these paths is now honest:
- the proxy returns `501`
- Mission Control surfaces backend absence/failure instead of fabricating success

## Sidecar hardening in this pass

1. Default CORS behavior is no longer blind `*`.
   - If `MISSION_CONTROL_CORS_ORIGIN` is unset, the sidecar allows only same-host or loopback origins by default.
   - If `MISSION_CONTROL_CORS_ORIGIN` is set, it acts as an explicit allowlist.
   - `*` is still supported only when explicitly configured.
2. The sidecar now exports testable helper functions without auto-starting during import.
3. Cron/webhook create flows now refresh authoritative lists after mutation rather than trusting provisional locally synthesized rows.
4. The optional `MISSION_CONTROL_ADMIN_PROXY_KEY` gate remains in place for all routes.
5. `MISSION_CONTROL_PROXY_HOST` and `MISSION_CONTROL_PROXY_PORT` remain configurable; current default host is still `0.0.0.0` because the dashboard is intended for LAN access from other devices.

## Files changed

- `/home/wliob/projects/Active/Sora-MissionControl/missionControlProxy.js`
- `/home/wliob/projects/Active/Sora-MissionControl/src/services/hermes/missionControlProxy.test.ts`
- `/home/wliob/projects/Active/Sora-MissionControl/src/types/missionControlProxy-test.d.ts`
- `/home/wliob/projects/Active/Sora-MissionControl/src/state/cwsAdminStore.ts`
- `/home/wliob/projects/Active/Sora-MissionControl/src/state/cwsAdminStore.test.ts`
- `/home/wliob/projects/Active/Sora-MissionControl/src/components/admin/CwsPanels.test.ts`
- `/home/wliob/projects/Active/Sora-MissionControl/OVERVIEW.md`
- `/home/wliob/projects/Active/Sora-MissionControl/AGENTS.md`

## Verification run

Commands executed:

```bash
node --check missionControlProxy.js
npm test -- --run src/services/hermes/missionControlProxy.test.ts src/state/cwsAdminStore.test.ts src/components/admin/CwsPanels.test.ts
npm run lint
npm test -- --run
npm run build
```

Observed results:
- `node --check missionControlProxy.js` ✅
- targeted proxy/CWS tests ✅ (`107` passing across `3` files)
- `npm run lint` ✅ (`tsc --noEmit` clean)
- `npm test -- --run` ✅ (`612` passing across `33` files)
- `npm run build` ✅ (Vite build completed; existing large-chunk warning remains)

## Remaining Phase 6 blockers

1. `src/modules/admin/adminStore.ts` still needs a verified model-admin adapter path.
2. Unsupported actions above should remain unavailable until Hermes exposes contract-safe semantics.
3. Production deployment still needs operator-level hardening:
   - scoped proxy token
   - explicit `MISSION_CONTROL_CORS_ORIGIN` allowlist when cross-origin browser access is required
   - LAN/firewall policy
   - process supervision

## Bottom line

Phase 6 now has a real local adapter path for keys/MCP/cron/webhooks/skills, but only for the audited safe subset. This pass deliberately reduced scope where the existing proxy was over-claiming support, so the dashboard is more honest and safer even though several admin mutations remain intentionally unavailable.
