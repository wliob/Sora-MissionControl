/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MissionControlAdminProxyError,
  MissionControlAdminProxyAdapter,
  clearMissionControlAdminProxyToken,
  getMissionControlAdminProxyAuthState,
  isHttpLockedAdminOrigin,
  resolveAdminProxyBaseUrl,
  setMissionControlAdminProxyToken,
  _resetMissionControlAdminProxyAuthForTest,
} from '@/services/hermes/adminProxyAdapter';

describe('MissionControlAdminProxyAdapter URL and transport handling', () => {
  it('uses the canonical HTTPS same-origin admin proxy and never cross-ports to 3187', () => {
    const result = resolveAdminProxyBaseUrl({
      origin: 'https://192.168.10.5:3443',
      protocol: 'https:',
      hostname: '192.168.10.5',
      port: '3443',
    });

    expect(result).toBe('https://192.168.10.5:3443');
    expect(result).not.toBe('https://192.168.10.5:3187');
    expect(result).not.toContain(':3187');
  });

  it('ignores an injected same-host port-3187 proxy URL from canonical HTTPS', () => {
    const location = {
      origin: 'https://192.168.10.5:3443',
      protocol: 'https:',
      hostname: '192.168.10.5',
      port: '3443',
    };

    expect(resolveAdminProxyBaseUrl(location, 'http://192.168.10.5:3187')).toBe('https://192.168.10.5:3443');
    expect(resolveAdminProxyBaseUrl(location, 'https://192.168.10.5:3187')).toBe('https://192.168.10.5:3443');
  });

  it('preserves injected external operator proxy overrides from HTTPS', () => {
    const location = {
      origin: 'https://192.168.10.5:3443',
      protocol: 'https:',
      hostname: '192.168.10.5',
      port: '3443',
    };

    expect(resolveAdminProxyBaseUrl(location, 'http://192.168.0.85:3187')).toBe('http://192.168.0.85:3187');
    expect(resolveAdminProxyBaseUrl(location, 'https://192.168.10.5:4443')).toBe('https://192.168.10.5:4443');
  });

  it('keeps loopback HTTP development available but marks LAN HTTP 3187 as locked for admin UX', () => {
    expect(isHttpLockedAdminOrigin({
      origin: 'http://127.0.0.1:3187',
      protocol: 'http:',
      hostname: '127.0.0.1',
      port: '3187',
    })).toBe(false);

    expect(isHttpLockedAdminOrigin({
      origin: 'http://192.168.10.5:3187',
      protocol: 'http:',
      hostname: '192.168.10.5',
      port: '3187',
    })).toBe(true);
  });

  it('throws a typed secure-transport error for the HTTP listener 403 guard', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({
        error: 'Sensitive Mission Control routes are unavailable on this plain HTTP listener.',
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const adapter = new MissionControlAdminProxyAdapter({
      baseUrl: 'http://192.168.10.5:3187',
      fetchImpl,
    });

    await expect(adapter.listKeys()).rejects.toMatchObject({
      status: 403,
      isSecureTransportRequired: true,
    } satisfies Partial<MissionControlAdminProxyError>);
  });
});

describe('MissionControlAdminProxyAdapter auth header handling', () => {
  beforeEach(() => {
    _resetMissionControlAdminProxyAuthForTest();
    clearMissionControlAdminProxyToken();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends no X-Mission-Control-Key header when no token is configured', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('X-Mission-Control-Key')).toBe(false);
      return new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new MissionControlAdminProxyAdapter({
      baseUrl: 'http://mission-control.test:3187',
      fetchImpl,
    });

    await expect(adapter.listKeys()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends X-Mission-Control-Key only after an operator configures a session token', async () => {
    setMissionControlAdminProxyToken('operator-session-token');

    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Mission-Control-Key')).toBe('operator-session-token');
      return new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new MissionControlAdminProxyAdapter({
      baseUrl: 'http://mission-control.test:3187',
      fetchImpl,
    });

    await expect(adapter.listKeys()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not log, render-state expose, or persist configured tokens', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    setMissionControlAdminProxyToken('do-not-leak-admin-token');

    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const adapter = new MissionControlAdminProxyAdapter({
      baseUrl: 'http://mission-control.test:3187',
      fetchImpl,
    });

    await expect(adapter.listKeys()).resolves.toEqual([]);
    expect(JSON.stringify(getMissionControlAdminProxyAuthState())).not.toContain('do-not-leak-admin-token');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('keeps unsupported or unauthorized proxy behavior honest', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ error: 'Unsupported action for this proxy' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const adapter = new MissionControlAdminProxyAdapter({
      baseUrl: 'http://mission-control.test:3187',
      fetchImpl,
    });

    await expect(adapter.listKeys()).rejects.toThrow('Unsupported action for this proxy');
  });
});
