# Tifa Phase 6 Risk + Approval Audit

Owner: Tifa / Finance & Trading
Card: `smc-p6-tifa-risk-approval-audit`
Scope: Phase 6 Admin Controls risk review only. No trading actions taken.
Reviewed at: 2026-06-21T18:50:57-04:00

## Executive risk call

Phase 6 admin controls are not finance/risk-ready for real operations yet. The model admin store has useful confirmation and redaction guardrails, but the keys/MCP store is still mock-backed and includes flows that would create false operational certainty if shown as real. Credential, MCP, model-routing, cron, webhook, and skills controls must stay unavailable/mock-labeled until Cloud binds verified adapters and the UI proves secrets, quota/rate-limit data, and destructive actions are handled conservatively.

Finance/trading-specific dashboard surface: no-op for Phase 6. No Tifa trading/portfolio/admin panel is needed here. The existing ops/admin surfaces are enough if they preserve cost, quota, credential, and approval discipline. If any future trading platform controls are added, they must be separate, paper-first, platform-isolated, and live-disabled by deterministic approval flags; that is out of scope for this card.

## Reviewed sources

Project guidance:
- `AGENTS.md`
- `OVERVIEW.md`
- `docs/work-split.md`
- `tifa/AGENTS.md`
- `shared/README.md`
- `shared/phase0-cloud-surface-map.md`
- `docs/section-contracts.md`

Admin implementation inspected:
- `src/modules/admin/adminStore.ts`
- `src/modules/admin/adminStore.test.ts`
- `src/types/admin.ts`
- `src/state/adminKeyMcpStore.ts`
- `src/state/adminKeyMcpStore.test.ts`
- `src/types/admin-keymcp.ts`
- `src/components/shell/AdminPanel.tsx`
- `src/components/admin/UnifiedAdminSurface.tsx`
- `src/components/admin/KeysPanel.tsx`
- `src/components/admin/McpPanel.tsx`
- `src/components/admin/SecretReveal.tsx`
- `src/components/admin/MaskedField.tsx`
- `src/components/admin/ConfirmDialog.tsx`
- `src/components/common/ConfirmDialog.tsx`

## High-priority findings

### R1 — Mock key/MCP data can look operationally real

Risk: false operational certainty, credential workflow confusion, possible money-loss if users believe keys were actually created/revoked/regenerated.

Evidence:
- `src/state/adminKeyMcpStore.ts` seeds realistic-looking OpenRouter, Anthropic, OpenAI keys and MCP entries (`SEED_KEYS`, `SEED_MCP`) and starts state from those seeds.
- The store comment says it is mock-backed until Cloud's adapter lands, but the UI count/status labels in `KeysPanel`, `McpPanel`, and `KeyMcpAdminPanel` do not visibly mark the surface as mock/unavailable.
- `generateFakeSecret()` creates fake key material; `mcp.test` uses random success/latency.

Required confirmation:
- Cloud must confirm whether a real adapter exists. If not, the UI must display `mock` / `unavailable`, disable mutating controls by default, and never present seed rows as configured provider status.

Required fix rule:
- Mock admin data must never be styled as healthy/active production data. It must be labeled at row level and panel level, with provenance/freshness/confidence.

### R2 — Credential-touching actions are not all confirmation-gated

Risk: credential leakage, accidental provider access changes, unintended loss of service, future money-loss through provider/account changes.

Evidence:
- `docs/section-contracts.md` requires explicit confirmation for “Any action touching credentials.”
- `src/types/admin-keymcp.ts` only gates `key.revoke`, `key.regenerate`, `key.delete`, and `mcp.remove` as destructive.
- `key.create`, `mcp.create`, `mcp.update` with token/url, and `key.update` with `active` are currently non-destructive and execute immediately.

Required confirmation:
- Product decision: are API key create/update/regenerate/delete flows allowed in MissionControl, or should Phase 6 show credential status only and link/defer to `hermes auth` with user-present CLI flow?

Required fix rule:
- Until that decision is explicit, credential creation/update/regeneration/deletion should be unavailable. If allowed later, every credential-touching action requires explicit confirmation, one-time reveal, audit event, and adapter-level secret redaction tests.

### R3 — MCP test and key/MCP creation simulate success

Risk: rate-limit surprise, broken automation, false health status.

Evidence:
- `mcp.test` randomly returns success/failure and latency rather than using a verified Hermes MCP adapter.
- `key.create`/`key.regenerate` generate fake secrets locally and update the list.

Required fix rule:
- Health/status tests must be sourced from verified CLI/API output only. Random, generated, or demo health must be labeled `mock` and excluded from rollups/green status.

### R4 — Raw secrets remain in in-memory UI state until manual dismissal

Risk: credential leakage through React devtools, memory snapshots, error reporting, copied DOM text, screenshots, or unattended UI.

Evidence:
- `SecretReveal` displays raw secret text from `state.lastResult.createdKey.secret` / `createdMcp.token`.
- `adminKeyMcpStore.clearLastResult()` only runs when the user dismisses. There is no TTL, route-change cleanup, visibility-change cleanup, or automatic disposal.
- `McpEntryCreated` includes `rawUrl`; `mcp.update` can place raw URL values into `lastResult.createdMcp` even when the UI is not showing them.

Required fix rule:
- One-time secret reveal must be a separate ephemeral reveal channel with short TTL, route/unmount cleanup, and no inclusion in ordinary persistent store snapshots or action logs. Raw URLs with embedded credentials must not be stored in `lastResult` unless actively being revealed, and should generally be avoided.

### R5 — Model routing controls have confirmation, but insufficient cost/rollback context

Risk: money-loss, rate-limit surprise, degraded agent behavior from unintended global model/default/fallback changes.

Evidence:
- `model.setDefault`, `model.setFallback`, `model.disable`, `model.delete`, and `model.resetCredential` are confirmation-gated in `src/types/admin.ts` and `src/modules/admin/adminStore.ts`.
- `docs/section-contracts.md` forbids model/provider switches without displaying target profile and rollback note.
- Current confirmation messages warn about routing/failover, but do not show affected profiles, estimated/known cost class, quota status, or rollback instructions.

Required fix rule:
- Before execution, model routing confirmations must include: target provider/model, affected profiles/scope, current source/freshness/confidence, known cost class or `unknown`, quota/rate-limit state or `unknown`, and rollback note.

### R6 — Some mutable admin actions are classified as non-destructive but can be operationally destructive

Risk: accidental capability loss, provider changes, or hidden routing/cost impact.

Examples:
- `key.update` can carry `active?: boolean`, which could effectively disable/enable a key.
- `mcp.update` can change URL, token, transport, or enabled status; those can remove tools, route agents to a different server, or replace credentials.
- `model.editConfig` allows `contextWindow` / `maxOutput` in type, which can affect cost/usage if surfaced later.

Required fix rule:
- Classify by effect, not label. Any enable/disable, endpoint/transport/token change, model/provider/fallback/default change, max-output/context-window increase, cron schedule/action mutation, webhook target mutation, or skill install/update/uninstall must require confirmation.

## Medium-priority findings

### M1 — Key/MCP store has no real adapter seam despite comments

Risk: implementation drift; UI may continue mutating mock state after Phase 6 claims completion.

Evidence:
- `adminKeyMcpStore.ts` comments mention `loadFromAdapter`, but no such method exists in the exported API.

Required fix rule:
- Add an explicit adapter interface similar to model admin: read-only load, capability flags, mutation methods, provenance, unavailable state, and secret-safe action results.

### M2 — MCP edit form can save masked URLs back as if they are real URLs

Risk: credential corruption or broken MCP server config if a masked URL (`••••@host`) is submitted through a real adapter.

Evidence:
- `McpRow` initializes edit state from `entry.url`, which is already masked if it contained embedded credentials.
- Saving sends that value through `mcp.update`.

Required fix rule:
- Never let a masked display value become an editable source value. For secret-bearing URLs, show a status/fingerprint and require a separate credential replacement flow.

### M3 — Action result logs may expose raw adapter error text

Risk: credential leakage if backend errors include request body, token, env path, or stack traces.

Evidence:
- Model and key/MCP stores place `err.message` into UI-visible `lastError` / `lastResults`.

Required fix rule:
- Adapter errors must pass through a redaction/sanitization layer before reaching store state or UI. Tests should include secret-like substrings in thrown errors and verify they are redacted.

### M4 — Missing Phase 6 surfaces are still open risk areas

Risk: admin scope incomplete; destructive controls unreviewed.

Missing or not yet reviewed as implemented:
- Cron manager
- Webhook manager
- Skills manager
- Real credential status adapter
- Real key/MCP adapter

Required fix rule:
- Do not call Phase 6 complete until these surfaces exist or are explicitly marked unavailable. Cron delete/run, webhook remove/test/target changes, and skill install/update/uninstall all need confirmation and provenance.

## No-fake-quota and no-false-certainty rules

1. Provider quota/rate-limit values stay `unknown` unless sourced from verified provider API headers/endpoints or a verified Hermes adapter.
2. Historical `hermes insights` usage is not live quota. Label it historical with source/freshness/confidence.
3. Empty, failed, stale, unavailable, mock, or random-simulated data must never render as green/healthy.
4. MCP connection tests must identify the source. Mock/random tests are demo-only and cannot update production health.
5. Model changes must show quota/cost state as `unknown` when no verified source exists; do not infer safety from credential presence.
6. Do not estimate remaining quota from spend/tokens unless explicitly labeled estimate and excluded from hard gates.
7. Cost/rate-limit rollups must show per-source uncertainty instead of hiding unknowns behind an overall healthy badge.
8. Any LLM-triggering admin action such as profile auto-description, task decomposition, skill audit/update, or model validation must show cost/rate-limit risk before execution.

## Approval gates required before real admin controls

Required before enabling real mutating controls:
- Adapter capability flags: `available`, `readOnly`, `mock`, `requiresUserPresence`, and `supportsMutation`.
- Provenance on every admin resource: source, freshness, confidence, receivedAt/checkedAt.
- Confirmation for every destructive, credential-touching, routing-changing, cost-affecting, or external-endpoint-changing action.
- Confirmation copy includes scope, target, likely blast radius, rollback note, and cost/quota state or `unknown`.
- Secrets status-only in normal views. One-time reveal only for verified create/regenerate flows, with TTL and cleanup.
- Redaction tests for store state, DOM render, error messages, action logs, and adapter responses.
- No browser direct CLI spawn; all admin actions route through Cloud-owned trusted adapter.
- Missing backend capability renders unavailable, not silently mocked.
- Mutating actions disabled while source confidence is `unknown`, `unverified`, `mock`, or `stale`, unless the explicit purpose is a read-only demo.

## Money-loss / rate-limit / credential-leak flags

Money-loss flags:
- Model default/fallback changes can route traffic to higher-cost providers or degrade fallback economics.
- Context window / max output edits can increase token spend if surfaced without confirmation.
- LLM-triggering admin actions in future cron/webhook/skills/profile tooling can create repeated spend if not capped.

Rate-limit surprise flags:
- Provider quota is still unverified; any UI implying remaining quota is unsafe.
- MCP test randomness must not be used as readiness or capacity signal.
- Cron/webhook managers must show schedule frequency and expected LLM/API call pattern before enabling.

Credential leakage flags:
- Raw `lastResult` secret and `rawUrl` fields need TTL/cleanup and must not enter logs/devtools-safe persistent state.
- Adapter error strings require redaction before UI display.
- Masked display values must not be editable source-of-truth for secret-bearing URLs.

False operational certainty flags:
- Mock key/MCP seed data looks production-like.
- Random MCP health can render success/latency.
- Missing adapters must show unavailable/mock, not active counts.

## Final review checklist for Phase 6 acceptance

Admin adapter / provenance:
- [ ] Real adapter bound for models, or model panel clearly unavailable.
- [ ] Real adapter bound for keys/MCP, or keys/MCP panel clearly unavailable/mock and mutations disabled.
- [ ] Cron, webhook, and skills surfaces implemented with verified Hermes CLI/API routes, or explicitly unavailable.
- [ ] Every row has source/freshness/confidence and last checked/received timestamp.

Secret safety:
- [ ] No raw secrets in persistent stores, normal render paths, logs, errors, test snapshots, or event payloads.
- [ ] One-time secret reveal has TTL, route/unmount cleanup, and clear user warning.
- [ ] Raw URL with embedded credentials never persists in normal state.
- [ ] Backend/adapter error redaction tested with secret-like substrings.

Approval gates:
- [ ] All credential-touching actions require confirmation.
- [ ] All model/provider/default/fallback/routing changes require confirmation with affected profile scope and rollback note.
- [ ] All endpoint/transport changes for MCP/webhook require confirmation.
- [ ] Cron delete/run/schedule mutations require confirmation; recurring LLM/API jobs show cost/rate-limit warning.
- [ ] Skill install/update/uninstall/audit actions require confirmation and source/trust context.
- [ ] Mutating buttons disabled for mock, stale, unavailable, unauthenticated, or unverified sources.

Cost / quota:
- [ ] Real-time provider quota remains `unknown` unless verified.
- [ ] Historical usage is labeled historical, not live quota.
- [ ] Any LLM/API-triggering admin action shows cost/rate-limit state or `unknown` before execution.
- [ ] No fake quotas, fake latencies, fake active statuses, or random health in production UI.

Tifa finance/trading lane:
- [ ] No trading actions or live-trading controls introduced by Phase 6.
- [ ] No finance/trading-specific dashboard surface required for this phase; no-op remains documented.
- [ ] If future trading admin exists, it is paper-first, platform-isolated, and live-disabled unless deterministic approval gates allow it.
