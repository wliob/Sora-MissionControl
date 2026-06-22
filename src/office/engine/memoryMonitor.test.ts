import { describe, it, expect, vi } from 'vitest';
import {
  createMemoryMonitor,
  type MemoryPressureInfo,
} from './memoryMonitor';

describe('createMemoryMonitor', () => {
  it('returns low pressure when performance.memory is unavailable', () => {
    const onPressureChange = vi.fn();
    const monitor = createMemoryMonitor({ onPressureChange });
    const info = monitor.current();
    expect(info.level).toBe('low');
    expect(info.usedHeapSize).toBe(-1);
    expect(info.totalHeapSize).toBe(-1);
    expect(info.jsHeapSizeLimit).toBe(-1);
  });

  it('is not running after construction', () => {
    const monitor = createMemoryMonitor({ onPressureChange: vi.fn() });
    expect(monitor.running).toBe(false);
  });

  it('is running after start()', () => {
    const monitor = createMemoryMonitor({ onPressureChange: vi.fn() });
    monitor.start();
    expect(monitor.running).toBe(true);
    monitor.stop();
  });

  it('is not running after stop()', () => {
    const monitor = createMemoryMonitor({ onPressureChange: vi.fn() });
    monitor.start();
    monitor.stop();
    expect(monitor.running).toBe(false);
  });

  it('does not start twice (idempotent)', () => {
    const monitor = createMemoryMonitor({ onPressureChange: vi.fn() });
    monitor.start();
    monitor.start(); // second call should be no-op
    expect(monitor.running).toBe(true);
    monitor.stop();
    expect(monitor.running).toBe(false);
  });

  it('invokes onPressureChange on start if level is not low (with mock)', () => {
    // Mock performance.memory to simulate critical pressure
    const original = performance.memory;
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 950_000_000,
        totalJSHeapSize: 1_000_000_000,
        jsHeapSizeLimit: 1_000_000_000,
      },
      configurable: true,
    });

    const onPressureChange = vi.fn();
    const monitor = createMemoryMonitor({ onPressureChange });
    monitor.start();

    expect(onPressureChange).toHaveBeenCalledTimes(1);
    const info = onPressureChange.mock.calls[0][0] as MemoryPressureInfo;
    expect(info.level).toBe('critical');

    monitor.stop();
    // Restore
    if (original) {
      Object.defineProperty(performance, 'memory', { value: original, configurable: true });
    } else {
      Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });
    }
  });

  it('does not invoke onPressureChange when level stays the same', () => {
    // No performance.memory → always low → start triggers but doesn't change
    // from default "low", so callback fires once for initial state.
    const onPressureChange = vi.fn();
    const monitor = createMemoryMonitor({ onPressureChange }, 100);
    monitor.start();
    // The initial poll sets lastLevel to 'low' and fires if different from
    // the constructor default (also 'low'), so no call.
    expect(onPressureChange).toHaveBeenCalledTimes(0);
    monitor.stop();
  });

  it('reports moderate pressure at 70% threshold', () => {
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 750_000_000,
        totalJSHeapSize: 1_000_000_000,
        jsHeapSizeLimit: 1_000_000_000,
      },
      configurable: true,
    });

    const monitor = createMemoryMonitor({ onPressureChange: vi.fn() });
    const info = monitor.current();
    expect(info.level).toBe('moderate');
    expect(info.usedHeapSize).toBe(750_000_000);

    // Restore
    Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });
  });

  it('reports low pressure below 70% threshold', () => {
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 500_000_000,
        totalJSHeapSize: 1_000_000_000,
        jsHeapSizeLimit: 1_000_000_000,
      },
      configurable: true,
    });

    const monitor = createMemoryMonitor({ onPressureChange: vi.fn() });
    const info = monitor.current();
    expect(info.level).toBe('low');

    Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });
  });
});
