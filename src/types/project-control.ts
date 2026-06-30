import type { KanbanStatus, KanbanTaskCard } from './board';
import type { HealthSourceId, SourceHealth, SyncIndicator } from './connection';
import type { DataSource, Freshness, Confidence, Provenance, Tracked } from './provenance';

export type ProjectControlBoardState = 'live' | 'stale' | 'unknown' | 'unavailable';
export type ProjectControlSectionAvailability = 'available' | 'unavailable' | 'unknown';

export interface ProjectControlMetrics {
  totalTasks: number | null;
  runningTasks: number | null;
  blockedTasks: number | null;
  ownerCount: number | null;
  activeWorkerCount: number | null;
}

export interface ProjectControlStatusRow {
  status: KanbanStatus;
  count: number | null;
  primaryTaskId: string | null;
}

export interface ProjectControlOwnerRow {
  owner: string;
  total: number;
  running: number;
  blocked: number;
  primaryTaskId: string | null;
}

export interface ProjectControlBlockerRow {
  taskId: string;
  title: string;
  assignee: string | null;
  blockerSummary: string;
  workerPid: number | null;
  lastHeartbeatAt: string | null;
}

export interface ProjectControlSourceRow {
  sourceId: HealthSourceId;
  label: string;
  health: SourceHealth;
  sync: SyncIndicator;
}

export interface ProjectControlSnapshot {
  boardState: ProjectControlBoardState;
  metrics: ProjectControlMetrics;
  statusRows: ProjectControlStatusRow[];
  ownerRows: ProjectControlOwnerRow[];
  blockerRows: ProjectControlBlockerRow[];
  sourceRows: ProjectControlSourceRow[];
  note: string | null;
}

export interface ProjectControlComment {
  id: string;
  author: string | null;
  body: string;
  createdAt: string | null;
}

export interface ProjectControlRunRecord {
  id: string;
  status: string;
  profile: string | null;
  startedAt: string | null;
  completedAt: string | null;
  workerPid: number | null;
  lastHeartbeatAt: string | null;
  outcome: string | null;
  summary: string | null;
  error: string | null;
}

export interface ProjectControlLogChunk {
  lines: string[];
  truncated: boolean;
  path: string | null;
  exists: boolean | null;
  sizeBytes: number | null;
}

export interface ProjectControlReadSection<T> {
  value: T | null;
  availability: ProjectControlSectionAvailability;
  provenance: Provenance;
}

export type ProjectControlActionKind = 'dispatch' | 'decompose' | 'reclaim' | 'terminate';
export type ProjectControlActionRisk = 'medium' | 'high';

export interface DisabledProjectControlAction {
  kind: ProjectControlActionKind;
  label: string;
  enabled: boolean;
  disabledReason: string;
  confirmationCopy: string;
  risk: ProjectControlActionRisk;
  targetId: string | null;
}

export interface ProjectControlMutationRequest {
  kind: ProjectControlActionKind;
  taskId: string | null;
  runId: string | null;
  confirm: boolean;
  reason?: string;
}

export interface ProjectControlMutationResult {
  ok: boolean;
  status: string;
  message: string;
  raw: Record<string, unknown>;
  provenance: Provenance;
}

export interface ProjectControlMutationAdapter {
  executeAction(request: ProjectControlMutationRequest): Promise<ProjectControlMutationResult>;
}

export interface ProjectControlTaskDetail {
  task: KanbanTaskCard;
  diagnostics: ProjectControlReadSection<unknown>;
  comments: ProjectControlReadSection<ProjectControlComment[]>;
  runs: ProjectControlReadSection<ProjectControlRunRecord[]>;
  logs: ProjectControlReadSection<ProjectControlLogChunk>;
  disabledActions: DisabledProjectControlAction[];
}

export interface ProjectControlTaskContext {
  diagnostics: ProjectControlReadSection<unknown>;
  comments: ProjectControlReadSection<ProjectControlComment[]>;
  runs: ProjectControlReadSection<ProjectControlRunRecord[]>;
  logs: ProjectControlReadSection<ProjectControlLogChunk>;
}

export interface ProjectControlReadAdapter {
  readTaskContext(task: KanbanTaskCard): Promise<ProjectControlTaskContext>;
}

export interface ProjectControlStoreState {
  snapshot: Tracked<ProjectControlSnapshot>;
  selectedTaskId: string | null;
  taskDetail: Tracked<ProjectControlTaskDetail | null>;
  lastError: string | null;
  adapterBound: boolean;
  mutationAdapterBound: boolean;
  actionInFlight: ProjectControlActionKind | null;
  lastMutation: Tracked<ProjectControlMutationResult | null>;
}

export interface ProjectControlSourceAggregate {
  source: DataSource;
  freshness: Freshness;
  confidence: Confidence;
}
