/**
 * Reconnect catch-up animation — Phase 3 / Sora stability audit #6 / R10.
 *
 * When the Kanban WS reconnects after a drop, the dashboard re-fetches the
 * REST board snapshot. Agent target zones may have changed while we were
 * disconnected (a task completed, a new task was assigned, etc.). Instead of
 * snap-teleporting agents to their new zone positions, we lerp each agent
 * from its current visual grid position to the new zone-center position over
 * a fixed 1-second window with an ease-out curve.
 *
 * This module is deliberately pure (no Pixi, no DOM, no RAF) so it can be
 * unit-tested in the node environment. The AgentController consumes it
 * inside its per-tick `update()` loop.
 */

/** Default catch-up duration: 1 second, per the plan. */
export const CATCH_UP_DURATION_MS = 1000;

/** Mutable catch-up animation state for a single agent. */
export interface CatchUpState {
  /** Grid column at the start of the animation (agent's old position). */
  fromCol: number;
  /** Grid row at the start of the animation (agent's old position). */
  fromRow: number;
  /** Target grid column (new zone center). */
  toCol: number;
  /** Target grid row (new zone center). */
  toRow: number;
  /** `performance.now()` at animation start. */
  startTime: number;
  /** Animation duration in milliseconds. */
  durationMs: number;
}

/** Result of evaluating a catch-up animation at a given clock tick. */
export interface CatchUpSample {
  /** Interpolated grid column. */
  col: number;
  /** Interpolated grid row. */
  row: number;
  /** Normalised progress 0..1 (clamped). */
  progress: number;
  /** True when the animation has completed (progress >= 1). */
  done: boolean;
}

/**
 * Create a CatchUpState from the agent's current grid position and the
 * target zone-center grid position.
 */
export function createCatchUpState(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  startTime: number,
  durationMs: number = CATCH_UP_DURATION_MS,
): CatchUpState {
  return { fromCol, fromRow, toCol, toRow, startTime, durationMs };
}

/**
 * Evaluate a catch-up animation at the given clock time.
 *
 * Uses an ease-out-cubic curve so the agent decelerates as it approaches the
 * target, which looks natural for a "settling into position" animation.
 *
 * Returns the interpolated grid position and whether the animation is done.
 * Once `done` is true the caller should snap to the exact target and stop
 * evaluating.
 */
export function sampleCatchUp(state: CatchUpState, now: number): CatchUpSample {
  const elapsed = now - state.startTime;
  const raw = state.durationMs > 0 ? elapsed / state.durationMs : 1;
  const t = Math.max(0, Math.min(1, raw));
  // Ease-out cubic: 1 - (1 - t)^3
  const eased = 1 - Math.pow(1 - t, 3);
  return {
    col: state.fromCol + (state.toCol - state.fromCol) * eased,
    row: state.fromRow + (state.toRow - state.fromRow) * eased,
    progress: t,
    done: t >= 1,
  };
}

/**
 * Determine whether an agent should catch-up or is already at the target.
 * If the grid distance between old and new positions is below this epsilon,
 * no animation is needed — the agent is effectively already there.
 */
export const CATCH_UP_DISTANCE_EPSILON = 0.01;

/**
 * Check whether the distance between two grid positions is large enough to
 * warrant a catch-up animation.
 */
export function shouldCatchUp(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): boolean {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;
  return Math.sqrt(dc * dc + dr * dr) > CATCH_UP_DISTANCE_EPSILON;
}