/**
 * Multi-instance guard tests.
 *
 * Verifies the module-level instanceCount tracking and console.warn
 * behaviour described in the Sora stability audit (Phase 2):
 *   - First registration does NOT warn.
 *   - Second+ registration warns with WebGL context guidance.
 *   - Deregister decrements the count, clamped at 0.
 *   - After all deregister, a fresh registration does not warn.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerInstance,
  deregisterInstance,
  getLiveInstanceCount,
  _resetInstanceCount,
} from '@/office/components/instanceGuard';

describe('OfficeCanvas multi-instance guard', () => {
  beforeEach(() => {
    _resetInstanceCount();
  });

  afterEach(() => {
    _resetInstanceCount();
  });

  it('starts at 0 live instances', () => {
    expect(getLiveInstanceCount()).toBe(0);
  });

  it('first registration increments to 1 without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const count = registerInstance('dashboard');
    expect(count).toBe(1);
    expect(getLiveInstanceCount()).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('second registration increments to 2 and warns about WebGL context limits', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerInstance('dashboard');
    const count = registerInstance('preview');
    expect(count).toBe(2);
    expect(getLiveInstanceCount()).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    // Warning should mention WebGL context limits.
    expect(warn.mock.calls[0][0]).toContain('WebGL');
    warn.mockRestore();
  });

  it('third registration warns again (each extra instance warns)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerInstance('a');
    registerInstance('b');
    registerInstance('c');
    expect(getLiveInstanceCount()).toBe(3);
    // Warned on the 2nd and 3rd registration.
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('deregister decrements the count', () => {
    registerInstance('a');
    registerInstance('b');
    expect(getLiveInstanceCount()).toBe(2);
    const count = deregisterInstance();
    expect(count).toBe(1);
    expect(getLiveInstanceCount()).toBe(1);
  });

  it('deregister clamps at 0 (no negative count)', () => {
    registerInstance('a');
    deregisterInstance();
    expect(getLiveInstanceCount()).toBe(0);
    // Extra deregister should not go negative.
    const count = deregisterInstance();
    expect(count).toBe(0);
    expect(getLiveInstanceCount()).toBe(0);
  });

  it('after all instances deregister, a fresh registration does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerInstance('a');
    registerInstance('b');
    deregisterInstance();
    deregisterInstance();
    expect(getLiveInstanceCount()).toBe(0);
    // Fresh registration — back to 1, no warning.
    const count = registerInstance('fresh');
    expect(count).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1); // only the earlier 2nd-instance warning
    warn.mockRestore();
  });

  it('warning message includes the label when provided', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerInstance('dashboard');
    registerInstance('preview');
    const msg = warn.mock.calls[0][0] as string;
    expect(msg).toContain('preview');
    warn.mockRestore();
  });

  it('warning works without a label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerInstance();
    registerInstance();
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0][0] as string;
    // Without a label, the message still mentions the instance count.
    expect(msg).toContain('2 instances');
    warn.mockRestore();
  });
});