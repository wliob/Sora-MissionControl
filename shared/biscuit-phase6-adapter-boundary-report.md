# Biscuit Phase 6 Adapter Boundary Report

> **Date:** 2026-06-21
> **Status:** Complete — adapter boundary implemented, verified, tested
> **Remaining blocker:** Cloud-owned adapter implementations (KeyMcpAdminAdapter, CwsAdminAdapter)

---

## Summary

Implemented explicit adapter boundary fallback for the Key/MCP admin store and panels. Previously, the store used hardcoded mock seed data as default state, making the admin surface look production-healthy even without any real backend. Now:

1. **Store starts empty** — no mock seed data in production state.
2. **KeyMcpAdminAdapter interface** — Cloud can implement `listKeys()`, `listMcpEntries()`, `executeAction()` against the real Hermes backend.
3. **Provenance per subsection** — `keysProvenance` and `mcpProvenance` track freshness/confidence independently.
4. **lastError field** — adapter failures and missing-adapter errors are explicit, not silent.
5. **UI panels disable mutating controls** — KeysPanel/McpPanel disable all buttons when `hasKeyMcpAdapter()` is false.
6. **"NO ADAPTER BOUND" banner** — KeyMcpAdminPanel renders explicit unavailable state.
7. **Mock seed is TEST ONLY** — `_resetToSeed()` loads mock data with `placeholder` confidence and `freshness: 'missing'`, so even in test the UI can distinguish mock from live data.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/admin-keymcp.ts` | Added `keysProvenance`, `mcpProvenance`, `lastError` to `KeyMcpAdminState`. Updated `initialKeyMcpState()` with `missing` provenance defaults. |
| `src/state/adminKeyMcpStore.ts` | Full rewrite: added `KeyMcpAdminAdapter` interface, `setKeyMcpAdminAdapter()`/`hasKeyMcpAdapter()` binding, `loadKeys()`/`loadMcpEntries()` with provenance upgrade, empty default state, `_resetToSeed()` (TEST ONLY) with placeholder confidence, `_ingestKeys()`/`_ingestMcpEntries()` test helpers, error handling for adapter failures. |
| `src/components/admin/KeyMcpAdminPanel.tsx` | Added "NO ADAPTER BOUND" banner, count badges only when adapter bound, imports from new store API. |
| `src/components/admin/KeysPanel.tsx` | Disabled "+ New Key" button, Edit/Regenerate/Revoke/Delete buttons when no adapter. Added unavailable empty state message. |
| `src/components/admin/McpPanel.tsx` | Disabled "+ Add Server" button, Test/Edit/Remove buttons when no adapter. Added unavailable empty state message. |
| `src/state/adminKeyMcpStore.test.ts` | Full rewrite: 56 tests across 10 describe blocks covering adapter boundary, unavailable states, no browser fs/cli, redaction, confirmation gates, creation flows, provenance tracking, adapter failure handling, JSON serialization safety. |
| `AGENTS.md` | Updated Phase 6 status, completed items, remaining tasks, completion gates, blockers. |
| `OVERVIEW.md` | Updated status snapshot, stats, changelog, Phase 6 section, capabilities, workstreams. |

---

## Test Coverage

### New Tests (56 total in adminKeyMcpStore.test.ts)

| Section | Tests | What It Proves |
|---------|-------|----------------|
| Adapter boundary: no adapter bound | 10 | hasKeyMcpAdapter(), empty defaults, missing provenance, requestAction fails explicitly, loadKeys/loadMcpEntries set lastError, adapter set/unset |
| Unavailable state does not look healthy | 7 | Empty+missing=not healthy, seed has placeholder confidence, seed has "Mock seed data" note, seed is not verified/high, adapter-bound loadKeys upgrades provenance, lastError signals unhealthy |
| No browser fs/cli/profile writes | 4 | State is plain serializable objects, initialKeyMcpState is serializable, no fs/path/buffer method names, no localStorage/sessionStorage |
| Redaction in persistent state | 6 | Masked secrets in seed, masked tokens in seed, no raw patterns in JSON, clearLastResult removes one-time key secret, one-time MCP token stripped |
| maskSecret/maskUrl | 5 | Masking correctness |
| isDestructive | 2 | Correct classification |
| Confirmation gates (with adapter) | 7 | Destructive actions queue pending, confirm/cancel behavior |
| Creation flows (with adapter) | 4 | key.create and mcp.create with one-time secrets |
| Provenance tracking | 3 | Independent per subsection |
| Exhaustive action kinds | 1 | All kinds handled |
| Adapter failure handling | 4 | loadKeys/loadMcpEntries/executeAction error propagation, success clears lastError |
| JSON serialization safety | 3 | No raw secrets after clear, keys safe for wire, mcpEntries safe for wire |

### Verification

- **npm run test**: 576/576 passing (27 test files)
- **npm run build**: Clean (tsc + vite)
- **Previous baseline**: 545/545 → net +31 tests (56 new Key/MCP tests, 25 old tests rewritten into new structure)

---

## Architecture: Adapter Boundary Pattern

```
┌─────────────────────┐     ┌─────────────────────────┐
│   KeyMcpAdminPanel  │────▶│   adminKeyMcpStore.ts   │
│   KeysPanel.tsx     │     │                         │
│   McpPanel.tsx      │◀────│  hasKeyMcpAdapter() ────│──▶ false → "NO ADAPTER BOUND"
│                     │     │  loadKeys() ────────────│──▶ error if no adapter
│                     │     │  requestAction() ───────│──▶ fails if no adapter
└─────────────────────┘     │                         │
                            │  setKeyMcpAdminAdapter()│──▶ binds Cloud adapter
                            │                         │
                            │  KeyMcpAdminAdapter:    │
                            │    listKeys()           │──▶ Cloud implements
                            │    listMcpEntries()     │──▶ Cloud implements
                            │    executeAction()      │──▶ Cloud implements
                            └─────────────────────────┘
```

When adapter is bound: store loads data from backend, provenance upgrades to `live`/`unverified`, panels show real data with active controls.

When adapter is not bound: store stays empty, provenance stays `missing`/`unknown`, panels show "NO ADAPTER BOUND" banner with disabled controls.

---

## Key/MCP Mock Certainty Resolution

**Problem:** Old store used hardcoded `SEED_KEYS` and `SEED_MCP` as default state, making admin panels look production-healthy even without a backend.

**Resolution:**
- Default state is now empty (`initialKeyMcpState()`).
- Mock seed data is only accessible via `_resetToSeed()` (TEST ONLY), which marks it with `confidence: 'placeholder'` and `freshness: 'missing'`.
- The seed provenance includes `note: 'Mock seed data — not from a real adapter'` so any UI reading provenance can distinguish mock from live.
- When the store has seed data but no adapter, destructive actions still fail explicitly (not silently).

**No blocker needed** — the pattern is fully implemented and tested.

---

## Backend Contract Needed (Cloud)

The `KeyMcpAdminAdapter` interface requires Cloud to implement:

```typescript
interface KeyMcpAdminAdapter {
  listKeys(): Promise<ApiKey[]>;          // All keys with masked secrets
  listMcpEntries(): Promise<McpEntry[]>;  // All MCP entries with masked tokens
  executeAction(action: KeyMcpAction): Promise<KeyMcpActionResult>;
}
```

Where `KeyMcpActionResult` may include:
- `createdKey?: ApiKeyCreated` (one-time secret for key.create/regenerate)
- `createdMcp?: McpEntryCreated` (one-time token for mcp.create)

The adapter must:
1. Mask all secrets before returning them in list views.
2. Return raw secrets only in `createdKey.secret` / `createdMcp.token` for one-time reveal.
3. Execute destructive actions (revoke, regenerate, delete, remove) against the Hermes backend.
4. Report errors as thrown exceptions (the store catches and surfaces via `lastError`).

---

## Gates Passed

- [x] No direct browser filesystem/CLI/profile writes from store
- [x] Unavailable/unknown/mock states do not render as healthy
- [x] Raw secrets are redacted from persistent state and JSON serialization
- [x] Adapter absence is explicit (banner + disabled controls + lastError)
- [x] Mock seed data is TEST ONLY with placeholder confidence
- [x] Provenance tracks independently per subsection (keys vs MCP)
- [x] All 576 tests passing, build clean
