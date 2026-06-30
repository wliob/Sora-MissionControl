import { useEffect, useMemo, type CSSProperties } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { KANBAN_COLUMN_ORDER } from '@/types/board';
import { useBoardStoreSnapshot } from '@/state/boardStore';
import { useConnectionStateValue } from '@/state/sessionConnectionStore';
import { projectControlStore, useProjectControlState } from '@/state/projectControlStore';
import type { ProjectControlReadSection } from '@/types/project-control';
import { shellStore, useShellState } from '@/state/shellStore';
import { canSend } from '@/modules/chat/chatStore';
import { isAgentId } from '@/types';
import type { KanbanTaskCard, KanbanStatus } from '@/types/board';
import { truthProvenanceLabel } from '@/utils/truthVocabulary';

const CURRENT_WORK_PRIORITY: Record<KanbanStatus, number> = {
  running: 0,
  blocked: 1,
  review: 2,
  ready: 3,
  scheduled: 4,
  todo: 5,
  triage: 6,
  done: 7,
};

function flattenBoardTasks(board: ReturnType<typeof useBoardStoreSnapshot>['board']['value']): KanbanTaskCard[] {
  if (!board) return [];
  return board.columns.flatMap((column) => column.tasks);
}

function compareCurrentWork(a: KanbanTaskCard, b: KanbanTaskCard): number {
  const statusDelta = CURRENT_WORK_PRIORITY[a.status] - CURRENT_WORK_PRIORITY[b.status];
  if (statusDelta !== 0) return statusDelta;
  return b.priority - a.priority;
}

function panelStyle(): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    minWidth: 0,
    padding: 'var(--space-4)',
    border: '1px solid var(--border-faint)',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(255, 255, 255, 0.025)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.025)',
  };
}

function smallMeta(text: string) {
  return (
    <div className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>
      {text}
    </div>
  );
}

function sectionBadge(section: ProjectControlReadSection<unknown>) {
  return `${section.availability} • ${truthProvenanceLabel(section.provenance)}`;
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const FALLBACK_SNAPSHOT = {
  boardState: 'unknown',
  metrics: {
    totalTasks: null,
    runningTasks: null,
    blockedTasks: null,
    ownerCount: null,
    activeWorkerCount: null,
  },
  statusRows: KANBAN_COLUMN_ORDER.map((status) => ({ status, count: null, primaryTaskId: null })),
  ownerRows: [],
  blockerRows: [],
  sourceRows: [],
  note: 'Kanban snapshot has not been observed yet.',
} as const;

export function ProjectControlSurface() {
  const boardSnapshot = useBoardStoreSnapshot();
  const connectionState = useConnectionStateValue();
  const projectControl = useProjectControlState();
  const { selectedOwner } = useShellState();

  useEffect(() => {
    projectControlStore.syncFromSources(boardSnapshot, connectionState);
  }, [boardSnapshot, connectionState]);

  const snapshot = projectControl.snapshot.value ?? FALLBACK_SNAPSHOT;
  const detail = projectControl.taskDetail.value;
  const detailComments = detail?.comments.value ?? [];
  const detailRuns = detail?.runs.value ?? [];
  const detailLogs = detail?.logs.value ?? { lines: [], truncated: false, path: null, exists: null, sizeBytes: null };
  const boardTasks = useMemo(
    () => flattenBoardTasks(boardSnapshot.board.value).sort(compareCurrentWork),
    [boardSnapshot.board.value],
  );
  const focusedOwner = selectedOwner ?? detail?.task.assignee ?? null;
  const focusedOwnerTasks = useMemo(() => {
    if (!focusedOwner) return [];
    return boardTasks.filter((task) => task.assignee === focusedOwner);
  }, [boardTasks, focusedOwner]);
  const primaryFocusedTask = focusedOwnerTasks[0] ?? null;
  const selectedTaskOwner = detail?.task.assignee ?? focusedOwner;
  const selectedTaskAgent = selectedTaskOwner && isAgentId(selectedTaskOwner) ? selectedTaskOwner : null;
  const compactUnavailableState = snapshot.boardState === 'unknown' || snapshot.boardState === 'unavailable';
  const officeDisabledReason = !selectedTaskOwner
    ? 'Selected task is currently unassigned.'
    : !selectedTaskAgent
      ? 'No office avatar mapping exists for this owner.'
      : null;
  const chatDisabledReason = !selectedTaskOwner
    ? 'Selected task is currently unassigned.'
    : !selectedTaskAgent
      ? 'Chat surface only supports Mission Control department leads today.'
      : !canSend()
        ? 'Chat transport is not bound right now.'
        : null;
  const chatLabel = !selectedTaskAgent
    ? 'Open chat unavailable'
    : !canSend()
      ? 'Open chat unavailable'
      : 'Open chat';

  function syncOwnerContext(owner: string | null) {
    shellStore.setSelectedOwner(owner);
    shellStore.setSelectedAgent(owner && isAgentId(owner) ? owner : null);
  }

  function selectTask(taskId: string) {
    const task = boardTasks.find((candidate) => candidate.id === taskId) ?? null;
    syncOwnerContext(task?.assignee ?? null);
    void projectControlStore.selectTask(taskId);
  }

  useEffect(() => {
    if (!focusedOwner || !primaryFocusedTask) return;
    if (detail?.task.id && focusedOwnerTasks.some((task) => task.id === detail.task.id)) return;
    void projectControlStore.selectTask(primaryFocusedTask.id);
  }, [detail?.task.id, focusedOwner, focusedOwnerTasks, primaryFocusedTask]);

  return (
    <div
      data-project-control-surface="phase-7a"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        padding: 'var(--space-4)',
        background: 'linear-gradient(180deg, rgba(34, 211, 238, 0.03), transparent 18%)',
      }}
    >
      <section style={{ ...panelStyle(), gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 650, color: 'var(--text-primary)' }}>
              Project Control
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '72ch' }}>
              Live Kanban/project-control surface. Task comments, runs, logs, and guarded mutations route through verified Project Control adapters when source health is connected.
            </div>
          </div>
          <StatusPill
            state={snapshot.boardState === 'live'
              ? 'connected'
              : snapshot.boardState === 'stale'
                ? 'degraded'
                : snapshot.boardState === 'unavailable'
                  ? 'offline'
                  : 'unknown'}
            label={`Kanban snapshot: ${snapshot.boardState}`}
            size="md"
          />
        </div>
        {smallMeta(
          truthProvenanceLabel(projectControl.snapshot.provenance),
        )}
        {snapshot.note && (
          <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>{snapshot.note}</div>
        )}
        {projectControl.lastError && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--status-offline) 50%, transparent)',
              color: 'var(--status-offline)',
              background: 'color-mix(in srgb, var(--status-offline-bg) 82%, transparent)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {projectControl.lastError}
          </div>
        )}
        {projectControl.lastMutation.value && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--status-connected) 38%, transparent)',
              color: 'var(--status-connected)',
              background: 'color-mix(in srgb, var(--status-connected-bg) 82%, transparent)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {projectControl.lastMutation.value.message}
          </div>
        )}
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
        {compactUnavailableState ? (
          <section style={{ ...panelStyle(), gridColumn: '1 / -1' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Project Control unavailable</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '72ch' }}>
              Awaiting verified Kanban board data before overview counts, owner queues, and blocker lanes unlock.
            </div>
            {smallMeta(`${snapshot.boardState} • ${truthProvenanceLabel(projectControl.snapshot.provenance)}`)}
          </section>
        ) : (
          <>
            <section style={panelStyle()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Overview</div>
                <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  read-only
                </span>
              </div>
              {[
                ['Total tasks', snapshot.metrics.totalTasks],
                ['Running', snapshot.metrics.runningTasks],
                ['Blocked', snapshot.metrics.blockedTasks],
                ['Owners', snapshot.metrics.ownerCount],
                ['Active workers', snapshot.metrics.activeWorkerCount],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{label}</span>
                  <span className="mono" style={{ color: 'var(--text-primary)' }}>{value ?? 'unknown'}</span>
                </div>
              ))}
            </section>

            <section style={panelStyle()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Current work</div>
                <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {focusedOwner ?? 'no owner focus'}
                </span>
              </div>
              {!focusedOwner ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  Select an owner or task to carry current-work context into office and chat.
                </div>
              ) : focusedOwnerTasks.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  No tasks currently map to {focusedOwner} on the verified board snapshot.
                </div>
              ) : (
                <>
                  <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                    Showing {focusedOwnerTasks.length} task{focusedOwnerTasks.length === 1 ? '' : 's'} for {focusedOwner}.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {focusedOwnerTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        data-project-control-task={task.id}
                        className="admin-btn"
                        onClick={() => selectTask(task.id)}
                        style={{
                          textAlign: 'left',
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          border: task.id === detail?.task.id
                            ? '1px solid color-mix(in srgb, var(--accent-cyan) 42%, var(--border-faint))'
                            : '1px solid var(--border-faint)',
                          background: task.id === detail?.task.id
                            ? 'color-mix(in srgb, var(--accent-cyan) 8%, rgba(255, 255, 255, 0.02))'
                            : 'rgba(255, 255, 255, 0.02)',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.title}</div>
                        {smallMeta(`${task.status} • priority ${task.priority} • ${task.id}`)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section style={panelStyle()}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Ownership</div>
              {snapshot.ownerRows.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {snapshot.boardState === 'live' || snapshot.boardState === 'stale'
                    ? 'No owner rows are currently visible on the board snapshot.'
                    : 'Ownership is unavailable until a verified Kanban snapshot arrives.'}
                </div>
              ) : (
                snapshot.ownerRows.map((row) => (
                  <button
                    key={row.owner}
                    type="button"
                    data-project-control-owner={row.owner}
                    onClick={() => {
                      syncOwnerContext(row.owner);
                      if (row.primaryTaskId) selectTask(row.primaryTaskId);
                    }}
                    disabled={!row.primaryTaskId}
                    className="admin-btn"
                    style={{
                      textAlign: 'left',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: row.owner === focusedOwner
                        ? '1px solid color-mix(in srgb, var(--accent-cyan) 42%, var(--border-faint))'
                        : '1px solid var(--border-faint)',
                      background: row.owner === focusedOwner
                        ? 'color-mix(in srgb, var(--accent-cyan) 8%, rgba(255, 255, 255, 0.02))'
                        : 'rgba(255, 255, 255, 0.02)',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.owner}</span>
                      <span className="mono" style={{ color: 'var(--text-secondary)' }}>{row.total}</span>
                    </div>
                    {smallMeta(`running ${row.running} • blocked ${row.blocked}`)}
                  </button>
                ))
              )}
            </section>

            <section style={panelStyle()}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Status lanes</div>
              {snapshot.statusRows.map((row) => (
                <button
                  key={row.status}
                  type="button"
                  onClick={() => row.primaryTaskId && selectTask(row.primaryTaskId)}
                  disabled={!row.primaryTaskId}
                  className="admin-btn"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-faint)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{row.status}</span>
                  <span className="mono" style={{ color: 'var(--text-primary)' }}>{row.count ?? 'unknown'}</span>
                </button>
              ))}
            </section>

            <section style={panelStyle()}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Blockers</div>
              {snapshot.blockerRows.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {snapshot.boardState === 'live' || snapshot.boardState === 'stale'
                    ? 'No blocked tasks reported.'
                    : 'Blocked-task visibility is unavailable until a verified Kanban snapshot arrives.'}
                </div>
              ) : (
                snapshot.blockerRows.map((row) => (
                  <button
                    key={row.taskId}
                    type="button"
                    data-project-control-task={row.taskId}
                    onClick={() => selectTask(row.taskId)}
                    className="admin-btn"
                    style={{
                      textAlign: 'left',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid color-mix(in srgb, var(--accent-amber) 28%, var(--border-faint))',
                      background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.title}</div>
                    {smallMeta(`${row.assignee ?? 'unassigned'} • ${row.taskId}`)}
                    <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>{row.blockerSummary}</div>
                  </button>
                ))
              )}
            </section>
          </>
        )}
      </div>

      <section style={panelStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Selected task</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
              Live task drawer for diagnostics, comment thread, run history, log preview, and guarded Kanban actions.
            </div>
          </div>
          {detail && smallMeta(`${detail.task.id} • ${detail.task.status}`)}
        </div>

        {!detail ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
            Select a task from ownership, status, or blocker rows to inspect read-only context.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{detail.task.title}</div>
                {smallMeta(`owner ${detail.task.assignee ?? 'unassigned'} • priority ${detail.task.priority}`)}
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Run / worker</div>
                {smallMeta(`run ${detail.task.currentRunId ?? 'unknown'} • pid ${detail.task.workerPid ?? 'unknown'}`)}
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Freshness</div>
                {smallMeta(truthProvenanceLabel(projectControl.taskDetail.provenance))}
              </div>
            </div>

            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', maxWidth: '75ch' }}>
              {detail.task.body || 'No task body is present on the current board snapshot.'}
            </div>

            <div style={panelStyle()}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Cross-links</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                Carry the selected owner into office, chat, and current-work focus without creating a second selection store.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                <button
                  type="button"
                  data-project-control-nav="office"
                  disabled={officeDisabledReason !== null}
                  className="admin-btn"
                  onClick={() => {
                    if (!selectedTaskAgent) return;
                    syncOwnerContext(selectedTaskAgent);
                    shellStore.setView('office');
                  }}
                  style={{
                    minHeight: 44,
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: officeDisabledReason === null
                      ? '1px solid color-mix(in srgb, var(--accent-cyan) 42%, var(--border-faint))'
                      : '1px solid var(--border-faint)',
                    background: officeDisabledReason === null
                      ? 'color-mix(in srgb, var(--accent-cyan) 10%, rgba(255, 255, 255, 0.02))'
                      : 'rgba(255, 255, 255, 0.02)',
                    color: officeDisabledReason === null ? 'var(--text-primary)' : 'var(--text-dim)',
                    textAlign: 'left',
                    cursor: officeDisabledReason === null ? 'pointer' : 'not-allowed',
                    opacity: officeDisabledReason === null ? 1 : 0.6,
                  }}
                >
                  Focus in office
                </button>
                <button
                  type="button"
                  data-project-control-nav="chat"
                  disabled={chatDisabledReason !== null}
                  className="admin-btn"
                  onClick={() => {
                    if (!selectedTaskAgent || chatDisabledReason !== null) return;
                    syncOwnerContext(selectedTaskAgent);
                    shellStore.setView('chat');
                  }}
                  style={{
                    minHeight: 44,
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: chatDisabledReason === null
                      ? '1px solid color-mix(in srgb, var(--accent-cyan) 42%, var(--border-faint))'
                      : '1px solid var(--border-faint)',
                    background: chatDisabledReason === null
                      ? 'color-mix(in srgb, var(--accent-cyan) 10%, rgba(255, 255, 255, 0.02))'
                      : 'rgba(255, 255, 255, 0.02)',
                    color: chatDisabledReason === null ? 'var(--text-primary)' : 'var(--text-dim)',
                    textAlign: 'left',
                    cursor: chatDisabledReason === null ? 'pointer' : 'not-allowed',
                    opacity: chatDisabledReason === null ? 1 : 0.6,
                  }}
                >
                  {chatLabel}
                </button>
                <button
                  type="button"
                  data-project-control-nav="owner-filter"
                  disabled={selectedTaskOwner == null}
                  className="admin-btn"
                  onClick={() => {
                    if (!selectedTaskOwner) return;
                    syncOwnerContext(selectedTaskOwner);
                    if (primaryFocusedTask) void projectControlStore.selectTask(primaryFocusedTask.id);
                  }}
                  style={{
                    minHeight: 44,
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-faint)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: selectedTaskOwner ? 'var(--text-primary)' : 'var(--text-dim)',
                    textAlign: 'left',
                    cursor: selectedTaskOwner ? 'pointer' : 'not-allowed',
                    opacity: selectedTaskOwner ? 1 : 0.6,
                  }}
                >
                  Show all tasks by owner
                </button>
              </div>
              {officeDisabledReason && (
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)' }}>
                  {officeDisabledReason}
                </div>
              )}
              {chatDisabledReason && (
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)' }}>
                  {chatDisabledReason}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Comments</div>
                {smallMeta(sectionBadge(detail.comments))}
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {detail.comments.provenance.note ?? 'No comment data available.'}
                </div>
                {detailComments.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>No comment records are available for the selected task.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '220px', overflow: 'auto' }}>
                    {detailComments.map((comment) => (
                      <div
                        key={comment.id}
                        style={{
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-faint)',
                          background: 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{comment.author ?? 'unknown author'}</span>
                          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)' }}>
                            {comment.createdAt ?? 'timestamp unavailable'}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
                          {comment.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Runs</div>
                {smallMeta(sectionBadge(detail.runs))}
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {detail.runs.provenance.note ?? 'No run data available.'}
                </div>
                {detailRuns.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>No run records are available for the selected task.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '220px', overflow: 'auto' }}>
                    {detailRuns.map((run) => (
                      <div
                        key={run.id}
                        style={{
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-faint)',
                          background: 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>run {run.id}</span>
                          <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                            {run.status}
                          </span>
                        </div>
                        {smallMeta(`profile ${run.profile ?? 'unknown'} • pid ${run.workerPid ?? 'unknown'}`)}
                        {smallMeta(`started ${run.startedAt ?? 'unknown'} • heartbeat ${run.lastHeartbeatAt ?? 'unknown'}`)}
                        {run.completedAt && smallMeta(`completed ${run.completedAt}`)}
                        {(run.outcome || run.summary || run.error) && (
                          <div style={{ color: run.error ? 'var(--status-offline)' : 'var(--text-dim)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
                            {[run.outcome, run.summary, run.error].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Logs</div>
                {smallMeta(sectionBadge(detail.logs))}
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {detail.logs.provenance.note ?? 'No log data available.'}
                </div>
                {smallMeta(`path ${detailLogs.path ?? 'unreported'} • exists ${detailLogs.exists == null ? 'unknown' : detailLogs.exists ? 'yes' : 'no'} • bytes ${detailLogs.sizeBytes ?? 'unknown'}`)}
                {detailLogs.lines.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                    {detailLogs.exists === false
                      ? 'The verified log route reported no task log file for this task yet.'
                      : 'No log lines are currently available for the selected task.'}
                  </div>
                ) : (
                  <pre
                    className="mono"
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-dim)',
                      maxHeight: '220px',
                      overflow: 'auto',
                    }}
                  >
                    {detailLogs.lines.slice(-40).join('\n')}
                  </pre>
                )}
                {detailLogs.truncated && (
                  <div style={{ color: 'var(--accent-amber)', fontSize: 'var(--text-xs)' }}>
                    Log preview truncated to the most recent lines returned by the verified task-log route.
                  </div>
                )}
              </div>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Diagnostics</div>
                {smallMeta(sectionBadge(detail.diagnostics))}
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {detail.diagnostics.provenance.note ?? 'No diagnostics payload available.'}
                </div>
                <pre
                  className="mono"
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-dim)',
                    maxHeight: '180px',
                    overflow: 'auto',
                  }}
                >
                  {pretty(detail.diagnostics.value ?? {})}
                </pre>
              </div>
            </div>

            <div style={panelStyle()}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Guarded actions</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                Mutations stay disabled unless the verified adapter is bound, Kanban REST is connected, and required task/run ids are present.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                {detail.disabledActions.map((action) => {
                  const busy = projectControl.actionInFlight === action.kind;
                  return (
                    <div key={action.kind} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      <button
                        disabled={!action.enabled || projectControl.actionInFlight !== null}
                        className="admin-btn"
                        data-project-control-action={action.kind}
                        onClick={() => {
                          if (!action.enabled) return;
                          const accepted = window.confirm(`${action.label}\n\n${action.confirmationCopy}`);
                          if (accepted) void projectControlStore.executeAction(action.kind, `confirmed via Project Control surface for ${action.targetId ?? 'board'}`);
                        }}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          border: action.enabled
                            ? '1px solid color-mix(in srgb, var(--accent-cyan) 42%, var(--border-faint))'
                            : '1px solid var(--border-faint)',
                          background: action.enabled
                            ? 'color-mix(in srgb, var(--accent-cyan) 10%, rgba(255, 255, 255, 0.02))'
                            : 'rgba(255, 255, 255, 0.02)',
                          color: action.enabled ? 'var(--text-primary)' : 'var(--text-dim)',
                          textAlign: 'left',
                        }}
                        title={action.enabled ? action.confirmationCopy : action.disabledReason}
                      >
                        {busy ? `${action.label}…` : action.label}
                      </button>
                      <div style={{ color: action.risk === 'high' ? 'var(--accent-amber)' : 'var(--text-dim)', fontSize: 'var(--text-xs)' }}>
                        {action.enabled ? action.confirmationCopy : action.disabledReason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>

      <section style={panelStyle()}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sources</div>
        {snapshot.sourceRows.map((row) => (
          <div key={row.sourceId} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{row.label}</div>
              {smallMeta(`sync ${row.sync.lastSyncAt ?? 'never'}${row.sync.staleReason ? ` • ${row.sync.staleReason}` : ''}`)}
            </div>
            <StatusPill state={row.health.state} size="sm" />
          </div>
        ))}
      </section>
    </div>
  );
}
