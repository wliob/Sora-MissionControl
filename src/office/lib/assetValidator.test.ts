import { describe, it, expect, vi } from 'vitest';
import {
  validateStaticAtlas,
  validateAgentAnimAtlas,
  validateAllAtlases,
  hasErrors,
  type AtlasJson,
  type Logger,
} from './assetValidator';

// ── Helpers ────────────────────────────────────────────────────────────────

/** A silent logger so test output isn't polluted. */
const silentLogger: Logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

/** Build a minimal valid static atlas JSON for a given set of frame names. */
function staticAtlas(frameNames: string[]): AtlasJson {
  const frames: Record<string, unknown> = {};
  for (const f of frameNames) {
    frames[f] = { frame: { x: 0, y: 0, w: 32, h: 32 } };
  }
  return {
    frames,
    meta: { image: 'test.webp', size: { w: 256, h: 256 } },
  };
}

/** Build a minimal valid agent animation atlas JSON. */
function agentAnimAtlas(
  agentId: string,
  type: 'idle' | 'walk' | 'work' | 'cheer',
  frameCount: number,
): AtlasJson {
  const frames: Record<string, unknown> = {};
  const frameNames: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const name = `${agentId}_${type}_${i}`;
    frameNames.push(name);
    frames[name] = { frame: { x: i * 32, y: 0, w: 32, h: 32 } };
  }

  const animations: Record<string, string[]> = {};
  if (type === 'walk') {
    animations[`${agentId}_walk_n`] = frameNames.slice(0, 4);
    animations[`${agentId}_walk_e`] = frameNames.slice(4, 8);
    animations[`${agentId}_walk_s`] = frameNames.slice(8, 12);
    animations[`${agentId}_walk_w`] = frameNames.slice(12, 16);
    animations[`${agentId}_walk`] = frameNames.slice();
  } else {
    animations[`${agentId}_${type}`] = frameNames.slice();
  }
  return {
    frames,
    animations,
    meta: { image: `${agentId}_${type}.webp`, size: { w: 384, h: 128 } },
  };
}

const AGENTS_FRAMES = [
  'biscuit_base', 'biscuit_block',
  'cloud_base', 'cloud_block',
  'korra_base', 'korra_block',
  'lelouch_base', 'lelouch_block',
  'tifa_base', 'tifa_block',
  'rain_base', 'rain_block',
  'sora_base', 'sora_block',
];

const FURNITURE_0_FRAMES = [
  'wall_back', 'wall_side', 'couch', 'window_large', 'bookshelf', 'door',
  'floor_archive', 'floor_break_room', 'floor_collaboration',
  'floor_workstations', 'plant_large', 'round_table', 'rug_break',
  'lamp_floor', 'meeting_chair', 'plant_small',
  'guild_banner',
];

const FURNITURE_1_FRAMES = [
  'light_rays', 'kanban_board_prop', 'whiteboard', 'chair',
  'coffee_machine', 'desk', 'monitor',
  'conductor_desk',
];

const FX_FRAMES = ['emote_block', 'emote_sparkle', 'emote_thought'];

// ── Static atlas tests ──────────────────────────────────────────────────────

describe('validateStaticAtlas', () => {
  it('passes for a valid agents atlas with all expected frames', () => {
    const json = staticAtlas(AGENTS_FRAMES);
    const result = validateStaticAtlas('agents', json, silentLogger);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes for a valid furniture-0 atlas', () => {
    const json = staticAtlas(FURNITURE_0_FRAMES);
    const result = validateStaticAtlas('furniture-0', json, silentLogger);
    expect(result.ok).toBe(true);
  });

  it('passes for a valid furniture-1 atlas', () => {
    const json = staticAtlas(FURNITURE_1_FRAMES);
    const result = validateStaticAtlas('furniture-1', json, silentLogger);
    expect(result.ok).toBe(true);
  });

  it('passes for a valid fx atlas', () => {
    const json = staticAtlas(FX_FRAMES);
    const result = validateStaticAtlas('fx', json, silentLogger);
    expect(result.ok).toBe(true);
  });

  it('reports MISSING_FRAMES when frames are absent', () => {
    const json = staticAtlas(AGENTS_FRAMES.slice(0, 10)); // Only first 10 (5 agents)
    const result = validateStaticAtlas('agents', json, silentLogger);
    expect(result.ok).toBe(false);
    const missing = result.issues.find((i) => i.code === 'MISSING_FRAMES');
    expect(missing).toBeDefined();
    expect(missing!.severity).toBe('error');
    // Missing frames should mention rain_base/rain_block/sora_base/sora_block
    expect(missing!.message).toContain('rain_base');
    expect(missing!.message).toContain('rain_block');
  });

  it('reports EXTRA_FRAMES as a warning (not error) for unexpected frames', () => {
    const json = staticAtlas([...AGENTS_FRAMES, 'extra_frame']);
    const result = validateStaticAtlas('agents', json, silentLogger);
    expect(result.ok).toBe(true); // warnings don't fail
    const extra = result.issues.find((i) => i.code === 'EXTRA_FRAMES');
    expect(extra).toBeDefined();
    expect(extra!.severity).toBe('warn');
    expect(extra!.message).toContain('extra_frame');
  });

  it('reports UNEXPECTED_ANIMATIONS when a static atlas declares animations', () => {
    const json = staticAtlas(FX_FRAMES);
    json.animations = { emote_block: ['emote_block'] };
    const result = validateStaticAtlas('fx', json, silentLogger);
    const issue = result.issues.find((i) => i.code === 'UNEXPECTED_ANIMATIONS');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warn');
  });

  it('reports MISSING_META when meta is absent', () => {
    const json = staticAtlas(FX_FRAMES);
    delete json.meta;
    const result = validateStaticAtlas('fx', json, silentLogger);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_META')).toBe(true);
  });

  it('reports MISSING_META_IMAGE when meta.image is absent', () => {
    const json = staticAtlas(FX_FRAMES);
    json.meta = { size: { w: 100, h: 100 } };
    const result = validateStaticAtlas('fx', json, silentLogger);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_META_IMAGE')).toBe(true);
  });

  it('reports MISSING_FRAMES (structural) when frames object is absent', () => {
    const json: AtlasJson = { frames: {}, meta: { image: 'x.webp' } };
    const result = validateStaticAtlas('fx', json, silentLogger);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('warns for an unknown atlas name', () => {
    const json = staticAtlas(['foo']);
    const result = validateStaticAtlas('unknown-atlas', json, silentLogger);
    const issue = result.issues.find((i) => i.code === 'UNKNOWN_ATLAS');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warn');
  });
});

// ── Agent animation atlas tests ────────────────────────────────────────────

describe('validateAgentAnimAtlas', () => {
  it('passes for a valid idle atlas (4 frames, 1 animation)', () => {
    const json = agentAnimAtlas('biscuit', 'idle', 4);
    const result = validateAgentAnimAtlas('biscuit', 'idle', json, silentLogger);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes for a valid walk atlas (16 frames, 5 animations)', () => {
    const json = agentAnimAtlas('biscuit', 'walk', 16);
    const result = validateAgentAnimAtlas('biscuit', 'walk', json, silentLogger);
    expect(result.ok).toBe(true);
  });

  it('passes for a valid work atlas', () => {
    const json = agentAnimAtlas('korra', 'work', 4);
    const result = validateAgentAnimAtlas('korra', 'work', json, silentLogger);
    expect(result.ok).toBe(true);
  });

  it('passes for a valid cheer atlas', () => {
    const json = agentAnimAtlas('tifa', 'cheer', 4);
    const result = validateAgentAnimAtlas('tifa', 'cheer', json, silentLogger);
    expect(result.ok).toBe(true);
  });

  it('reports WRONG_FRAME_COUNT when the atlas has too few frames', () => {
    const json = agentAnimAtlas('biscuit', 'idle', 3);
    const result = validateAgentAnimAtlas('biscuit', 'idle', json, silentLogger);
    expect(result.ok).toBe(false);
    const issue = result.issues.find((i) => i.code === 'WRONG_FRAME_COUNT');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('3');
    expect(issue!.message).toContain('4');
  });

  it('reports MISSING_ANIMATIONS when a walk atlas lacks a directional key', () => {
    const json = agentAnimAtlas('cloud', 'walk', 16);
    delete json.animations!['cloud_walk_n'];
    const result = validateAgentAnimAtlas('cloud', 'walk', json, silentLogger);
    expect(result.ok).toBe(false);
    const issue = result.issues.find((i) => i.code === 'MISSING_ANIMATIONS');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('cloud_walk_n');
  });

  it('reports DANGLING_ANIM_REF when an animation references an undeclared frame', () => {
    const json = agentAnimAtlas('biscuit', 'idle', 4);
    json.animations!['biscuit_idle'] = [
      'biscuit_idle_0', 'biscuit_idle_1', 'biscuit_idle_2', 'ghost_frame',
    ];
    const result = validateAgentAnimAtlas('biscuit', 'idle', json, silentLogger);
    expect(result.ok).toBe(false);
    const issue = result.issues.find((i) => i.code === 'DANGLING_ANIM_REF');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('ghost_frame');
  });

  it('reports WRONG_ANIM_LENGTH when a directional walk anim has wrong frame count', () => {
    const json = agentAnimAtlas('biscuit', 'walk', 16);
    json.animations!['biscuit_walk_n'] = ['biscuit_walk_0', 'biscuit_walk_1', 'biscuit_walk_2'];
    const result = validateAgentAnimAtlas('biscuit', 'walk', json, silentLogger);
    expect(result.ok).toBe(false);
    const issue = result.issues.find((i) => i.code === 'WRONG_ANIM_LENGTH');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('biscuit_walk_n');
  });

  it('validates all six agents for idle', () => {
    const agents = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa', 'rain'] as const;
    for (const id of agents) {
      const json = agentAnimAtlas(id, 'idle', 4);
      const result = validateAgentAnimAtlas(id, 'idle', json, silentLogger);
      expect(result.ok, `${id} idle should pass`).toBe(true);
    }
  });
});

// ── validateAllAtlases ──────────────────────────────────────────────────────

describe('validateAllAtlases', () => {
  it('returns OK results when all atlases are valid', async () => {
    const fetcher = vi.fn(async (name: string): Promise<AtlasJson | null> => {
      if (name === 'agents') return staticAtlas(AGENTS_FRAMES);
      if (name === 'furniture-0') return staticAtlas(FURNITURE_0_FRAMES);
      if (name === 'furniture-1') return staticAtlas(FURNITURE_1_FRAMES);
      if (name === 'fx') return staticAtlas(FX_FRAMES);
      const [agentId, type] = name.includes('_walk')
        ? [name.replace('_walk', ''), 'walk'] as const
        : name.includes('_cheer')
        ? [name.replace('_cheer', ''), 'cheer'] as const
        : name.includes('_work')
        ? [name.replace('_work', ''), 'work'] as const
        : [name.replace('_idle', ''), 'idle'] as const;
      const count = type === 'walk' ? 16 : 4;
      return agentAnimAtlas(agentId, type, count);
    });

    const results = await validateAllAtlases(fetcher, silentLogger);
    expect(results).toHaveLength(4 + 6 * 4); // 4 static + 6 agents × 4 animation types
    expect(hasErrors(results)).toBe(false);
  });

  it('records MISSING_ATLAS error when fetcher returns null', async () => {
    const fetcher = vi.fn(async (_name: string): Promise<AtlasJson | null> => null);
    const results = await validateAllAtlases(fetcher, silentLogger);
    expect(hasErrors(results)).toBe(true);
    for (const r of results) {
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.code === 'MISSING_ATLAS')).toBe(true);
    }
  });

  it('detects errors in a mix of valid and corrupted atlases', async () => {
    const fetcher = vi.fn(async (name: string): Promise<AtlasJson | null> => {
      if (name === 'agents') return staticAtlas(AGENTS_FRAMES.slice(0, 5));
      if (name === 'furniture-0') return staticAtlas(FURNITURE_0_FRAMES);
      if (name === 'furniture-1') return staticAtlas(FURNITURE_1_FRAMES);
      if (name === 'fx') return staticAtlas(FX_FRAMES);
      const [agentId, type] = name.includes('_walk')
        ? [name.replace('_walk', ''), 'walk'] as const
        : name.includes('_cheer')
        ? [name.replace('_cheer', ''), 'cheer'] as const
        : name.includes('_work')
        ? [name.replace('_work', ''), 'work'] as const
        : [name.replace('_idle', ''), 'idle'] as const;
      const count = type === 'walk' ? 16 : 4;
      return agentAnimAtlas(agentId, type, count);
    });

    const results = await validateAllAtlases(fetcher, silentLogger);
    expect(hasErrors(results)).toBe(true);
    const agentsResult = results.find((r) => r.atlasName === 'agents');
    expect(agentsResult).toBeDefined();
    expect(agentsResult!.ok).toBe(false);
    const others = results.filter((r) => r.atlasName !== 'agents');
    for (const r of others) {
      expect(r.ok, `${r.atlasName} should be OK`).toBe(true);
    }
  });
});

// ── Real atlas JSON files ────────────────────────────────────────────────────

describe('real atlas files', () => {
  // These tests load actual atlas JSON from public/assets/atlases/ and validate
  // against the manifest. The dynamic import of `node:fs` works at runtime but
  // lacks @types/node for tsc — wrapped in try/catch to gracefully skip.
  const atlasDir = 'public/assets/atlases';

  it('all static atlases pass validation', async () => {
    // @ts-expect-error — no @types/node in this project; vitest resolves at runtime
    const { readFileSync } = await import('node:fs');
    const names = ['agents', 'furniture-0', 'furniture-1', 'fx'];
    // Phase B: New frames not yet in atlas files on disk (Korra creating assets):
    const NEW_FRAMES = ['rain_base', 'rain_block', 'sora_base', 'sora_block', 'guild_banner', 'conductor_desk'];
    for (const name of names) {
      const raw = readFileSync(`${atlasDir}/${name}.json`, 'utf-8');
      const json = JSON.parse(raw) as AtlasJson;
      const result = validateStaticAtlas(name, json, silentLogger);
      const missingNew = result.issues.filter(
        (i) => i.code === 'MISSING_FRAMES' && NEW_FRAMES.some((f) => i.message.includes(f))
      );
      if (missingNew.length > 0) {
        // New frames not yet in atlas — expected during Phase B construction.
        const otherErrors = result.issues.filter(
          (i) => i.severity === 'error' && !NEW_FRAMES.some((f) => i.message.includes(f))
        );
        expect(otherErrors.length, `${name} should have no non-new-frame errors: ${JSON.stringify(otherErrors)}`).toBe(0);
      } else {
        expect(result.ok, `${name} should pass: ${JSON.stringify(result.issues)}`).toBe(true);
      }
    }
  });

  it('all agent animation atlases pass validation', async () => {
    // @ts-expect-error — no @types/node in this project; vitest resolves at runtime
    const { readFileSync } = await import('node:fs');
    const agents = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa'] as const;
    const types = ['idle', 'walk', 'work', 'cheer'] as const;
    for (const id of agents) {
      for (const type of types) {
        const raw = readFileSync(`${atlasDir}/${id}_${type}.json`, 'utf-8');
        const json = JSON.parse(raw) as AtlasJson;
        const result = validateAgentAnimAtlas(id, type, json, silentLogger);
        expect(
          result.ok,
          `${id}_${type} should pass: ${JSON.stringify(result.issues)}`,
        ).toBe(true);
      }
    }
  });
});
