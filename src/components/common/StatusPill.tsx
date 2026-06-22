/**
 * StatusPill — connection / source health indicator.
 * Compact, glow-on-state. Never green unless actually connected.
 */

import type { ConnectionState } from '@/types';
import { STATUS_META } from '@/types';

interface StatusPillProps {
  state: ConnectionState;
  label?: string;
  size?: 'sm' | 'md';
  /** When true, adds a subtle pulsing glow for live indicators */
  pulse?: boolean;
}

export function StatusPill({
  state,
  label,
  size = 'sm',
  pulse = false,
}: StatusPillProps) {
  const meta = STATUS_META[state];
  const h = size === 'sm' ? 18 : 22;
  const px = size === 'sm' ? 8 : 10;

  const dotPulse = pulse && state === 'connected';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: `${h}px`,
        padding: `0 ${px}px`,
        borderRadius: '999px',
        background: meta.bg,
        border: `1px solid ${meta.color}44`,
        color: meta.color,
        fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className={dotPulse ? 'pulse-status-dot' : ''}
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: meta.color,
          boxShadow: `0 0 6px ${meta.color}`,
          flexShrink: 0,
        }}
      />
      {label ?? meta.label}
    </span>
  );
}