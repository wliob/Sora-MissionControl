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
  private speechBubble: Container | null = null;
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
  private speechBubbleRaf: number | null = null;
  private speechBubbleTimeout: ReturnType<typeof setTimeout> | null = null;
  private onAssetError?: (info: AgentAssetError) => void;

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

    fx.y = -70;
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
    this.stopHaloPulse();
    this.clearSpeechBubble();
    this.container.destroy({ children: true });
  }

  showSpeechBubble(text: string, duration: number = 3000): void {
    this.clearSpeechBubble();

    const displayText = text.length > 40 ? text.slice(0, 39) + '\u2026' : text;

    const bubble = new Container();
    const padding = 8;
    const style = new TextStyle({
      fontSize: 12,
      fill: 0x1a1a2e,
      fontFamily: 'monospace',
      wordWrap: true,
      wordWrapWidth: 200,
    });
    const textObj = new Text({ text: displayText, style });
    textObj.anchor.set(0.5);

    const bg = new Graphics();
    const bgWidth = textObj.width + padding * 2;
    const bgHeight = textObj.height + padding * 2;
    bg.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 8);
    bg.fill({ color: 0xffffff, alpha: 0.95 });
    bg.stroke({ color: 0xcccccc, width: 1 });

    bubble.addChild(bg);
    bubble.addChild(textObj);
    bubble.y = -80;

    this.container.addChild(bubble);
    this.speechBubble = bubble;

    if (this.reducedMotion) {
      bubble.alpha = 1;
      this.speechBubbleTimeout = setTimeout(() => {
        if (this.speechBubble === bubble) {
          this.clearSpeechBubble();
        }
      }, duration + 300);
      return;
    }

    bubble.alpha = 0;
    const startTime = performance.now();
    const fadeInMs = 300;
    const fadeOutMs = 500;

    const animate = (): void => {
      if (!this.speechBubble || this.speechBubble !== bubble) return;
      const elapsed = performance.now() - startTime;

      if (elapsed < fadeInMs) {
        bubble.alpha = elapsed / fadeInMs;
      } else if (elapsed < fadeInMs + duration) {
        bubble.alpha = 1;
      } else if (elapsed < fadeInMs + duration + fadeOutMs) {
        const fadeProgress = (elapsed - fadeInMs - duration) / fadeOutMs;
        bubble.alpha = 1 - fadeProgress;
      } else {
        if (this.speechBubble === bubble) {
          this.clearSpeechBubble();
        }
        return;
      }
      this.speechBubbleRaf = requestAnimationFrame(animate);
    };
    this.speechBubbleRaf = requestAnimationFrame(animate);
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
      // Animation sheets are optional; failures fall back to base texture.
      // Sora stability audit #4 / R12: surface the failure so devs see it and
      // the dashboard can show a subtle indicator instead of a frozen agent.
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

  private clearSpeechBubble(): void {
    if (this.speechBubbleRaf !== null) {
      cancelAnimationFrame(this.speechBubbleRaf);
      this.speechBubbleRaf = null;
    }
    if (this.speechBubbleTimeout !== null) {
      clearTimeout(this.speechBubbleTimeout);
      this.speechBubbleTimeout = null;
    }
    if (this.speechBubble) {
      this.container.removeChild(this.speechBubble);
      this.speechBubble.destroy({ children: true });
      this.speechBubble = null;
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