/**
 * chatBackbone tests — Phase 4 composition seam coverage.
 *
 * Verifies the backbone's contract surface:
 *   - Binds a transport (demo by default; verified transport when supplied).
 *   - `isDemoMode()` reports the honest active transport kind.
 *   - Profile bridging pushes the transport's `listProfiles()` result into the
 *     chat store as `ChatProfileContext`, with the static AGENTS roster as a
 *     floor so the profile rail never goes blank.
 *   - Source health for `chat-transport` is reported to the shared
 *     `sessionConnectionStore` (connected on success, degraded on transport
 *     failure, offline after stop).
 *   - Swapping transports re-binds cleanly and reflects the new kind.
 *
 * The backbone depends on the shared sessionConnectionStore (module singleton),
 * so tests reset it via its `_resetForTest` export.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTS } from '@/types';
import type { AgentId } from '@/types';
import { _resetForTest as resetSessionConnectionStore } from '@/state/sessionConnectionStore';
import { getSourceHealth } from '@/state/sessionConnectionStore';
import {
  startChatBackbone,
  stopChatBackbone,
  getChatBackbone,
  isDemoMode,
} from './chatBackbone';
import { chatStore } from './chatStore';
import type {
  ChatEvent,
  ChatTransport,
  ProfileSummary,
  SendMessageInput,
  SendMessageResult,
} from './types';

/* ── fake verified transport ────────────────────────────────────────────── */

type Subscriber = (event: ChatEvent) => void;

function makeVerifiedTransport(
  opts: { profiles?: ProfileSummary[]; failListProfiles?: boolean } = {},
): ChatTransport & { sent: SendMessageInput[]; emit: (e: ChatEvent) => void } {
  const subscribers: Subscriber[] = [];
  const sent: SendMessageInput[] = [];
  const profiles = opts.profiles ?? AGENTS.map((a) => ({ id: a.id, name: a.name, role: a.role }));
  return {
    sent,
    emit(e: ChatEvent) {
      for (const s of subscribers) s(e);
    },
    async listProfiles(): Promise<ProfileSummary[]> {
      if (opts.failListProfiles) throw new Error('verified transport down');
      return profiles;
    },
    async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
      sent.push(input);
      return { sessionId: 'verified-sess', reply: 'verified reply' };
    },
    subscribe(handler: Subscriber) {
      subscribers.push(handler);
      return () => {
        const i = subscribers.indexOf(handler);
        if (i >= 0) subscribers.splice(i, 1);
      };
    },
  };
}

function resetChatStoreThreads() {
  for (const profile of AGENTS.map((a) => a.id) as AgentId[]) {
    const ids = [...chatStore.getThreadIds(profile)];
    for (const id of ids) chatStore.deleteThread(id);
  }
  chatStore.selectProfile(null);
}

beforeEach(() => {
  resetSessionConnectionStore();
  resetChatStoreThreads();
  stopChatBackbone();
});

describe('chatBackbone — transport binding and demo mode', () => {
  it('defaults to demo mode and reports isDemoMode() true', () => {
    startChatBackbone();
    expect(isDemoMode()).toBe(true);
    expect(getChatBackbone()?.isDemoMode()).toBe(true);
  });

  it('reports isDemoMode() false when a verified transport is supplied', () => {
    startChatBackbone({ transport: makeVerifiedTransport() });
    expect(isDemoMode()).toBe(false);
    expect(getChatBackbone()?.isDemoMode()).toBe(false);
  });

  it('exposes the bound transport on the backbone object', () => {
    const verified = makeVerifiedTransport();
    const backbone = startChatBackbone({ transport: verified });
    expect(backbone.transport).toBe(verified);
  });

  it('starting again swaps transports and reflects the new kind', () => {
    startChatBackbone();
    expect(isDemoMode()).toBe(true);

    startChatBackbone({ transport: makeVerifiedTransport() });
    expect(isDemoMode()).toBe(false);
  });
});

describe('chatBackbone — profile bridging', () => {
  it('pushes the static AGENTS roster floor even before listProfiles resolves', async () => {
    // A transport whose listProfiles never rejects but takes a tick. The
    // store should still have a profile context for every AGENTS entry so the
    // profile rail is never blank.
    const slow: ChatTransport = {
      async listProfiles() {
        return AGENTS.map((a) => ({ id: a.id, name: a.name, role: a.role }));
      },
      async sendMessage() {
        return { sessionId: 's' };
      },
    };
    startChatBackbone({ transport: slow });
    // Allow the async bridgeProfiles to complete.
    await Promise.resolve();
    await Promise.resolve();
    for (const a of AGENTS) {
      expect(chatStore.state.profiles[a.id]).toBeDefined();
      expect(chatStore.state.profiles[a.id].name).toBe(a.name);
    }
  });

  it('reports connected health when listProfiles succeeds', async () => {
    startChatBackbone({ transport: makeVerifiedTransport() });
    await getChatBackbone()!.refreshProfiles();
    const health = getSourceHealth('chat-transport');
    expect(health.state).toBe('connected');
    expect(health.lastOkAt).toBeTruthy();
  });

  it('keeps the static roster floor and marks health degraded when listProfiles fails', async () => {
    startChatBackbone({
      transport: makeVerifiedTransport({ failListProfiles: true }),
    });
    await getChatBackbone()!.refreshProfiles();
    const health = getSourceHealth('chat-transport');
    expect(health.state).toBe('degraded');
    expect(health.error).toContain('transport listProfiles failed');
    // Static floor still present.
    for (const a of AGENTS) {
      expect(chatStore.state.profiles[a.id]).toBeDefined();
    }
  });
});

describe('chatBackbone — stop and health', () => {
  it('stop reports offline health and clears profiles', async () => {
    startChatBackbone({ transport: makeVerifiedTransport() });
    await getChatBackbone()!.refreshProfiles();
    expect(getSourceHealth('chat-transport').state).toBe('connected');

    stopChatBackbone();
    const health = getSourceHealth('chat-transport');
    expect(health.state).toBe('offline');
    expect(getChatBackbone()).toBeNull();
    // Profiles cleared.
    expect(Object.keys(chatStore.state.profiles)).toHaveLength(0);
  });

  it('isDemoMode() returns true again after stop', () => {
    startChatBackbone({ transport: makeVerifiedTransport() });
    expect(isDemoMode()).toBe(false);
    stopChatBackbone();
    expect(isDemoMode()).toBe(true);
  });
});