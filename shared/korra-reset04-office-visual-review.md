# Korra Reset 04 — Office Visual Review

Date: 2026-06-22
Card: `smc-reset-04-biscuit-office-fix`
Reviewer: Korra

## Verdict

ACCEPT WITH MINOR NOTES

The post-fix office panel is visually acceptable for reset acceptance. The major chroma-key green-screen fill visible in the baseline is gone, the office reads as a cohesive rendered idle scene, and the full Kanban shell proof shows the repaired office panel fitting correctly inside the right rail.

## Evidence reviewed

Inputs inspected from `shared/`:
- `reset04-office-panel-baseline.png`
- `e2e-chromium-desktop-kanban-office-panel-proof.png`
- `e2e-chromium-desktop-kanban-shell-proof.png`
- `biscuit-reset04-office-fix-report.md`

Asset gate re-run from the project root:

```text
> sora-missioncontrol@0.1.0 check:office-assets
> python3 scripts/check_office_atlases.py

OFFICE ATLAS CHECK PASSED
Atlas dir: public/assets/atlases
Frames scanned: 176
Opaque chroma pixels found: 0
```

Screenshot-derived green-pixel comparison:

| Metric | Baseline office proof | Post-fix office proof | Judgment |
|---|---:|---:|---|
| Pure chroma pixels `#00ff00` | 1,524 | 0 | fixed |
| Near-chroma pixels `g>=220,r<=40,b<=40` | 52,825 / 29.87% | 2,910 / 1.65% | major fill removed |
| Bright-green mask pixels | 56,758 / 32.09% | 6,960 / 3.94% | residual but non-blocking |
| Largest near-chroma connected component | 49,267 px, broad panel fill | 68 px, thin edge/sprite fragments | no large corruption remains |

The full shell proof contains the same office-region result: no pure chroma pixels and no large contiguous green fill in the right-rail office canvas.

## Visual notes

- The previous broad green-screen corruption is no longer present.
- There are still small bright/near-chroma green flecks and thin edge fragments around some office objects/agents when isolated by pixel mask. These are minor matte/anti-alias remnants, not a full-panel rendering failure.
- I do not consider the remaining edge artifacts a visual blocker for reset acceptance because they are scattered, small, and do not dominate the composition.

## Recommended follow-up, not required for acceptance

If the team wants an extra polish pass later, target the atlas repair/sanitizer to also clean near-chroma matte fringe pixels in `public/assets/atlases/agents.webp`, `furniture-0.webp`, `furniture-1.webp`, and `fx.webp` rather than only exact opaque pure-chroma pixels. Keep that as a narrow asset-polish task, not a blocker for this card.

## Code changes

None made by Korra during this review.
