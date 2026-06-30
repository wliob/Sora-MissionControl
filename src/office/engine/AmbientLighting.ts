/**
 * AmbientLighting — Procedural warm light pool and CRT glow accent rendering.
 *
 * Phase B: Adds soft architectural lighting to the office scene:
 *   - Warm light pools (radial gradients) at key locations
 *   - CRT phosphor glow accents tied to agent monitor activity
 *   - Gentle oscillation for ambient motion (respects prefers-reduced-motion)
 *   - Scanline overlay toggle
 *
 * All rendering is procedural (no external textures). Light pools are
 * rendered as Graphics circles on the FX layer. CRT glows are per-monitor
 * Graphics circles animated via RAF.
 *
 * Usage:
 *   const lighting = new AmbientLighting(fxLayer, { reducedMotion: false });
 *   lighting.createLightPools();
 *   lighting.start();
 */

import { Container, Graphics } from 'pixi.js';
import { gridToScreen } from '@/office/engine/iso';

// Light pool colors
const GUILD_AMBER = 0xd4943a; // Warm guild amber
const WARM_PLATINUM = 0xf0e8d8; // Conductor station under-glow
const CRT_CYAN = 0x00d4ff; // Collaboration zone cool light

export interface LightPoolDef {
  col: number;
  row: number;
  color: number;
  baseAlpha: number;
  radius: number;
}

/** Light pool positions from Korra's design spec §5.1 */
const LIGHT_POOLS: LightPoolDef[] = [
  {
    col: 11, row: 2, color: GUILD_AMBER, baseAlpha: 0.06, radius: 140,
  }, // Workstations row 1
  {
    col: 11, row: 3, color: GUILD_AMBER, baseAlpha: 0.05, radius: 130,
  }, // Workstations row 2
  {
    col: 7.5, row: 5.5, color: WARM_PLATINUM, baseAlpha: 0.04, radius: 160,
  }, // Conductor station under-glow
  {
    col: 10, row: 8, color: GUILD_AMBER, baseAlpha: 0.07, radius: 150,
  }, // Break room couch
  {
    col: 3, row: 7, color: CRT_CYAN, baseAlpha: 0.04, radius: 120,
  }, // Collaboration table (cool contrast)
];

export interface AmbientLightingOptions {
  reducedMotion?: boolean;
}

export class AmbientLighting {
  private layer: Container;
  private pools: Graphics[] = [];
  private poolPhases: number[] = [];
  private rafId: number | null = null;
  private reducedMotion: boolean;
  private running = false;

  constructor(layer: Container, options: AmbientLightingOptions = {}) {
    this.layer = layer;
    this.reducedMotion = options.reducedMotion ?? false;
  }

  /** Create all light pool sprites and add them to the FX layer. */
  createLightPools(): void {
    for (let i = 0; i < LIGHT_POOLS.length; i++) {
      const pool = new Graphics();
      const def = LIGHT_POOLS[i];
      const { x, y } = gridToScreen(def.col, def.row);

      // Draw radial gradient approximation using concentric circles
      const steps = 6;
      for (let s = steps; s >= 0; s--) {
        const t = s / steps;
        const radius = def.radius * t;
        const alpha = def.baseAlpha * Math.pow(1 - t, 2); // Falloff
        pool.circle(0, 0, radius);
        pool.fill({ color: def.color, alpha });
      }

      pool.x = x;
      pool.y = y;
      pool.zIndex = -10; // Behind agents/furniture
      this.layer.addChild(pool);
      this.pools.push(pool);
      this.poolPhases.push(Math.random() * Math.PI * 2); // Random initial phase
    }

    this.layer.sortableChildren = true;
  }

  /** Start ambient animation (light pool oscillation). */
  start(): void {
    if (this.running) return;
    this.running = true;

    if (this.reducedMotion) return;

    let lastTime = performance.now();
    const animate = (now: number) => {
      if (!this.running) return;
      const dt = (now - lastTime) / 1000; // seconds
      lastTime = now;

      // Gentle oscillation for each pool (±15%, period ~8s, out of phase)
      for (let i = 0; i < this.pools.length; i++) {
        this.poolPhases[i] += dt * (Math.PI * 2 / 8); // 8-second period
        const oscillation = 1 + 0.15 * Math.sin(this.poolPhases[i]);
        this.pools[i].alpha = oscillation;
      }

      this.rafId = requestAnimationFrame(animate);
    };
    this.rafId = requestAnimationFrame(animate);
  }

  /** Stop ambient animation and clean up. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Remove all light pools from the layer and destroy them. */
  destroy(): void {
    this.stop();
    for (const pool of this.pools) {
      this.layer.removeChild(pool);
      pool.destroy();
    }
    this.pools = [];
    this.poolPhases = [];
  }
}

/**
 * Create a CRT monitor glow Graphics circle.
 *
 * @param color - Agent guild house color (hex number)
 * @param alpha - Base opacity (0.05 idle, 0.12 working, 0.15 blocked)
 * @param radius - Glow radius in pixels
 * @returns A Graphics object positioned at (0,0), ready to be added as a child.
 */
export function createCrtGlow(color: number, alpha: number, radius: number = 40): Graphics {
  const glow = new Graphics();
  // Soft falloff using concentric circles
  const steps = 4;
  for (let s = steps; s >= 0; s--) {
    const t = s / steps;
    const r = radius * (0.5 + t * 0.5);
    const a = alpha * Math.pow(1 - t, 2.5);
    glow.circle(0, 0, r);
    glow.fill({ color, alpha: a });
  }
  return glow;
}

// Re-export for convenience
export { LIGHT_POOLS };
