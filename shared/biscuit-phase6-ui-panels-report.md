# Biscuit Phase 6 UI Panels Report — CWS Admin Surface + Shared Confirmation

Owner: Biscuit / Automation & Coding
Date: 2026-06-21
Scope: Phase 6 admin controls — CWS UI panels (Cron, Webhook, Skills), shared RiskConfirmDialog, UnifiedAdminSurface integration, and safety tests.

## Summary

Completed the UI layer of the CWS admin surface: three admin panels (Cron, Webhook, Skills) wired to cwsAdminStore, a shared RiskConfirmDialog with tier-based severity and typed-phrase gates, and integration into the existing admin surface. 43 new tests prove unavailable states, redaction, confirmation gates, tier mapping, and cross-domain isolation.

## What was done

### 1. Created shared RiskConfirmDialog (`src/components/admin/RiskConfirmDialog.tsx`)

Consolidates the two prior ConfirmDialog variants:
- `components/admin/ConfirmDialog.tsx` (open/title/message/danger props)
- `components/common/ConfirmDialog.tsx` (ConfirmationRequest from admin.ts)

The RiskConfirmDialog supports the CWS action tier system:
- **safe**: should not render (no confirmation needed)
- **risk**: amber accent, standard confirm/cancel
- **danger**: red accent, optional typed-phrase gate (user must type the entity name/id to enable the Confirm button)

Key features:
- Escape key cancels
- Focus starts on Cancel (prevents accidental Enter confirmation)
- Typed-phrase gate with case-insensitive matching
- Visual tier badge in header ("RISK" / "DANGER")
- Backdrop click cancels

### 2. Created CronPanel (`src/components/admin/CronPanel.tsx`)

Cron job management surface wired to cwsAdminStore:
- List view with schedule, status badges (Active/Paused/Disabled/Error), last/next run, truncated prompt preview
- Pause/Resume: risk-tier confirmation via RiskConfirmDialog
- Run now: safe action, no confirmation
- Remove: danger-tier confirmation with typed-phrase gate (must type job ID)
- Create: form with name/schedule/prompt/script/skills/model → one-time SecretReveal for fullPrompt/fullScript
- Unavailable banner when no adapter bound (no mock data)
- No raw secrets in list view; promptPreview is always truncated

### 3. Created WebhookPanel (`src/components/admin/WebhookPanel.tsx`)

Webhook management surface wired to cwsAdminStore:
- List view with event badge, callback URL, masked secret, status
- Remove: danger-tier confirmation with typed-phrase gate
- Create: form with name/event/callbackUrl/secret → one-time SecretReveal for raw secret and callback URL
- Unavailable banner when no adapter bound
- MaskedField displays secret fingerprint + "configured" indicator; never the raw value

### 4. Created SkillsPanel (`src/components/admin/SkillsPanel.tsx`)

Skills management surface wired to cwsAdminStore:
- List view with source badge (builtin/user/plugin/unknown), enabled/disabled status, sensitive access warning
- Enable/Disable: risk-tier confirmation (sensitive skills get extra warning text)
- No create/delete: skills are managed externally via Hermes CLI/config
- Unavailable banner when no adapter bound
- SensitiveBadge (⚠ Sensitive) for skills with sensitive toolset access

### 5. Created CwsAdminPanel (`src/components/admin/CwsAdminPanel.tsx`)

Tabbed container for Cron/Webhooks/Skills, matching KeyMcpAdminPanel structure:
- Three tabs: Cron, Webhooks, Skills
- "NO ADAPTER BOUND" banner when no CWS adapter is set (instead of mock data)
- Tab counts only shown when adapter is bound
- Each tab renders its respective panel

### 6. Updated UnifiedAdminSurface

Added "Cron & Webhooks" tab to the top-level admin section tabs:
- Models | Keys & MCP | Cron & Webhooks
- CWS tab renders CwsAdminPanel
- No settings-grid regression: same tabbed structure as before, just with one additional tab

### 7. Created comprehensive test suite (`src/components/admin/CwsPanels.test.ts`)

43 tests across 7 describe blocks:

1. **Unavailable state when no adapter bound** (7 tests)
   - hasCwsAdapter returns false
   - Store starts empty (no mock seed data)
   - Store starts with missing provenance
   - loadCronJobs/Webhooks/Skills set lastError when no adapter
   - Action execution fails gracefully when no adapter

2. **Redaction and no raw secrets** (8 tests)
   - Cron promptPreview must be truncated
   - Webhook maskedSecret must not look like raw secret
   - Webhook callbackUrl with unmasked credentials rejected
   - JSON.stringify contains no raw secrets
   - One-time createdCron fields stripped before persisting
   - One-time createdWebhook fields stripped before persisting

3. **Confirmation gate behavior** (11 tests)
   - Risk actions (cron.pause, cron.resume, skill.enable, skill.disable) queue pending with tier=risk
   - Danger actions (cron.remove, webhook.remove) queue pending with tier=danger + typedPhrase
   - Safe actions (cron.run) execute immediately
   - Cancel removes without executing
   - Confirm executes the action

4. **RiskConfirmDialog tier mapping** (6 tests)
   - Safe/risk/danger tier classification
   - Confirmation requirement matches tier
   - Typed phrase only for danger

5. **Confirmation summary: no secrets in text** (6 tests)
   - Summaries name entities but never include secrets
   - Sensitive access warnings included when applicable
   - Cron/webhook create summaries exclude prompt text and callback URLs

6. **Independent provenance per subsection** (3 tests)
   - Ingesting cron jobs upgrades only cron provenance
   - Ingesting webhooks upgrades only webhook provenance
   - Ingesting skills upgrades only skills provenance

7. **Cross-domain action isolation** (3 tests)
   - Pending actions from different domains coexist
   - Different domains get different tiers
   - cancelAllCwsPending clears all domains

## Files changed

| File | Change |
|---|---|
| `src/components/admin/RiskConfirmDialog.tsx` | New — shared tier-based confirmation dialog (220 lines) |
| `src/components/admin/CronPanel.tsx` | New — Cron job admin panel (430 lines) |
| `src/components/admin/WebhookPanel.tsx` | New — Webhook admin panel (410 lines) |
| `src/components/admin/SkillsPanel.tsx` | New — Skills admin panel (260 lines) |
| `src/components/admin/CwsAdminPanel.tsx` | New — CWS tabbed container (110 lines) |
| `src/components/admin/UnifiedAdminSurface.tsx` | Updated — added "Cron & Webhooks" tab |
| `src/components/admin/CwsPanels.test.ts` | New — 43 tests (440 lines) |

## Verification

```
npm run test  →  545 passed (26 test files)
npm run build →  ✓ built in 7.16s
npx tsc --noEmit (via build) →  0 errors in src/
```

Test count delta: 502 → 545 (+43 new tests from CwsPanels.test.ts)

## Key design decisions

1. **RiskConfirmDialog is additive, not replacing yet.** The existing `ConfirmDialog` components in `admin/` and `common/` still work for Keys/MCP and Models panels. CWS panels use the new `RiskConfirmDialog`. Full replacement of the old ConfirmDialogs is a separate refactoring step to avoid regressions.

2. **Unavailable banner instead of mock data.** When no CWS adapter is bound, panels render a clear "unavailable" message explaining why, following the same pattern as the ops panel's unknown state rendering. The KeyMcpAdminPanel's "MOCK SEED DATA" banner is a pre-existing pattern that should be replaced when Cloud binds real adapters.

3. **Typed-phrase gate uses entity ID, not name.** For danger-tier actions (cron.remove, webhook.remove), the user must type the entity ID (e.g. "cron-1") to confirm. This is more precise than requiring the human-readable name, which might not be unique.

4. **No settings-grid regression.** The UnifiedAdminSurface now has three top-level tabs instead of two, but the structure is identical (tabbed navigation, full-height content area). No grid layout was introduced or removed.

5. **Skill enable/disable is risk-tier, not danger.** Per the CWS action tier definitions, skill.enable and skill.disable are risk-tier (require confirmation but no typed phrase). Only cron.remove and webhook.remove are danger-tier (typed phrase required).

## Blockers remaining

1. **Real CWS adapters from Cloud.** The store has the adapter seam (`CwsAdminAdapter`) but no bound backend. Cloud must provide implementations that call the Hermes CLI/API. Until then, panels show "unavailable".
2. **Key/MCP mock data.** Still using mock seed data; needs real adapter from Cloud.
3. **Full ConfirmDialog consolidation.** The old ConfirmDialog components in `admin/` and `common/` still exist alongside the new RiskConfirmDialog. Full migration is safe to defer until all panels use the same store pattern.
4. **Skills detail view.** Currently skills only have enable/disable actions. A detail/expansion view showing skill content would require Cloud's adapter to provide it.
