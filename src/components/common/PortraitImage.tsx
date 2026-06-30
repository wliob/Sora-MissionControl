/**
 * PortraitImage — Shared agent portrait component with image loading + initials fallback.
 *
 * Phase C: Sora Identity — replaces all hardcoded initials spans across surfaces.
 * Accepts an agentId and tries to load the WebP portrait from public/portraits/.
 * Falls back to initials if the image fails to load or doesn't exist.
 *
 * All styling (size, border, glow) is inherited or passed through so existing
 * surface chrome is preserved exactly.
 */

import { useState, useCallback } from 'react';

interface PortraitImageProps {
  /** Agent identifier used both for image lookup (public/portraits/{agentId}.webp) and initials fallback. */
  agentId: string;
  /** Display width/height in pixels (circle, so square). */
  size: number;
  /** Optional additional class name passed to the container. */
  className?: string;
  /** Optional inline style overrides for the container (e.g. border-color, box-shadow glow). */
  style?: React.CSSProperties;
  /** Optional initials override — derived from agentId if not provided (first 2 chars uppercase). */
  initials?: string;
}

/**
 * Derives 2-letter uppercase initials from an agent id string.
 */
function deriveInitials(agentId: string): string {
  return agentId.slice(0, 2).toUpperCase();
}

export function PortraitImage({
  agentId,
  size,
  className,
  style,
  initials,
}: PortraitImageProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  const handleError = useCallback(() => {
    setLoadFailed(true);
  }, []);

  const displayInitials = initials ?? deriveInitials(agentId);

  // Build the image URL from the public/ directory.
  // Vite serves public/ files as-is at runtime — no build-time resolution needed.
  // Files are expected at public/portraits/{agentId}.webp (delivered by Korra).
  const imgSrc = `/portraits/${agentId}.webp`;

  // Compute font size proportional to the circle — roughly 30-35% of size
  const fontSize = Math.round(size * 0.32);

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1.5px solid',
        background: '#0a0a0a',
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {!loadFailed ? (
        <img
          src={imgSrc}
          alt={`${agentId} portrait`}
          loading="lazy"
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
          }}
        />
      ) : (
        <span
          className="mono"
          style={{
            fontSize,
            fontWeight: 600,
            color: style?.borderColor ?? 'var(--text-muted)',
          }}
        >
          {displayInitials}
        </span>
      )}
    </div>
  );
}
