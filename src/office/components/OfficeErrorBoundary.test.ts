/**
 * OfficeErrorBoundary logic tests.
 *
 * The test environment is `node` (no jsdom), so we unit-test the pure state
 * logic of the class component rather than rendering it. The boundary's
 * core contract is:
 *
 *   1. getDerivedStateFromError stores the error in state.
 *   2. handleRetry clears the error and increments retryKey (forces remount).
 *   3. onError callback is invoked when an error is caught.
 *   4. Initial state has no error and retryKey 0.
 *
 * The React render path (fallback card, retry button) is exercised by the
 * build + visual smoke check, same convention as OfficeCanvas.
 */

import { describe, expect, it, vi } from 'vitest';
import { OfficeErrorBoundary, type OfficeErrorBoundaryState } from '@/office/components/OfficeErrorBoundary';
import type { ErrorInfo } from 'react';

/**
 * Create a boundary with setState stubbed to directly mutate state,
 * simulating what React does when the component is mounted.
 */
function createBoundary(onError?: (error: Error, info: ErrorInfo) => void) {
  const boundary = new OfficeErrorBoundary({ children: null, onError });
  // Stub setState to directly merge into state (like React does on mount).
  // We cast through unknown to avoid fighting React's generic setState type.
  const applyState = (partial: Partial<OfficeErrorBoundaryState> | ((prev: OfficeErrorBoundaryState) => Partial<OfficeErrorBoundaryState>)) => {
    const update = typeof partial === 'function' ? partial(boundary.state) : partial;
    boundary.state = { ...boundary.state, ...update } as OfficeErrorBoundaryState;
  };
  (boundary as unknown as { setState: typeof applyState }).setState = applyState;
  return boundary;
}

describe('OfficeErrorBoundary — initial state', () => {
  it('starts with null error and retryKey 0', () => {
    const boundary = createBoundary();
    expect(boundary.state.error).toBeNull();
    expect(boundary.state.retryKey).toBe(0);
  });
});

describe('OfficeErrorBoundary — getDerivedStateFromError', () => {
  it('returns state with the caught error', () => {
    const err = new Error('WebGL not available');
    const state = OfficeErrorBoundary.getDerivedStateFromError(err);
    expect(state.error).toBe(err);
  });

  it('handles errors with empty messages', () => {
    const err = new Error('');
    const state = OfficeErrorBoundary.getDerivedStateFromError(err);
    expect(state.error).toBe(err);
    expect(state.error?.message).toBe('');
  });

  it('handles non-Error throwables (string thrown)', () => {
    // React may pass non-Error objects if user code throws a string.
    // getDerivedStateFromError receives whatever was thrown, typed as Error.
    const thrown = 'atlas 404' as unknown as Error;
    const state = OfficeErrorBoundary.getDerivedStateFromError(thrown);
    expect(state.error).toBe(thrown);
  });
});

describe('OfficeErrorBoundary — handleRetry', () => {
  it('clears the error state', () => {
    const boundary = createBoundary();
    boundary.state = { error: new Error('init failed'), retryKey: 0 };
    boundary.handleRetry();
    expect(boundary.state.error).toBeNull();
  });

  it('increments retryKey to force child remount', () => {
    const boundary = createBoundary();
    boundary.state = { error: new Error('init failed'), retryKey: 3 };
    boundary.handleRetry();
    expect(boundary.state.retryKey).toBe(4);
  });

  it('clears error and increments retryKey together', () => {
    const boundary = createBoundary();
    boundary.state = { error: new Error('GPU crash'), retryKey: 1 };
    boundary.handleRetry();
    expect(boundary.state).toEqual({ error: null, retryKey: 2 });
  });
});

describe('OfficeErrorBoundary — onError callback', () => {
  it('invokes the onError callback with error and info', () => {
    const onError = vi.fn();
    const boundary = createBoundary(onError);
    const err = new Error('atlas load failed');
    const info: ErrorInfo = {
      componentStack: '\n    in OfficeCanvas\n    in OfficeModule',
    };
    boundary.componentDidCatch(err, info);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(err, info);
  });

  it('does not throw when no onError callback is provided', () => {
    const boundary = createBoundary();
    const err = new Error('no WebGL');
    const info: ErrorInfo = { componentStack: '' };
    expect(() => boundary.componentDidCatch(err, info)).not.toThrow();
  });
});

describe('OfficeErrorBoundary — retry cycle', () => {
  it('simulates a full error → retry → clean state cycle', () => {
    const boundary = createBoundary();

    // Initial: clean state
    expect(boundary.state.error).toBeNull();
    expect(boundary.state.retryKey).toBe(0);

    // Simulate an error caught during render
    const err1 = new Error('WebGL context lost');
    const state1 = OfficeErrorBoundary.getDerivedStateFromError(err1);
    boundary.state = { ...boundary.state, ...state1 };
    expect(boundary.state.error).toBe(err1);
    expect(boundary.state.retryKey).toBe(0);

    // User clicks retry
    boundary.handleRetry();
    expect(boundary.state.error).toBeNull();
    expect(boundary.state.retryKey).toBe(1);

    // Simulate a second error after retry
    const err2 = new Error('atlas 404');
    const state2 = OfficeErrorBoundary.getDerivedStateFromError(err2);
    boundary.state = { ...boundary.state, ...state2 };
    expect(boundary.state.error).toBe(err2);
    expect(boundary.state.retryKey).toBe(1);

    // Second retry
    boundary.handleRetry();
    expect(boundary.state.error).toBeNull();
    expect(boundary.state.retryKey).toBe(2);
  });
});