/**
 * Canonical types for cron, webhook, and skills admin controls (Phase 6).
 *
 * Extends the same safety patterns from admin.ts and admin-keymcp.ts:
 *   - Secrets/tokens are masked fingerprints only; raw values appear
 *     only in one-time creation responses.
 *   - Destructive actions require confirmation before executing.
 *   - Every entity carries provenance metadata.
 *   - Missing backend capability renders as unavailable, not silently mocked.
 *
 * These types are the contract between the Cloud-owned adapter and the
 * Biscuit-owned admin store/UI. The adapter MUST mask secrets before
 * constructing these shapes; the store double-checks on ingest.
 */

import type { Provenance } from './provenance';
import { looksUnmasked } from './admin';

// ── Shared helpers ──────────────────────────────────────────────────────

/**
 * Action severity tiers for UI display and confirmation affordances.
 * Based on Korra Phase 6 audit recommendations:
 *   - Safe: no confirmation needed, low visual weight
 *   - Risk: confirmation needed, amber warning
 *   - Danger: confirmation needed, red warning, possibly typed-phrase
 */
export type ActionTier = 'safe' | 'risk' | 'danger';

// ── Cron Jobs ───────────────────────────────────────────────────────────

export interface CronJob {
  id: string;
  /** Human-readable name. */
  name: string;
  /** Schedule expression (cron or ISO duration). */
  schedule: string;
  /** Whether the job is currently enabled. */
  enabled: boolean;
  /** Whether the job is currently paused. */
  paused: boolean;
  /**
   * Truncated/redacted prompt preview. Full prompt is only available via
   * detail view and is never persisted in store state.
   */
  promptPreview: string | null;
  /**
   * Whether a script is attached. The script content is never in store state;
   * only presence is tracked here.
   */
  hasScript: boolean;
  /** Skills loaded for this job, if any. */
  skills: string[];
  /** Model override, if set. */
  modelOverride: string | null;
  /** ISO timestamp of last successful run; null if never run. */
  lastRunAt: string | null;
  /** ISO timestamp of next scheduled run; null if paused/disabled. */
  nextRunAt: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Non-secret error message if the job is in error state. */
  error: string | null;
}

/** One-time response when creating a cron job; carries prompt/script that may contain secrets. */
export interface CronJobCreated extends CronJob {
  /** Full prompt text — present ONLY at creation time, never persisted. */
  fullPrompt: string;
  /** Full script content — present ONLY at creation time, never persisted. */
  fullScript: string | null;
}

// ── Webhooks ────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'message.received'
  | 'message.sent'
  | 'cron.completed'
  | 'cron.failed'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.error'
  | string; // forward-compat

export interface WebhookEntry {
  id: string;
  /** Human-readable name. */
  name: string;
  /** The event type that triggers this webhook. */
  event: WebhookEvent;
  /** The callback URL; masked if it contains embedded credentials. */
  callbackUrl: string;
  /**
   * Whether a secret/token is configured. The actual secret is never
   * in store state; only presence is tracked.
   */
  hasSecret: boolean;
  /** Masked secret fingerprint, e.g. "wh-…ab12"; null if none configured. */
  maskedSecret: string | null;
  /** Whether the webhook is currently active. */
  active: boolean;
  /** ISO timestamp of last delivery attempt; null if never triggered. */
  lastTriggeredAt: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Non-secret error message. */
  error: string | null;
}

/** One-time response when creating a webhook; carries the raw signing secret. */
export interface WebhookCreated extends WebhookEntry {
  /** Raw signing secret — present ONLY at creation time, never persisted. */
  secret: string;
  /** Raw callback URL including any embedded credentials. */
  rawCallbackUrl: string;
}

// ── Skills ──────────────────────────────────────────────────────────────

export type SkillSource = 'builtin' | 'user' | 'plugin' | 'unknown';

export interface SkillEntry {
  /** Skill name (unique identifier). */
  name: string;
  /** Human-readable description; null if not available. */
  description: string | null;
  /** Where the skill came from. */
  source: SkillSource;
  /** Whether the skill is currently enabled. */
  enabled: boolean;
  /** Category for grouping, if applicable. */
  category: string | null;
  /** Number of sub-skills/references, if applicable. */
  subSkillCount: number | null;
  /** ISO timestamp when the skill was last modified; null if unknown. */
  lastModifiedAt: string | null;
  /**
   * Whether the skill has access to sensitive toolsets.
   * Used to flag risk when enabling/disabling.
   */
  hasSensitiveAccess: boolean;
}

// ── Admin actions for cron/webhook/skills ──────────────────────────────

/**
 * Discriminated union of all admin actions for cron, webhook, and skills
 * surfaces. Follows the same confirmation-gate pattern as KeyMcpAction.
 *
 * Action tier mapping:
 *   Safe (no confirm): skill.view
 *   Risk (confirm): cron.create, cron.run, cron.pause, cron.resume,
 *                   cron.update, webhook.update, skill.enable,
 *                   skill.disable
 *   Danger (confirm + possibly typed phrase): cron.remove, webhook.remove
 */
export type CwsAction =
  // Cron actions
  | { kind: 'cron.create'; name: string; schedule: string; prompt: string; script?: string; skills?: string[]; modelOverride?: string }
  | { kind: 'cron.update'; id: string; schedule?: string; prompt?: string; script?: string; skills?: string[]; modelOverride?: string }
  | { kind: 'cron.pause'; id: string }
  | { kind: 'cron.resume'; id: string }
  | { kind: 'cron.run'; id: string }
  | { kind: 'cron.remove'; id: string }
  // Webhook actions
  | { kind: 'webhook.create'; name: string; event: WebhookEvent; callbackUrl: string; secret?: string }
  | { kind: 'webhook.update'; id: string; name?: string; event?: WebhookEvent; callbackUrl?: string; secret?: string }
  | { kind: 'webhook.remove'; id: string }
  // Skills actions (read-only via proxy per Cloud spec, but enable/disable is allowed)
  | { kind: 'skill.list' }
  | { kind: 'skill.view'; name: string }
  | { kind: 'skill.enable'; name: string }
  | { kind: 'skill.disable'; name: string };

/** Actions that the store gates behind an explicit confirmation. */
const RISK_KINDS: ReadonlySet<CwsAction['kind']> = new Set([
  'cron.create',
  'cron.update',
  'cron.pause',
  'cron.resume',
  'cron.run',
  'webhook.update',
  'skill.enable',
  'skill.disable',
]);

const DANGER_KINDS: ReadonlySet<CwsAction['kind']> = new Set([
  'cron.remove',
  'webhook.remove',
]);

/** Whether an action requires confirmation before executing. */
export function cwsRequiresConfirmation(action: CwsAction): boolean {
  return RISK_KINDS.has(action.kind) || DANGER_KINDS.has(action.kind);
}

/** Get the severity tier for an action. */
export function cwsActionTier(action: CwsAction): ActionTier {
  if (DANGER_KINDS.has(action.kind)) return 'danger';
  if (RISK_KINDS.has(action.kind)) return 'risk';
  return 'safe';
}

/** Whether a danger-tier action should require a typed phrase for extra safety. */
export function cwsRequiresTypedPhrase(action: CwsAction): boolean {
  // Only the most destructive actions require typed confirmation
  return action.kind === 'cron.remove' || action.kind === 'webhook.remove';
}

/** A pending action awaiting confirmation. */
export interface CwsPendingConfirmation {
  /** Unique nonce for UI reference. */
  nonce: string;
  action: CwsAction;
  /** Human-readable summary for the confirm dialog. */
  summary: string;
  /** Severity tier for visual styling. */
  tier: ActionTier;
  /** Whether the user must type a phrase to confirm. */
  requiresTypedPhrase: boolean;
  /** ISO timestamp the confirmation was requested. */
  requestedAt: string;
}

/** Outcome of an applied admin action. */
export interface CwsActionResult {
  action: CwsAction;
  ok: boolean;
  /** Non-secret human message. */
  message: string;
  /** For cron.create: the one-time created payload with full prompt/script. */
  createdCron?: CronJobCreated;
  /** For webhook.create: the one-time created payload with raw secret. */
  createdWebhook?: WebhookCreated;
  /** ISO timestamp of completion. */
  completedAt: string;
}

// ── Store shapes ────────────────────────────────────────────────────────

export interface CwsAdminState {
  cronJobs: CronJob[];
  webhooks: WebhookEntry[];
  skills: SkillEntry[];
  /** Actions awaiting confirmation. */
  pending: CwsPendingConfirmation[];
  /** Last completed action result, for transient UI feedback. */
  lastResult: CwsActionResult | null;
  /** Whether a long-running op is in flight. */
  busy: boolean;
  /** Provenance for each subsection. */
  cronProvenance: Provenance;
  webhookProvenance: Provenance;
  skillsProvenance: Provenance;
  /** Most recent non-secret error; null when healthy. */
  lastError: string | null;
}

export function initialCwsAdminState(): CwsAdminState {
  const missingProvenance: Provenance = {
    source: 'admin-cli',
    freshness: 'missing',
    confidence: 'unknown',
    receivedAt: new Date().toISOString(),
  };
  return {
    cronJobs: [],
    webhooks: [],
    skills: [],
    pending: [],
    lastResult: null,
    busy: false,
    cronProvenance: { ...missingProvenance },
    webhookProvenance: { ...missingProvenance },
    skillsProvenance: { ...missingProvenance },
    lastError: null,
  };
}

// ── Redaction helpers ───────────────────────────────────────────────────

/**
 * Truncate a prompt or script to a safe preview length.
 * Used when constructing CronJob entries from adapter responses
 * so the full text never enters persistent store state.
 */
export function truncatePreview(text: string | null, maxLength = 80): string | null {
  if (text === null) return null;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '…';
}

/**
 * Defense-in-depth: check that a masked secret field actually looks masked.
 * Reuses the looksUnmasked logic from admin.ts.
 */
export function assertCwsFieldMasked(value: string | null, fieldName: string): void {
  if (looksUnmasked(value)) {
    throw new Error(
      `cwsAdmin: refusing to ingest entry — ${fieldName} looks unmasked (adapter bug)`,
    );
  }
}

/**
 * Build a human-readable confirmation summary for a CWS action.
 * Never includes secrets or full prompts/scripts.
 */
export function summarizeCwsAction(
  action: CwsAction,
  cronJobs: CronJob[],
  webhooks: WebhookEntry[],
  skills: SkillEntry[],
): string {
  switch (action.kind) {
    case 'cron.create':
      return `Create cron job "${action.name}" on schedule "${action.schedule}"? This will mutate the live scheduler, may consume cost/quota on each execution, and rollback requires pause or remove after creation.`;
    case 'cron.update': {
      const job = cronJobs.find((j) => j.id === action.id);
      return `Update cron job "${job?.name ?? action.id}"? Schedule or configuration will change.`;
    }
    case 'cron.pause': {
      const job = cronJobs.find((j) => j.id === action.id);
      return `Pause cron job "${job?.name ?? action.id}"? It will stop executing until resumed.`;
    }
    case 'cron.resume': {
      const job = cronJobs.find((j) => j.id === action.id);
      return `Resume cron job "${job?.name ?? action.id}"? It will begin executing on schedule again.`;
    }
    case 'cron.run': {
      const job = cronJobs.find((j) => j.id === action.id);
      return `Run cron job "${job?.name ?? action.id}" now? This will trigger the live scheduler immediately and may consume quota/cost or hit downstream side effects.`;
    }
    case 'cron.remove': {
      const job = cronJobs.find((j) => j.id === action.id);
      return `Permanently remove cron job "${job?.name ?? action.id}"? This cannot be undone.`;
    }
    case 'webhook.create':
      return `Create webhook "${action.name}" for event "${action.event}"?`;
    case 'webhook.update': {
      const wh = webhooks.find((w) => w.id === action.id);
      return `Update webhook "${wh?.name ?? action.id}"? Configuration will change.`;
    }
    case 'webhook.remove': {
      const wh = webhooks.find((w) => w.id === action.id);
      return `Permanently remove webhook "${wh?.name ?? action.id}"? This cannot be undone.`;
    }
    case 'skill.enable': {
      const skill = skills.find((s) => s.name === action.name);
      return `Enable skill "${action.name}"?${skill?.hasSensitiveAccess ? ' This skill has access to sensitive toolsets.' : ''}`;
    }
    case 'skill.disable': {
      const skill = skills.find((s) => s.name === action.name);
      return `Disable skill "${action.name}"? Agents that depend on it may lose functionality.${skill?.hasSensitiveAccess ? ' This skill has access to sensitive toolsets.' : ''}`;
    }
    default:
      return `Confirm action: ${action.kind}`;
  }
}
