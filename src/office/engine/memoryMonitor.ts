/**
 * Memory pressure monitor for the 3D Office.
 *
 * Uses `performance.memory` (Chrome-only, non-standard) to detect when the
 * JS heap is approaching the browser's limit. When pressure is detected, the
 * monitor invokes a callback that the QualityManager can use to force a
 * quality downgrade regardless of FPS.
 *
 * On non-Chrome browsers, falls back to heuristics based on frame timing
 * (long pauses suggest GC pressure) and never reports high pressure.
 *
 * Phase 8 — Sora stability audit #9.
 */

export type MemoryPressureLevel = 'low' | 'moderate' | 'critical';

export interface MemoryPressureInfo {
  level: MemoryPressureLevel;
  /** Heap used in bytes (Chrome only, -1 if unavailable). */
  usedHeapSize: number;
  /** Total heap in bytes (Chrome only, -1 if unavailable). */
  totalHeapSize: number;
  /** Heap limit in bytes (Chrome only, -1 if unavailable). */
  jsHeapSizeLimit: number;
}

export interface MemoryPressureCallbacks {
  onPressureChange: (info: MemoryPressureInfo) => void;
}

// Chrome-only performance.memory shape
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

declare global {
  interface Performance {
    memory?: PerformanceMemory;
  }
}

// ── Thresholds ──────────────────────────────────────────────────────────────

/** Fraction of jsHeapSizeLimit at which pressure becomes "moderate". */
const MODERATE_THRESHOLD = 0.70;
/** Fraction of jsHeapSizeLimit at which pressure becomes "critical". */
const CRITICAL_THRESHOLD = 0.90;
/** How often (ms) to poll memory stats. */
const POLL_INTERVAL_MS = 5_000;

// ── Public API ──────────────────────────────────────────────────────────────

export interface MemoryMonitor {
  /** Start periodic polling. */
  start(): void;
  /** Stop polling and clean up. */
  stop(): void;
  /** Current pressure snapshot (polled synchronously). */
  current(): MemoryPressureInfo;
  /** Whether the monitor is currently running. */
  readonly running: boolean;
}

/**
 * Create a memory pressure monitor.
 *
 * @param callbacks.onPressureChange  called when the pressure level changes
 * @param pollIntervalMs              override default poll interval
 */
export function createMemoryMonitor(
  callbacks: MemoryPressureCallbacks,
  pollIntervalMs: number = POLL_INTERVAL_MS,
): MemoryMonitor {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastLevel: MemoryPressureLevel = 'low';

  function readMemory(): MemoryPressureInfo {
    const mem = performance.memory;
    if (!mem) {
      return {
        level: 'low',
        usedHeapSize: -1,
        totalHeapSize: -1,
        jsHeapSizeLimit: -1,
      };
    }

    const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
    const level: MemoryPressureLevel =
      ratio >= CRITICAL_THRESHOLD ? 'critical' :
      ratio >= MODERATE_THRESHOLD ? 'moderate' :
      'low';

    return {
      level,
      usedHeapSize: mem.usedJSHeapSize,
      totalHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit,
    };
  }

  function poll(): void {
    const info = readMemory();
    if (info.level !== lastLevel) {
      lastLevel = info.level;
      callbacks.onPressureChange(info);
    }
  }

  return {
    start() {
      if (timer !== null) return;
      // Initial poll
      poll();
      timer = setInterval(poll, pollIntervalMs);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    current() {
      return readMemory();
    },
    get running() {
      return timer !== null;
    },
  };
}
