import { describe, expect, it, vi } from 'vitest';
import * as missionControlProxy from '../../../missionControlProxy.js';

const env = (globalThis as typeof globalThis & {
  process: { env: Record<string, string | undefined> };
}).process.env;

function makeFakeResponse() {
  return {
    statusCode: undefined as number | undefined,
    payload: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.payload = body;
      return this;
    },
  };
}

const {
  buildDashboardProxyUrl,
  buildSensitivePlainHttpGuard,
  connectionIsSecure,
  createMissionControlProxyApp,
  isAdminProxyRequestAuthorized,
  isDashboardAuthBootstrapPath,
  isKanbanProxyPath,
  parseAuthList,
  parseCorsOriginList,
  parseTrustedProxyPeers,
  planCwsAction,
  planKeyMcpAction,
  resolveDashboardProxyTarget,
  resolveProxyAuthConfig,
  resolveCorsOrigin,
  shouldTreatWebhookListAsUnavailable,
  isSensitivePlainHttpPath,
} = missionControlProxy as Record<string, (...args: any[]) => any>;

const missionControlRootDir = new URL('../../..', import.meta.url).pathname;

async function getFirstNonLoopbackIpv4Address() {
  // @ts-expect-error
  const os = await import('node:os');
  const interfaces = (os.networkInterfaces?.() ?? {}) as Record<string, Array<{ family: string; internal: boolean; address: string } | undefined> | undefined>;

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      if (String(entry.address).startsWith('169.254.')) continue;
      return entry.address;
    }
  }

  return null;
}

function parseContentTypeHeader(response: Response) {
  return response.headers.get('content-type') ?? '';
}

describe('missionControlProxy dashboard bridge helpers', () => {
  it('recognizes kanban API paths that must be proxied to Hermes', () => {
    expect(isKanbanProxyPath('/api/plugins/kanban')).toBe(true);
    expect(isKanbanProxyPath('/api/plugins/kanban/board')).toBe(true);
    expect(isKanbanProxyPath('/health')).toBe(false);
  });

  it('identifies dashboard auth bootstrap paths and excludes unrelated routes', () => {
    expect(isDashboardAuthBootstrapPath('/login')).toBe(true);
    expect(isDashboardAuthBootstrapPath('/logout')).toBe(true);
    expect(isDashboardAuthBootstrapPath('/session')).toBe(true);
    expect(isDashboardAuthBootstrapPath('/healthz')).toBe(true);
    expect(isDashboardAuthBootstrapPath('/api/session')).toBe(true);
    expect(isDashboardAuthBootstrapPath('/api/auth/foo')).toBe(true);

    expect(isDashboardAuthBootstrapPath('/admin/keys')).toBe(false);
    expect(isDashboardAuthBootstrapPath('/api/plugins/kanban/board')).toBe(false);
    expect(isDashboardAuthBootstrapPath('/kanban/project')).toBe(false);
  });

  it('classifies credential-bearing routes as sensitive on a plain HTTP listener', () => {
    expect(isSensitivePlainHttpPath('/admin/keys')).toBe(true);
    expect(isSensitivePlainHttpPath('/api/plugins/kanban/board')).toBe(true);
    expect(isSensitivePlainHttpPath('/login')).toBe(true);
    expect(isSensitivePlainHttpPath('/api/session')).toBe(true);
    expect(isSensitivePlainHttpPath('/api/auth/login')).toBe(true);
    expect(isSensitivePlainHttpPath('/api/pty')).toBe(true);
    expect(isSensitivePlainHttpPath('/api/keys')).toBe(true);
    expect(isSensitivePlainHttpPath('/config')).toBe(true);
    expect(isSensitivePlainHttpPath('/cron')).toBe(true);

    expect(isSensitivePlainHttpPath('/')).toBe(false);
    expect(isSensitivePlainHttpPath('/team')).toBe(false);
    expect(isSensitivePlainHttpPath('/health')).toBe(false);
  });

  it('builds Hermes dashboard API targets from the configured bridge base URL', () => {
    expect(
      buildDashboardProxyUrl({
        dashboardBaseUrl: 'http://127.0.0.1:9119',
        requestUrl: '/api/plugins/kanban/board?tenant=mission-control',
      }),
    ).toBe('http://127.0.0.1:9119/api/plugins/kanban/board?tenant=mission-control');
  });

  it('falls back to HERMES_DASHBOARD_URL when no dedicated proxy target is configured', () => {
    const originalProxyTarget = env.HERMES_DASHBOARD_PROXY_TARGET;
    const originalDashboardUrl = env.HERMES_DASHBOARD_URL;

    delete env.HERMES_DASHBOARD_PROXY_TARGET;
    env.HERMES_DASHBOARD_URL = 'http://192.168.0.85:9119/';

    try {
      expect(resolveDashboardProxyTarget()).toBe('http://192.168.0.85:9119');
    } finally {
      if (originalProxyTarget === undefined) delete env.HERMES_DASHBOARD_PROXY_TARGET;
      else env.HERMES_DASHBOARD_PROXY_TARGET = originalProxyTarget;

      if (originalDashboardUrl === undefined) delete env.HERMES_DASHBOARD_URL;
      else env.HERMES_DASHBOARD_URL = originalDashboardUrl;
    }
  });

  it('prefers HERMES_DASHBOARD_PROXY_TARGET over HERMES_DASHBOARD_URL', () => {
    const originalProxyTarget = env.HERMES_DASHBOARD_PROXY_TARGET;
    const originalDashboardUrl = env.HERMES_DASHBOARD_URL;

    env.HERMES_DASHBOARD_PROXY_TARGET = 'http://192.168.0.90:9119';
    env.HERMES_DASHBOARD_URL = 'http://192.168.0.85:9119';

    try {
      expect(resolveDashboardProxyTarget()).toBe('http://192.168.0.90:9119');
    } finally {
      if (originalProxyTarget === undefined) delete env.HERMES_DASHBOARD_PROXY_TARGET;
      else env.HERMES_DASHBOARD_PROXY_TARGET = originalProxyTarget;

      if (originalDashboardUrl === undefined) delete env.HERMES_DASHBOARD_URL;
      else env.HERMES_DASHBOARD_URL = originalDashboardUrl;
    }
  });
});

describe('missionControlProxy CORS hardening helpers', () => {
  it('allows same-host origins by default', () => {
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://192.168.0.85:5180',
        requestHost: '192.168.0.85:3187',
      }),
    ).toBe('http://192.168.0.85:5180');
  });

  it('allows loopback aliases by default', () => {
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://localhost:5180',
        requestHost: '127.0.0.1:3187',
      }),
    ).toBe('http://localhost:5180');
  });

  it('rejects foreign origins by default', () => {
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://evil.example:3000',
        requestHost: '192.168.0.85:3187',
      }),
    ).toBeNull();
  });

  it('requires exact matches when a CORS allowlist is configured', () => {
    const configuredOrigins = parseCorsOriginList('http://localhost:5180, https://mission-control.local');
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://localhost:5180',
        requestHost: '192.168.0.85:3187',
        configuredOrigins,
      }),
    ).toBe('http://localhost:5180');
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://localhost:4173',
        requestHost: '192.168.0.85:3187',
        configuredOrigins,
      }),
    ).toBeNull();
  });

  it('supports explicit wildcard configuration', () => {
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://anywhere.example:4173',
        requestHost: '192.168.0.85:3187',
        configuredOrigins: ['*'],
      }),
    ).toBe('*');
  });

  it('allows Hermes session token headers on Kanban preflight requests', async () => {
    const app = createMissionControlProxyApp({ distDir: '/tmp' });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');

      const response = await fetch(`http://127.0.0.1:${address.port}/api/plugins/kanban/tasks/task-17/decompose`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://127.0.0.1:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-hermes-session-token',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
      expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('x-hermes-session-token');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it('serves a CSP without unsafe-eval so Pixi/runtime fixes do not weaken script policy', async () => {
    const app = createMissionControlProxyApp({ distDir: missionControlRootDir });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');

      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      const csp = response.headers.get('content-security-policy') ?? '';

      expect(response.status).toBe(200);
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain('unsafe-eval');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it('forwards Project Control mutation bodies and Hermes session token headers to the dashboard target', async () => {
    const observed: {
      url: string;
      method: string;
      body: string | null;
      contentType: string | null;
      sessionToken: string | null;
    } = {
      url: '',
      method: '',
      body: null,
      contentType: null,
      sessionToken: null,
    };
    const app = createMissionControlProxyApp({
      distDir: '/tmp',
      dashboardBaseUrl: 'http://127.0.0.1:9119',
      fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        observed.url = String(input);
        observed.method = init?.method ?? 'GET';
        observed.body = typeof init?.body === 'string' ? init.body : null;
        observed.contentType = headers.get('content-type');
        observed.sessionToken = headers.get('x-hermes-session-token');
        return new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');

      const response = await fetch(`http://127.0.0.1:${address.port}/api/plugins/kanban/tasks/task-17/decompose?lane=ready`, {
        method: 'POST',
        headers: {
          Origin: 'http://127.0.0.1:5173',
          'Content-Type': 'application/json',
          'X-Hermes-Session-Token': 'session-abc123',
        },
        body: JSON.stringify({ confirm: true, reason: 'regression-test' }),
      });

      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ ok: true });
      expect(observed.url).toBe('http://127.0.0.1:9119/api/plugins/kanban/tasks/task-17/decompose?lane=ready');
      expect(observed.method).toBe('POST');
      expect(observed.contentType).toBe('application/json');
      expect(observed.sessionToken).toBe('session-abc123');
      expect(observed.body).toBe(JSON.stringify({ confirm: true, reason: 'regression-test' }));
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});

describe('missionControlProxy auth/session bootstrap route behavior', () => {
  it('proxies /login?next=/kanban to the dashboard target before static fallback', async () => {
    const distDir = '/tmp';
    const observed = {
      called: false,
      url: '',
    };

    const app = createMissionControlProxyApp({
      distDir,
      dashboardBaseUrl: 'http://127.0.0.1:9119',
      fetchImpl: async (input: RequestInfo | URL) => {
        observed.called = true;
        observed.url = String(input);
        return new Response('login-route', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      },
    });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');

      const response = await fetch(`http://127.0.0.1:${address.port}/login?next=/kanban`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('login-route');
      expect(observed.called).toBe(true);
      expect(observed.url).toBe('http://127.0.0.1:9119/login?next=/kanban');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it('forwards Cookie and X-Hermes-Session-Token on /api/session and returns Set-Cookie', async () => {
    const distDir = '/tmp';
    const observed = {
      url: '',
      cookie: '',
      sessionToken: '',
    };

    const app = createMissionControlProxyApp({
      distDir,
      dashboardBaseUrl: 'http://127.0.0.1:9119',
      fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        observed.url = String(input);
        observed.cookie = headers.get('cookie') ?? '';
        observed.sessionToken = headers.get('x-hermes-session-token') ?? '';
        return new Response('session-ok', {
          status: 200,
          headers: {
            'content-type': 'text/plain',
            'set-cookie': 'session-token=abc123; Path=/; HttpOnly',
          },
        });
      },
    });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');

      const response = await fetch(`http://127.0.0.1:${address.port}/api/session`, {
        headers: {
          Cookie: 'browser-session=browser-123',
          'X-Hermes-Session-Token': 'frontend-token-456',
        },
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('session-ok');
      expect(observed.url).toBe('http://127.0.0.1:9119/api/session');
      expect(observed.cookie).toBe('browser-session=browser-123');
      expect(observed.sessionToken).toBe('frontend-token-456');
      expect(response.headers.get('set-cookie')).toBe('session-token=abc123; Path=/; HttpOnly');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it('/admin/keys still requires X-Mission-Control-Key when auth mode is required', async () => {
    const distDir = '/tmp';
    const app = createMissionControlProxyApp({
      distDir,
      authMode: 'required',
      apiKey: 'required-token',
    });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');

      const response = await fetch(`http://127.0.0.1:${address.port}/admin/keys`);
      const payload = await response.json();

      expect(response.status).toBe(401);
      expect(payload).toEqual({ error: 'Unauthorized' });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});

describe('missionControlProxy SPA fallback behavior', () => {
  it('falls back to index.html for non-proxied routes when dist index exists', async () => {
    const distDir = missionControlRootDir;
    const app = createMissionControlProxyApp({ distDir });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');

      const response = await fetch(`http://127.0.0.1:${address.port}/boards/mission-control`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('<div id="root"></div>');
      expect(body).toContain('<script type="module" src="/src/main.tsx"></script>');
      expect(response.headers.get('content-type')).toContain('text/html');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});

describe('missionControlProxy production token mode', () => {
  it('preserves local development ergonomics when no auth mode or token is configured', () => {
    const auth = resolveProxyAuthConfig({ authMode: '', apiKey: '' });

    expect(auth).toEqual({ required: false, token: null });
    expect(
      isAdminProxyRequestAuthorized({
        path: '/admin/keymcp/actions',
        providedToken: null,
        auth,
      }),
    ).toBe(true);
  });

  it('requires a configured token when production auth mode is enabled', () => {
    expect(() => resolveProxyAuthConfig({ authMode: 'required', apiKey: '' })).toThrow(
      /MISSION_CONTROL_ADMIN_PROXY_KEY/,
    );
  });

  it('rejects missing request tokens in required mode', () => {
    const auth = resolveProxyAuthConfig({ authMode: 'required', apiKey: 'prod-token' });

    expect(
      isAdminProxyRequestAuthorized({
        path: '/admin/keymcp/actions',
        providedToken: null,
        auth,
      }),
    ).toBe(false);
  });

  it('rejects invalid request tokens in required mode', () => {
    const auth = resolveProxyAuthConfig({ authMode: 'required', apiKey: 'prod-token' });

    expect(
      isAdminProxyRequestAuthorized({
        path: '/admin/keymcp/actions',
        providedToken: 'wrong-token',
        auth,
      }),
    ).toBe(false);
  });

  it('allows valid request tokens in required mode', () => {
    const auth = resolveProxyAuthConfig({ authMode: 'required', apiKey: 'prod-token' });

    expect(
      isAdminProxyRequestAuthorized({
        path: '/admin/keymcp/actions',
        providedToken: 'prod-token',
        auth,
      }),
    ).toBe(true);
  });

  it('scopes token enforcement to admin routes', () => {
    const auth = resolveProxyAuthConfig({ authMode: 'required', apiKey: 'prod-token' });

    expect(
      isAdminProxyRequestAuthorized({
        path: '/health',
        providedToken: null,
        auth,
      }),
    ).toBe(true);
  });
  it('trusts loopback plain HTTP for SSH-tunnel access but rejects required-token admin routes without a key', async () => {
    const app = createMissionControlProxyApp({
      distDir: missionControlRootDir,
      requireSecureTransport: true,
      fetchImpl: async () => new Response('should-not-proxy', { status: 200 }),
    });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const health = await fetch(`${baseUrl}/health`);
      expect(health.status).toBe(200);

      // Loopback is trusted by connectionIsSecure (SSH tunnel safe).
      // Sensitive routes pass the secure-transport gate but require the admin token.
      for (const route of ['/login', '/api/session', '/api/plugins/kanban/board', '/admin/keys']) {
        const response = await fetch(`${baseUrl}${route}`, {
          headers: { 'X-Mission-Control-Key': 'prod-token' },
        });
        // Loopback is a trusted secure transport — expect auth-gate responses (200/401),
        // NOT the 403 plain-HTTP reject.
        expect(response.status).not.toBe(403);
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it('blocks sensitive runtime plaintext routes while keeping health and office accessible', async () => {
    const hostAddress = await getFirstNonLoopbackIpv4Address();
    expect(hostAddress).not.toBeNull();

    const host = hostAddress as string;
    const app = createMissionControlProxyApp({ distDir: missionControlRootDir });
    const server = await new Promise<any>((resolve) => {
      const nextServer = app.listen(0, '0.0.0.0', () => resolve(nextServer));
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected an ephemeral TCP port');
      }

      for (const route of ['/api/keys', '/config', '/cron']) {
        const response = await fetch(`http://${host}:${address.port}${route}`);
        expect(response.status).toBe(403);
      }

      const health = await fetch(`http://${host}:${address.port}/health`);
      expect(health.status).toBe(200);
      expect(parseContentTypeHeader(health)).toContain('application/json');

      const office = await fetch(`http://${host}:${address.port}/office`);
      expect(office.status).toBe(200);
      expect(parseContentTypeHeader(office)).toContain('text/html');
      expect(await office.text()).toContain('<div id="root"></div>');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });


  it('classifies host-header spoofed plain-HTTP requests as insecure', () => {
    expect(
      connectionIsSecure({
        socket: { remoteAddress: '192.168.10.55' },
        headers: {
          host: '127.0.0.1:3187',
        },
      }),
    ).toBe(false);
  });

  it('blocks x-forwarded-proto spoofing when no trusted proxy peer is configured', () => {
    expect(
      connectionIsSecure({
        socket: { remoteAddress: '192.168.10.55' },
        headers: {
          'x-forwarded-proto': 'https',
        },
      }),
    ).toBe(false);
  });

  it('treats local loopback sockets as secure transport', () => {
    expect(connectionIsSecure({ socket: { remoteAddress: '127.0.0.1' } })).toBe(true);
    expect(connectionIsSecure({ socket: { remoteAddress: '::1' } })).toBe(true);
  });

  it('treats explicit secure-request markers as secure transport', () => {
    expect(connectionIsSecure({ secure: true, socket: { remoteAddress: '192.168.10.55' } })).toBe(true);
    expect(connectionIsSecure({ socket: { encrypted: true, remoteAddress: '192.168.10.55' } })).toBe(true);
  });

  it('accepts trusted proxy peers with HTTPS forwarded proto and rejects untrusted peers', () => {
    const trustedPeers = parseTrustedProxyPeers('192.168.10.10');

    expect(
      connectionIsSecure(
        {
          socket: { remoteAddress: '192.168.10.10' },
          headers: {
            'x-forwarded-proto': 'https',
          },
        },
        trustedPeers,
      ),
    ).toBe(true);

    expect(
      connectionIsSecure(
        {
          socket: { remoteAddress: '192.168.10.55' },
          headers: {
            'x-forwarded-proto': 'https',
          },
        },
        trustedPeers,
      ),
    ).toBe(false);
  });

  it('gates sensitive plain-HTTP paths via middleware and allows loopback bypass', () => {
    const guard = buildSensitivePlainHttpGuard([]);
    const blockedRes = makeFakeResponse();
    const blockedNext = vi.fn();

    guard(
      {
        path: '/admin/keys',
        socket: { remoteAddress: '192.168.10.55' },
        headers: {
          host: '127.0.0.1:3187',
          'x-forwarded-proto': 'https',
        },
      },
      blockedRes,
      blockedNext,
    );

    expect(blockedRes.statusCode).toBe(403);
    expect(blockedRes.payload?.error).toContain('plain HTTP listener');
    expect(blockedNext).not.toHaveBeenCalled();

    const allowedRes = makeFakeResponse();
    const allowedNext = vi.fn();

    guard(
      {
        path: '/admin/keys',
        socket: { remoteAddress: '127.0.0.1' },
      },
      allowedRes,
      allowedNext,
    );

    expect(allowedNext).toHaveBeenCalled();
    expect(allowedRes.statusCode).toBeUndefined();
  });

  it('blocks additional API-like plaintext paths via sensitive-path middleware', () => {
    const guard = buildSensitivePlainHttpGuard([]);
    const blockedNext = vi.fn();

    for (const path of ['/api/keys', '/config', '/cron']) {
      const blockedRes = makeFakeResponse();
      guard(
        {
          path,
          socket: { remoteAddress: '192.168.10.55' },
          headers: {
            host: '127.0.0.1:3187',
            'x-forwarded-proto': 'https',
          },
        },
        blockedRes,
        blockedNext,
      );

      expect(blockedRes.statusCode).toBe(403);
      expect(blockedRes.payload?.error).toContain('plain HTTP listener');
      expect(blockedNext).not.toHaveBeenCalled();
      blockedNext.mockClear();
    }
  });

  it('keeps same-host and loopback CORS decisions independent of required token mode', () => {
    const auth = resolveProxyAuthConfig({ authMode: 'required', apiKey: 'prod-token' });
    expect(auth.required).toBe(true);
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://127.0.0.1:5180',
        requestHost: 'localhost:3187',
      }),
    ).toBe('http://127.0.0.1:5180');
    expect(
      resolveCorsOrigin({
        requestOrigin: 'http://evil.example:5180',
        requestHost: 'localhost:3187',
      }),
    ).toBeNull();
  });
});

describe('missionControlProxy webhook availability detection', () => {
  it('detects disabled webhook platform output', () => {
    const output = 'Webhook platform is not enabled. To set it up:\n\n  1. Run the gateway setup wizard:';
    expect(shouldTreatWebhookListAsUnavailable(output)).toBe(true);
  });

  it('does not flag normal webhook listings as unavailable', () => {
    const output = '◆ build-notify\n  URL: https://example.com/webhooks/build-notify\n  Events: cron.completed';
    expect(shouldTreatWebhookListAsUnavailable(output)).toBe(false);
  });
});

describe('missionControlProxy auth parsing', () => {
  it('parses provider:index ids and masks env-backed secrets', () => {
    const parsed = parseAuthList([
      'openrouter (1 credentials):',
      '  #1  OPENROUTER_API_KEY   api_key env:OPENROUTER_API_KEY ←',
      '',
      'deepseek (1 credentials):',
      '  #1  DEEPSEEK_API_KEY     api_key env:DEEPSEEK_API_KEY auth failed (401)',
    ].join('\n'));

    expect(parsed).toEqual([
      expect.objectContaining({
        id: 'openrouter:1',
        provider: 'openrouter',
        active: true,
      }),
      expect.objectContaining({
        id: 'deepseek:1',
        provider: 'deepseek',
        active: false,
        note: expect.stringContaining('auth failed'),
      }),
    ]);
    expect(parsed[0].maskedSecret).toContain('env:');
  });
});

describe('missionControlProxy verified action planning', () => {
  it('keeps key.revoke unsupported because Hermes only exposes remove', () => {
    const plan = planKeyMcpAction({ kind: 'key.revoke', id: 'openrouter:1' });
    expect('unsupported' in plan && plan.unsupported).toContain('not reversible');
  });

  it('maps key.delete to hermes auth remove', () => {
    const plan = planKeyMcpAction({ kind: 'key.delete', id: 'openrouter:1' });
    expect('unsupported' in plan).toBe(false);
    if ('unsupported' in plan) throw new Error('expected supported plan');
    expect(plan.args).toEqual(['auth', 'remove', 'openrouter', '1']);
  });

  it('rejects mcp.create token/note fields that Hermes CLI cannot persist', () => {
    const tokenPlan = planKeyMcpAction({
      kind: 'mcp.create',
      name: 'demo',
      url: 'http://localhost:8000/mcp',
      transport: 'http',
      token: 'raw-token',
    });
    expect('unsupported' in tokenPlan && tokenPlan.unsupported).toContain('does not accept MCP tokens');

    const notePlan = planKeyMcpAction({
      kind: 'mcp.create',
      name: 'demo',
      url: 'http://localhost:8000/mcp',
      transport: 'http',
      note: 'keep me',
    });
    expect('unsupported' in notePlan && notePlan.unsupported).toContain('does not persist MCP notes');
  });

  it('allows mcp.create when fields match the verified Hermes CLI surface', () => {
    const plan = planKeyMcpAction({
      kind: 'mcp.create',
      name: 'demo',
      url: 'http://localhost:8000/mcp',
      transport: 'http',
    });
    expect('unsupported' in plan).toBe(false);
    if ('unsupported' in plan) throw new Error('expected supported plan');
    expect(plan.args).toEqual(['mcp', 'add', 'demo', '--url', 'http://localhost:8000/mcp']);
  });

  it('keeps webhook.create unsupported until Mission Control matches Hermes subscribe semantics', () => {
    const plan = planCwsAction({
      kind: 'webhook.create',
      name: 'notify',
      event: 'cron.completed',
      callbackUrl: 'https://example.com/webhook',
    });
    expect('unsupported' in plan && plan.unsupported).toContain('callbackUrl semantics');
  });

  it('keeps skill toggles unsupported without a stable non-interactive Hermes command', () => {
    const plan = planCwsAction({ kind: 'skill.disable', name: 'github-pr-workflow' });
    expect('unsupported' in plan && plan.unsupported).toContain('interactive skills config');
  });

  it('rejects cron.create model overrides that the verified Hermes CLI path does not support here', () => {
    const plan = planCwsAction({
      kind: 'cron.create',
      name: 'daily-summary',
      schedule: '0 9 * * *',
      prompt: 'Summarize the day',
      modelOverride: 'anthropic/claude-sonnet-4',
    });
    expect('unsupported' in plan && plan.unsupported).toContain('modelOverride');
  });

  it('maps cron.create to verified CLI flags when the request fits the safe subset', () => {
    const plan = planCwsAction({
      kind: 'cron.create',
      name: 'daily-summary',
      schedule: '0 9 * * *',
      prompt: 'Summarize the day',
      skills: ['plan', 'github-pr-workflow'],
      script: 'daily_summary.py',
    });
    expect('unsupported' in plan).toBe(false);
    if ('unsupported' in plan) throw new Error('expected supported plan');
    expect(plan.args).toEqual([
      'cron',
      'create',
      '0 9 * * *',
      'Summarize the day',
      '--name',
      'daily-summary',
      '--skill',
      'plan',
      '--skill',
      'github-pr-workflow',
      '--script',
      'daily_summary.py',
    ]);
  });
});
