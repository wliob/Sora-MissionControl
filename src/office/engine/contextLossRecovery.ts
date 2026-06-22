/**
 * Context-loss recovery helper for PixiJS v8 WebGL renderers.
 *
 * PixiJS's internal GlContextSystem listens for the native DOM events
 * `webglcontextlost` / `webglcontextrestored` on the canvas and calls
 * `event.preventDefault()` so the context *can* be restored. On restore it
 * re-emits the internal `contextChange` runner, which re-initialises GPU
 * resources — but user-side textures loaded via `Assets.load()` /
 * `new Spritesheet(...)` are NOT automatically re-uploaded, leaving the
 * office black.
 *
 * This helper attaches the same DOM listeners on the canvas and exposes a
 * clean callback contract so GameRuntime (or any consumer) can:
 *   1. show a "GPU lost" overlay on context loss, and
 *   2. reload textures + re-render once the context is restored.
 *
 * It is deliberately framework-free (no PixiJS import) so it can be unit
 * tested in jsdom without a real WebGL context.
 */

export interface ContextLossCallbacks {
  /** Called the first time a `webglcontextlost` event fires (debounced). */
  onLost: () => void;
  /**
   * Called when `webglcontextrestored` fires after a loss. May be async;
   * the returned promise (if any) is awaited by `whenRestored()`.
   */
  onRestored: () => void | Promise<void>;
}

export interface ContextLossRecovery {
  /** `true` between a context loss and its successful restoration. */
  readonly isLost: boolean;
  /**
   * Resolves once the in-flight restoration (if any) has completed.
   * If no restoration is in progress, resolves immediately.
   */
  whenRestored(): Promise<void>;
  /** Remove the DOM listeners. Safe to call multiple times. */
  detach(): void;
}

const LOST_EVENT = 'webglcontextlost';
const RESTORED_EVENT = 'webglcontextrestored';

export function createContextLossRecovery(
  canvas: HTMLCanvasElement,
  callbacks: ContextLossCallbacks,
): ContextLossRecovery {
  let lost = false;
  let restorePromise: Promise<void> | null = null;
  let restoreResolve: (() => void) | null = null;

  const handleLost = (event: Event): void => {
    // Let PixiJS (and us) prevent the browser from killing the context
    // permanently — only meaningful for the canvas's own event.
    event.preventDefault();
    if (lost) return; // debounce: ignore repeat lost events while already lost
    lost = true;
    callbacks.onLost();
  };

  const handleRestored = (): void => {
    if (!lost) return; // ignore stray restore events with no prior loss
    lost = false;
    restorePromise = new Promise<void>((resolve) => {
      restoreResolve = resolve;
    });
    try {
      const ret = callbacks.onRestored();
      if (ret && typeof (ret as Promise<void>).then === 'function') {
        (ret as Promise<void>).then(
          () => restoreResolve?.(),
          () => restoreResolve?.(),
        );
      } else {
        restoreResolve?.();
      }
    } catch {
      restoreResolve?.();
    }
  };

  // capture:false so PixiJS's own listeners (added during renderer init)
  // see the event too; we only mirror the user-facing contract.
  canvas.addEventListener(LOST_EVENT, handleLost);
  canvas.addEventListener(RESTORED_EVENT, handleRestored);

  return {
    get isLost() {
      return lost;
    },
    whenRestored() {
      return restorePromise ?? Promise.resolve();
    },
    detach() {
      canvas.removeEventListener(LOST_EVENT, handleLost);
      canvas.removeEventListener(RESTORED_EVENT, handleRestored);
    },
  };
}
