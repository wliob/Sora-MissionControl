/**
 * CwsAdminPanel — tabbed admin surface for Cron, Webhook, and Skills management.
 *
 * This is the Phase 6 CWS admin sub-surface. It provides tabbed navigation
 * between "Cron Jobs", "Webhooks", and "Skills" panels, all built on the
 * cwsAdminStore with secret-safe masking and confirmation gating.
 *
 * Unlike KeyMcpAdminPanel, this panel does NOT use mock seed data. When
 * the CWS adapter is not bound, each sub-panel renders an unavailable
 * banner instead of fake healthy rows.
 */

import { useState } from 'react';
import { CronPanel } from '@/components/admin/CronPanel';
import { WebhookPanel } from '@/components/admin/WebhookPanel';
import { SkillsPanel } from '@/components/admin/SkillsPanel';
import { useCwsAdminState, hasCwsAdapter } from '@/state/cwsAdminStore';

type CwsTab = 'cron' | 'webhooks' | 'skills';

interface TabDef {
  id: CwsTab;
  label: string;
  count?: number;
}

export function CwsAdminPanel() {
  const [tab, setTab] = useState<CwsTab>('cron');
  const state = useCwsAdminState();
  const adapterBound = hasCwsAdapter();

  const tabs: TabDef[] = [
    { id: 'cron', label: 'Cron', count: adapterBound ? state.cronJobs.length : undefined },
    { id: 'webhooks', label: 'Webhooks', count: adapterBound ? state.webhooks.length : undefined },
    { id: 'skills', label: 'Skills', count: adapterBound ? state.skills.length : undefined },
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
          NO ADAPTER BOUND · connect a Hermes backend to manage cron jobs, webhooks, and skills
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
        {tab === 'cron' && <CronPanel />}
        {tab === 'webhooks' && <WebhookPanel />}
        {tab === 'skills' && <SkillsPanel />}
      </div>
    </div>
  );
}
