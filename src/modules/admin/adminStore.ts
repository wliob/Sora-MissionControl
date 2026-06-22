/**
 * adminStore — the admin module's owned state.
 *
 * Phase 6 state model for Sora-MissionControl.
 *
 * Owned state (per docs/section-contracts.md → Admin/control module → Owned state):
 *   - Selected model (detail/edit view).
 *   - Pending confirmations for destructive/risky actions.
 *   - Action result log (bounded).
 *   - Local UI filters/grouping.
 *
 * Not owned (and deliberately not imported here):
 *   - Transport/adapter implementation (injected via `setAdminAdapter`).
 *   - Auth/session tokens (Cloud-owned backbone).
 *   - Secrets/provider access — the store never holds raw secret values.
 *
 * Design rules enforced by this store:
 *   - Secret redaction: the store ingests `ModelEntry` objects whose
 *     `apiKeyMasked` field is already masked. On ingest, the store runs
 *     `assertMasked` to reject any entry that looks like it contains a raw
 *     secret. This is a defense-in-depth check; adapters should mask first.
 *   - Destructive-action confirmation: every destructive AdminActionType
 *     (see `isDestructiveAction`) is gated behind a `ConfirmationRequest`.
 *     The UI must call `confirmAction(id)` to execute or `cancelAction(id)`
 *     to dismiss. Non-destructive actions execute immediately via the adapter.
 *   - Every mutation returns a fresh `AdminState` object so React's
 *     `useSyncExternalStore` sees the change.
 *   - Action results are bounded to LAST_RESULTS_MAX entries to prevent
 *     unbounded growth.
 *
 * Persistence assumptions (Phase 6): in-memory only for v1. No persistence is
 * implemented here; the backbone owns any durable transport sessions.
 */

import { useSyncExternalStore } from 'react';
import type {
  AdminActionPayload,
  AdminActionRequest,
  AdminActionResult,
  AdminActionResultStatus,
  AdminActionType,
  AdminState,
  ConfirmationRequest,
  ModelEntry,
} from '@/types/admin';
import { initialAdminState, isDestructiveAction, looksUnmasked } from '@/types/admin';
import { tracked } from '@/types/provenance';

/* ── id generation ──────────────────────────────────────────────────────── */

/**
 * Monotonic counter scoped to this store instance. Used for confirmation ids
 * and action-result ids so ordering is stable within a session. Format:
 *   confirmation: `confirm_<n>`
 *   result: `result_<n>`
 */
let idCounter = 0;
function nextId(prefix: 'confirm' | 'result'): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

/** Maximum entries kept in the action-result log. Older entries are dropped. */
const LAST_RESULTS_MAX = 50;

/* ── initial state ──────────────────────────────────────────────────────── */

let state: AdminState = { ...initialAdminState() };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

/* ── adapter binding ───────────────────────────────────────────────────── */

/**
 * The Cloud-owned admin adapter. The store calls these methods to execute
 * actions against the real Hermes backend. The adapter is responsible for:
 *   - Listing models and returning masked ModelEntry objects.
 *   - Executing confirmed actions (enable, disable, setDefault, etc.).
 *   - Never returning raw secret values.
 */
export interface AdminAdapter {
  /** List all configured models with masked secrets. */
  listModels(): Promise<ModelEntry[]>;
  /** Execute a confirmed admin action. Returns a non-secret result. */
  executeAction(request: AdminActionRequest): Promise<void>;
}

let adapter: AdminAdapter | null = null;

/**
 * Inject the admin adapter (Cloud-owned). Called once during app boot,
 * before any action. Replaces any previously-bound adapter.
 */
export function setAdminAdapter(a: AdminAdapter | null) {
  adapter = a;
}

/** Whether an adapter is bound (UI may disable action buttons when false). */
export function hasAdapter(): boolean {
  return adapter !== null;
}

/* ── redaction guard ───────────────────────────────────────────────────── */

/**
 * Defense-in-depth: reject any ModelEntry whose `apiKeyMasked` looks like it
 * contains a raw unmasked secret. This catches adapter bugs before a secret
 * can leak into the store/UI.
 *
 * Throws if the entry fails the check. The caller (ingestModels) catches and
 * sets `lastError` rather than letting the raw data through.
 */
function assertMasked(entry: ModelEntry): void {
  if (looksUnmasked(entry.apiKeyMasked)) {
    throw new Error(
      `adminStore: refusing to ingest model ${entry.id} — apiKeyMasked looks unmasked (adapter bug)`,
    );
  }
}

/* ── model ingestion ───────────────────────────────────────────────────── */

/**
 * Ingest a fresh model list from the adapter. Each entry is checked for
 * secret-redaction safety; if any entry fails the check, the whole list is
 * rejected and `lastError` is set. This is intentional — a partial list with
 * a leaked secret is worse than no list at all.
 *
 * On success, `models` is updated with provenance and `lastError` is cleared.
 */
export function ingestModels(models: ModelEntry[]): void {
  try {
    for (const entry of models) {
      assertMasked(entry);
    }
    state = {
      ...state,
      models: tracked(models, {
        source: 'admin-cli',
        freshness: 'live',
        confidence: 'verified',
      }),
      lastError: null,
    };
    emit();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state = { ...state, lastError: message };
    emit();
  }
}

/**
 * Load models from the bound adapter. If no adapter is bound, sets lastError.
 * On success, calls `ingestModels` which runs the redaction guard.
 */
export async function loadModels(): Promise<void> {
  if (!adapter) {
    state = { ...state, lastError: 'No admin adapter bound' };
    emit();
    return;
  }
  try {
    const models = await adapter.listModels();
    ingestModels(models);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state = { ...state, lastError: message };
    emit();
  }
}

/* ── selection ──────────────────────────────────────────────────────────── */

/**
 * Select a model for the detail/edit view. No-op if the model id is not in
 * the current list (UI should call after loadModels succeeds).
 */
export function selectModel(modelId: string | null): void {
  state = { ...state, selectedModelId: modelId };
  emit();
}

/* ── action request / confirmation flow ─────────────────────────────────── */

/**
 * Request an admin action. If the action is destructive/risky
 * (isDestructiveAction), a ConfirmationRequest is created and added to
 * `pendingConfirmations` — the UI must render a confirm dialog and the user
 * must call `confirmAction(id)` to execute or `cancelAction(id)` to dismiss.
 *
 * If the action is non-destructive, it executes immediately via the adapter.
 *
 * `payload` must be the correct AdminActionPayload variant for the `type`.
 */
export function requestAction(
  modelId: string,
  type: AdminActionType,
  payload: AdminActionPayload,
): void {
  const request: AdminActionRequest = {
    modelId,
    type,
    payload,
    requiresConfirmation: isDestructiveAction(type),
  };

  if (!request.requiresConfirmation) {
    // Non-destructive: execute immediately (fire-and-forget; errors surface
    // via lastError). We do not block the UI here.
    void executeAction(request, `immediate_${nextId('result')}`);
    return;
  }

  // Destructive: create a confirmation request.
  const confirmation: ConfirmationRequest = {
    id: nextId('confirm'),
    action: request,
    message: buildConfirmMessage(request),
    createdAt: Date.now(),
  };
  state = {
    ...state,
    pendingConfirmations: [...state.pendingConfirmations, confirmation],
  };
  emit();
}

/**
 * Build a human-readable confirmation message for a destructive action.
 * Names the action and target model; never includes secrets.
 */
function buildConfirmMessage(request: AdminActionRequest): string {
  const model = findModel(request.modelId);
  const modelLabel = model ? (model.label ?? model.model) : request.modelId;
  switch (request.type) {
    case 'model.disable':
      return `Disable model "${modelLabel}"? This will interrupt any usage that depends on it.`;
    case 'model.setDefault':
      return `Set "${modelLabel}" as the default model? This changes routing for all profiles using the default.`;
    case 'model.setFallback':
      return `Change fallback configuration for "${modelLabel}"? This affects failover routing.`;
    case 'model.delete':
      return `Delete model "${modelLabel}"? This cannot be undone.`;
    case 'model.resetCredential':
      return `Reset the credential for "${modelLabel}"? The current API key will be invalidated.`;
    default:
      return `Confirm action "${request.type}" on "${modelLabel}"?`;
  }
}

/**
 * Confirm a pending destructive action. Executes it via the adapter, records
 * the result, and removes the confirmation from the pending list.
 *
 * Throws synchronously if the confirmation id is unknown (caller bug).
 */
export async function confirmAction(confirmationId: string): Promise<void> {
  const pending = state.pendingConfirmations.find((c) => c.id === confirmationId);
  if (!pending) throw new Error(`adminStore: unknown confirmation ${confirmationId}`);

  // Remove from pending immediately; execution result goes to lastResults.
  state = {
    ...state,
    pendingConfirmations: state.pendingConfirmations.filter((c) => c.id !== confirmationId),
  };
  emit();

  await executeAction(pending.action, confirmationId);
}

/**
 * Cancel a pending destructive action. Removes it from the pending list
 * without executing. Records a 'cancelled' result for audit.
 */
export function cancelAction(confirmationId: string): void {
  const pending = state.pendingConfirmations.find((c) => c.id === confirmationId);
  if (!pending) return;

  const result: AdminActionResult = {
    id: confirmationId,
    actionType: pending.action.type,
    modelId: pending.action.modelId,
    status: 'cancelled',
    error: null,
    completedAt: Date.now(),
  };
  state = {
    ...state,
    pendingConfirmations: state.pendingConfirmations.filter((c) => c.id !== confirmationId),
    lastResults: appendResult(state.lastResults, result),
  };
  emit();
}

/**
 * Dismiss a specific confirmation without recording a 'cancelled' result.
 * Used when the UI unmounts or the user navigates away and wants to silently
 * clear the dialog. The action is NOT executed.
 */
export function dismissConfirmation(confirmationId: string): void {
  state = {
    ...state,
    pendingConfirmations: state.pendingConfirmations.filter((c) => c.id !== confirmationId),
  };
  emit();
}

/* ── action execution ──────────────────────────────────────────────────── */

/**
 * Execute an action via the adapter and record the result. Used by both the
 * immediate (non-destructive) path and the confirm path.
 *
 * `resultId` is the id to use for the AdminActionResult. For confirmations,
 * this is the confirmation id so results can be correlated. For immediate
 * actions, a fresh `result_<n>` id is generated.
 */
async function executeAction(
  request: AdminActionRequest,
  resultId: string,
): Promise<void> {
  if (!adapter) {
    const result: AdminActionResult = {
      id: resultId,
      actionType: request.type,
      modelId: request.modelId,
      status: 'failed',
      error: 'No admin adapter bound',
      completedAt: Date.now(),
    };
    state = {
      ...state,
      lastResults: appendResult(state.lastResults, result),
      lastError: result.error!,
    };
    emit();
    return;
  }

  try {
    await adapter.executeAction(request);
    const result: AdminActionResult = {
      id: resultId,
      actionType: request.type,
      modelId: request.modelId,
      status: 'success',
      error: null,
      completedAt: Date.now(),
    };
    state = {
      ...state,
      lastResults: appendResult(state.lastResults, result),
      lastError: null,
    };
    emit();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: AdminActionResult = {
      id: resultId,
      actionType: request.type,
      modelId: request.modelId,
      status: 'failed',
      error: message,
      completedAt: Date.now(),
    };
    state = {
      ...state,
      lastResults: appendResult(state.lastResults, result),
      lastError: message,
    };
    emit();
  }
}

/** Append a result to the log, bounded to LAST_RESULTS_MAX. */
function appendResult(
  results: AdminActionResult[],
  result: AdminActionResult,
): AdminActionResult[] {
  const next = [...results, result];
  if (next.length > LAST_RESULTS_MAX) {
    return next.slice(next.length - LAST_RESULTS_MAX);
  }
  return next;
}

/* ── helpers ───────────────────────────────────────────────────────────── */

/** Find a model entry by id in the current list. Returns undefined if not found. */
function findModel(modelId: string): ModelEntry | undefined {
  const list = state.models.value;
  if (!list) return undefined;
  return list.find((m) => m.id === modelId);
}

/* ── selectors ──────────────────────────────────────────────────────────── */

/** The current model list (may be null if not loaded yet). */
export function getModels(): ModelEntry[] | null {
  return state.models.value;
}

/** The selected model entry, or null. */
export function getSelectedModel(): ModelEntry | null {
  if (!state.selectedModelId) return null;
  return findModel(state.selectedModelId) ?? null;
}

/** All pending confirmations (UI renders each as a confirm dialog). */
export function getPendingConfirmations(): ConfirmationRequest[] {
  return state.pendingConfirmations;
}

/** The most recent action results, newest-last. */
export function getLastResults(): AdminActionResult[] {
  return state.lastResults;
}

/* ── store object + hook ───────────────────────────────────────────────── */

export const adminStore = {
  get state() {
    return state;
  },
  setAdminAdapter,
  hasAdapter,
  loadModels,
  ingestModels,
  selectModel,
  requestAction,
  confirmAction,
  cancelAction,
  dismissConfirmation,
  getModels,
  getSelectedModel,
  getPendingConfirmations,
  getLastResults,
};

/** React hook returning the current admin snapshot. Re-renders on every emit. */
export function useAdminState(): AdminState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* ── test-only helpers ─────────────────────────────────────────────────── */

/**
 * Reset the store to initial state. TEST ONLY — exported for the test suite
 * to reset between tests. Not intended for production use.
 */
export function _resetForTest(): void {
  state = { ...initialAdminState() };
  adapter = null;
  idCounter = 0;
  emit();
}

/**
 * TEST ONLY: get the current result status for a given id, or null.
 * Convenience for assertions.
 */
export function _getResultStatus(id: string): AdminActionResultStatus | null {
  const r = state.lastResults.find((res) => res.id === id);
  return r ? r.status : null;
}