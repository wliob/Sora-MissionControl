import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardStoreSnapshot } from '@/state/boardStore';
import {
  _resetForTest,
  hasProjectControlReadAdapter,
  projectControlStore,
  setProjectControlReadAdapter,
} from '@/state/projectControlStore';
import type { ProjectControlReadAdapter } from '@/types/project-control';
import type { ConnectionStateValue } from '@/types/connection';
import { initialConnectionState } from '@/types/connection';
import type { KanbanBoardSnapshot, KanbanTaskCard, ProfileRosterEntry, ActiveWorker } from '@/types/board';
import { KANBAN_COLUMN_ORDER } from '@/types/board';
import { tracked } from '@/types/provenance';

function makeTask(overrides: Partial<KanbanTaskCard> = {}): KanbanTaskCard {
  return {
    id: 't_phase7_1',
    title: 'Read-only surface task',
    body: 'Investigate blocked queue',
    assignee: 'biscuit',
    status: 'blocked',
    priority: 5,
    createdBy: 'sora',
    createdAt: '2026-06-21T12:00:00Z',
    startedAt: null,
    completedAt: null,
    workspaceKind: 'scratch',
    workspacePath: null,
    tenant: null,
    branchName: null,
    result: null,
    idempotencyKey: null,
    consecutiveFailures: 1,
    workerPid: 4221,
    lastFailureError: 'Waiting for reviewed adapter contract',
    maxRuntimeSeconds: null,
    lastHeartbeatAt: '2026-06-21T12:05:00Z',
    currentRunId: 'run_phase7_1',
    workflowTemplateId: null,
    currentStepKey: null,
    skills: [],
    modelOverride: null,
    maxRetries: null,
    goalMode: false,
    goalMaxTurns: null,
    sessionId: null,
    age: 90,
    latestSummary: 'Pending clarification from Cloud',
    linkCounts: { parents: 0, children: 0 },
    commentCount: 0,
    progress: null,
    diagnostics: { blocker: 'adapter contract missing' },
    warnings: ['blocked'],
    ...overrides,
  };
}

function makeBoard(tasks: KanbanTaskCard[] = []): KanbanBoardSnapshot {
  const taskByStatus = new Map<string, KanbanTaskCard[]>();
  for (const task of tasks) {
    const current = taskByStatus.get(task.status) ?? [];
    current.push(task);
    taskByStatus.set(task.status, current);
  }

  return {
    columns: KANBAN_COLUMN_ORDER.map((status) => ({
      name: status,
      tasks: taskByStatus.get(status) ?? [],
    })),
    assignees: ['biscuit'],
    tenants: [],
    latestEventId: 41,
    serverNow: '2026-06-21T12:06:00Z',
  };
}

function makeBoardSnapshot(params?: {
  tasks?: KanbanTaskCard[];
  freshness?: 'live' | 'fresh' | 'stale' | 'missing';
  confidence?: 'verified' | 'inferred' | 'unverified' | 'placeholder' | 'unknown';
  profiles?: ProfileRosterEntry[];
  workers?: ActiveWorker[];
}): BoardStoreSnapshot {
  const tasks = params?.tasks ?? [];
  return {
    board: tracked(makeBoard(tasks), {
      source: 'dashboard-api',
      freshness: params?.freshness ?? 'live',
      confidence: params?.confidence ?? 'verified',
    }),
    events: tracked([], {
      source: 'kanban-ws',
      freshness: params?.freshness ?? 'live',
      confidence: params?.confidence ?? 'verified',
    }),
    profiles: tracked(params?.profiles ?? [{
      name: 'biscuit',
      description: 'Automation/Coding lead',
      gatewayStatus: 'openai',
      modelSummary: 'gpt-5.4',
      skillCount: 3,
    }], {
      source: 'dashboard-api',
      freshness: params?.freshness ?? 'live',
      confidence: params?.confidence ?? 'verified',
    }),
    activeWorkers: tracked(params?.workers ?? [{
      taskId: 't_phase7_1',
      assignee: 'biscuit',
      pid: 4221,
      runId: 'run_phase7_1',
      startedAt: '2026-06-21T12:00:00Z',
      lastHeartbeatAt: '2026-06-21T12:05:00Z',
    }], {
      source: 'dashboard-api',
      freshness: params?.freshness ?? 'live',
      confidence: params?.confidence ?? 'verified',
    }),
    normalizationErrors: [],
  };
}

function makeConnectionState(params?: {
  rest?: 'connected' | 'degraded' | 'offline' | 'unauthorized' | 'unknown';
  ws?: 'connected' | 'degraded' | 'offline' | 'unauthorized' | 'unknown';
  profile?: 'connected' | 'degraded' | 'offline' | 'unauthorized' | 'unknown';
  admin?: 'connected' | 'degraded' | 'offline' | 'unauthorized' | 'unknown';
  staleReason?: 'awaiting-first-snapshot' | 'reconnect-pending' | 'auth-required' | 'endpoint-unverified' | 'no-data-yet';
}): ConnectionStateValue {
  const value = initialConnectionState();
  value.sources['kanban-rest'] = {
    state: params?.rest ?? 'connected',
    lastOkAt: '2026-06-21T12:06:00Z',
    lastCheckedAt: '2026-06-21T12:06:00Z',
  };
  value.sources['kanban-ws'] = {
    state: params?.ws ?? 'connected',
    lastOkAt: '2026-06-21T12:06:00Z',
    lastCheckedAt: '2026-06-21T12:06:00Z',
  };
  value.sources['profile-cli'] = {
    state: params?.profile ?? 'connected',
    lastOkAt: '2026-06-21T12:06:00Z',
    lastCheckedAt: '2026-06-21T12:06:00Z',
  };
  value.sources['admin-cli'] = {
    state: params?.admin ?? 'connected',
    lastOkAt: '2026-06-21T12:06:00Z',
    lastCheckedAt: '2026-06-21T12:06:00Z',
  };
  value.sync['kanban-rest'] = {
    lastSyncAt: '2026-06-21T12:06:00Z',
    pendingEventCount: 0,
    ...(params?.staleReason ? { staleReason: params.staleReason } : {}),
  };
  value.sync['kanban-ws'] = {
    lastSyncAt: '2026-06-21T12:06:00Z',
    pendingEventCount: 0,
  };
  return tracked(value, {
    source: 'local-runtime',
    freshness: 'live',
    confidence: 'verified',
  });
}

beforeEach(() => {
  _resetForTest();
});

describe('projectControlStore', () => {
  it('starts unknown and adapterless without rendering a fake healthy state', () => {
    expect(hasProjectControlReadAdapter()).toBe(false);
    const state = projectControlStore.state;
    expect(state.snapshot.provenance.freshness).toBe('missing');
    expect(state.snapshot.provenance.confidence).toBe('unknown');
    expect(state.snapshot.value?.boardState).toBe('unknown');
    expect(state.snapshot.value?.metrics.totalTasks).toBeNull();
    expect(state.snapshot.value?.metrics.blockedTasks).toBeNull();
    expect(state.snapshot.value?.ownerRows).toHaveLength(0);
    expect(state.snapshot.value?.blockerRows).toHaveLength(0);
    expect(state.lastError).toBeNull();
  });

  it('marks offline kanban-rest as unavailable instead of reporting healthy empty counts', () => {
    projectControlStore.syncFromSources(
      makeBoardSnapshot({ tasks: [makeTask()] }),
      makeConnectionState({ rest: 'offline', ws: 'offline', staleReason: 'no-data-yet' }),
    );

    const snapshot = projectControlStore.state.snapshot;
    expect(snapshot.value?.boardState).toBe('unavailable');
    expect(snapshot.value?.metrics.totalTasks).toBeNull();
    expect(snapshot.value?.metrics.blockedTasks).toBeNull();
    expect(snapshot.value?.statusRows.every((row) => row.count === null)).toBe(true);
    expect(snapshot.value?.note?.toLowerCase()).toContain('unavailable');
  });

  it('keeps stale data visibly stale even when task counts are present', () => {
    projectControlStore.syncFromSources(
      makeBoardSnapshot({ tasks: [makeTask()], freshness: 'stale' }),
      makeConnectionState({ rest: 'connected', ws: 'degraded', staleReason: 'reconnect-pending' }),
    );

    const snapshot = projectControlStore.state.snapshot;
    expect(snapshot.value?.boardState).toBe('stale');
    expect(snapshot.value?.metrics.totalTasks).toBe(1);
    expect(snapshot.value?.metrics.blockedTasks).toBe(1);
    expect(snapshot.value?.blockerRows).toHaveLength(1);
    expect(snapshot.provenance.freshness).toBe('stale');
  });

  it('selects a task into a snapshot-only drawer shell when no read adapter is bound', async () => {
    projectControlStore.syncFromSources(
      makeBoardSnapshot({ tasks: [makeTask()] }),
      makeConnectionState(),
    );

    await projectControlStore.selectTask('t_phase7_1');

    const detail = projectControlStore.state.taskDetail.value;
    expect(detail?.task.id).toBe('t_phase7_1');
    expect(detail?.comments.availability).toBe('unavailable');
    expect(detail?.runs.availability).toBe('unavailable');
    expect(detail?.logs.availability).toBe('unavailable');
    expect(detail?.disabledActions.map((action) => action.kind)).toEqual([
      'dispatch',
      'decompose',
      'reclaim',
      'terminate',
    ]);
    expect(projectControlStore.state.lastError).toBeNull();
  });

  it('captures adapter read failures in lastError without inventing healthy detail sections', async () => {
    const adapter: ProjectControlReadAdapter = {
      readTaskContext: vi.fn().mockRejectedValue(new Error('read adapter unavailable')),
    };
    setProjectControlReadAdapter(adapter);
    projectControlStore.syncFromSources(
      makeBoardSnapshot({ tasks: [makeTask()] }),
      makeConnectionState(),
    );

    await projectControlStore.selectTask('t_phase7_1');

    expect(projectControlStore.state.lastError).toBe('read adapter unavailable');
    expect(projectControlStore.state.taskDetail.value?.comments.availability).toBe('unavailable');
    expect(projectControlStore.state.taskDetail.value?.runs.availability).toBe('unavailable');
    expect(projectControlStore.state.taskDetail.value?.logs.availability).toBe('unavailable');
  });

  it('exposes a plain read-only API with no browser db/filesystem/pid write methods', () => {
    const methodNames = Object.getOwnPropertyNames(projectControlStore).filter(
      (name) => typeof (projectControlStore as Record<string, unknown>)[name] === 'function',
    );

    const forbiddenPatterns = /sqlite|indexeddb|filesystem|fs|write|mkdir|unlink|chmod|dispatch|decompose|reclaim|terminate/i;
    for (const name of methodNames) {
      expect(name).not.toMatch(forbiddenPatterns);
    }

    const json = JSON.stringify(projectControlStore.state);
    const parsed = JSON.parse(json);
    expect(parsed.snapshot.provenance.freshness).toBe('missing');
    expect(parsed.lastError).toBeNull();
  });
});
