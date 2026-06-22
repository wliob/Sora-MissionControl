/**
 * FloatingChatOverlay — floating chat bubble launcher + draggable/resizable
 * command surface.
 *
 * Ported from the Hermes dashboard TUI plugin (hermes-chat-bubble) and
 * integrated into Sora-MissionControl. The original plugin manipulates a
 * persistent DOM chat host via inline styles and route-watching; here it is
 * rebuilt as a native React component that mounts the shared `<ChatPanel/>`
 * inside the bubble, so the floating surface reuses the same command-console
 * chat surface, transport, and store as the docked panel — no second session,
 * no consumer-bubble styling (per Chat module forbidden dependencies).
 *
 * Behaviour preserved from the source plugin:
 *   - Fixed-position circular launcher button (bottom-right).
 *   - Header bar with drag handle, status dot, copy/open/minimize actions.
 *   - Four corner resize handles (nw/ne/sw/se).
 *   - Geometry persisted to localStorage across sessions.
 *   - Clamping within the viewport bounds (min 360x320, edge pad 8).
 *   - Reduced-motion respected (no pop animation under prefers-reduced-motion).
 *
 * What is intentionally different from the original:
 *   - No route/`/chat` detection — Mission Control has its own view system; the
 *     bubble is an overlay, not a route-aware DOM bridge.
 *   - No transition ghost / history wrapping — those existed to keep the TUI
 *     terminal visible across React Router route swaps; we render the React
 *     `<ChatPanel/>` directly so no ghosting is needed.
 *   - The bubble body IS `<ChatPanel/>`, not an external DOM host. This is the
 *     integration point: one chat surface, two mount sites (docked + floating).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ChatPanel } from '@/components/shell/ChatPanel';
import { isDemoMode } from '@/modules/chat/chatBackbone';
import { useShellState, shellStore } from '@/state/shellStore';

const STORAGE_KEY = 'sora-mc:chat-bubble:v1';
const MIN_WIDTH = 360;
const MIN_HEIGHT = 320;
const EDGE_PAD = 8;
const HEADER_HEIGHT = 38;
const HEADER_GAP = 8;
const HEADER_OFFSET = HEADER_HEIGHT + HEADER_GAP;
const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 520;
const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)';

interface BubbleGeometry {
  open: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
}

const DEFAULT_GEOMETRY: BubbleGeometry = {
  open: false,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  x: 0,
  y: 0,
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  if (max < min) return min;
  return Math.min(Math.max(n, min), max);
}

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function getViewportBounds(): ViewportBounds {
  if (typeof window === 'undefined') {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function clampGeometry(input: BubbleGeometry, bounds?: ViewportBounds): BubbleGeometry {
  const b = bounds ?? getViewportBounds();
  const minWidth = Math.min(MIN_WIDTH, Math.max(160, b.width - EDGE_PAD * 2));
  const minHeight = Math.min(MIN_HEIGHT, Math.max(160, b.height - HEADER_OFFSET - EDGE_PAD * 2));
  const maxWidth = Math.max(minWidth, b.width - EDGE_PAD * 2);
  const maxHeight = Math.max(minHeight, b.height - HEADER_OFFSET - EDGE_PAD * 2);
  const width = clamp(input.width, minWidth, maxWidth);
  const height = clamp(input.height, minHeight, maxHeight);
  const minX = b.left + EDGE_PAD;
  const minY = b.top + EDGE_PAD;
  const maxX = Math.max(minX, b.right - EDGE_PAD - width);
  const maxY = Math.max(minY, b.bottom - EDGE_PAD - HEADER_OFFSET - height);
  // First-open default: top-left of the content well (matches the source plugin).
  const fallbackX = minX;
  const fallbackY = minY;
  const x = clamp(input.x ?? fallbackX, minX, maxX);
  const y = clamp(input.y ?? fallbackY, minY, maxY);
  return { ...input, width, height, x, y };
}

function readGeometry(): BubbleGeometry {
  if (typeof window === 'undefined') return { ...DEFAULT_GEOMETRY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BubbleGeometry>;
      return clampGeometry({ ...DEFAULT_GEOMETRY, ...parsed });
    }
  } catch {
    /* ignore storage failures */
  }
  return { ...DEFAULT_GEOMETRY };
}

function writeGeometry(next: BubbleGeometry): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage failures */
  }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(REDUCED_MOTION_MQ).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(REDUCED_MOTION_MQ);
    const update = () => setReduced(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

type ResizeEdge = 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  startX: number;
  startY: number;
  startXPos: number;
  startYPos: number;
}

interface ResizeState {
  edge: ResizeEdge;
  startX: number;
  startY: number;
  startXPos: number;
  startYPos: number;
  startWidth: number;
  startHeight: number;
}

function MessageCircleIcon() {
  return (
    <svg
      className="floating-chat-launcher__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function FloatingChatOverlay() {
  const [geo, setGeo] = useState<BubbleGeometry>(() => clampGeometry(readGeometry()));
  const reducedMotion = useReducedMotion();
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const geoRef = useRef(geo);
  const { view, selectedAgent } = useShellState();
  const demo = isDemoMode();

  // Keep geoRef synced for the global pointer handlers.
  useEffect(() => {
    geoRef.current = geo;
  }, [geo.open, geo.width, geo.height, geo.x, geo.y]);

  // Persist geometry on every change.
  useEffect(() => {
    writeGeometry(geo);
  }, [geo]);

  // Refit on viewport resize: re-clamp the open bubble so it never escapes.
  useEffect(() => {
    function onResize() {
      setGeo((prev) => clampGeometry(prev));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const updateGeo = useCallback((next: BubbleGeometry) => {
    setGeo((prev) => {
      const merged = { ...prev, ...next };
      return clampGeometry(merged);
    });
  }, []);

  // Pointer handlers for drag + resize (mounted once).
  useEffect(() => {
    function onMove(ev: PointerEvent) {
      const drag = dragRef.current;
      const resize = resizeRef.current;
      if (drag) {
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        setGeo((prev) =>
          clampGeometry({
            ...prev,
            x: drag.startXPos + dx,
            y: drag.startYPos + dy,
          }),
        );
        ev.preventDefault();
      } else if (resize) {
        const bounds = getViewportBounds();
        const dx = ev.clientX - resize.startX;
        const dy = ev.clientY - resize.startY;
        let x = resize.startXPos;
        let y = resize.startYPos;
        let width = resize.startWidth;
        let height = resize.startHeight;
        if (resize.edge.includes('e')) width = resize.startWidth + dx;
        if (resize.edge.includes('s')) height = resize.startHeight + dy;
        if (resize.edge.includes('w')) {
          x = resize.startXPos + dx;
          width = resize.startWidth - dx;
        }
        if (resize.edge.includes('n')) {
          y = resize.startYPos + dy;
          height = resize.startHeight - dy;
        }
        setGeo((prev) =>
          clampGeometry({ ...prev, x, y, width, height }, bounds),
        );
        ev.preventDefault();
      }
    }
    function onUp() {
      dragRef.current = null;
      resizeRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const toggleOpen = useCallback(() => {
    setGeo((prev) => {
      if (prev.open) {
        return { ...prev, open: false };
      }
      // Opening: snap to top-left of content well on first open if uninitialised.
      const bounds = getViewportBounds();
      const initialised = prev.x !== 0 || prev.y !== 0;
      return clampGeometry(
        {
          ...prev,
          open: true,
          x: initialised ? prev.x : bounds.left + EDGE_PAD,
          y: initialised ? prev.y : bounds.top + EDGE_PAD,
        },
        bounds,
      );
    });
  }, []);

  const openDockedChat = useCallback(() => {
    shellStore.setView('chat');
    updateGeo({ ...geoRef.current, open: false });
  }, [updateGeo]);

  // "Copy last response" is not available in the command-console model (no
  // external DOM host). Provide a clear status hint instead of a no-op.
  const statusLabel = demo ? 'demo mode' : selectedAgent ? 'live' : 'standby';

  // The bubble renders only when not on the docked chat view (avoid duplicate
  // chat surfaces on screen at once on wide layouts).
  if (view === 'chat') return null;

  const launcher = (
    <button
      type="button"
      className="floating-chat-launcher"
      onClick={toggleOpen}
      title={geo.open ? 'Hide floating chat' : 'Open floating chat'}
      aria-label={geo.open ? 'Hide floating chat' : 'Open floating chat'}
      style={
        reducedMotion
          ? undefined
          : ({ ['--bubble-pop' as string]: 'floating-chat-pop 140ms ease-out' } as CSSProperties)
      }
    >
      <MessageCircleIcon />
    </button>
  );

  if (!geo.open) return launcher;

  const headerStyle: CSSProperties = {
    left: `${geo.x}px`,
    top: `${geo.y}px`,
    width: `${geo.width}px`,
    height: `${HEADER_HEIGHT}px`,
  };

  const bodyStyle: CSSProperties = {
    left: `${geo.x}px`,
    top: `${geo.y + HEADER_OFFSET}px`,
    width: `${geo.width}px`,
    height: `${geo.height}px`,
  };

  function makeResizeHandle(edge: ResizeEdge): CSSProperties {
    return {
      left: `${edge.includes('w') ? geo.x - 2 : geo.x + geo.width - 26}px`,
      top: `${edge.includes('n') ? geo.y - 2 : geo.y + HEADER_OFFSET + geo.height - 26}px`,
    };
  }

  function onDragStart(ev: ReactPointerEvent) {
    dragRef.current = {
      startX: ev.clientX,
      startY: ev.clientY,
      startXPos: geo.x,
      startYPos: geo.y,
    };
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
  }

  function onResizeStart(edge: ResizeEdge, ev: ReactPointerEvent) {
    resizeRef.current = {
      edge,
      startX: ev.clientX,
      startY: ev.clientY,
      startXPos: geo.x,
      startYPos: geo.y,
      startWidth: geo.width,
      startHeight: geo.height,
    };
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }

  return (
    <>
      <div className="floating-chat-header" style={headerStyle}>
        <button
          type="button"
          className="floating-chat-header__drag"
          onPointerDown={onDragStart}
          title="Drag floating chat"
        >
          <span className="floating-chat-header__dot" />
          <span className="mono">CHAT</span>
          <span className="floating-chat-header__status">{statusLabel}</span>
        </button>
        <div className="floating-chat-header__actions">
          <button
            type="button"
            onClick={openDockedChat}
            title="Open docked Chat panel"
            aria-label="Open docked Chat panel"
          >
            ↗
          </button>
          <button
            type="button"
            onClick={() => updateGeo({ ...geoRef.current, open: false })}
            title="Minimize floating chat"
            aria-label="Minimize floating chat"
          >
            –
          </button>
        </div>
      </div>

      <div className="floating-chat-body" style={bodyStyle} data-floating-chat="true">
        <ChatPanel />
      </div>

      {(['nw', 'ne', 'sw', 'se'] as ResizeEdge[]).map((edge) => (
        <div
          key={edge}
          className={`floating-chat-resize-handle floating-chat-resize-handle--${edge}`}
          style={makeResizeHandle(edge)}
          onPointerDown={(ev) => onResizeStart(edge, ev)}
          title={`Resize from ${edge.toUpperCase()}`}
          aria-hidden="true"
        />
      ))}

      {launcher}
    </>
  );
}