/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameRuntime } from './GameRuntime';
import { IDLE_TIMEOUT_MS, TARGET_FPS, TARGET_FPS_REDUCED } from './perfMode';

// Hoist mockTicker so it's accessible both inside the factory and in the test body.
const mockTicker = vi.hoisted(() => ({
  maxFPS: 60,
  add: vi.fn(),
  remove: vi.fn(),
  stop: vi.fn(),
  start: vi.fn(),
  deltaMS: 16.67,
}));

const mockPixiCspShimLoaded = vi.hoisted(() => vi.fn());

vi.mock('pixi.js/unsafe-eval', () => {
  mockPixiCspShimLoaded();
  return {};
});

vi.mock('pixi.js', () => {
  const mockApp = {
    init: vi.fn().mockResolvedValue(undefined),
    renderer: {
      type: 1, // WebGL
      resize: vi.fn(),
    },
    ticker: mockTicker,
    canvas: document.createElement('canvas'),
    stage: {
      eventMode: 'static',
      hitArea: {},
      addChild: vi.fn(),
      on: vi.fn(),
    },
    destroy: vi.fn(),
  };

  const makeContainer = () => ({
      addChild: vi.fn(),
      sortableChildren: false,
      sortChildren: vi.fn(),
      position: { set: vi.fn() },
      scale: { set: vi.fn() },
      destroy: vi.fn(),
    });
  const makeSprite = () => ({
      anchor: { set: vi.fn() },
      scale: { set: vi.fn() },
      x: 0,
      y: 0,
      zIndex: 0,
      alpha: 1,
    });

  return {
    Application: vi.fn(function () { return mockApp; }),
    Container: vi.fn(function () { return makeContainer(); }),
    Sprite: vi.fn(function () { return makeSprite(); }),
    Assets: {
      load: vi.fn().mockResolvedValue({}),
    },
    Texture: { WHITE: {} },
    Spritesheet: vi.fn(function () {
      return {
        animations: {},
        textures: {},
        parse: vi.fn().mockResolvedValue(undefined),
      };
    }),
    Text: vi.fn(function () {
      return {
        anchor: { set: vi.fn() },
        scale: { set: vi.fn() },
        x: 0,
        y: 0,
        alpha: 1,
      };
    }),
    Graphics: vi.fn(function () {
      return {
        circle: vi.fn().mockReturnThis(),
        fill: vi.fn().mockReturnThis(),
        roundRect: vi.fn().mockReturnThis(),
        stroke: vi.fn().mockReturnThis(),
        clear: vi.fn(),
        x: 0,
        y: 0,
        zIndex: 0,
        alpha: 1,
      };
    }),
    Ticker: {
      shared: mockTicker,
    },
  };
});

// Mock webglDetector
vi.mock('./webglDetector', () => ({
  checkWebGLAvailability: vi.fn(() => null),
  isWebGLUnavailableError: vi.fn(() => false),
  WEBGL_COMPATIBILITY_URL: 'mock-url',
}));

// Mock intersectionObserver and resizeObserver — must be constructors so
// `new IntersectionObserver(cb)` works, and `vi.fn()` wrappers keep `.mock`
// available for tests that need to grab the callback passed at construction.
const intersectionObserverCtor = vi.fn(function (this: any, callback: any) {
  this.callback = callback;
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});
const resizeObserverCtor = vi.fn(function (this: any) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});
globalThis.IntersectionObserver = intersectionObserverCtor as any;
globalThis.ResizeObserver = resizeObserverCtor as any;

// Mock fetch for loadAtlases — returns minimal valid atlas JSON so init() proceeds.
const mockAtlasJson = {
  meta: { image: 'atlas.webp', size: { w: 256, h: 256 } },
  frames: {},
  animations: {},
};
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve(mockAtlasJson),
  text: () => Promise.resolve(JSON.stringify(mockAtlasJson)),
}) as any;

const mockAgent = { container: { x: 0, y: 0 }, id: 'agent1', name: 'Agent 1', setSelected: vi.fn() };
const mockController = {
  isActive: false, // Default to not active
  update: vi.fn(() => false),
  moveTo: vi.fn(() => true),
  onActiveChange: vi.fn(),
  walkToZoneExternal: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('@/office/entities/Agent', () => ({
  Agent: vi.fn(() => mockAgent),
}));

vi.mock('@/office/entities/AgentController', () => ({
  AgentController: vi.fn(() => mockController),
}));

// Mock performance.now()
const MOCK_START_TIME = 100000;
let mockNow = MOCK_START_TIME;
vi.spyOn(performance, 'now').mockImplementation(() => mockNow);

// Mock document.hidden — a getter backed by a mutable variable. We set the
// variable directly; we do NOT call .mockReturnValue on the getter (that was
// a bug in an earlier version that threw "document.hidden.mockReturnValue
// is not a function").
let mockDocumentHidden = false;
Object.defineProperty(document, 'hidden', {
  get: () => mockDocumentHidden,
  configurable: true,
});

describe('GameRuntime performance mode handling (t_aeececba)', () => {
  let container: HTMLDivElement;
  let runtime: GameRuntime;

  beforeEach(() => {
    container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, toJSON: vi.fn() } as DOMRect);
    mockNow = MOCK_START_TIME;
    mockDocumentHidden = false;
    mockTicker.maxFPS = 60; // Reset maxFPS for each test
    mockTicker.stop.mockClear();
    mockTicker.start.mockClear();
    mockController.isActive = false;
    intersectionObserverCtor.mockClear();
    resizeObserverCtor.mockClear();
    runtime = new GameRuntime({ container, width: 800, height: 600 });
  });

  it('loads the Pixi no-eval CSP shim at the runtime boundary', () => {
    expect(mockPixiCspShimLoaded).toHaveBeenCalledTimes(1);
  });

  it('sets targetFps to hidden when document is hidden', async () => {
    await runtime.init();
    mockDocumentHidden = true;
    // Directly call the private method to update performance mode
    (runtime as any).handleVisibilityChange();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.hidden);
    expect((runtime as any).performanceMode).toBe('hidden');
  });

  it('sets targetFps to hidden when canvas is not visible (unintersecting)', async () => {
    await runtime.init();
    // Grab the callback passed to the IntersectionObserver constructor.
    const observerCallback = intersectionObserverCtor.mock.calls[0][0];
    observerCallback([{ isIntersecting: false, target: container } as unknown as IntersectionObserverEntry], null as any);
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.hidden);
    expect((runtime as any).performanceMode).toBe('hidden');
  });

  it('sets targetFps to sleep after idle timeout', async () => {
    await runtime.init();
    mockNow += IDLE_TIMEOUT_MS; // Advance time past idle timeout
    // Directly call the private method to update performance mode
    (runtime as any).updatePerformanceMode();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.sleep);
    expect((runtime as any).performanceMode).toBe('sleep');
  });

  it('sets targetFps to active when agents are moving', async () => {
    await runtime.init();
    // Inject the mock controller into the runtime so anyAgentActive is true.
    (runtime as any).controllers.set('test', mockController);
    mockController.isActive = true; // Simulate active agent
    // Directly call the private method to update performance mode
    (runtime as any).updatePerformanceMode();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.active);
    expect((runtime as any).performanceMode).toBe('active');
  });

  it('sleep mode takes precedence over active mode if idle timeout is reached', async () => {
    await runtime.init();
    mockNow += IDLE_TIMEOUT_MS; // Advance time past idle timeout
    mockController.isActive = true; // Simulate active agent
    // Directly call the private method to update performance mode
    (runtime as any).updatePerformanceMode();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.sleep);
    expect((runtime as any).performanceMode).toBe('sleep');
  });

  it('hidden mode takes precedence over sleep and active modes', async () => {
    await runtime.init();
    mockDocumentHidden = true; // Document is hidden
    mockNow += IDLE_TIMEOUT_MS; // Advance time past idle timeout
    mockController.isActive = true; // Simulate active agent
    // Directly call the private method to update performance mode
    (runtime as any).handleVisibilityChange();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.hidden);
    expect((runtime as any).performanceMode).toBe('hidden');
  });

  it('honors prefersReducedMotion for active and idle modes', async () => {
    runtime = new GameRuntime({ container, width: 800, height: 600, prefersReducedMotion: true });
    await runtime.init();
    // Inject the mock controller into the runtime so anyAgentActive is true.
    (runtime as any).controllers.set('test', mockController);

    // Active mode with reduced motion
    mockController.isActive = true;
    (runtime as any).updatePerformanceMode();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS_REDUCED.active);
    expect((runtime as any).performanceMode).toBe('active');

    // Idle mode with reduced motion
    mockController.isActive = false;
    (runtime as any).updatePerformanceMode();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS_REDUCED.idle);
    expect((runtime as any).performanceMode).toBe('idle');
  });

  it('a user interaction resets idle timeout and returns to idle/active', async () => {
    await runtime.init();
    // Inject the mock controller into the runtime so anyAgentActive is true.
    (runtime as any).controllers.set('test', mockController);
    mockNow = MOCK_START_TIME + IDLE_TIMEOUT_MS; // Now in sleep mode
    (runtime as any).updatePerformanceMode();
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.sleep);

    mockNow += 100; // Simulate time passing after interaction
    (runtime as any).handleInteraction(); // Simulate interaction
    (runtime as any).updatePerformanceMode(); // Trigger update performance mode
    expect((runtime as any).lastInteractionAt).toBe(mockNow);
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.idle); // Should go back to idle

    mockController.isActive = true;
    (runtime as any).handleInteraction(); // Simulate interaction
    (runtime as any).updatePerformanceMode(); // Trigger update performance mode
    expect((runtime as any).lastInteractionAt).toBe(mockNow);
    expect(mockTicker.maxFPS).toBe(TARGET_FPS.active); // Should go back to active
  });

  // ── Sora stability audit #5: full ticker pause on hidden + resume ──────────
  //
  // The previous perf-mode implementation only throttled the ticker to 4fps
  // when the tab was hidden. That still burns GPU/CPU for nothing. The audit
  // requires a *full* ticker stop when the document is hidden, plus a board
  // re-sync when the tab returns to avoid stale state. These tests pin both
  // behaviors at the GameRuntime boundary:
  //   - handleVisibilityChange() calls app.ticker.stop() when hidden
  //   - handleVisibilityChange() calls app.ticker.start() when visible again
  //   - the onResume callback fires only on the hidden→visible transition
  describe('visibility-driven ticker pause/resume (audit #5)', () => {
    it('stops the ticker fully when the document becomes hidden', async () => {
      await runtime.init();
      mockTicker.stop.mockClear();
      mockTicker.start.mockClear();
      mockDocumentHidden = true;
      (runtime as any).handleVisibilityChange();
      expect(mockTicker.stop).toHaveBeenCalledTimes(1);
      expect(mockTicker.start).not.toHaveBeenCalled();
    });

    it('restarts the ticker and fires onResume when the document becomes visible', async () => {
      const onResume = vi.fn();
      runtime = new GameRuntime({ container, width: 800, height: 600, onResume });
      await runtime.init();

      // Hide
      mockDocumentHidden = true;
      (runtime as any).handleVisibilityChange();

      // Resume
      mockTicker.start.mockClear();
      mockTicker.stop.mockClear();
      onResume.mockClear();
      mockDocumentHidden = false;
      (runtime as any).handleVisibilityChange();

      expect(mockTicker.start).toHaveBeenCalledTimes(1);
      expect(mockTicker.stop).not.toHaveBeenCalled();
      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('does not fire onResume on the initial visibility check when already visible', async () => {
      const onResume = vi.fn();
      runtime = new GameRuntime({ container, width: 800, height: 600, onResume });
      await runtime.init();
      expect(onResume).not.toHaveBeenCalled();
    });

    it('does not fire onResume when transitioning hidden→hidden (no-op)', async () => {
      const onResume = vi.fn();
      runtime = new GameRuntime({ container, width: 800, height: 600, onResume });
      await runtime.init();

      // First hide
      mockDocumentHidden = true;
      (runtime as any).handleVisibilityChange();

      // Second hide (stays hidden)
      onResume.mockClear();
      (runtime as any).handleVisibilityChange();
      expect(onResume).not.toHaveBeenCalled();
    });

    it('does not restart the ticker when transitioning visible→visible', async () => {
      await runtime.init();
      mockTicker.start.mockClear();
      mockTicker.stop.mockClear();
      // Already visible, trigger again
      (runtime as any).handleVisibilityChange();
      expect(mockTicker.start).not.toHaveBeenCalled();
      expect(mockTicker.stop).not.toHaveBeenCalled();
    });
  });

});
