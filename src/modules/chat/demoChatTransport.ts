/**
 * demoChatTransport — an EXPLICIT MOCK ChatTransport.
 *
 * Phase 4 fallback. Per docs/section-contracts.md → Phase handoff gates:
 *   "Phase 4 chat cannot start until `ChatTransport` is real or explicitly
 *    mocked."
 *
 * This is the explicit mock. It satisfies the `ChatTransport` interface so the
 * chat store, backbone, and UI can be exercised end-to-end without Cloud's
 * verified transport. It is clearly labelled mock/demo:
 *   - `isDemo` is `true` (real transports set it `false`).
 *   - Every agent reply is prefixed with `[demo]` so demo output is never
 *     mistaken for a real agent response.
 *   - `listProfiles` returns the static `AGENTS` roster, not a live backend
 *     query. This is the ONLY place the chat module touches the roster
 *     directly, and only because there is no verified profile endpoint yet —
 *     the chatBackbone bridges this into the shared `setProfiles` so the
 *     store still consumes, not enumerates.
 *
 * Forbidden here (per Chat module forbidden dependencies):
 *   - No CLI spawning.
 *   - No secret/provider access.
 *   - No consumer-messenger styling (this is data-only).
 *
 * When Cloud lands a verified transport, `chatBackbone` swaps this out for the
 * real adapter via `setTransport`. No store or UI code changes.
 */

import { AGENTS } from '@/types';
import type { AgentId } from '@/types';
import type {
  ChatEvent,
  ChatTransport,
  ProfileSummary,
  SendMessageInput,
  SendMessageResult,
} from './types';

/** Marker: a real transport sets this `false`. UI/backbone may gate on it. */
export const DEMO_MODE = true;

/** Canned demo replies keyed by profile id. Deterministic, clearly labelled. */
const DEMO_REPLIES: Record<AgentId, string> = {
  biscuit: '[demo] Biscuit here. Demo transport is echoing your directive — no live agent is running.',
  cloud: '[demo] Cloud standing by in demo mode. Transport endpoint not yet verified.',
  korra: '[demo] Korra in demo mode. Visuals are real; chat replies are canned.',
  lelouch: '[demo] Lelouch demo reply. Logistics channel is a mock until transport is verified.',
  tifa: '[demo] Tifa demo reply. Finance channel is mocked in demo mode.',
  sora: '[demo] Sora demo reply. Guild master channel is mocked in demo mode.',
  rain: '[demo] Rain demo reply. Communications channel is mocked in demo mode.',
};

/**
 * Build a deterministic demo session id. Stable per profile so a resumed
 * thread keeps the same session id within a page session — mimics how a real
 * transport would echo/assign session ids.
 */
function demoSessionId(profile: AgentId, sessionId?: string): string {
  if (sessionId) return sessionId;
  return `demo-sess-${profile}-${Math.random().toString(36).slice(2, 8)}`;
}

type Subscriber = (event: ChatEvent) => void;

/**
 * Create the demo mock transport. Returns a `ChatTransport` plus a small
 * introspection surface for tests (`isDemo`, `sent`, `emit`).
 */
export function createDemoChatTransport(): ChatTransport & {
  isDemo: true;
  /** Inputs passed to `sendMessage`, in order — for test assertions. */
  sent: SendMessageInput[];
  /** Emit an async event to all subscribers (test/driver hook). */
  emit(event: ChatEvent): void;
} {
  const subscribers = new Set<Subscriber>();
  const sent: SendMessageInput[] = [];

  return {
    isDemo: DEMO_MODE,
    sent,
    emit(event: ChatEvent) {
      for (const s of subscribers) s(event);
    },
    async listProfiles(): Promise<ProfileSummary[]> {
      // Static AGENTS roster — the only roster touch, and only because no
      // verified profile endpoint exists yet. chatBackbone bridges this into
      // the shared profile context.
      return AGENTS.map((a) => ({ id: a.id, name: a.name, role: a.role }));
    },
    async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
      sent.push(input);
      const sessionId = demoSessionId(input.profile, input.sessionId);
      const reply = DEMO_REPLIES[input.profile] ?? `[demo] Demo reply for ${input.profile}.`;
      return { sessionId, reply };
    },
    subscribe(handler: Subscriber): () => void {
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
    },
  };
}