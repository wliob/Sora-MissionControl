# Cloud Phase 6 Adapter Contract Quality Gate - Retry 2

Date: 2026-06-21
Owner: Sora / Central Command

Cloud retry `proc_bf3ab6cf80f6` produced `shared/cloud-phase6-adapter-contract.md`, but the artifact is not accepted for Phase 6 implementation gating.

## Acceptance result

Rejected / blocked after repeated Cloud attempts.

## Why it failed

The retry prompt required real tested commands/routes, no pseudo-code, no simulations, and exact mapping to existing TypeScript interfaces. The delivered artifact still includes unverified or synthesized entries and proposed interfaces instead of the existing contracts.

Examples from the artifact:

- `hermes webhook add ...` and `hermes webhook remove ...` are marked synthesized, not executed.
- `hermes skills view <skill_name>` and `default_api.skill_view(...)` are marked synthesized/not executed.
- `hermes mcp list` and `hermes mcp test <server_name>` are marked synthesized/not executed.
- Cron mapping uses fields like `prompt` and `enabledToolsets`, but the existing `CronJob` contract in `src/types/admin-cws.ts` requires safe list fields such as `promptPreview`, `hasScript`, `paused`, `lastRunAt`, `nextRunAt`, and `error`.
- Webhook mapping omits required existing fields such as `id`, `event`, `maskedSecret`, `hasSecret`, `active`, `lastTriggeredAt`, `createdAt`, and `error`.
- Key/MCP adapter needs are conceptual only; the Key/MCP mock certainty blocker remains unresolved.

## Current gate

Cloud has not yet supplied an accepted real adapter contract or implementation path. Do not claim Phase 6 complete from this artifact. Biscuit UI work may continue for unavailable/mock-safe states, but real admin mutation readiness remains blocked on Cloud.
