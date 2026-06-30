/**
 * HermesChatTransport — Phase 4 verified chat adapter.
 *
 * Uses the Hermes dashboard PTY WebSocket bridge for chat messaging,
 * proxied through missionControlProxy.js at /api/pty?token=<session-token>.
 * The bridge forwards WebSocket connections to the Hermes dashboard PTY,
 * enabling terminal-based chat with Hermes agents.
 *
 * Profile listing uses the verified /api/plugins/kanban/profiles endpoint.
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

function normalizeChatCommandMessage(message: string): string {
  return message.replace(/[\r\n]+/g, ' ').trim();
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
   * Send a chat message via the PTY WebSocket bridge.
   *
   * Connects to the PTY bridge at /api/pty?token=<session-token> (proxied
   * through missionControlProxy.js to the Hermes dashboard). Sends a chat
   * command and returns the agent's response.
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const sessionToken = this.client.getSessionToken();
    const wsBaseUrl = this.client.getWsBaseUrl();
    const wsUrl = `${wsBaseUrl}/api/pty?token=${encodeURIComponent(sessionToken || '')}`;

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      const chunks: string[] = [];
      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          if (timeout) clearTimeout(timeout);
          if (idleTimer) clearTimeout(idleTimer);
          fn();
        }
      };

      try {
        const ws = new WebSocket(wsUrl);
        const finishWithBufferedResponse = () => {
          settle(() => {
            const response = chunks.join('').trim();
            if (!response) {
              reject(new Error('PTY WebSocket closed without response'));
              return;
            }
            try {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
              }
            } catch { /* ignore */ }
            resolve({
              sessionId: input.sessionId || `pty-${Date.now()}`,
              reply: response,
            });
          });
        };

        timeout = setTimeout(() => {
          settle(() => {
            try { ws.close(); } catch { /* ignore */ }
            reject(new Error('PTY WebSocket connection timed out'));
          });
        }, 30_000);

        ws.onopen = () => {
          // Send chat command. The PTY bridge accepts "chat <profile> <message>".
          const message = normalizeChatCommandMessage(input.message);
          const cmd = `chat ${input.profile} ${message}\n`;
          ws.send(cmd);
        };

        ws.onmessage = (event) => {
          chunks.push(String(event.data));
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(finishWithBufferedResponse, 350);
        };

        ws.onerror = () => {
          settle(() => {
            reject(new Error('PTY WebSocket connection error'));
          });
        };

        ws.onclose = () => {
          if (chunks.length > 0) {
            finishWithBufferedResponse();
            return;
          }
          settle(() => {
            reject(new Error('PTY WebSocket closed without response'));
          });
        };
      } catch (err) {
        settle(() => {
          reject(err instanceof Error ? err : new Error(String(err)));
        });
      }
    });
  }

  /**
   * Subscribe to live chat events via the PTY WebSocket bridge.
   *
   * Opens a persistent WebSocket connection to the PTY bridge for receiving
   * agent replies and transport status updates. Returns an unsubscribe function.
   */
  subscribe(handler: (event: ChatEvent) => void): () => void {
    const sessionToken = this.client.getSessionToken();
    const wsBaseUrl = this.client.getWsBaseUrl();
    const wsUrl = `${wsBaseUrl}/api/pty?token=${encodeURIComponent(sessionToken || '')}`;

    let ws: WebSocket | null = null;
    let closed = false;
    let opened = false;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        opened = true;
        if (!closed) {
          handler({
            type: 'transport.status',
            profile: 'biscuit' as AgentId,
            state: 'connected',
          });
        }
      };

      ws.onmessage = () => {
        // The PTY bridge is terminal-stream oriented, not a profile-scoped
        // event bus. sendMessage() owns request/response routing; the
        // persistent subscription is used only to surface connection status.
      };

      ws.onerror = () => {
        if (!closed && opened) {
          handler({
            type: 'transport.status',
            profile: 'biscuit' as AgentId,
            state: 'degraded',
          });
        }
      };

      ws.onclose = () => {
        if (!closed) {
          closed = true;
          handler({
            type: 'transport.status',
            profile: 'biscuit' as AgentId,
            state: 'offline',
          });
        }
        ws = null;
      };
    } catch {
      closed = true;
    }

    return () => {
      closed = true;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        try { ws.close(); } catch { /* ignore */ }
      }
      ws = null;
    };
  }

  /**
   * Whether this transport can send messages or subscribe to events.
   *
   * Returns true now that the PTY WebSocket bridge is available through
   * missionControlProxy.js. The chatBackbone uses this to decide whether
   * to select this transport over the demo mock.
   */
  static isAvailable(): boolean {
    return true;
  }
}
