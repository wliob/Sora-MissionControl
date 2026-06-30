/**
 * SoraConductorStation — Sora's dual-pane central conductor station.
 *
 * Left pane: dispatch log (ops terminal) with portrait, role marker, log entries.
 * Right pane: guild insignia + aggregate stats (heraldry summary).
 *
 * Spans 2 grid columns, elevated visual presence with warm platinum accent
 * and double-line tab header.
 */

import { memo } from 'react';
import { AGENTS } from '@/types/agents';
import type { LeadSnapshot, DispatchLogEntry } from '@/types/team';
import { GuildInsignia } from './GuildInsignia';
import { PortraitImage } from '@/components/common/PortraitImage';
import { truthFreshnessLabel } from '@/utils/truthVocabulary';

interface SoraConductorStationProps {
  soraSnapshot: LeadSnapshot;
  dispatchLog: DispatchLogEntry[];
  agentCount: number;
  onlineCount: number;
  delegationCount: number;
  systemHealth: string;
  uptime: string | null;
}

function healthColor(health: string): string {
  switch (health) {
    case 'verified': return 'var(--crt-green, #00ff66)';
    case 'degraded': return 'var(--crt-amber, #ffb000)';
    case 'unavailable': return 'var(--crt-red, #ff4444)';
    default: return 'var(--text-muted)';
  }
}

export const SoraConductorStation = memo(function SoraConductorStation({
  soraSnapshot,
  dispatchLog,
  agentCount,
  onlineCount,
  delegationCount,
  systemHealth,
  uptime,
}: SoraConductorStationProps) {
  const soraMeta = AGENTS.find(a => a.id === 'sora');
  if (!soraMeta) return null;
  const freshnessLabel = truthFreshnessLabel(soraSnapshot.freshness);

  return (
    <article
      className="sora-station"
      role="article"
      aria-label="Sora — Conductor — conducting"
    >
      {/* Double-line tab header */}
      <div className="sora-station__tab">
        <div className="sora-station__tab-double">
          <span className="sora-station__tab-left mono">
            {'\u2554\u2550\u2550'} sora:guild-master {'\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'}
          </span>
          <span className="sora-station__tab-right mono" aria-hidden="true">
            {'\u2726 \u2726 \u2726 \u2550\u2550\u2550\u2557'}
          </span>
        </div>
        <div className="sora-station__tab-status">
          <span className="mono" style={{ color: healthColor(systemHealth) }}>
            {'\u25CF'} CONDUCTING
          </span>
          <span className="mono text-dim">
            SYSTEM {systemHealth}
          </span>
          <span className="sora-station__tab-guild mono" aria-hidden="true">
            {'\u27D0'} GUILD
          </span>
        </div>
      </div>

      {/* Dual-pane body */}
      <div className="sora-station__body">
        {/* Left pane: dispatch log */}
        <div className="sora-station__left">
          <div className="sora-station__identity">
            <PortraitImage
              agentId="sora"
              size={48}
              className="sora-station__portrait"
              style={{ borderColor: 'var(--agent-sora-glow, rgba(240,232,216,0.20))' }}
            />
            <div
              className="sora-station__role-marker"
              style={{ borderColor: 'var(--agent-sora, #f0e8d8)' }}
              aria-hidden="true"
            >
              {soraMeta.roleGlyph}
            </div>
            <div className="sora-station__name-block">
              <span className="sora-station__name" style={{ color: 'var(--agent-sora, #f0e8d8)' }}>
                SORA
              </span>
              <span className="sora-station__role-title" style={{ color: 'var(--agent-sora, #f0e8d8)' }}>
                {soraMeta.roleTitle}
              </span>
            </div>
          </div>

          <div className="sora-station__divider mono text-dim">
            {'\u2500\u2500\u252C\u2500'} dispatch log {'\u2500\u2500\u2500'}
          </div>

          <div className="sora-station__log" role="log" aria-live="polite">
            {dispatchLog.length === 0 ? (
              <span className="sora-station__log-empty mono text-dim">
                {'\u2500\u2500'} no entries {'\u2500\u2500'}
              </span>
            ) : (
              dispatchLog.map((entry, i) => (
                <div key={i} className="sora-station__log-entry mono">
                  <span className="text-dim">{entry.timestamp}</span>
                  <span className="text-secondary">{entry.operation}</span>
                  <span className="text-muted">{entry.result}</span>
                </div>
              ))
            )}
          </div>

          <div className="sora-station__freshness">
            <span className="mono text-dim">
              {soraSnapshot.lastVerified ? `verified ${soraSnapshot.lastVerified}` : 'not verified'}
            </span>
            <span className={`freshness-badge freshness-badge--${freshnessLabel}`}>
              {freshnessLabel}
            </span>
          </div>

          <button type="button" className="sora-station__action mono">
            {'\u2570\u2500\u2500'} open terminal
          </button>
        </div>

        {/* Vertical divider */}
        <div className="sora-station__divider-v" />

        {/* Right pane: guild summary */}
        <div className="sora-station__right">
          <div className="sora-station__summary-frame">
            <div className="sora-station__summary-title mono">
              GUILD INSIGNIA
            </div>
            <div className="sora-station__insignia">
              <GuildInsignia size={48} opacity={0.15} />
            </div>
            <div className="sora-station__stats mono">
              <div>
                <span className="text-dim">{'\u27D0 '}</span>
                <span style={{ color: onlineCount === agentCount ? 'var(--crt-green, #00ff66)' : 'var(--crt-amber, #ffb000)' }}>
                  {onlineCount}/{agentCount} agents active
                </span>
              </div>
              <div className="text-dim">
                {delegationCount} delegations live
              </div>
              <div>
                <span className="text-dim">system: </span>
                <span style={{ color: healthColor(systemHealth) }}>{systemHealth}</span>
              </div>
              {uptime && (
                <div className="text-dim">
                  uptime: {uptime}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
