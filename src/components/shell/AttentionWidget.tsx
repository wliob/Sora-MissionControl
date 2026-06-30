/**
 * AttentionWidget — Ranked attention items visible as a shell UI widget.
 *
 * Renders the top 5 attention items from the Attention Ranking Engine
 * (8-tier weighted priority system). Shows rank chevrons, severity badges,
 * source agents, duration, and action buttons.
 *
 * Designed as a standalone widget that can be placed in any shell page.
 * Uses the teamStore for data, which derives attention items from the
 * boardStore via the full attentionRankingEngine pipeline.
 *
 * Empty state: "All systems nominal — no attention items"
 */

import { type FC } from 'react';
import { useTeamState } from '@/state/teamStore';
import { useAttentionItems } from '@/hooks/useAttentionItems';
import { truthFreshnessLabel } from '@/utils/truthVocabulary';
import type { AttentionItem } from '@/types/team';
import { isAgentId } from '@/types';

// ── Severity styles ────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; glow: boolean }> = {
  CRITICAL: { bg: 'rgba(255,68,68,0.12)', border: '#ff4444', text: '#ff4444', glow: true },
  WARNING: { bg: 'rgba(255,176,0,0.12)', border: '#ffb000', text: '#ffb000', glow: false },
  INFO: { bg: 'rgba(0,212,255,0.08)', border: '#00d4ff', text: '#00d4ff', glow: false },
  STALE: { bg: 'rgba(136,136,136,0.06)', border: '#888888', text: '#888888', glow: false },
  DEGRADE: { bg: 'rgba(255,176,0,0.08)', border: '#ffb000', text: '#ffb000', glow: false },
};

const RANK_CHEVRONS = ['\u00AB\u2776\u00BB', '\u00AB\u2777\u00BB', '\u00AB\u2778\u00BB', '\u00AB\u2779\u00BB', '\u00AB\u277A\u00BB'];

function severityLabel(severity: string): string {
  return `[${severity}]`;
}

// ── Single attention item row ──────────────────────────────────────────

interface AttentionItemRowProps {
  item: AttentionItem;
}

function navigateToPath(path: string): void {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function actionTarget(item: AttentionItem): { path: string | null; reason: string | null } {
  const action = item.action?.toLowerCase() ?? '';
  const source = typeof item.source === 'string' ? item.source.toLowerCase() : '';

  if (action === 'connect calendar') return { path: '/calendar', reason: null };
  if (action === 'verify connection') return { path: '/system', reason: null };

  if (source === 'system') {
    return { path: null, reason: 'No implemented navigation target for this system action.' };
  }

  if (!isAgentId(source)) {
    return { path: null, reason: 'Attention source is not mapped to a verified office/chat profile.' };
  }

  if (item.freshness === 'missing') {
    return { path: null, reason: 'Action unavailable until live Kanban data maps this attention item.' };
  }

  if (action === 'respond') return { path: '/chat', reason: null };
  return { path: '/kanban', reason: null };
}

const AttentionItemRow: FC<AttentionItemRowProps> = ({ item }) => {
  const styles = SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.INFO;
  const chevron = RANK_CHEVRONS[item.rank - 1] ?? '';
  const isTopTier = item.rank <= 2;
  const target = actionTarget(item);

  return (
    <div
      className="attention-widget__item"
      style={{
        borderLeft: `3px solid ${styles.border}`,
        background: styles.bg,
        ...(isTopTier && styles.glow
          ? { boxShadow: `inset 0 0 20px rgba(255,68,68,0.08)` }
          : {}),
      }}
      role="listitem"
    >
      <div className="attention-widget__item-top">
        <span
          className="attention-widget__chevron mono"
          style={{
            color: 'var(--guild-amber, #d4943a)',
            fontWeight: isTopTier ? 700 : 400,
          }}
        >
          {chevron}
        </span>
        <span
          className="attention-widget__severity mono"
          style={{ color: styles.text, fontWeight: isTopTier ? 700 : 500 }}
        >
          {severityLabel(item.severity)}
        </span>
        <span
          className="attention-widget__source mono"
          style={{
            color: `var(--agent-${typeof item.source === 'string' ? item.source.toLowerCase() : 'system'}, var(--text-secondary))`,
          }}
        >
          {typeof item.source === 'string' ? item.source.toUpperCase() : item.source}
        </span>
        <span
          className="attention-widget__summary"
          style={{ fontWeight: isTopTier ? 600 : 400 }}
        >
          {item.summary}
        </span>
      </div>
      <div className="attention-widget__item-bottom">
        {item.duration && (
          <span className="attention-widget__duration mono" style={{ color: 'var(--text-dim, #666)' }}>
            {item.duration}
          </span>
        )}
        {item.action && (
          <button
            type="button"
            className="attention-widget__action mono"
            disabled={target.path === null}
            title={target.reason ?? `Open ${target.path}`}
            aria-disabled={target.path === null}
            onClick={() => {
              if (target.path) navigateToPath(target.path);
            }}
            style={{
              color: styles.text,
              borderColor: styles.border,
              opacity: target.path === null ? 0.5 : 1,
              cursor: target.path === null ? 'not-allowed' : 'pointer',
            }}
          >
            {item.action}
          </button>
        )}
        {target.reason && item.action && (
          <span className="attention-widget__action-reason mono" style={{ color: 'var(--text-dim, #666)' }}>
            {target.reason}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Main widget ────────────────────────────────────────────────────────

export const AttentionWidget: FC = () => {
  const teamState = useTeamState();
  const items = useAttentionItems(5);
  const isEmpty = items.length === 0 || items.every(
    (i) => i.summary === 'unknown attention state' || i.summary === 'no active attention items'
  );

  return (
    <section className="attention-widget" aria-label="Attention items">
      <div className="attention-widget__header">
        <span className="attention-widget__header-icon mono" aria-hidden="true">
          {'\u27D0'}
        </span>
        <span className="attention-widget__header-title mono">
          ATTENTION — top {items.length}
        </span>
        <span className="attention-widget__freshness-badge mono">
          {truthFreshnessLabel(teamState.freshness)}
        </span>
      </div>

      <div className="attention-widget__items" role="list">
        {isEmpty ? (
          <div className="attention-widget__empty mono">
            All systems nominal — no attention items
          </div>
        ) : (
          items.map((item) => (
            <AttentionItemRow key={`${item.rank}-${item.source}`} item={item} />
          ))
        )}
      </div>
    </section>
  );
};
