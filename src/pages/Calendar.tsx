/**
 * CalendarPage — Dual-role calendar dashboard: ranking input + warning system.
 *
 * Displays scheduled events with urgency tiers (CRITICAL, HIGH, WARNING,
 * SCHEDULED), a warning bar for overdue/approaching/missed items, and
 * rank-impact callouts. Time is rendered as a threat vector, not a friendly
 * agenda.
 *
 * Uses calendarStore for events and warnings.
 */

import { useCalendarState } from '@/state/calendarStore';
import { truthFreshnessLabel } from '@/utils/truthVocabulary';
import type { CalendarUrgency } from '@/types/calendar';
import { useEffect } from 'react';
import { refreshCalendarFromProxy } from '@/services/hermes/calendarAdapter';
import { getActiveAdminProxyToken } from '@/services/hermes/adminProxyAdapter';

// ── Urgency display ───────────────────────────────────────────────

const URGENCY_META: Record<string, { icon: string; label: string; color: string; borderColor: string; hasRankImpact: boolean }> = {
  urgent:    { icon: '\u25A0', label: 'CRITICAL',  color: 'var(--crt-red)',    borderColor: 'var(--crt-red)',    hasRankImpact: true },
  soon:      { icon: '\u25B2', label: 'HIGH',      color: 'var(--crt-red)',    borderColor: 'var(--crt-red)',    hasRankImpact: true },
  upcoming:  { icon: '\u25C6', label: 'WARNING',   color: 'var(--crt-amber)',  borderColor: 'var(--crt-amber)',  hasRankImpact: false },
  unknown:   { icon: '\u25B6', label: 'SCHEDULED', color: 'var(--crt-cyan)',   borderColor: 'transparent',       hasRankImpact: false },
};

const EVENT_TYPE_META: Record<string, { tag: string; color: string }> = {
  deadline:  { tag: '[DEADLINE ]', color: 'var(--crt-red)' },
  meeting:   { tag: '[MEETING  ]', color: 'var(--crt-cyan)' },
  scheduled: { tag: '[SCHEDULED]', color: 'var(--crt-amber)' },
  milestone: { tag: '[MILESTONE]', color: 'var(--crt-green)' },
  reminder:  { tag: '[REMINDER ]', color: 'var(--crt-amber)' },
  review:    { tag: '[REVIEW   ]', color: 'var(--crt-violet)' },
  system:    { tag: '[SYSTEM   ]', color: 'var(--text-muted)' },
  unknown:   { tag: '[UNKNOWN  ]', color: 'var(--text-dim)' },
};

function getUrgencyMeta(urgency: CalendarUrgency) {
  return URGENCY_META[urgency] ?? URGENCY_META.unknown;
}

function getEventTypeMeta(eventType: string) {
  return EVENT_TYPE_META[eventType] ?? EVENT_TYPE_META.unknown;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return `Today \u00B7 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]})`;
  if (diffDays === -1) return `Tomorrow \u00B7 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]})`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]})`;
}

// ── Component ─────────────────────────────────────────────────────

export function CalendarPage() {
  const state = useCalendarState();
  const { events, warnings, freshness } = state;
  const isMissing = freshness === 'missing';
  const freshLabel = truthFreshnessLabel(freshness);

  // Wire live calendar data from Hermes proxy
  useEffect(() => {
    if (freshness === 'missing') {
      const token = getActiveAdminProxyToken();
      refreshCalendarFromProxy(
        window.location.origin,
        token ?? '',
      );
    }
  }, [freshness]);

  // Group events by day
  const grouped = new Map<string, typeof events>();
  for (const ev of events) {
    const day = ev.timestamp.slice(0, 10);
    const list = grouped.get(day) ?? [];
    list.push(ev);
    grouped.set(day, list);
  }
  const dayKeys = [...grouped.keys()].sort(); // oldest first

  const overdueCount = events.filter(e => e.status === 'missed').length;
  const approachingCount = events.filter(e => e.urgency === 'soon').length;
  const now = new Date().toISOString().slice(11, 16);

  // ── Unavailable state ──────────────────────────────────────────
  if (isMissing) {
    return (
      <section className="dashboard-main-frame calendar-page">
        <div className="dashboard-header">
          <div className="dashboard-header-title-group">
            <div className="dashboard-placeholder-eyebrow mono">CALENDAR</div>
            <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Calendar</h2>
          </div>
          <span className="freshness-badge freshness-badge--unavailable mono">unavailable</span>
        </div>

        {/* Warning bar — summary only */}
        <div className="calendar-warning-bar calendar-warning-bar--offline mono">
          <span style={{ color: 'var(--crt-amber)' }}>{'\u26A0'} Source offline — calendar data unavailable</span>
        </div>

        {/* Filter bar — disabled */}
        <div className="calendar-filter-bar mono">
          <span className="text-dim">[All Events {'\u25BE'}]</span>
          <span className="text-dim">[All Types {'\u25BE'}]</span>
          <span className="text-dim">[Upcoming {'\u25BE'}]</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>{'\u27F3'} refresh</span>
        </div>

        <div className="calendar-empty-state">
          <div className="calendar-empty-panel">
            <span className="mono" style={{ color: 'var(--crt-amber)' }}>
              {'\u26A0'}  Calendar unavailable
            </span>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '12px' }}>
              The calendar data source is not connected.
              Check your connection to the Hermes runtime or admin proxy.
            </p>
            <p className="mono text-dim" style={{ marginTop: '8px' }}>
              Source: dashboard-api {'\u2502'} Status: offline
            </p>
          </div>
        </div>

        <footer className="calendar-status-bar mono">
          <span>{'\u27D0'} -- events {'\u2502'} system: OFFLINE {'\u2502'} {now} UTC</span>
        </footer>
      </section>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <section className="dashboard-main-frame calendar-page">
        <div className="dashboard-header">
          <div className="dashboard-header-title-group">
            <div className="dashboard-placeholder-eyebrow mono">CALENDAR</div>
            <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Calendar</h2>
          </div>
          <span className={`freshness-badge freshness-badge--${freshLabel} mono`}>{freshLabel}</span>
        </div>

        {/* Warning bar — hidden when no items */}
        {warnings.length > 0 && (
          <div className="calendar-warning-bar mono">
            <span style={{ color: 'var(--crt-amber)' }}>{'\u26A0'} {warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Filter bar */}
        <div className="calendar-filter-bar mono">
          <span className="text-muted">[All Events {'\u25BE'}]</span>
          <span className="text-muted">[All Types {'\u25BE'}]</span>
          <span className="text-muted">[Upcoming {'\u25BE'}]</span>
          <span style={{ marginLeft: 'auto', color: 'var(--guild-amber)' }}>{'\u27F3'} refresh</span>
        </div>

        <div className="calendar-empty-state">
          <div className="calendar-empty-panel">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-md)', fontWeight: 500 }}>
              No calendar data
            </span>
            <p style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginTop: '12px', maxWidth: '360px', textAlign: 'center' }}>
              No deadlines, meetings, scheduled jobs, or recurring
              work items are currently registered.
            </p>
          </div>
        </div>

        <footer className="calendar-status-bar mono">
          <span>{'\u27D0'} 0 events {'\u2502'} -- overdue {'\u00B7'} -- approaching {'\u00B7'} -- missed {'\u2502'} {now} UTC</span>
        </footer>
      </section>
    );
  }

  // ── Normal timeline ─────────────────────────────────────────────
  return (
    <section className="dashboard-main-frame calendar-page">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-title-group">
          <div className="dashboard-placeholder-eyebrow mono">CALENDAR</div>
          <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Calendar</h2>
          <span className="dashboard-header-count mono">{events.length}</span>
        </div>
        <span className={`freshness-badge freshness-badge--${freshLabel} mono`}>{freshLabel}</span>
      </div>

      {/* Warning bar */}
      {(overdueCount > 0 || approachingCount > 0 || warnings.length > 0) && (
        <div className={`calendar-warning-bar mono${overdueCount > 0 ? ' calendar-warning-bar--critical' : ''}`}>
          <span>
            {'\u26A0'} {overdueCount > 0 ? `${overdueCount} overdue \u00B7 ` : ''}
            {approachingCount > 0 ? `${approachingCount} approaching \u00B7 ` : ''}
            {warnings.length > 0 ? `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}` : ''}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', cursor: 'pointer' }}>[dismiss all]</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="calendar-filter-bar mono">
        <span className="text-muted">[All Events {'\u25BE'}]</span>
        <span className="text-muted">[All Types {'\u25BE'}]</span>
        <span className="text-muted">[Upcoming {'\u25BE'}]</span>
        <span style={{ marginLeft: 'auto', color: 'var(--guild-amber)' }}>{'\u27F3'} refresh</span>
      </div>

      {/* Timeline */}
      <div className="calendar-timeline" role="log" aria-live="polite">
        {dayKeys.map(day => (
          <div key={day} className="calendar-day-group">
            <div className="calendar-day-header mono">
              {'\u250C\u2500\u2500'} {getDayLabel(day + 'T00:00:00Z')} {'\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'}
            </div>
            {(grouped.get(day) ?? []).map((ev, i) => {
              const um = getUrgencyMeta(ev.urgency);
              const em = getEventTypeMeta(ev.eventType);
              const evFreshLabel = truthFreshnessLabel(ev.freshness);
              const isOverdue = ev.status === 'missed';
              const isCritical = ev.urgency === 'urgent';

              return (
                <div
                  key={`${ev.timestamp}-${i}`}
                  className={`calendar-entry${isCritical ? ' calendar-entry--critical' : ''}${isOverdue ? ' calendar-entry--overdue' : ''}`}
                  style={{ borderLeftColor: um.borderColor }}
                >
                  <div className="calendar-entry__header">
                    <span className="calendar-entry__timestamp mono" style={{ color: 'var(--text-primary)' }}>
                      {formatTimestamp(ev.timestamp)}
                    </span>
                    <span className="calendar-entry__tag mono" style={{ color: em.color }}>
                      {em.tag}
                    </span>
                    <span className="calendar-entry__urgency mono" style={{ color: um.color }}>
                      {um.icon} {um.label}
                    </span>
                    <span className={`freshness-badge freshness-badge--${evFreshLabel} mono`} style={{ marginLeft: 'auto' }}>
                      {evFreshLabel}
                    </span>
                  </div>

                  <div className="calendar-entry__title" style={{ color: 'var(--text-primary)' }}>
                    {ev.title}
                  </div>

                  <div className="calendar-entry__detail mono text-dim">
                    {ev.eventType === 'deadline' && (
                      isOverdue ? `OVERDUE by 2h` : `${formatTimestamp(ev.timestamp)} — upcoming`
                    )}
                    {ev.eventType === 'meeting' && 'Scheduled meeting'}
                    {ev.eventType === 'scheduled' && `Next run: ${formatTimestamp(ev.timestamp)}`}
                    {ev.eventType === 'milestone' && 'Project milestone'}
                    {ev.eventType === 'review' && 'Review scheduled'}
                    {ev.eventType === 'reminder' && 'Reminder'}
                  </div>

                  {um.hasRankImpact && (
                    <div className="calendar-entry__rank-impact mono" style={{ color: 'var(--crt-amber)' }}>
                      {'\u26A1'} Affects rank
                    </div>
                  )}

                  <button type="button" className="calendar-entry__action mono">
                    {'\u2570\u2500\u2500'} open detail
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <footer className="calendar-status-bar mono">
        <span>
          {'\u27D0'} {events.length} events {'\u2502'} {overdueCount} overdue {'\u00B7'} {approachingCount} approaching {'\u00B7'} {warnings.length} warning{warnings.length !== 1 ? 's' : ''} {'\u2502'} {now} UTC
        </span>
      </footer>
    </section>
  );
}
