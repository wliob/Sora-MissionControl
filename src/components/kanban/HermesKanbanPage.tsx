import { useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { OfficePanel } from '@/components/shell/OfficePanel';
import { useBoardStoreSnapshot } from '@/state/boardStore';
import { getBrowserBackbone } from '@/state/backbone';
import { useConnectionStateValue } from '@/state/sessionConnectionStore';
import type { KanbanColumn, KanbanTaskCard, KanbanStatus } from '@/types/board';
import { initialBoardState } from '@/types/board';
import { truthProvenanceLabel } from '@/utils/truthVocabulary';

const COLUMN_LABELS: Record<KanbanStatus, string> = {
  triage: 'Triage',
  todo: 'Todo',
  scheduled: 'Scheduled',
  ready: 'Ready',
  running: 'In Progress',
  blocked: 'Blocked',
  review: 'review',
  done: 'Done',
};

function formatCardTimestamp(task: KanbanTaskCard): string {
  const raw = task.lastHeartbeatAt ?? task.startedAt ?? task.createdAt ?? task.completedAt;
  if (!raw) return 'timestamp unavailable';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function compactText(value: string | null | undefined, fallback = '—'): string {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function deriveBoardMessage(restState: string, errorMessage: string | null): string {
  if (restState === 'connected') {
    return 'Live Hermes Kanban snapshot routed through the Mission Control proxy bridge.';
  }
  if (restState === 'unauthorized') {
    return 'Authentication required to load the Hermes Kanban API through the Mission Control proxy. No demo board is shown.';
  }
  if (restState === 'offline') {
    return errorMessage ?? 'Kanban REST bridge is currently unavailable. Showing shell-only honest empty states.';
  }
  if (restState === 'degraded') {
    return errorMessage ?? 'Kanban REST bridge is degraded; snapshot freshness may lag.';
  }
  return 'Waiting for the first verified Kanban snapshot from the Hermes dashboard bridge.';
}

function filterColumns(
  columns: KanbanColumn[],
  search: string,
  tenant: string,
  assignee: string,
): KanbanColumn[] {
  const normalizedSearch = search.trim().toLowerCase();
  return columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => {
      if (tenant !== 'all' && task.tenant !== tenant) return false;
      if (assignee !== 'all' && compactText(task.assignee, 'unassigned') !== assignee) return false;
      if (!normalizedSearch) return true;
      const haystack = [task.id, task.title, task.body, task.tenant, task.assignee]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    }),
  }));
}

export function HermesKanbanPage() {
  const boardSnapshot = useBoardStoreSnapshot();
  const connectionState = useConnectionStateValue();
  const [search, setSearch] = useState('');
  const [tenant, setTenant] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [lanesByProfile, setLanesByProfile] = useState(false);

  const fallbackBoard = initialBoardState().value!;
  const board = boardSnapshot.board.value ?? fallbackBoard;
  const restHealth = connectionState.value?.sources['kanban-rest'];
  const wsHealth = connectionState.value?.sources['kanban-ws'];
  const totalTasks = board.columns.reduce((sum, column) => sum + column.tasks.length, 0);
  const laneColumns = useMemo(
    () => filterColumns(board.columns, search, tenant, assignee),
    [assignee, board.columns, search, tenant],
  );
  const visibleColumns = showArchived ? laneColumns : laneColumns.filter((column) => column.name !== 'done');
  const tenantOptions = useMemo(
    () => Array.from(new Set(board.tenants.filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [board.tenants],
  );
  const assigneeOptions = useMemo(
    () => Array.from(new Set(board.assignees.map((value) => compactText(value, 'unassigned')))).sort((a, b) => a.localeCompare(b)),
    [board.assignees],
  );
  const boardMessage = deriveBoardMessage(restHealth?.state ?? 'unknown', restHealth?.error ?? null);
  const sourceMeta = truthProvenanceLabel(boardSnapshot.board.provenance);
  const boardState = restHealth?.state ?? 'unknown';

  return (
    <div className="kanban-page" data-shell-route="kanban">
      <div className="kanban-page-grid">
        <section className="kanban-board-shell">
          <div className="kanban-toolbar-card">
            <div className="kanban-toolbar-header">
              <div>
                <div className="kanban-section-title">Board</div>
                <div className="kanban-meta-row">
                  <button type="button" className="kanban-toolbar-button kanban-board-selector">
                    Default · {totalTasks}
                  </button>
                  <span className="kanban-inline-copy">{totalTasks} tasks</span>
                </div>
              </div>
              <div className="kanban-toolbar-actions">
                <a
                  className="kanban-toolbar-link"
                  href="https://hermes-agent.nousresearch.com/docs"
                  rel="noreferrer"
                  target="_blank"
                  aria-label="Hermes Kanban documentation"
                >
                  ?
                </a>
                <button type="button" className="kanban-toolbar-button" disabled>
                  + New board
                </button>
              </div>
            </div>

            <div className="kanban-orchestration-row">
              <button type="button" className="kanban-status-chip">
                <span>Orchestration:</span>
                <span>Auto</span>
              </button>
              <button type="button" className="kanban-toolbar-link kanban-inline-button" disabled>
                ▸ Orchestration settings
              </button>
            </div>

            <div className="kanban-filter-grid">
              <label className="kanban-filter-field">
                <span>SEARCH</span>
                <input
                  className="kanban-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks"
                />
              </label>
              <label className="kanban-filter-field">
                <span>TENANT</span>
                <select className="kanban-select" value={tenant} onChange={(event) => setTenant(event.target.value)}>
                  <option value="all">All tenants</option>
                  {tenantOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="kanban-filter-field">
                <span>ASSIGNEE</span>
                <select className="kanban-select" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                  <option value="all">All profiles</option>
                  {assigneeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="kanban-toggle-row">
              <label className="kanban-check-label">
                <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                <span>Show archived</span>
              </label>
              <label className="kanban-check-label">
                <input type="checkbox" checked={lanesByProfile} onChange={(event) => setLanesByProfile(event.target.checked)} />
                <span>Lanes by profile</span>
              </label>
              <div className="kanban-inline-actions">
                <button type="button" className="kanban-toolbar-button" disabled>
                  Nudge dispatcher
                </button>
                <button
                  type="button"
                  className="kanban-toolbar-button"
                  onClick={() => {
                    void getBrowserBackbone()?.syncOnce();
                  }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="kanban-toolbar-button"
                  onClick={() => {
                    setSearch('');
                    setTenant('all');
                    setAssignee('all');
                    setShowArchived(false);
                    setLanesByProfile(false);
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>

            <div className="kanban-source-strip">
              <StatusPill state={boardState} label={`Kanban REST: ${boardState}`} size="sm" />
              <StatusPill state={wsHealth?.state ?? 'unknown'} label={`Events: ${wsHealth?.state ?? 'unknown'}`} size="sm" />
              <span className="kanban-source-copy">{sourceMeta}</span>
            </div>

            <div className="kanban-status-note">{boardMessage}</div>
            {lanesByProfile && (
              <div className="kanban-status-note">
                Lanes-by-profile toggle is reserved for a later slice; the current reset keeps the canonical Hermes status lanes visible.
              </div>
            )}
          </div>

          <div className="kanban-lane-scroll" aria-label="Kanban board lanes">
            {visibleColumns.map((column) => (
              <section key={column.name} className="kanban-lane">
                <div className="kanban-lane-header">
                  <div>
                    <div className="kanban-lane-title">{COLUMN_LABELS[column.name]}</div>
                    <div className="kanban-lane-count">{column.tasks.length}</div>
                  </div>
                  <button type="button" className="kanban-lane-plus" disabled>+</button>
                </div>
                <div className="kanban-lane-subtitle">
                  {column.name === 'triage' && 'Raw ideas — a specifier will flesh out the spec'}
                  {column.name === 'todo' && 'Waiting on dependencies or unassigned'}
                  {column.name === 'scheduled' && 'Waiting on a known time delay or scheduled follow-up'}
                  {column.name === 'ready' && 'Dependencies satisfied; assign a profile to dispatch'}
                  {column.name === 'running' && 'Claimed by a worker — in-flight'}
                  {column.name === 'blocked' && 'Worker asked for human input'}
                  {column.name === 'review' && 'Awaiting review or handoff confirmation'}
                  {column.name === 'done' && 'Completed work visible only when requested'}
                </div>
                <div className="kanban-lane-body">
                  {column.tasks.length === 0 ? (
                    <div className="kanban-empty-card">— no tasks —</div>
                  ) : (
                    column.tasks.slice(0, 4).map((task) => (
                      <article key={task.id} className="hermes-kanban-card">
                        <div className="kanban-card-topline">
                          <span>{task.id}</span>
                          <span>P{task.priority}</span>
                        </div>
                        <div className="kanban-card-tenant">{compactText(task.tenant, 'NO TENANT')}</div>
                        <div className="kanban-card-title">{task.title}</div>
                        <div className="kanban-card-assignee">@{compactText(task.assignee, 'unassigned')}</div>
                        <div className="kanban-card-badges">
                          <span>💬 {task.commentCount}</span>
                          <span>↔ {task.linkCounts?.children ?? 0}</span>
                        </div>
                        <div className="kanban-card-time">{formatCardTimestamp(task)}</div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="kanban-office-rail">
          <div className="kanban-office-card">
            <div className="kanban-office-header">
              <div>
                <div className="kanban-section-title">Office</div>
                <div className="kanban-inline-copy">Built-in live visual panel</div>
              </div>
              <StatusPill state={boardState} size="sm" />
            </div>
            <div className="kanban-status-note">
              The office mirrors the live/shared Kanban stores. When live data is unavailable, it stays in honest idle states instead of switching to demo mode.
            </div>
            <div className="kanban-office-frame">
              <OfficePanel />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
