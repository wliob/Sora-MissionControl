import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HermesChatTransport } from './hermesChatTransport';
import { HermesDashboardClient } from '@/services/hermes/dashboardClient';

const mockRequestJson = vi.fn();

const mockDashboardClient = {
  requestJson: mockRequestJson,
  baseUrl: 'http://localhost:3187',
  getSessionToken: () => 'mock-token',
  getWsBaseUrl: () => 'ws://localhost:3187',
} as unknown as HermesDashboardClient;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  message(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  error() {
    this.onerror?.({} as Event);
  }
}

describe('HermesChatTransport', () => {
  let transport: HermesChatTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    transport = new HermesChatTransport(mockDashboardClient);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists profiles from /api/plugins/kanban/profiles', async () => {
    mockRequestJson.mockResolvedValueOnce({
      data: {
        profiles: [
          {
            name: 'cloud',
            is_default: false,
            model: 'deepseek-v4-pro',
            provider: 'opencode-go',
            description: 'Systems & Infrastructure',
            description_auto: false,
            skill_count: 102,
          },
          {
            name: 'biscuit',
            is_default: false,
            model: 'glm-5.2',
            provider: 'ollama-cloud',
            description: 'Automation & Coding',
            description_auto: false,
            skill_count: 108,
          },
        ],
      },
    });

    const profiles = await transport.listProfiles();
    expect(profiles).toEqual([
      { id: 'cloud', name: 'cloud', role: 'Systems & Infrastructure' },
      { id: 'biscuit', name: 'biscuit', role: 'Automation & Coding' },
    ]);
    expect(mockRequestJson).toHaveBeenCalledWith(
      '/api/plugins/kanban/profiles',
    );
  });

  it('maps empty description to profile name as role', async () => {
    mockRequestJson.mockResolvedValueOnce({
      data: {
        profiles: [
          {
            name: 'default',
            is_default: true,
            model: 'gpt-5.4-mini',
            provider: 'openai-codex',
            description: '',
            description_auto: false,
            skill_count: 164,
          },
        ],
      },
    });

    const profiles = await transport.listProfiles();
    expect(profiles[0].role).toBe('default');
  });

  it('sendMessage connects to the proxied PTY WebSocket bridge and sends a chat command', async () => {
    const resultPromise = transport.sendMessage({
      profile: 'cloud' as any,
      message: 'ship it',
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:3187/api/pty?token=mock-token');

    ws.open();
    expect(ws.sent).toEqual(['chat cloud ship it\n']);
    ws.message('agent reply');
    ws.close();

    await expect(resultPromise).resolves.toEqual({
      sessionId: expect.stringMatching(/^pty-\d+$/),
      reply: 'agent reply',
    });
  });

  it('sendMessage rejects on PTY WebSocket errors', async () => {
    const resultPromise = transport.sendMessage({
      profile: 'cloud' as any,
      message: 'test',
    });
    MockWebSocket.instances[0].error();
    await expect(resultPromise).rejects.toThrow('PTY WebSocket connection error');
  });

  it('subscribe opens a persistent PTY bridge connection and returns unsubscribe', () => {
    const handler = vi.fn();
    const unsub = transport.subscribe(handler);
    const ws = MockWebSocket.instances[0];

    expect(ws.url).toBe('ws://localhost:3187/api/pty?token=mock-token');
    ws.open();
    expect(handler).toHaveBeenCalledWith({
      type: 'transport.status',
      profile: 'biscuit',
      state: 'connected',
    });

    unsub();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('isAvailable returns true (PTY bridge is available)', () => {
    expect(HermesChatTransport.isAvailable()).toBe(true);
  });
});
