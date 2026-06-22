/**
 * Hermes dashboard client for the Phase 3 Cloud backbone.
 *
 * Real transport only: REST calls go to verified dashboard/plugin endpoints and
 * WS URLs are constructed for `/api/plugins/kanban/events`. Token values are
 * kept inside this adapter and are never written to shared stores.
 */

import type { AuthSession } from '@/types/auth';
import type { HealthSourceId, SourceHealth } from '@/types/connection';
import type {
  RawActiveWorkersResponse,
  RawBoardResponse,
  RawProfilesResponse,
  RawWsMessage,
} from '@/adapters';
import type { RawUsageResponse } from '@/adapters/usageAdapter';

const DEFAULT_DASHBOARD_URL = 'http://127.0.0.1:9119';

declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string;
    __SORA_HERMES_DASHBOARD_URL__?: string;
  }
}

export interface SessionTokenProvider {
  hasToken(): boolean;
  getToken(): string | null;
}

export interface DashboardClientOptions {
  baseUrl?: string;
  tokenProvider?: SessionTokenProvider;
  fetchImpl?: typeof fetch;
}

export interface DashboardJsonResult<T> {
  data: T;
  status: number;
  latencyMs: number;
}

export class DashboardHttpError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message?: string) {
    super(message ?? `Hermes dashboard request failed with HTTP ${status}`);
    this.name = 'DashboardHttpError';
    this.status = status;
    this.path = path;
  }
}

export function createBrowserSessionTokenProvider(): SessionTokenProvider {
  return {
    hasToken(): boolean {
      return Boolean(this.getToken());
    },
    getToken(): string | null {
      if (typeof window === 'undefined') return null;
      const token = window.__HERMES_SESSION_TOKEN__;
      return typeof token === 'string' && token.length > 0 ? token : null;
    },
  };
}

export function getDefaultDashboardUrl(): string {
  if (typeof window !== 'undefined') {
    const injected = window.__SORA_HERMES_DASHBOARD_URL__;
    if (typeof injected === 'string' && injected.length > 0) return injected;
    if (window.location.port === '9119') return window.location.origin;
  }
  return DEFAULT_DASHBOARD_URL;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sourceHealth(
  state: SourceHealth['state'],
  checkedAt: string,
  latencyMs?: number,
  error?: string,
): SourceHealth {
  return {
    state,
    lastOkAt: state === 'connected' ? checkedAt : null,
    lastCheckedAt: checkedAt,
    ...(latencyMs !== undefined && (state === 'connected' || state === 'degraded') ? { latencyMs } : {}),
    ...(error ? { error } : {}),
  };
}

export class HermesDashboardClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: SessionTokenProvider;

  constructor(options: DashboardClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? getDefaultDashboardUrl());
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? createBrowserSessionTokenProvider();
  }

  get hasToken(): boolean {
    return this.tokenProvider.hasToken();
  }

  async requestJson<T>(path: string, init: RequestInit = {}): Promise<DashboardJsonResult<T>> {
    const started = performance.now();
    const response = await this.fetchImpl(this.urlFor(path), {
      ...init,
      credentials: 'include',
      headers: this.headers(init.headers),
    });
    const latencyMs = Math.round(performance.now() - started);

    if (!response.ok) {
      throw new DashboardHttpError(response.status, path);
    }

    return {
      data: await response.json() as T,
      status: response.status,
      latencyMs,
    };
  }

  async requestText(path: string, init: RequestInit = {}): Promise<{ status: number; latencyMs: number }> {
    const started = performance.now();
    const response = await this.fetchImpl(this.urlFor(path), {
      ...init,
      credentials: 'include',
      headers: this.headers(init.headers),
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      throw new DashboardHttpError(response.status, path);
    }
    await response.text();
    return { status: response.status, latencyMs };
  }

  async validateSession(): Promise<AuthSession> {
    const result = await this.requestJson<RawBoardResponse>('/api/plugins/kanban/board');
    return {
      status: 'authenticated',
      hasToken: this.hasToken,
      dashboardUrl: this.baseUrl,
      validatedAt: new Date().toISOString(),
      expiresAt: null,
      ...(result.status === 200 ? {} : { errorMessage: `Unexpected status ${result.status}` }),
    };
  }

  async fetchBoard(): Promise<RawBoardResponse> {
    return (await this.requestJson<RawBoardResponse>('/api/plugins/kanban/board')).data;
  }

  async fetchProfiles(): Promise<RawProfilesResponse> {
    return (await this.requestJson<RawProfilesResponse>('/api/plugins/kanban/profiles')).data;
  }

  async fetchActiveWorkers(): Promise<RawActiveWorkersResponse> {
    return (await this.requestJson<RawActiveWorkersResponse>('/api/plugins/kanban/workers/active')).data;
  }

  async fetchUsage(days = 7): Promise<RawUsageResponse> {
    // Historical Phase 5 usage data is not yet available via a dedicated API surface.
    // Use the verified Kanban stats endpoint as a conservative first pass; unknown payloads
    // are rendered as unknown by the usage store until a usage-specific adapter lands.
    const statsPath = `/api/plugins/kanban/stats?days=${encodeURIComponent(String(days))}`;
    const result = await this.requestJson<RawUsageResponse>(statsPath);
    return result.data;
  }

  async probeSource(sourceId: HealthSourceId): Promise<SourceHealth> {
    const checkedAt = new Date().toISOString();
    try {
      switch (sourceId) {
        case 'dashboard': {
          const result = await this.requestText('/');
          return sourceHealth('connected', checkedAt, result.latencyMs);
        }
        case 'kanban-rest': {
          const result = await this.requestJson<RawBoardResponse>('/api/plugins/kanban/board');
          return sourceHealth('connected', checkedAt, result.latencyMs);
        }
        case 'kanban-ws':
          return sourceHealth('unknown', checkedAt, undefined, 'WebSocket health is reported by live sync connect/close events');
        case 'profile-cli':
          return sourceHealth('unknown', checkedAt, undefined, 'Profile CLI proxy is not implemented in Phase 3 browser scaffold');
        case 'usage-cli':
          return sourceHealth('unknown', checkedAt, undefined, 'Usage CLI proxy is not implemented in Phase 3 browser scaffold');
        case 'admin-cli':
          return sourceHealth('unknown', checkedAt, undefined, 'Admin CLI proxy is not implemented in Phase 3 browser scaffold');
        case 'chat-transport':
          // Phase 4 verified: no chat plugin exists on the dashboard.
          // /api/plugins/chat/* returns 404. Chat requires the embedded
          // PTY bridge or a Cloud-built CLI proxy. Report unavailable so
          // the chatBackbone can fall back to the demo transport.
          return sourceHealth('offline', checkedAt, undefined, 'No chat plugin on dashboard; chat requires PTY bridge or CLI proxy');
        case 'provider-rate-limits':
          return sourceHealth('unknown', checkedAt, undefined, 'Real-time provider rate limits are not yet available via API or CLI');
        default:
          return sourceHealth('unknown', checkedAt, undefined, `No probe configured for ${sourceId}`);
      }
    } catch (error) {
      if (error instanceof DashboardHttpError && error.status === 401) {
        return sourceHealth('unauthorized', checkedAt, undefined, 'Unauthorized');
      }
      return sourceHealth('offline', checkedAt, undefined, safeErrorMessage(error));
    }
  }

  createKanbanEventsUrl(cursor: number | null = null): string {
    const token = this.tokenProvider.getToken();
    if (!token) {
      throw new Error('No dashboard session token available for Kanban WebSocket');
    }
    const url = new URL('/api/plugins/kanban/events', this.baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    if (cursor !== null) url.searchParams.set('since_event_id', String(cursor));
    return url.toString();
  }

  private urlFor(path: string): string {
    return new URL(path, `${this.baseUrl}/`).toString();
  }

  private headers(existing?: HeadersInit): Headers {
    const headers = new Headers(existing);
    headers.set('Accept', 'application/json');
    const token = this.tokenProvider.getToken();
    if (token) headers.set('X-Hermes-Session-Token', token);
    return headers;
  }
}

export interface KanbanWebSocketOptions {
  url: string;
  WebSocketImpl?: typeof WebSocket;
  onOpen?: () => void;
  onMessage?: (message: RawWsMessage) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

export class KanbanWebSocketClient {
  private socket: WebSocket | null = null;
  private readonly WebSocketImpl: typeof WebSocket;
  private readonly options: KanbanWebSocketOptions;

  constructor(options: KanbanWebSocketOptions) {
    this.options = options;
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;
  }

  connect(): void {
    this.close();
    const socket = new this.WebSocketImpl(this.options.url);
    this.socket = socket;
    socket.onopen = () => this.options.onOpen?.();
    socket.onmessage = (event) => {
      try {
        this.options.onMessage?.(JSON.parse(String(event.data)) as RawWsMessage);
      } catch {
        this.options.onError?.(new Event('parse-error'));
      }
    };
    socket.onerror = (event) => this.options.onError?.(event);
    socket.onclose = (event) => this.options.onClose?.(event);
  }

  close(): void {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING) {
      socket.close();
    }
  }
}
