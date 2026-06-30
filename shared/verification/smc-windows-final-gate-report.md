# SMC Windows Final Gate Report

Date: 2026-06-30
Verifier: Sora
Host: WIN11-CECE (Windows VM, 192.168.10.10)
Browser: Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`)
Target: `https://192.168.10.5:3443`

## Artifacts

- `shared/verification/windows-final-gate-20260630b/team.png` — 187,328 bytes
- `shared/verification/windows-final-gate-20260630b/kanban.png` — 154,354 bytes
- `shared/verification/windows-final-gate-20260630b/office.png` — 126,304 bytes
- `shared/verification/windows-final-gate-20260630b/team.html` — contains `index-k2GobxlW.js` and `HERMES`

## Screenshot inspection

### `/team`

Verdict: PASS

The Windows Chrome screenshot renders the SMC Team surface: left navigation, top attention panel, agent cards, Sora conductor panel, and status/footer elements are visible. It is not blank and shows no fatal browser/CSP/Pixi error. Layout and readability are acceptable for final Windows visual proof.

### `/kanban`

Verdict: PASS WITH EXPECTED OFFLINE/AUTH STATE

The Windows Chrome screenshot renders the Kanban surface: board controls, tenant/assignee filters, offline REST/auth indicators, empty task lanes, and right-side office panel are visible. The offline/auth state is explicit (`Kanban REST: offline`, `unauthenticated`, `0 tasks`) and is not a blank failure. No fatal UI error is visible.

### `/office`

Verdict: PASS

The Windows Chrome screenshot renders the Office route with the central Sora conductor office panel and zone tabs. It is not a blank/fatal CSP or Pixi crash state. No visible fatal error is present. Layout/readability are acceptable for final Windows proof.

## Caveats

The first Windows PowerShell summary script had a reporting bug and the DOM dump did not complete for Kanban/Office, but the actual Chrome screenshot artifacts are non-empty and visually inspected. This report uses the screenshots as the Windows acceptance evidence.

## Final Windows Gate

PASS for Windows VM visual rendering of `/team`, `/kanban`, and `/office` against `https://192.168.10.5:3443`.
