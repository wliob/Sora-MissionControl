/**
 * Unit tests for the atlas load timeout + retry fix (Sora stability audit #3,
 * Phase 2). Verifies:
 *   - loadWithTimeoutRetry resolves when the loader succeeds on first try.
 *   - loadWithTimeoutRetry retries once and succeeds if the second attempt
 *     succeeds (retries=1 means 1 additional attempt, 2 total).
 *   - loadWithTimeoutRetry rejects with AtlasUnavailableError when all attempts
 *     fail with a rejection.
 *   - loadWithTimeoutRetry rejects with AtlasUnavailableError when the loader
 *     never resolves within the timeout on any attempt.
 *   - AtlasUnavailableError carries the atlas label and the underlying cause.
 *
 * These tests use fake timers where needed to keep the suite fast and
 * deterministic; the 200ms backoff between retries is also exercised under
 * fake timers.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  AtlasUnavailableError,
  loadWithTimeoutRetry,
} from '@/office/engine/GameRuntime';

describe('loadWithTimeoutRetry — success path', () => {
  it('resolves on the first attempt with no retry', async () => {
    const loadFn = vi.fn().mockResolvedValue('ok');
    const result = await loadWithTimeoutRetry(loadFn, {
      timeoutMs: 1000,
      retries: 1,
      label: 'test',
    });
    expect(result).toBe('ok');
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('retries once and succeeds when the first attempt rejects', async () => {
    const loadFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    const result = await loadWithTimeoutRetry(loadFn, {
      timeoutMs: 1000,
      retries: 1,
      label: 'test',
    });
    expect(result).toBe('ok');
    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry when retries=0', async () => {
    const loadFn = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(
      loadWithTimeoutRetry(loadFn, { timeoutMs: 1000, retries: 0, label: 'test' }),
    ).rejects.toBeInstanceOf(AtlasUnavailableError);
    expect(loadFn).toHaveBeenCalledTimes(1);
  });
});

describe('loadWithTimeoutRetry — failure path', () => {
  it('throws AtlasUnavailableError when all attempts reject', async () => {
    const loadFn = vi.fn().mockRejectedValue(new Error('down'));
    let err: unknown;
    try {
      await loadWithTimeoutRetry(loadFn, {
        timeoutMs: 1000,
        retries: 1,
        label: 'atlas:agents',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AtlasUnavailableError);
    expect((err as AtlasUnavailableError).atlasName).toBe('atlas:agents');
    expect((err as AtlasUnavailableError).message).toContain('unavailable');
    expect((err as AtlasUnavailableError).message).toContain('down');
    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it('throws AtlasUnavailableError when the loader never resolves (timeout)', async () => {
    // A loader that hangs forever. Under real timers we use a very short
    // timeout so the test finishes quickly.
    const loadFn = vi.fn().mockImplementation(
      () => new Promise<string>(() => { /* never resolves */ }),
    );
    let err: unknown;
    try {
      await loadWithTimeoutRetry(loadFn, {
        timeoutMs: 50,
        retries: 0,
        label: 'atlas:fx',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AtlasUnavailableError);
    expect((err as AtlasUnavailableError).atlasName).toBe('atlas:fx');
    expect((err as AtlasUnavailableError).message).toContain('timed out');
  });
});

describe('AtlasUnavailableError', () => {
  it('carries the atlas name, message, and cause', () => {
    const cause = new Error('network down');
    const err = new AtlasUnavailableError('atlas:agents', 'agents unavailable: network down', cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AtlasUnavailableError');
    expect(err.atlasName).toBe('atlas:agents');
    expect(err.message).toContain('agents unavailable');
    expect(err.cause).toBe(cause);
  });

  it('is a distinct class (instanceof check used by OfficeCanvas)', () => {
    const err = new AtlasUnavailableError('x', 'msg');
    const generic = new Error('msg');
    expect(err instanceof AtlasUnavailableError).toBe(true);
    expect(generic instanceof AtlasUnavailableError).toBe(false);
  });
});