/**
 * cwsAdminStore — admin store for Cron, Webhook, and Skills surfaces.
 *
 * Phase 6 unified admin safety store. Follows the same patterns as
 * adminStore.ts and adminKeyMcpStore.ts:
 *   - Secrets are masked fingerprints in persistent state; raw values
 *     appear only in one-time `lastResult.createdCron` / `.createdWebhook`.
 *   - Destructive/risky actions are gated behind `CwsPendingConfirmation`.
 *   - Ingest guards reject unmasked secrets (defense-in-depth).
 *   - Missing backend is rendered as unavailable, not silently mocked.
 *
 * This store starts empty (no mock seed data). When Cloud's adapter is
 * bound, `loadCronJobs` / `loadWebhooks` / `loadSkills` populate it from
 * the real backend.
 */

import { useSyncExternalStore } from 'react';
import {
  type CwsAction,
  type CwsActionResult,
  type CwsAdminState,
  type CwsPendingConfirmation,
  type CronJob,
  type WebhookEntry,
  type SkillEntry,
  cwsRequiresConfirmation,
  cwsActionTier,
  cwsRequiresTypedPhrase,
  summarizeCwsAction,
  assertCwsFieldMasked,
  initialCwsAdminState,
} from '@/types/admin-cws';

/* ── Adapter binding ──────────────────────────────────────────────────── */

/**
 * The Cloud-owned CWS admin adapter. The store calls these methods to
 * fetch and mutate cron/webhook/skills data against the real Hermes backend.
 */
export interface CwsAdminAdapter {
  /** List all cron jobs (with truncated prompts and no script content). */
  listCronJobs(): Promise<CronJob[]>;
  /** List all configured webhooks (with masked secrets). */
  listWebhooks(): Promise<WebhookEntry[]>;
  /** List all skills. */
  listSkills(): Promise<SkillEntry[]>;
  /** Execute a confirmed action. Returns a non-secret result. */
  executeAction(action: CwsAction): Promise<CwsActionResult>;
}

let adapter: CwsAdminAdapter | null = null;

/** Inject the CWS admin adapter (Cloud-owned). Called once during app boot. */
export function setCwsAdminAdapter(a: CwsAdminAdapter | null): void {
  adapter = a;
}

/** Whether an adapter is bound. */
export function hasCwsAdapter(): boolean {
  return adapter !== null;
}

/* ── State management ──────────────────────────────────────────────────── */

let state: CwsAdminState = { ...initialCwsAdminState() };
const listeners = new Set<() => void>();
let nonceCounter = 0;

function emit(): void {
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): CwsAdminState {
  return state;
}

function setState(patch: Partial<CwsAdminState>): void {
  state = { ...state, ...patch };
  emit();
}

/* ── Redaction guard ───────────────────────────────────────────────────── */

/**
 * Defense-in-depth: validate that all secrets in a list of entries are masked.
 * Rejects the entire list if any entry fails.
 */
function validateCronMasking(jobs: CronJob[]): void {
  for (const job of jobs) {
    // CronJob.promptPreview should be truncated, not a full raw prompt
    // that could contain secrets
    if (job.promptPreview !== null && job.promptPreview.length > 200) {
      throw new Error(
        `cwsAdmin: refusing to ingest cron job ${job.id} — promptPreview is suspiciously long (adapter should truncate)`,
      );
    }
  }
}

function validateWebhookMasking(webhooks: WebhookEntry[]): void {
  for (const wh of webhooks) {
    assertCwsFieldMasked(wh.maskedSecret, `webhook ${wh.id} maskedSecret`);
    // callbackUrl should be masked if it contains credentials
    if (wh.callbackUrl.includes('@') && !wh.callbackUrl.includes('•')) {
      throw new Error(
        `cwsAdmin: refusing to ingest webhook ${wh.id} — callbackUrl contains unmasked credentials`,
      );
    }
  }
}

/* ── Data loading ──────────────────────────────────────────────────────── */

/** Load cron jobs from the bound adapter. Sets lastError if no adapter. */
export async function loadCronJobs(): Promise<void> {
  if (!adapter) {
    setState({ lastError: 'No CWS admin adapter bound' });
    return;
  }
  try {
    const jobs = await adapter.listCronJobs();
    validateCronMasking(jobs);
    setState({
      cronJobs: jobs,
      cronProvenance: {
        source: 'admin-cli',
        freshness: 'live',
        confidence: 'unverified',
        receivedAt: new Date().toISOString(),
      },
      lastError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ lastError: message });
  }
}

/** Load webhooks from the bound adapter. */
export async function loadWebhooks(): Promise<void> {
  if (!adapter) {
    setState({ lastError: 'No CWS admin adapter bound' });
    return;
  }
  try {
    const webhooks = await adapter.listWebhooks();
    validateWebhookMasking(webhooks);
    setState({
      webhooks,
      webhookProvenance: {
        source: 'admin-cli',
        freshness: 'live',
        confidence: 'unverified',
        receivedAt: new Date().toISOString(),
      },
      lastError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ lastError: message });
  }
}

/** Load skills from the bound adapter. */
export async function loadSkills(): Promise<void> {
  if (!adapter) {
    setState({ lastError: 'No CWS admin adapter bound' });
    return;
  }
  try {
    const skills = await adapter.listSkills();
    setState({
      skills,
      skillsProvenance: {
        source: 'admin-cli',
        freshness: 'live',
        confidence: 'unverified',
        receivedAt: new Date().toISOString(),
      },
      lastError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ lastError: message });
  }
}

/* ── Action request / confirmation flow ─────────────────────────────────── */

/**
 * Request a CWS admin action. If the action requires confirmation, a
 * CwsPendingConfirmation is created. Otherwise, it executes immediately.
 */
export function requestCwsAction(action: CwsAction): void {
  if (cwsRequiresConfirmation(action)) {
    const tier = cwsActionTier(action);
    const nonce = `cws_${++nonceCounter}`;
    const pending: CwsPendingConfirmation = {
      nonce,
      action,
      summary: summarizeCwsAction(action, state.cronJobs, state.webhooks, state.skills),
      tier,
      requiresTypedPhrase: cwsRequiresTypedPhrase(action),
      requestedAt: new Date().toISOString(),
    };
    setState({ pending: [...state.pending, pending] });
    return;
  }

  // Safe action: execute immediately
  void executeCwsAction(action);
}

/** Confirm a pending destructive/risky action and execute it. */
export function confirmCwsAction(nonce: string): void {
  const pending = state.pending.find((p) => p.nonce === nonce);
  if (!pending) return;
  setState({ pending: state.pending.filter((p) => p.nonce !== nonce) });
  void executeCwsAction(pending.action);
}

/** Cancel a pending action without executing. */
export function cancelCwsAction(nonce: string): void {
  setState({ pending: state.pending.filter((p) => p.nonce !== nonce) });
}

/** Cancel all pending confirmations. */
export function cancelAllCwsPending(): void {
  if (state.pending.length === 0) return;
  setState({ pending: [] });
}

/** Clear the last action result. */
export function clearCwsLastResult(): void {
  if (state.lastResult) setState({ lastResult: null });
}

/* ── Action execution ──────────────────────────────────────────────────── */

async function executeCwsAction(action: CwsAction): Promise<void> {
  setState({ busy: true });

  try {
    if (!adapter) {
      const result: CwsActionResult = {
        action,
        ok: false,
        message: 'No CWS admin adapter bound',
        completedAt: new Date().toISOString(),
      };
      setState({ lastResult: result, busy: false, lastError: result.message });
      return;
    }

    const result = await adapter.executeAction(action);

    // After a successful action, refresh authoritative lists from the adapter.
    // One-time creation payloads stay in lastResult for reveal UI, but we do
    // not persist provisional create rows locally because some Hermes CLIs
    // assign final ids/derived fields only after the command completes.
    if (result.ok) {
      // Reload the relevant list after every successful action so final ids,
      // derived status, and masked fields come from the verified backend.
      const actionKind = action.kind;
      if (actionKind.startsWith('cron.')) {
        void loadCronJobs();
      }
      if (actionKind.startsWith('webhook.')) {
        void loadWebhooks();
      }
      if (actionKind.startsWith('skill.')) {
        void loadSkills();
      }
    }

    setState({ lastResult: result, busy: false, lastError: result.ok ? null : result.message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: CwsActionResult = {
      action,
      ok: false,
      message,
      completedAt: new Date().toISOString(),
    };
    setState({ lastResult: result, busy: false, lastError: message });
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export function getCronJobs(): CronJob[] {
  return state.cronJobs;
}

export function getWebhooks(): WebhookEntry[] {
  return state.webhooks;
}

export function getSkills(): SkillEntry[] {
  return state.skills;
}

export function getCwsPending(): CwsPendingConfirmation[] {
  return state.pending;
}

export function getCwsLastResult(): CwsActionResult | null {
  return state.lastResult;
}

/* ── Store object + hook ───────────────────────────────────────────────── */

export const cwsAdminStore = {
  get state(): CwsAdminState {
    return state;
  },
  setCwsAdminAdapter,
  hasCwsAdapter,
  loadCronJobs,
  loadWebhooks,
  loadSkills,
  requestCwsAction,
  confirmCwsAction,
  cancelCwsAction,
  cancelAllCwsPending,
  clearCwsLastResult,
  getCronJobs,
  getWebhooks,
  getSkills,
  getCwsPending,
  getCwsLastResult,
};

/** React hook returning the current CWS admin snapshot. */
export function useCwsAdminState(): CwsAdminState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* ── Test-only helpers ─────────────────────────────────────────────────── */

/** Reset the store to initial state. TEST ONLY. */
export function _resetForTest(): void {
  state = { ...initialCwsAdminState() };
  adapter = null;
  nonceCounter = 0;
  emit();
}

/**
 * TEST ONLY: ingest cron jobs directly (bypasses adapter).
 * Still runs the redaction guard.
 */
export function _ingestCronJobs(jobs: CronJob[]): void {
  validateCronMasking(jobs);
  setState({
    cronJobs: jobs,
    cronProvenance: {
      source: 'admin-cli',
      freshness: 'live',
      confidence: 'unverified',
      receivedAt: new Date().toISOString(),
    },
  });
}

/**
 * TEST ONLY: ingest webhooks directly (bypasses adapter).
 * Still runs the redaction guard.
 */
export function _ingestWebhooks(webhooks: WebhookEntry[]): void {
  validateWebhookMasking(webhooks);
  setState({
    webhooks,
    webhookProvenance: {
      source: 'admin-cli',
      freshness: 'live',
      confidence: 'unverified',
      receivedAt: new Date().toISOString(),
    },
  });
}

/**
 * TEST ONLY: ingest skills directly (bypasses adapter).
 */
export function _ingestSkills(skills: SkillEntry[]): void {
  setState({
    skills,
    skillsProvenance: {
      source: 'admin-cli',
      freshness: 'live',
      confidence: 'unverified',
      receivedAt: new Date().toISOString(),
    },
  });
}
