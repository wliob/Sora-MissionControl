# Biscuit Codex Next Slice Report - Phase 6 Model Confirmation Cohesion

Date: 2026-06-22
Workdir: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`

## Scope completed

Implemented the smallest truthful non-Cloud Phase 6 slice: model-admin confirmation cohesion and risk-aware messaging.

Completed:
1. Kept model-admin backend binding blocked rather than faking capability.
2. Added model action helpers for safe/risk/danger tiers, confirmation requirements, typed-phrase requirements, titles, labels, and phrases.
3. Extended model confirmation requests with tier metadata, typed-phrase gates, title, and confirm label.
4. Replaced `AdminPanel` model confirmations from the old common `ConfirmDialog` to shared `RiskConfirmDialog`.
5. Enriched model confirmation copy with target provider/model, routing scope, provenance source/freshness/confidence, explicit unknown cost/quota/rate-limit notes, and rollback guidance.
6. Added focused TDD coverage for store helpers/metadata and a jsdom `AdminPanel` confirmation test.

## Backend blocker

A verified model-admin backend adapter is still not feasible honestly in this pass.

Verified Hermes model surfaces currently available:
- `hermes model` is interactive.
- `hermes config set model.default <MODEL_NAME>` supports one default-model mutation.
- No verified noninteractive model-list/capability endpoint is available.

Because of that, Mission Control still must not invent live model lists, provider capabilities, cost class, quota, or rate-limit data. The UI now states unknowns explicitly in confirmations.

## Files changed

Code:
- `src/types/admin.ts`
- `src/modules/admin/adminStore.ts`
- `src/components/shell/AdminPanel.tsx`

Tests:
- `src/modules/admin/adminStore.test.ts`
- `src/components/shell/AdminPanel.test.tsx`

Docs:
- `AGENTS.md`
- `OVERVIEW.md`
- `shared/biscuit-codex-next-slice-report.md`

## TDD notes

Tests were added before implementation and failed for the expected reasons:
- Store confirmations had no `tier`, `requiresTypedPhrase`, or `typedPhrase` metadata.
- Model helper exports (`modelActionTier`, `modelRequiresConfirmation`, `modelRequiresTypedPhrase`) did not exist.
- `AdminPanel` still rendered the old common confirmation dialog with no risk/danger tier or typed phrase gate.

After implementation, the focused tests passed.

## Verification

Commands run:

```bash
npm run test -- src/modules/admin/adminStore.test.ts --run
npm run test -- src/components/shell/AdminPanel.test.tsx --run
npm run test -- src/modules/admin/adminStore.test.ts src/components/shell/AdminPanel.test.tsx --run
npm run lint
npm test -- --run
npm run build
```

Results:
- Initial focused tests failed as expected before implementation.
- `npm run test -- src/modules/admin/adminStore.test.ts --run`: passed after implementation, `32` tests.
- `npm run test -- src/components/shell/AdminPanel.test.tsx --run`: passed after implementation, `2` tests.
- `npm run test -- src/modules/admin/adminStore.test.ts src/components/shell/AdminPanel.test.tsx --run`: passed, `34` tests across `2` files.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm test -- --run`: passed, `617` tests across `34` files.
- `npm run build`: passed; existing Vite large-chunk warning remains.

## Remaining blockers

1. Model-admin backend binding remains blocked on a verified noninteractive Hermes model-list/capability endpoint.
2. Unsupported Key/MCP/CWS mutations still need verified Hermes semantics before UI binding.
3. Provider real-time quota/rate-limit data remains unverified and must stay unknown.

## Next recommended slice

Finish the remaining confirmation consolidation by migrating Keys/MCP panels from the old `ConfirmDialog` to shared `RiskConfirmDialog`, preserving their existing adapter-unavailable behavior, typed destructive gates, and secret-redaction tests.
