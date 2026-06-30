/**
 * LeadCard — Individual department lead card with restrained guild cueing.
 *
 * Compact operational summary: status dot, workload bar (htop-style),
 * blocker count, active project, last verified freshness.
 *
 * Styled with department accent bars, tab header, subtle corner accents,
 * portrait + role-title row, and terminal-style dividers.
 */

import { memo } from 'react';
import type { LeadSnapshot } from '@/types/team';
import { AGENTS, type AgentMeta } from '@/types/agents';
import { workloadDisplay } from '@/types/team';
import { PortraitImage } from '@/components/common/PortraitImage';
import { truthFreshnessLabel } from '@/utils/truthVocabulary';

interface LeadCardProps {
  snapshot: LeadSnapshot;
}

function statusDotColor(status: string): string {
  switch (status) {
    case 'ONLINE': return 'var(--crt-green, #00ff66)';
    case 'BUSY': return 'var(--crt-amber, #ffb000)';
    case 'BLOCKED': return 'var(--crt-red, #ff4444)';
    case 'IDLE': return '#666666';
    case 'OFFLINE': return '#444444';
    default: return '#666666';
  }
}

function statusPulse(status: string): boolean {
  return status === 'ONLINE' || status === 'BLOCKED';
}

/** Render htop-style workload bar segments */
function workloadBar(score: number, maxBlocks = 16): { filled: number; label: string; color: string; pulse: boolean } {
  const wl = workloadDisplay(score);
  // Each block ≈ 2-3 points, capped
  const filled = Math.min(Math.max(0, Math.round(score / 3)), maxBlocks);
  return { filled, label: `${wl.label} ${Math.round(score)}`, color: wl.color, pulse: wl.pulse };
}

export const LeadCard = memo(function LeadCard({ snapshot }: LeadCardProps) {
  const agent: AgentMeta | undefined = AGENTS.find(a => a.id === snapshot.agentId);
  if (!agent) return null;

  const wlBar = workloadBar(snapshot.workload.score);
  const agentId = snapshot.agentId;
  const freshnessLabel = truthFreshnessLabel(snapshot.freshness);

  return (
    <article
      className="lead-card"
      role="article"
      aria-label={`${agent.name} — ${agent.roleTitle} — ${snapshot.status.toLowerCase()} — ${wlBar.label.toLowerCase()}`}
      style={{
        borderColor: 'var(--team-card-border, rgba(60,90,130,0.18))',
      }}
      data-agent={agentId}
    >
      {/* Tab header */}
      <div
        className="lead-card__tab"
        style={{ borderLeftColor: `var(--agent-${agentId}, ${agent.accent})` }}
      >
        <span className="lead-card__tab-status mono">
          <span
            className={`lead-card__status-dot ${statusPulse(snapshot.status) ? 'pulse-status-dot' : ''}`}
            style={{ backgroundColor: statusDotColor(snapshot.status) }}
          />
          {' '}
          <span style={{ color: statusDotColor(snapshot.status) }}>
            {snapshot.status}
          </span>
        </span>
        <span className="lead-card__tab-workload mono text-dim">
          {wlBar.label}
        </span>
        {/* Guild chevron right */}
        <span className="lead-card__tab-chevron mono" aria-hidden="true">
          {'\u2726'}
        </span>
      </div>

      {/* Portrait + restrained role title row */}
      <div className="lead-card__identity">
        <PortraitImage
          agentId={agentId}
          size={40}
          className="lead-card__portrait"
          style={{
            borderColor: `var(--agent-${agentId}-glow, ${agent.accent})`,
            boxShadow: snapshot.status === 'ONLINE' || snapshot.status === 'BUSY'
              ? `0 0 6px var(--agent-${agentId}-glow, ${agent.accent})`
              : 'none',
          }}
        />
        <div
          className="lead-card__role-marker"
          style={{
            color: `var(--agent-${agentId}, ${agent.accent})`,
            borderColor: `var(--agent-${agentId}, ${agent.accent})`,
          }}
          aria-hidden="true"
        >
          {agent.roleGlyph}
        </div>
        <div className="lead-card__name-block">
          <span className="lead-card__name">{agent.name}</span>
          <span
            className="lead-card__role-title"
            style={{ color: `var(--agent-${agentId}, ${agent.accent})` }}
          >
            {agent.roleTitle}
          </span>
        </div>
      </div>

      {/* Workload section */}
      <div className="lead-card__section">
        <div className="lead-card__divider mono text-dim">
          {'\u2500\u2500\u252C\u2500'} workload {'\u2500\u2500\u2500'}
        </div>
        <div className="lead-card__workload-bar">
          <div
            className="lead-card__workload-fill"
            style={{
              width: `${(wlBar.filled / 16) * 100}%`,
              backgroundColor: wlBar.color,
            }}
          />
        </div>
        <div className="lead-card__workload-label mono" style={{ color: wlBar.color }}>
          {wlBar.label}
        </div>
      </div>

      {/* Blocker count */}
      {snapshot.blockers > 0 && (
        <div className="lead-card__blockers mono">
          <span style={{ color: 'var(--crt-red, #ff4444)' }}>[!]</span>
          {' BLOCKERS: '}
          <span style={{ color: 'var(--crt-red, #ff4444)' }}>{snapshot.blockers}</span>
        </div>
      )}

      {/* Active project */}
      {snapshot.activeProject && (
        <div className="lead-card__project mono text-dim">
          PROJECT: <span style={{ color: `var(--agent-${agentId}, ${agent.accent})` }}>{snapshot.activeProject}</span>
        </div>
      )}

      {/* Freshness + verified */}
      <div className="lead-card__freshness">
        <span className="mono text-dim">
          {snapshot.lastVerified ? `verified ${snapshot.lastVerified}` : 'not verified'}
        </span>
        <span className={`freshness-badge freshness-badge--${freshnessLabel}`}>
          {freshnessLabel}
        </span>
      </div>

      {/* Action */}
      <button type="button" className="lead-card__action mono">
        {'\u2570\u2500\u2500'} inspect
      </button>

      {/* Double-line corner accents (pseudo-elements in CSS) */}
    </article>
  );
});
