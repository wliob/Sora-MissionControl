/**
 * AttentionRail — Ranked top 3 attention items in log format.
 *
 * Displays severity-tagged log entries with guild rank chevrons («❶» «❷» «❸»),
 * monospace timestamps, source labels, and action buttons. Styled as a
 * terminal panel with a blinking cursor title bar.
 */

import { type FC } from 'react';
import type { AttentionItem } from '@/types/team';
import { truthFreshnessLabel } from '@/utils/truthVocabulary';

const SEVERITY_COLORS: Record<string, { color: string; border: string }> = {
  CRITICAL: { color: 'var(--crt-red, #ff4444)', border: 'var(--crt-red, #ff4444)' },
  WARNING: { color: 'var(--crt-amber, #ffb000)', border: 'var(--crt-amber, #ffb000)' },
  INFO: { color: 'var(--crt-cyan, #00d4ff)', border: 'var(--crt-cyan, #00d4ff)' },
  STALE: { color: '#888888', border: '#888888' },
  DEGRADE: { color: 'var(--crt-amber, #ffb000)', border: 'var(--crt-amber, #ffb000)' },
};

const RANK_CHEVRONS = ['\u00AB\u2776\u00BB', '\u00AB\u2777\u00BB', '\u00AB\u2778\u00BB'];

function severityTag(severity: string): string {
  // Pad to exactly 10 chars for monospace column alignment
  return `[${severity}]`.padEnd(10, ' ');
}

interface AttentionItemCardProps {
  item: AttentionItem;
}

const AttentionItemCard: FC<AttentionItemCardProps> = ({ item }) => {
  const sev = SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.INFO;
  const chevron = RANK_CHEVRONS[item.rank - 1] ?? '';
  const chevronOpacity = item.severity === 'STALE' ? 0.15 : item.rank === 1 ? 1 : item.rank === 2 ? 0.6 : 0.35;
  const freshnessLabel = truthFreshnessLabel(item.freshness);

  return (
    <div
      className="attention-item"
      style={{ borderLeftColor: sev.border }}
      role="listitem"
    >
      <div className="attention-item__topline">
        <span
          className="attention-item__chevron mono"
          style={{ opacity: chevronOpacity, color: 'var(--guild-amber, #d4943a)' }}
        >
          {chevron}
        </span>
        <span
          className="attention-item__severity mono"
          style={{ color: sev.color }}
        >
          {severityTag(item.severity)}
        </span>
        <span className="attention-item__timestamp mono text-dim">
          {item.timestamp}
        </span>
        <span
          className="attention-item__source mono"
          style={{ color: `var(--agent-${typeof item.source === 'string' ? item.source.toLowerCase() : 'system'}, var(--text-secondary))` }}
        >
          {typeof item.source === 'string' ? item.source.toUpperCase() : item.source}
        </span>
        <span className="attention-item__summary">
          {item.summary}
        </span>
      </div>
      <div className="attention-item__bottomline">
        {item.duration && (
          <span className="attention-item__duration mono text-dim">{item.duration}</span>
        )}
        {item.action && (
          <button type="button" className="attention-item__action mono">
            {item.action}
          </button>
        )}
        <span className={`attention-item__freshness freshness-badge freshness-badge--${freshnessLabel}`}>
          {freshnessLabel}
        </span>
      </div>
    </div>
  );
};

interface AttentionRailProps {
  items: AttentionItem[];
}

export const AttentionRail: FC<AttentionRailProps> = ({ items }) => {
  return (
    <section className="attention-rail" role="list" aria-label="Attention log">
      <div className="attention-rail__header">
        <span className="attention-rail__guild-chevron mono" aria-hidden="true">
          {'\u27D0'}
        </span>
        <span className="attention-rail__title mono">
          ATTENTION LOG — tail -f /dev/attention
        </span>
        <span className="attention-rail__cursor mono" aria-hidden="true">
          {'\u2588'}
        </span>
      </div>
      <div className="attention-rail__items">
        {items.slice(0, 3).map((item) => (
          <AttentionItemCard key={`${item.rank}-${item.source}`} item={item} />
        ))}
      </div>
    </section>
  );
};
