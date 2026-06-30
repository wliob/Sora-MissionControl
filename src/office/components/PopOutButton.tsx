/**
 * PopOutButton — Pop-out + full-screen toggle for the Office immersive screen.
 *
 * Phase B: Two icon buttons in the RoomTabs bar area:
 *   [⛶] Full-screen: Toggles full-screen mode via element.requestFullscreen()
 *   [↗] Pop-out:    Opens /office?popout=1 in a dedicated named window
 *
 * The pop-out window enforces a read-only contract:
 *   - No nav rail, no MissionBar
 *   - OfficeCanvas + ConductorStation + StatusBar only
 *   - No commands, no chat, no task actions
 *   - Subsequent clicks focus the existing named window
 */

import { useState, useCallback, useEffect } from 'react';

export function PopOutButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track full-screen state changes
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Silently ignore — some browsers block programmatic fullscreen
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handlePopOut = useCallback(() => {
    const url = '/office?popout=1';
    const features = 'width=1200,height=800,resizable=yes,scrollbars=no';
    // Named window 'sora-office' — subsequent clicks focus existing window
    window.open(url, 'sora-office', features);
  }, []);

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
    border: 'none',
    borderRadius: 'var(--radius-sm, 4px)',
    background: 'transparent',
    color: 'rgba(240, 232, 216, 0.6)',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    transition: 'background 0.15s, color 0.15s',
  };

  const hoverBg = 'rgba(240, 232, 216, 0.08)';
  const activeBg = 'rgba(240, 232, 216, 0.15)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Full-screen toggle */}
      <button
        type="button"
        title={isFullscreen ? 'Exit full screen' : 'Toggle full screen'}
        aria-label={isFullscreen ? 'Exit full screen' : 'Toggle full screen'}
        onClick={handleFullscreen}
        style={btnStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = activeBg;
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
        }}
      >
        {isFullscreen ? '⛶' : '⛶'}
      </button>

      {/* Pop-out */}
      <button
        type="button"
        title="Open Office in own window"
        aria-label="Open Office in own window"
        onClick={handlePopOut}
        style={btnStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = activeBg;
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
        }}
      >
        ↗
      </button>
    </div>
  );
}
