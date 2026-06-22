import { beforeEach, describe, expect, it } from 'vitest';
import { boardStore } from '@/state/boardStore';
import { HermesDashboardClient, type SessionTokenProvider } from '@/services/hermes/dashboardClient';
import { _resetForTest as resetSessionConnectionStore } from '@/state/sessionConnectionStore';

const tokenProvider: SessionTokenProvider = {
  hasToken: () => true,
  getToken: () => 'secret-token-value',
};

const sampleBoard = {
  columns: [
    {
      name: 'todo',
      tasks: [
        {
          id: 't_live_1',
          title: 'Wire backbone',
          status: 'todo',
          assignee: 'cloud',
          created_at: 1705314600,
        },
      ],
    },
  ],
  assignees: ['cloud'],
  tenants: ['default'],
  latest_event_id: 4,
  now: 1705314600,
};

beforeEach(() => {
  boardStore._resetForTest();
  resetSessionConnectionStore();
});

describe('boardStore live sync', () => {
  it('normalizes REST snapshots into shared board state', () => {
    const board = boardStore.applyBoardRaw(sampleBoard);

    expect(board.value?.columns).toHaveLength(8);
    expect(board.value?.columns.find((column) => column.name === 'todo')?.tasks[0]?.id).toBe('t_live_1');
    expect(board.provenance.source).toBe('dashboard-api');
    expect(board.provenance.freshness).toBe('live');
  });

  it('applies websocket events over the current board without synthesizing secrets or duplicate tasks', () => {
    boardStore.applyBoardRaw(sampleBoard);

    const events = boardStore.applyWsMessageRaw({
      cursor: 5,
      events: [
        {
          id: 5,
          task_id: 't_live_1',
          kind: 'started',
          created_at: 1705318200,
          payload: {
            task: {
              id: 't_live_1',
              title: 'Wire backbone',
              status: 'running',
              assignee: 'cloud',
              created_at: 1705314600,
              started_at: 1705318200,
            },
          },
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(boardStore.board.value?.latestEventId).toBe(5);
    expect(boardStore.board.value?.columns.find((column) => column.name === 'todo')?.tasks).toHaveLength(0);
    expect(boardStore.board.value?.columns.find((column) => column.name === 'running')?.tasks[0]?.id).toBe('t_live_1');
  });

  it('stores profile roster and active workers from runtime surfaces', () => {
    boardStore.applyProfilesRaw({ profiles: [{ name: 'cloud', model: 'test-model', provider: 'local', skill_count: 3 }] });
    boardStore.applyActiveWorkersRaw({ workers: [{ task_id: 't_live_1', profile: 'cloud', worker_pid: 1234 }] });

    expect(boardStore.profiles.value?.[0]).toMatchObject({ name: 'cloud', modelSummary: 'test-model' });
    expect(boardStore.getActiveWorkers()[0]).toMatchObject({ taskId: 't_live_1', assignee: 'cloud', pid: 1234 });
  });
});

describe('HermesDashboardClient', () => {
  it('sends session-token auth internally but returns presence-only AuthSession', async () => {
    const seenHeaders: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      seenHeaders.push(headers.get('X-Hermes-Session-Token') ?? '');
      return new Response(JSON.stringify(sampleBoard), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new HermesDashboardClient({
      baseUrl: 'http://localhost:9119',
      tokenProvider,
      fetchImpl,
    });

    const session = await client.validateSession();

    expect(seenHeaders[0]).toBe('secret-token-value');
    expect(session).toMatchObject({ status: 'authenticated', hasToken: true, dashboardUrl: 'http://localhost:9119' });
    expect(JSON.stringify(session)).not.toContain('secret-token-value');
  });

  it('reports 401 probes as unauthorized source health', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 });
    const client = new HermesDashboardClient({
      baseUrl: 'http://localhost:9119',
      tokenProvider,
      fetchImpl,
    });

    const health = await client.probeSource('kanban-rest');

    expect(health.state).toBe('unauthorized');
    expect(health.error).toBe('Unauthorized');
  });

  it('builds authenticated Kanban websocket URLs without storing token in shared state', () => {
    const client = new HermesDashboardClient({
      baseUrl: 'http://localhost:9119',
      tokenProvider,
      fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
    });

    const url = client.createKanbanEventsUrl(42);

    expect(url).toBe('ws://localhost:9119/api/plugins/kanban/events?token=secret-token-value&since_event_id=42');
    expect(JSON.stringify(boardStore.snapshot)).not.toContain('secret-token-value');
  });
});
