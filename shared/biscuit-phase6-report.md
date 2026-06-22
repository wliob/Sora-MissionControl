# Biscuit Phase 6 Report — Unified Admin Safety Patterns

Owner: Biscuit / Automation & Coding
Date: 2026-06-21
Scope: Phase 6 admin controls — CWS (Cron, Webhook, Skills) types, store, and safety tests.

## Summary

Completed the backend-side of the CWS admin surface: canonical types, a safety-first store, and 48 comprehensive tests. This unblocks Cloud to bind real adapters and Korra to build UI panels.

## What was done

### 1. Fixed usageStore baseline blockers (pre-existing)

Before starting Phase 6, resolved TypeScript build errors and test failures in the usage/telemetry layer that were blocking Cloud's Docker build:

- Fixed `UsageSourcePayload` type to use `Record<string, unknown>` base
- Fixed `confidence` reduce logic for TypeScript narrowing
- Fixed `period_days` null handling
- Fixed test expectations (`freshness: 'live'` vs `'fresh'`, `confidence: 'unknown'` vs `'unverified'`)
- Fixed backbone adapter binding

**Result:** 502/502 tests pass, `npm run build` succeeds, `tsc --noEmit` clean.

### 2. Created CWS admin types (`src/types/admin-cws.ts`)

Canonical type definitions for cron, webhook, and skills admin surfaces:

- `CronJob` — list entry with truncated `promptPreview`, no full prompt/script in persistent state
- `CronJobCreated` — one-time creation response with `fullPrompt`/`fullScript`
- `WebhookEntry` — list entry with `maskedSecret`, no raw secrets
- `WebhookCreated` — one-time creation response with raw `secret`/`rawCallbackUrl`
- `SkillEntry` — list entry with `hasSensitiveAccess` flag for risk UI
- `CwsAction` — discriminated union of all CWS admin actions
- Action tier system: `safe`, `risk`, `danger` (per Korra audit recommendations)
  - Safe: `cron.run`, `skill.list`, `skill.view`
  - Risk: `cron.update`, `cron.pause`, `cron.resume`, `webhook.update`, `skill.enable`, `skill.disable`
  - Danger: `cron.remove`, `webhook.remove`
- `cwsRequiresConfirmation()` — gates risk and danger actions
- `cwsRequiresTypedPhrase()` — extra safety for danger actions
- `cwsActionTier()` — returns tier for UI styling
- `CwsPendingConfirmation` — includes `tier` and `requiresTypedPhrase` for UI
- `CwsAdminState` — per-subsection provenance (cron/webhook/skills each tracked independently)
- `truncatePreview()` — canonical prompt/script truncation
- `assertCwsFieldMasked()` — defense-in-depth ingest guard
- `summarizeCwsAction()` — human-readable confirmation messages naming target and blast radius

### 3. Created CWS admin store (`src/state/cwsAdminStore.ts`)

Safety-first store following the same patterns as `adminStore.ts` and `adminKeyMcpStore.ts`:

- **Adapter binding:** `CwsAdminAdapter` interface + `setCwsAdminAdapter()` for Cloud injection
- **Redaction guards:** `validateCronMasking()` rejects suspiciously long previews; `validateWebhookMasking()` rejects unmasked secrets and URLs with embedded credentials
- **Confirmation flow:** `requestCwsAction()` queues pending confirmations for risk/danger actions; safe actions execute immediately
- **One-time secret handling:** `createdCron`/`createdWebhook` raw fields are stripped before adding to persistent lists using destructuring (`const { fullPrompt, fullScript, ...safeCron } = ...`)
- **Per-subsection provenance:** Each section (cron/webhook/skills) has independent `Provenance` tracking
- **No mock seed data:** Store starts empty; data only populates when adapter is bound

### 4. Created comprehensive test suite (`src/state/cwsAdminStore.test.ts`)

48 tests across 10 describe blocks:

1. **Action tier classification** — safe/risk/danger correctly categorized
2. **Confirmation requirements** — safe actions skip confirmation, risk/danger queue it
3. **Typed phrase requirements** — only danger actions require typed phrase
4. **Redaction guards** — `truncatePreview`, `assertCwsFieldMasked`, cron/webhook ingest validation
5. **Confirmation gate flow** — queue/cancel/confirm/cancelAll
6. **Safe action immediate execution** — `cron.run` executes without confirmation
7. **Confirmed action execution** — confirm triggers adapter, sets lastResult
8. **One-time secret reveal** — raw secrets only in `lastResult`, stripped from persistent state
9. **Pending confirmation queue** — unique nonces, confirming one doesn't affect others
10. **Full JSON serialization safety** — after `clearLastResult()`, `JSON.stringify(state)` contains no raw secrets

## Files changed

| File | Change |
|---|---|
| `src/types/admin-cws.ts` | New — canonical CWS admin types (355 lines) |
| `src/state/cwsAdminStore.ts` | New — CWS admin store (420 lines) |
| `src/state/cwsAdminStore.test.ts` | New — 48 tests (653 lines) |
| `src/state/usageStore.ts` | Fixed — UsageSourcePayload type, confidence reduce, period_days null |
| `src/state/backbone.ts` | Fixed — adapter binding |
| `src/state/usageStore.test.ts` | Fixed — test expectations |
| `AGENTS.md` | Updated — Phase 6 status, tasks, blockers |
| `OVERVIEW.md` | Updated — Phase 6 current state |

## Verification

```
npm run test  →  502 passed (25 test files)
npm run build →  ✓ built in 7.15s
npx tsc --noEmit → 0 errors in src/
```

## Blockers remaining

1. **Real CWS adapters from Cloud.** The store has the adapter seam (`CwsAdminAdapter`) but no bound backend. Cloud must provide implementations that call the Hermes CLI/API.
2. **CWS UI panels.** Types and store are ready; Korra needs to build the admin UI panels.
3. **Confirmation dialog consolidation.** Per Korra audit: merge `components/common/ConfirmDialog.tsx` and `components/admin/ConfirmDialog.tsx` into one shared `RiskConfirmDialog` with severity props.
4. **Key/MCP mock data.** Still using mock seed data; needs real adapter from Cloud.

## Decisions made

1. **Action tier system (safe/risk/danger)** implements Korra's audit recommendation for three visual severity levels instead of binary destructive/non-destructive.
2. **Typed phrase only for danger-tier** (cron.remove, webhook.remove) — not for risk-tier actions, keeping the UI calm per Korra's guidance against alarm fatigue.
3. **Per-subsection provenance** — each admin subsection (cron/webhook/skills) tracks freshness independently, matching the ops telemetry pattern.
4. **No mock seed data** — the CWS store starts empty, unlike adminKeyMcpStore. When adapters aren't bound, the state renders as "missing" provenance, not fake healthy rows.
5. **Destructuring to strip one-time fields** — `const { secret, rawCallbackUrl, ...safeWh } = result.createdWebhook` ensures raw secrets can never leak into persistent state even if the adapter returns them.
