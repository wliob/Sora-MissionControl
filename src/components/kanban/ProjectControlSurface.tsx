import { useEffect, type CSSProperties } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { KANBAN_COLUMN_ORDER } from '@/types/board';
import { useBoardStoreSnapshot } from '@/state/boardStore';
import { useConnectionStateValue } from '@/state/sessionConnectionStore';
import { projectControlStore, useProjectControlState } from '@/state/projectControlStore';
import type { ProjectControlReadSection } from '@/types/project-control';

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
  return `${section.availability} • ${section.provenance.source} • ${section.provenance.freshness}/${section.provenance.confidence}`;
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

  useEffect(() => {
    projectControlStore.syncFromSources(boardSnapshot, connectionState);
  }, [boardSnapshot, connectionState]);

  const snapshot = projectControl.snapshot.value ?? FALLBACK_SNAPSHOT;
  const detail = projectControl.taskDetail.value;

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
              Read-only Kanban/project-control surface. No dispatch, decompose, reclaim, or terminate actions run from this route in Phase 7a.
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
          `${projectControl.snapshot.provenance.source} • ${projectControl.snapshot.provenance.freshness}/${projectControl.snapshot.provenance.confidence}`,
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
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
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
                onClick={() => row.primaryTaskId && void projectControlStore.selectTask(row.primaryTaskId)}
                disabled={!row.primaryTaskId}
                className="admin-btn"
                style={{
                  textAlign: 'left',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-faint)',
                  background: 'rgba(255, 255, 255, 0.02)',
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
              onClick={() => row.primaryTaskId && void projectControlStore.selectTask(row.primaryTaskId)}
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
                onClick={() => void projectControlStore.selectTask(row.taskId)}
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
      </div>

      <section style={panelStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Selected task</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
              Drawer shell for comments, runs, diagnostics, logs, and disabled action confirmations.
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
                {smallMeta(`${projectControl.taskDetail.provenance.source} • ${projectControl.taskDetail.provenance.freshness}/${projectControl.taskDetail.provenance.confidence}`)}
              </div>
            </div>

            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', maxWidth: '75ch' }}>
              {detail.task.body || 'No task body is present on the current board snapshot.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Comments</div>
                {smallMeta(sectionBadge(detail.comments))}
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {detail.comments.value && detail.comments.value.length > 0
                    ? `${detail.comments.value.length} comment records available.`
                    : detail.comments.provenance.note ?? 'No comment data available.'}
                </div>
              </div>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Runs</div>
                {smallMeta(sectionBadge(detail.runs))}
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {detail.runs.value && detail.runs.value.length > 0
                    ? `${detail.runs.value.length} run records available.`
                    : detail.runs.provenance.note ?? 'No run data available.'}
                </div>
              </div>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Logs</div>
                {smallMeta(sectionBadge(detail.logs))}
                <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                  {detail.logs.value && detail.logs.value.lines.length > 0
                    ? `${detail.logs.value.lines.length} log lines loaded.`
                    : detail.logs.provenance.note ?? 'No log data available.'}
                </div>
              </div>
              <div style={panelStyle()}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Diagnostics</div>
                {smallMeta(sectionBadge(detail.diagnostics))}
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
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Disabled actions</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                {detail.disabledActions.map((action) => (
                  <div key={action.kind} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <button
                      disabled
                      className="admin-btn"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-faint)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-dim)',
                        textAlign: 'left',
                      }}
                      title={action.disabledReason}
                    >
                      {action.label}
                    </button>
                    <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)' }}>{action.confirmationCopy}</div>
                  </div>
                ))}
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
