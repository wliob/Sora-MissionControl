/**
 * MissionBar — thin top chrome: product identity, global connection state,
 * current mode, and primary navigation. Quiet, never a site map.
 */

import type { PrimaryView } from '@/types';
import { useShellState, shellStore } from '@/state/shellStore';
import { StatusPill } from '@/components/common/StatusPill';

const NAV_ITEMS: { id: PrimaryView; label: string }[] = [
  { id: 'office', label: 'Office' },
  { id: 'chat', label: 'Chat' },
  { id: 'ops', label: 'Telemetry' },
  { id: 'admin', label: 'Control' },
  { id: 'kanban', label: 'Kanban' },
];

export function MissionBar() {
  const { view, connection, fps } = useShellState();

  return (
    <header className="mission-bar">
      {/* Identity */}
      <div className="mission-brand">
        <div className="mission-glyph" />
        <span className="mission-title">
          Sora Mission Control
        </span>
      </div>

      {/* Connection health — first-screen priority #1 */}
      <div className="mission-health">
        <StatusPill state={connection} pulse size="sm" />
        {fps > 0 && (
          <span
            className="mono"
            style={{
              fontSize: 'var(--text-xs)',
              color: fps < 30 ? 'var(--accent-amber)' : 'var(--text-dim)',
              minWidth: '52px',
            }}
          >
            {fps} fps
          </span>
        )}
      </div>

      {/* Primary navigation — quiet, scan-friendly */}
      <nav className="mission-nav">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => shellStore.setView(item.id)}
              className={`nav-tab${active ? ' nav-tab-active' : ''}`}
              data-active={active ? 'true' : 'false'}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}