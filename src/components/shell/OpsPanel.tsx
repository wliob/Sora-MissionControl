/**
 * OpsPanel — live ops / telemetry panel.
 * Phase 5 build starts with honest source health + canonical usage rows.
 */

import { useConnectionStateValue } from '@/state/sessionConnectionStore';
import { acknowledgeUsageAlert, useUsageStore } from '@/state/usageStore';
import { StatusPill } from '@/components/common/StatusPill';
import { AlertStrip, type AlertItem } from '@/components/common/AlertStrip';
import {
  HEALTH_SOURCE_LABELS,
  KNOWN_HEALTH_SOURCE_IDS,
  type HealthSourceId,
  type KnownHealthSourceId,
  type SourceHealth,
} from '@/types/connection';
import { initialConnectionState } from '@/types/connection';
import {
  USAGE_METRIC_SEEDS,
  type ProviderQuotaSnapshot,
  type UsageAlert,
  type UsageMetric,
} from '@/types/usage';
import { truthConfidenceLabel, truthFreshnessLabel, truthProvenanceLabel } from '@/utils/truthVocabulary';

type SourceRow = {
  id: HealthSourceId;
  label: string;
  health: SourceHealth;
};

function isKnownHealthSourceId(id: string): id is KnownHealthSourceId {
  return (KNOWN_HEALTH_SOURCE_IDS as readonly string[]).includes(id);
}

function buildSourceRows(sources: Record<string, SourceHealth>): SourceRow[] {
  const rows: SourceRow[] = KNOWN_HEALTH_SOURCE_IDS
    .filter((sourceId): sourceId is KnownHealthSourceId =>
      Object.prototype.hasOwnProperty.call(sources, sourceId))
    .map((sourceId) => ({
      id: sourceId,
      label: HEALTH_SOURCE_LABELS[sourceId],
      health: sources[sourceId],
    }));

  Object.entries(sources).forEach(([id, health]) => {
    if (!isKnownHealthSourceId(id)) {
      rows.push({
        id,
        label: `Source: ${id}`,
        health,
      });
    }
  });

  return rows;
}

function formatAge(timestamp: string | null): string {
  if (!timestamp) return '—';
  const deltaMs = Math.max(0, Date.now() - Date.parse(timestamp));
  const seconds = Math.floor(deltaMs / 1_000);
  if (seconds < 30) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMetricValue(metric: UsageMetric): string {
  if (metric.value === null) return 'unknown';
  if (!Number.isFinite(metric.value)) return 'unknown';

  if (metric.unit === 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(metric.value);
  }

  if (metric.unit === 'calls' || metric.unit === 'tokens') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(metric.value);
  }

  return String(metric.value);
}

function formatQuotaValue(value: number | null): string {
  if (value === null) return 'unknown';
  if (!Number.isFinite(value)) return 'unknown';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function toAlertStripItem(alert: UsageAlert): AlertItem {
  return {
    id: alert.id,
    severity: alert.severity,
    source: alert.source,
    message: alert.message,
    freshness: formatAge(alert.occurredAt),
  };
}

function renderSourceHealth(health: SourceHealth | undefined, label: string, sourceId: HealthSourceId): JSX.Element | null {
  if (!health) {
    return null;
  }

  const syncText = health.lastCheckedAt ? `checked ${formatAge(health.lastCheckedAt)}` : 'not checked';

  return (
    <div
      key={sourceId}
      className="row-hover"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--border-faint)',
        gap: 'var(--space-2)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-dim)',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {syncText}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {health.latencyMs !== undefined && (
          <span
            className="mono"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}
          >
            {health.latencyMs}ms
          </span>
        )}
        <StatusPill state={health.state} size="sm" />
      </div>
    </div>
  );
}

function renderUsageCards(snapshot: ReturnType<typeof useUsageStore>['snapshot']['value']) {
  if (!snapshot) return null;

  const metricsById = new Map(snapshot.metrics.map((metric) => [metric.id, metric]));

  return (
    <>
      {USAGE_METRIC_SEEDS.map((seed) => {
        const metric = metricsById.get(seed.id) as UsageMetric | undefined;
        const value = metric ? formatMetricValue(metric) : 'unknown';
        const source = metric?.provenance.source ?? 'usage-cli';
        const freshness = truthFreshnessLabel(metric?.provenance.freshness);
        const confidence = truthConfidenceLabel(metric?.provenance.confidence);

        return (
          <div
            key={seed.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {seed.label}
              </div>
              <div
                className="mono"
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 'var(--text-xs)',
                  marginTop: '2px',
                }}
              >
                {source} • {freshness}/{confidence}
              </div>
            </div>
            <span className="mono" style={{ color: 'var(--text-secondary)' }}>
              {value}
            </span>
          </div>
        );
      })}
      <div
        style={{
          marginTop: 'var(--space-2)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--border-faint)',
          color: 'var(--text-dim)',
          fontSize: 'var(--text-xs)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-2)',
          marginLeft: '-4px',
          marginRight: '-4px',
          padding: 'var(--space-2) var(--space-2) 0',
        }}
      >
        <span>Window: {snapshot.windowStart ?? '—'} to {snapshot.windowEnd ?? '—'}</span>
        <span>Updated: {formatAge(snapshot.receivedAt)}</span>
        <span>Period: {snapshot.periodDays}d</span>
        <span>Source: {snapshot.sourceLabel ?? usageStoreFallbackSource(snapshot)}</span>
      </div>
    </>
  );
}

function renderProviderQuotasCards(
  quotas: ReturnType<typeof useUsageStore>['providerQuotas']['value'],
  provenance: ReturnType<typeof useUsageStore>['providerQuotas']['provenance'],
) {
  if (!quotas || quotas.length === 0) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)' }}>
        <div>
          Provider quota data is <strong>unknown</strong> (no verified live rate-limit source yet).
        </div>
        <div className="mono" style={{ marginTop: 'var(--space-1)', color: 'var(--text-dim)' }}>
          {truthProvenanceLabel(provenance)}
          {provenance.note ? ` • ${provenance.note}` : ''}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {quotas.map((quota: ProviderQuotaSnapshot) => (
        <div
          key={quota.provider}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {quota.provider}
            </div>
            <div
              className="mono"
              style={{
                color: 'var(--text-dim)',
                fontSize: 'var(--text-xs)',
                marginTop: '2px',
              }}
            >
              {truthProvenanceLabel(quota.provenance)}
            </div>
          </div>
          <div style={{ color: 'var(--text-secondary)' }} className="mono">
            req {formatQuotaValue(quota.remainingRequests)} / {formatQuotaValue(quota.requestLimit)}<br />
            tok {formatQuotaValue(quota.remainingTokens)} / {formatQuotaValue(quota.tokenLimit)}
          </div>
        </div>
      ))}
    </div>
  );
}

function usageStoreFallbackSource(snapshot: ReturnType<typeof useUsageStore>['snapshot']['value']): string {
  if (!snapshot) return 'unknown';
  if (snapshot.sourceLabel) return snapshot.sourceLabel;
  return 'usage-cli';
}

export function OpsPanel() {
  const connectionState = useConnectionStateValue();
  const usage = useUsageStore();
  const connection = connectionState.value ?? initialConnectionState();
  const sources = connection.sources;
  const sourceRows = buildSourceRows(sources);
  const healthAlerts = usage.alerts.value ?? [];
  const snapshot = usage.snapshot.value;
  const totalCost = snapshot?.metrics.find((metric) => metric.id === 'cost-usd')?.value;
  const hasKnownUsage = snapshot?.metrics?.some((metric) => metric.value !== null) ?? false;
  const verifiedSourceCount = sourceRows.filter((row) => row.health.lastCheckedAt !== null || row.health.lastOkAt !== null || row.health.state !== 'unknown').length;
  const compactUnknownState = healthAlerts.length === 0
    && !hasKnownUsage
    && verifiedSourceCount === 0
    && (usage.providerQuotas.value?.length ?? 0) === 0
    && !usage.lastError;
  const statusText = usage.lastError
    ? usage.lastError
    : snapshot
      ? snapshot.metrics.length === 0
        ? 'Usage payload empty — metrics are unknown until source verifies.'
        : hasKnownUsage
          ? 'Usage data present'
          : 'Usage payload returned but metrics are unknown until source verifies.'
      : 'Usage unknown';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Section label */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-faint)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Telemetry
        </span>
        <StatusPill state={connection.overall} size="sm" />
      </div>

      {compactUnknownState ? (
        <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 28%, var(--border-faint))',
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
              display: 'grid',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Telemetry not verified</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              {verifiedSourceCount} of {sourceRows.length} telemetry sources verified. Usage and provider quota meters stay hidden until a source is actually checked.
            </div>
            <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)' }}>
              {statusText}
            </div>
          </div>

          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              Open diagnostics
            </summary>
            <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)' }}>
              <div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Source diagnostics
                </div>
                <div style={{ border: '1px solid var(--border-faint)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  {sourceRows.map((source) => renderSourceHealth(source.health, source.label, source.id))}
                </div>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                No alert diagnostics are available yet.
              </div>
            </div>
          </details>
        </div>
      ) : (
        <>
          {/* Risk-first: alerts at top */}
          <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-faint)' }}>
            <div
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Signal Alerts
            </div>
            <AlertStrip alerts={healthAlerts.map(toAlertStripItem)} onAcknowledge={acknowledgeUsageAlert} />
          </div>

          {/* Source health */}
          <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-faint)' }}>
            <div
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Source Health
            </div>
            <div>
              {sourceRows.map((source) => {
                return renderSourceHealth(source.health, source.label, source.id);
              })}
            </div>
          </div>

          {/* Token / cost burn — first-phase live usage shape */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--space-3) var(--space-4)' }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 'var(--space-2)',
              }}
            >
              Consumption
            </div>
            <div
              style={{
                padding: 'var(--space-2) 0',
                color: 'var(--text-secondary)',
                display: 'grid',
                gap: 'var(--space-2)',
              }}
            >
              {renderUsageCards(usage.snapshot.value)}
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Provider Quotas
              </div>
              {renderProviderQuotasCards(usage.providerQuotas.value, usage.providerQuotas.provenance)}
            </div>
            <div
              className="mono"
              style={{
                marginTop: 'var(--space-3)',
                color: totalCost == null || Number.isNaN(totalCost) ? 'var(--text-dim)' : 'var(--text-secondary)',
                fontSize: 'var(--text-xs)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {statusText}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
