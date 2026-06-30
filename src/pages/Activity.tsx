/**
 * ActivityPage — Chronological operations log.
 *
 * A filtered timeline of meaningful agent events across the system.
 * Default view: chronological timeline (newest-first) with day-grouped
 * entries, color-coded event type tags, and freshness badges.
 *
 * Uses activityStore (derived from boardStore task changes).
 */

import { useActivityState } from '@/state/activityStore';
import { truthFreshnessLabel } from '@/utils/truthVocabulary';
import { AGENTS } from '@/types/agents';
import type { AgentId } from '@/types/agents';
import type { ActivityEvent } from '@/types/activity';

// ── Event type display mapping ────────────────────────────────────

const EVENT_TYPE_META: Record<string, { tag: string; color: string; bgColor: string }> = {
  'task.completed':    { tag: '[TASK_STATE]', color: 'var(--crt-cyan)',   bgColor: 'var(--crt-cyan-dim)' },
  'task.started':      { tag: '[TASK_STATE]', color: 'var(--crt-cyan)',   bgColor: 'var(--crt-cyan-dim)' },
  'task.blocked':      { tag: '[BLOCKER  ]',  color: 'var(--crt-red)',     bgColor: 'var(--crt-red-dim)' },
  'task.claimed':      { tag: '[DELEGATION]', color: 'var(--crt-violet)',  bgColor: 'var(--crt-violet-dim)' },
  'task.reassigned':   { tag: '[DELEGATION]', color: 'var(--crt-violet)',  bgColor: 'var(--crt-violet-dim)' },
  'task.unblocked':    { tag: '[VERIFY  ]',   color: 'var(--crt-green)',   bgColor: 'var(--crt-green-dim)' },
  'delegation.handoff':{ tag: '[DELEGATION]', color: 'var(--crt-violet)',  bgColor: 'var(--crt-violet-dim)' },
  'delegation.escalation':{ tag: '[VERIFY  ]', color: 'var(--crt-amber)', bgColor: 'var(--crt-amber-dim)' },
  'system.health_change':{ tag: '[SRC_HEALTH]', color: 'var(--crt-amber)', bgColor: 'var(--crt-amber-dim)' },
  'agent.blocked':     { tag: '[BLOCKER  ]',  color: 'var(--crt-red)',     bgColor: 'var(--crt-red-dim)' },
  'agent.online':      { tag: '[SRC_HEALTH]', color: 'var(--crt-green)',   bgColor: 'var(--crt-green-dim)' },
  'agent.offline':     { tag: '[SRC_HEALTH]', color: 'var(--crt-red)',     bgColor: 'var(--crt-red-dim)' },
  'session.started':   { tag: '[AUTOMATION]', color: 'var(--crt-green)',   bgColor: 'var(--crt-green-dim)' },
  'session.ended':     { tag: '[AUTOMATION]', color: 'var(--crt-amber)',   bgColor: 'var(--crt-amber-dim)' },
  'task.review_requested':{ tag: '[VERIFY  ]', color: 'var(--crt-violet)', bgColor: 'var(--crt-violet-dim)' },
};

function getEventMeta(eventType: string) {
  return EVENT_TYPE_META[eventType] ?? { tag: '[UNKNOWN  ]', color: 'var(--text-muted)', bgColor: 'transparent' };
}

function agentAccent(source: AgentId | 'SYSTEM'): string {
  if (source === 'SYSTEM') return 'var(--text-muted)';
  const agent = AGENTS.find(a => a.id === source);
  return agent?.accent ?? 'var(--text-muted)';
}

function agentName(source: AgentId | 'SYSTEM'): string {
  if (source === 'SYSTEM') return 'SYSTEM';
  const agent = AGENTS.find(a => a.id === source);
  return agent?.name.toUpperCase() ?? source.toUpperCase();
}

// ── Day grouping ──────────────────────────────────────────────────

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────

export function ActivityPage() {
  const state = useActivityState();
  const { events, freshness } = state;
  const isMissing = freshness === 'missing';

  // Group events by calendar day
  const grouped = new Map<string, ActivityEvent[]>();
  for (const ev of events) {
    const day = ev.timestamp.slice(0, 10);
    const list = grouped.get(day) ?? [];
    list.push(ev);
    grouped.set(day, list);
  }

  const dayKeys = [...grouped.keys()].sort().reverse(); // newest first

  // ── Unavailable state ──────────────────────────────────────────
  if (isMissing) {
    return (
      <section className="dashboard-main-frame activity-page">
        <div className="dashboard-header">
          <div className="dashboard-header-title-group">
            <div className="dashboard-placeholder-eyebrow mono">ACTIVITY FEED</div>
            <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Activity</h2>
          </div>
          <span className="freshness-badge freshness-badge--unavailable mono">unavailable</span>
        </div>
        <div className="activity-empty-state">
          <div className="activity-empty-panel">
            <span className="mono" style={{ color: 'var(--crt-amber)' }}>{'\u26A0'}  Activity data unavailable</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '12px' }}>
              The activity event source is not connected.
              Check your connection to the Hermes runtime or admin proxy.
            </p>
            <p className="mono text-dim" style={{ marginTop: '8px' }}>
              Source: dashboard-api {'\u2502'} Status: offline
            </p>
          </div>
        </div>
        <footer className="activity-status-bar mono">
          <span>{'\u27D0'} -- events {'\u2502'} system: OFFLINE</span>
        </footer>
      </section>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <section className="dashboard-main-frame activity-page">
        <div className="dashboard-header">
          <div className="dashboard-header-title-group">
            <div className="dashboard-placeholder-eyebrow mono">ACTIVITY FEED</div>
            <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Activity</h2>
          </div>
          <span className={`freshness-badge freshness-badge--${truthFreshnessLabel(freshness)} mono`}>
            {truthFreshnessLabel(freshness)}
          </span>
        </div>
        <div className="activity-empty-state">
          <div className="activity-empty-panel">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-md)', fontWeight: 500 }}>
              No activity events recorded
            </span>
            <p style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginTop: '12px', maxWidth: '360px', textAlign: 'center' }}>
              The event log is empty. This means no task state changes,
              blocker events, delegations, or system events have occurred
              in the selected time range.
            </p>
          </div>
        </div>
        <footer className="activity-status-bar mono">
          <span>{'\u27D0'} 0 events {'\u2502'} {new Date().toISOString().slice(11, 16)} UTC</span>
        </footer>
      </section>
    );
  }

  // ── Normal timeline ─────────────────────────────────────────────
  return (
    <section className="dashboard-main-frame activity-page">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-title-group">
          <div className="dashboard-placeholder-eyebrow mono">ACTIVITY FEED</div>
          <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Activity</h2>
          <span className="dashboard-header-count mono">{events.length}</span>
        </div>
        <span className={`freshness-badge freshness-badge--${truthFreshnessLabel(freshness)} mono`}>
          {truthFreshnessLabel(freshness)}
        </span>
      </div>

      {/* Filter bar */}
      <div className="activity-filter-bar mono">
        <span className="text-muted">[All Events {'\u25BE'}]</span>
        <span className="text-muted">[All Agents {'\u25BE'}]</span>
        <span className="text-muted">[All Time {'\u25BE'}]</span>
        <span style={{ marginLeft: 'auto', color: 'var(--guild-amber)' }}>{'\u27F3'} refresh</span>
      </div>

      {/* Timeline */}
      <div className="activity-timeline" role="log" aria-live="polite">
        {dayKeys.map(day => (
          <div key={day} className="activity-day-group">
            <div className="activity-day-header mono">
              {'\u250C\u2500\u2500'} {getDayLabel(day + 'T00:00:00Z')} {'\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'}
            </div>
            {(grouped.get(day) ?? []).map((ev, i) => {
              const meta = getEventMeta(ev.eventType);
              const freshLabel = truthFreshnessLabel(ev.freshness);
              return (
                <div
                  key={`${ev.timestamp}-${i}`}
                  className={`activity-entry${ev.eventType === 'task.blocked' || ev.eventType === 'agent.blocked' ? ' activity-entry--blocker' : ''}`}
                >
                  <span className="activity-entry__timestamp mono text-muted">
                    {formatTimestamp(ev.timestamp)}
                  </span>
                  <span
                    className="activity-entry__tag mono"
                    style={{ color: meta.color, backgroundColor: meta.bgColor }}
                  >
                    {meta.tag}
                  </span>
                  <span
                    className="activity-entry__source mono"
                    style={{ color: agentAccent(ev.source) }}
                  >
                    {'\u25CF'} {agentName(ev.source)}
                  </span>
                  <span className="activity-entry__summary">
                    {ev.summary}
                  </span>
                  <span className={`freshness-badge freshness-badge--${freshLabel} mono activity-entry__freshness`}>
                    {freshLabel}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <footer className="activity-status-bar mono">
        <span>{'\u27D0'} {events.length} events {'\u2502'} filtered: all agents, all types {'\u2502'} {new Date().toISOString().slice(11, 16)} UTC</span>
      </footer>
    </section>
  );
}
