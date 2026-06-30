/**
 * GuildInsignia — Hex-stamped circuit-board × heraldry crest emblem.
 *
 * Used as a subtle background watermark on the TeamPage and as a smaller
 * emblem inside the SoraConductorStation right pane.
 *
 * Design: Outer hexagonal circuit trace ring, middle circular heraldry ring,
 * inner chevron geometry. Rendered as inline SVG, memoized.
 */

import { memo } from 'react';

interface GuildInsigniaProps {
  /** Size in px. Default 240 for watermark, 40 for Sora station. */
  size?: number;
  /** Opacity override. Default 0.04 for watermark, 0.15 for Sora station. */
  opacity?: number;
}

export const GuildInsignia = memo(function GuildInsignia({
  size = 240,
  opacity = 0.04,
}: GuildInsigniaProps) {
  const center = size / 2;
  const outerR = size * 0.48;
  const midR = size * 0.36;

  // Hexagon points
  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${center + outerR * Math.cos(angle)},${center + outerR * Math.sin(angle)}`;
  }).join(' ');

  // Inner chevrons (two intersecting ∧ shapes)
  const chevronSize = size * 0.22;
  const chevronOffset = size * 0.06;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Outer hexagonal circuit ring */}
      <polygon
        points={hexPoints}
        stroke="var(--crt-cyan, #00d4ff)"
        strokeWidth="1"
        strokeOpacity={0.15}
        fill="none"
      />
      {/* Hex vertex nodes */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i - 30);
        const x = center + outerR * Math.cos(angle);
        const y = center + outerR * Math.sin(angle);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2"
            fill="var(--crt-cyan, #00d4ff)"
            fillOpacity={0.25}
          />
        );
      })}

      {/* Middle circular heraldry ring */}
      <circle
        cx={center}
        cy={center}
        r={midR}
        stroke="var(--guild-amber, #d4943a)"
        strokeWidth="1"
        strokeOpacity={0.12}
        fill="none"
      />

      {/* Inner chevron geometry — stylized "guild hall roof" */}
      <g stroke="var(--guild-amber, #d4943a)" strokeWidth="1" strokeOpacity={0.15}>
        {/* Upper chevron */}
        <polyline
          points={`
            ${center - chevronSize},${center + chevronOffset}
            ${center},${center - chevronSize * 1.1}
            ${center + chevronSize},${center + chevronOffset}
          `}
          fill="none"
        />
        {/* Lower chevron (inverted) */}
        <polyline
          points={`
            ${center - chevronSize * 0.7},${center - chevronOffset * 0.5}
            ${center},${center + chevronSize * 0.8}
            ${center + chevronSize * 0.7},${center - chevronOffset * 0.5}
          `}
          fill="none"
        />
      </g>

      {/* Circuit-trace nodes at chevron apex */}
      <circle
        cx={center}
        cy={center - chevronSize * 1.1}
        r="2.5"
        fill="var(--crt-cyan, #00d4ff)"
        fillOpacity={0.18}
      />
      <circle
        cx={center}
        cy={center + chevronSize * 0.8}
        r="2"
        fill="var(--guild-amber, #d4943a)"
        fillOpacity={0.14}
      />
    </svg>
  );
});
