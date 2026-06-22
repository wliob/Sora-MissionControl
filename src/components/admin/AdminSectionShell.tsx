/**
 * AdminSectionShell — standard header + scrollable body for an admin subsection.
 * Provides the consistent panel chrome used by KeysPanel, McpPanel, etc.
 */

import type { ReactNode } from 'react';

interface AdminSectionShellProps {
  title: string;
  /** Optional count badge shown in the header. */
  count?: number;
  /** Optional header-right accessory (e.g. "Add" button). */
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminSectionShell({ title, count, actions, children }: AdminSectionShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
          {count !== undefined && (
            <span
              className="mono"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                padding: '1px 6px',
                background: 'var(--surface-base)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-faint)',
              }}
            >
              {count}
            </span>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: 'var(--space-2)' }}>{actions}</div>}
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 'var(--space-3) var(--space-4)',
        }}
      >
        {children}
      </div>
    </div>
  );
}