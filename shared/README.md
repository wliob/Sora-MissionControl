# Shared Workspace — Sora-MissionControl

This directory is the cross-department coordination hub. All five department
leads (Cloud, Biscuit, Korra, Lelouch, Tifa) read and write shared artifacts here.

## Conventions

- Use clear, descriptive filenames.
- Include a brief header comment or accompanying README snippet explaining
  what the artifact is and which department produced it.
- When handing off work, update the handoff log below.

## Handoff Log

| Date       | From      | To        | Artifact              | Notes |
|------------|-----------|-----------|-----------------------|-------|
| 2026-06-19 | scaffold  | all       | Project initialization | —     |
| 2026-06-21 | korra     | biscuit/cloud/sora | `korra-phase6-admin-ux.md` | Phase 6 admin UX audit; small safety/clarity edits made; Phase 6 remains partial pending real adapters and missing crons/webhooks/skills. |
| 2026-06-21 | korra     | biscuit/cloud/sora | `korra-phase7-kanban-ux.md` | Phase 7 Kanban/project-control UX acceptance criteria; docs-only pass, no code edits; Phase 7 remains not started pending Biscuit/Cloud implementation. |
| 2026-06-21 | korra     | biscuit/cloud/sora | `korra-phase8-polish-cohesion-prep.md` | Phase 8 final polish/cohesion prep checklist; not final QA because Phase 6 implementation and Phase 7 Kanban are not ready. Includes mobile/touch/reduced-motion checks, anti-fake-data visual rules, and notes no verified Korra channel-post helper was found. |
| 2026-06-21 | tifa      | sora/cloud/biscuit/korra/lelouch | `tifa-phase8-final-acceptance-risk-gates.md` | Final acceptance risk gates for Admin mutations, Kanban controls, secret handling, cost/quota unknowns, Playwright proof, build/test evidence, and Unraid rollback/observability. Current lint/test/build pass, but app is not ready to call complete until Admin/Kanban/e2e/deploy gates pass. |
| 2026-06-21 | lelouch   | all       | `lelouch-phase8-final-copy-cohesion-prep.md` | Final copy checklist, report templates, escalation wording, review-ready state definitions, and exact wording to avoid false certainty across admin/ops/kanban/deploy. Also cleaned up unverified channel names and aligned dispatch/decompose wording with Tifa/Korra gates in phase7 copy. |
