/**
 * OfficePanel — container for the embedded 3D office module.
 *
 * Mounts the OfficeModule which renders the PixiJS canvas, room tabs,
 * status bar, and agent info panel. In demo mode the office runs with
 * scripted mock data; when connected to the dashboard backbone it
 * receives live Kanban board data.
 *
 * Phase B: Wired to the /office route. Detects pop-out mode from URL params
 * and passes read-only contract to OfficeCanvas.
 */

import { useMemo } from 'react';
import { OfficeModule } from '@/office/components/OfficeModule';

export function OfficePanel() {
  // Detect demo mode from URL params (same convention as the standalone office)
  const isDemo = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('demo') === '1';
  }, []);

  // Detect pop-out mode for read-only contract
  const isPopout = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('popout') === '1';
  }, []);

  return (
    <div
      aria-label="3D office dashboard module"
      data-office-panel="phase-b"
      data-office-popout={isPopout ? 'true' : 'false'}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        background: 'var(--bg-0)',
        overflow: 'hidden',
      }}
    >
      <OfficeModule demoMode={isDemo} popoutMode={isPopout} />
    </div>
  );
}
