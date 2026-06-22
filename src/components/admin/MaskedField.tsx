/**
 * MaskedField — displays a masked secret value with a label.
 * Cannot be revealed; the raw value is never in the DOM.
 */

import type { ReactNode } from 'react';

interface MaskedFieldProps {
  label: string;
  /** The masked display value, e.g. "sk-••••4f2a". */
  value: string | null | undefined;
  /** Optional status indicator shown next to the label. */
  status?: ReactNode;
  /** Monospace font for secret-like values. */
  mono?: boolean;
}

export function MaskedField({ label, value, status, mono = true }: MaskedFieldProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        {status}
      </div>
      <span
        className={mono ? 'mono' : ''}
        style={{
          fontSize: 'var(--text-sm)',
          color: value ? 'var(--text-secondary)' : 'var(--text-dim)',
          fontStyle: value ? 'normal' : 'italic',
        }}
      >
        {value || '— not set —'}
      </span>
    </div>
  );
}