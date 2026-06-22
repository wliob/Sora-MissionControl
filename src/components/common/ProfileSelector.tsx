/**
 * ProfileSelector — compact agent rail for the chat command surface.
 * Per-agent accent markers; selects the active chat profile.
 */

import type { AgentId, AgentMeta } from '@/types';
import { AGENTS } from '@/types';

interface ProfileSelectorProps {
  selected: AgentId | null;
  onSelect: (agent: AgentId) => void;
  /** Per-agent activity hints for presence dots */
  activity?: Partial<Record<AgentId, 'idle' | 'working' | 'blocked'>>;
}

export function ProfileSelector({
  selected,
  onSelect,
  activity = {},
}: ProfileSelectorProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-2) var(--space-3)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        borderBottom: '1px solid var(--border-faint)',
      }}
    >
      {AGENTS.map((agent: AgentMeta) => {
        const isActive = selected === agent.id;
        const act = activity[agent.id] ?? 'idle';
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            title={`${agent.name} — ${agent.role}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '4px 10px',
              background: isActive ? `${agent.accent}15` : 'transparent',
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
                background: agent.accent,
                opacity: act === 'idle' ? 0.35 : 1,
                boxShadow:
                  act === 'working' || act === 'blocked'
                    ? `0 0 6px ${agent.accent}`
                    : 'none',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 500 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {agent.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}