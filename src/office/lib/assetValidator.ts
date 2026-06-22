/**
 * Asset integrity validator.
 *
 * After an atlas JSON is parsed (but before it is fed to `new Spritesheet()`),
 * run it through {@link validateStaticAtlas} or {@link validateAgentAnimAtlas}
 * to catch:
 *  - missing / extra frame keys vs. the canonical manifest,
 *  - animation keys that don't match the expected set,
 *  - animation frame references that don't resolve to a declared frame,
 *  - wrong total frame count,
 *  - missing `meta.image` / `meta.size`.
 *
 * Mismatches are collected into a {@link ValidationResult} and logged via the
 * injected logger (defaults to `console`). The validator never throws — it is
 * a *diagnostic* layer, not a gate. Rendering proceeds with whatever textures
 * are available so the office still loads; the log output is what surfaces the
 * corruption to a developer.
 *
 * Phase 8 — Sora stability audit #14.
 */

import {
  STATIC_ATLAS_FRAMES,
  AGENT_IDS,
  ANIMATION_TYPES,
  expectedAnimationKeys,
  expectedFrameCount,
  expectedAnimFramesPerKey,
  agentAtlasName,
  type AgentId,
  type AnimationType,
} from './assetManifest';

/** Minimal shape of a free-tex-packer / TexturePacker atlas JSON. */
export interface AtlasJson {
  frames: Record<string, unknown>;
  animations?: Record<string, string[]>;
  meta?: {
    image?: string;
    size?: { w: number; h: number };
    scale?: number;
    [k: string]: unknown;
  };
}

export interface ValidationIssue {
  severity: 'error' | 'warn';
  code: string;
  message: string;
}

export interface ValidationResult {
  atlasName: string;
  ok: boolean;
  issues: ValidationIssue[];
}

export type Logger = {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
};

const defaultLogger: Logger = console;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a static atlas (no animations) against {@link STATIC_ATLAS_FRAMES}.
 *
 * @param atlasName  e.g. `'agents'`, `'furniture-0'`
 * @param json       parsed atlas JSON
 * @param logger     optional logger (defaults to console)
 * @returns          a {@link ValidationResult} with collected issues
 */
export function validateStaticAtlas(
  atlasName: string,
  json: AtlasJson,
  logger: Logger = defaultLogger,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const expected = STATIC_ATLAS_FRAMES[atlasName];

  if (!expected) {
    // Unknown static atlas — nothing to validate against, but note it.
    issues.push({
      severity: 'warn',
      code: 'UNKNOWN_ATLAS',
      message: `Static atlas "${atlasName}" is not in the manifest; skipping frame validation.`,
    });
    return finish(atlasName, issues, logger);
  }

  validateCommon(json, atlasName, issues);

  const actual = Object.keys(json.frames ?? {});
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  const missing = expected.filter((k) => !actualSet.has(k));
  const extra = actual.filter((k) => !expectedSet.has(k));

  if (missing.length > 0) {
    issues.push({
      severity: 'error',
      code: 'MISSING_FRAMES',
      message: `Atlas "${atlasName}" is missing ${missing.length} expected frame(s): ${missing.join(', ')}.`,
    });
  }
  if (extra.length > 0) {
    issues.push({
      severity: 'warn',
      code: 'EXTRA_FRAMES',
      message: `Atlas "${atlasName}" has ${extra.length} unexpected frame(s): ${extra.join(', ')}.`,
    });
  }

  // Static atlases should not declare animations.
  if (json.animations && Object.keys(json.animations).length > 0) {
    issues.push({
      severity: 'warn',
      code: 'UNEXPECTED_ANIMATIONS',
      message: `Static atlas "${atlasName}" declares animations; expected none.`,
    });
  }

  return finish(atlasName, issues, logger);
}

/**
 * Validate a per-agent animation spritesheet (idle / walk / work / cheer)
 * against the manifest.
 *
 * @param agentId   e.g. `'biscuit'`
 * @param type      e.g. `'walk'`
 * @param json      parsed atlas JSON
 * @param logger    optional logger
 */
export function validateAgentAnimAtlas(
  agentId: AgentId,
  type: AnimationType,
  json: AtlasJson,
  logger: Logger = defaultLogger,
): ValidationResult {
  const atlasName = agentAtlasName(agentId, type);
  const issues: ValidationIssue[] = [];

  validateCommon(json, atlasName, issues);

  const actualAnims = json.animations ?? {};
  const actualAnimKeys = Object.keys(actualAnims);
  const expectedKeys = expectedAnimationKeys(agentId, type);
  const expectedKeySet = new Set(expectedKeys);
  const actualAnimKeySet = new Set(actualAnimKeys);

  // Animation key set must match exactly.
  const missingAnims = expectedKeys.filter((k) => !actualAnimKeySet.has(k));
  const extraAnims = actualAnimKeys.filter((k) => !expectedKeySet.has(k));

  if (missingAnims.length > 0) {
    issues.push({
      severity: 'error',
      code: 'MISSING_ANIMATIONS',
      message: `Atlas "${atlasName}" is missing ${missingAnims.length} expected animation key(s): ${missingAnims.join(', ')}.`,
    });
  }
  if (extraAnims.length > 0) {
    issues.push({
      severity: 'warn',
      code: 'EXTRA_ANIMATIONS',
      message: `Atlas "${atlasName}" has ${extraAnims.length} unexpected animation key(s): ${extraAnims.join(', ')}.`,
    });
  }

  // Total frame count.
  const actualFrameCount = Object.keys(json.frames ?? {}).length;
  const expectedCount = expectedFrameCount(agentId, type);
  if (actualFrameCount !== expectedCount) {
    issues.push({
      severity: 'error',
      code: 'WRONG_FRAME_COUNT',
      message: `Atlas "${atlasName}" has ${actualFrameCount} frame(s); expected ${expectedCount}.`,
    });
  }

  // Each animation's frame refs must resolve to declared frames, and the
  // per-animation length must match the expected value.
  const frameSet = new Set(Object.keys(json.frames ?? {}));
  for (const animKey of actualAnimKeys) {
    const refs = actualAnims[animKey] ?? [];
    const expectedPerKey = expectedAnimFramesPerKey(agentId, type, animKey);
    if (refs.length !== expectedPerKey) {
      issues.push({
        severity: 'error',
        code: 'WRONG_ANIM_LENGTH',
        message: `Atlas "${atlasName}" animation "${animKey}" has ${refs.length} frame(s); expected ${expectedPerKey}.`,
      });
    }
    const dangling = refs.filter((r) => !frameSet.has(r));
    if (dangling.length > 0) {
      issues.push({
        severity: 'error',
        code: 'DANGLING_ANIM_REF',
        message: `Atlas "${atlasName}" animation "${animKey}" references undeclared frame(s): ${dangling.join(', ')}.`,
      });
    }
  }

  return finish(atlasName, issues, logger);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function validateCommon(
  json: AtlasJson,
  atlasName: string,
  issues: ValidationIssue[],
): void {
  if (!json || typeof json !== 'object') {
    issues.push({
      severity: 'error',
      code: 'INVALID_JSON',
      message: `Atlas "${atlasName}" JSON is not a valid object.`,
    });
    return;
  }
  if (!json.frames || typeof json.frames !== 'object') {
    issues.push({
      severity: 'error',
      code: 'MISSING_FRAMES',
      message: `Atlas "${atlasName}" has no "frames" object.`,
    });
  }
  if (!json.meta) {
    issues.push({
      severity: 'error',
      code: 'MISSING_META',
      message: `Atlas "${atlasName}" is missing "meta".`,
    });
  } else {
    if (!json.meta.image) {
      issues.push({
        severity: 'error',
        code: 'MISSING_META_IMAGE',
        message: `Atlas "${atlasName}" meta.image is missing.`,
      });
    }
    if (!json.meta.size || typeof json.meta.size.w !== 'number' ||
        typeof json.meta.size.h !== 'number') {
      issues.push({
        severity: 'warn',
        code: 'MISSING_META_SIZE',
        message: `Atlas "${atlasName}" meta.size is missing or invalid.`,
      });
    }
  }
}

function finish(
  atlasName: string,
  issues: ValidationIssue[],
  logger: Logger,
): ValidationResult {
  const ok = issues.every((i) => i.severity !== 'error');
  for (const issue of issues) {
    const tag = `[asset-validator] ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`;
    if (issue.severity === 'error') {
      logger.error(tag);
    } else {
      logger.warn(tag);
    }
  }
  if (ok) {
    logger.info(`[asset-validator] OK atlas "${atlasName}" — ${issues.length} warning(s).`);
  }
  return { atlasName, ok, issues };
}

// ── Convenience: validate all atlases from a fetcher ────────────────────────

/**
 * Validate every static atlas and agent animation atlas by fetching their JSON
 * via the provided fetcher. Returns the aggregate result list. Useful for a
 * boot-time / dev-mode integrity sweep.
 *
 * The fetcher must return the parsed JSON (or `null` if the fetch failed) so
 * the validator can record a missing-atlas error.
 */
export async function validateAllAtlases(
  fetcher: (atlasName: string) => Promise<AtlasJson | null>,
  logger: Logger = defaultLogger,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const name of Object.keys(STATIC_ATLAS_FRAMES)) {
    const json = await fetcher(name);
    if (!json) {
      logger.error(`[asset-validator] ERROR MISSING_ATLAS: Failed to fetch static atlas "${name}".`);
      results.push({
        atlasName: name,
        ok: false,
        issues: [{ severity: 'error', code: 'MISSING_ATLAS', message: `Failed to fetch static atlas "${name}".` }],
      });
    } else {
      results.push(validateStaticAtlas(name, json, logger));
    }
  }

  for (const agentId of AGENT_IDS) {
    for (const type of ANIMATION_TYPES) {
      const name = agentAtlasName(agentId, type);
      const json = await fetcher(name);
      if (!json) {
        logger.error(`[asset-validator] ERROR MISSING_ATLAS: Failed to fetch agent atlas "${name}".`);
        results.push({
          atlasName: name,
          ok: false,
          issues: [{ severity: 'error', code: 'MISSING_ATLAS', message: `Failed to fetch agent atlas "${name}".` }],
        });
      } else {
        results.push(validateAgentAnimAtlas(agentId, type, json, logger));
      }
    }
  }

  return results;
}

/** True if any result in the list has an error-level issue. */
export function hasErrors(results: ValidationResult[]): boolean {
  return results.some((r) => !r.ok);
}
