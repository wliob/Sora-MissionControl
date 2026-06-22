# Hermes Telemetry and Usage Sources (Phase 5)

This document contains the concrete adapter requirements for live ops usage signals and explicitly tracks which telemetry paths are verified vs. unknown.

## Source contract matrix (Phase 5)

| Source | Verification status | Input contract | Normalized output contract | Health assumptions |
|---|---|---|---|---|
| `hermes insights` | **Partially verified command surface** (CLI-level claim) | `hermes insights --days <N> --source <source>` | Usage totals (`input_tokens`, `output_tokens`, `total_tokens`, `tool_calls`, `cost_usd`) for a fixed period window; optional `period_days` / `window_start` / `window_end` | Historical-only source; cannot drive real-time quota/rate-limit state. |
| `GET /api/plugins/kanban/stats?days=<N>` | **Wire-verified** (implemented by `HermesDashboardClient.fetchUsage`) | `days` query parameter | Usage totals with optional `source_label`; payload can differ across deployments and is normalized by `pickUsagePayloadFromResponse` | Treated as `unverified` usage data with explicit provenance and freshness downgrade when values are missing. |
| Local logs / provider SDK traces | **Not yet identified** | TBD | TBD | Not yet safe; any use must show `unknown`. |

### Why Kanban stats is Phase 5 source

- It is available from the dashboard gateway in the current runtime and provides the practical historical usage signal we can consume today.
- All values from this route are treated as `unverified` with provenance so the UI cannot misrepresent confidence.
- The adapter must keep missing or malformed payloads as `unknown`/`stale`, never fabricate rows.

## Concrete adapter requirements for Phase 5 code

The usage adapter must satisfy these contracts before rendering values:

1. **Payload shape normalization**
   - `usage` payload MUST expose one of:
     - `usage.totals` map, or
     - top-level totals fields (`input_tokens`, `output_tokens`, `total_tokens`, `tool_calls`, `cost_usd`) optionally wrapped by a known container.
   - Window context MAY appear as:
     - `period_days`, or
     - `period.start` / `period.end`, or
     - `window_start` / `window_end`.
   - Unknown/missing metrics must be normalized to `null`, not `0`.

2. **Rate-limit/Quota contract handling**
   - `provider_quotas` (preferred) or `provider_limits` (compat alias) arrays MAY provide provider limiter snapshots.
   - Accepted per-entry fields:
     - `provider`, `remaining_requests`, `request_limit`, `remaining_tokens`, `token_limit`, `reset_at`.
   - If absent/empty, quota output MUST remain empty and provenance must stay `unknown`, not `fresh`.

3. **Failure and partial payload behavior**
   - On payload miss/empty, produce warning alerts and `snapshot` provenance should not be `live`.
   - On partial payloads, known metrics still appear as unknown values with stale freshness.
   - Any adapter failure must set the usage store to unknown baseline and emit a critical alert.

4. **Source health rule**
   - Until a verified real-time provider quota endpoint exists, the ops UI must display:
     - provider quota section as `unknown`, and
     - source label `provider-rate-limits` as `unknown` confidence.

## Current unverified gap set

1. **Real-time provider rate-limit source**
   - No confirmed Hermes endpoint in this runtime returns token/request quotas and reset times with safe confidence.
2. **Agent / model-level health details**
   - There is no dedicated, granular provider/tool health endpoint verified for per-service degraded/healthy signals beyond existing `dashboard` / `kanban-*` probes.
3. **Event-level cost-attribution**
   - No verified stream currently provides per-model or per-task cost attribution for active tasks.

## Next implementation actions (ingestion & aggregation)

1. Continue polling `GET /api/plugins/kanban/stats` with adapter-level unknown-safe semantics.
2. Add additional adapter contracts once direct `hermes insights` or local-proxy CLI paths are proven in runtime.
3. Keep provider quota source at `provider-rate-limits` with `unknown` confidence until a direct verified endpoint is added.
4. Publish health rollups only from source states and usage freshness/confidence, never from raw socket/request success alone.
