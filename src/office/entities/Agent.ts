import {
  Container,
  Sprite,
  AnimatedSprite,
  Graphics,
  Spritesheet,
  Texture,
  Assets,
  Text,
  TextStyle,
} from 'pixi.js';
import type { Texture as TextureType } from 'pixi.js';
import { gridToScreen, isoDepth } from '@/office/engine/iso';

const ATLAS_BASE = '/assets/atlases/';

export type AnimationId = 'idle' | 'walk' | 'work' | 'cheer' | 'block';

/** Payload delivered to {@link AgentOptions.onAssetError} when a spritesheet fails to load. */
export interface AgentAssetError {
  agentId: string;
  animType: string;
  error: unknown;
}

/**
 * Report a spritesheet load failure. In dev mode, logs a `console.warn` so
 * developers see the failure instead of a silently-frozen agent. Always
 * invokes the optional `onAssetError` callback (if provided) so the dashboard
 * can surface a subtle indicator — a broken handler must NOT crash the agent's
 * animation fallback, so callback errors are caught and swallowed.
 *
 * Exported as a pure function so it can be unit-tested in the node test
 * environment without Pixi/fetch.
 *
 * Sora stability audit #4 / R12.
 */
export function reportAssetError(
  agentId: string,
  animType: string,
  error: unknown,
  isDev: boolean,
  onAssetError?: (info: AgentAssetError) => void,
): void {
  if (isDev) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[3D Office] Agent "${agentId}" spritesheet "${animType}" failed: ${detail}`);
  }
  if (onAssetError) {
    try {
      onAssetError({ agentId, animType, error });
    } catch {
      // A broken dashboard handler must not crash the animation fallback.
    }
  }
}

export interface AgentOptions {
  id: string;
  name: string;
  color: number;
  baseTexture: TextureType;
  blockTexture?: TextureType;
  idleTextures: TextureType[];
  col: number;
  row: number;
  onTap?: () => void;
  onLongPress?: () => void;
  reducedMotion?: boolean;
  blockedFxTexture?: TextureType;
  /** Fired when an animation spritesheet fails to load. See {@link reportAssetError}. */
  onAssetError?: (info: AgentAssetError) => void;
}

export class Agent {
  readonly id: string;
  readonly name: string;
  readonly color: number;

  container: Container;
  private shadow: Sprite;
  private body: AnimatedSprite | Sprite;
  private halo: Graphics;
  private statusCallout: Container | null = null;
  private _col: number;
  private _row: number;

  private baseTexture: TextureType;
  private blockTexture: TextureType;
  private blockedFxTexture: TextureType | null;
  private idleTextures: TextureType[];
  private animSheets = new Map<string, Spritesheet>();
  private loadedAnimTypes = new Set<string>();
  private currentAnim: AnimationId = 'idle';
  private reducedMotion: boolean;
  private blockedFx: Container | null = null;
  private blockedFxRaf: number | null = null;
  private haloRaf: number | null = null;
  private statusCalloutRaf: number | null = null;
  private statusCalloutTimeout: ReturnType<typeof setTimeout> | null = null;
  private onAssetError?: (info: AgentAssetError) => void;

  // Phase B: Desk indicators
  private monitorGlow: Graphics | null = null;
  private projectBadge: Container | null = null;
  /** Presence alpha — 1.0 = present, 0.7 = away, 0 = absent */
  private presenceAlpha: number = 1.0;

  // State badge indicator (pixi.js overlay above agent head)
  private stateBadge: Container | null = null;
  private stateBadgeText: Text | null = null;
  private stateBadgeRaf: number | null = null;
  private stateBadgeAnimated: boolean = false;
  private stateBadgeFrame: number = 0;
  private stateBadgeLastFrameAt: number = 0;

  constructor(options: AgentOptions) {
    this.id = options.id;
    this.name = options.name;
    this.color = options.color;
    this._col = options.col;
    this._row = options.row;
    this.baseTexture = options.baseTexture;
    this.blockTexture = options.blockTexture ?? options.baseTexture;
    this.blockedFxTexture = options.blockedFxTexture ?? null;
    this.idleTextures = options.idleTextures;
    this.reducedMotion = options.reducedMotion ?? false;
    this.onAssetError = options.onAssetError;

    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    // Shadow
    this.shadow = new Sprite(Texture.WHITE);
    this.shadow.anchor.set(0.5, 0.5);
    this.shadow.width = 48;
    this.shadow.height = 20;
    this.shadow.alpha = 0.25;
    this.shadow.tint = 0x000000;
    this.shadow.y = 4;
    this.container.addChild(this.shadow);

    // Body
    let body: AnimatedSprite | Sprite;
    if (!this.reducedMotion && options.idleTextures.length > 1) {
      const anim = new AnimatedSprite(options.idleTextures);
      anim.animationSpeed = 0.15;
      anim.loop = true;
      anim.play();
      body = anim;
    } else {
      body = new Sprite(options.idleTextures[0] ?? options.baseTexture);
    }
    this.body = body;
    this.body.anchor.set(0.5, 1);
    this.body.y = 4;
    this.body.scale.set(0.95);
    this.container.addChild(this.body);

    // Selection halo
    this.halo = new Graphics();
    this.drawHalo(0);
    this.halo.visible = false;
    this.halo.y = -52;
    this.container.addChild(this.halo);

    this.setGrid(options.col, options.row);

    // Tap + long-press
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;
    const LONG_PRESS_MS = 500;

    this.container.on('pointerdown', (e: unknown) => {
      const ev = e as { stopPropagation?: () => void };
      ev.stopPropagation?.();
      isLongPress = false;
      if (options.onLongPress) {
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          options.onLongPress?.();
        }, LONG_PRESS_MS);
      }
    });

    this.container.on('pointerup', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (!isLongPress) {
        options.onTap?.();
      }
    });

    this.container.on('pointerupoutside', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    void this.loadAnimSheet('idle');
  }

  get col(): number { return this._col; }
  get row(): number { return this._row; }
  get isoDepth(): number { return isoDepth(this._col, this._row); }

  setGrid(col: number, row: number): void {
    this._col = col;
    this._row = row;
    const { x, y } = gridToScreen(col, row);
    this.container.x = x;
    this.container.y = y;
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  setSelected(selected: boolean): void {
    this.halo.visible = selected;
    if (selected && !this.reducedMotion) {
      this.pulseHalo();
    } else {
      this.stopHaloPulse();
    }
  }

  async setAnimation(id: AnimationId): Promise<void> {
    if (this.currentAnim === id) return;
    this.currentAnim = id;
    const textures = await this.resolveTextures(id);
    this.swapBody(textures, id);
  }

  // ─── Phase B: Desk Indicators ──────────────────────────────────────────

  /**
   * Set the monitor glow behind the agent's desk monitor.
   * @param show - Whether to show the glow
   * @param glowColor - Color of the glow (hex number)
   * @param alpha - Opacity of the glow
   */
  showMonitorGlow(glowColor: number, alpha: number): void {
    this.hideMonitorGlow();
    const glow = new Graphics();
    const radius = 40;
    const steps = 4;
    for (let s = steps; s >= 0; s--) {
      const t = s / steps;
      const r = radius * (0.5 + t * 0.5);
      const a = alpha * Math.pow(1 - t, 2.5);
      glow.circle(0, 0, r);
      glow.fill({ color: glowColor, alpha: a });
    }
    // Position behind the monitor — monitor is at y-offset −28 from desk center,
    // agent body is at y −40. Place glow above the agent.
    glow.y = -68;
    this.monitorGlow = glow;
    this.container.addChildAt(glow, 0); // Behind everything
  }

  hideMonitorGlow(): void {
    if (this.monitorGlow) {
      this.container.removeChild(this.monitorGlow);
      this.monitorGlow.destroy();
      this.monitorGlow = null;
    }
  }

  /**
   * Set the project badge (active project name label above desk).
   * @param text - Project name (max 16 chars, truncated with …)
   */
  showProjectBadge(text: string): void {
    this.hideProjectBadge();

    const displayText = text.length > 16
      ? text.slice(0, 15) + '\u2026'
      : text;

    const badgeText = new Text({
      text: displayText,
      style: new TextStyle({
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9,
        fill: 0xffffff,
      }),
    });
    badgeText.anchor.set(0.5, 0.5);
    badgeText.alpha = 0.85;

    const padding = 6;
    const bg = new Graphics();
    const width = badgeText.width + padding * 2;
    const height = badgeText.height + padding * 2;
    bg.roundRect(-width / 2, -height / 2, width, height, 6);
    bg.fill({ color: 0xd4943a, alpha: 0.15 }); // Guild amber at 15%

    const container = new Container();
    container.addChild(bg);
    container.addChild(badgeText);
    container.y = -82; // Spec: y-offset −82px from desk center

    this.projectBadge = container;
    this.container.addChild(container);
  }

  hideProjectBadge(): void {
    if (this.projectBadge) {
      this.container.removeChild(this.projectBadge);
      this.projectBadge.destroy({ children: true });
      this.projectBadge = null;
    }
  }

  /**
   * Show a compact operational state badge above the agent's head.
   * @param label - Short truth/workflow label to display
   * @param animated - Whether to animate (for working activity)
   */
  showStateBadge(label: string, animated: boolean = false): void {
    // Remove existing indicator if present
    this.hideStateBadge();

    const fontSize = 10;
    const padding = 6;

    const style = new TextStyle({
      fontSize,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fill: 0xf0e8d8,
      fontWeight: '600',
      letterSpacing: 0.6,
      lineHeight: fontSize + 3,
    });

    const text = new Text({ text: label, style });
    text.anchor.set(0.5, 0.5);

    const bg = new Graphics();
    const bgWidth = Math.max(text.width + padding * 2, 44);
    const bgHeight = Math.max(text.height + padding * 2, 22);
    bg.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 5);
    bg.fill({ color: 0x05070d, alpha: 0.82 });
    bg.stroke({ color: 0xd4943a, width: 1, alpha: 0.42 });

    const container = new Container();
    container.addChild(bg);
    container.addChild(text);
    // Position above other operational overlays without reading as chatter.
    container.y = -116;

    this.stateBadge = container;
    this.stateBadgeText = text;
    this.stateBadgeAnimated = animated;
    this.stateBadgeFrame = 0;
    this.stateBadgeLastFrameAt = 0;

    this.container.addChild(container);

    // Start subtle text animation for working state
    if (animated) {
      this.startStateBadgePulse();
    }
  }

  /**
   * Hide and destroy the state badge indicator.
   */
  hideStateBadge(): void {
    this.stopStateBadgePulse();
    if (this.stateBadge) {
      this.container.removeChild(this.stateBadge);
      this.stateBadge.destroy({ children: true });
      this.stateBadge = null;
      this.stateBadgeText = null;
      this.stateBadgeAnimated = false;
    }
  }

  /**
   * Animate the working indicator by cycling through restrained labels.
   * Runs via requestAnimationFrame.
   */
  private startStateBadgePulse(): void {
    if (this.stateBadgeRaf !== null || this.reducedMotion) return;

    const DOT_FRAMES = ['WORK', 'WORK ·', 'WORK ··'];
    const FRAME_DURATION_MS = 600;

    const animate = (now: number) => {
      if (!this.stateBadgeText || !this.stateBadgeAnimated) {
        this.stateBadgeRaf = null;
        return;
      }
      if (this.stateBadgeLastFrameAt === 0) {
        this.stateBadgeLastFrameAt = now;
      }
      if (now - this.stateBadgeLastFrameAt >= FRAME_DURATION_MS) {
        this.stateBadgeFrame = (this.stateBadgeFrame + 1) % DOT_FRAMES.length;
        this.stateBadgeLastFrameAt = now;
        // Update text with gentle alpha pulse
        this.stateBadgeText.text = DOT_FRAMES[this.stateBadgeFrame];
        this.stateBadgeText.alpha = 0.7 + 0.3 * Math.sin(this.stateBadgeFrame * (Math.PI * 2 / DOT_FRAMES.length));
      }
      this.stateBadgeRaf = requestAnimationFrame(animate);
    };

    this.stateBadgeRaf = requestAnimationFrame(animate);
  }

  private stopStateBadgePulse(): void {
    if (this.stateBadgeRaf !== null) {
      cancelAnimationFrame(this.stateBadgeRaf);
      this.stateBadgeRaf = null;
    }
  }

  /**
   * Set agent presence alpha.
   * @param alpha - 1.0 = present (online/active), 0.7 = away (idle but online), 0 = absent
   */
  setPresence(alpha: number): void {
    this.presenceAlpha = alpha;
    this.body.alpha = alpha;
    this.shadow.alpha = 0.25 * alpha;
    // When absent, hide the state badge indicator
    if (alpha <= 0 && this.stateBadge) {
      this.stateBadge.visible = false;
    } else if (alpha > 0 && this.stateBadge) {
      // Restore the appropriate badge for offline → back online
      this.stateBadge.visible = true;
    }
  }

  get presence(): number {
    return this.presenceAlpha;
  }

  // ─── Existing methods ──────────────────────────────────────────────────

  showBlockedFx(): void {
    if (this.blockedFx) return;

    const fx = new Container();

    if (this.blockedFxTexture) {
      const sprite = new Sprite(this.blockedFxTexture);
      sprite.anchor.set(0.5, 1);
      sprite.scale.set(0.6);
      fx.addChild(sprite);
    } else {
      const bg = new Graphics();
      bg.circle(0, 0, 10);
      bg.fill({ color: 0xff4444, alpha: 0.9 });
      bg.stroke({ color: 0xcc0000, width: 1.5 });
      fx.addChild(bg);

      const label = new Text({
        text: '!',
        style: {
          fontSize: 14,
          fill: 0xffffff,
          fontWeight: 'bold',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      });
      label.anchor.set(0.5, 0.55);
      fx.addChild(label);
    }

    fx.y = -100; // Spec: y-offset −100px from desk center (above monitor)
    this.container.addChild(fx);
    this.blockedFx = fx;

    if (!this.reducedMotion) {
      let phase = 0;
      const animate = () => {
        if (!this.blockedFx) return;
        phase += 0.06;
        this.blockedFx.alpha = 0.6 + 0.4 * Math.abs(Math.sin(phase));
        this.blockedFxRaf = requestAnimationFrame(animate);
      };
      this.blockedFxRaf = requestAnimationFrame(animate);
    }
  }

  showBlockedFxAmber(): void {
    // Phase B: Show amber blocker (aged/stale block >1hr)
    if (this.blockedFx) return;

    const fx = new Container();
    const bg = new Graphics();
    bg.circle(0, 0, 10);
    bg.fill({ color: 0xffb000, alpha: 0.9 }); // CRT amber
    bg.stroke({ color: 0xcc8800, width: 1.5 });
    fx.addChild(bg);

    const label = new Text({
      text: '!',
      style: {
        fontSize: 14,
        fill: 0xffffff,
        fontWeight: 'bold',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
    });
    label.anchor.set(0.5, 0.55);
    fx.addChild(label);

    fx.y = -100;
    this.container.addChild(fx);
    this.blockedFx = fx;

    if (!this.reducedMotion) {
      let phase = 0;
      const animate = () => {
        if (!this.blockedFx) return;
        phase += 0.06;
        this.blockedFx.alpha = 0.6 + 0.4 * Math.abs(Math.sin(phase));
        this.blockedFxRaf = requestAnimationFrame(animate);
      };
      this.blockedFxRaf = requestAnimationFrame(animate);
    }
  }

  hideBlockedFx(): void {
    if (this.blockedFxRaf !== null) {
      cancelAnimationFrame(this.blockedFxRaf);
      this.blockedFxRaf = null;
    }
    if (this.blockedFx) {
      this.container.removeChild(this.blockedFx);
      this.blockedFx.destroy({ children: true });
      this.blockedFx = null;
    }
  }

  destroy(): void {
    this.hideBlockedFx();
    this.hideMonitorGlow();
    this.hideProjectBadge();
    this.hideStateBadge();
    this.stopHaloPulse();
    this.clearStatusCallout();
    this.container.destroy({ children: true });
  }

  showStatusCallout(text: string, duration: number = 3000): void {
    this.clearStatusCallout();

    const displayText = text.length > 40 ? text.slice(0, 39) + '\u2026' : text;

    const callout = new Container();
    const padding = 8;
    const style = new TextStyle({
      fontSize: 10,
      fill: 0xbecde1,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      wordWrap: true,
      wordWrapWidth: 200,
    });
    const textObj = new Text({ text: displayText, style });
    textObj.anchor.set(0.5);

    const bg = new Graphics();
    const bgWidth = textObj.width + padding * 2;
    const bgHeight = textObj.height + padding * 2;
    bg.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 5);
    bg.fill({ color: 0x05070d, alpha: 0.88 });
    bg.stroke({ color: 0xd4943a, width: 1, alpha: 0.32 });

    callout.addChild(bg);
    callout.addChild(textObj);
    callout.y = -82;

    this.container.addChild(callout);
    this.statusCallout = callout;

    if (this.reducedMotion) {
      callout.alpha = 1;
      this.statusCalloutTimeout = setTimeout(() => {
        if (this.statusCallout === callout) {
          this.clearStatusCallout();
        }
      }, duration + 300);
      return;
    }

    callout.alpha = 0;
    const startTime = performance.now();
    const fadeInMs = 300;
    const fadeOutMs = 500;

    const animate = (): void => {
      if (!this.statusCallout || this.statusCallout !== callout) return;
      const elapsed = performance.now() - startTime;

      if (elapsed < fadeInMs) {
        callout.alpha = elapsed / fadeInMs;
      } else if (elapsed < fadeInMs + duration) {
        callout.alpha = 1;
      } else if (elapsed < fadeInMs + duration + fadeOutMs) {
        const fadeProgress = (elapsed - fadeInMs - duration) / fadeOutMs;
        callout.alpha = 1 - fadeProgress;
      } else {
        if (this.statusCallout === callout) {
          this.clearStatusCallout();
        }
        return;
      }
      this.statusCalloutRaf = requestAnimationFrame(animate);
    };
    this.statusCalloutRaf = requestAnimationFrame(animate);
  }

  private async loadAnimSheet(type: string): Promise<void> {
    if (this.loadedAnimTypes.has(type)) return;
    this.loadedAnimTypes.add(type);

    try {
      const jsonUrl = `${ATLAS_BASE}${this.id}_${type}.json`;
      const resp = await fetch(jsonUrl);
      if (!resp.ok) return;

      const json = await resp.json();
      const imageName = json.meta?.image ?? `${this.id}_${type}.webp`;
      const imageUrl = `${ATLAS_BASE}${imageName}`;
      const image = await Assets.load(imageUrl);

      const sheet = new Spritesheet({
        texture: image as TextureType,
        data: json,
      });
      await sheet.parse();
      this.animSheets.set(type, sheet);
    } catch (err) {
      reportAssetError(this.id, type, err, import.meta.env?.DEV ?? false, this.onAssetError);
    }
  }

  private async resolveTextures(id: AnimationId): Promise<TextureType[]> {
    if (id === 'block') {
      return [this.blockTexture];
    }

    await this.loadAnimSheet(id);

    const sheet = this.animSheets.get(id);
    if (sheet) {
      const animKey = `${this.id}_${id}`;
      const frames = sheet.animations[animKey] as TextureType[] | undefined;
      if (frames && frames.length > 0) {
        return frames;
      }
    }

    if (id !== 'idle') {
      const idleSheet = this.animSheets.get('idle');
      if (idleSheet) {
        const idleAnim = idleSheet.animations[`${this.id}_idle`] as TextureType[] | undefined;
        if (idleAnim && idleAnim.length > 0) return idleAnim;
      }
    }
    return this.idleTextures.length > 0 ? this.idleTextures : [this.baseTexture];
  }

  private swapBody(textures: TextureType[], id: AnimationId): void {
    const oldBody = this.body;
    const isAnimated = textures.length > 1 && !this.reducedMotion;

    if (isAnimated) {
      const anim = new AnimatedSprite(textures);
      anim.animationSpeed = id === 'walk' ? 0.2 : id === 'cheer' ? 0.18 : 0.15;
      anim.loop = id !== 'cheer';
      anim.anchor.set(0.5, 1);
      anim.y = 4;
      anim.scale.set(0.95);
      anim.play();
      if (!anim.loop) {
        anim.onComplete = () => {
          if (this._onAnimComplete) this._onAnimComplete(id);
        };
      }
      this.body = anim;
    } else {
      const sprite = new Sprite(textures[0] ?? this.baseTexture);
      sprite.anchor.set(0.5, 1);
      sprite.y = 4;
      sprite.scale.set(0.95);
      this.body = sprite;
    }

    this.container.addChildAt(this.body, this.container.getChildIndex(oldBody));
    this.container.removeChild(oldBody);
    oldBody.destroy();
  }

  private _onAnimComplete?: (id: AnimationId) => void;

  setOnAnimComplete(cb: (id: AnimationId) => void): void {
    this._onAnimComplete = cb;
  }

  private pulseHalo(): void {
    if (!this.halo.visible || this.haloRaf !== null) return;
    let phase = 0;
    const animate = () => {
      if (!this.halo.visible) {
        this.haloRaf = null;
        return;
      }
      phase += 0.08;
      const alpha = 0.5 + 0.35 * Math.sin(phase);
      const scale = 1 + 0.06 * Math.sin(phase + Math.PI / 2);
      this.halo.alpha = alpha;
      this.halo.scale.set(scale);
      this.haloRaf = requestAnimationFrame(animate);
    };
    this.haloRaf = requestAnimationFrame(animate);
  }

  private stopHaloPulse(): void {
    if (this.haloRaf !== null) {
      cancelAnimationFrame(this.haloRaf);
      this.haloRaf = null;
    }
    this.halo.alpha = 1;
    this.halo.scale.set(1);
  }

  private clearStatusCallout(): void {
    if (this.statusCalloutRaf !== null) {
      cancelAnimationFrame(this.statusCalloutRaf);
      this.statusCalloutRaf = null;
    }
    if (this.statusCalloutTimeout !== null) {
      clearTimeout(this.statusCalloutTimeout);
      this.statusCalloutTimeout = null;
    }
    if (this.statusCallout) {
      this.container.removeChild(this.statusCallout);
      this.statusCallout.destroy({ children: true });
      this.statusCallout = null;
    }
  }

  private drawHalo(_phase: number): void {
    this.halo.clear();
    const color = this.color;
    for (let i = 3; i >= 1; i--) {
      this.halo
        .circle(0, 0, 40 + i * 3)
        .fill({ color, alpha: 0.08 + (4 - i) * 0.04 });
    }
    this.halo.circle(0, 0, 40).fill({ color, alpha: 0.25 });
    this.halo.circle(0, 0, 36).stroke({ color, width: 2, alpha: 0.9 });
  }
}
