/**
 * FloatingChatOverlay geometry tests.
 *
 * The overlay's interaction model (drag/resize/clamp) is ported from the
 * hermes-chat-bubble dashboard plugin. These tests pin the geometry invariants
 * so the bubble never escapes the viewport and respects minimum sizes.
 *
 * The React render/drag behaviour is covered by the build + a manual smoke
 * check; the pure geometry functions are exported and unit-tested here.
 */

import { describe, expect, it } from 'vitest';
import {
  clampGeometry,
  getViewportBounds,
  type ViewportBounds,
} from './FloatingChatOverlay';

const BOUNDS_1080: ViewportBounds = {
  left: 0,
  top: 0,
  right: 1920,
  bottom: 1080,
  width: 1920,
  height: 1080,
};

describe('FloatingChatOverlay — clampGeometry', () => {
  it('clamps width and height to minimums', () => {
    const g = clampGeometry({ open: true, width: 50, height: 50, x: 10, y: 10 }, BOUNDS_1080);
    expect(g.width).toBeGreaterThanOrEqual(160);
    expect(g.height).toBeGreaterThanOrEqual(160);
  });

  it('clamps width and height to viewport minus edge pad', () => {
    const g = clampGeometry(
      { open: true, width: 99999, height: 99999, x: 0, y: 0 },
      BOUNDS_1080,
    );
    expect(g.width).toBeLessThanOrEqual(BOUNDS_1080.width - 8 * 2);
    expect(g.height).toBeLessThanOrEqual(BOUNDS_1080.height - 46 - 8 * 2);
  });

  it('keeps the bubble inside the viewport bounds', () => {
    const g = clampGeometry(
      { open: true, width: 360, height: 320, x: 99999, y: 99999 },
      BOUNDS_1080,
    );
    expect(g.x + g.width).toBeLessThanOrEqual(BOUNDS_1080.right - 8);
    expect(g.y + g.height + 46).toBeLessThanOrEqual(BOUNDS_1080.bottom - 8);
  });

  it('clamps negative positions back into bounds', () => {
    const g = clampGeometry(
      { open: true, width: 360, height: 320, x: -500, y: -500 },
      BOUNDS_1080,
    );
    expect(g.x).toBeGreaterThanOrEqual(8);
    expect(g.y).toBeGreaterThanOrEqual(8);
  });

  it('preserves the open flag and other fields', () => {
    const g = clampGeometry(
      { open: true, width: 400, height: 400, x: 100, y: 100 },
      BOUNDS_1080,
    );
    expect(g.open).toBe(true);
    expect(g.width).toBe(400);
    expect(g.height).toBe(400);
  });
});

describe('FloatingChatOverlay — getViewportBounds', () => {
  it('returns positive dimensions in a jsdom environment', () => {
    const b = getViewportBounds();
    expect(b.width).toBeGreaterThanOrEqual(0);
    expect(b.height).toBeGreaterThanOrEqual(0);
    expect(b.right).toBe(b.left + b.width);
  });
});