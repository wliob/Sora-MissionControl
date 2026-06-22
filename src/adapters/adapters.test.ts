/**
 * Comprehensive test suite for the adapter layer.
 *
 * Covers:
 *   - helpers.ts: epoch conversion, status validation, safe defaults
 *   - boardAdapter.ts: task + board snapshot normalization
 *   - wsEventAdapter.ts: WS event normalization, batching, cursor
 *   - runtimeAdapter.ts: workers, profiles, board summaries
 *   - authAdapter.ts: session + credential normalization
 *
 * Invariant coverage:
 *   B1 — unknown status rejection (not coercion)
 *   B2 — 8 canonical columns always present
 *   B3 — adapters never synthesize new ids
 *   B4/B5 — epoch→ISO conversion, null stays null
 *   B6 — null arrays → [], progress 0..1, skills/warnings never null
 *   B9 — unknown event kinds pass through for forward-compat
 *   A1 — no secret values in auth output
 *   Determinism — same input → same output
 */

import { describe, it, expect } from 'vitest';
import {
  epochToIso,
  epochMsToIso,
  validateKanbanStatus,
  coerceWorkspaceKind,
  ensureArray,
  normalizeProgress,
  nullableString,
  nullableNumber,
  normalizeBoolean,
  mapEventKind,
  NormalizationError,
} from '@/adapters/helpers';
import {
  normalizeTask,
  normalizeBoardSnapshot,
  normalizeBoardSnapshotTracked,
} from '@/adapters/boardAdapter';
import {
  normalizeWsEvent,
  normalizeWsEventBatch,
  extractCursor,
} from '@/adapters/wsEventAdapter';
import {
  normalizeActiveWorker,
  normalizeActiveWorkers,
  normalizeProfile,
  normalizeProfiles as _normalizeProfiles,
  normalizeBoardSummary,
  normalizeBoards as _normalizeBoards,
  extractCurrentBoardSlug,
} from '@/adapters/runtimeAdapter';
import {
  deriveSessionStatus,
  normalizeAuthSession,
  authSessionFromAction,
  normalizeAuthSessionTracked,
  deriveCredentialPresence,
  normalizeCredential,
  normalizeCredentials,
} from '@/adapters/authAdapter';

// ─── Helpers ────────────────────────────────────────────────────────────

describe('helpers', () => {
  // B4/B5: epoch→ISO conversion
  describe('epochToIso', () => {
    it('converts epoch seconds to ISO 8601', () => {
      // 2024-01-15T10:30:00.000Z = epoch 1705314600
      const result = epochToIso(1705314600);
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('returns null for null input', () => {
      expect(epochToIso(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(epochToIso(undefined)).toBeNull();
    });

    it('returns null for 0 (invalid epoch)', () => {
      expect(epochToIso(0)).toBeNull();
    });

    it('returns null for NaN', () => {
      expect(epochToIso(NaN)).toBeNull();
    });

    it('returns null for Infinity', () => {
      expect(epochToIso(Infinity)).toBeNull();
    });
  });

  describe('epochMsToIso', () => {
    it('converts epoch milliseconds to ISO 8601', () => {
      const result = epochMsToIso(1705314600000);
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('returns null for null', () => {
      expect(epochMsToIso(null)).toBeNull();
    });
  });

  // B1: unknown status rejection
  describe('validateKanbanStatus', () => {
    it('accepts valid statuses', () => {
      const validStatuses = ['triage', 'todo', 'scheduled', 'ready', 'running', 'blocked', 'review', 'done'];
      for (const s of validStatuses) {
        expect(validateKanbanStatus(s)).toBe(s);
      }
    });

    it('rejects unknown status with NormalizationError', () => {
      expect(() => validateKanbanStatus('unknown')).toThrow(NormalizationError);
      expect(() => validateKanbanStatus('in_progress')).toThrow(NormalizationError);
      expect(() => validateKanbanStatus('')).toThrow(NormalizationError);
    });

    it('error has correct field name', () => {
      try {
        validateKanbanStatus('bogus');
      } catch (err) {
        expect(err).toBeInstanceOf(NormalizationError);
        expect((err as NormalizationError).field).toBe('status');
      }
    });
  });

  describe('coerceWorkspaceKind', () => {
    it('passes through valid values', () => {
      expect(coerceWorkspaceKind('scratch')).toBe('scratch');
      expect(coerceWorkspaceKind('dir')).toBe('dir');
      expect(coerceWorkspaceKind('worktree')).toBe('worktree');
    });

    it('defaults to scratch for unknown values', () => {
      expect(coerceWorkspaceKind('container')).toBe('scratch');
      expect(coerceWorkspaceKind(null)).toBe('scratch');
      expect(coerceWorkspaceKind(undefined)).toBe('scratch');
    });
  });

  // B6: null arrays → []
  describe('ensureArray', () => {
    it('returns the array for valid arrays', () => {
      expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('returns empty array for null', () => {
      expect(ensureArray(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(ensureArray(undefined)).toEqual([]);
    });

    it('returns empty array for non-array', () => {
      expect(ensureArray('string')).toEqual([]);
    });
  });

  // B6: progress 0..1
  describe('normalizeProgress', () => {
    it('clamps to 0..1', () => {
      expect(normalizeProgress(0.5)).toBe(0.5);
      expect(normalizeProgress(-1)).toBe(0);
      expect(normalizeProgress(2)).toBe(1);
    });

    it('returns null for non-numbers', () => {
      expect(normalizeProgress(null)).toBeNull();
      expect(normalizeProgress('half')).toBeNull();
    });
  });

  describe('nullableString', () => {
    it('returns the string for non-empty', () => {
      expect(nullableString('hello')).toBe('hello');
    });

    it('returns null for empty string', () => {
      expect(nullableString('')).toBeNull();
    });

    it('returns null for non-strings', () => {
      expect(nullableString(null)).toBeNull();
      expect(nullableString(123)).toBeNull();
    });
  });

  describe('nullableNumber', () => {
    it('returns the number for finite values', () => {
      expect(nullableNumber(42)).toBe(42);
    });

    it('returns null for non-finite', () => {
      expect(nullableNumber(Infinity)).toBeNull();
      expect(nullableNumber(NaN)).toBeNull();
    });

    it('returns null for non-numbers', () => {
      expect(nullableNumber('42')).toBeNull();
    });
  });

  describe('normalizeBoolean', () => {
    it('returns the boolean for booleans', () => {
      expect(normalizeBoolean(true)).toBe(true);
      expect(normalizeBoolean(false)).toBe(false);
    });

    it('returns default for non-booleans', () => {
      expect(normalizeBoolean(null)).toBe(false);
      expect(normalizeBoolean(null, true)).toBe(true);
    });
  });

  // B9: unknown event kinds pass through
  describe('mapEventKind', () => {
    it('maps known short kinds to dot-namespaced types', () => {
      expect(mapEventKind('created')).toBe('task.created');
      expect(mapEventKind('claimed')).toBe('task.claimed');
      expect(mapEventKind('blocked')).toBe('task.blocked');
      expect(mapEventKind('unblocked')).toBe('task.unblocked');
      expect(mapEventKind('completed')).toBe('task.completed');
      expect(mapEventKind('archived')).toBe('task.archived');
    });

    it('passes unknown kinds through for forward-compat', () => {
      expect(mapEventKind('future_event')).toBe('future_event');
    });

    it('returns "unknown" for null/undefined', () => {
      expect(mapEventKind(null)).toBe('unknown');
      expect(mapEventKind(undefined)).toBe('unknown');
    });
  });
});

// ─── Board Adapter ──────────────────────────────────────────────────────

describe('boardAdapter', () => {
  const sampleRawTask = {
    id: 't_abc123',
    title: 'Build adapter layer',
    body: 'Normalize raw API data',
    assignee: 'biscuit',
    status: 'running',
    priority: 5,
    created_by: 'sora',
    created_at: 1705314600,
    started_at: 1705318200,
    completed_at: null,
    workspace_kind: 'worktree',
    workspace_path: '/tmp/task-abc',
    tenant: 'default',
    branch_name: 'feature/adapters',
    skills: ['typescript', 'testing'],
    warnings: null,
    progress: { done: 3, total: 7 },
  };

  describe('normalizeTask', () => {
    it('normalizes a full task correctly', () => {
      const task = normalizeTask(sampleRawTask);

      expect(task.id).toBe('t_abc123');
      expect(task.title).toBe('Build adapter layer');
      expect(task.assignee).toBe('biscuit');
      expect(task.status).toBe('running');
      expect(task.priority).toBe(5);
      expect(task.createdBy).toBe('sora');
      expect(task.createdAt).toBe('2024-01-15T10:30:00.000Z');
      expect(task.startedAt).toBe('2024-01-15T11:30:00.000Z');
      expect(task.completedAt).toBeNull();
      expect(task.workspaceKind).toBe('worktree');
      expect(task.workspacePath).toBe('/tmp/task-abc');
      expect(task.tenant).toBe('default');
      expect(task.branchName).toBe('feature/adapters');
      expect(task.skills).toEqual(['typescript', 'testing']);
      // B6: warnings never null
      expect(task.warnings).toEqual([]);
      // Progress computed from { done, total }
      expect(task.progress).toBeCloseTo(3 / 7);
    });

    // B3: adapters never synthesize ids
    it('throws NormalizationError when id is missing', () => {
      expect(() => normalizeTask({ status: 'todo' })).toThrow(NormalizationError);
      try {
        normalizeTask({ status: 'todo' });
      } catch (err) {
        expect((err as NormalizationError).field).toBe('id');
      }
    });

    // B1: unknown status rejection
    it('throws NormalizationError for unknown status', () => {
      expect(() => normalizeTask({ id: 't_1', status: 'in_progress' })).toThrow(NormalizationError);
    });

    it('applies safe defaults for missing optional fields', () => {
      const task = normalizeTask({ id: 't_min', status: 'todo' });

      expect(task.title).toBe('');
      expect(task.body).toBe('');
      expect(task.assignee).toBeNull();
      expect(task.priority).toBe(0);
      expect(task.createdBy).toBeNull();
      expect(task.createdAt).toBeNull();
      expect(task.workspaceKind).toBe('scratch');
      expect(task.skills).toEqual([]);
      expect(task.warnings).toEqual([]);
      expect(task.consecutiveFailures).toBe(0);
      expect(task.commentCount).toBe(0);
      expect(task.goalMode).toBe(false);
    });

    // Determinism
    it('is deterministic: same input → same output', () => {
      const task1 = normalizeTask(sampleRawTask);
      const task2 = normalizeTask(sampleRawTask);
      expect(task1).toEqual(task2);
    });

    it('handles progress with total=0 (division guard)', () => {
      const task = normalizeTask({ id: 't_1', status: 'todo', progress: { done: 0, total: 0 } });
      expect(task.progress).toBeNull();
    });

    it('handles age as a number', () => {
      const task = normalizeTask({ id: 't_1', status: 'todo', age: 3600 });
      expect(task.age).toBe(3600);
    });

    it('handles age as an object with created_age_seconds', () => {
      const task = normalizeTask({ id: 't_1', status: 'todo', age: { created_age_seconds: 7200 } });
      expect(task.age).toBe(7200);
    });
  });

  describe('normalizeBoardSnapshot', () => {
    const sampleBoard = {
      columns: [
        { name: 'todo', tasks: [sampleRawTask] },
        { name: 'running', tasks: [] },
        { name: 'done', tasks: [{ id: 't_done1', status: 'done', title: 'Done task' }] },
      ],
      tenants: ['default'],
      assignees: ['biscuit', 'sora'],
      latest_event_id: 42,
      now: 1705314600,
    };

    // B2: 8 canonical columns always present
    it('always produces 8 columns even when some are missing from raw', () => {
      const { snapshot } = normalizeBoardSnapshot(sampleBoard);

      expect(snapshot.columns).toHaveLength(8);
      const columnNames = snapshot.columns.map((c) => c.name);
      expect(columnNames).toEqual([
        'triage', 'todo', 'scheduled', 'ready', 'running',
        'blocked', 'review', 'done',
      ]);
    });

    it('fills missing columns with empty task arrays', () => {
      const { snapshot } = normalizeBoardSnapshot(sampleBoard);

      const triage = snapshot.columns.find((c) => c.name === 'triage');
      expect(triage?.tasks).toEqual([]);

      const ready = snapshot.columns.find((c) => c.name === 'ready');
      expect(ready?.tasks).toEqual([]);
    });

    it('normalizes tasks within columns', () => {
      const { snapshot } = normalizeBoardSnapshot(sampleBoard);

      const todoCol = snapshot.columns.find((c) => c.name === 'todo');
      expect(todoCol?.tasks).toHaveLength(1);
      expect(todoCol?.tasks[0].id).toBe('t_abc123');
    });

    it('converts server now to ISO 8601', () => {
      const { snapshot } = normalizeBoardSnapshot(sampleBoard);
      expect(snapshot.serverNow).toBe('2024-01-15T10:30:00.000Z');
    });

    it('collects task errors without failing the whole board', () => {
      const board = {
        columns: [
          { name: 'todo', tasks: [
            { id: 't_good', status: 'todo' },
            { status: 'bogus' }, // no id, bogus status
          ]},
        ],
      };
      const { snapshot, taskErrors } = normalizeBoardSnapshot(board);

      // The good task should be in the column
      const todoCol = snapshot.columns.find((c) => c.name === 'todo');
      expect(todoCol?.tasks).toHaveLength(1);
      expect(todoCol?.tasks[0].id).toBe('t_good');

      // The bad task should be in errors
      expect(taskErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('skips columns with unknown statuses', () => {
      const board = {
        columns: [
          { name: 'in_progress', tasks: [{ id: 't_1', status: 'in_progress' }] },
        ],
      };
      const { snapshot } = normalizeBoardSnapshot(board);
      // No in_progress column — all 8 are canonical
      const ipCol = snapshot.columns.find((c) => c.name === ('in_progress' as string));
      expect(ipCol).toBeUndefined();
    });

    it('handles empty raw response', () => {
      const { snapshot } = normalizeBoardSnapshot({});
      expect(snapshot.columns).toHaveLength(8);
      expect(snapshot.assignees).toEqual([]);
      expect(snapshot.tenants).toEqual([]);
    });
  });

  describe('normalizeBoardSnapshotTracked', () => {
    it('wraps snapshot in Tracked with provenance', () => {
      const { board } = normalizeBoardSnapshotTracked(
        { columns: [] },
        'dashboard-api',
      );

      expect(board.value!.columns).toHaveLength(8);
      expect(board.provenance.source).toBe('dashboard-api');
      expect(board.provenance.confidence).toBe('verified');
    });

    it('sets freshness to stale when task errors exist', () => {
      const { board } = normalizeBoardSnapshotTracked(
        { columns: [{ name: 'todo', tasks: [{ status: 'bogus' }] }] },
        'dashboard-api',
      );

      expect(board.provenance.freshness).toBe('stale');
    });
  });
});

// ─── WS Event Adapter ──────────────────────────────────────────────────

describe('wsEventAdapter', () => {
  const sampleEvent = {
    id: 10,
    task_id: 't_abc123',
    run_id: 5,
    kind: 'claimed',
    payload: null,
    created_at: 1705314600,
  };

  describe('normalizeWsEvent', () => {
    it('normalizes a basic event', () => {
      const event = normalizeWsEvent(sampleEvent);

      expect(event.eventId).toBe(10);
      expect(event.type).toBe('task.claimed');
      expect(event.task.id).toBe('t_abc123');
      expect(event.timestamp).toBe('2024-01-15T10:30:00.000Z');
    });

    it('uses placeholder task when no payload task', () => {
      const event = normalizeWsEvent(sampleEvent);

      // Placeholder: status is 'todo', title is ''
      expect(event.task.status).toBe('todo');
      expect(event.task.title).toBe('');
    });

    it('uses taskResolver to resolve full task', () => {
      const resolver = (taskId: string) => ({
        id: taskId,
        title: 'Resolved task',
        body: '',
        assignee: 'biscuit',
        status: 'running' as const,
        priority: 0,
        createdBy: null,
        createdAt: null,
        startedAt: null,
        completedAt: null,
        workspaceKind: 'scratch' as const,
        workspacePath: null,
        tenant: null,
        branchName: null,
        result: null,
        idempotencyKey: null,
        consecutiveFailures: 0,
        workerPid: null,
        lastFailureError: null,
        maxRuntimeSeconds: null,
        lastHeartbeatAt: null,
        currentRunId: null,
        workflowTemplateId: null,
        currentStepKey: null,
        skills: [],
        modelOverride: null,
        maxRetries: null,
        goalMode: false,
        goalMaxTurns: null,
        sessionId: null,
        age: null,
        latestSummary: null,
        linkCounts: null,
        commentCount: 0,
        progress: null,
        diagnostics: null,
        warnings: [],
      });

      const event = normalizeWsEvent(sampleEvent, resolver);
      expect(event.task.title).toBe('Resolved task');
      expect(event.task.status).toBe('running');
    });

    it('normalizes event with payload containing full task', () => {
      const eventWithTask = {
        ...sampleEvent,
        kind: 'completed',
        payload: {
          task: {
            id: 't_abc123',
            title: 'Completed task',
            status: 'done',
          },
        },
      };

      const event = normalizeWsEvent(eventWithTask);
      expect(event.task.id).toBe('t_abc123');
      expect(event.task.title).toBe('Completed task');
      expect(event.task.status).toBe('done');
    });

    // B9: unknown kinds pass through
    it('passes through unknown event kinds', () => {
      const unknownEvent = { ...sampleEvent, kind: 'future_hook' };
      const event = normalizeWsEvent(unknownEvent);
      expect(event.type).toBe('future_hook');
    });

    // B3: missing task_id → error
    it('throws NormalizationError when task_id is missing', () => {
      expect(() => normalizeWsEvent({ id: 1, kind: 'created', created_at: 0 }))
        .toThrow(NormalizationError);
    });

    it('extracts reassignment fields from payload', () => {
      const reassignedEvent = {
        ...sampleEvent,
        kind: 'assigned',
        payload: {
          previous_assignee: 'sora',
          new_assignee: 'biscuit',
        },
      };

      const event = normalizeWsEvent(reassignedEvent);
      expect(event.previousAssignee).toBe('sora');
      expect(event.newAssignee).toBe('biscuit');
    });
  });

  describe('normalizeWsEventBatch', () => {
    it('normalizes a batch of events', () => {
      const batch = {
        events: [
          { id: 1, task_id: 't_1', kind: 'created', created_at: 100 },
          { id: 2, task_id: 't_2', kind: 'blocked', created_at: 200 },
        ],
        cursor: 2,
      };

      const { events, errors } = normalizeWsEventBatch(batch);
      expect(events).toHaveLength(2);
      expect(errors).toHaveLength(0);
      expect(events[0].type).toBe('task.created');
      expect(events[1].type).toBe('task.blocked');
    });

    it('collects errors for bad events without failing the batch', () => {
      const batch = {
        events: [
          { id: 1, task_id: 't_1', kind: 'created', created_at: 100 },
          { id: 2, kind: 'bad' }, // missing task_id
        ],
      };

      const { events, errors } = normalizeWsEventBatch(batch);
      expect(events).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].eventId).toBe(2);
    });

    it('handles empty events array', () => {
      const { events, errors } = normalizeWsEventBatch({ events: [] });
      expect(events).toEqual([]);
      expect(errors).toEqual([]);
    });
  });

  describe('extractCursor', () => {
    it('extracts cursor from message', () => {
      expect(extractCursor({ cursor: 42 })).toBe(42);
    });

    it('returns null for missing cursor', () => {
      expect(extractCursor({})).toBeNull();
    });
  });
});

// ─── Runtime Adapter ────────────────────────────────────────────────────

describe('runtimeAdapter', () => {
  describe('normalizeActiveWorker', () => {
    it('normalizes a worker with all fields', () => {
      const worker = normalizeActiveWorker({
        task_id: 't_1',
        profile: 'biscuit',
        worker_pid: 12345,
        run_id: 7,
        started_at: 1705314600,
        last_heartbeat_at: 1705318200,
      });

      expect(worker.taskId).toBe('t_1');
      expect(worker.assignee).toBe('biscuit');
      expect(worker.pid).toBe(12345);
      expect(worker.runId).toBe('7');
      expect(worker.startedAt).toBe('2024-01-15T10:30:00.000Z');
      expect(worker.lastHeartbeatAt).toBe('2024-01-15T11:30:00.000Z');
    });

    it('applies safe defaults for missing fields', () => {
      const worker = normalizeActiveWorker({});
      expect(worker.taskId).toBe('');
      expect(worker.assignee).toBe('');
      expect(worker.pid).toBe(0);
      expect(worker.runId).toBeNull();
    });
  });

  describe('normalizeActiveWorkers', () => {
    it('wraps workers in Tracked with provenance', () => {
      const result = normalizeActiveWorkers({
        workers: [{ task_id: 't_1', profile: 'biscuit' }],
        count: 1,
      });

      expect(result.value).toHaveLength(1);
      expect(result.provenance.source).toBe('dashboard-api');
      expect(result.provenance.confidence).toBe('verified');
    });
  });

  describe('normalizeProfile', () => {
    it('normalizes a profile with all fields', () => {
      const profile = normalizeProfile({
        name: 'biscuit',
        description: 'Automation & Coding Lead',
        provider: 'openrouter',
        model: 'claude-sonnet-4',
        skill_count: 12,
      });

      expect(profile.name).toBe('biscuit');
      expect(profile.description).toBe('Automation & Coding Lead');
      expect(profile.gatewayStatus).toBe('openrouter');
      expect(profile.modelSummary).toBe('claude-sonnet-4');
      expect(profile.skillCount).toBe(12);
    });

    it('handles missing optional fields', () => {
      const profile = normalizeProfile({ name: 'sora' });
      expect(profile.description).toBeNull();
      expect(profile.gatewayStatus).toBeNull();
      expect(profile.modelSummary).toBeNull();
      expect(profile.skillCount).toBe(-1);
    });
  });

  describe('normalizeBoardSummary', () => {
    it('normalizes a board summary', () => {
      const summary = normalizeBoardSummary({
        slug: 'default',
        name: 'Main Board',
        is_current: true,
        total: 42,
      });

      expect(summary.slug).toBe('default');
      expect(summary.name).toBe('Main Board');
      expect(summary.isActive).toBe(true);
      expect(summary.taskCount).toBe(42);
    });

    it('falls back to slug for name if name is missing', () => {
      const summary = normalizeBoardSummary({ slug: 'dev' });
      expect(summary.name).toBe('dev');
    });

    it('computes taskCount from counts dict when total is missing', () => {
      const summary = normalizeBoardSummary({
        slug: 'default',
        counts: { todo: 5, running: 3, done: 10 },
      });
      expect(summary.taskCount).toBe(18);
    });

    it('defaults isActive to false', () => {
      const summary = normalizeBoardSummary({ slug: 'other' });
      expect(summary.isActive).toBe(false);
    });
  });

  describe('extractCurrentBoardSlug', () => {
    it('extracts the current board slug', () => {
      expect(extractCurrentBoardSlug({ current: 'default' })).toBe('default');
    });

    it('returns null when no current is set', () => {
      expect(extractCurrentBoardSlug({})).toBeNull();
    });
  });
});

// ─── Auth Adapter ───────────────────────────────────────────────────────

describe('authAdapter', () => {
  describe('deriveSessionStatus', () => {
    it('returns authenticated when authenticated=true', () => {
      const { status } = deriveSessionStatus({ authenticated: true });
      expect(status).toBe('authenticated');
    });

    it('returns unauthenticated when has_token but not authenticated', () => {
      const { status, invalidationReason } = deriveSessionStatus({
        authenticated: false,
        has_token: true,
      });
      expect(status).toBe('unauthenticated');
      expect(invalidationReason).toBe('token_rejected');
    });

    it('returns idle when no token and not authenticated', () => {
      const { status } = deriveSessionStatus({ authenticated: false });
      expect(status).toBe('idle');
    });

    it('returns auth_error when error is present', () => {
      const { status } = deriveSessionStatus({ error: 'Connection refused' });
      expect(status).toBe('auth_error');
    });

    it('maps reason strings to invalidation reasons', () => {
      const { invalidationReason } = deriveSessionStatus({
        error: 'fail',
        reason: 'token_expired',
      });
      expect(invalidationReason).toBe('token_expired');
    });
  });

  describe('normalizeAuthSession', () => {
    it('normalizes a full session', () => {
      const session = normalizeAuthSession({
        authenticated: true,
        has_token: true,
        dashboard_url: 'http://localhost:8644',
        validated_at: 1705314600,
        expires_at: 1705401000,
      });

      expect(session.status).toBe('authenticated');
      expect(session.hasToken).toBe(true);
      expect(session.dashboardUrl).toBe('http://localhost:8644');
      expect(session.validatedAt).toBe('2024-01-15T10:30:00.000Z');
      expect(session.expiresAt).toBe('2024-01-16T10:30:00.000Z');
    });

    // A1: no secret values
    it('never includes token value — only hasToken boolean', () => {
      const session = normalizeAuthSession({ authenticated: true, has_token: true });
      const keys = Object.keys(session);
      expect(keys).not.toContain('token');
      expect(keys).not.toContain('apiKey');
      expect(keys).not.toContain('secret');
      expect(session.hasToken).toBe(true);
    });

    it('applies defaults for missing fields', () => {
      const session = normalizeAuthSession({});
      expect(session.status).toBe('idle');
      expect(session.hasToken).toBe(false);
      expect(session.dashboardUrl).toBe('');
      expect(session.validatedAt).toBeNull();
      expect(session.expiresAt).toBeNull();
    });
  });

  describe('authSessionFromAction', () => {
    it('creates a session from user action', () => {
      const session = authSessionFromAction(
        'unauthenticated',
        false,
        'http://localhost:8644',
        'token_cleared',
      );

      expect(session.status).toBe('unauthenticated');
      expect(session.hasToken).toBe(false);
      expect(session.dashboardUrl).toBe('http://localhost:8644');
      expect(session.invalidationReason).toBe('token_cleared');
    });
  });

  describe('normalizeAuthSessionTracked', () => {
    it('wraps session in Tracked with provenance', () => {
      const tracked = normalizeAuthSessionTracked({
        authenticated: true,
        has_token: true,
      });

      expect(tracked.value!.status).toBe('authenticated');
      expect(tracked.provenance.source).toBe('dashboard-api');
      expect(tracked.provenance.confidence).toBe('verified');
    });
  });

  describe('deriveCredentialPresence', () => {
    it('returns configured for valid credential', () => {
      expect(deriveCredentialPresence({ has_key: true, valid: true })).toBe('configured');
    });

    it('returns error for invalid credential', () => {
      expect(deriveCredentialPresence({ has_key: true, valid: false })).toBe('error');
    });

    it('returns missing for no credential', () => {
      expect(deriveCredentialPresence({ has_key: false })).toBe('missing');
    });

    it('returns unknown when has_key is undefined', () => {
      expect(deriveCredentialPresence({})).toBe('unknown');
    });
  });

  describe('normalizeCredential', () => {
    it('normalizes a credential entry', () => {
      const cred = normalizeCredential({
        provider: 'anthropic',
        has_key: true,
        valid: true,
        label: 'Anthropic (claude-sonnet-4)',
        checked_at: 1705314600,
      });

      expect(cred.provider).toBe('anthropic');
      expect(cred.presence).toBe('configured');
      expect(cred.label).toBe('Anthropic (claude-sonnet-4)');
      expect(cred.checkedAt).toBe('2024-01-15T10:30:00.000Z');
    });

    // A1: never includes credential value
    it('never includes the key value', () => {
      const cred = normalizeCredential({ provider: 'openai', has_key: true, valid: true });
      const keys = Object.keys(cred);
      expect(keys).not.toContain('key');
      expect(keys).not.toContain('apiKey');
      expect(keys).not.toContain('secret');
    });

    it('includes error message only when presence is error', () => {
      const credError = normalizeCredential({
        provider: 'openrouter',
        has_key: true,
        valid: false,
        error: 'Invalid API key',
      });
      expect(credError.presence).toBe('error');
      expect(credError.error).toBe('Invalid API key');

      const credConfigured = normalizeCredential({
        provider: 'openrouter',
        has_key: true,
        valid: true,
        error: 'Some error',
      });
      expect(credConfigured.presence).toBe('configured');
      expect(credConfigured.error).toBeUndefined();
    });
  });

  describe('normalizeCredentials', () => {
    it('normalizes a credentials list', () => {
      const report = normalizeCredentials({
        credentials: [
          { provider: 'anthropic', has_key: true, valid: true },
          { provider: 'openai', has_key: false },
        ],
      });

      expect(report.value!).toHaveLength(2);
      expect(report.value![0].presence).toBe('configured');
      expect(report.value![1].presence).toBe('missing');
      expect(report.provenance.source).toBe('admin-cli');
    });
  });
});
