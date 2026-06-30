/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { HermesDashboardClient, resolveDashboardBaseUrl } from '@/services/hermes/dashboardClient';
import { isSecureTransportError, DashboardHttpError } from '@/services/hermes/dashboardClient';

describe('resolveDashboardBaseUrl', () => {
  it('uses the current origin when the app already runs on the deployed proxy host', () => {
    expect(
      resolveDashboardBaseUrl(
        {
          origin: 'http://192.168.0.85:3187',
          protocol: 'http:',
          hostname: '192.168.0.85',
          port: '3187',
        },
        undefined,
      ),
    ).toBe('http://192.168.0.85:3187');
  });

  it('falls back to the same host mission-control proxy instead of raw 9119 when the app runs elsewhere', () => {
    expect(
      resolveDashboardBaseUrl(
        {
          origin: 'http://192.168.0.85:5173',
          protocol: 'http:',
          hostname: '192.168.0.85',
          port: '5173',
        },
        undefined,
      ),
    ).toBe('http://192.168.0.85:3187');
  });

  it('uses the HTTPS same-origin when the app is served from the canonical HTTPS 3443 port', () => {
    expect(
      resolveDashboardBaseUrl(
        {
          origin: 'https://192.168.10.5:3443',
          protocol: 'https:',
          hostname: '192.168.10.5',
          port: '3443',
        },
        undefined,
      ),
    ).toBe('https://192.168.10.5:3443');
  });

  it('never constructs a cross-port URL to port 3187 when origin is HTTPS', () => {
    const result = resolveDashboardBaseUrl(
      {
        origin: 'https://192.168.10.5:3443',
        protocol: 'https:',
        hostname: '192.168.10.5',
        port: '3443',
      },
      undefined,
    );
    // The resolved URL MUST NOT contain :3187 when origin is HTTPS 3443
    expect(result).not.toContain(':3187');
    expect(result).toBe('https://192.168.10.5:3443');
  });

  it('ignores an injected same-host port-3187 URL when served from canonical HTTPS', () => {
    expect(
      resolveDashboardBaseUrl(
        {
          origin: 'https://192.168.10.5:3443',
          protocol: 'https:',
          hostname: '192.168.10.5',
          port: '3443',
        },
        'http://192.168.10.5:3187',
      ),
    ).toBe('https://192.168.10.5:3443');

    expect(
      resolveDashboardBaseUrl(
        {
          origin: 'https://192.168.10.5:3443',
          protocol: 'https:',
          hostname: '192.168.10.5',
          port: '3443',
        },
        'https://192.168.10.5:3187',
      ),
    ).toBe('https://192.168.10.5:3443');
  });

  it('preserves injected external operator overrides from HTTPS when they are not same-host port 3187', () => {
    const location = {
      origin: 'https://192.168.10.5:3443',
      protocol: 'https:',
      hostname: '192.168.10.5',
      port: '3443',
    };

    expect(resolveDashboardBaseUrl(location, 'http://192.168.0.85:3187')).toBe('http://192.168.0.85:3187');
    expect(resolveDashboardBaseUrl(location, 'https://192.168.10.5:4443')).toBe('https://192.168.10.5:4443');
  });

  it('preserves the HTTP proxy port resolution when origin is plain HTTP on dev Vite port', () => {
    expect(
      resolveDashboardBaseUrl(
        {
          origin: 'http://192.168.0.85:5173',
          protocol: 'http:',
          hostname: '192.168.0.85',
          port: '5173',
        },
        undefined,
      ),
    ).toBe('http://192.168.0.85:3187');
  });
});

describe('HermesDashboardClient websocket behavior', () => {
  it('routes kanban websocket traffic through the same-origin proxy, not direct to port 9119', () => {
    const client = new HermesDashboardClient({
      baseUrl: 'http://192.168.0.85:3187',
      fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
      tokenProvider: {
        hasToken: () => true,
        getToken: () => 'session-token',
      },
    });

    expect(client.createKanbanEventsUrl(17)).toBe(
      'ws://192.168.0.85:3187/api/plugins/kanban/events?token=session-token&since_event_id=17',
    );
  });

  it('routes kanban websocket through the same HTTPS origin when served via HTTPS', () => {
    const client = new HermesDashboardClient({
      baseUrl: 'https://192.168.10.5:3443',
      fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
      tokenProvider: {
        hasToken: () => true,
        getToken: () => 'session-token',
      },
    });

    expect(client.createKanbanEventsUrl(null)).toBe(
      'wss://192.168.10.5:3443/api/plugins/kanban/events?token=session-token',
    );
  });

  it('uses the mission-control proxy origin for PTY websocket bridge traffic', () => {
    const client = new HermesDashboardClient({
      baseUrl: 'http://192.168.0.85:3187',
      fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
      tokenProvider: {
        hasToken: () => true,
        getToken: () => 'session-token',
      },
    });

    expect(client.getWsBaseUrl()).toBe('ws://192.168.0.85:3187');
  });
});

describe('HermesDashboardClient header behavior', () => {
  it('does not send X-Hermes-Session-Token when no token provider is configured', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('X-Hermes-Session-Token')).toBe(false);
      return new Response(JSON.stringify({ columns: [], assignees: [], tenants: [], latestEventId: null, now: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new HermesDashboardClient({
      baseUrl: 'http://mission-control.test:3187',
      fetchImpl,
      tokenProvider: {
        hasToken: () => false,
        getToken: () => null,
      },
    });

    await client.fetchBoard();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends X-Hermes-Session-Token only when an explicit token provider supplies one', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Hermes-Session-Token')).toBe('session-token');
      return new Response(JSON.stringify({ columns: [], assignees: [], tenants: [], latestEventId: null, now: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new HermesDashboardClient({
      baseUrl: 'http://mission-control.test:3187',
      fetchImpl,
      tokenProvider: {
        hasToken: () => true,
        getToken: () => 'session-token',
      },
    });

    await client.fetchBoard();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('preserves backend JSON error messages for secure-transport guidance', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ error: 'Sensitive Mission Control routes are unavailable on this plain HTTP listener.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ));

    const client = new HermesDashboardClient({
      baseUrl: 'http://mission-control.test:3187',
      fetchImpl,
      tokenProvider: {
        hasToken: () => false,
        getToken: () => null,
      },
    });

    await expect(client.fetchBoard()).rejects.toThrow('plain HTTP listener');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('isSecureTransportError', () => {
  it('returns true when the message matches the secure-transport 403 pattern', () => {
    expect(isSecureTransportError('Sensitive Mission Control routes are unavailable on this plain HTTP listener.')).toBe(true);
  });

  it('returns false for a generic 403 error message', () => {
    expect(isSecureTransportError('Forbidden')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSecureTransportError('')).toBe(false);
  });

  it('marks DashboardHttpError.isSecureTransport when 403 with secure-transport message', () => {
    const err = new DashboardHttpError(403, '/admin/keys', 'Sensitive Mission Control routes are unavailable on this plain HTTP listener.');
    expect(err.isSecureTransport).toBe(true);
    expect(err.guidance()).toContain('HTTPS');
  });

  it('does NOT mark DashboardHttpError.isSecureTransport for other 403 messages', () => {
    const err = new DashboardHttpError(403, '/api/board', 'Forbidden');
    expect(err.isSecureTransport).toBe(false);
    expect(err.guidance()).toBeNull();
  });

  it('does NOT mark DashboardHttpError.isSecureTransport for non-403 errors', () => {
    const err = new DashboardHttpError(404, '/admin/keys', 'Sensitive Mission Control routes are unavailable on this plain HTTP listener.');
    expect(err.isSecureTransport).toBe(false);
  });
});
