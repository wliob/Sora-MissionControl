/**
 * Phase 3 live data/auth backbone bootstrap.
 *
 * Binds the real Hermes dashboard REST/WS adapter to the shared stores. This
 * file is the app-level composition seam; section modules consume stores and
 * adapters, not this implementation detail.
 */

import type { SessionConnectionAdapter } from '@/state/sessionConnectionStore';
import {
  beginValidation,
  getConnectionState,
  markStale,
  markSynced,
  markWsConnected,
  scheduleReconnectBackoff,
  setPendingEventCount,
  setSessionConnectionAdapter,
  updateSourceHealth,
} from '@/state/sessionConnectionStore';
import { boardStore } from '@/state/boardStore';
import { getUsageState, refreshUsage, setUsageAdapter } from '@/state/usageStore';
import {
  HermesDashboardClient,
  KanbanWebSocketClient,
  type DashboardClientOptions,
} from '@/services/hermes/dashboardClient';
import type { HealthSourceId, SourceHealth } from '@/types/connection';
import type { ChatTransport } from '@/modules/chat/types';
import { startChatBackbone, stopChatBackbone } from '@/modules/chat/chatBackbone';
import { MissionControlAdminProxyAdapter } from '@/services/hermes/adminProxyAdapter';
import { HermesProjectControlAdapter } from '@/services/hermes/projectControlAdapter';
import {
  loadKeys,
  loadMcpEntries,
  setKeyMcpAdminAdapter,
} from '@/state/adminKeyMcpStore';
import {
  loadCronJobs,
  loadSkills,
  loadWebhooks,
  setCwsAdminAdapter,
} from '@/state/cwsAdminStore';
import {
  setProjectControlMutationAdapter,
  setProjectControlReadAdapter,
} from '@/state/projectControlStore';

export interface MissionControlBackboneOptions extends DashboardClientOptions {
  /** Start REST sync immediately when `start()` is called. Default true. */
  syncOnStart?: boolean;
  /** Open the Kanban WS after the first REST sync. Default true. */
  connectWebSocket?: boolean;
  /** Allows tests to inject a fake WebSocket class. */
  WebSocketImpl?: typeof WebSocket;
  /**
   * A Cloud-verified `ChatTransport`, if available. When omitted, the chat
   * backbone binds the explicit demo mock. This is the single swap point when
   * Cloud lands a real chat transport (Phase 4 handoff gate).
   */
  chatTransport?: ChatTransport | null;
  /** Start the chat backbone alongside the session backbone. Default true. */
  startChat?: boolean;
  /** Bind the local safe admin proxy adapter. Default true. */
  startAdminProxy?: boolean;
  /** Override the safe admin proxy URL. Default is same host on port 3187. */
  adminProxyUrl?: string;
}

export interface MissionControlBackbone {
  client: HermesDashboardClient;
  start(): Promise<void>;
  stop(): void;
  syncOnce(): Promise<void>;
  connectKanbanWebSocket(): void;
}

const WS_BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

function nowIso(): string {
  return new Date().toISOString();
}

function health(state: SourceHealth['state'], error?: string): SourceHealth {
  const checkedAt = nowIso();
  return {
    state,
    lastOkAt: state === 'connected' ? checkedAt : null,
    lastCheckedAt: checkedAt,
    ...(error ? { error } : {}),
  };
}

export function createMissionControlBackbone(
  options: MissionControlBackboneOptions = {},
): MissionControlBackbone {
  const client = new HermesDashboardClient(options);
  let ws: KanbanWebSocketClient | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;

  async function refreshUsageSnapshot(): Promise<void> {
    await refreshUsage(7);

    const checkedAt = nowIso();
    const usage = getUsageState();
    if (usage.lastError) {
      updateSourceHealth('usage-cli', health('degraded', usage.lastError));
      markStale('usage-cli', 'no-data-yet');
      return;
    }

    updateSourceHealth('usage-cli', health('connected', checkedAt));
    markSynced('usage-cli', checkedAt);
  }

  const adapter: SessionConnectionAdapter = {
    validateSession: () => client.validateSession(),
    probeSource: (sourceId: HealthSourceId) => client.probeSource(sourceId),
    reconnectWebSocket: async () => {
      connectKanbanWebSocket();
    },
  };

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  async function syncOnce(): Promise<void> {
    try {
      const [dashboardHealth, board] = await Promise.all([
        client.probeSource('dashboard'),
        client.fetchBoard(),
      ]);
      boardStore.applyBoardRaw(board);
      updateSourceHealth('dashboard', dashboardHealth);
      updateSourceHealth('kanban-rest', health('connected'));
      markSynced('kanban-rest', nowIso());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateSourceHealth('kanban-rest', health(message.includes('401') ? 'unauthorized' : 'offline', message));
      markStale('kanban-rest', message.includes('401') ? 'auth-required' : 'no-data-yet');
      throw error;
    }

    await Promise.allSettled([
      client.fetchProfiles().then((profiles) => {
        boardStore.applyProfilesRaw(profiles);
        updateSourceHealth('profile-cli', health('connected'));
        markSynced('profile-cli', nowIso());
      }),
      client.fetchActiveWorkers().then((workers) => {
        boardStore.applyActiveWorkersRaw(workers);
        updateSourceHealth('admin-cli', health('connected'));
        markSynced('admin-cli', nowIso());
      }),
      refreshUsageSnapshot(),
    ]);
  }

  function scheduleWsReconnect(): void {
    if (stopped) return;
    clearReconnectTimer();
    const backoffMs = WS_BACKOFF_MS[Math.min(reconnectAttempt, WS_BACKOFF_MS.length - 1)];
    reconnectAttempt += 1;
    scheduleReconnectBackoff();
    markStale('kanban-ws', 'reconnect-pending');
    reconnectTimer = setTimeout(() => {
      connectKanbanWebSocket();
    }, backoffMs);
  }

  function connectKanbanWebSocket(): void {
    if (stopped) return;
    clearReconnectTimer();
    const cursor = boardStore.board.value?.latestEventId ?? null;
    let url: string;
    try {
      url = client.createKanbanEventsUrl(cursor);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAuthGap = /token|unauthorized/i.test(message);
      updateSourceHealth('kanban-ws', health(isAuthGap ? 'unauthorized' : 'offline', message));
      markStale('kanban-ws', isAuthGap ? 'auth-required' : 'endpoint-unverified');
      return;
    }

    ws?.close();
    ws = new KanbanWebSocketClient({
      url,
      WebSocketImpl: options.WebSocketImpl,
      onOpen: () => {
        reconnectAttempt = 0;
        markWsConnected();
        markSynced('kanban-ws', nowIso());
      },
      onMessage: (message) => {
        setPendingEventCount('kanban-ws', 1);
        const events = boardStore.applyWsMessageRaw(message);
        setPendingEventCount('kanban-ws', 0);
        if (events.length > 0) markSynced('kanban-ws', nowIso());
      },
      onError: () => {
        updateSourceHealth('kanban-ws', health('degraded', 'WebSocket error'));
      },
      onClose: () => {
        updateSourceHealth('kanban-ws', health('offline', 'WebSocket closed'));
        scheduleWsReconnect();
      },
    });
    ws.connect();
  }

  async function start(): Promise<void> {
    stopped = false;
    setSessionConnectionAdapter(adapter);
    const projectControlAdapter = new HermesProjectControlAdapter(client);
    setProjectControlReadAdapter(projectControlAdapter);
    setProjectControlMutationAdapter(projectControlAdapter);
    if (options.startAdminProxy !== false) {
      const adminAdapter = new MissionControlAdminProxyAdapter({ baseUrl: options.adminProxyUrl });
      setKeyMcpAdminAdapter(adminAdapter);
      setCwsAdminAdapter(adminAdapter);
      void Promise.allSettled([
        loadKeys(),
        loadMcpEntries(),
        loadCronJobs(),
        loadWebhooks(),
        loadSkills(),
      ]);
    }
    setUsageAdapter({
      fetchUsage: (days = 7) => client.fetchUsage(days) as Promise<Record<string, unknown>>,
    });
    beginValidation(client.baseUrl);

    if (options.syncOnStart !== false) {
      await syncOnce();
    }
    if (options.connectWebSocket !== false) {
      connectKanbanWebSocket();
    }

    const current = getConnectionState();
    for (const sourceId of Object.keys(current.sources) as HealthSourceId[]) {
      if (current.sources[sourceId].state === 'unknown') {
        markStale(sourceId, sourceId === 'chat-transport' ? 'endpoint-unverified' : 'no-data-yet');
      }
    }
  }

  function stop(): void {
    stopped = true;
    clearReconnectTimer();
    ws?.close();
    ws = null;
    setCwsAdminAdapter(null);
    setKeyMcpAdminAdapter(null);
    setProjectControlMutationAdapter(null);
    setProjectControlReadAdapter(null);
    setUsageAdapter(null);
    setSessionConnectionAdapter(null);
  }

  return {
    client,
    start,
    stop,
    syncOnce,
    connectKanbanWebSocket,
  };
}

let browserBackbone: MissionControlBackbone | null = null;

export function startBrowserBackbone(options: MissionControlBackboneOptions = {}): MissionControlBackbone {
  browserBackbone?.stop();
  browserBackbone = createMissionControlBackbone(options);
  void browserBackbone.start().catch(() => {
    // Shared stores already carry sanitized source health/errors. Avoid logging
    // here so dashboard/session tokens cannot be exposed accidentally.
  });
  // Phase 4: bind the chat transport (verified or demo mock) and bridge the
  // profile roster into the chat store. The chat module depends only on the
  // ChatTransport interface; this is the app-level swap point.
  if (options.startChat !== false) {
    startChatBackbone({ transport: options.chatTransport ?? null, dashboardClient: browserBackbone.client });
  }
  return browserBackbone;
}

export function stopBrowserBackbone(): void {
  browserBackbone?.stop();
  browserBackbone = null;
  stopChatBackbone();
}

/**
 * Returns the currently active browser backbone, or null if not started.
 * Sora stability audit #5: the office module calls syncOnce() on this when
 * the document becomes visible again after being hidden, so the board
 * snapshot is re-fetched and the office doesn't render stale agent state.
 */
export function getBrowserBackbone(): MissionControlBackbone | null {
  return browserBackbone;
}
