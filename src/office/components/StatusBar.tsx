// ── StatusBar — bottom bar showing agent activity snippets ──────────────
//
// Adapted from the standalone office's status bar in OfficeShell.
// Uses inline styles matching the dashboard's theme tokens.

import type { AgentState } from '@/office/engine/AgentStateMachine';
import type { AgentAssetError } from '@/office/entities/Agent';
import type { GameRuntimeStats } from '@/office/engine/GameRuntime';
import { AGENT_DESKS } from '@/office/engine/iso';

const AGENT_COLORS: Record<string, string> = {};
for (const desk of AGENT_DESKS) {
  AGENT_COLORS[desk.id] = '#' + desk.color.toString(16).padStart(6, '0');
}

/** Control-room activity snippets for the status bar. */
function getAgentSnippet(agent: AgentState): string {
  switch (agent.activity) {
    case 'working':
      return agent.task
        ? `${agent.name} is working on "${agent.task.title}"`
        : `${agent.name} is busy…`;
    case 'idle':
      return agent.zone === 'break_room'
        ? `${agent.name} is in break-room standby`
        : `${agent.name} is waiting for work`;
    case 'reviewing':
      return agent.task
        ? `${agent.name} is reviewing "${agent.task.title}"`
        : `${agent.name} is in review`;
    case 'blocked':
      return `${agent.name} is blocked — needs help`;
    case 'celebrating':
      return `${agent.name} closed a task`;
    case 'moving':
      return `${agent.name} is on the move…`;
    default:
      return `${agent.name}: ${agent.activity}`;
  }
}

export interface StatusBarProps {
  agents: Map<string, AgentState>;
  runtimeStats?: GameRuntimeStats | null;
  /** Spritesheet load failures (Sora audit #4 / R12); when non-empty, a subtle amber indicator is shown. */
  assetErrors?: AgentAssetError[];
}

export function StatusBar({ agents, runtimeStats, assetErrors }: StatusBarProps) {
  const agentList = Array.from(agents.values());

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 16px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '6px 16px',
      }}
    >
      {runtimeStats && (
        <div
          className="mono"
          title="Office canvas runtime"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--text-xs)',
            color: 'var(--text-dim)',
            padding: '2px 8px',
            border: '1px solid var(--border-faint)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-base)',
          }}
        >
          <span style={{ color: 'var(--accent-cyan)' }}>{runtimeStats.performanceMode.toUpperCase()}</span>
          <span>{runtimeStats.fps} FPS</span>
          <span>{runtimeStats.renderer}</span>
          {runtimeStats.reducedMotion && <span>REDUCED MOTION</span>}
        </div>
      )}
      {assetErrors && assetErrors.length > 0 && (
        <div
          className="mono"
          title={`Spritesheet load failures:\n${assetErrors.map((e) => `  ${e.agentId} / ${e.animType}`).join('\n')}\nAgents are using static fallback textures.`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--text-xs)',
            color: 'var(--text-dim)',
            padding: '2px 8px',
            border: '1px solid #6b5400',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(107, 84, 0, 0.15)',
          }}
        >
          <span style={{ color: '#e8b339' }}>⚠ ASSET</span>
          <span>{assetErrors.length} fallback{assetErrors.length > 1 ? 's' : ''}</span>
        </div>
      )}
      {agentList.length > 0 ? (
        agentList.map((agent) => {
          const color = AGENT_COLORS[agent.agentId] ?? '#888888';
          return (
            <div
              key={agent.agentId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--text-xs)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: color,
                }}
              />
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {getAgentSnippet(agent)}
              </span>
            </div>
          );
        })
      ) : (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
          No active agent telemetry is reporting work right now.
        </p>
      )}
    </div>
  );
}