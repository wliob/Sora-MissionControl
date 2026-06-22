/**
 * Panel — the base surface primitive for all mission-control sections.
 * Thin borders, low-luminance elevation, quiet by default.
 */

import type { CSSProperties, ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** When true, panel gets a subtle active border (cyan/violet) */
  active?: boolean;
  /** Active accent color token, defaults to cyan */
  accent?: string;
  /** Collapsible header label; rendered thin above content */
  label?: string;
  /** Optional right-aligned header accessory */
  accessory?: ReactNode;
}

export function Panel({
  children,
  className = '',
  style,
  active = false,
  accent = 'var(--accent-cyan)',
  label,
  accessory,
}: PanelProps) {
  const panelStyle: CSSProperties = {
    background: 'var(--bg-2)',
    border: `1px solid ${active ? accent : 'var(--border-base)'}`,
    boxShadow: active ? `0 0 0 1px ${accent}33, 0 0 16px ${accent}22` : 'none',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    /* Scope layout + paint so the panel is an independent rendering unit.
       Children that animate or reflow won't propagate cost to siblings. */
    contain: 'layout paint',
    transition: `border-color var(--dur-micro) var(--ease-out), box-shadow var(--dur-micro) var(--ease-out)`,
    ...style,
  };

  return (
    <section className={className} style={panelStyle}>
      {label && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--border-faint)',
            flexShrink: 0,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {label}
          </span>
          {accessory}
        </header>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </section>
  );
}