# Truth Vocabulary Audit — Phase G Visual Freeze

**Audit Date:** 2026-06-29  
**Project:** Sora-MissionControl v2  
**Scope:** All `.ts` and `.tsx` files under `src/`  
**Method:** Read-only static analysis of all user-facing text strings, store defaults, type definitions, and status labels against the approved truth vocabulary.

---

## 1. Summary

| Metric | Count |
|--------|-------|
| Total files in `src/` (`.ts`, `.tsx`) | ~100+ |
| Critical violations | 6 |
| Major violations | 14 |
| Minor violations | 5 |
| **Total violations** | **25** |
| Files with correct patterns | 15+ |

**Overall compliance rate:** ~75%. The project has significant truth vocabulary awareness (correct `unavailable`/`unknown`/`verified` usage in many places), but the `isDemo` / `mock/demo` pattern is deeply embedded across the store layer, type definitions, page components, and the truth vocabulary utility itself. This is the single largest category of violations.

---

## 2. Violations

### 2.1 Critical — Shipped text that misleads the user about system state

#### V1 — `src/utils/truthVocabulary.ts:36-37`
- **Offending text:** `case 'placeholder': return 'mock/demo';`
- **What it should be:** `case 'placeholder': return 'unavailable';` (or remove the mapping entirely — placeholder confidence should become `unknown` per the approved terms)
- **Severity:** CRITICAL
- **Rationale:** The truth vocabulary utility is the single source of truth for mapping internal provenance to user-facing labels. It currently maps `placeholder` confidence to `'mock/demo'` — both terms explicitly off-limits. The comment on line 7 also incorrectly lists `mock/demo` as an approved term.

#### V2 — `src/pages/Team.tsx:106`
- **Offending text:** `[mock/demo]` (rendered as `team-page__demo-badge`)
- **What it should be:** `[unavailable]` or `[no verified source]`
- **Severity:** CRITICAL
- **Rationale:** User-facing badge on the Team page directly labels the system state as "mock/demo". Per the rules, "mock" and "demo" should never suggest fake data is intentional.

#### V3 — `src/components/shell/ChatPanel.tsx:239`
- **Offending text:** `mock/demo` (rendered as a mono label span)
- **What it should be:** `unavailable` or `no verified transport`
- **Severity:** CRITICAL
- **Rationale:** When the demo chat transport is active, the UI shows a "mock/demo" label. Title attribute on line 229 says "Demo mock transport is active — replies are canned, not from a live agent" — also uses both forbidden terms.

#### V4 — `src/components/kanban/ProjectControlSurface.tsx:128`
- **Offending text:** `'Open chat (mock/demo)'`
- **What it should be:** `'Open chat (unavailable)'` or `'Open chat (no verified transport)'`
- **Severity:** CRITICAL
- **Rationale:** The chat button label includes "mock/demo" when the demo mode is active.

#### V5 — `src/components/kanban/HermesKanbanPage.tsx:45`
- **Offending text:** `'Authentication required to load the Hermes Kanban API through the Mission Control proxy. No demo board is shown.'`
- **What it should be:** `'Authentication required to load the Hermes Kanban API through the Mission Control proxy. Board data is unavailable.'`
- **Severity:** CRITICAL
- **Rationale:** User-facing status message says "No demo board is shown" — implies there is a demo board concept.

#### V6 — `src/components/kanban/HermesKanbanPage.tsx:289`
- **Offending text:** `'The office mirrors the live/shared Kanban stores. When live data is unavailable, it stays in honest idle states instead of switching to demo mode.'`
- **What it should be:** `'The office mirrors the live/shared Kanban stores. When live data is unavailable, it stays in honest idle states.'`
- **Severity:** CRITICAL
- **Rationale:** Help text references "demo mode" as if it's an intentional alternative.

---

### 2.2 Major — Text that undermines truth vocabulary

#### V7–V9 — Dashboard pages using `isDemo` semantics
All three use `isDemo` to describe a data-unavailability state, conflating "source missing" with "demo mode":

| File | Line | Current Pattern | Should Use |
|------|------|----------------|------------|
| `src/pages/Calendar.tsx` | 19–20 | `calendarState.isDemo ? 'No calendar data available — calendar backend is not connected.'` | Should check `calendarState.freshness === 'missing'` and render "Calendar unavailable — no data source connected." |
| `src/pages/Activity.tsx` | 19–20 | `activityState.isDemo ? 'No activity data available — calendar and event sources are not yet connected.'` | Should check `activityState.freshness === 'missing'` and render "Activity feed unavailable — no data source connected." |
| `src/pages/Projects.tsx` | 19–20 | `projectsState.isDemo ? 'No project data available — Kanban board data source is not connected.'` | Should check `projectsState.freshness === 'missing'` and render "Projects unavailable — no data source connected." |

- **Severity:** MAJOR (all three)
- **Rationale:** The `isDemo` boolean is used in JSX conditionals alongside CSS classes like `dashboard-placeholder-badge`. The empty state text itself doesn't say "demo" but the gating mechanism uses the wrong concept. Per the empty-state rules: "Source never connected → 'unavailable'".

#### V10 — `src/components/admin/AdminPanel.tsx:24`
- **Offending text:** `error: { label: 'Error', color: 'var(--accent-red)', bg: 'var(--accent-red-glow)' }`
- **What it should be:** `'Misconfigured'` or `'Failing'` (specific error description)
- **Severity:** MAJOR
- **Rationale:** `STATUS_META` for model admin uses generic "Error" as a status label. Per rules: "use specific error descriptions instead of generic 'Error'."

#### V11 — `src/components/admin/WebhookPanel.tsx:414`
- **Offending text:** `Error` (rendered in `WebhookStatusBadge` when `error` prop is truthy)
- **What it should be:** The specific error message from the store, or "Failing"
- **Severity:** MAJOR
- **Rationale:** Generic "Error" label in a status badge. The component already has access to the error string but renders a generic label instead.

#### V12 — `src/components/admin/CronPanel.tsx:430`
- **Offending text:** `Error` (rendered in `CronStatusBadge` when `error` prop is truthy)
- **What it should be:** The specific error message, or "Failing"
- **Severity:** MAJOR
- **Rationale:** Same as V11 — generic "Error" label.

#### V13–V16 — Type definitions with `isDemo` field

| File | Line | JSDoc text |
|------|------|-----------|
| `src/types/calendar.ts` | 49 | `/** Whether running in mock/demo mode (no real data source). */` |
| `src/types/activity.ts` | 52 | `/** Whether running in mock/demo mode (no real data source). */` |
| `src/types/projects.ts` | 36 | `/** Whether running in mock/demo mode (no real data source). */` |
| `src/types/team.ts` | 137 | `/** Whether running in mock/demo mode */` |

- **Severity:** MAJOR (all four)
- **Rationale:** The `isDemo` field name and its JSDoc perpetuate the "demo" concept at the type level. Should be renamed to `isUnavailable` or eliminated in favor of checking `freshness === 'missing'` directly.

#### V17–V20 — Store implementations mapping `missing` → `isDemo`

| File | Line | Code |
|------|------|------|
| `src/state/calendarStore.ts` | 80 | `isDemo: freshness === 'missing'` |
| `src/state/activityStore.ts` | 113 | `isDemo: boardFreshness === 'missing'` |
| `src/state/projectsStore.ts` | 140 | `isDemo: boardFreshness === 'missing'` |
| `src/state/teamStore.ts` | 117, 264 | `isDemo = provenanceFreshness === 'missing'` |

- **Severity:** MAJOR (all four)
- **Rationale:** These stores conflate "data missing" with "demo mode". The `isDemo` boolean is then surfaced to UI components which use it for text branching. This should use truth vocabulary freshness directly.

---

### 2.3 Minor — Edge cases and internal references

#### V21 — `src/types/provenance.ts:25`
- **Offending text:** `| 'mock' // Dev/test MSW mock data — MUST surface as demo, never as live`
- **Severity:** MINOR
- **Rationale:** The `DataSource` union includes `'mock'` as a valid data source. While internal, the comment perpetuates "demo" language. The source should perhaps be `'local-runtime'` with a note instead.

#### V22 — `src/types/provenance.ts:48`
- **Offending text:** `| 'placeholder' // Explicit mock/demo stand-in until real data is wired`
- **Severity:** MINOR
- **Rationale:** The `Confidence` union includes `'placeholder'` as a valid confidence level. This is the internal counterpart to the truth vocabulary mapping issue.

#### V23 — `src/office/demoData.ts` (entire file)
- **Offending text:** `DEMO_BOARD`, `DEMO_EVENT_SCRIPT`, comments using "demo mode", "mock board"
- **Severity:** MINOR
- **Rationale:** This file provides demo data for the standalone office. While it's internal (not user-facing text), its naming conventions influence the rest of the codebase. The file name itself uses "demo" and the exported constants start with `DEMO_`.

#### V24 — `src/modules/chat/chatBackbone.ts:43,130,150,172,183`
- **Offending text:** `demoMode` variable, `isDemoMode()` function, "demo mock" in comments
- **Severity:** MINOR
- **Rationale:** Internal variable/function naming uses "demo" terminology. While the function is consumed by UI components (V2, V3), the naming itself is an internal concern.

#### V25 — `src/modules/chat/demoChatTransport.ts` (entire file)
- **Offending text:** File name, `DEMO_MODE`, `DEMO_REPLIES`, "[demo]" prefix on reply strings
- **Severity:** MINOR
- **Rationale:** This is the explicit mock transport. The reply strings (e.g., `'[demo] Biscuit here. Demo transport is echoing...'`) are user-facing and contain both "[demo]" prefix and "demo" in the message body.

---

## 3. Correct Patterns (Positive Reinforcement)

The following examples demonstrate correct truth vocabulary usage and should serve as models for the fixes:

### 3.1 Unavailable/empty state handling

**`src/pages/Decisions.tsx:14-18`** — Gold standard:
```tsx
<p>
  Decision tracking is not yet available. This page will surface
  agent decisions, chat-derived action items, and approval logs
  once the design spec and backend integration land.
</p>
<div className="dashboard-placeholder-badge mono">[unavailable]</div>
```

**`src/components/admin/WebhookPanel.tsx:365`** — Good pattern:
```tsx
{section} admin is unavailable
```
(Rendered by `UnavailableBanner` in both CronPanel, WebhookPanel, and SkillsPanel.)

**`src/components/admin/AdminPanel.tsx:101`** — Good:
```
MODEL ADAPTER UNAVAILABLE · controls are disabled until Cloud binds a verified backend
```

**`src/components/admin/KeyMcpAdminPanel.tsx:65`** — Good:
```
NO ADAPTER BOUND · connect a Hermes backend to manage API keys and MCP servers
```

### 3.2 Correct status vocabulary in types

**`src/types/connection.ts:43-48`** — Canonical transport states:
```ts
export type TransportState =
  | 'connected'
  | 'degraded'
  | 'offline'
  | 'unauthorized'
  | 'unknown';
```

**`src/types/team.ts:133`** — System health uses truth vocabulary:
```ts
systemHealth: 'verified' | 'degraded' | 'unavailable' | 'unknown';
```

### 3.3 Correct UI rendering of truth vocabulary

**`src/components/shell/OpsPanel.tsx:246,323`** — Uses "unknown" honestly:
```
Provider quota data is unknown (no verified live rate-limit source yet).
Usage unknown
```

**`src/pages/Team.tsx:20-25`** — Maps truth vocabulary to colors:
```ts
function healthColor(health: string): string {
  switch (health) {
    case 'verified': return 'var(--crt-green, #00ff66)';
    case 'degraded': return 'var(--crt-amber, #ffb000)';
    case 'unavailable': return 'var(--crt-red, #ff4444)';
    default: return 'var(--text-muted)';
  }
}
```

**`src/components/team/SoraConductorStation.tsx:27-33`** — Same correct pattern.

**`src/components/team/LeadCard.tsx:44-48`** — `truthFreshnessLabel()` correctly maps `'fresh'` → `'live'`, `'missing'` → `'unknown'`.

### 3.4 Admin empty state messages

**`src/components/admin/McpPanel.tsx:78`**:
```
No adapter bound — MCP server management unavailable
```

**`src/components/admin/KeysPanel.tsx:85`**:
```
No adapter bound — key management unavailable
```

---

## 4. Recommendations

### 4.1 Root cause: The `isDemo` anti-pattern

The single largest issue is the `isDemo` boolean propagated through the store/type/UI layers. This conflates two distinct concepts:
1. **Data unavailability** (source not connected) → should use `freshness === 'missing'` → render "unavailable"
2. **Intentional demonstration mode** (explicit demo/mock) → should not exist in production UI

**Recommended fix:** Eliminate the `isDemo` field from all store states and type interfaces. Components should branch on `freshness` (and possibly `confidence`) directly:

```
freshness === 'missing'  → "unavailable"  
freshness === 'stale'    → "stale"  
confidence === 'unknown' → "unknown"  
```

### 4.2 Fix the truth vocabulary utility

`src/utils/truthVocabulary.ts` needs correction:
- Line 7 doc comment: Remove `mock/demo` from the approved terms list
- Lines 36–37: Change `case 'placeholder': return 'mock/demo';` to `case 'placeholder': return 'unknown';` (or remove the case entirely and let it fall through to `default: return 'unknown'`)

### 4.3 Replace generic "Error" labels

In `AdminPanel.tsx:24` (STATUS_META), `WebhookPanel.tsx:414` (WebhookStatusBadge), and `CronPanel.tsx:430` (CronStatusBadge):
- Replace `'Error'` with specific labels like `'Failing'`, `'Misconfigured'`, or render the actual error detail
- The admin model status `'error'` could become `'failing'` per truth vocabulary (use specific descriptions)

### 4.4 Rename demo-related files and constants

- `src/office/demoData.ts` → Rename to `officeFallbackData.ts` or `scriptedOfficeData.ts`
- `src/modules/chat/demoChatTransport.ts` → Rename to `fallbackChatTransport.ts` or `scriptedChatTransport.ts`
- `DEMO_BOARD` → `FALLBACK_BOARD`
- `DEMO_EVENT_SCRIPT` → `SCRIPTED_EVENT_SCRIPT`
- `DEMO_REPLIES` → `SCRIPTED_REPLIES` or `FALLBACK_REPLIES`
- The `[demo]` prefix in reply strings should become `[scripted]` or be removed entirely

### 4.5 Clarify the `DataSource.mock` provenance value

`src/types/provenance.ts:25` includes `'mock'` as a DataSource. Consider whether this should be:
- Removed (use `'local-runtime'` with a `note` explaining it's scripted)
- Renamed to `'scripted'` or `'local-fallback'`

### 4.6 Ambiguous areas needing project decision

1. **CSS classes** (`dashboard-placeholder-card`, `dashboard-placeholder-eyebrow`): These use "placeholder" as a component styling concept, not a data state. The rules permit "placeholder" for "literal placeholder UI components." These CSS classes are for styling page shells, not labeling data state — they are likely acceptable.

2. **`PlaceholderPage` component** (`ShellLayout.tsx:95`): The component name uses "Placeholder" as a UI pattern name (a page that holds space until its feature pass lands). The text says "this page remains a truthful placeholder." This may be acceptable under the "literal placeholder UI components" exception.

3. **The `chat-transport` source health**: Currently the backbone reports `'degraded'` when the demo transport is active (line 111 of chatBackbone.ts). This is semantically correct under the current rules — degraded means "partially working, errors below threshold."

---

## 5. Files Not Audited (excluded by scope)

The following file categories were excluded:
- Test files (`*.test.ts`, `*.test.tsx`) — not user-facing
- Build/config files outside `src/`
- CSS/SCSS files — no user-facing text strings
- `node_modules/`, `dist/`, `shared/`

---

*End of audit report.*
