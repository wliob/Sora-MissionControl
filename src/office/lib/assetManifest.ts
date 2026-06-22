/**
 * Canonical asset manifest for the 3D Office.
 *
 * Defines the expected structure of every atlas JSON the game loads:
 * static atlases (furniture, agents base/block, fx) and per-agent animation
 * spritesheets (idle / walk / work / cheer). The {@link validateAtlas} function
 * in `assetValidator.ts` compares a parsed atlas against these expectations
 * so that a corrupted / truncated / stale atlas is caught at load time and
 * logged rather than producing silent rendering bugs.
 *
 * Phase 8 — Sora stability audit #14.
 */

// ── Static atlases ──────────────────────────────────────────────────────────

/** Expected frame keys for each static atlas (atlases without `animations`). */
export const STATIC_ATLAS_FRAMES: Record<string, readonly string[]> = {
  'agents': [
    'biscuit_base', 'biscuit_block',
    'cloud_base', 'cloud_block',
    'korra_base', 'korra_block',
    'lelouch_base', 'lelouch_block',
    'tifa_base', 'tifa_block',
  ],
  'furniture-0': [
    'wall_back', 'wall_side', 'couch', 'window_large', 'bookshelf', 'door',
    'floor_archive', 'floor_break_room', 'floor_collaboration',
    'floor_workstations', 'plant_large', 'round_table', 'rug_break',
    'lamp_floor', 'meeting_chair', 'plant_small',
  ],
  'furniture-1': [
    'light_rays', 'kanban_board_prop', 'whiteboard', 'chair',
    'coffee_machine', 'desk', 'monitor',
  ],
  'fx': ['emote_block', 'emote_sparkle', 'emote_thought'],
};

/** Static atlas names that must be present at boot. */
export const STATIC_ATLAS_NAMES = Object.keys(STATIC_ATLAS_FRAMES) as (
  | 'agents'
  | 'furniture-0'
  | 'furniture-1'
  | 'fx'
)[];

// ── Agent animation atlases ─────────────────────────────────────────────────

/** The five agents rendered in the office. */
export const AGENT_IDS = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa'] as const;
export type AgentId = (typeof AGENT_IDS)[number];

/** The four per-agent animation spritesheets, loaded on demand. */
export const ANIMATION_TYPES = ['idle', 'walk', 'work', 'cheer'] as const;
export type AnimationType = (typeof ANIMATION_TYPES)[number];

/**
 * Expected animation keys for each (agentId, animationType) pair.
 *
 * `idle`, `work`, `cheer` each have a single animation keyed `${agentId}_${type}`
 * with 4 frames. `walk` has four directional animations (`_n`/`_e`/`_s`/`_w`)
 * of 4 frames each plus an aggregate `${agentId}_walk` with all 16 frames.
 */
export function expectedAnimationKeys(
  agentId: AgentId,
  type: AnimationType,
): readonly string[] {
  const base = `${agentId}_${type}`;
  if (type === 'walk') {
    return [`${base}_n`, `${base}_e`, `${base}_s`, `${base}_w`, base];
  }
  return [base];
}

/** Expected number of frames for a given animation key. */
export function expectedFrameCount(
  _agentId: AgentId,
  type: AnimationType,
): number {
  return type === 'walk' ? 16 : 4;
}

/** Expected number of frames for an individual animation within a sheet. */
export function expectedAnimFramesPerKey(
  _agentId: AgentId,
  type: AnimationType,
  animKey: string,
): number {
  if (type === 'walk' && !animKey.endsWith('_n') && !animKey.endsWith('_e') &&
      !animKey.endsWith('_s') && !animKey.endsWith('_w')) {
    return 16; // aggregate walk animation
  }
  return 4;
}

/** Build the canonical atlas name for an agent animation sheet. */
export function agentAtlasName(agentId: AgentId, type: AnimationType): string {
  return `${agentId}_${type}`;
}
