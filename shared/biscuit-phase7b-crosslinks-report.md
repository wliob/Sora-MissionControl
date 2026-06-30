# Biscuit Phase 7b report — smc-p7b-selected-agent-crosslinks

Date: 2026-06-21
Lead: Biscuit
Execution mode: Native Hermes tools/model only. No Codex, Claude Code, OpenCode, or external coding agents used.

## Scope completed

Goal was to finish selected-agent/current-work cross-links for Phase 7b by reusing shared state instead of introducing a parallel selection store.

Completed:
1. Inspected Project Control, shell, chat, and office selection/state flow.
2. Added shared `selectedOwner` state to `shellStore` alongside existing `selectedAgent`.
3. Wired Project Control owner/task selection to shared shell selection.
4. Added Project Control current-work focus panel plus cross-link actions for office, chat, and owner-task focus.
5. Added office-side current-work/chat handoff actions for the selected agent.
6. Added chat-side current-work handoff action for the active profile.
7. Kept non-canonical or unmapped owners honest: Project Control still filters current work, but office/chat routes disable with explicit copy instead of pretending the mapping exists.
8. Updated repository status docs (`OVERVIEW.md`, `AGENTS.md`).

## Key implementation notes

Shared-state approach:
- Reused `shellStore` as the cross-surface coordination layer.
- Added `selectedOwner: string | null` for current-work focus/filtering.
- Continued using `selectedAgent: AgentId | null` only for canonical Mission Control agents that can map into office/chat.

UI behavior:
- Project Control owner/task clicks now set shared current-work context.
- Project Control selected-task drawer now exposes:
  - Focus in office
  - Open chat / honest unavailable state
  - Show all tasks by owner
- Office agent panel now exposes:
  - View current work
  - Open chat / honest unavailable state
- Chat header now exposes:
  - View current work

Honest limitations preserved:
- If owner is non-canonical (for example a custom/vendor owner), Project Control still filters current work for that owner.
- Office/chat navigation stays disabled with explicit messaging when no verified canonical mapping exists.
- Chat actions stay unavailable when transport is not bound.

## Files changed

Code:
- `src/state/shellStore.ts`
- `src/components/kanban/ProjectControlSurface.tsx`
- `src/components/shell/ChatPanel.tsx`
- `src/office/components/OfficeModule.tsx`

Tests:
- `src/components/kanban/ProjectControlSurface.test.tsx`
- `src/components/shell/ChatPanel.test.tsx`
- `src/office/components/OfficeModule.test.tsx`

Docs:
- `OVERVIEW.md`
- `AGENTS.md`
- `shared/biscuit-phase7b-crosslinks-report.md`

## Verification

Verified locally in this repo:
- `npm run lint` ✅
- `npm test -- --run` ✅ (`596/596` tests passing across `32` files)
- `npm run build` ✅

Build note:
- Existing Vite large-chunk warning remains; no new build blocker introduced.

## Remaining follow-through after this card

1. Any further Kanban mutations still need explicit verified backend contracts before UI binding.
2. Non-canonical owner navigation beyond Project Control filtering should only expand if verified backend/profile mappings are introduced.
3. Phase 6 adapter completion still remains with Cloud.
