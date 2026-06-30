# Biscuit Codex Key/MCP Risk Dialog Report

Date: 2026-06-22
Workdir: `/home/wliob/projects/Active/Sora-MissionControl`

## Scope Completed

Migrated the Keys/MCP admin confirmation UI from the old `components/admin/ConfirmDialog` to the shared `components/admin/RiskConfirmDialog`.

Completed:
1. Added Key/MCP action tier helpers in `src/types/admin-keymcp.ts`.
2. Extended Key/MCP pending confirmations with `tier`, `requiresTypedPhrase`, and `typedPhrase`.
3. Kept existing confirmation coverage: `key.revoke`, `key.regenerate`, `key.delete`, and `mcp.remove` still require confirmation before execution.
4. Classified `key.revoke` and `key.regenerate` as risk-tier confirmations without typed phrases.
5. Classified `key.delete` and `mcp.remove` as danger-tier confirmations with typed phrase gates using the affected key label or MCP name.
6. Updated `KeysPanel` and `McpPanel` to render `RiskConfirmDialog`.
7. Preserved adapter-unavailable behavior, existing secret redaction, one-time secret reveal behavior, and unsupported/unavailable backend behavior.

## Files Changed

Code:
- `src/types/admin-keymcp.ts`
- `src/state/adminKeyMcpStore.ts`
- `src/components/admin/KeysPanel.tsx`
- `src/components/admin/McpPanel.tsx`

Tests:
- `src/state/adminKeyMcpStore.test.ts`
- `src/components/admin/KeyMcpPanels.test.tsx`

Docs:
- `AGENTS.md`
- `OVERVIEW.md`
- `shared/biscuit-codex-keymcp-risk-dialog-report.md`

## TDD Notes

Tests were added before implementation and failed for the expected reasons:
- `keyMcpActionTier`, `keyMcpRequiresConfirmation`, and `keyMcpRequiresTypedPhrase` did not exist.
- Key/MCP pending confirmations did not carry tier or typed-phrase metadata.
- `KeysPanel` and `McpPanel` still rendered the old generic destructive dialog, with no risk/danger badge and no typed phrase input.

After implementation, the focused Key/MCP tests passed, then adjacent admin confirmation tests, lint, full tests, and build passed.

## Verification Performed

Commands run:

```bash
npm run test -- src/state/adminKeyMcpStore.test.ts src/components/admin/KeyMcpPanels.test.tsx --run
npm run test -- src/components/admin/KeyMcpPanels.test.tsx src/components/admin/CwsPanels.test.ts src/state/adminKeyMcpStore.test.ts src/state/cwsAdminStore.test.ts --run
npm run lint
npm test -- --run
npm run build
```

Results:
- Initial focused RED run failed as expected.
- Focused Key/MCP GREEN run: 63 passing across 2 files.
- Adjacent admin confirmation/redaction run: 154 passing across 4 files.
- `npm run lint`: passed (`tsc --noEmit` clean).
- `npm test -- --run`: passed, 624 tests across 35 files.
- `npm run build`: passed; existing Vite large-chunk warning remains.

## Blockers

1. Model-admin backend binding remains blocked on a verified noninteractive Hermes model-list/capability endpoint.
2. Unsupported Key/MCP actions still require verified backend semantics before being enabled or broadened: `key.create`, `key.update`, `key.revoke`, `key.regenerate`, `mcp.update`, and token/note-backed MCP create flows.
3. Unsupported CWS actions still require verified contract alignment before being enabled or broadened: `cron.update`, `cron.create` with model override, `webhook.create`, `webhook.update`, `skill.enable`, and `skill.disable`.
4. Provider real-time quota/rate-limit data remains unverified and must stay unknown.

## Next Recommended Slice

Phase 6 sidecar production hardening: add a scoped local proxy token requirement with focused tests for missing/invalid/valid token behavior, keep same-host/loopback default CORS intact, and document the required LAN/firewall/process-supervision deployment assumptions. Do not add new admin capabilities in that slice.
