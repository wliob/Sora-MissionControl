/**
 * Unit tests for the Phase 8 idle / sleep-mode performance policy.
 *
 * The policy is a pure function (computePerformanceMode) over primitive
 * inputs — no PIXI Application, no DOM, no RAF — so we can drive every branch
 * deterministically with fake clocks.
 */
import { describe, expect, it } from 'vitest';
import {
  computePerformanceMode,
  IDLE_TIMEOUT_MS,
  TARGET_FPS,
  TARGET_FPS_REDUCED,
  type PerfModeInputs,
} from '@/office/engine/perfMode';

const BASE = 1_000_000; // arbitrary "now" baseline

function mk(over: Partial<PerfModeInputs> = {}): PerfModeInputs {
  return {
    isHidden: false,
    anyAgentActive: false,
    lastInteractionAt: BASE,
    now: BASE,
    prefersReducedMotion: false,
    ...over,
  };
}

describe('computePerformanceMode — sleep mode (Phase 8 #13)', () => {
  it('drops to sleep (1 fps) after 5 minutes of no interaction', () => {
    const res = computePerformanceMode(
      mk({ lastInteractionAt: BASE, now: BASE + IDLE_TIMEOUT_MS }),
    );
    expect(res.mode).toBe('sleep');
    expect(res.targetFps).toBe(1);
  });

  it('sleep targetFps is 1 even with prefersReducedMotion', () => {
    const res = computePerformanceMode(
      mk({
        prefersReducedMotion: true,
        lastInteractionAt: BASE,
        now: BASE + IDLE_TIMEOUT_MS,
      }),
    );
    expect(res.mode).toBe('sleep');
    expect(res.targetFps).toBe(1);
  });

  it('stays idle before the 5-minute threshold (boundary: just under)', () => {
    const res = computePerformanceMode(
      mk({ lastInteractionAt: BASE, now: BASE + IDLE_TIMEOUT_MS - 1 }),
    );
    expect(res.mode).toBe('idle');
    expect(res.targetFps).toBe(TARGET_FPS.idle);
  });

  it('sleep beats active — a walking agent still throttles if the user walked away', () => {
    const res = computePerformanceMode(
      mk({
        anyAgentActive: true,
        lastInteractionAt: BASE,
        now: BASE + IDLE_TIMEOUT_MS,
      }),
    );
    expect(res.mode).toBe('sleep');
    expect(res.targetFps).toBe(1);
  });

  it('a fresh interaction wakes from sleep back to idle/active', () => {
    // Just interacted → idle (no agents moving)
    const idleRes = computePerformanceMode(
      mk({ lastInteractionAt: BASE, now: BASE }),
    );
    expect(idleRes.mode).toBe('idle');
    // Just interacted + agents moving → active (60fps)
    const activeRes = computePerformanceMode(
      mk({ anyAgentActive: true, lastInteractionAt: BASE, now: BASE }),
    );
    expect(activeRes.mode).toBe('active');
    expect(activeRes.targetFps).toBe(TARGET_FPS.active);
  });

  it('hidden beats sleep — an off-screen tab throttles to hidden, not sleep', () => {
    const res = computePerformanceMode(
      mk({
        isHidden: true,
        lastInteractionAt: BASE,
        now: BASE + IDLE_TIMEOUT_MS,
      }),
    );
    expect(res.mode).toBe('hidden');
    expect(res.targetFps).toBe(TARGET_FPS.hidden);
  });

  it('hidden beats active as well', () => {
    const res = computePerformanceMode(
      mk({ isHidden: true, anyAgentActive: true }),
    );
    expect(res.mode).toBe('hidden');
  });
});

describe('computePerformanceMode — target FPS tables', () => {
  it('exposes 1 fps for sleep in both tables', () => {
    expect(TARGET_FPS.sleep).toBe(1);
    expect(TARGET_FPS_REDUCED.sleep).toBe(1);
  });

  it('honours prefersReducedMotion for active and idle', () => {
    const active = computePerformanceMode(
      mk({ anyAgentActive: true, prefersReducedMotion: true }),
    );
    expect(active.targetFps).toBe(TARGET_FPS_REDUCED.active);
    expect(active.targetFps).toBeLessThan(TARGET_FPS.active);

    const idle = computePerformanceMode(
      mk({ prefersReducedMotion: true }),
    );
    expect(idle.targetFps).toBe(TARGET_FPS_REDUCED.idle);
    expect(idle.targetFps).toBeLessThan(TARGET_FPS.idle);
  });
});