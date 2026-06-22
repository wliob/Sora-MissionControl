/**
 * HermesChatTransport — Phase 4 verified chat adapter.
 *
 * Uses the real Hermes dashboard API for profile listing. Chat messaging
 * and live events require the dashboard's embedded PTY WebSocket bridge,
 * which is not available to external browser apps. Until Cloud builds a
 * local CLI proxy or the dashboard exposes a direct chat REST/WS surface,
 * sendMessage and subscribe report unavailability honestly.
 *
 * The chatBackbone falls back to createDemoChatTransport when no verified
 * transport is supplied — this transport signals its own unavailability
 * so the backbone can make that decision automatically.
 */

import type { AgentId } from '@/types';
import { HermesDashboardClient } from '@/services/hermes/dashboardClient';
import type {
  ChatEvent,
  ChatTransport,
  ProfileSummary,
  SendMessageInput,
  SendMessageResult,
} from './types';

interface RawKanbanProfile {
  name: string;
  is_default: boolean;
  model: string;
  provider: string;
  description: string;
  description_auto: boolean;
  skill_count: number;
}

interface RawKanbanProfilesResponse {
  profiles: RawKanbanProfile[];
}

export class HermesChatTransport implements ChatTransport {
  private client: HermesDashboardClient;

  constructor(client: HermesDashboardClient) {
    this.client = client;
  }

  /**
   * List profiles from the verified /api/plugins/kanban/profiles endpoint.
   * Maps the kanban profile shape into the ChatTransport ProfileSummary.
   */
  async listProfiles(): Promise<ProfileSummary[]> {
    const result =
      await this.client.requestJson<RawKanbanProfilesResponse>(
        '/api/plugins/kanban/profiles',
      );
    return result.data.profiles.map((p) => ({
      id: p.name as AgentId,
      name: p.name,
      role: p.description || p.name,
    }));
  }

  /**
   * Send a chat message. Currently unavailable — the Hermes dashboard
   * does not expose a direct REST chat endpoint. Chat messaging goes
   * through the dashboard's embedded PTY WebSocket bridge, which is
   * only available inside the dashboard SPA, not to external apps.
   *
   * Cloud owns building a local CLI proxy or verifying a real chat
   * transport surface. Until then, the demo transport is the fallback.
   */
  async sendMessage(_input: SendMessageInput): Promise<SendMessageResult> {
    // No REST chat endpoint exists on the Hermes dashboard. Chat messaging
    // goes through the dashboard's embedded PTY WebSocket bridge, which is
    // only available inside the dashboard SPA, not to external apps. Throw
    // honestly so the chatBackbone falls back to the demo transport.
    throw new Error(
      'no REST chat endpoint: Hermes dashboard does not expose a direct chat REST surface; ' +
        'messaging requires the embedded PTY WebSocket bridge (dashboard-only).',
    );
  }

  /**
   * Subscribe to live chat events. Currently unavailable — no chat
   * WebSocket endpoint exists on the dashboard (/api/plugins/chat/events
   * returns 404). Same blocker as sendMessage.
   */
  subscribe(_handler: (event: ChatEvent) => void): () => void {
    // No chat WebSocket endpoint exists on the dashboard
    // (/api/plugins/chat/events returns 404). Same blocker as sendMessage.
    throw new Error(
      'no chat WebSocket endpoint: Hermes dashboard exposes no direct chat event stream; ' +
        'live events require the embedded PTY WebSocket bridge (dashboard-only).',
    );
  }

  /**
   * Whether this transport can actually send messages or subscribe to
   * events. Returns false because the Hermes dashboard exposes no chat
   * REST or WebSocket surface to external apps — only the embedded PTY
   * bridge inside the dashboard SPA. The chatBackbone uses this to decide
   * whether to fall back to the demo transport.
   */
  static isAvailable(): boolean {
    // The Hermes dashboard does not expose a chat REST or WebSocket surface
    // to external apps (only the embedded PTY bridge inside the SPA). So this
    // transport cannot actually send messages or subscribe to events. Return
    // false so the chatBackbone falls back to the demo transport honestly.
    return false;
  }
}
