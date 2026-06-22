import { describe, it, expect } from 'vitest';
import { QualityManager, type QualityTier } from './QualityManager';

describe('QualityManager', () => {
  it('starts at the initial tier (default high)', () => {
    const qm = new QualityManager();
    expect(qm.tier).toBe('high');
    expect(qm.settings.particleFx).toBe(true);
    expect(qm.settings.emoteAnimations).toBe(true);
    expect(qm.settings.idleAnimationFps).toBe(15);
  });

  it('honours a custom initial tier', () => {
    const qm = new QualityManager({ initialTier: 'low' });
    expect(qm.tier).toBe('low');
    expect(qm.settings.particleFx).toBe(false);
    expect(qm.settings.idleAnimationFps).toBe(4);
  });

  it('computes a rolling average over the window', () => {
    const qm = new QualityManager({ windowSize: 3 });
    qm.recordFps(60);
    qm.recordFps(30);
    qm.recordFps(10);
    expect(qm.averageFps).toBeCloseTo(33.33, 1);
    expect(qm.sampleCount).toBe(3);

    // Overflow evicts oldest.
    qm.recordFps(20);
    expect(qm.sampleCount).toBe(3);
    expect(qm.averageFps).toBeCloseTo(20, 1); // (30 + 10 + 20) / 3
  });

  it('downgrades high -> medium after downHoldSamples of <30 fps', () => {
    const qm = new QualityManager({ downHoldSamples: 3, windowSize: 1 });
    const seen: QualityTier[] = [];
    qm.onChange((s) => seen.push(s.tier));

    qm.recordFps(20); // avg 20 -> target medium, downCount 1
    expect(qm.tier).toBe('high');
    qm.recordFps(20); // downCount 2
    expect(qm.tier).toBe('high');
    qm.recordFps(20); // downCount 3 -> transition
    expect(qm.tier).toBe('medium');
    expect(seen).toEqual(['medium']);
    expect(qm.settings.idleAnimationFps).toBe(8);
  });

  it('downgrades medium -> low after downHoldSamples of <15 fps', () => {
    const qm = new QualityManager({
      initialTier: 'medium',
      downHoldSamples: 2,
      windowSize: 1,
    });
    qm.recordFps(10);
    expect(qm.tier).toBe('medium');
    qm.recordFps(10);
    expect(qm.tier).toBe('low');
    expect(qm.settings.particleFx).toBe(false);
    expect(qm.settings.emoteAnimations).toBe(false);
    expect(qm.settings.idleAnimationFps).toBe(4);
  });

  it('upgrades low -> medium after upHoldSamples of >=15 fps', () => {
    const qm = new QualityManager({
      initialTier: 'low',
      upHoldSamples: 2,
      windowSize: 1,
    });
    qm.recordFps(18);
    expect(qm.tier).toBe('low');
    qm.recordFps(18);
    expect(qm.tier).toBe('medium');
  });

  it('upgrades medium -> high after upHoldSamples of >=30 fps', () => {
    const qm = new QualityManager({
      initialTier: 'medium',
      upHoldSamples: 2,
      windowSize: 1,
    });
    qm.recordFps(40);
    expect(qm.tier).toBe('medium');
    qm.recordFps(40);
    expect(qm.tier).toBe('high');
    expect(qm.settings.particleFx).toBe(true);
  });

  it('does not thrash: a single spike does not upgrade immediately', () => {
    const qm = new QualityManager({
      initialTier: 'low',
      upHoldSamples: 5,
      windowSize: 1,
    });
    qm.recordFps(60); // upCount 1
    expect(qm.tier).toBe('low');
    qm.recordFps(8); // back below threshold — reset
    expect(qm.tier).toBe('low');
    expect(qm['upCount']).toBe(0);
  });

  it('does not thrash: a single dip does not downgrade immediately', () => {
    const qm = new QualityManager({
      downHoldSamples: 4,
      windowSize: 1,
    });
    qm.recordFps(12); // downCount 1
    expect(qm.tier).toBe('high');
    qm.recordFps(60); // back above threshold — reset
    expect(qm.tier).toBe('high');
    expect(qm['downCount']).toBe(0);
  });

  it('emits the full settings object on change', () => {
    const qm = new QualityManager({ downHoldSamples: 1, windowSize: 1 });
    let last = qm.settings;
    qm.onChange((s) => { last = s; });
    qm.recordFps(5); // -> low
    expect(last.tier).toBe('low');
    expect(last.particleFx).toBe(false);
    expect(last.emoteAnimations).toBe(false);
    expect(last.idleAnimationFps).toBe(4);
  });

  it('ignores invalid fps samples', () => {
    const qm = new QualityManager({ windowSize: 5 });
    qm.recordFps(NaN);
    qm.recordFps(-1);
    qm.recordFps(Infinity);
    expect(qm.sampleCount).toBe(0);
    expect(qm.averageFps).toBe(0);
  });

  it('reset clears the sample window and hold counters', () => {
    const qm = new QualityManager({ downHoldSamples: 3, windowSize: 5 });
    qm.recordFps(10);
    qm.recordFps(10);
    expect(qm['downCount']).toBe(2);
    qm.reset();
    expect(qm.sampleCount).toBe(0);
    expect(qm['downCount']).toBe(0);
  });

  it('setTier forces a transition and emits', () => {
    const qm = new QualityManager();
    const seen: QualityTier[] = [];
    qm.onChange((s) => seen.push(s.tier));
    expect(qm.setTier('low')).toBe(true);
    expect(qm.tier).toBe('low');
    expect(seen).toEqual(['low']);
    // No-op returns false.
    expect(qm.setTier('low')).toBe(false);
  });

  it('honours custom thresholds', () => {
    const qm = new QualityManager({
      thresholds: { high: 50, medium: 25, low: 0 },
      downHoldSamples: 1,
      windowSize: 1,
    });
    qm.recordFps(35); // < 50 but >= 25 -> medium
    expect(qm.tier).toBe('medium');
  });

  it('honours per-tier settings overrides', () => {
    const qm = new QualityManager({
      downHoldSamples: 1,
      windowSize: 1,
      tierSettings: { low: { idleAnimationFps: 2 } },
    });
    qm.recordFps(5); // -> low
    expect(qm.settings.idleAnimationFps).toBe(2);
    expect(qm.settings.particleFx).toBe(false); // not overridden
  });
});
