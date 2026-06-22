// ── OfficeCanvas — PixiJS canvas host for the embedded office ───────────
//
// Adapted from the standalone office's CanvasHost. Uses inline styles
// (not Tailwind) to match the dashboard's styling convention. Manages:
// - GameRuntime boot/destroy lifecycle
// - Pointer drag pan, pinch/wheel zoom
// - Agent selection + long-press follow camera
// - Runtime error screen with retry

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { GameRuntime, AtlasUnavailableError, type GameRuntimeStats } from '@/office/engine/GameRuntime';
import { isWebGLUnavailableError, WEBGL_COMPATIBILITY_URL } from '@/office/engine/webglDetector';
import type { AgentAssetError } from '@/office/entities/Agent';
import { AGENT_DESKS, type AgentDesk, type ZoneDef, ZONES } from '@/office/engine/iso';
import { registerInstance, deregisterInstance } from "@/office/components/instanceGuard";

interface OfficeCanvasProps {
  onSelectAgent?: (id: string | null) => void;
  onFocusZone?: (zone: ZoneDef | null) => void;
  onReady?: (runtime: GameRuntime) => void;
  onStats?: (stats: GameRuntimeStats) => void;
  /** Fired when an agent's animation spritesheet fails to load (Sora audit #4 / R12). */
  onAssetError?: (info: AgentAssetError) => void;
  /**
   * Fired when the document becomes visible again after being hidden (Sora
   * stability audit #5). The office should re-fetch the board snapshot to
   * avoid rendering stale agent state.
   */
  onResume?: () => void;
}

export function OfficeCanvas({ onSelectAgent, onFocusZone, onReady, onStats, onAssetError, onResume }: OfficeCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorIsAtlas, setErrorIsAtlas] = useState(false);
  const [errorIsWebGL, setErrorIsWebGL] = useState(false);
  const [followAgentName, setFollowAgentName] = useState<string | null>(null);

  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  // Boot the runtime once the wrapper is mounted.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Track this OfficeCanvas instance for the multi-instance guard.
    // Each mount creates a WebGL context; browsers cap at ~8-16 contexts.
    registerInstance('OfficeCanvas');

    let cancelled = false;
    const rect = wrapper.getBoundingClientRect();

    const runtime = new GameRuntime({
      container: wrapper,
      width: Math.max(320, Math.floor(rect.width)),
      height: Math.max(320, Math.floor(rect.height)),
      onSelectAgent: (id) => onSelectAgent?.(id),
      prefersReducedMotion: prefersReducedMotion.current,
      onAssetError: onAssetError ? (info) => onAssetError(info) : undefined,
      onResume: onResume ? () => onResume() : undefined,
    });
    runtimeRef.current = runtime;

    runtime
      .init()
      .then(() => {
        if (cancelled) return;
        for (const desk of AGENT_DESKS as AgentDesk[]) {
          runtime.addAgent(desk);
        }
        setReady(true);
        onReady?.(runtime);
        onStats?.(runtime.stats);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('GameRuntime init failed:', err);
        setErrorIsAtlas(err instanceof AtlasUnavailableError);
        setErrorIsWebGL(isWebGLUnavailableError(err));
        setError(err instanceof Error ? err.message : 'Canvas failed to start');
      });

    return () => {
      cancelled = true;
      runtime.destroy();
      runtimeRef.current = null;
      deregisterInstance();
    };
  }, [onSelectAgent, onReady, onStats, onAssetError, onResume]);

  // Patch followAgent to track the follow state for the UI indicator.
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const originalFollowAgent = runtime.followAgent.bind(runtime);
    runtime.followAgent = (id: string | null) => {
      originalFollowAgent(id);
      const name = id ? AGENT_DESKS.find((d) => d.id === id)?.name ?? null : null;
      setFollowAgentName(name);
    };
  }, [ready]);

  // Lightweight dashboard telemetry: one update per second, no render-loop coupling.
  useEffect(() => {
    if (!ready || !onStats) return;
    const emitStats = () => {
      const runtime = runtimeRef.current;
      if (runtime) onStats(runtime.stats);
    };
    emitStats();
    const timer = window.setInterval(emitStats, 1000);
    return () => window.clearInterval(timer);
  }, [ready, onStats]);

  // Wire onFocusZone to GameRuntime.focusZone.
  const focusZoneRef = useRef(onFocusZone);
  focusZoneRef.current = onFocusZone;

  const focusZone = useCallback((zoneId: string | null) => {
    runtimeRef.current?.focusZone(zoneId);
    const zone = zoneId ? ZONES.find((z) => z.id === zoneId) ?? null : null;
    focusZoneRef.current?.(zone);
  }, []);

  // Expose focusZone via a ref so parent components can call it.
  const focusZoneCallbackRef = useRef(focusZone);
  focusZoneCallbackRef.current = focusZone;

  // @use-gesture/react: pinch/wheel to zoom.
  const bind = useGesture(
    {
      onPinch: ({ offset: [scale], origin, first }) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        if (first) {
          lastPinchScale.current = 1;
        }
        const factor = scale / lastPinchScale.current;
        lastPinchScale.current = scale;
        runtime.zoom(factor, origin[0], origin[1]);
        runtime.followAgent(null);
      },
      onWheel: ({ delta: [dx, dy], event, pinching }) => {
        if (pinching) return;
        const runtime = runtimeRef.current;
        if (!runtime) return;
        event.preventDefault?.();
        if (Math.abs(dy) > Math.abs(dx)) {
          const factor = dy < 0 ? 1.05 : 0.95;
          runtime.zoom(factor);
        } else {
          runtime.pan(-dx, 0);
        }
      },
    },
    {
      drag: {
        enabled: true,
        pointer: { touch: true, mouse: true },
        preventScroll: true,
        threshold: 4,
      },
      pinch: {
        enabled: true,
        pointer: { touch: true },
        scaleBounds: { min: 0.5, max: 3 },
      },
      wheel: {
        enabled: true,
        eventOptions: { passive: false },
      },
    },
  );

  // Manual drag pan via native pointer events.
  const lastDragOffset = useRef<[number, number]>([0, 0]);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && e.isPrimary === false) return;
      lastDragOffset.current = [e.clientX, e.clientY];
      const move = (ev: PointerEvent) => {
        const [lx, ly] = lastDragOffset.current;
        const dx = ev.clientX - lx;
        const dy = ev.clientY - ly;
        lastDragOffset.current = [ev.clientX, ev.clientY];
        runtimeRef.current?.pan(dx, dy);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };

    wrapper.addEventListener('pointerdown', handlePointerDown);
    return () => wrapper.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const lastPinchScale = useRef(1);

  const handleRetry = () => {
    setError(null);
    setErrorIsAtlas(false);
    setErrorIsWebGL(false);
    setReady(false);
    // Force a re-mount by toggling a key — the effect will re-run
    setTimeout(() => window.location.reload(), 100);
  };

  return (
    <div
      {...(bind() as Record<string, unknown>)}
      ref={wrapperRef}
      style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        height: '100%',
        touchAction: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Runtime error screen */}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-0)',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '40px 32px',
              maxWidth: 400,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-2)',
              border: '1px solid var(--border-active)',
            }}
          >
            <div
              className="mission-glyph"
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-xl)',
                margin: '0 auto 16px',
                opacity: 0.9,
              }}
            />
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {errorIsWebGL
                ? 'WebGL unavailable'
                : errorIsAtlas
                  ? 'Office assets unavailable'
                  : 'Office canvas offline'}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              {errorIsWebGL
                ? 'Your browser could not initialise a WebGL context, which is required for the 3D office. The Canvas2D fallback is not supported for this scene. Please update your graphics drivers or enable hardware acceleration.'
                : errorIsAtlas
                  ? 'The 3D office atlas sprites could not be loaded after retry. Check that the asset server is reachable and try again.'
                  : 'The control-room canvas failed to initialize. Runtime remains offline until retry succeeds.'}
            </p>
            <p
              className="mono"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-red)',
                marginBottom: 24,
                padding: '8px 12px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-red-glow)',
              }}
            >
              {error}
            </p>
            {errorIsWebGL && (
              <a
                href={WEBGL_COMPATIBILITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  marginBottom: 12,
                  borderRadius: 'var(--radius-xl)',
                  fontWeight: 500,
                  fontSize: 'var(--text-sm)',
                  background: 'transparent',
                  color: 'var(--accent-cyan)',
                  border: '1px solid var(--accent-cyan)',
                  minHeight: 44,
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  lineHeight: '20px',
                }}
              >
                Check browser compatibility ↗
              </a>
            )}
            <button
              onClick={handleRetry}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-xl)',
                fontWeight: 500,
                fontSize: 'var(--text-sm)',
                background: 'var(--accent-cyan)',
                color: 'var(--bg-0)',
                minHeight: 44,
              }}
            >
              {errorIsWebGL
                ? 'Retry canvas init'
                : errorIsAtlas
                  ? 'Retry asset load'
                  : 'Retry canvas init'}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!ready && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '2px solid var(--accent-cyan)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Initializing office canvas…
            </p>
          </div>
        </div>
      )}

      {/* Follow-camera indicator */}
      {followAgentName && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            padding: '8px 16px',
            borderRadius: 'var(--radius-xl)',
            background: 'rgba(11, 17, 26, 0.96)',
            border: '1px solid var(--border-base)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          <span className="mono" style={{ color: 'var(--accent-cyan)', marginRight: 8 }}>FOLLOW</span>
          <span style={{ fontWeight: 600 }}>{followAgentName}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— tap anywhere to stop</span>
        </div>
      )}
    </div>
  );
}

// Re-export so parent components can access the runtime type
export { GameRuntime };
export type { ZoneDef };