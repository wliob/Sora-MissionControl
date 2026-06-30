/**
 * TeamPage — Phase A Team Command Surface.
 *
 * Layout: GuildInsignia watermark → AttentionRail → TeamGrid (LeadCards + SoraStation) →
 * DelegationLines overlay → Status bar (tmux-style).
 *
 * All data comes from teamStore (derived from boardStore + projectControlStore).
 */

import { useEffect } from 'react';
import { AttentionRail } from '@/components/team/AttentionRail';
import { LeadCard } from '@/components/team/LeadCard';
import { SoraConductorStation } from '@/components/team/SoraConductorStation';
import { DelegationLines } from '@/components/team/DelegationLines';
import { GuildInsignia } from '@/components/team/GuildInsignia';
import { useTeamState, refreshTeamState } from '@/state/teamStore';
import type { AgentId } from '@/types/agents';

function healthColor(health: string): string {
  switch (health) {
    case 'verified': return 'var(--crt-green, #00ff66)';
    case 'degraded': return 'var(--crt-amber, #ffb000)';
    case 'unavailable': return 'var(--crt-red, #ff4444)';
    default: return 'var(--text-muted)';
  }
}

export function TeamPage() {
  const teamState = useTeamState();

  // Refresh on mount
  useEffect(() => {
    refreshTeamState();
  }, []);

  // Layout: 7 agent cards in grid order.
  // Row 1: Cloud, Biscuit, Korra, Lelouch
  // Row 2: Tifa, Sora (spans 2 cols), Rain, (empty)
  const row1Agents: AgentId[] = ['cloud', 'biscuit', 'korra', 'lelouch'];
  const soraSnap = teamState.leadSnapshots.find(s => s.agentId === 'sora');
  const tifaSnap = teamState.leadSnapshots.find(s => s.agentId === 'tifa');
  const rainSnap = teamState.leadSnapshots.find(s => s.agentId === 'rain');

  const otherSnaps = teamState.leadSnapshots.filter(
    s => !['sora', 'tifa', 'rain'].includes(s.agentId) && row1Agents.includes(s.agentId as AgentId)
  );

  // Sort row1Agents by their order
  const sortedRow1 = row1Agents
    .map(id => otherSnaps.find(s => s.agentId === id))
    .filter(Boolean);

  const now = new Date();
  const utcTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;

  return (
    <div className={`team-page${teamState.freshness === 'missing' ? ' team-page--demo' : ''}`}>
      {/* Background watermark */}
      <div className="team-page__watermark" aria-hidden="true">
        <GuildInsignia size={240} opacity={0.035} />
      </div>

      {/* Attention rail */}
      <AttentionRail items={teamState.attentionItems} />

      {/* Team grid */}
      <div className="team-grid">
        {/* Row 1 */}
        {sortedRow1.map(snap => snap && (
          <LeadCard key={snap.agentId} snapshot={snap} />
        ))}

        {/* Row 2 */}
        {tifaSnap && <LeadCard snapshot={tifaSnap} />}

        {/* Sora station (spans 2 cols) */}
        {soraSnap && (
          <SoraConductorStation
            soraSnapshot={soraSnap}
            dispatchLog={teamState.dispatchLog}
            agentCount={teamState.agentCount}
            onlineCount={teamState.onlineCount}
            delegationCount={teamState.delegationEdges.length}
            systemHealth={teamState.systemHealth}
            uptime={teamState.uptime}
          />
        )}

        {rainSnap && <LeadCard snapshot={rainSnap} />}

        {/* Empty cell (col 4, row 2) — watermark spot */}
        <div className="team-grid__empty-cell" aria-hidden="true" />
      </div>

      {/* Delegation lines overlay */}
      <DelegationLines
        edges={teamState.delegationEdges}
        cardRects={[]}
        viewWidth={1200}
        viewHeight={600}
      />

      {/* Demo mode indicator */}
      {teamState.freshness === 'missing' && (
        <div className="team-page__demo-badge mono">
          [unavailable]
        </div>
      )}

      {/* Status bar (tmux-style) */}
      <footer className="team-status-bar mono">
        <span className="team-status-bar__guild" aria-hidden="true">
          {'\u27D0'}
        </span>
        <span style={{ color: teamState.onlineCount === teamState.agentCount ? 'var(--crt-green, #00ff66)' : 'var(--crt-amber, #ffb000)' }}>
          {teamState.onlineCount}/{teamState.agentCount} agents
        </span>
        <span className="team-status-bar__divider">{'\u2502'}</span>
        <span className="text-dim">
          {teamState.delegationEdges.length} delegations
        </span>
        <span className="team-status-bar__divider">{'\u2502'}</span>
        <span className="text-dim">system: </span>
        <span style={{ color: healthColor(teamState.systemHealth) }}>
          {teamState.systemHealth}
        </span>
        <span className="team-status-bar__divider">{'\u2502'}</span>
        <span className="text-dim">{utcTime}</span>
      </footer>
    </div>
  );
}
