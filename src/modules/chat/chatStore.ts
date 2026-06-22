/**
 * chatStore — the chat module's owned state.
 *
 * Phase 4/5 state model for Sora-MissionControl.
 *
 * Owned state (per docs/section-contracts.md → Chat module → Owned state):
 *   - Selected profile/thread.
 *   - Draft message/composer state.
 *   - Local UI grouping/filtering.
 *
 * Not owned (and deliberately not imported here):
 *   - Profile roster (from shared `profileStore`).
 *   - Transport implementation (injected via `setTransport`).
 *   - Auth/session tokens (Cloud-owned backbone).
 *   - Secrets/provider access.
 *
 * Design rules enforced by this store:
 *   - Per-profile thread isolation: a thread belongs to exactly one profile
 *     and never migrates. Switching profiles preserves every profile's
 *     threads and restores that profile's last-active thread (or `null`).
 *   - Drafts are per-thread, so switching threads/profiles never loses text.
 *   - Message lifecycle is deterministic: pending → sent → delivered (or
 *     pending → failed), with monotonic ids and immutable content.
 *   - Every mutation returns a fresh `ChatState` object so React's
 *     `useSyncExternalStore` sees the change.
 *
 * Persistence assumptions (Phase 4): in-memory only for v1. The shape is
 * designed so a future `persist()` could serialise `state` to
 * `localStorage`/IndexedDB by dropping `lastError` — everything else is
 * plain data. No persistence is implemented here; the backbone owns any
 * durable transport sessions.
 */

import { useSyncExternalStore } from 'react';
import type { AgentId } from '@/types';
import type {
  ChatEvent,
  ChatMessage,
  ChatProfileContext,
  ChatState,
  ChatThread,
  ChatTransport,
  DeliveryState,
} from './types';

/* ── id generation ──────────────────────────────────────────────────────── */

/**
 * Monotonic counter scoped to this store instance. Used for both thread and
 * message ids so ordering is stable within a session. Format:
 *   thread: `th_<n>`
 *   message: `msg_<n>`
 */
let idCounter = 0;
function nextId(prefix: 'th' | 'msg'): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

/** Stable preview length for the thread list. */
const PREVIEW_MAX = 80;

function makePreview(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX)}…` : flat;
}

/* ── initial state ──────────────────────────────────────────────────────── */

const initial: ChatState = {
  threads: {},
  threadIdsByProfile: {} as Record<AgentId, string[]>,
  activeThreadIdByProfile: {},
  selectedProfile: null,
  profiles: {} as Record<AgentId, ChatProfileContext>,
  lastError: null,
};

let state: ChatState = { ...initial };
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

/* ── internal helpers ──────────────────────────────────────────────────── */

/**
 * Replace a thread in the snapshot. Returns a new snapshot; never mutates
 * the input. Throws if the thread id is unknown (caller bug, not user data).
 */
function withThread(next: ChatState, threadId: string, fn: (t: ChatThread) => ChatThread): ChatState {
  const existing = next.threads[threadId];
  if (!existing) throw new Error(`chatStore: unknown thread ${threadId}`);
  const updated = fn(existing);
  return { ...next, threads: { ...next.threads, [threadId]: updated } };
}

/** Shallow-copy a thread's message array. Used before appending/patching. */
function withMessages(thread: ChatThread, fn: (m: ChatMessage[]) => ChatMessage[]): ChatThread {
  return { ...thread, messages: fn([...thread.messages]) };
}

/** Update a message by id within a thread, preserving order. */
function patchMessage(thread: ChatThread, messageId: string, patch: Partial<ChatMessage>): ChatThread {
  return withMessages(thread, (messages) =>
    messages.map((m) => (m.id === messageId ? { ...m, ...patch, updatedAt: Date.now() } : m)),
  );
}

/* ── transport binding ──────────────────────────────────────────────────── */

let transport: ChatTransport | null = null;
let unsubscribeTransport: (() => void) | null = null;

/**
 * Inject the transport adapter (Cloud-owned). Called once during app boot,
 * before any send. The store subscribes to transport events if the transport
 * exposes `subscribe`. Replaces any previously-bound transport and tears down
 * the old subscription.
 */
export function setTransport(t: ChatTransport | null) {
  if (unsubscribeTransport) {
    unsubscribeTransport();
    unsubscribeTransport = null;
  }
  transport = t;
  if (t?.subscribe) {
    unsubscribeTransport = t.subscribe(handleChatEvent);
  }
}

/**
 * Handle an async chat event from the transport. Only `agent.reply` and
 * `agent.error` mutate state; `transport.status` is surfaced via the
 * profile context supplied by the shared `profileStore`, not here.
 */
function handleChatEvent(event: ChatEvent) {
  if (event.type === 'agent.reply') {
    appendAgentMessage(event.threadId, event.profile, event.content, event.sessionId);
  } else if (event.type === 'agent.error') {
    setThreadError(event.threadId, event.error);
  }
  // transport.status is intentionally a no-op here; profile connection state
  // is owned by the shared profileStore.
}

/* ── profile context ───────────────────────────────────────────────────── */

/**
 * Replace the profile context map. Called by the shared `profileStore` (or a
 * React effect bridging it) whenever the roster or per-profile status
 * changes. Does not affect threads or the selected profile.
 */
export function setProfiles(profiles: Record<AgentId, ChatProfileContext>) {
  state = { ...state, profiles };
  emit();
}

/* ── selection ──────────────────────────────────────────────────────────── */

/**
 * Select a profile for the chat surface. Switching profiles:
 *   - Preserves every profile's threads (no data is dropped).
 *   - Restores the profile's last-active thread (or `null` if it had none).
 *   - Preserves per-thread drafts (the composer text is per-thread, not
 *     per-profile, so returning to a thread shows its own draft).
 */
export function selectProfile(profile: AgentId | null) {
  state = { ...state, selectedProfile: profile };
  emit();
}

/**
 * Select a thread as active for its owning profile. The thread must already
 * exist and belong to `profile`. If the profile differs from the currently
 * selected profile, the selected profile is also switched. Switching to a
 * thread of an already-selected profile is the common "open thread" path.
 */
export function selectThread(profile: AgentId, threadId: string) {
  const thread = state.threads[threadId];
  if (!thread) throw new Error(`chatStore: cannot select unknown thread ${threadId}`);
  if (thread.profileId !== profile) {
    throw new Error(`chatStore: thread ${threadId} does not belong to ${profile}`);
  }
  state = {
    ...state,
    selectedProfile: profile,
    activeThreadIdByProfile: { ...state.activeThreadIdByProfile, [profile]: threadId },
  };
  emit();
}

/* ── thread lifecycle ──────────────────────────────────────────────────── */

/**
 * Create a new thread for `profile`. The new thread is empty (no messages),
 * has an empty preview, and becomes the profile's active thread. Returns the
 * new thread id so the caller can immediately focus it.
 *
 * Edge case — first thread for a profile: the profile's thread list is
 * initialised and the profile is considered to have history from here on.
 */
export function createThread(profile: AgentId): string {
  const id = nextId('th');
  const now = Date.now();
  const thread: ChatThread = {
    id,
    profileId: profile,
    sessionId: null,
    messages: [],
    createdAt: now,
    updatedAt: now,
    preview: '',
    draft: '',
  };
  const byProfile = state.threadIdsByProfile[profile] ?? [];
  state = {
    ...state,
    threads: { ...state.threads, [id]: thread },
    threadIdsByProfile: { ...state.threadIdsByProfile, [profile]: [...byProfile, id] },
    activeThreadIdByProfile: { ...state.activeThreadIdByProfile, [profile]: id },
    selectedProfile: profile,
    lastError: null,
  };
  emit();
  return id;
}

/**
 * Delete a thread. Removes it from the profile's list and clears the active
 * pointer for that profile if it pointed here (the profile then has no
 * active thread until the user picks another or creates a new one). No-op if
 * the thread id is unknown.
 */
export function deleteThread(threadId: string) {
  const thread = state.threads[threadId];
  if (!thread) return;
  const profile = thread.profileId;
  const remaining = (state.threadIdsByProfile[profile] ?? []).filter((id) => id !== threadId);
  const active = state.activeThreadIdByProfile[profile];
  const threads = { ...state.threads };
  delete threads[threadId];
  state = {
    ...state,
    threads,
    threadIdsByProfile: { ...state.threadIdsByProfile, [profile]: remaining },
    activeThreadIdByProfile: {
      ...state.activeThreadIdByProfile,
      [profile]: active === threadId ? null : active,
    },
  };
  emit();
}

/* ── draft ─────────────────────────────────────────────────────────────── */

/**
 * Save the composer draft for a thread. Preserved across thread and profile
 * switches — the composer rehydrates from `thread.draft` when the thread is
 * reselected. Empty strings are stored as-is (clearing the draft).
 */
export function setDraft(threadId: string, draft: string) {
  if (!state.threads[threadId]) throw new Error(`chatStore: unknown thread ${threadId}`);
  state = withThread(state, threadId, (t) => ({ ...t, draft }));
  emit();
}

/* ── send / receive ─────────────────────────────────────────────────────── */

/**
 * Send a message to the active thread of `profile`. If the profile has no
 * active thread, a new one is created and used. The user message is inserted
 * as `pending` immediately (optimistic), then the transport is called. On
 * success the message transitions to `sent` (and `delivered` if a synchronous
 * reply came back), and any async reply is appended separately. On failure
 * the message transitions to `failed` with the error text.
 *
 * This is the only public mutator that calls the transport. All other
 * message additions (`agent.reply` events) go through `handleChatEvent`.
 *
 * Throws synchronously if no transport is bound (caller should catch and
 * surface, or call `canSend` first).
 */
export async function sendMessage(profile: AgentId, content: string): Promise<void> {
  if (!transport) {
    state = { ...state, lastError: 'No chat transport bound' };
    emit();
    throw new Error('chatStore: no transport bound');
  }
  const text = content.trim();
  if (!text) return;

  const threadId = resolveActiveThread(profile);
  const userMessage: ChatMessage = {
    id: nextId('msg'),
    role: 'user',
    content: text,
    delivery: 'pending',
    createdAt: Date.now(),
    updatedAt: null,
    sessionId: state.threads[threadId].sessionId,
    error: null,
  };
  // Insert optimistically; clear draft + error.
  state = withThread(state, threadId, (t) => ({
    ...t,
    messages: [...t.messages, userMessage],
    draft: '',
    preview: makePreview(text),
    updatedAt: Date.now(),
    lastError: null as unknown as null,
  }));
  // lastError lives at the top level, not the thread — fix it on the snapshot.
  state = { ...state, lastError: null };
  emit();

  try {
    const result = await transport.sendMessage({
      profile,
      message: text,
      sessionId: state.threads[threadId].sessionId ?? undefined,
    });
    // Ack: pending → sent (or delivered if a sync reply came back). Also
    // persist the transport session id on the thread.
    state = withThread(state, threadId, (t) => ({
      ...t,
      sessionId: result.sessionId,
    }));
    const delivery: DeliveryState = result.reply ? 'delivered' : 'sent';
    state = patchMessageInSnapshot(state, threadId, userMessage.id, {
      delivery,
      sessionId: result.sessionId,
    });
    // If the transport returned a synchronous reply, append it as delivered.
    if (result.reply) {
      appendAgentMessage(threadId, profile, result.reply, result.sessionId);
    } else {
      emit();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state = patchMessageInSnapshot(state, threadId, userMessage.id, {
      delivery: 'failed',
      error: message,
    });
    state = { ...state, lastError: message };
    emit();
  }
}

/**
 * Retry sending a failed message. Re-sends the original message's content
 * through the transport and transitions the ORIGINAL message's delivery
 * state: failed → pending → sent/delivered (or back to failed on error).
 * No new message is inserted — the retry updates the existing one in place
 * so the history stays clean and the user sees the same message recover.
 */
export async function retryMessage(threadId: string, messageId: string): Promise<void> {
  const thread = state.threads[threadId];
  if (!thread) throw new Error(`chatStore: unknown thread ${threadId}`);
  const msg = thread.messages.find((m) => m.id === messageId);
  if (!msg || msg.role !== 'user' || msg.delivery !== 'failed') return;
  if (!transport) {
    state = { ...state, lastError: 'No chat transport bound' };
    emit();
    throw new Error('chatStore: no transport bound');
  }
  // Transition the original to pending, clear its error.
  state = patchMessageInSnapshot(state, threadId, messageId, {
    delivery: 'pending',
    error: null,
    updatedAt: Date.now(),
  });
  emit();
  try {
    const result = await transport.sendMessage({
      profile: thread.profileId,
      message: msg.content,
      sessionId: thread.sessionId ?? undefined,
    });
    state = withThread(state, threadId, (t) => ({ ...t, sessionId: result.sessionId }));
    const delivery: DeliveryState = result.reply ? 'delivered' : 'sent';
    state = patchMessageInSnapshot(state, threadId, messageId, {
      delivery,
      sessionId: result.sessionId,
    });
    if (result.reply) {
      appendAgentMessage(threadId, thread.profileId, result.reply, result.sessionId);
    } else {
      emit();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state = patchMessageInSnapshot(state, threadId, messageId, {
      delivery: 'failed',
      error: message,
      updatedAt: Date.now(),
    });
    state = { ...state, lastError: message };
    emit();
  }
}

/** Whether a send is currently possible (transport bound + content truthy). */
export function canSend(): boolean {
  return transport !== null;
}

/* ── internal: resolve / append / patch ─────────────────────────────────── */

function resolveActiveThread(profile: AgentId): string {
  const active = state.activeThreadIdByProfile[profile];
  if (active && state.threads[active]) return active;
  return createThread(profile);
}

function appendAgentMessage(threadId: string, _profile: AgentId, content: string, sessionId: string) {
  const thread = state.threads[threadId];
  if (!thread) return; // event for a thread we no longer track (deleted) — drop.
  const agentMessage: ChatMessage = {
    id: nextId('msg'),
    role: 'agent',
    content,
    delivery: 'delivered',
    createdAt: Date.now(),
    updatedAt: null,
    sessionId,
    error: null,
  };
  state = withThread(state, threadId, (t) => ({
    ...t,
    sessionId: t.sessionId ?? sessionId,
    messages: [...t.messages, agentMessage],
    preview: makePreview(content),
    updatedAt: Date.now(),
  }));
  emit();
}

function setThreadError(threadId: string, error: string) {
  if (!state.threads[threadId]) return;
  state = { ...withThread(state, threadId, (t) => ({ ...t })), lastError: error };
  emit();
}

function patchMessageInSnapshot(
  next: ChatState,
  threadId: string,
  messageId: string,
  patch: Partial<ChatMessage>,
): ChatState {
  return withThread(next, threadId, (t) => patchMessage(t, messageId, patch));
}

/* ── selectors ──────────────────────────────────────────────────────────── */

/** The active thread for the selected profile, or `null`. */
export function getActiveThread(): ChatThread | null {
  if (!state.selectedProfile) return null;
  const id = state.activeThreadIdByProfile[state.selectedProfile];
  return id ? state.threads[id] ?? null : null;
}

/** Thread ids for a profile, oldest-first. Empty array if the profile has none. */
export function getThreadIds(profile: AgentId): string[] {
  return state.threadIdsByProfile[profile] ?? [];
}

/** The active thread id for a profile, or `null` if none is active. */
export function getActiveThreadId(profile: AgentId): string | null {
  return state.activeThreadIdByProfile[profile] ?? null;
}

/* ── store object + hook ───────────────────────────────────────────────── */

export const chatStore = {
  get state() {
    return state;
  },
  setTransport,
  setProfiles,
  selectProfile,
  selectThread,
  createThread,
  deleteThread,
  setDraft,
  sendMessage,
  retryMessage,
  canSend,
  getActiveThread,
  getThreadIds,
  getActiveThreadId,
};

/** React hook returning the current chat snapshot. Re-renders on every emit. */
export function useChatState(): ChatState {
  return useSyncExternalStore(subscribe, getSnapshot);
}