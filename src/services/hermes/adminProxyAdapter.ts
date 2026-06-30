import type { KeyMcpAdminAdapter } from '@/state/adminKeyMcpStore';
import type { CwsAdminAdapter } from '@/state/cwsAdminStore';
import type {
  ApiKey,
  KeyMcpAction,
  KeyMcpActionResult,
  McpEntry,
} from '@/types/admin-keymcp';
import type {
  CronJob,
  CwsAction,
  CwsActionResult,
  SkillEntry,
  WebhookEntry,
} from '@/types/admin-cws';

declare global {
  interface Window {
    __SORA_ADMIN_PROXY_URL__?: string;
  }
}

export type MissionControlAdminProxyAuthSource = 'none' | 'session';

export interface MissionControlAdminProxyAuthState {
  source: MissionControlAdminProxyAuthSource;
  hasToken: boolean;
  mode: 'local-dev-no-token' | 'session-only';
}

let sessionAdminProxyToken: string | null = null;

export interface AdminProxyLocationLike {
  origin: string;
  protocol: string;
  hostname: string;
  port: string;
}

export class MissionControlAdminProxyError extends Error {
  readonly status: number;
  readonly isSecureTransportRequired: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MissionControlAdminProxyError';
    this.status = status;
    this.isSecureTransportRequired = status === 403 && isAdminSecureTransportError(message);
  }
}

function normalizeProxyUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function isAdminSecureTransportError(message: string): boolean {
  return (
    message.includes('Sensitive Mission Control routes') &&
    message.includes('plain HTTP listener')
  );
}

export function adminSecureTransportGuidance(): string {
  return 'Systems credentials and admin routes require the HTTPS Mission Control origin. Use https://192.168.10.5:3443 for admin access; the plain HTTP listener on 3187 is locked to health/static content.';
}

export function isHttpLockedAdminOrigin(locationLike?: AdminProxyLocationLike): boolean {
  const location = locationLike ?? (typeof window !== 'undefined' ? window.location : undefined);
  if (!location) return false;
  return location.protocol === 'http:' && location.port === '3187' && !isLoopbackHost(location.hostname);
}

export function resolveAdminProxyBaseUrl(
  locationLike?: AdminProxyLocationLike,
  injectedUrl?: string,
): string {
  const injected = String(injectedUrl ?? '').trim();
  if (injected.length > 0 && !isUnsafeSameHostHttpProxyOverride(locationLike, injected)) {
    return normalizeProxyUrl(injected);
  }
  if (!locationLike) return 'http://127.0.0.1:3187';
  if (locationLike.port === '3187' || locationLike.protocol === 'https:') {
    return normalizeProxyUrl(locationLike.origin);
  }
  return normalizeProxyUrl(`${locationLike.protocol}//${locationLike.hostname}:3187`);
}

function isUnsafeSameHostHttpProxyOverride(
  locationLike: AdminProxyLocationLike | undefined,
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

function defaultProxyUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3187';
  return resolveAdminProxyBaseUrl(window.location, window.__SORA_ADMIN_PROXY_URL__);
}

function activeAdminProxyToken(): { source: MissionControlAdminProxyAuthSource; token: string | null } {
  if (sessionAdminProxyToken) return { source: 'session', token: sessionAdminProxyToken };
  return { source: 'none', token: null };
}

export function setMissionControlAdminProxyToken(token: string): void {
  const normalized = token.trim();
  sessionAdminProxyToken = normalized.length > 0 ? normalized : null;
}

export function clearMissionControlAdminProxyToken(): void {
  sessionAdminProxyToken = null;
}

export function getMissionControlAdminProxyAuthState(): MissionControlAdminProxyAuthState {
  const active = activeAdminProxyToken();
  return {
    source: active.source,
    hasToken: active.token !== null,
    mode: active.source === 'session' ? 'session-only' : 'local-dev-no-token',
  };
}

/** Return the currently staged admin proxy token, or null. */
export function getActiveAdminProxyToken(): string | null {
  return activeAdminProxyToken().token;
}

export function _resetMissionControlAdminProxyAuthForTest(): void {
  sessionAdminProxyToken = null;
}

function headers(): Headers {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  const active = activeAdminProxyToken();
  if (active.token) {
    headers.set('X-Mission-Control-Key', active.token);
  }
  return headers;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
        ? data.message
        : `Mission Control proxy request failed with HTTP ${response.status}`;
    throw new MissionControlAdminProxyError(response.status, message);
  }
  return data as T;
}

export interface MissionControlAdminProxyAdapterOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class MissionControlAdminProxyAdapter implements KeyMcpAdminAdapter, CwsAdminAdapter {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MissionControlAdminProxyAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? defaultProxyUrl()).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async listKeys(): Promise<ApiKey[]> {
    const data = await this.get<{ keys: ApiKey[] }>('/admin/keys');
    return Array.isArray(data.keys) ? data.keys : [];
  }

  async listMcpEntries(): Promise<McpEntry[]> {
    const data = await this.get<{ mcpEntries: McpEntry[] }>('/admin/mcp');
    return Array.isArray(data.mcpEntries) ? data.mcpEntries : [];
  }

  async listCronJobs(): Promise<CronJob[]> {
    const data = await this.get<{ cronJobs: CronJob[] }>('/admin/cron');
    return Array.isArray(data.cronJobs) ? data.cronJobs : [];
  }

  async listWebhooks(): Promise<WebhookEntry[]> {
    const data = await this.get<{ webhooks: WebhookEntry[] }>('/admin/webhooks');
    return Array.isArray(data.webhooks) ? data.webhooks : [];
  }

  async listSkills(): Promise<SkillEntry[]> {
    const data = await this.get<{ skills: SkillEntry[] }>('/admin/skills');
    return Array.isArray(data.skills) ? data.skills : [];
  }

  async executeAction(action: KeyMcpAction): Promise<KeyMcpActionResult>;
  async executeAction(action: CwsAction): Promise<CwsActionResult>;
  async executeAction(action: KeyMcpAction | CwsAction): Promise<KeyMcpActionResult | CwsActionResult> {
    const route = action.kind.startsWith('key.') || action.kind.startsWith('mcp.')
      ? '/admin/keymcp/actions'
      : '/admin/cws/actions';
    return this.post<KeyMcpActionResult | CwsActionResult>(route, { action });
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: headers(),
    });
    return readJson<T>(response);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    return readJson<T>(response);
  }
}
