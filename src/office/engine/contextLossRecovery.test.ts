/**
 * Context-loss recovery unit tests.
 *
 * The project test environment is `node` (no jsdom), so we mock the canvas
 * event listener interface instead of using a real DOM element. This keeps
 * the tests fast and avoids the jsdom dependency while fully exercising
 * the debounce / detach / async-restore logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createContextLossRecovery,
  type ContextLossCallbacks,
  type ContextLossRecovery,
} from './contextLossRecovery';

/** Minimal canvas mock that supports addEventListener / removeEventListener. */
function createMockCanvas() {
  const listeners: Record<string, Array<(e: Event) => void>> = {};
  return {
    addEventListener(event: string, handler: (e: Event) => void) {
      (listeners[event] ??= []).push(handler);
    },
    removeEventListener(event: string, handler: (e: Event) => void) {
      const arr = listeners[event] ?? [];
      const idx = arr.indexOf(handler);
      if (idx !== -1) arr.splice(idx, 1);
    },
    /** Dispatch a named event (simulates browser DOM event). */
    fireEvent(event: string) {
      for (const handler of listeners[event] ?? []) {
        handler({ preventDefault: vi.fn() } as unknown as Event);
      }
    },
  };
}

describe('createContextLossRecovery', () => {
  let canvas: ReturnType<typeof createMockCanvas>;
  let callbacks: ContextLossCallbacks;
  let recovery: ContextLossRecovery;

  beforeEach(() => {
    canvas = createMockCanvas();
    callbacks = {
      onLost: vi.fn(),
      onRestored: vi.fn(),
    };
    recovery = createContextLossRecovery(
      canvas as unknown as HTMLCanvasElement,
      callbacks,
    );
  });

  afterEach(() => {
    recovery.detach();
  });

  it('is not lost initially', () => {
    expect(recovery.isLost).toBe(false);
  });

  it('calls onLost when webglcontextlost fires and sets isLost', () => {
    canvas.fireEvent('webglcontextlost');
    expect(callbacks.onLost).toHaveBeenCalledTimes(1);
    expect(recovery.isLost).toBe(true);
  });

  it('does not call onLost again while already lost (debounce)', () => {
    canvas.fireEvent('webglcontextlost');
    canvas.fireEvent('webglcontextlost');
    expect(callbacks.onLost).toHaveBeenCalledTimes(1);
  });

  it('calls onRestored when webglcontextrestored fires after a loss', () => {
    canvas.fireEvent('webglcontextlost');
    canvas.fireEvent('webglcontextrestored');
    expect(callbacks.onRestored).toHaveBeenCalledTimes(1);
    expect(recovery.isLost).toBe(false);
  });

  it('ignores webglcontextrestored if no loss happened', () => {
    canvas.fireEvent('webglcontextrestored');
    expect(callbacks.onRestored).not.toHaveBeenCalled();
    expect(recovery.isLost).toBe(false);
  });

  it('detach removes listeners so no further callbacks fire', () => {
    recovery.detach();
    canvas.fireEvent('webglcontextlost');
    expect(callbacks.onLost).not.toHaveBeenCalled();
    expect(recovery.isLost).toBe(false);
  });

  it('handles a lost → restored → lost cycle', () => {
    canvas.fireEvent('webglcontextlost');
    expect(recovery.isLost).toBe(true);
    canvas.fireEvent('webglcontextrestored');
    expect(recovery.isLost).toBe(false);
    canvas.fireEvent('webglcontextlost');
    expect(callbacks.onLost).toHaveBeenCalledTimes(2);
    expect(callbacks.onRestored).toHaveBeenCalledTimes(1);
    expect(recovery.isLost).toBe(true);
  });

  it('onRestored is async and awaited via the returned promise', async () => {
    let resolveRestore!: () => void;
    const restorePromise = new Promise<void>((r) => {
      resolveRestore = r;
    });
    const onRestored = vi.fn(() => restorePromise);
    recovery.detach();
    recovery = createContextLossRecovery(
      canvas as unknown as HTMLCanvasElement,
      { onLost: vi.fn(), onRestored },
    );

    canvas.fireEvent('webglcontextlost');
    const restoreDone = vi.fn();
    recovery.whenRestored().then(restoreDone);

    canvas.fireEvent('webglcontextrestored');
    expect(onRestored).toHaveBeenCalled();
    // Not resolved yet
    expect(restoreDone).not.toHaveBeenCalled();

    resolveRestore();
    await restorePromise;
    // Microtasks for .then()
    await Promise.resolve();
    expect(restoreDone).toHaveBeenCalled();
  });
});
