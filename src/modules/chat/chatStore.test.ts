/**
 * chatStore determinism tests.
 *
 * Covers the acceptance criteria from the task body:
 *   - thread/history behaviour is deterministic
 *   - switching profiles preserves per-profile conversation history
 *   - returning to a profile loads the correct thread
 *   - edge cases: new threads, empty histories, thread selection
 *   - transport failures and retry
 *
 * Uses a fake transport so the store logic is exercised without Cloud's
 * real adapter. The fake is in-process and synchronous-by-default so the
 * tests are deterministic without timers.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentId } from '@/types';
import type {
  ChatEvent,
  ChatProfileContext,
  ChatTransport,
  ProfileSummary,
  SendMessageInput,
  SendMessageResult,
} from './types';
import {
  chatStore,
  setTransport,
  selectProfile,
  selectThread,
  createThread,
  deleteThread,
  setDraft,
  sendMessage,
  retryMessage,
  getActiveThread,
  getThreadIds,
  getActiveThreadId,
  setProfiles,
} from './chatStore';

/* ── fake transport ─────────────────────────────────────────────────────── */

type Subscriber = (event: ChatEvent) => void;

interface FakeTransportOptions {
  /** If set, sendMessage rejects with this Error. */
  failWithError?: Error;
  /** If set, sendMessage resolves with this sessionId (default 'sess-1'). */
  sessionId?: string;
  /** If set, sendMessage resolves with this synchronous reply text. */
  reply?: string;
}

function makeFakeTransport(opts: FakeTransportOptions = {}): ChatTransport & {
  subscribers: Subscriber[];
  emit: (e: ChatEvent) => void;
  sent: SendMessageInput[];
} {
  const subscribers: Subscriber[] = [];
  const sent: SendMessageInput[] = [];
  const sessionId = opts.sessionId ?? 'sess-1';
  return {
    subscribers,
    emit(e: ChatEvent) {
      for (const s of subscribers) s(e);
    },
    sent,
    async listProfiles(): Promise<ProfileSummary[]> {
      return [];
    },
    async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
      sent.push(input);
      if (opts.failWithError) throw opts.failWithError;
      return { sessionId, reply: opts.reply };
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

/* ── helpers ────────────────────────────────────────────────────────────── */

const BISCUIT = 'biscuit' as AgentId;
const CLOUD = 'cloud' as AgentId;

function messageDelivery(threadId: string, messageId: string) {
  const t = chatStore.state.threads[threadId];
  return t.messages.find((m) => m.id === messageId)?.delivery;
}

/* ── reset between tests ────────────────────────────────────────────────── */

/**
 * Reset the module-level store state. We re-import the module's internals via
 * a tiny harness: since the store is a module singleton, we reset by
 * deleting all threads and re-selecting null. The idCounter is not reset —
 * ids stay unique across tests, which is fine.
 */
function resetStore() {
  for (const profile of ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa'] as AgentId[]) {
    const ids = [...getThreadIds(profile)];
    for (const id of ids) deleteThread(id);
  }
  selectProfile(null);
  setTransport(null);
}

/* ── tests ──────────────────────────────────────────────────────────────── */

describe('chatStore — profile switching preserves per-profile history', () => {
  beforeEach(() => resetStore());

  it('preserves threads and active thread when switching profiles and back', async () => {
    setTransport(makeFakeTransport({ reply: 'hi from biscuit' }));
    selectProfile(BISCUIT);
    await sendMessage(BISCUIT, 'hello biscuit');
    const biscuitThreadId = getActiveThreadId(BISCUIT)!;
    expect(biscuitThreadId).toBeTruthy();

    // Switch to cloud, create a thread there.
    selectProfile(CLOUD);
    expect(getActiveThreadId(CLOUD)).toBeNull();
    const cloudThreadId = createThread(CLOUD);
    expect(getActiveThreadId(CLOUD)).toBe(cloudThreadId);

    // Switch back to biscuit — its thread must be intact and active.
    selectProfile(BISCUIT);
    expect(getActiveThreadId(BISCUIT)).toBe(biscuitThreadId);
    expect(getThreadIds(BISCUIT)).toContain(biscuitThreadId);
    const thread = chatStore.state.threads[biscuitThreadId];
    expect(thread.messages.length).toBe(2); // user + agent reply
    expect(thread.messages[0].role).toBe('user');
    expect(thread.messages[1].role).toBe('agent');

    // Cloud's thread must still exist even though biscuit is selected.
    expect(getThreadIds(CLOUD)).toContain(cloudThreadId);
  });

  it('does not leak messages across profiles', async () => {
    setTransport(makeFakeTransport({ reply: 'cloud reply' }));
    selectProfile(CLOUD);
    await sendMessage(CLOUD, 'only for cloud');

    selectProfile(BISCUIT);
    expect(getThreadIds(BISCUIT)).toEqual([]);
    expect(getActiveThreadId(BISCUIT)).toBeNull();

    // Biscuit's active thread must be null, and creating one starts fresh.
    const t = createThread(BISCUIT);
    expect(chatStore.state.threads[t].messages).toEqual([]);
  });
});

describe('chatStore — new threads and empty histories', () => {
  beforeEach(() => resetStore());

  it('creates a thread with empty history and empty preview', () => {
    setTransport(makeFakeTransport());
    const id = createThread(BISCUIT);
    const t = chatStore.state.threads[id];
    expect(t.messages).toEqual([]);
    expect(t.preview).toBe('');
    expect(t.draft).toBe('');
    expect(t.sessionId).toBeNull();
    expect(getActiveThreadId(BISCUIT)).toBe(id);
  });

  it('first send auto-creates a thread if none is active', async () => {
    setTransport(makeFakeTransport({ reply: 'auto thread reply' }));
    selectProfile(BISCUIT);
    // No explicit createThread — sendMessage should create one.
    await sendMessage(BISCUIT, 'auto thread');
    const id = getActiveThreadId(BISCUIT);
    expect(id).toBeTruthy();
    const t = chatStore.state.threads[id!];
    expect(t.messages.length).toBe(2);
    expect(t.messages[0].content).toBe('auto thread');
  });

  it('empty history thread shows in the list and can be selected', () => {
    setTransport(makeFakeTransport());
    const id1 = createThread(BISCUIT);
    const id2 = createThread(BISCUIT);
    expect(getThreadIds(BISCUIT)).toEqual([id1, id2]);
    selectThread(BISCUIT, id1);
    expect(getActiveThreadId(BISCUIT)).toBe(id1);
    expect(getActiveThread()?.id).toBe(id1);
  });
});

describe('chatStore — message lifecycle is deterministic', () => {
  beforeEach(() => resetStore());

  it('transitions user message pending → sent → delivered on sync reply', async () => {
    setTransport(makeFakeTransport({ reply: 'ack' }));
    selectProfile(BISCUIT);
    await sendMessage(BISCUIT, 'lifecycle test');
    const t = getActiveThread()!;
    const userMsg = t.messages.find((m) => m.role === 'user')!;
    expect(userMsg.delivery).toBe('delivered'); // sync reply promotes to delivered
    expect(t.sessionId).toBe('sess-1');
  });

  it('transitions user message pending → failed on transport error', async () => {
    setTransport(makeFakeTransport({ failWithError: new Error('network down') }));
    selectProfile(BISCUIT);
    await sendMessage(BISCUIT, 'will fail');
    const t = getActiveThread()!;
    const userMsg = t.messages.find((m) => m.role === 'user')!;
    expect(userMsg.delivery).toBe('failed');
    expect(userMsg.error).toBe('network down');
    expect(chatStore.state.lastError).toBe('network down');
  });

  it('retry transitions the original message failed → pending → delivered', async () => {
    // First transport fails; after first failure, swap to a succeeding one.
    const failing = makeFakeTransport({ failWithError: new Error('boom') });
    setTransport(failing);
    selectProfile(BISCUIT);
    await sendMessage(BISCUIT, 'retry me');
    const t = getActiveThread()!;
    const userMsgId = t.messages.find((m) => m.role === 'user')!.id;
    expect(messageDelivery(t.id, userMsgId)).toBe('failed');

    const ok = makeFakeTransport({ reply: 'now it works' });
    setTransport(ok);
    await retryMessage(t.id, userMsgId);
    const updated = chatStore.state.threads[t.id];
    // The original message is updated in place — no new user message inserted.
    const userMsgs = updated.messages.filter((m) => m.role === 'user');
    expect(userMsgs.length).toBe(1);
    expect(userMsgs[0].id).toBe(userMsgId);
    expect(userMsgs[0].delivery).toBe('delivered'); // original recovered
    // The agent reply from the retry is appended.
    const agentMsgs = updated.messages.filter((m) => m.role === 'agent');
    expect(agentMsgs.length).toBe(1);
    expect(agentMsgs[0].content).toBe('now it works');
  });

  it('async agent reply via subscribe appends an agent message', async () => {
    const fake = makeFakeTransport({ reply: undefined });
    setTransport(fake);
    selectProfile(BISCUIT);
    await sendMessage(BISCUIT, 'trigger async');
    const t = getActiveThread()!;
    expect(t.messages.length).toBe(1); // only user, no sync reply
    expect(t.messages[0].delivery).toBe('sent');

    // Emit an async agent reply.
    fake.emit({ type: 'agent.reply', threadId: t.id, profile: BISCUIT, sessionId: 'sess-1', content: 'async reply' });
    const updated = chatStore.state.threads[t.id];
    expect(updated.messages.length).toBe(2);
    expect(updated.messages[1].role).toBe('agent');
    expect(updated.messages[1].content).toBe('async reply');
    expect(updated.messages[1].sessionId).toBe('sess-1');
  });

  it('agent.error event sets lastError but does not corrupt messages', async () => {
    const fake = makeFakeTransport();
    setTransport(fake);
    selectProfile(BISCUIT);
    await sendMessage(BISCUIT, 'then error');
    const t = getActiveThread()!;
    const countBefore = t.messages.length;
    fake.emit({ type: 'agent.error', threadId: t.id, profile: BISCUIT, error: 'agent crashed' });
    expect(chatStore.state.lastError).toBe('agent crashed');
    expect(chatStore.state.threads[t.id].messages.length).toBe(countBefore);
  });
});

describe('chatStore — draft preservation', () => {
  beforeEach(() => resetStore());

  it('preserves per-thread draft across thread switches', () => {
    setTransport(makeFakeTransport());
    const id1 = createThread(BISCUIT);
    const id2 = createThread(BISCUIT);
    setDraft(id1, 'draft in thread 1');
    setDraft(id2, 'draft in thread 2');
    selectThread(BISCUIT, id1);
    expect(chatStore.state.threads[id1].draft).toBe('draft in thread 1');
    selectThread(BISCUIT, id2);
    expect(chatStore.state.threads[id2].draft).toBe('draft in thread 2');
    expect(chatStore.state.threads[id1].draft).toBe('draft in thread 1'); // untouched
  });

  it('preserves draft across profile switches', () => {
    setTransport(makeFakeTransport());
    const biscuitId = createThread(BISCUIT);
    setDraft(biscuitId, 'saved draft');
    selectProfile(CLOUD);
    createThread(CLOUD);
    selectProfile(BISCUIT);
    expect(chatStore.state.threads[biscuitId].draft).toBe('saved draft');
  });

  it('clears draft on successful send', async () => {
    setTransport(makeFakeTransport({ reply: 'ok' }));
    selectProfile(BISCUIT);
    const id = createThread(BISCUIT);
    setDraft(id, 'about to send');
    await sendMessage(BISCUIT, 'about to send');
    expect(chatStore.state.threads[id].draft).toBe('');
  });
});

describe('chatStore — thread selection and deletion', () => {
  beforeEach(() => resetStore());

  it('selecting a thread of a different profile also switches the selected profile', () => {
    setTransport(makeFakeTransport());
    const id = createThread(CLOUD);
    selectProfile(BISCUIT);
    selectThread(CLOUD, id);
    expect(chatStore.state.selectedProfile).toBe(CLOUD);
    expect(getActiveThreadId(CLOUD)).toBe(id);
  });

  it('deleting the active thread clears the active pointer', () => {
    setTransport(makeFakeTransport());
    const id = createThread(BISCUIT);
    expect(getActiveThreadId(BISCUIT)).toBe(id);
    deleteThread(id);
    expect(getActiveThreadId(BISCUIT)).toBeNull();
    expect(getThreadIds(BISCUIT)).not.toContain(id);
  });

  it('deleting a non-active thread leaves the active one intact', () => {
    setTransport(makeFakeTransport());
    const id1 = createThread(BISCUIT);
    const id2 = createThread(BISCUIT);
    selectThread(BISCUIT, id1);
    deleteThread(id2);
    expect(getActiveThreadId(BISCUIT)).toBe(id1);
    expect(getThreadIds(BISCUIT)).toEqual([id1]);
  });

  it('selectThread throws when thread does not belong to the profile', () => {
    setTransport(makeFakeTransport());
    const id = createThread(BISCUIT);
    expect(() => selectThread(CLOUD, id)).toThrow();
  });
});

describe('chatStore — transport binding', () => {
  beforeEach(() => resetStore());

  it('sendMessage throws if no transport is bound', async () => {
    setTransport(null);
    selectProfile(BISCUIT);
    await expect(sendMessage(BISCUIT, 'no transport')).rejects.toThrow();
    expect(chatStore.state.lastError).toBeTruthy();
  });

  it('setTransport subscribes and unsubscribes cleanly', () => {
    const fake = makeFakeTransport();
    setTransport(fake);
    expect(fake.subscribers.length).toBe(1);
    setTransport(null);
    expect(fake.subscribers.length).toBe(0);
  });

  it('setProfiles updates profile context without affecting threads', () => {
    setTransport(makeFakeTransport());
    const id = createThread(BISCUIT);
    setProfiles({
      biscuit: { id: BISCUIT, name: 'Biscuit', role: 'Coding', accent: 'var(--agent-biscuit)', activity: 'working' },
      cloud: { id: CLOUD, name: 'Cloud', role: 'Systems', accent: 'var(--agent-cloud)' },
      korra: { id: 'korra', name: 'Korra', role: 'Creative', accent: 'var(--agent-korra)' },
      lelouch: { id: 'lelouch', name: 'Lelouch', role: 'Lifestyle', accent: 'var(--agent-lelouch)' },
      tifa: { id: 'tifa', name: 'Tifa', role: 'Finance', accent: 'var(--agent-tifa)' },
    } as Record<AgentId, ChatProfileContext>);
    expect(chatStore.state.profiles.biscuit.name).toBe('Biscuit');
    expect(chatStore.state.threads[id]).toBeTruthy(); // threads untouched
  });
});

describe('chatStore — determinism invariants', () => {
  beforeEach(() => resetStore());

  it('message and thread ids are monotonically unique', () => {
    setTransport(makeFakeTransport());
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      ids.add(createThread(BISCUIT));
    }
    expect(ids.size).toBe(5);
  });

  it('preview is truncated to a bounded length', async () => {
    setTransport(makeFakeTransport());
    selectProfile(BISCUIT);
    const long = 'x'.repeat(200);
    await sendMessage(BISCUIT, long);
    const t = getActiveThread()!;
    expect(t.preview.length).toBeLessThanOrEqual(82); // 80 + ellipsis
  });

  it('user message content is never mutated after insertion', async () => {
    setTransport(makeFakeTransport({ reply: 'r' }));
    selectProfile(BISCUIT);
    await sendMessage(BISCUIT, 'original');
    const t = getActiveThread()!;
    const userMsg = t.messages.find((m) => m.role === 'user')!;
    expect(userMsg.content).toBe('original');
    // Trigger an async reply and a state change; content must not change.
    (chatStore as unknown as { _noop?: never });
    const store = chatStore;
    store.setDraft(t.id, 'new draft');
    expect(chatStore.state.threads[t.id].messages[0].content).toBe('original');
  });
});