/**
 * Phase 8 idle / sleep-mode performance policy.
 *
 * The 3D office ticker runs at full FPS whenever the scene is visible, even
 * when nobody is looking at it. After 5 minutes of no user interaction
 * (pointer / wheel / key / touch) the ticker should drop to 1 FPS ("sleep"),
 * and bounce back to its prior target the moment the user taps or scrolls
 * again. This file holds the *pure* decision function so the policy can be
 * unit-tested without a PIXI Application or DOM — the GameRuntime wires the
 * resulting targetFps onto `app.ticker.maxFPS`.
 *
 * Decision precedence (highest first):
 *   1. document hidden OR canvas not intersecting → "hidden"
 *   2. idle longer than IDLE_TIMEOUT_MS (no interaction) → "sleep"
 *   3. any agent actively moving → "active"
 *   4. otherwise → "idle"
 *
 * "sleep" wins over "active": if the user has walked away we throttle even
 * while agents finish their current walk — the visual is stale to a user who
 * isn't watching, and a 1 FPS wake tick is enough to finish + settle movement
 * on the next interaction.
 */
export type PerformanceMode = 'active' | 'idle' | 'hidden' | 'sleep';

/** Milliseconds of no interaction before the ticker drops to sleep. */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Target FPS per performance mode. */
export const TARGET_FPS: Record<PerformanceMode, number> = {
  active: 60,
  idle: 24,
  hidden: 4,
  sleep: 1,
};

/** Same map but with prefersReducedMotion honoured (lower cap). */
export const TARGET_FPS_REDUCED: Record<PerformanceMode, number> = {
  active: 12,
  idle: 8,
  hidden: 4,
  sleep: 1,
};

/**
 * Inputs to the performance-mode decision. All booleans / numbers — no DOM
 * or PIXI types, so this is trivially unit-testable.
 */
export interface PerfModeInputs {
  /** Is the document hidden (visibilitychange) or the canvas off-screen? */
  isHidden: boolean;
  /** Is any agent controller currently mid-walk (controller.isActive)? */
  anyAgentActive: boolean;
  /** performance.now() at the last user interaction (pointer/wheel/key/touch). */
  lastInteractionAt: number;
  /** performance.now() at decision time. */
  now: number;
  /** prefers-reduced-motion media query match. */
  prefersReducedMotion: boolean;
}

/**
 * Pure decision: given the current inputs, return the performance mode and the
 * target FPS to apply to the ticker.
 */
export function computePerformanceMode(
  inputs: PerfModeInputs,
): { mode: PerformanceMode; targetFps: number } {
  const idleMs = inputs.now - inputs.lastInteractionAt;

  if (inputs.isHidden) {
    const table = inputs.prefersReducedMotion ? TARGET_FPS_REDUCED : TARGET_FPS;
    return { mode: 'hidden', targetFps: table.hidden };
  }
  if (idleMs >= IDLE_TIMEOUT_MS) {
    // Sleep wins over active — a user who walked away doesn't need 60fps even
    // if an agent is finishing a walk.
    return { mode: 'sleep', targetFps: TARGET_FPS.sleep };
  }
  if (inputs.anyAgentActive) {
    const table = inputs.prefersReducedMotion ? TARGET_FPS_REDUCED : TARGET_FPS;
    return { mode: 'active', targetFps: table.active };
  }
  const table = inputs.prefersReducedMotion ? TARGET_FPS_REDUCED : TARGET_FPS;
  return { mode: 'idle', targetFps: table.idle };
}