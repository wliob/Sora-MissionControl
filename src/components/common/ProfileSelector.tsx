/**
 * ProfileSelector — compact presence rail for the chat command surface.
 * Keeps the selected agent prominent while the rest read as quiet callsigns.
 */

import type { AgentId, AgentMeta } from '@/types';
import { AGENTS } from '@/types';

interface ProfileSelectorProps {
  selected: AgentId | null;
  onSelect: (agent: AgentId) => void;
  /** Per-agent activity hints for presence dots */
  activity?: Partial<Record<AgentId, 'idle' | 'working' | 'blocked'>>;
}

function callsign(agent: AgentMeta): string {
  return agent.name.slice(0, 3).toUpperCase();
}

export function ProfileSelector({
  selected,
  onSelect,
  activity = {},
}: ProfileSelectorProps) {
  return (
    <div
      aria-label="Presence rail"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        borderBottom: '1px solid var(--border-faint)',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        Presence
      </span>
      {AGENTS.map((agent: AgentMeta) => {
        const isActive = selected === agent.id;
        const act = activity[agent.id] ?? 'idle';
        const dotColor = isActive
          ? agent.accent
          : act === 'blocked'
            ? 'var(--accent-red)'
            : act === 'working'
              ? 'var(--accent-cyan)'
              : 'var(--text-muted)';
        return (
          <button
            key={agent.id}
            type="button"
            data-profile-selector-agent={agent.id}
            aria-pressed={isActive ? 'true' : 'false'}
            aria-label={`${agent.name} — ${agent.role}`}
            onClick={() => onSelect(agent.id)}
            title={`${agent.name} — ${agent.role}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '4px 10px',
              background: isActive ? `${agent.accent}12` : 'transparent',
              border: `1px solid ${isActive ? agent.accent : 'var(--border-faint)'}`,
              borderRadius: '999px',
              cursor: 'pointer',
              transition: 'border-color var(--dur-micro) var(--ease-out), background-color var(--dur-micro) var(--ease-out)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: dotColor,
                opacity: act === 'idle' && !isActive ? 0.55 : 1,
                boxShadow: isActive ? `0 0 8px ${agent.accent}` : 'none',
                flexShrink: 0,
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: 'var(--text-xs)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              {callsign(agent)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
