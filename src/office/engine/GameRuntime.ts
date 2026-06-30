// Pixi v8 uses generated shader/uniform sync functions by default. Under the
// production CSP (no `unsafe-eval`), Pixi's official workaround is this
// side-effect module, which swaps those runtime generators for no-eval
// polyfills. This does not require weakening missionControlProxy.js CSP.
import 'pixi.js/unsafe-eval';
import {
  Application,
  Container,
  Sprite,
  Assets,
  Texture,
  Spritesheet,
  Text,
  Ticker,
} from 'pixi.js';
import type { Texture as TextureType, RendererPreference } from 'pixi.js';
import {
  gridToScreen,
  getWorldBounds,
  ZONES,
  PROPS,
  isoDepth,
  GRID_COLS,
  GRID_ROWS,
  TILE_W,
  TILE_H,
  CONDUCTOR_ZONE,
  type AgentDesk,
} from '@/office/engine/iso';
import { Agent, type AgentAssetError } from '@/office/entities/Agent';
import { AgentController } from '@/office/entities/AgentController';
import { checkWebGLAvailability } from '@/office/engine/webglDetector';
import { computePerformanceMode, type PerformanceMode } from '@/office/engine/perfMode';
import { createContextLossRecovery, type ContextLossRecovery } from '@/office/engine/contextLossRecovery';
import { QualityManager, type QualityTier, type QualitySettings } from '@/office/engine/QualityManager';
import { debounce } from '@/office/lib/debounce';
import { AmbientLighting } from '@/office/engine/AmbientLighting';

const WORLD_BG = 0x0b111a; // Match dashboard --bg-2
const ATLAS_BASE = '/assets/atlases/';

/**
 * Error raised when atlas assets cannot be loaded after all retry attempts.
 * The OfficeCanvas error screen uses `err instanceof AtlasUnavailableError`
 * to surface the dedicated "assets unavailable" message (Sora audit #3).
 */
export class AtlasUnavailableError extends Error {
  readonly atlasName: string;
  readonly cause: unknown;
  constructor(atlasName: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'AtlasUnavailableError';
    this.atlasName = atlasName;
    this.cause = cause;
  }
}

/** Sentinel used by loadWithTimeoutRetry to distinguish timeouts from rejections. */
class TimeoutMarker extends Error {
  constructor(message: string) { super(message); this.name = 'TimeoutError'; }
}

/**
 * Wrap an async loader with a timeout and optional retry. If `loadFn` neither
 * resolves nor rejects within `timeoutMs`, it is treated as a failure. After
 * `retries` additional attempts also fail, an `AtlasUnavailableError` is
 * thrown so callers can present a clear error state instead of an infinite
 * spinner (Sora stability audit #3, Phase 2).
 *
 * The helper is dependency-free and exported so it can be unit-tested in
 * isolation under the node test environment.
 */
export async function loadWithTimeoutRetry<T>(
  loadFn: () => Promise<T>,
  opts: { timeoutMs?: number; retries?: number; label?: string } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const retries = opts.retries ?? 1;
  const label = opts.label ?? 'asset';

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new TimeoutMarker(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        Promise.resolve(loadFn()).then(resolve, reject);
      });
      if (timer) clearTimeout(timer);
      return result;
    } catch (err) {
      if (timer) clearTimeout(timer);
      lastError = err;
      // Brief backoff before retry to avoid hammering a downed server.
      if (attempt < retries) {
        await new Promise<void>((r) => setTimeout(r, 200));
      }
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new AtlasUnavailableError(label, `${label} unavailable: ${detail}`, lastError);
}

const TASK_ZONE_BY_STATUS: Record<string, string | undefined> = {
  todo: 'collaboration',
  in_progress: 'workstations',
  blocked: 'workstations',
  review: 'collaboration',
  done: 'archive',
};

export interface GameRuntimeOptions {
  container: HTMLElement;
  width: number;
  height: number;
  pixelRatio?: number;
  onSelectAgent?: (id: string | null) => void;
  prefersReducedMotion?: boolean;
  /** Fired when an agent's animation spritesheet fails to load (Sora audit #4 / R12). */
  onAssetError?: (info: AgentAssetError) => void;
  /** Fired when the WebGL context is lost (GPU crash / too many contexts). */
  onContextLost?: () => void;
  /** Fired when the WebGL context is restored after a loss. */
  onContextRestored?: () => void;
  /** Fired when the adaptive quality tier changes (Phase 8 #9). */
  onQualityChange?: (settings: QualitySettings) => void;
  /**
   * Fired when the document becomes visible again after being hidden
   * (Sora stability audit #5). The office should re-fetch the board snapshot
   * to avoid rendering stale agent state. Fires only on the hidden→visible
   * transition, not on the initial visibility check or visible→visible.
   */
  onResume?: () => void;
}

export interface GameRuntimeStats {
  fps: number;
  renderer: string;
  targetFps: number;
  agentCount: number;
  reducedMotion: boolean;
  performanceMode: PerformanceMode;
  qualityTier: QualityTier;
}

export class GameRuntime {
  private app: Application | null = null;
  private world = new Container();
  private floorLayer = new Container();
  private decorLayer = new Container();
  private agentLayer = new Container();
  private fxLayer = new Container();
  private labelLayer = new Container();

  private agents = new Map<string, Agent>();
  private controllers = new Map<string, AgentController>();
  private textures = new Map<string, TextureType>();
  private sheets = new Map<string, Spritesheet>();
  private rendererType = 'unknown';
  private fps = 0;
  private lastFpsUpdate = 0;
  private frameCount = 0;
  private targetFps = 24;
  private performanceMode: GameRuntimeStats['performanceMode'] = 'idle';
  private isDocumentHidden = false;
  private isCanvasVisible = true;
  /**
   * Tracks whether the document was hidden the last time we evaluated
   * visibility. Sora stability audit #5: used to detect the hidden→visible
   * transition so we (a) fully stop the ticker when hidden, (b) restart it
   * when visible again, and (c) fire onResume only on that transition — not
   * on every visibilitychange event.
   */
  private wasDocumentHidden = false;
  private lastDepthSortAt = 0;
  /**
   * performance.now() captured at the last user interaction (pointer, wheel,
   * key, or touch) on the office container. Drives the Phase 8 idle/sleep
   * throttle: after 5 min of no interaction the ticker drops to 1 fps.
   */
  private lastInteractionAt = 0;

  private camera = { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 };
  private followAgentId: string | null = null;
  private worldBounds = getWorldBounds();

  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private contextLossRecovery: ContextLossRecovery | null = null;
  private qualityManager: QualityManager;
  private ambientLighting: AmbientLighting | null = null;
  private debouncedResize: ((w: number, h: number) => void) & { cancel: () => void };
  private tickerCallback: ((ticker: Ticker) => void) | null = null;
  private pendingDesk: AgentDesk | null = null;
  private readonly handleVisibilityChange = () => {
    const nowHidden = document.hidden;
    this.isDocumentHidden = nowHidden;
    // Sora stability audit #5: fully pause the PixiJS ticker when the tab is
    // hidden — the previous implementation only throttled to 4fps, which still
    // burns GPU/CPU for nothing. On the hidden→visible transition, restart
    // the ticker and fire onResume so the office can re-fetch the board
    // snapshot to avoid rendering stale agent state.
    if (!this.app) {
      this.wasDocumentHidden = nowHidden;
      return;
    }
    if (nowHidden) {
      this.app.ticker.stop();
    } else {
      // Only restart + fire onResume if we're transitioning from hidden.
      if (this.wasDocumentHidden) {
        this.app.ticker.start();
        this.options.onResume?.();
      }
    }
    this.wasDocumentHidden = nowHidden;
    this.updatePerformanceMode();
  };
  /** Mark the current moment as a user interaction and re-evaluate perf mode. */
  private readonly handleInteraction = () => {
    this.lastInteractionAt = performance.now();
    // A fresh interaction should immediately wake the ticker if it was asleep.
    this.updatePerformanceMode();
  };

  private options: GameRuntimeOptions;

  constructor(options: GameRuntimeOptions) {
    this.options = options;
    this.world.addChild(this.floorLayer);
    this.world.addChild(this.decorLayer);
    this.world.addChild(this.agentLayer);
    this.world.addChild(this.fxLayer);
    this.world.addChild(this.labelLayer);

    // Phase 8 #9: FPS-based adaptive quality. Tiers adjust particle FX,
    // emote animations, and idle animation speed.
    this.qualityManager = new QualityManager({
      initialTier: options.prefersReducedMotion ? 'low' : 'high',
    });
    this.qualityManager.onChange((settings) => {
      this.options.onQualityChange?.(settings);
    });

    // Phase 8 #14: Debounced resize — collapse rapid ResizeObserver entries
    // (every pixel during a drag) into one renderer resize after 80ms.
    this.debouncedResize = debounce((w: number, h: number) => {
      this.resize(w, h);
    }, 80);
  }

  get pixelRatio() {
    return this.options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
  }

  get rendererName(): string { return this.rendererType; }
  get currentFps(): number { return this.fps; }
  get canvas(): HTMLCanvasElement | null { return this.app?.canvas ?? null; }
  get stats(): GameRuntimeStats {
    return {
      fps: this.fps,
      renderer: this.rendererType,
      targetFps: this.targetFps,
      agentCount: this.agents.size,
      reducedMotion: this.options.prefersReducedMotion ?? false,
      performanceMode: this.performanceMode,
      qualityTier: this.qualityManager.tier,
    };
  }
  /** Whether the WebGL context is currently lost (between loss and restore events). */
  get isContextLost(): boolean { return this.contextLossRecovery?.isLost ?? false; }

  /**
   * Get the screen position of a grid coordinate, accounting for current
   * camera pan/zoom. Used by React overlays (ConductorStation) to position
   * themselves relative to isometric grid locations.
   */
  getScreenPosition(col: number, row: number): { x: number; y: number } {
    if (!this.app) return { x: 0, y: 0 };
    const world = gridToScreen(col, row);
    const { width, height } = this.options;
    const scale = this.camera.zoom;
    return {
      x: width / 2 - this.camera.x * scale + world.x * scale,
      y: height / 2 - this.camera.y * scale + world.y * scale,
    };
  }

  async init(): Promise<void> {
    const app = new Application();
    await app.init({
      width: this.options.width,
      height: this.options.height,
      backgroundColor: WORLD_BG,
      // Phase 8 #15: request WebGL only. Do NOT silently fall back to Canvas2D
      // — the isometric scene depends on WebGL features (spritesheets, depth
      // sorting, filters) that Canvas2D cannot render. If WebGL is unavailable
      // we detect it after init and throw a clear WebGLUnavailableError so the
      // OfficeCanvas / OfficeErrorBoundary UI can surface it with a browser
      // compatibility link instead of showing a broken silent canvas.
      preference: ['webgl'] as RendererPreference[],
      antialias: true,
      resolution: this.pixelRatio,
      autoDensity: true,
      eventMode: 'static',
    });

    // Phase 8 #15: detect silent Canvas2D fallback. Even with preference
    // ['webgl'], a browser that cannot create a WebGL context may still hand
    // back a Canvas renderer. Check the actual renderer type and throw a
    // descriptive error if it is not WebGL (or WebGPU).
    const webglError = checkWebGLAvailability(app.renderer.type as number);
    if (webglError) {
      // Clean up the half-initialised app before propagating.
      app.destroy(true, { children: true, texture: true });
      throw webglError;
    }

    this.app = app;
    // Seed the interaction clock so the very first ticker tick doesn't see
    // an enormous idle delta and immediately drop to sleep mode.
    this.lastInteractionAt = performance.now();
    this.targetFps = this.options.prefersReducedMotion ? 12 : 24;
    app.ticker.maxFPS = this.targetFps;
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.style.display = 'block';
    this.options.container.appendChild(app.canvas);
    this.rendererType = app.renderer.type.toString();

    // Phase 8 #1: WebGL context-loss recovery. When the browser loses the
    // WebGL context (GPU crash, too many contexts), this handler surfaces
    // the loss to the UI and reinitialises textures on restore.
    if (app.canvas instanceof HTMLCanvasElement) {
      this.contextLossRecovery = createContextLossRecovery(app.canvas, {
        onLost: () => {
          console.warn('[GameRuntime] WebGL context lost');
          this.options.onContextLost?.();
        },
        onRestored: async () => {
          console.info('[GameRuntime] WebGL context restored — reinitialising');
          await this.loadAtlases();
          this.paintFloor();
          this.placeProps();
          this.placeZoneLabels();
          this.options.onContextRestored?.();
        },
      });
    }
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.addChild(this.world);

    await this.loadAtlases();

    this.paintFloor();
    this.placeProps();
    this.placeZoneLabels();

    // Phase B: Initialize ambient lighting (warm light pools, CRT glows)
    if (!this.options.prefersReducedMotion) {
      this.ambientLighting = new AmbientLighting(this.fxLayer, {
        reducedMotion: this.options.prefersReducedMotion ?? false,
      });
      this.ambientLighting.createLightPools();
      this.ambientLighting.start();
    }

    if (this.pendingDesk) {
      this.spawnAgent(this.pendingDesk);
      this.pendingDesk = null;
    }

    this.fitCameraToWorld();

    this.tickerCallback = (ticker) => {
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsUpdate >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsUpdate = now;
        // Phase 8 #9: feed FPS to adaptive quality manager once per second.
        this.qualityManager.recordFps(this.fps);
      }
      const agentsMoved = this.updateControllers();
      this.updateCamera(ticker.deltaMS);
      this.sortAgentLayerIfNeeded(now, agentsMoved);
      // Re-evaluate perf mode every tick so the idle→sleep transition fires
      // without waiting for a separate timer. At 1 fps in sleep this still
      // wakes ~once/sec — cheap. The pure compute fn short-circuits fast.
      this.updatePerformanceMode();
    };
    app.ticker.add(this.tickerCallback);

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Phase 8 #14: debounce rapid resize events during drag.
        this.debouncedResize(width, height);
      }
    });
    this.resizeObserver.observe(this.options.container);

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.isDocumentHidden = document.hidden;
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        this.isCanvasVisible = entry ? entry.isIntersecting : true;
        this.updatePerformanceMode();
      }, { threshold: 0.05 });
      this.intersectionObserver.observe(this.options.container);
    }
    this.updatePerformanceMode();

    // Phase 8 idle/sleep: track the last user interaction on the office
    // container so the ticker can drop to 1 fps after 5 min of inactivity.
    this.lastInteractionAt = performance.now();
    const container = this.options.container;
    container.addEventListener('pointerdown', this.handleInteraction, { passive: true });
    container.addEventListener('wheel', this.handleInteraction, { passive: true });
    container.addEventListener('touchstart', this.handleInteraction, { passive: true });
    container.addEventListener('keydown', this.handleInteraction, { passive: true });
    // Make the container focusable so keydown can fire on it.
    if (container.tabIndex < 0) container.tabIndex = 0;

    app.stage.on('pointerdown', (e) => {
      if ((e.target as unknown) === app.stage || e.target === this.world) {
        this.selectAgent(null);
        this.followAgentId = null;
      }
    });
  }

  destroy(): void {
    if (this.tickerCallback && this.app) {
      this.app.ticker.remove(this.tickerCallback);
    }
    this.ambientLighting?.destroy();
    this.contextLossRecovery?.detach();
    this.contextLossRecovery = null;
    this.debouncedResize.cancel();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    // Remove Phase 8 interaction listeners.
    const container = this.options.container;
    container.removeEventListener('pointerdown', this.handleInteraction);
    container.removeEventListener('wheel', this.handleInteraction);
    container.removeEventListener('touchstart', this.handleInteraction);
    container.removeEventListener('keydown', this.handleInteraction);
    for (const controller of this.controllers.values()) {
      controller.destroy();
    }
    this.controllers.clear();
    this.agents.clear();
    this.textures.clear();
    this.sheets.forEach((sheet) => sheet.destroy(true));
    this.sheets.clear();
    this.world.destroy({ children: true });
    this.app?.destroy(true, { children: true, texture: true });
    this.app = null;
  }

  addAgent(desk: AgentDesk): void {
    if (!this.app) {
      this.pendingDesk = desk;
      return;
    }
    this.spawnAgent(desk);
  }

  moveAgent(id: string, col: number, row: number): boolean {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    return controller.moveTo({ col, row });
  }

  selectAgent(id: string | null): void {
    this.agents.forEach((agent, agentId) => {
      agent.setSelected(agentId === id);
    });
    this.options.onSelectAgent?.(id);
  }

  followAgent(id: string | null): void {
    this.followAgentId = id;
  }

  tapAgent(id: string): void {
    this.selectAgent(id);
  }

  focusZone(zoneId: string | null): void {
    this.followAgentId = null;
    if (!zoneId) {
      this.fitCameraToWorld();
      return;
    }
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) return;
    const col = Math.floor((zone.colRange[0] + zone.colRange[1]) / 2);
    const row = Math.floor((zone.rowRange[0] + zone.rowRange[1]) / 2);
    const { x, y } = gridToScreen(col, row);
    this.camera.targetX = x;
    this.camera.targetY = y;
    this.camera.targetZoom = Math.max(this.camera.targetZoom, 1.0);
    this.clampCamera();
  }

  zoneForStatus(status: string): string {
    return TASK_ZONE_BY_STATUS[status] ?? 'collaboration';
  }

  moveAgentByName(name: string, zoneId: string): void {
    const id = this.findAgentIdByName(name);
    if (!id) return;
    const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0];
    const col = Math.floor((zone.colRange[0] + zone.colRange[1]) / 2);
    const row = Math.floor((zone.rowRange[0] + zone.rowRange[1]) / 2);
    this.moveAgent(id, col, row);
  }

  /**
   * Phase 2 fix: bridge the dashboard data layer (useOfficeStore FSM state)
   * to the visual agent layer. The store FSMs derive a target zone from board
   * task status; this routes that zone to the visual AgentController so the
   * living scene actually reflects who is working/blocked/idle. Called by
   * OfficeModule when store agent states change.
   */
  syncAgentZone(agentId: string, zoneId: string): void {
    const controller = this.controllers.get(agentId);
    if (!controller) return;
    // Delegate to the controller's zone-walk logic, which resolves the zone
    // center and paths there. This reuses the same pathfinding fix (#2).
    controller.walkToZoneExternal(zoneId);
  }

  /**
   * Reconnect catch-up — Phase 3 / Sora stability audit #6 / R10.
   *
   * Called by OfficeModule when the Kanban WS reconnects after a drop. For
   * each agent, compares its current visual grid position with its target
   * zone center (derived from the store FSM state) and, if they differ, begins
   * a 1-second ease-out lerp from the old position to the new one instead of
   * snap-teleporting. Agents already at their target are left alone.
   *
   * The `agentZones` map is the per-agent target zone id from the office store
   * FSMs; if an agentId is absent from the map its zone is left unchanged.
   */
  catchUpAllAgents(agentZones: Map<string, string>): void {
    for (const [agentId, zoneId] of agentZones) {
      const controller = this.controllers.get(agentId);
      if (!controller) continue;
      controller.beginCatchUpToZone(zoneId);
    }
  }

  /**
   * Begin catch-up for a single agent by agentId + target zone. Returns true
   * if an animation was started. Convenience wrapper used by the OfficeModule
   * reconnect effect.
   */
  beginCatchUpForAgent(agentId: string, zoneId: string): boolean {
    const controller = this.controllers.get(agentId);
    if (!controller) return false;
    return controller.beginCatchUpToZone(zoneId);
  }

  private findAgentIdByName(name: string): string | undefined {
    const normalized = name.toLowerCase();
    for (const agent of this.agents.values()) {
      if (agent.name.toLowerCase() === normalized) {
        return agent.id;
      }
    }
    return undefined;
  }

  pan(dx: number, dy: number): void {
    this.camera.targetX -= dx / this.camera.zoom;
    this.camera.targetY -= dy / this.camera.zoom;
    this.clampCamera();
  }

  zoom(factor: number, _screenX?: number, _screenY?: number): void {
    const nextZoom = Math.max(0.5, Math.min(3, this.camera.targetZoom * factor));
    this.camera.targetZoom = nextZoom;
    this.clampCamera();
  }

  fitCameraToWorld(): void {
    const { width, height } = this.options;
    const bounds = this.worldBounds;
    const worldW = bounds.maxX - bounds.minX + TILE_W;
    const worldH = bounds.maxY - bounds.minY + TILE_H * 4;

    const padding = 40;
    const zoom = Math.min(
      Math.max(0.5, (width - padding * 2) / worldW),
      Math.max(0.5, (height - padding * 2) / worldH),
      1.2,
    );

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2 - TILE_H * 0.5;

    this.camera.targetX = centerX;
    this.camera.targetY = centerY;
    this.camera.targetZoom = zoom;
    this.camera.x = centerX;
    this.camera.y = centerY;
    this.camera.zoom = zoom;
    this.applyCamera();
  }

  resize(width: number, height: number): void {
    if (!this.app) return;
    this.options.width = width;
    this.options.height = height;
    this.app.renderer.resize(width, height);
    this.app.stage.hitArea = this.app.screen;
    this.clampCamera();
    this.applyCamera();
  }

  private async loadAtlases(): Promise<void> {
    const atlases = ['furniture-0', 'furniture-1', 'agents', 'fx'] as const;
    for (const name of atlases) {
      // Phase 2 / Sora audit #3: wrap the fetch+parse in a 15s timeout with 1
      // retry. A slow or downed asset server previously left an infinite
      // spinner; now we surface AtlasUnavailableError so OfficeCanvas can
      // show a clear "assets unavailable" state.
      const json = await loadWithTimeoutRetry(
        async () => {
          const response = await fetch(`${ATLAS_BASE}${name}.json`);
          if (!response.ok) {
            throw new Error(
              `Failed to load atlas ${name}: ${response.status} ${response.statusText}`,
            );
          }
          return response.json();
        },
        { timeoutMs: 15_000, retries: 1, label: `atlas:${name}:json` },
      );

      const imageName = json.meta?.image ?? `${name}.webp`;
      const image = await loadWithTimeoutRetry<TextureType>(
        () => Assets.load(`${ATLAS_BASE}${imageName}`) as Promise<TextureType>,
        { timeoutMs: 15_000, retries: 1, label: `atlas:${name}:image` },
      );

      const sheet = new Spritesheet({
        texture: image as TextureType,
        data: json,
      });
      await loadWithTimeoutRetry(
        () => sheet.parse(),
        { timeoutMs: 15_000, retries: 1, label: `atlas:${name}:parse` },
      );
      this.sheets.set(name, sheet);
      for (const [key, texture] of Object.entries(sheet.textures)) {
        this.textures.set(`${name}:${key}`, texture as TextureType);
      }
    }
  }

  private paintFloor(): void {
    const allZones = [...ZONES, CONDUCTOR_ZONE];
    const sortedZones = [...allZones].sort((a, b) => {
      const aW = a.isWalkway ? 0 : 1;
      const bW = b.isWalkway ? 0 : 1;
      return aW - bW;
    });

    for (const zone of sortedZones) {
      for (let c = zone.colRange[0]; c <= zone.colRange[1]; c++) {
        for (let r = zone.rowRange[0]; r <= zone.rowRange[1]; r++) {
          if (zone.isWalkway && this.tileCoveredByNamedZone(c, r)) continue;

          const tex = this.textures.get(`furniture-0:${zone.floorFrame}`);
          if (!tex) continue;
          const { x, y } = gridToScreen(c, r);
          const tile = new Sprite(tex);
          tile.x = x;
          tile.y = y;
          tile.anchor.set(0.5, 0.5);
          tile.scale.set(0.5);
          tile.zIndex = isoDepth(c, r);
          if (zone.isWalkway) tile.alpha = 0.4;
          this.floorLayer.addChild(tile);
        }
      }
    }
    this.floorLayer.sortableChildren = true;
  }

  private tileCoveredByNamedZone(col: number, row: number): boolean {
    for (const zone of ZONES) {
      if (zone.isWalkway) continue;
      if (col >= zone.colRange[0] && col <= zone.colRange[1] &&
          row >= zone.rowRange[0] && row <= zone.rowRange[1]) {
        return true;
      }
    }
    return false;
  }

  private placeProps(): void {
    for (const prop of PROPS) {
      const tex = this.textures.get(`${prop.atlas}:${prop.frame}`);
      if (!tex) continue;
      const { x, y } = gridToScreen(prop.col, prop.row);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1);
      sprite.x = x;
      sprite.y = y + (prop.offsetY ?? 0);
      if (prop.scale) sprite.scale.set(prop.scale);
      sprite.zIndex = isoDepth(prop.col, prop.row);
      this.decorLayer.addChild(sprite);
    }
    this.decorLayer.sortableChildren = true;
  }

  private placeZoneLabels(): void {
    for (const zone of ZONES) {
      if (zone.isWalkway) continue;
      const { x, y } = gridToScreen(zone.labelCol, zone.labelRow);
      const label = new Text({
        text: zone.name,
        style: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 14,
          fill: 0xe6edf3,
          align: 'center',
          dropShadow: {
            color: 0x000000,
            blur: 4,
            distance: 0,
            alpha: 0.5,
          },
        },
      });
      label.anchor.set(0.5, 0.5);
      label.x = x;
      label.y = y;
      label.alpha = 0.55;
      label.scale.set(0.75);
      this.labelLayer.addChild(label);
    }
  }

  private spawnAgent(desk: AgentDesk): void {
    if (this.agents.has(desk.id)) return;

    const reducedMotion = this.options.prefersReducedMotion ?? false;

    const baseTexture = this.textures.get(`agents:${desk.id}_base`) ?? Texture.WHITE;
    const blockTexture = this.textures.get(`agents:${desk.id}_block`) ?? undefined;
    const blockedFxTexture = this.textures.get('fx:emote_block') ?? undefined;
    const sheet = this.sheets.get('agents');
    const idleTextures: TextureType[] = [];
    if (sheet?.animations[`${desk.id}_idle`]) {
      idleTextures.push(...(sheet.animations[`${desk.id}_idle`] as TextureType[]));
    }
    if (idleTextures.length === 0 && baseTexture) {
      idleTextures.push(baseTexture);
    }

    const agent = new Agent({
      id: desk.id,
      name: desk.name,
      color: desk.color,
      baseTexture,
      blockTexture,
      blockedFxTexture,
      idleTextures,
      col: desk.deskCol,
      row: desk.deskRow,
      onTap: () => this.selectAgent(desk.id),
      onLongPress: () => this.followAgent(desk.id),
      reducedMotion,
      onAssetError: this.options.onAssetError,
    });

    this.agents.set(desk.id, agent);
    this.agentLayer.addChild(agent.container);

    const controller = new AgentController(agent, reducedMotion);
    controller.onActiveChange = () => this.updatePerformanceMode();
    this.controllers.set(desk.id, controller);

    this.agentLayer.sortableChildren = true;
    this.sortAgentLayer();
  }

  private sortAgentLayer(): void {
    this.agentLayer.children.forEach((child) => {
      const agent = this.findAgentByContainer(child);
      if (agent) {
        child.zIndex = agent.isoDepth;
      }
    });
    this.agentLayer.sortChildren();
  }

  private findAgentByContainer(container: Container): Agent | undefined {
    const values = Array.from(this.agents.values());
    for (const agent of values) {
      if (agent.container === container) return agent;
    }
    return undefined;
  }

  private updateCamera(dt: number): void {
    if (this.followAgentId) {
      const agent = this.agents.get(this.followAgentId);
      if (agent) {
        this.camera.targetX = agent.container.x;
        this.camera.targetY = agent.container.y;
      }
    }

    const t = Math.min(1, 0.12 * (dt / 16.67));
    this.camera.x += (this.camera.targetX - this.camera.x) * t;
    this.camera.y += (this.camera.targetY - this.camera.y) * t;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * t;
    this.applyCamera();
  }

  private updateControllers(): boolean {
    let moved = false;
    for (const controller of Array.from(this.controllers.values())) {
      moved = controller.update() || moved;
    }
    return moved;
  }

  private sortAgentLayerIfNeeded(now: number, agentsMoved: boolean): void {
    // Depth sorting touches every agent; keep ordering correct without doing it
    // on every static frame. Active movement still sorts frequently.
    const interval = this.performanceMode === 'active' ? 120 : 500;
    if (!agentsMoved && now - this.lastDepthSortAt < interval) return;
    this.lastDepthSortAt = now;
    this.sortAgentLayer();
  }

  private updatePerformanceMode(): void {
    if (!this.app) return;
    const { mode, targetFps } = computePerformanceMode({
      isHidden: this.isDocumentHidden || !this.isCanvasVisible,
      anyAgentActive: Array.from(this.controllers.values()).some((c) => c.isActive),
      lastInteractionAt: this.lastInteractionAt,
      now: performance.now(),
      prefersReducedMotion: this.options.prefersReducedMotion ?? false,
    });
    this.performanceMode = mode;
    this.targetFps = targetFps;
    this.app.ticker.maxFPS = this.targetFps;
  }

  private applyCamera(): void {
    const { width, height } = this.options;
    const scale = this.camera.zoom;
    this.world.scale.set(scale);
    this.world.x = width / 2 - this.camera.x * scale;
    this.world.y = height / 2 - this.camera.y * scale;
  }

  private clampCamera(): void {
    const { width, height } = this.options;
    const bounds = this.worldBounds;
    const zoom = this.camera.targetZoom;

    const worldCenterX = (bounds.minX + bounds.maxX) / 2;
    const worldCenterY = (bounds.minY + bounds.maxY) / 2;

    const visibleHalfW = width / (2 * zoom);
    const visibleHalfH = height / (2 * zoom);

    const minX = bounds.minX - TILE_W / 2 + visibleHalfW;
    const maxX = bounds.maxX + TILE_W / 2 - visibleHalfW;
    const minY = bounds.minY - TILE_H + visibleHalfH;
    const maxY = bounds.maxY + TILE_H * 2 - visibleHalfH;

    if (minX <= maxX) {
      this.camera.targetX = Math.max(minX, Math.min(maxX, this.camera.targetX));
    } else {
      this.camera.targetX = worldCenterX;
    }
    if (minY <= maxY) {
      this.camera.targetY = Math.max(minY, Math.min(maxY, this.camera.targetY));
    } else {
      this.camera.targetY = worldCenterY;
    }
  }
}

export { getWorldBounds, GRID_COLS, GRID_ROWS, TILE_W, TILE_H };
export type { AgentDesk };
