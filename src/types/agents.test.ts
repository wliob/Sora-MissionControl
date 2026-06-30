import { describe, expect, it } from 'vitest';
import { AGENTS, isAgentId } from '@/types/agents';
import type { AgentId, AgentMeta } from '@/types/agents';

describe('Agent identity types', () => {
  describe('AGENTS roster', () => {
    it('contains all seven department leads', () => {
      const ids = AGENTS.map((a) => a.id);
      const expected: AgentId[] = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa', 'sora', 'rain'];
      expect(ids.sort()).toEqual([...expected].sort());
    });

    it('has unique ids across all agents', () => {
      const ids = AGENTS.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every agent has expected role title', () => {
      const titles: Record<AgentId, string> = {
        cloud: 'Sentinel · Systems Class',
        biscuit: 'Artificer · Code Class',
        korra: 'Visionweaver · Design Class',
        lelouch: 'Strategist · Logistics Class',
        tifa: 'Oracle · Finance Class',
        sora: 'Conductor',
        rain: 'Chronicler · Media Class',
      };

      for (const agent of AGENTS) {
        expect(agent.roleTitle, `${agent.id} roleTitle`).toBe(titles[agent.id]);
      }
    });

    it('Cloud has Sentinel Systems class title', () => {
      const cloud = AGENTS.find((a) => a.id === 'cloud') as AgentMeta;
      expect(cloud.roleTitle).toBe('Sentinel · Systems Class');
      expect(cloud.role).toBe('Systems & Infra');
    });

    it('Biscuit has Artificer Code class title', () => {
      const biscuit = AGENTS.find((a) => a.id === 'biscuit') as AgentMeta;
      expect(biscuit.roleTitle).toBe('Artificer · Code Class');
      expect(biscuit.role).toBe('Automation & Coding');
    });

    it('Korra has Visionweaver Design class title', () => {
      const korra = AGENTS.find((a) => a.id === 'korra') as AgentMeta;
      expect(korra.roleTitle).toBe('Visionweaver · Design Class');
      expect(korra.role).toBe('Creative & Media');
    });

    it('Lelouch has Strategist Logistics class title', () => {
      const lelouch = AGENTS.find((a) => a.id === 'lelouch') as AgentMeta;
      expect(lelouch.roleTitle).toBe('Strategist · Logistics Class');
      expect(lelouch.role).toBe('Lifestyle & Logistics');
    });

    it('Tifa has Oracle Finance class title', () => {
      const tifa = AGENTS.find((a) => a.id === 'tifa') as AgentMeta;
      expect(tifa.roleTitle).toBe('Oracle · Finance Class');
      expect(tifa.role).toBe('Finance & Trading');
    });

    it('Sora has Conductor title', () => {
      const sora = AGENTS.find((a) => a.id === 'sora') as AgentMeta;
      expect(sora.roleTitle).toBe('Conductor');
      expect(sora.role).toBe('Operations & Orchestration');
    });

    it('Rain has Chronicler Media class title', () => {
      const rain = AGENTS.find((a) => a.id === 'rain') as AgentMeta;
      expect(rain.roleTitle).toBe('Chronicler · Media Class');
      expect(rain.role).toBe('Communications & Intel');
    });
  });

  describe('AgentMeta interface', () => {
    it('every agent has all required fields', () => {
      for (const agent of AGENTS) {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.role).toBeDefined();
        expect(agent.accent).toMatch(/^var\(--agent-/);
        expect(agent.roleTitle).toBeDefined();
        expect(agent.roleGlyph).toBeDefined();
        expect(agent.roleGlyph.length).toBe(2);
        expect(agent.departmentAccent).toMatch(/^var\(--agent-/);
      }
    });

    it('role glyphs are two uppercase letters', () => {
      for (const agent of AGENTS) {
        expect(agent.roleGlyph).toMatch(/^[A-Z]{2}$/);
      }
    });

    it('accent and departmentAccent are CSS variables', () => {
      for (const agent of AGENTS) {
        expect(agent.accent).toMatch(/^var\(/);
        expect(agent.departmentAccent).toMatch(/^var\(/);
      }
    });
  });

  describe('isAgentId type guard', () => {
    it('returns true for valid agent ids', () => {
      expect(isAgentId('cloud')).toBe(true);
      expect(isAgentId('biscuit')).toBe(true);
      expect(isAgentId('korra')).toBe(true);
      expect(isAgentId('lelouch')).toBe(true);
      expect(isAgentId('tifa')).toBe(true);
      expect(isAgentId('sora')).toBe(true);
      expect(isAgentId('rain')).toBe(true);
    });

    it('returns false for invalid or unknown ids', () => {
      expect(isAgentId('unknown')).toBe(false);
      expect(isAgentId('')).toBe(false);
      expect(isAgentId('SYSTEM')).toBe(false);
      expect(isAgentId(null)).toBe(false);
      expect(isAgentId(undefined)).toBe(false);
      expect(isAgentId(42)).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isAgentId(123)).toBe(false);
      expect(isAgentId({})).toBe(false);
      expect(isAgentId([])).toBe(false);
      expect(isAgentId(true)).toBe(false);
    });
  });
});
