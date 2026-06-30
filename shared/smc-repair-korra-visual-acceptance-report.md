# SMC Repair — Korra Visual/UX Acceptance Report

Date (UTC): 2026-06-30
Task: `t_9ab51cfb` — SMC repair: Korra visual/UX acceptance gate
Reviewer: Korra
Workdir: `/home/wliob/llm-brain/Projects/Active/Sora-MissionControl`

## Verdict

REJECT

The current repair evidence is not visually/UX acceptable yet. The strongest blockers are:

1. Windows `/kanban` evidence still shows `Office canvas offline` with a PixiJS unsafe-eval/WebGL init failure and `canvasCount: 0`.
2. Current Linux Playwright proof fails on desktop and mobile Kanban because the primary Kanban status note renders raw `unauthenticated` instead of user-facing truth vocabulary.
3. The office state in the Windows evidence shows all agents in `break-room standby` while attention items exist elsewhere, so active/attention mapping is not visibly proven.
4. The final lane set is incomplete: Windows and Linux screenshot lanes do not both show a passing final Kanban/Office/Admin state.

Per the card constraint, office canvas offline or missing/honestly-unavailable attention mapping is a hard REJECT.

## Acceptance checklist

### Global truth vocabulary

Required:
- User-facing state copy must say `live`, `unknown`, `unavailable`, `locked`, `offline`, `unauthorized`, `degraded`, or `stale` as appropriate.
- Do not present fake/demo/mock activity as success.
- Do not surface raw internal labels as the main user instruction, especially bare `unauthenticated`, `missing`, `placeholder`, `mock`, or `demo`.
- Any green/live/verified cue must have a verified source behind it.
- Unavailable/locked/offline states must keep action controls disabled or clearly scoped.

Current result:
- REJECT: Linux Kanban proof shows raw `unauthenticated` as the first status note.
- REJECT: Existing source/static audit still found user-facing `demo mode` / `No demo board` copy in Kanban and chat paths; this should be removed or limited to internal test naming.

### Team landing

Required:
- `/team` is the default landing and shows Sora conductor station plus all leads.
- Top attention items are visible above ordinary backlog and correspond to verified current work, blockers, or honest unavailable system states.
- Agent cards use consistent status badges, freshness/confidence labels, and profile accents without inventing activity.
- Desktop and mobile layouts must avoid horizontal page overflow and maintain readable hierarchy.

Current result:
- PARTIAL: Local Playwright navigation/team checks passed in both desktop and mobile lanes.
- BLOCKER: Final visual acceptance still needs a screenshot lane showing attention items mapped to the same truth model as Kanban/Office.

### Kanban / Project Control

Required:
- `/kanban` must show board status in human truth vocabulary: `Authentication required`, `Live Hermes Kanban snapshot`, `Kanban REST bridge unavailable`, `Waiting for verified snapshot`, `locked`, or equivalent.
- No raw backend/auth string should be the leading status message.
- Lanes, filters, top attention state, and office panel must remain reachable on desktop and mobile.
- If board data is unavailable, the page must state that clearly and not show a fake empty board as success.

Current result:
- REJECT: Linux Playwright desktop and mobile both failed because `.kanban-status-note` was `unauthenticated`.
- REJECT: Windows evidence showed the Kanban API/admin calls blocked by 403 on plain HTTP, which is truthful for locked transport, but that HTTP lane cannot count as final accepted app UX unless an HTTPS/secure lane also passes.

### Office / immersive screen

Required:
- Office is a real immersive screen/panel, not merely text presence.
- For acceptance, final screenshots must show either a live rendered canvas on Windows and Linux or a design-approved non-canvas fallback only when the product requirement is explicitly changed. This card says to reject if the office canvas remains offline.
- Agent positions/statuses must reflect live task/attention state when verified data exists; when unavailable, copy must explicitly say attention mapping is unavailable instead of implying calm standby.
- Canvas failures must not expose developer-only crash copy as the primary experience.

Current result:
- REJECT: Windows Playwright JSON reports `canvasCount: 0` and `Office canvas offline` with `Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support`.
- REJECT: Windows office text shows all agents in break-room standby while top attention items exist elsewhere; active/attention mapping is not accepted.
- PASS (limited): Office atlas asset gate passed locally: 176 frames scanned, 0 opaque chroma pixels found.
- PASS (limited): Pixel checks on available Linux/Windows proof images found 0 pure/near chroma-key pixels in the reviewed final/failure screenshots. This only clears the old green-atlas corruption, not the current offline-canvas blocker.

### Admin / locked states

Required:
- Plain HTTP sensitive routes must render locked/unavailable messaging and must not encourage entering credentials/tokens.
- HTTPS/secure route should show 401/auth-required states without exposing secrets.
- Admin actions without verified backends remain unavailable/disabled; destructive controls require confirmation.
- Locked transport and admin auth are different states and should be visually distinct.

Current result:
- PARTIAL: Windows HTTP evidence correctly warns: `Sensitive Mission Control routes are unavailable on this plain HTTP listener...` and shows 403 responses.
- BLOCKER: Final acceptance still needs a passing secure/HTTPS visual lane showing the app usable outside the plain-HTTP lock state.

### Desktop + mobile

Required:
- Final proof must include desktop and mobile screenshots on Linux.
- Final proof must include Windows screenshots, preferably Chromium/Edge, for the same acceptance surfaces.
- Mobile must have no horizontal overflow, reachable navigation, and usable 44px-class touch targets for important controls.

Current result:
- REJECT: Linux e2e produced desktop/mobile failure screenshots, not passing final proof.
- REJECT: Windows lane exists, but it captures an offline office and locked/plain-HTTP state.

## Evidence reviewed

### Windows lane

- `shared/verification/smc-windows-playwright-kanban.json`
  - URL: `http://192.168.10.5:3187/kanban`
  - `canvasCount: 0`
  - Office text includes `Office canvas offline` and PixiJS unsafe-eval failure.
  - Admin/Kanban routes returned 403 on plain HTTP.
  - Office agents all show break-room standby.
- `shared/verification/smc-windows-playwright-kanban.png`
- `shared/verification/smc-windows-edge-kanban.png`
- `shared/verification/smc-live-kanban-current-evidence.png`

Windows verdict: REJECT for final acceptance. The lane is useful evidence of locked/plain-HTTP behavior, but it does not prove the final product because the office canvas is offline.

### Linux lane / local Playwright run

Commands run from the project root:

```text
npm run check:office-assets
```

Result:

```text
OFFICE ATLAS CHECK PASSED
Atlas dir: public/assets/atlases
Frames scanned: 176
Opaque chroma pixels found: 0
```

Command:

```text
npm run test:e2e -- --project=chromium-desktop --project=chromium-mobile
```

Result:

```text
109 passed
5 skipped
4 failed
```

Failures reviewed:

- `shared/playwright-results/mission-control-serves-the-22c57-with-honest-non-demo-states-chromium-desktop/test-failed-1.png`
- `shared/playwright-results/mission-control-serves-the-22c57-with-honest-non-demo-states-chromium-desktop/error-context.md`
  - Fails because `.kanban-status-note` received `unauthenticated` instead of the accepted truth-copy pattern.
- `shared/playwright-results/mission-control-mobile-kan-4a34f-ut-horizontal-page-overflow-chromium-mobile/test-failed-1.png`
- `shared/playwright-results/mission-control-mobile-kan-4a34f-ut-horizontal-page-overflow-chromium-mobile/error-context.md`
  - Same raw `unauthenticated` status failure on mobile.
- `shared/playwright-results/mission-control-Calendar-screen-filter-bar-is-present-chromium-desktop/test-failed-1.png`
- `shared/playwright-results/mission-control-Calendar-screen-filter-bar-is-present-chromium-desktop/error-context.md`
  - Missing `.calendar-filter-bar`; server log also emitted `ENOENT ... dist/index.html` during this run.
- `shared/playwright-results/mission-control-Calendar-screen-filter-bar-is-present-chromium-mobile/test-failed-1.png`
- `shared/playwright-results/mission-control-Calendar-screen-filter-bar-is-present-chromium-mobile/error-context.md`
  - Same missing `.calendar-filter-bar` issue on mobile.

Earlier proof artifacts reviewed but not accepted as current final proof:

- `shared/e2e-chromium-desktop-kanban-office-panel-proof.png`
- `shared/e2e-chromium-desktop-kanban-shell-proof.png`
- `shared/e2e-chromium-mobile-kanban-mobile-proof.png`
- `shared/korra-reset04-office-visual-review.md`
- `shared/biscuit-reset04-office-fix-report.md`

Those earlier artifacts support that the old green-atlas corruption was fixed, but they do not override the newer Windows offline-canvas evidence or the current failing Linux e2e run.

## Blocking UX fixes required before re-review

1. Fix Windows Office canvas initialization or change the accepted product requirement. Current Windows evidence shows `unsafe-eval` / PixiJS renderer init failure and `canvasCount: 0`; this card requires rejection while the office canvas remains offline.
2. Replace raw Kanban status `unauthenticated` with user-facing truth copy such as `Authentication required to load Hermes Kanban` or `Kanban source locked/unavailable` with the recovery action.
3. Prove attention mapping in the Office: active/blocking/review states visible on agents or a clear `attention mapping unavailable` state. Do not show all agents as calm standby while top attention items indicate risk unless the board source is explicitly unavailable.
4. Produce final Windows and Linux screenshot lanes for the same surfaces: Team, Kanban with Office panel, Office full screen, Admin/locked state, and mobile Kanban.
5. Re-run Playwright and clear the current Linux failures before asking for visual acceptance. The final run should produce passing desktop/mobile artifacts, not just failure screenshots.
6. For the primary deployed URL, use the secure/HTTPS lane for sensitive screens. Plain HTTP can remain as a locked fallback, but it cannot be the final accepted app lane.

## Polish notes after blockers

- The premium dark terminal/guild command-center direction remains right for the product.
- The repaired atlas state is visually safer than reset04: reviewed screenshots show no pure or near chroma-key green pixels in the sampled final/failure artifacts.
- Keep the HTTP lock warning, but separate it visually from ordinary offline data-source warnings so users understand transport lock vs backend unavailable.
- Calendar/Activity/Projects placeholder/unavailable surfaces should keep filter/status chrome visible where the spec expects it; this prevents empty states from looking like broken pages.
- Remove or de-emphasize user-facing `demo`/`mock` language. The approved product vocabulary is operational: unavailable, unknown, locked, offline, stale, degraded, live, verified.

## Re-review gate

Korra can re-review after Biscuit/Cloud provide:

1. Passing Linux Playwright desktop/mobile run with screenshots.
2. Passing Windows Chromium/Edge screenshot lane showing Office canvas not offline.
3. Evidence that Kanban/auth states use human truth vocabulary, not raw backend strings.
4. Evidence that Office attention/agent state is either mapped from live Kanban or explicitly marked unavailable.
