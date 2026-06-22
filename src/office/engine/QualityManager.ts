/**
 * QualityManager — FPS-based adaptive quality degradation for the 3D Office.
 *
 * GameRuntime samples the rendered FPS each second and feeds it here. The
 * manager keeps a rolling window of recent FPS samples, computes a smoothed
 * average, and maps it onto one of three quality tiers using hysteresis to
 * avoid thrashing near a threshold boundary. When the tier changes, the
 * manager emits a `QualitySettings` object describing what visual features
 * should be enabled / throttled at the new tier.
 *
 * Tiers (defaults, all overridable via the constructor):
 *   high   — avgFps >= 30   → full FX, emote animations, idle @ 15 fps
 *   medium — 15 <= avg < 30 → FX on, emotes on, idle throttled to 8 fps
 *   low    — avgFps < 15    → FX off, emote animations skipped, idle @ 4 fps
 *
 * Hysteresis: a downgrade only fires once the rolling average has stayed
 * below the lower threshold for `downHoldSamples` consecutive evaluations; an
 * upgrade only fires once it has stayed above the upper threshold for
 * `upHoldSamples` consecutive evaluations. This prevents a single momentary
 * dip or spike from flipping the tier back and forth.
 *
 * Reference: Sora stability audit #10 (Phase 8).
 */

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  tier: QualityTier;
  /** Particle FX (e.g. celebration confetti, ambient dust). Off in low tier. */
  particleFx: boolean;
  /** Emote animations (cheer one-shot, blocked "!"). Skipped in low tier. */
  emoteAnimations: boolean;
  /** Target FPS for the idle animation spritesheet loop. */
  idleAnimationFps: number;
}

export interface QualityThresholds {
  /** avgFps >= this → eligible for high tier. */
  high: number;
  /** avgFps >= this (and < high) → eligible for medium tier. */
  medium: number;
  /** Below medium → eligible for low tier. */
  low: number;
}

export interface QualityManagerOptions {
  /** Number of recent FPS samples to average. Default 10 (~10s of history). */
  windowSize?: number;
  thresholds?: Partial<QualityThresholds>;
  /** Consecutive evaluations below a lower threshold before downgrading. Default 3. */
  downHoldSamples?: number;
  /** Consecutive evaluations above an upper threshold before upgrading. Default 5. */
  upHoldSamples?: number;
  /** Initial tier before any samples arrive. Default 'high'. */
  initialTier?: QualityTier;
  /** Per-tier settings overrides. */
  tierSettings?: Partial<Record<QualityTier, Partial<QualitySettings>>>;
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  high: 30,
  medium: 15,
  low: 0,
};

const DEFAULT_TIER_SETTINGS: Record<QualityTier, QualitySettings> = {
  high: { tier: 'high', particleFx: true, emoteAnimations: true, idleAnimationFps: 15 },
  medium: { tier: 'medium', particleFx: true, emoteAnimations: true, idleAnimationFps: 8 },
  low: { tier: 'low', particleFx: false, emoteAnimations: false, idleAnimationFps: 4 },
};

export class QualityManager {
  private samples: number[] = [];
  private readonly windowSize: number;
  private readonly thresholds: QualityThresholds;
  private readonly downHold: number;
  private readonly upHold: number;
  private readonly tierSettings: Record<QualityTier, QualitySettings>;

  private currentTier: QualityTier;
  private downCount = 0;
  private upCount = 0;
  private listeners = new Set<(settings: QualitySettings) => void>();

  constructor(options: QualityManagerOptions = {}) {
    this.windowSize = Math.max(1, options.windowSize ?? 10);
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.downHold = Math.max(1, options.downHoldSamples ?? 3);
    this.upHold = Math.max(1, options.upHoldSamples ?? 5);
    this.currentTier = options.initialTier ?? 'high';

    // Merge per-tier overrides with defaults.
    this.tierSettings = { ...DEFAULT_TIER_SETTINGS };
    for (const tier of ['high', 'medium', 'low'] as QualityTier[]) {
      const override = options.tierSettings?.[tier];
      if (override) {
        this.tierSettings[tier] = { ...DEFAULT_TIER_SETTINGS[tier], ...override };
      }
    }
  }

  /** Current quality tier. */
  get tier(): QualityTier {
    return this.currentTier;
  }

  /** Current effective settings for the active tier. */
  get settings(): QualitySettings {
    return { ...this.tierSettings[this.currentTier] };
  }

  /** Rolling average FPS over the sample window, or 0 if no samples yet. */
  get averageFps(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    return sum / this.samples.length;
  }

  /** Number of samples currently held in the window. */
  get sampleCount(): number {
    return this.samples.length;
  }

  /** Subscribe to tier-change notifications. Returns an unsubscribe fn. */
  onChange(listener: (settings: QualitySettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Feed a single FPS sample (one per second is typical). May emit a change. */
  recordFps(fps: number): void {
    if (!Number.isFinite(fps) || fps < 0) return;
    this.samples.push(fps);
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
    this.evaluate();
  }

  /**
   * Evaluate the rolling average against the thresholds with hysteresis and
   * transition the tier if the hold counts are met. Returns true if the tier
   * changed this call.
   */
  private evaluate(): boolean {
    const avg = this.averageFps;
    const target = this.tierForFps(avg);

    if (target === this.currentTier) {
      this.downCount = 0;
      this.upCount = 0;
      return false;
    }

    const order: QualityTier[] = ['low', 'medium', 'high'];
    const currentIdx = order.indexOf(this.currentTier);
    const targetIdx = order.indexOf(target);

    if (targetIdx < currentIdx) {
      // Downgrade: require consecutive below-threshold evaluations.
      this.downCount += 1;
      this.upCount = 0;
      if (this.downCount >= this.downHold) {
        return this.transition(target);
      }
    } else {
      // Upgrade: require consecutive above-threshold evaluations.
      this.upCount += 1;
      this.downCount = 0;
      if (this.upCount >= this.upHold) {
        return this.transition(target);
      }
    }
    return false;
  }

  private transition(tier: QualityTier): boolean {
    this.currentTier = tier;
    this.downCount = 0;
    this.upCount = 0;
    const settings = this.settings;
    this.listeners.forEach((listener) => listener(settings));
    return true;
  }

  /** Pure threshold mapping (no hysteresis) — used internally by evaluate(). */
  private tierForFps(fps: number): QualityTier {
    if (fps >= this.thresholds.high) return 'high';
    if (fps >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  /** Force a tier (e.g. for reduced-motion preset or testing). Emits if changed. */
  setTier(tier: QualityTier): boolean {
    if (tier === this.currentTier) return false;
    return this.transition(tier);
  }

  /** Reset the sample window (e.g. after the tab was backgrounded). */
  reset(): void {
    this.samples = [];
    this.downCount = 0;
    this.upCount = 0;
  }
}
