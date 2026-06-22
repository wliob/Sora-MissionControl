/**
 * Unit tests for Agent.loadAnimSheet error reporting (Sora stability audit
 * #4 / R12, Phase 8).
 *
 * Agent.loadAnimSheet() catches errors silently and falls back to the static
 * base texture — the agent looks frozen with no visual cue. The fix adds:
 *   - A dev-mode console.warn so developers see the failure in the console.
 *   - An optional onAssetError callback on AgentOptions so the dashboard can
 *     surface a subtle indicator.
 *
 * Because loadAnimSheet depends on fetch + Pixi Assets (browser-only), we test
 * the pure reporting logic via the exported `reportAssetError` helper that
 * loadAnimSheet calls in its catch block. This keeps the test in the node
 * environment (per vitest.config.ts) with no DOM/WebGL dependency.
 */

import { describe, expect, it, vi } from 'vitest';
import { reportAssetError } from '@/office/entities/Agent';

describe('reportAssetError — dev-mode console warning', () => {
  it('logs a console.warn in dev mode with agent id and anim type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportAssetError('cloud', 'walk', new Error('404'), /* dev */ true, undefined);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0][0] as string;
    expect(msg).toContain('cloud');
    expect(msg).toContain('walk');
    expect(msg).toContain('404');
    warn.mockRestore();
  });

  it('does not log a console.warn in production mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportAssetError('biscuit', 'idle', new Error('timeout'), /* dev */ false, undefined);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('reportAssetError — onAssetError callback', () => {
  it('invokes onAssetError when provided (dev mode)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cb = vi.fn();
    const err = new Error('fetch failed');
    reportAssetError('lelouch', 'cheer', err, true, cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({
      agentId: 'lelouch',
      animType: 'cheer',
      error: err,
    });
    warn.mockRestore();
  });

  it('invokes onAssetError when provided (production mode)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cb = vi.fn();
    reportAssetError('korra', 'work', new Error('404'), false, cb);
    // Callback fires in prod too — the dashboard indicator needs it regardless.
    expect(cb).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not throw when onAssetError is undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() =>
      reportAssetError('tifa', 'idle', new Error('x'), true, undefined),
    ).not.toThrow();
    warn.mockRestore();
  });

  it('survives a throwing onAssetError without propagating', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const explodingCb = vi.fn(() => {
      throw new Error('callback imploded');
    });
    // The callback error should NOT escape reportAssetError — a broken
    // dashboard handler must not crash the agent's animation fallback.
    expect(() =>
      reportAssetError('cloud', 'walk', new Error('asset down'), true, explodingCb),
    ).not.toThrow();
    expect(explodingCb).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});