import { describe, expect, it, vi } from 'vitest';
import type { HermesDashboardClient } from '@/services/hermes/dashboardClient';
import {
  HermesProjectControlAdapter,
  normalizeProjectControlComments,
  normalizeProjectControlLog,
  normalizeProjectControlRuns,
} from '@/services/hermes/projectControlAdapter';
import type { KanbanTaskCard } from '@/types/board';

function makeTask(overrides: Partial<KanbanTaskCard> = {}): KanbanTaskCard {
  return {
    id: 'smc-phase8-kanban-control',
    title: 'Phase 7 - kanban and project control',
    body: 'Show who is working on what.',
    assignee: 'sora',
    status: 'running',
    priority: 0,
    createdBy: 'sora',
    createdAt: '2026-06-21T12:00:00.000Z',
    startedAt: null,
    completedAt: null,
    workspaceKind: 'scratch',
    workspacePath: null,
    tenant: 'Sora-MissionControl',
    branchName: null,
    result: null,
    idempotencyKey: null,
    consecutiveFailures: 0,
    workerPid: null,
    lastFailureError: null,
    maxRuntimeSeconds: null,
    lastHeartbeatAt: null,
    currentRunId: '96',
    workflowTemplateId: null,
    currentStepKey: null,
    skills: [],
    modelOverride: null,
    maxRetries: null,
    goalMode: false,
    goalMaxTurns: null,
    sessionId: null,
    age: 90,
    latestSummary: null,
    linkCounts: { parents: 0, children: 0 },
    commentCount: 2,
    progress: null,
    diagnostics: null,
    warnings: [],
    ...overrides,
  };
}

describe('projectControlAdapter normalization', () => {
  it('normalizes live task-detail comments with millisecond timestamps', () => {
    const result = normalizeProjectControlComments({
      comments: [
        {
          id: 98,
          task_id: 'smc-phase8-kanban-control',
          author: 'sora',
          body: 'Future phase, not blocked and not currently urgent.',
          created_at: 1781993462665,
        },
      ],
    });

    expect(result.availability).toBe('available');
    expect(result.value!).toHaveLength(1);
    expect(result.value![0]).toEqual({
      id: '98',
      author: 'sora',
      body: 'Future phase, not blocked and not currently urgent.',
      createdAt: '2026-06-20T22:11:02.665Z',
    });
  });

  it('normalizes task runs from task detail plus nested run lookup payloads', () => {
    const result = normalizeProjectControlRuns(
      {
        runs: [
          {
            id: 96,
            task_id: 'smc-phase8-kanban-control',
            profile: 'sora',
            status: 'running',
            worker_pid: null,
            last_heartbeat_at: null,
            started_at: 1782094003,
            ended_at: null,
            outcome: null,
            summary: null,
            error: null,
          },
        ],
      },
      {
        run: {
          id: 96,
          task_id: 'smc-phase8-kanban-control',
          profile: 'sora',
          status: 'running',
          worker_pid: null,
          last_heartbeat_at: null,
          started_at: 1782094003,
          ended_at: null,
          outcome: null,
          summary: null,
          error: null,
        },
      },
      makeTask(),
    );

    expect(result.availability).toBe('available');
    expect(result.value!).toHaveLength(1);
    expect(result.value![0]).toMatchObject({
      id: '96',
      profile: 'sora',
      status: 'running',
      startedAt: '2026-06-22T02:06:43.000Z',
      completedAt: null,
      workerPid: null,
    });
  });

  it('normalizes live task log payloads that return content/path metadata', () => {
    const result = normalizeProjectControlLog({
      task_id: 'smc-phase8-kanban-control',
      path: '/home/wliob/.hermes/kanban/logs/smc-phase8-kanban-control.log',
      exists: true,
      size_bytes: 48,
      content: 'line one\nline two\n',
      truncated: false,
    });

    expect(result.availability).toBe('available');
    expect(result.value).toMatchObject({
      lines: ['line one', 'line two'],
      truncated: false,
      path: '/home/wliob/.hermes/kanban/logs/smc-phase8-kanban-control.log',
      exists: true,
      sizeBytes: 48,
    });
  });
});

describe('HermesProjectControlAdapter', () => {
  it('reads comments, runs, and logs through the verified kanban endpoints', async () => {
    const task = makeTask();
    const client = {
      fetchKanbanTaskDetail: vi.fn().mockResolvedValue({
        comments: [
          { id: 13, author: 'auto-decomposer', body: 'Decomposed into child tasks.', created_at: 1781842627 },
        ],
        runs: [
          { id: 96, profile: 'sora', status: 'running', started_at: 1782094003, ended_at: null, worker_pid: null },
        ],
      }),
      fetchKanbanTaskLog: vi.fn().mockResolvedValue({
        task_id: 'smc-phase8-kanban-control',
        path: '/tmp/smc-phase8-kanban-control.log',
        exists: false,
        size_bytes: 0,
        content: '',
        truncated: false,
      }),
      fetchKanbanRun: vi.fn().mockResolvedValue({
        run: { id: 96, profile: 'sora', status: 'running', started_at: 1782094003, ended_at: null, worker_pid: null },
      }),
    } as unknown as HermesDashboardClient;

    const adapter = new HermesProjectControlAdapter(client);
    const context = await adapter.readTaskContext(task);

    expect(client.fetchKanbanTaskDetail).toHaveBeenCalledWith('smc-phase8-kanban-control');
    expect(client.fetchKanbanTaskLog).toHaveBeenCalledWith('smc-phase8-kanban-control');
    expect(client.fetchKanbanRun).toHaveBeenCalledWith('96');
    expect(context.comments.availability).toBe('available');
    expect(context.runs.availability).toBe('available');
    expect(context.logs.value).toMatchObject({ path: '/tmp/smc-phase8-kanban-control.log', exists: false, sizeBytes: 0 });
  });

  it('routes mutations through the verified dashboard kanban endpoints', async () => {
    const postKanbanAction = vi.fn().mockResolvedValue({ ok: true, message: 'submitted' });
    const client = { postKanbanAction } as unknown as HermesDashboardClient;
    const adapter = new HermesProjectControlAdapter(client);

    await adapter.executeAction({ kind: 'dispatch', taskId: null, runId: null, confirm: true, reason: 'dispatch now' });
    await adapter.executeAction({ kind: 'decompose', taskId: 'task-1', runId: null, confirm: true, reason: 'decompose now' });
    await adapter.executeAction({ kind: 'reclaim', taskId: 'task-2', runId: null, confirm: true, reason: 'reclaim now' });
    await adapter.executeAction({ kind: 'terminate', taskId: 'task-3', runId: '96', confirm: true, reason: 'terminate now' });

    expect(postKanbanAction.mock.calls).toEqual([
      ['/api/plugins/kanban/dispatch', { confirm: true, reason: 'dispatch now' }],
      ['/api/plugins/kanban/tasks/task-1/decompose', { confirm: true, reason: 'decompose now' }],
      ['/api/plugins/kanban/tasks/task-2/reclaim', { confirm: true, reason: 'reclaim now' }],
      ['/api/plugins/kanban/runs/96/terminate', { confirm: true, reason: 'terminate now' }],
    ]);
  });
});
