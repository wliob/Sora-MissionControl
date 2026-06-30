/**
 * UnifiedAdminSurface — top-level tabbed container for all admin sub-surfaces.
 *
 * Hosts:
 *  - Models (ModelAdminPanel from src/components/shell/AdminPanel.tsx)
 *  - API Keys + MCP Servers (KeyMcpAdminPanel)
 *  - Cron, Webhooks, Skills (CwsAdminPanel)
 *
 * The tab strip is quiet and scan-friendly, matching the MissionBar
 * navigation style. The body fills the remaining space.
 */

import { useState } from 'react';
import { ModelAdminPanel } from '@/components/shell/AdminPanel';
import { KeyMcpAdminPanel } from '@/components/admin/KeyMcpAdminPanel';
import { CwsAdminPanel } from '@/components/admin/CwsAdminPanel';
import { AdminProxyAuthControl } from '@/components/admin/AdminProxyAuthControl';

type AdminSection = 'models' | 'keysmcp' | 'cws';

export function UnifiedAdminSurface() {
  const [section, setSection] = useState<AdminSection>('models');

  const tabs: { id: AdminSection; label: string }[] = [
    { id: 'models', label: 'Model routing' },
    { id: 'keysmcp', label: 'Access & Links' },
    { id: 'cws', label: 'Schedulers & Hooks' },
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
      {/* Section tab strip */}
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
          const active = section === t.id;
          return (
            <button
              key={t.id}
              className="admin-tab"
              onClick={() => setSection(t.id)}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent-violet)' : 'transparent'}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <AdminProxyAuthControl />

      {/* Section body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {section === 'models' && <ModelAdminPanel />}
        {section === 'keysmcp' && <KeyMcpAdminPanel />}
        {section === 'cws' && <CwsAdminPanel />}
      </div>
    </div>
  );
}
