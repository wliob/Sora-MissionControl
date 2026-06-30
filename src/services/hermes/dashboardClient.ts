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

const DEFAULT_DASHBOARD_URL = 'http://127.0.0.1:3187';

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
  readonly isSecureTransport: boolean;

  constructor(status: number, path: string, message?: string) {
    super(message ?? `Hermes dashboard request failed with HTTP ${status}`);
    this.name = 'DashboardHttpError';
    this.status = status;
    this.path = path;
    this.isSecureTransport = status === 403 && isSecureTransportError(message ?? '');
  }

  /**
   * Returns human-readable guidance when this error was caused by a
   * secure-transport violation.
   */
  guidance(): string | null {
    return this.isSecureTransport ? secureTransportGuidance() : null;
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

export interface DashboardLocationLike {
  origin: string;
  protocol: string;
  hostname: string;
  port: string;
}

export function resolveDashboardBaseUrl(
  locationLike?: DashboardLocationLike,
  injectedUrl?: string,
): string {
  const injected = String(injectedUrl ?? '').trim();
  if (injected.length > 0 && !isUnsafeSameHostHttpProxyOverride(locationLike, injected)) {
    return normalizeBaseUrl(injected);
  }
  if (!locationLike) return DEFAULT_DASHBOARD_URL;
  // Same-origin proxy: the Mission Control proxy serves on both HTTP (3187)
  // and HTTPS (3443). When the app is accessed via HTTPS, all API requests
  // MUST go to the same HTTPS origin — never construct a cross-port URL to
  // the HTTP listener, which blocks sensitive routes with 403.
  if (
    locationLike.port === '9119' ||
    locationLike.port === '3187' ||
    locationLike.protocol === 'https:'
  ) {
    return normalizeBaseUrl(locationLike.origin);
  }
  return normalizeBaseUrl(`${locationLike.protocol}//${locationLike.hostname}:3187`);
}

function isUnsafeSameHostHttpProxyOverride(
  locationLike: DashboardLocationLike | undefined,
  injectedUrl: string,
): boolean {
  if (!locationLike || locationLike.protocol !== 'https:') return false;
  try {
    const parsed = new URL(injectedUrl);
    return parsed.hostname === locationLike.hostname && parsed.port === '3187';
  } catch {
    return false;
  }
}

/**
 * Detect whether a 403 error was caused by the secure-transport guard
 * (plain HTTP listener blocking sensitive routes). The proxy returns:
 * {"error":"Sensitive Mission Control routes are unavailable on this plain HTTP listener."}
 */
export function isSecureTransportError(message: string): boolean {
  return (
    typeof message === 'string' &&
    message.includes('Sensitive Mission Control routes') &&
    message.includes('plain HTTP listener')
  );
}

/**
 * Human-readable guidance when a 403 secure-transport response is received.
 */
export function secureTransportGuidance(): string {
  return 'This sensitive route requires HTTPS. Use https://192.168.10.5:3443 (or the equivalent HTTPS URL for your deployment) to access this feature. The plain HTTP listener on port 3187 intentionally blocks all sensitive routes.';
}

export function getDefaultDashboardUrl(): string {
  if (typeof window !== 'undefined') {
    return resolveDashboardBaseUrl(window.location, window.__SORA_HERMES_DASHBOARD_URL__);
  }
  return DEFAULT_DASHBOARD_URL;
}

export function resolveKanbanWebSocketBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    if (url.port === '3187') {
      url.port = '9119';
      url.pathname = '/';
      url.search = '';
      url.hash = '';
    }
    return normalizeBaseUrl(url.toString());
  } catch {
    return normalizeBaseUrl(baseUrl);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function dashboardErrorMessage(response: Response, path: string): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.clone().json() as { error?: unknown; message?: unknown };
      const message = payload.error ?? payload.message;
      if (typeof message === 'string' && message.trim().length > 0) return message;
    }
    const text = await response.clone().text();
    if (text.trim().length > 0 && text.length < 500) return text.trim();
  } catch {
    // Fall back to status-only message below.
  }
  return `Hermes dashboard request failed with HTTP ${response.status} (${path})`;
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

  getSessionToken(): string | null {
    return this.tokenProvider.getToken();
  }

  getWsBaseUrl(): string {
    // Use the same Mission Control proxy host as REST, but with the WebSocket
    // protocol. /api/pty is handled by missionControlProxy.js and forwarded to
    // the dashboard PTY bridge, so the browser never needs direct dashboard WS
    // access.
    try {
      const url = new URL(this.baseUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return normalizeBaseUrl(url.toString());
    } catch {
      return normalizeBaseUrl(this.baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:'));
    }
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
      throw new DashboardHttpError(response.status, path, await dashboardErrorMessage(response, path));
    }

    return {
      data: await response.json() as T,
      status: response.status,
      latencyMs,
    };
  }

  async requestText(path: string, init: RequestInit = {}): Promise<{ status: number; latencyMs: number }> {
    const result = await this.requestTextData(path, init);
    return { status: result.status, latencyMs: result.latencyMs };
  }

  async requestTextData(path: string, init: RequestInit = {}): Promise<{ data: string; status: number; latencyMs: number }> {
    const started = performance.now();
    const response = await this.fetchImpl(this.urlFor(path), {
      ...init,
      credentials: 'include',
      headers: this.headers(init.headers),
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      throw new DashboardHttpError(response.status, path, await dashboardErrorMessage(response, path));
    }
    return { data: await response.text(), status: response.status, latencyMs };
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

  async fetchKanbanTaskDetail(taskId: string): Promise<Record<string, unknown>> {
    return (await this.requestJson<Record<string, unknown>>(
      `/api/plugins/kanban/tasks/${encodeURIComponent(taskId)}`,
    )).data;
  }

  async fetchKanbanTaskLog(taskId: string): Promise<Record<string, unknown> | string> {
    const result = await this.requestTextData(`/api/plugins/kanban/tasks/${encodeURIComponent(taskId)}/log`);
    try {
      return JSON.parse(result.data) as Record<string, unknown>;
    } catch {
      return result.data;
    }
  }

  async fetchKanbanRun(runId: string): Promise<Record<string, unknown>> {
    return (await this.requestJson<Record<string, unknown>>(
      `/api/plugins/kanban/runs/${encodeURIComponent(runId)}`,
    )).data;
  }

  async postKanbanAction(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.requestJson<Record<string, unknown>>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })).data;
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
          // Phase 4 verified: chat is now available via the PTY WebSocket bridge
          // proxied through missionControlProxy.js at /api/pty?token=<session-token>.
          // The bridge connects to the Hermes dashboard PTY and forwards WebSocket
          // traffic. Report connected so the chatBackbone selects the real transport.
          return sourceHealth('connected', checkedAt, undefined);
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
    // Route Kanban WS events through the same-origin proxy (same as PTY WS).
    // The proxy forwards /api/plugins/kanban/events to the Hermes dashboard
    // WebSocket server, avoiding direct browser access to port 9119.
    // This ensures HTTPS tunnels keep the WS encrypted end-to-end.
    const url = new URL('/api/plugins/kanban/events', `${this.baseUrl}/`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    if (cursor !== null && Number.isFinite(cursor)) {
      url.searchParams.set('since_event_id', String(cursor));
    }
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
