/**
 * Chat module — types and contracts.
 *
 * Phase 4/5 state model for the Sora-MissionControl command-console chat
 * surface. Per-profile thread isolation, deterministic message lifecycle,
 * draft preservation across switches.
 *
 * Contracts referenced:
 *   - docs/section-contracts.md → Chat module
 *   - shared/phase0-korra-visual-contract.md → §1.2 chat visual direction
 *   - src/types/index.ts → AgentId, AGENTS (the profile roster source)
 *
 * The chat module MUST NOT spawn CLI, access secrets, or maintain an
 * independent profile roster. Profiles come from the shared `profileStore`
 * (Cloud-owned, Phase 3). Transport comes from a `ChatTransport` adapter
 * (Cloud-owned). The store below owns only selected profile/thread, draft
 * state, and local message grouping — exactly the "Owned state" set in the
 * section contract.
 */

import type { AgentId } from '@/types';

/* ── Profile context ─────────────────────────────────────────────────── */

/**
 * A profile in the chat surface. Sourced from the shared `profileStore`,
 * never enumerated independently by this module. Carried through the store
 * so the UI can render presence/status without re-querying the backbone.
 */
export interface ChatProfileContext {
  id: AgentId;
  name: string;
  role: string;
  accent: string;
  /** Live activity hint, same semantics as the office/ops presence layer. */
  activity?: 'idle' | 'working' | 'blocked';
  /** Connection state for the chat transport backing this profile. */
  connection?: 'connected' | 'degraded' | 'offline' | 'unknown';
}

/* ── Messages ─────────────────────────────────────────────────────────── */

/** Who authored a chat line. */
export type ChatRole = 'user' | 'agent' | 'system';

/**
 * Delivery lifecycle for a user-authored message. The store transitions
 * messages through this state machine deterministically:
 *
 *   pending  ──(transport ack)──►  sent  ──(agent reply)──►  delivered
 *   pending  ──(transport err)──►  failed
 *   failed   ──(retry send)─────►  pending
 *
 * Agent and system messages are inserted directly as `delivered` (agent) or
 * `delivered`/`failed` (system error lines) — they never enter `pending`.
 */
export type DeliveryState = 'pending' | 'sent' | 'delivered' | 'failed';

/** A single chat line. Immutable once inserted except for `delivery`. */
export interface ChatMessage {
  /** Stable id, unique within a thread. Monotonic within a session. */
  id: string;
  /** Author role. `user` = operator → agent, `agent` = agent reply, `system` = status/error/info. */
  role: ChatRole;
  /** Message body, verbatim. Never mutated after insertion. */
  content: string;
  /** Delivery state. See `DeliveryState` for the transition graph. */
  delivery: DeliveryState;
  /** Epoch ms when the store inserted this message. Stable. */
  createdAt: number;
  /** Epoch ms of the last delivery-state transition. `null` until first transition. */
  updatedAt: number | null;
  /**
   * Transport-assigned session id. Present once the transport confirms a
   * session for this thread. Lets the UI show "thread is live" without
   * re-querying. `null` until the transport returns one.
   */
  sessionId: string | null;
  /** Error text when `delivery === 'failed'`. `null` otherwise. */
  error: string | null;
}

/* ── Threads ──────────────────────────────────────────────────────────── */

/**
 * A conversation thread scoped to exactly one profile. A profile may have
 * many threads; exactly one is "active" per profile at a time. Switching
 * profiles preserves every profile's threads and restores the profile's
 * last-active thread.
 */
export interface ChatThread {
  /** Stable id, unique across all profiles within a session. */
  id: string;
  /** Owning profile. A thread never moves between profiles. */
  profileId: AgentId;
  /**
   * Hermes session id. `null` until the transport assigns one (on first
   * successful send). Used as `SendMessageInput.sessionId` for subsequent
   * messages so the agent retains context across a thread.
   */
  sessionId: string | null;
  /** Ordered message history, oldest first. May be empty (new thread). */
  messages: ChatMessage[];
  /** Epoch ms when the thread was created. Stable. */
  createdAt: number;
  /** Epoch ms of the last message insertion or delivery transition. */
  updatedAt: number;
  /**
   * Preview text for the thread list. Empty string for a brand-new thread
   * (UI renders an empty-state placeholder). Updated to the last message's
   * truncated content on every insertion.
   */
  preview: string;
  /** Unsaved composer draft. Preserved across thread/profile switches. */
  draft: string;
}

/* ── Transport adapter (Cloud-owned, Phase 3) ─────────────────────────── */

/** Profile summary from the shared roster — consumed, not enumerated, here. */
export interface ProfileSummary {
  id: AgentId;
  name: string;
  role: string;
}

/** Input to a single outbound send, per the section contract. */
export interface SendMessageInput {
  profile: AgentId;
  message: string;
  /** Hermes session id when continuing an existing thread. */
  sessionId?: string;
  /** Opaque context bag forwarded to the transport. */
  context?: Record<string, unknown>;
}

/** Result of a successful send. */
export interface SendMessageResult {
  /** Transport-assigned session id (may be new or echo of the input). */
  sessionId: string;
  /** Agent reply text, if the transport returned one synchronously. */
  reply?: string;
}

/** Async event pushed by a subscribed transport (agent replies, errors). */
export type ChatEvent =
  | { type: 'agent.reply'; threadId: string; profile: AgentId; sessionId: string; content: string }
  | { type: 'agent.error'; threadId: string; profile: AgentId; error: string }
  | { type: 'transport.status'; profile: AgentId; state: 'connected' | 'degraded' | 'offline' };

/**
 * Transport boundary. Cloud owns the concrete implementation; the chat
 * store depends only on this interface so a verified transport and a
 * clearly-labelled demo/mock transport are interchangeable. See
 * `docs/section-contracts.md` → Chat module → Inputs.
 */
export interface ChatTransport {
  listProfiles(): Promise<ProfileSummary[]>;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  /** Optional live-event subscription. Returns an unsubscribe function. */
  subscribe?(handler: (event: ChatEvent) => void): () => void;
}

/* ── Store snapshot ───────────────────────────────────────────────────── */

/**
 * Full state snapshot consumed by `useChatState`. Every mutation produces a
 * new object so `useSyncExternalStore` detects the change. The store never
 * mutates the snapshot in place.
 */
export interface ChatState {
  /** All threads, keyed by thread id. */
  threads: Record<string, ChatThread>;
  /** Thread ids grouped by profile, oldest-first. */
  threadIdsByProfile: Record<AgentId, string[]>;
  /** The active thread id for each profile. `null` if the profile has none. */
  activeThreadIdByProfile: Partial<Record<AgentId, string | null>>;
  /** The currently selected profile for the chat surface. */
  selectedProfile: AgentId | null;
  /** Profile context supplied by the shared `profileStore`. */
  profiles: Record<AgentId, ChatProfileContext>;
  /** Last error emitted by the store (transport failure, invalid op). Cleared on next successful op. */
  lastError: string | null;
}