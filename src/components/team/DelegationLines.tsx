/**
 * DelegationLines — SVG circuit-trace overlay connecting agent cards.
 *
 * Renders orthogonal (Manhattan) routed lines between cards in guild house
 * colors, with packet-dot animations for active data flow. Only active
 * connections are shown; stale lines fade.
 *
 * Non-interactive (pointer-events: none), positioned absolutely over the grid.
 */

import { memo, useMemo } from 'react';
import type { DelegationEdge } from '@/types/team';

interface CardRect {
  agentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DelegationLinesProps {
  edges: DelegationEdge[];
  cardRects: CardRect[];
  /** Container bounds in SVG coordinate space */
  viewWidth: number;
  viewHeight: number;
}

/** Get the line stroke color based on edge type and agents */
function strokeForEdge(edge: DelegationEdge): { color: string; dashArray?: string; opacity: number } {
  const baseOpacity = edge.freshness === 'stale' || edge.freshness === 'missing' ? 0.2 : 0.55;

  switch (edge.type) {
    case 'escalation':
      return { color: 'var(--guild-amber, #d4943a)', opacity: 0.65 };
    case 'blocked':
      return { color: 'var(--crt-red, #ff4444)', dashArray: '4 3', opacity: 0.7 };
    case 'dependency':
      return { color: `var(--agent-${edge.to}`, dashArray: '4 3', opacity: baseOpacity };
    case 'handoff':
    default:
      return { color: `var(--agent-${edge.from}`, opacity: baseOpacity };
  }
}

/** Compute center point of a card rect */
function centerOf(rect: CardRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Build orthogonal path between two points with a single 90° bend */
function orthogonalPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}

export const DelegationLines = memo(function DelegationLines({
  edges,
  cardRects,
  viewWidth,
  viewHeight,
}: DelegationLinesProps) {
  const pathElements = useMemo(() => {
    if (edges.length === 0 || cardRects.length < 2) return [];

    const rectMap = new Map(cardRects.map(r => [r.agentId, r]));
    const visibleEdges = edges.slice(0, 8);

    return visibleEdges.map((edge, i) => {
      const fromRect = rectMap.get(edge.from);
      const toRect = rectMap.get(edge.to);
      if (!fromRect || !toRect) return null;

      const from = centerOf(fromRect);
      const to = centerOf(toRect);
      const path = orthogonalPath(from, to);
      const stroke = strokeForEdge(edge);

      return (
        <g key={`edge-${i}`}>
          {/* Main trace */}
          <path
            d={path}
            fill="none"
            stroke={stroke.color}
            strokeWidth={edge.type === 'escalation' ? 1.5 : 1}
            strokeOpacity={stroke.opacity}
            strokeDasharray={stroke.dashArray}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Corner radius circles at bend points */}
        </g>
      );
    }).filter(Boolean);
  }, [edges, cardRects]);

  if (pathElements.length === 0) return null;

  return (
    <svg
      className="delegation-lines"
      width={viewWidth}
      height={viewHeight}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      {pathElements}
    </svg>
  );
});
