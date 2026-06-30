import type { HermesDashboardClient } from '@/services/hermes/dashboardClient';
import type { KanbanTaskCard } from '@/types/board';
import type {
  ProjectControlComment,
  ProjectControlLogChunk,
  ProjectControlMutationAdapter,
  ProjectControlMutationRequest,
  ProjectControlMutationResult,
  ProjectControlReadAdapter,
  ProjectControlRunRecord,
  ProjectControlTaskContext,
} from '@/types/project-control';
import type { ProjectControlReadSection } from '@/types/project-control';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asBody(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toIso(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function extractTaskRecord(raw: unknown): Record<string, unknown> | null {
  const record = asRecord(raw);
  if (!record) return null;
  const nestedTask = asRecord(record.task);
  return nestedTask ?? record;
}

function section<T>(
  value: T,
  availability: ProjectControlReadSection<T>['availability'],
  note: string,
  confidence: ProjectControlReadSection<T>['provenance']['confidence'] = 'verified',
): ProjectControlReadSection<T> {
  return {
    value,
    availability,
    provenance: {
      source: 'dashboard-api',
      freshness: availability === 'available' ? 'live' : availability === 'unknown' ? 'stale' : 'missing',
      confidence,
      receivedAt: new Date().toISOString(),
      note,
    },
  };
}

function unavailable<T>(value: T, note: string): ProjectControlReadSection<T> {
  return section(value, 'unavailable', note, 'unknown');
}

function normalizeProjectControlDiagnostics(raw: unknown): ProjectControlReadSection<unknown> {
  const task = extractTaskRecord(raw);
  if (!task) return section(null, 'unknown', 'Task detail payload was not an object; diagnostics unavailable.', 'unknown');
  const diagnostics = task.diagnostics;
  if (Array.isArray(diagnostics) && diagnostics.length > 0) {
    return section(diagnostics, 'available', `${diagnostics.length} diagnostic record(s) loaded from task detail.`);
  }
  const record = asRecord(diagnostics);
  if (record && Object.keys(record).length > 0) {
    return section(record, 'available', 'Diagnostics loaded from task detail.');
  }
  return section(null, 'unknown', 'Task detail endpoint returned no diagnostics payload.');
}

function extractNestedArrays(raw: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const direct = asArray(raw[key]);
    if (direct.length > 0) return direct;
  }
  const task = asRecord(raw.task);
  if (task) {
    for (const key of keys) {
      const nested = asArray(task[key]);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

export function normalizeProjectControlComments(raw: unknown): ProjectControlReadSection<ProjectControlComment[]> {
  const record = asRecord(raw);
  if (!record) return unavailable([], 'Task detail payload was not an object; comments unavailable.');
  const rawComments = extractNestedArrays(record, ['comments', 'comment_records', 'thread']);
  if (rawComments.length === 0) {
    return section([], 'unknown', 'Task detail endpoint returned no comments array.');
  }

  const comments = rawComments
    .map((entry, index): ProjectControlComment | null => {
      const comment = asRecord(entry);
      if (!comment) return null;
      const body = asBody(comment.body ?? comment.text ?? comment.content ?? comment.comment);
      if (!body) return null;
      return {
        id: asString(comment.id ?? comment.comment_id) ?? `comment-${index}`,
        author: asString(comment.author ?? comment.created_by ?? comment.profile ?? comment.user),
        body,
        createdAt: toIso(comment.created_at ?? comment.createdAt ?? comment.timestamp),
      };
    })
    .filter((comment): comment is ProjectControlComment => comment !== null);

  return section(comments, 'available', `${comments.length} comment record(s) loaded from task detail.`);
}

function normalizeRun(value: unknown, fallbackId: string | null = null): ProjectControlRunRecord | null {
  const record = asRecord(value);
  const run = asRecord(record?.run) ?? record;
  if (!run) return null;
  const id = asString(run.id ?? run.run_id ?? run.current_run_id) ?? fallbackId;
  if (!id) return null;
  return {
    id,
    status: asString(run.status ?? run.state) ?? 'unknown',
    profile: asString(run.profile ?? run.assignee ?? run.worker ?? run.created_by),
    startedAt: toIso(run.started_at ?? run.startedAt ?? run.created_at ?? run.createdAt),
    completedAt: toIso(run.completed_at ?? run.completedAt ?? run.finished_at ?? run.finishedAt ?? run.ended_at ?? run.endedAt),
    workerPid: asNumber(run.worker_pid ?? run.pid),
    lastHeartbeatAt: toIso(run.last_heartbeat_at ?? run.lastHeartbeatAt),
    outcome: asString(run.outcome),
    summary: asString(run.summary),
    error: asString(run.error),
  };
}

export function normalizeProjectControlRuns(
  taskDetailRaw: unknown,
  runRaw: unknown,
  fallbackTask: KanbanTaskCard,
): ProjectControlReadSection<ProjectControlRunRecord[]> {
  const runs: ProjectControlRunRecord[] = [];
  const taskDetail = asRecord(taskDetailRaw);
  if (taskDetail) {
    for (const rawRun of extractNestedArrays(taskDetail, ['runs', 'run_records', 'executions'])) {
      const run = normalizeRun(rawRun);
      if (run) runs.push(run);
    }
  }
  const fetchedRun = normalizeRun(runRaw, fallbackTask.currentRunId);
  if (fetchedRun && !runs.some((run) => run.id === fetchedRun.id)) runs.unshift(fetchedRun);
  if (runs.length === 0 && fallbackTask.currentRunId) {
    runs.push({
      id: fallbackTask.currentRunId,
      status: fallbackTask.status === 'running' ? 'running' : 'unknown',
      profile: fallbackTask.assignee,
      startedAt: fallbackTask.startedAt,
      completedAt: fallbackTask.completedAt,
      workerPid: fallbackTask.workerPid,
      lastHeartbeatAt: fallbackTask.lastHeartbeatAt,
      outcome: null,
      summary: fallbackTask.latestSummary,
      error: fallbackTask.lastFailureError,
    });
    return section(runs, 'unknown', 'Run detail endpoint did not return records; current board run id is shown as fallback.', 'inferred');
  }
  if (runs.length === 0) return section([], 'unknown', 'No run records were present for this task.');
  return section(runs, 'available', `${runs.length} run record(s) loaded from task detail/run endpoint.`);
}

export function normalizeProjectControlLog(raw: unknown): ProjectControlReadSection<ProjectControlLogChunk> {
  if (raw == null) return section({ lines: [], truncated: false, path: null, exists: null, sizeBytes: null }, 'unknown', 'Task log endpoint returned no content.');
  if (typeof raw === 'string') {
    const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
    return section(
      { lines, truncated: lines.length > 300, path: null, exists: null, sizeBytes: null },
      lines.length > 0 ? 'available' : 'unknown',
      lines.length > 0 ? `${lines.length} log line(s) loaded.` : 'Task log endpoint returned empty text.',
    );
  }
  const record = asRecord(raw);
  if (!record) return unavailable({ lines: [], truncated: false, path: null, exists: null, sizeBytes: null }, 'Task log payload was not a supported shape.');
  const rawLines = asArray(record.lines ?? record.log_lines ?? record.logs);
  const text = asString(record.content ?? record.text ?? record.log ?? record.output);
  const lines = rawLines.length > 0 ? rawLines.map((line) => String(line)) : (text ? text.split(/\r?\n/).filter((line) => line.length > 0) : []);
  const truncated = Boolean(record.truncated) || lines.length > 300;
  return section(
    {
      lines,
      truncated,
      path: asString(record.path),
      exists: typeof record.exists === 'boolean' ? record.exists : null,
      sizeBytes: asNumber(record.size_bytes ?? record.sizeBytes),
    },
    lines.length > 0 || typeof record.exists === 'boolean' ? 'available' : 'unknown',
    lines.length > 0 ? `${lines.length} log line(s) loaded.` : 'Task log payload contained no lines.',
  );
}

export class HermesProjectControlAdapter implements ProjectControlReadAdapter, ProjectControlMutationAdapter {
  constructor(private readonly client: HermesDashboardClient) {}

  async readTaskContext(task: KanbanTaskCard): Promise<ProjectControlTaskContext> {
    const [detailResult, logResult, runResult] = await Promise.allSettled([
      this.client.fetchKanbanTaskDetail(task.id),
      this.client.fetchKanbanTaskLog(task.id),
      task.currentRunId ? this.client.fetchKanbanRun(task.currentRunId) : Promise.resolve(null),
    ]);

    const detailRaw = detailResult.status === 'fulfilled' ? detailResult.value : null;
    const logRaw = logResult.status === 'fulfilled' ? logResult.value : null;
    const runRaw = runResult.status === 'fulfilled' ? runResult.value : null;

    const diagnostics = detailResult.status === 'fulfilled'
      ? normalizeProjectControlDiagnostics(detailRaw)
      : section(null, 'unknown', detailResult.reason instanceof Error ? detailResult.reason.message : String(detailResult.reason), 'unknown');
    const comments = detailResult.status === 'fulfilled'
      ? normalizeProjectControlComments(detailRaw)
      : unavailable([], detailResult.reason instanceof Error ? detailResult.reason.message : String(detailResult.reason));
    const runs = detailResult.status === 'fulfilled' || runResult.status === 'fulfilled'
      ? normalizeProjectControlRuns(detailRaw, runRaw, task)
      : unavailable([], runResult.reason instanceof Error ? runResult.reason.message : String(runResult.reason));
    const logs = logResult.status === 'fulfilled'
      ? normalizeProjectControlLog(logRaw)
      : unavailable({ lines: [], truncated: false, path: null, exists: null, sizeBytes: null }, logResult.reason instanceof Error ? logResult.reason.message : String(logResult.reason));

    return { diagnostics, comments, runs, logs };
  }

  async executeAction(request: ProjectControlMutationRequest): Promise<ProjectControlMutationResult> {
    if (!request.confirm) throw new Error(`${request.kind} requires explicit confirmation.`);
    const body = { confirm: true, reason: request.reason ?? 'sora-mission-control-confirmed' };
    let path: string;
    switch (request.kind) {
      case 'dispatch':
        path = '/api/plugins/kanban/dispatch';
        break;
      case 'decompose':
        if (!request.taskId) throw new Error('decompose requires a task id.');
        path = `/api/plugins/kanban/tasks/${encodeURIComponent(request.taskId)}/decompose`;
        break;
      case 'reclaim':
        if (!request.taskId) throw new Error('reclaim requires a task id.');
        path = `/api/plugins/kanban/tasks/${encodeURIComponent(request.taskId)}/reclaim`;
        break;
      case 'terminate':
        if (!request.runId) throw new Error('terminate requires a run id.');
        path = `/api/plugins/kanban/runs/${encodeURIComponent(request.runId)}/terminate`;
        break;
      default:
        throw new Error(`Unsupported project-control action: ${request.kind satisfies never}`);
    }

    const raw = await this.client.postKanbanAction(path, body);
    const record = asRecord(raw);
    return {
      ok: true,
      status: asString(record?.status ?? record?.state) ?? 'submitted',
      message: asString(record?.message ?? record?.detail) ?? `${request.kind} submitted to verified Kanban API.`,
      raw: record ?? {},
      provenance: {
        source: 'dashboard-api',
        freshness: 'live',
        confidence: 'verified',
        receivedAt: new Date().toISOString(),
        note: `Mutation sent through ${path}.`,
      },
    };
  }
}
