/**
 * demoChatTransport tests.
 *
 * Verifies the explicit mock satisfies the ChatTransport contract and is
 * clearly labelled mock/demo so demo output is never mistaken for a live
 * agent response.
 */

import { describe, expect, it } from 'vitest';
import { AGENTS } from '@/types';
import type { AgentId } from '@/types';
import { createDemoChatTransport, DEMO_MODE } from './demoChatTransport';

const BISCUIT = 'biscuit' as AgentId;

describe('demoChatTransport — explicit mock contract', () => {
  it('is labelled demo mode', () => {
    const t = createDemoChatTransport();
    expect(t.isDemo).toBe(true);
    expect(DEMO_MODE).toBe(true);
  });

  it('listProfiles returns the static AGENTS roster mapped to ProfileSummary', async () => {
    const t = createDemoChatTransport();
    const profiles = await t.listProfiles();
    expect(profiles).toHaveLength(AGENTS.length);
    for (const a of AGENTS) {
      const p = profiles.find((x) => x.id === a.id);
      expect(p).toBeDefined();
      expect(p!.name).toBe(a.name);
      expect(p!.role).toBe(a.role);
    }
  });

  it('sendMessage returns a session id and a clearly-labelled [demo] reply', async () => {
    const t = createDemoChatTransport();
    const result = await t.sendMessage({ profile: BISCUIT, message: 'hello' });
    expect(result.sessionId).toMatch(/^demo-sess-biscuit-/);
    expect(result.reply).toContain('[demo]');
  });

  it('records sent inputs for introspection', async () => {
    const t = createDemoChatTransport();
    await t.sendMessage({ profile: BISCUIT, message: 'first' });
    await t.sendMessage({ profile: BISCUIT, message: 'second' });
    expect(t.sent).toHaveLength(2);
    expect(t.sent[0].message).toBe('first');
    expect(t.sent[1].message).toBe('second');
  });

  it('echoes the supplied sessionId when continuing a thread', async () => {
    const t = createDemoChatTransport();
    const result = await t.sendMessage({
      profile: BISCUIT,
      message: 'continue',
      sessionId: 'existing-sess-123',
    });
    expect(result.sessionId).toBe('existing-sess-123');
  });

  it('subscribe delivers events to subscribers and unsubscribes cleanly', () => {
    const t = createDemoChatTransport();
    const received: string[] = [];
    const subscribe = t.subscribe;
    if (!subscribe) throw new Error('transport has no subscribe');
    const unsub = subscribe((e) => received.push(e.type));

    t.emit({ type: 'agent.reply', threadId: 'th_1', profile: BISCUIT, sessionId: 's', content: 'hi' });
    expect(received).toEqual(['agent.reply']);

    unsub();
    t.emit({ type: 'agent.reply', threadId: 'th_1', profile: BISCUIT, sessionId: 's', content: 'hi' });
    expect(received).toEqual(['agent.reply']); // no second delivery
  });

  it('every profile has a canned demo reply', async () => {
    const t = createDemoChatTransport();
    for (const a of AGENTS) {
      const r = await t.sendMessage({ profile: a.id, message: 'ping' });
      expect(r.reply).toContain('[demo]');
    }
  });
});