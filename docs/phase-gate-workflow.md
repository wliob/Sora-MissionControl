# Sora-MissionControl Phase Gate Workflow

**Purpose:** Run the v2 build in 8 autonomous phases with user review gates between each.

## Board Location

Open **http://192.168.0.85:9119/kanban** — filter by tenant `sora-missioncontrol-v2`.

## Phase Sequence

| # | Phase | Lead | Est. Duration |
|---|-------|------|--------------|
| A | Team Command Surface | Biscuit (+ Korra) | 1-2 sessions |
| B | Office Immersive Screen | Biscuit (+ Korra) | 2-3 sessions |
| C | Sora Conductor Station + Portrait | Korra (+ Biscuit) | 1 session |
| D | Guild Cues Visual QA Pass | Korra | 1 session |
| E | Attention Ranking Engine | Biscuit | 1-2 sessions |
| F | Activity, Projects, Chat, Calendar | Biscuit (+ Korra + Lelouch) | 2-3 sessions |
| G | Korra Visual Freeze + Acceptance | Korra | 1 session |
| H | Final Integration, Tests, Deploy | Biscuit + Cloud + Sora | 1-2 sessions |

## How It Works

### Phase states (shown on board)
```
scheduled  →  ready  →  in_progress  →  review  →  done
                                    ↓
                                blocked
```

- **scheduled** — planned, not yet started
- **ready** — approved to run (Sora will dispatch immediately)
- **in_progress** — actively being worked by the department lead
- **review** — work done, waiting for your inspection
- **blocked** — something is stuck (reason in card body)
- **done** — verified and signed off

### Your review cycle (between phases)

When a phase hits **review**:

1. **I post a summary** here in Discord: what changed, files touched, key decisions
2. **You inspect** one or more of:
   - **Live app** → open `http://192.168.0.85:9119` and look around
   - **Spec conformance** → check the card body against what you see
   - **Git diff** → `cd /home/wliob/llm-brain/Projects/Active/Sora-MissionControl && git diff`
   - **Tests** → `npm test -- --run` (I'll report results)
3. **Say one of:**
   - `"approved, next"` — moves current card to `done`, dispatches next phase
   - `"approved, hold"` — marks done but keeps next phase scheduled
   - `"fix [thing]"` — I route fix back to the lead, phase stays in review
   - `"blocked because [reason]"` — marks blocked with your reason

### Kick off the next phase

Say **"start Phase X"** or **"go for Phase A"** and I:
1. Move the card from `scheduled` → `ready`
2. Route it to the department lead via delegate_task
3. Move to `in_progress`
4. Deliver the result to you when done
5. Move to `review`

### "Everything happen itself" mode

I've set up an **auto-orchestrator cron job** that runs every 30 minutes:

```
cronjob: smc-v2-orchestrator
schedule: every 30m
```

It does:
1. Check for the first `scheduled` card in `sora-missioncontrol-v2`
2. Check that previous phase is `done`
3. If both true → move to `ready` and dispatch
4. Track completion in task events

To go fully autonomous: just say **"auto-pilot on"** and I enable the orchestrator. 
To stop: say **"auto-pilot off"** and I disable it.

### How nothing falls through gaps

**Your safety net:**
1. **Board is the source of truth** — all 8 phases visible at `/kanban`
2. **Each card has the full spec** in its body — no context lost
3. **Events trail** — every status change, every dispatch, every verification logged
4. **I verify every phase before marking review** — not just "worker said done"
5. **You gate every phase** — nothing goes to the next phase without your sign-off
6. **I report blockers immediately** — if something hangs or fails, you know in Discord

## Quick Reference

| You say | I do |
|---------|------|
| "start Phase A" | Dispatch to lead, move to in_progress |
| "approved, next" | Mark done, dispatch next phase |
| "approved, hold" | Mark done, keep next scheduled |
| "fix [thing]" | Route fix back, stay in review |
| "blocked: [reason]" | Mark blocked, add reason to card |
| "auto-pilot on" | Enable orchestrator cron |
| "auto-pilot off" | Disable orchestrator cron |
| "status" | I post current board state + next action |
