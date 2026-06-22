/**
 * Unit tests for the reconnect catch-up animation (Phase 3 / Sora audit #6 / R10).
 *
 * The catch-up module is a pure function over primitive inputs — no PIXI,
 * no DOM, no RAF — so every branch is driven deterministically with a fake
 * clock.
 */
import { describe, expect, it } from 'vitest';
import {
  CATCH_UP_DURATION_MS,
  CATCH_UP_DISTANCE_EPSILON,
  createCatchUpState,
  sampleCatchUp,
  shouldCatchUp,
} from '@/office/engine/catchUpAnimation';

const T0 = 1_000_000; // arbitrary "now" baseline

describe('createCatchUpState', () => {
  it('records from/to grid positions and start time', () => {
    const s = createCatchUpState(1, 2, 5, 6, T0);
    expect(s.fromCol).toBe(1);
    expect(s.fromRow).toBe(2);
    expect(s.toCol).toBe(5);
    expect(s.toRow).toBe(6);
    expect(s.startTime).toBe(T0);
    expect(s.durationMs).toBe(CATCH_UP_DURATION_MS);
  });

  it('default duration is 1 second (1000 ms) per the plan', () => {
    expect(CATCH_UP_DURATION_MS).toBe(1000);
    const s = createCatchUpState(0, 0, 1, 1, T0);
    expect(s.durationMs).toBe(1000);
  });

  it('accepts a custom duration', () => {
    const s = createCatchUpState(0, 0, 1, 1, T0, 500);
    expect(s.durationMs).toBe(500);
  });
});

describe('sampleCatchUp — ease-out cubic interpolation', () => {
  it('at t=0 returns the start position, not done', () => {
    const s = createCatchUpState(0, 0, 10, 20, T0);
    const sample = sampleCatchUp(s, T0);
    expect(sample.col).toBeCloseTo(0);
    expect(sample.row).toBeCloseTo(0);
    expect(sample.progress).toBe(0);
    expect(sample.done).toBe(false);
  });

  it('at t=1 returns the exact target position and is done', () => {
    const s = createCatchUpState(0, 0, 10, 20, T0);
    const sample = sampleCatchUp(s, T0 + 1000);
    expect(sample.col).toBeCloseTo(10);
    expect(sample.row).toBeCloseTo(20);
    expect(sample.progress).toBe(1);
    expect(sample.done).toBe(true);
  });

  it('past the duration clamps to the target and is done', () => {
    const s = createCatchUpState(0, 0, 10, 20, T0);
    const sample = sampleCatchUp(s, T0 + 5000);
    expect(sample.col).toBeCloseTo(10);
    expect(sample.row).toBeCloseTo(20);
    expect(sample.progress).toBe(1);
    expect(sample.done).toBe(true);
  });

  it('before the start time clamps to the start position (clock skew safety)', () => {
    const s = createCatchUpState(0, 0, 10, 20, T0);
    const sample = sampleCatchUp(s, T0 - 500);
    expect(sample.col).toBeCloseTo(0);
    expect(sample.row).toBeCloseTo(0);
    expect(sample.progress).toBe(0);
    expect(sample.done).toBe(false);
  });

  it('midway through produces an ease-out curve (decelerating)', () => {
    // At t=0.5, ease-out-cubic value is 1 - (1-0.5)^3 = 1 - 0.125 = 0.875.
    // So an agent moving from 0 to 10 should be at 8.75 at the halfway point.
    const s = createCatchUpState(0, 0, 10, 0, T0);
    const sample = sampleCatchUp(s, T0 + 500);
    expect(sample.progress).toBeCloseTo(0.5, 5);
    expect(sample.col).toBeCloseTo(8.75, 5);
    expect(sample.row).toBeCloseTo(0);
    expect(sample.done).toBe(false);
  });

  it('interpolation is monotonic (always moving toward target)', () => {
    const s = createCatchUpState(2, 3, 8, 9, T0);
    let prevCol = -Infinity;
    let prevRow = -Infinity;
    for (let t = 0; t <= 1000; t += 50) {
      const sample = sampleCatchUp(s, T0 + t);
      expect(sample.col).toBeGreaterThanOrEqual(prevCol);
      expect(sample.row).toBeGreaterThanOrEqual(prevRow);
      prevCol = sample.col;
      prevRow = sample.row;
    }
    // End exactly at target.
    const end = sampleCatchUp(s, T0 + 1000);
    expect(end.col).toBeCloseTo(8);
    expect(end.row).toBeCloseTo(9);
  });

  it('zero-duration animation immediately reaches the target', () => {
    const s = createCatchUpState(0, 0, 5, 5, T0, 0);
    const sample = sampleCatchUp(s, T0);
    expect(sample.col).toBeCloseTo(5);
    expect(sample.row).toBeCloseTo(5);
    expect(sample.progress).toBe(1);
    expect(sample.done).toBe(true);
  });
});

describe('shouldCatchUp — distance gate', () => {
  it('returns true when the distance is large', () => {
    expect(shouldCatchUp(0, 0, 10, 10)).toBe(true);
  });

  it('returns false when from and to are the same position', () => {
    expect(shouldCatchUp(5, 5, 5, 5)).toBe(false);
  });

  it('returns false when the distance is below the epsilon threshold', () => {
    // epsilon is 0.01; a distance of 0.005 should not trigger.
    expect(CATCH_UP_DISTANCE_EPSILON).toBeLessThanOrEqual(0.01);
    expect(shouldCatchUp(0, 0, 0.005, 0)).toBe(false);
  });

  it('returns true when only one axis changes significantly', () => {
    expect(shouldCatchUp(0, 0, 5, 0)).toBe(true);
    expect(shouldCatchUp(0, 0, 0, 5)).toBe(true);
  });
});