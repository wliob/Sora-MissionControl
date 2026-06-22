// ── RoomTabs — horizontal tab bar for office zone navigation ───────────
//
// Adapted from the standalone office's RoomTabs. Uses inline styles
// matching the dashboard's theme tokens instead of Tailwind.

import { useState, useCallback } from 'react';
import { ZONES, type ZoneDef } from '@/office/engine/iso';

const ROOM_ZONES = ZONES.filter((z) => !z.isWalkway);

const ZONE_CODES: Record<string, string> = {
  workstations: 'WRK',
  collaboration: 'COL',
  break_room: 'BRK',
  archive: 'ARC',
};

export interface RoomTabsProps {
  onFocusZone?: (zone: ZoneDef | null) => void;
  activeZone?: string | null;
}

export function RoomTabs({ onFocusZone, activeZone }: RoomTabsProps) {
  const [internalActive, setInternalActive] = useState<string | null>(null);
  const currentActive = activeZone ?? internalActive;

  const handleTap = useCallback(
    (zone: ZoneDef) => {
      setInternalActive(zone.id);
      onFocusZone?.(zone);
    },
    [onFocusZone],
  );

  const handleOverview = useCallback(() => {
    setInternalActive(null);
    onFocusZone?.(null);
  }, [onFocusZone]);

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        padding: '4px 8px',
      }}
    >
      <TabButton
        active={currentActive === null}
        onClick={handleOverview}
        code="ALL"
      >
        All Zones
      </TabButton>
      {ROOM_ZONES.map((zone) => (
        <TabButton
          key={zone.id}
          active={currentActive === zone.id}
          onClick={() => handleTap(zone)}
          code={ZONE_CODES[zone.id] ?? 'ZON'}
        >
          {zone.name}
        </TabButton>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  code,
  children,
}: {
  active: boolean;
  onClick: () => void;
  code: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className="room-tab"
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 'var(--radius-lg)',
        fontSize: 'var(--text-xs)',
        fontWeight: active ? 500 : 400,
        border: '1px solid var(--border-base)',
        color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
        background: active
          ? 'linear-gradient(180deg, var(--accent-cyan-glow), var(--surface-base))'
          : 'transparent',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 9,
          fontWeight: 650,
          letterSpacing: '0.08em',
          color: active ? 'var(--bg-0)' : 'var(--text-dim)',
          background: active ? 'var(--accent-cyan)' : 'var(--status-unknown-bg)',
          border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-base)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '1px 4px',
          lineHeight: 1.2,
        }}
      >
        {code}
      </span>
      {children}
    </button>
  );
}