/**
 * ProjectsPage — Portfolio/outcome layer dashboard.
 *
 * Shows project status across the guild with project cards in a CSS Grid
 * layout. Each card shows status badge, department lead, task count bar,
 * blocker count, last activity, and freshness badge.
 *
 * Uses projectsStore (derived from boardStore Kanban data).
 */

import { useProjectsState } from '@/state/projectsStore';
import { truthFreshnessLabel } from '@/utils/truthVocabulary';
import { AGENTS } from '@/types/agents';
import type { ProjectStatus } from '@/types/projects';

// ── Status display ────────────────────────────────────────────────

const STATUS_META: Record<ProjectStatus, { label: string; dot: string; color: string; barColor: string }> = {
  active:    { label: 'ACTIVE',    dot: '\u25CF', color: 'var(--crt-green)',  barColor: 'var(--crt-green)' },
  paused:    { label: 'PAUSED',    dot: '\u25CF', color: 'var(--crt-amber)',  barColor: 'var(--crt-amber)' },
  completed: { label: 'COMPLETED', dot: '\u25CF', color: 'var(--text-dim)',   barColor: 'var(--text-dim)' },
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '<1m ago';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function leadName(leadId: string | null): string {
  if (!leadId) return '—';
  const agent = AGENTS.find(a => a.id === leadId);
  return agent?.name ?? leadId;
}

function leadAccent(leadId: string | null): string {
  if (!leadId) return 'var(--text-dim)';
  const agent = AGENTS.find(a => a.id === leadId);
  return agent?.accent ?? 'var(--text-muted)';
}

// ── Component ─────────────────────────────────────────────────────

export function ProjectsPage() {
  const state = useProjectsState();
  const { projects, freshness } = state;
  const isMissing = freshness === 'missing';
  const freshLabel = truthFreshnessLabel(freshness);

  const activeCount = projects.filter(p => p.status === 'active').length;
  const pausedCount = projects.filter(p => p.status === 'paused').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  // ── Unavailable state ──────────────────────────────────────────
  if (isMissing) {
    return (
      <section className="dashboard-main-frame projects-page">
        <div className="dashboard-header">
          <div className="dashboard-header-title-group">
            <div className="dashboard-placeholder-eyebrow mono">PROJECT CONTROL</div>
            <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Projects</h2>
          </div>
          <span className="freshness-badge freshness-badge--unavailable mono">unavailable</span>
        </div>
        <div className="projects-empty-state">
          <div className="projects-empty-panel">
            <span className="mono" style={{ color: 'var(--crt-amber)' }}>{'\u26A0'}  Project data unavailable</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '12px' }}>
              The project data source is not connected.
              Check your connection to the Hermes runtime or admin proxy.
            </p>
            <p className="mono text-dim" style={{ marginTop: '8px' }}>
              Source: dashboard-api {'\u2502'} Status: offline
            </p>
          </div>
        </div>
        <footer className="projects-status-bar mono">
          <span>{'\u27D0'} -- projects {'\u2502'} system: OFFLINE</span>
        </footer>
      </section>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <section className="dashboard-main-frame projects-page">
        <div className="dashboard-header">
          <div className="dashboard-header-title-group">
            <div className="dashboard-placeholder-eyebrow mono">PROJECT CONTROL</div>
            <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Projects</h2>
          </div>
          <span className={`freshness-badge freshness-badge--${freshLabel} mono`}>{freshLabel}</span>
        </div>
        <div className="projects-empty-state">
          <div className="projects-empty-panel">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-md)', fontWeight: 500 }}>
              No projects tracked
            </span>
            <p style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginTop: '12px', maxWidth: '360px', textAlign: 'center' }}>
              No projects are currently registered in the system.
              Projects will appear here once work is organized into
              tracked project containers.
            </p>
          </div>
        </div>
        <footer className="projects-status-bar mono">
          <span>{'\u27D0'} 0 projects {'\u2502'} -- active {'\u00B7'} -- paused {'\u00B7'} -- completed {'\u2502'} {new Date().toISOString().slice(11, 16)} UTC</span>
        </footer>
      </section>
    );
  }

  // ── Project grid ────────────────────────────────────────────────
  return (
    <section className="dashboard-main-frame projects-page">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-title-group">
          <div className="dashboard-placeholder-eyebrow mono">PROJECT CONTROL</div>
          <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Projects</h2>
          <span className="dashboard-header-count mono">{projects.length}</span>
        </div>
        <span className={`freshness-badge freshness-badge--${freshLabel} mono`}>{freshLabel}</span>
      </div>

      {/* Filter bar */}
      <div className="projects-filter-bar mono">
        <span className="text-muted">[active {'\u25BE'}]</span>
        <span className="text-muted">{'\u21C5'} updated</span>
        <span style={{ marginLeft: 'auto', color: 'var(--guild-amber)' }}>{'\u27F3'} refresh</span>
      </div>

      {/* Grid */}
      <div className="projects-grid">
        {projects.map(project => {
          const sm = STATUS_META[project.status];
          const maxTasks = 20;
          const filledBlocks = Math.min(project.taskCount, maxTasks);
          const pct = (filledBlocks / maxTasks) * 100;

          return (
            <article
              key={project.id}
              className="project-card"
              role="article"
              aria-label={`${project.name} — ${sm.label} — ${leadName(project.lead)}`}
            >
              {/* Tab header */}
              <div className="project-card__tab" style={{ borderLeftColor: sm.color }}>
                <span className="project-card__status mono" style={{ color: sm.color }}>
                  {sm.dot} {sm.label}
                </span>
                <span className="project-card__lead mono" style={{ color: leadAccent(project.lead), marginLeft: 'auto' }}>
                  {leadName(project.lead)}
                </span>
              </div>

              {/* Title + department */}
              <div className="project-card__title">{project.name}</div>
              <div className="project-card__department text-dim">{project.id}</div>

              {/* Task bar */}
              <div className="project-card__section">
                <div className="project-card__divider mono text-dim">
                  {'\u2500\u2500\u252C\u2500'} tasks {'\u2500\u2500\u2500'}
                </div>
                <div className="project-card__task-bar">
                  <div
                    className="project-card__task-bar-fill"
                    style={{ width: `${pct}%`, backgroundColor: sm.barColor }}
                  />
                </div>
                <div className="project-card__task-count mono" style={{ color: sm.color }}>
                  {project.taskCount} tasks
                </div>
              </div>

              {/* Blocker count */}
              <div className="project-card__blockers mono">
                <span style={{ color: project.blockerCount > 0 ? 'var(--crt-red)' : 'var(--text-dim)' }}>
                  {'[!]'} BLOCKERS: {project.blockerCount}
                </span>
              </div>

              {/* Last activity + freshness */}
              <div className="project-card__footer">
                <span className="mono text-dim">
                  last: {formatRelative(project.lastActivity)}
                </span>
                <span className={`freshness-badge freshness-badge--${truthFreshnessLabel(project.freshness)} mono`}>
                  {truthFreshnessLabel(project.freshness)}
                </span>
              </div>

              {/* Action */}
              <button type="button" className="project-card__action mono">
                {'\u2570\u2500\u2500'} open board
              </button>
            </article>
          );
        })}
      </div>

      {/* Status bar */}
      <footer className="projects-status-bar mono">
        <span>
          {'\u27D0'} {projects.length} projects {'\u2502'} {activeCount} active {'\u00B7'} {pausedCount} paused {'\u00B7'} {completedCount} completed {'\u2502'} {new Date().toISOString().slice(11, 16)} UTC
        </span>
      </footer>
    </section>
  );
}
