# Sora Phase 6 — Safe Admin Proxy Adapter Report

Date: 2026-06-21
Project: Sora-MissionControl
Workdir: `/home/wliob/projects/Active/Sora-MissionControl`

## Scope completed

Implemented the first live Phase 6 admin adapter path as a local, explicit, safety-bounded proxy.

Completed:
1. Added `missionControlProxy.js`, an Express sidecar that exposes allowlisted admin REST endpoints backed by Hermes CLI commands.
2. Added `src/services/hermes/adminProxyAdapter.ts`, a browser adapter implementing both `KeyMcpAdminAdapter` and `CwsAdminAdapter`.
3. Bound the adapter during app backbone startup in `src/state/backbone.ts`; Key/MCP and CWS stores now load live data when the sidecar is reachable.
4. Added `npm run proxy` for local operator startup.
5. Kept the prior store/UI safety model intact: confirmation gates stay in stores/panels, raw secrets are not persisted, list views stay masked/truncated, missing proxy failures surface through existing `lastError` paths.

## Proxy endpoints

Read endpoints:

| Endpoint | Backend command | Store target |
|---|---|---|
| `GET /health` | in-process health | proxy health check |
| `GET /admin/keys` | `hermes auth list` | `KeyMcpAdminState.keys` |
| `GET /admin/mcp` | `hermes mcp list` | `KeyMcpAdminState.mcpEntries` |
| `GET /admin/cron` | `hermes cron list` | `CwsAdminState.cronJobs` |
| `GET /admin/webhooks` | `hermes webhook list` | `CwsAdminState.webhooks` |
| `GET /admin/skills` | `hermes skills list` | `CwsAdminState.skills` |

Mutation endpoints:

| Endpoint | Supported safe subset |
|---|---|
| `POST /admin/keymcp/actions` | `mcp.test`, `mcp.remove`, `mcp.create`, `key.delete`, `key.revoke` |
| `POST /admin/cws/actions` | `cron.pause`, `cron.resume`, `cron.run`, `cron.remove`, `cron.create`, `webhook.remove`, `webhook.create` |

Unsupported actions return `501` instead of silently pretending to work. Model admin, key create/regenerate/update, MCP update, cron update, webhook update, and skill enable/disable still need verified backend support before Phase 6 can be marked fully complete.

## Safety notes

- Proxy execution is allowlisted by action kind; there is no generic shell/CLI passthrough.
- Commands use `execFile`, not shell interpolation.
- Optional `MISSION_CONTROL_ADMIN_PROXY_KEY` gates all proxy routes with `X-Mission-Control-Key`.
- Optional `MISSION_CONTROL_CORS_ORIGIN` can restrict browser origins.
- Browser default proxy URL uses same host on port `3187`, avoiding hardcoded `127.0.0.1` when accessed over LAN.
- Read payloads were scanned for common raw-secret patterns after live proxy calls.
- Create responses may carry one-time raw values already modeled by the stores; stores strip raw fields before persistent state.

## Verification

Commands run:

```bash
node --check missionControlProxy.js
npm run lint
npm test -- --run
npm run build
npm run proxy
curl -sS http://127.0.0.1:3187/health
curl -sS http://127.0.0.1:3187/admin/keys
curl -sS http://127.0.0.1:3187/admin/mcp
curl -sS http://127.0.0.1:3187/admin/cron
curl -sS http://127.0.0.1:3187/admin/webhooks
curl -sS http://127.0.0.1:3187/admin/skills
```

Results:
- `node --check missionControlProxy.js`: passed.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test -- --run`: passed — `28` test files, `584` tests.
- `npm run build`: passed (`tsc -b && vite build`); existing Vite large-chunk warning remains.
- Live proxy health: `{"ok":true,"service":"sora-mission-control-admin-proxy"}`.
- Live read counts at verification time: keys `10`, MCP entries `5`, cron jobs `11`, webhooks `4`, skills `153`.
- Secret-pattern scan over live read JSON: passed for keys/MCP/cron/webhooks/skills.

## Remaining follow-up

1. Production deployment hardening: run sidecar behind a scoped token, restricted CORS, LAN/firewall policy, and process supervision.
2. Fill unsupported admin actions only after Hermes exposes a verified API/CLI path with safe semantics.
3. Bind model admin to a verified adapter.
4. Add browser/integration proof after final deploy target is fixed.
5. Consider code-splitting later to address the existing Vite large-chunk warning.
