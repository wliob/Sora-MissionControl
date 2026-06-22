/**
 * KeyMcpAdminPanel — tabbed admin surface for Keys and MCP management.
 *
 * This is the Phase 6/7 admin sub-surface for API keys and MCP servers.
 * It provides tabbed navigation between "API Keys" and "MCP Servers"
 * panels, both built on the adminKeyMcpStore with secret-safe masking
 * and confirmation gating for destructive actions.
 *
 * When no Key/MCP adapter is bound, this panel renders an explicit
 * "NO ADAPTER BOUND" banner and the sub-panels disable all mutating
 * controls. The store starts empty (no mock seed data) so the UI
 * cannot look healthy when there is no verified backend.
 *
 * The sibling ModelAdminPanel (src/components/shell/AdminPanel.tsx) handles
 * model management. Both are rendered inside the ShellLayout's admin view.
 */

import { useState } from 'react';
import { KeysPanel } from '@/components/admin/KeysPanel';
import { McpPanel } from '@/components/admin/McpPanel';
import { useKeyMcpAdminState, hasKeyMcpAdapter } from '@/state/adminKeyMcpStore';

type AdminTab = 'keys' | 'mcp';

interface TabDef {
  id: AdminTab;
  label: string;
  /** Badge count shown in the tab. */
  count?: number;
}

export function KeyMcpAdminPanel() {
  const [tab, setTab] = useState<AdminTab>('keys');
  const state = useKeyMcpAdminState();
  const adapterBound = hasKeyMcpAdapter();

  const tabs: TabDef[] = [
    { id: 'keys', label: 'API Keys', count: adapterBound ? state.keys.length : undefined },
    { id: 'mcp', label: 'MCP Servers', count: adapterBound ? state.mcpEntries.length : undefined },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--bg-1)',
      }}
    >
      {!adapterBound && (
        <div
          className="mono"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderBottom: '1px solid var(--text-dim)22',
            background: 'var(--surface-base)',
            color: 'var(--text-dim)',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          NO ADAPTER BOUND · connect a Hermes backend to manage API keys and MCP servers
        </div>
      )}

      {/* Tab strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '0 var(--space-3)',
          borderBottom: '1px solid var(--border-base)',
          flexShrink: 0,
          background: 'var(--bg-1)',
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              className="admin-tab"
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent-cyan)' : 'transparent'}`,
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className="mono"
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: active ? 'var(--text-muted)' : 'var(--text-dim)',
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'keys' && <KeysPanel />}
        {tab === 'mcp' && <McpPanel />}
      </div>
    </div>
  );
}
