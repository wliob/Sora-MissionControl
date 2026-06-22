import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HermesChatTransport } from './hermesChatTransport';
import { HermesDashboardClient } from '@/services/hermes/dashboardClient';

const mockRequestJson = vi.fn();

const mockDashboardClient = {
  requestJson: mockRequestJson,
  baseUrl: 'http://localhost:9119',
  tokenProvider: {
    getToken: () => 'mock-token',
    hasToken: () => true,
  },
} as unknown as HermesDashboardClient;

describe('HermesChatTransport', () => {
  let transport: HermesChatTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new HermesChatTransport(mockDashboardClient);
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

  it('sendMessage throws with clear unavailability message', async () => {
    await expect(
      transport.sendMessage({
        profile: 'cloud' as any,
        message: 'test',
      }),
    ).rejects.toThrow(/no REST chat endpoint/);
  });

  it('subscribe throws with clear unavailability message', () => {
    expect(() => transport.subscribe(vi.fn())).toThrow(
      /no chat WebSocket endpoint/,
    );
  });

  it('isAvailable returns false', () => {
    expect(HermesChatTransport.isAvailable()).toBe(false);
  });
});
