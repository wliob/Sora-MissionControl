/**
 * OfficePage — standalone immersive office page for the /office route.
 *
 * Phase B: Compose OfficeModule with loading/error/empty state handling.
 * Supports ?popout=1 for read-only pop-out window mode.
 *
 * The pop-out window renders a minimal shell: no nav rail, no MissionBar,
 * just the OfficeCanvas + ConductorStation + StatusBar.
 */

import { useMemo } from 'react';
import { OfficeModule } from '@/office/components/OfficeModule';
import { OfficeErrorBoundary } from '@/office/components/OfficeErrorBoundary';
import { ConductorStation } from '@/office/components/ConductorStation';

export function OfficePage() {
  // Detect pop-out mode from URL params.
  const isPopout = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('popout') === '1';
  }, []);

  const isDemo =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('demo') === '1';

  // Pop-out mode: minimal shell
  if (isPopout) {
    return (
      <div
        data-office-page="popout"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--bg-0, #0b111a)',
        }}
      >
        <OfficeErrorBoundary>
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <OfficeModule demoMode={isDemo} popoutMode />
            {/* ConductorStation overlay positioned absolutely over the canvas */}
            <ConductorStation />
          </div>
        </OfficeErrorBoundary>
      </div>
    );
  }

  // Full shell mode: renders within the dashboard's ShellLayout frame.
  return (
    <div
      data-office-page="full"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <OfficeErrorBoundary>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <OfficeModule demoMode={isDemo} />
          <ConductorStation />
        </div>
      </OfficeErrorBoundary>
    </div>
  );
}
