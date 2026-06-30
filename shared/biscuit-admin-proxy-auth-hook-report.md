# Biscuit Admin Proxy Auth Hook Report

Date: 2026-06-22
Workdir: `/home/wliob/projects/Active/Sora-MissionControl`
Lead: Biscuit

## Scope Completed

Implemented the safe client-side path for `X-Mission-Control-Key` without baking secrets into source, docs, or built assets. The browser now supports operator-entered, session-only in-memory admin proxy tokens, while preserving no-token local development behavior when the sidecar auth mode is unset.

## Files Changed

- `src/services/hermes/adminProxyAdapter.ts`: Added session-only token helpers, raw-token-free auth state, conditional `X-Mission-Control-Key` header attachment, and a deprecated localhost-only fallback for `window.__SORA_ADMIN_PROXY_KEY__`.
- `src/components/admin/AdminProxyAuthControl.tsx`: Added the operator password control that applies or clears the token for the current tab only.
- `src/components/admin/UnifiedAdminSurface.tsx`: Mounted the admin proxy auth control above the admin subsections.
- `src/services/hermes/adminProxyAdapter.test.ts`: Added focused coverage for no-header local dev, configured header send, no raw token logs/state/storage, and honest unsupported/unavailable errors.
- `AGENTS.md`: Updated Phase 6 status, blockers, and latest verification.
- `OVERVIEW.md`: Updated current status, changelog, Phase 6 notes, decisions, and latest verification.
- `shared/biscuit-admin-proxy-auth-hook-report.md`: This report.

## Behavior

- No token configured: admin proxy requests send no `X-Mission-Control-Key` header, preserving local development when `MISSION_CONTROL_PROXY_AUTH_MODE` is unset.
- Operator token configured: admin proxy requests attach `X-Mission-Control-Key` from an in-memory module variable only.
- Token lifecycle: the token is cleared on page reload and is never written to `localStorage`, `sessionStorage`, docs, or source constants.
- UI handling: the password field is cleared after apply, and the rendered auth status never includes the raw token.
- Legacy fallback: `window.__SORA_ADMIN_PROXY_KEY__` remains only as a deprecated localhost operator fallback. It is not the recommended path and should not be used for built-asset secret embedding.
- Unsupported actions and unavailable backend capability remain honest; no model-admin backend support or new admin capabilities were added.

## Verification Output

Focused auth tests:

```text
npm run test -- src/services/hermes/adminProxyAdapter.test.ts src/components/admin/UnifiedAdminSurface.test.tsx --run
Test Files  2 passed (2)
Tests       5 passed (5)
```

Required final verification:

```text
npm run lint
tsc --noEmit clean
```

```text
npm test -- --run
Test Files  37 passed (37)
Tests       636 passed (636)
```

```text
npm run build
tsc -b && vite build completed
Existing Vite warning remains: Some chunks are larger than 500 kB after minification.
```

## Blockers

- Model-admin backend binding remains blocked on a verified noninteractive Hermes model-list/capability endpoint.
- Unsupported Key/MCP/CWS mutations remain unavailable until Hermes exposes contract-safe backend semantics.
- Production deployments still need operator-owned sidecar secret distribution, LAN/firewall policy, and process supervision. The browser hook only provides a session-only way to attach the token after the operator has it.

## Next Slice

Add a small unauthenticated/unauthorized state affordance if operators frequently hit `401` from required-mode sidecars, while keeping the token session-only and avoiding any persistent browser storage.
