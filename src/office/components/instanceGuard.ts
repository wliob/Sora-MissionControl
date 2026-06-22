/**
 * Multi-instance guard for OfficeCanvas.
 *
 * Browsers cap WebGL contexts at ~8-16. Each OfficeCanvas mount creates a
 * PixiJS Application with its own WebGL context. Two simultaneous mounts
 * (e.g. dashboard + preview) silently consume two contexts, and with a few
 * more the browser starts losing contexts unpredictably.
 *
 * This module tracks the live instance count at module scope and emits a
 * console.warn whenever more than one OfficeCanvas is mounted. It does NOT
 * block additional mounts — it only surfaces the risk so developers notice
 * during development and QA (Sora stability audit, Phase 2).
 *
 * Extracted into its own module so it can be unit-tested under the node test
 * environment without importing React/Pixi/use-gesture (which require a DOM).
 */

let liveCount = 0;

/**
 * Return the current number of live OfficeCanvas instances.
 * Exported for unit tests; production code uses register/deregister.
 */
export function getLiveInstanceCount(): number {
  return liveCount;
}

/**
 * Mark a new OfficeCanvas instance as live. Returns the count after
 * registration. If the count exceeds 1, a console.warn is emitted with
 * guidance for the developer.
 */
export function registerInstance(label?: string): number {
  liveCount += 1;
  if (liveCount > 1) {
    const where = label ? ` (mounted in ${label})` : '';
    console.warn(
      `[OfficeCanvas] ${liveCount} instances are live${where}. ` +
        'Each mount creates a separate WebGL context — browsers cap at ~8-16. ' +
        'Consider unmounting unused office canvases or enforcing a singleton.',
    );
  }
  return liveCount;
}

/**
 * Mark an OfficeCanvas instance as no longer live (on unmount).
 * Clamps at 0 so cleanup bugs don't drive the counter negative.
 */
export function deregisterInstance(): number {
  liveCount = Math.max(0, liveCount - 1);
  return liveCount;
}

/**
 * Reset the counter to zero. Intended for test teardown only.
 */
export function _resetInstanceCount(): void {
  liveCount = 0;
}