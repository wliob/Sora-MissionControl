/**
 * Phase 5 usage store — stores historical usage snapshots, quota status, and
 * alert summaries for the Ops panel.
 *
 * This module intentionally keeps unverified data as unknown. It never creates
 * fake values and never clears source provenance when adapters fail.
 */

import { useSyncExternalStore } from 'react';
import type { UsageAlert, UsageMetric, UsageStoreState } from '@/types/usage';
import { createUnknownUsageSnapshot, initialUsageStoreState, type UsageSnapshot } from '@/types/usage';
import type { Freshness, Confidence } from '@/types/provenance';
import { tracked } from '@/types/provenance';
import {
  normalizeProviderQuotas,
  normalizeUsagePayload,
  type RawProviderQuotaPayload,
  type RawUsagePayload,
} from '@/adapters/usageAdapter';

export interface UsageAdapter {
  /**
   * Fetch a usage snapshot and optional provider quota payload.
   * Returns a loosely-typed response that refreshUsage normalizes internally.
   * The adapter contract is intentionally permissive because different backend
   * sources (REST, CLI, WS) produce different wrapper shapes.
   */
  fetchUsage(days?: number): Promise<Record<string, unknown>>;
}

/**
 * Internal response type for pickUsagePayloadFromResponse.
 * Uses Record<string, unknown> because the response shape varies by source
 * and the function normalizes it into a canonical RawUsagePayload.
 */
type UsageSourcePayload = Record<string, unknown>;

let adapter: UsageAdapter | null = null;
let state: UsageStoreState = initialUsageStoreState();
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) {
    fn();
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): UsageStoreState {
  return state;
}

function setError(message: string | null): void {
  state = { ...state, lastError: message };
  emit();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function setUsageSnapshot(snapshot: UsageSnapshot): void {
  const firstMetricSource =
    snapshot.metrics[0]?.provenance.source ??
    'usage-cli';
  const snapshotFreshness: Freshness =
    snapshot.metrics.reduce<Freshness>((worst, metric) => {
      const mf = metric.provenance.freshness;
      if (worst === 'stale') return 'stale';
      if (mf === 'missing') return 'stale';
      if (mf === 'stale') return 'stale';
      if (worst === 'missing' && mf !== 'live' && mf !== 'fresh') return 'stale';
      if (worst === 'live' && mf === 'fresh') return 'fresh';
      if (mf === 'fresh' && (worst === 'live' || worst === 'fresh')) return 'fresh';
      return worst;
    }, 'live');

  const confidence: Confidence =
    snapshot.metrics.reduce<Confidence>((worst, metric) => {
      const mc = metric.provenance.confidence;
      // 'unknown' dominates everything
      if (worst === 'unknown' || mc === 'unknown') return 'unknown' as Confidence;
      // 'placeholder' dominates verified/inferred/unverified
      if (mc === 'placeholder' || worst === 'placeholder') return 'placeholder' as Confidence;
      // 'unverified' dominates verified/inferred
      if (mc === 'unverified' || worst === 'unverified') return 'unverified' as Confidence;
      // 'inferred' dominates verified
      if (mc === 'inferred' || worst === 'inferred') return 'inferred' as Confidence;
      return worst;
    }, 'verified' as Confidence);

  state = {
    ...state,
    snapshot: tracked(snapshot, {
      source: firstMetricSource,
      freshness: snapshotFreshness,
      confidence,
      note: snapshot.sourceLabel
        ? `Source: ${snapshot.sourceLabel}`
        : snapshotFreshness === 'missing'
          ? 'Usage source not yet observed'
          : undefined,
    }),
    lastError: null,
  };
  emit();
}

function withMissingMetricFreshness(
  metrics: UsageMetric[],
): UsageMetric[] {
  return metrics.map((metric) => ({
    ...metric,
    provenance: {
      ...metric.provenance,
      freshness: 'missing' as const,
      ...(metric.provenance.note ? { note: metric.provenance.note } : { note: 'Field not reported by usage source' }),
    },
  }));
}

function withPartialMetricFreshness(metrics: UsageMetric[]): UsageMetric[] {
  return metrics.map((metric) =>
    metric.value === null
      ? {
          ...metric,
          provenance: {
            ...metric.provenance,
            freshness: 'stale' as const,
            note: metric.provenance.note ?? 'Field not reported by usage source',
          },
        }
      : metric,
  );
}

/** Reset the store to canonical unknown baseline for test and cold-start behavior. */
function resetToInitial(periodDays = 7): void {
  state = {
    ...initialUsageStoreState(),
    snapshot: tracked(createUnknownUsageSnapshot(periodDays), {
      source: 'usage-cli',
      freshness: 'missing',
      confidence: 'unknown',
      note: 'Usage source reset to unknown',
    }),
  };
  emit();
}

function setProviderQuotas(
  quotas: ReturnType<typeof normalizeProviderQuotas>,
): void {
  state = {
    ...state,
    providerQuotas: tracked(quotas, {
      source: 'provider-rate-limits',
      freshness: quotas.length === 0 ? 'missing' : 'fresh',
      // Keep quota confidence unknown until a direct, verified provider-rate-limit
      // contract is implemented for this runtime.
      confidence: 'unknown',
      note: quotas.length === 0 ? 'No rate-limit payload from verified source' : 'Provider quota source not yet verified',
    }),
  };
  emit();
}

function setAlerts(alerts: UsageAlert[]): void {
  state = {
    ...state,
    alerts: tracked(alerts, {
      source: 'dashboard-api',
      freshness: alerts.length > 0 ? 'fresh' : 'missing',
      confidence: alerts.length > 0 ? 'verified' : 'unknown',
      note: alerts.length > 0 ? 'Operational usage alerts ingested' : undefined,
    }),
  };
  emit();
}

function pickUsagePayloadFromResponse(response: UsageSourcePayload): RawUsagePayload | null {
  const direct = response?.usage;
  if (isRecord(direct)) {
    return direct as RawUsagePayload;
  }

  const fromData = response?.data;
  if (isRecord(fromData)) {
    return pickUsagePayloadFromResponse(fromData as UsageSourcePayload);
  }

  const hasTotalsSource =
    Object.prototype.hasOwnProperty.call(response, 'totals') ||
    Object.prototype.hasOwnProperty.call(response, 'input_tokens') ||
    Object.prototype.hasOwnProperty.call(response, 'output_tokens') ||
    Object.prototype.hasOwnProperty.call(response, 'total_tokens') ||
    Object.prototype.hasOwnProperty.call(response, 'tool_calls') ||
    Object.prototype.hasOwnProperty.call(response, 'cost_usd') ||
    Object.prototype.hasOwnProperty.call(response, 'window_start') ||
    Object.prototype.hasOwnProperty.call(response, 'window_end') ||
    Object.prototype.hasOwnProperty.call(response, 'period_days');

  if (!hasTotalsSource) return null;

  const totalsSource = isRecord(response['totals']) ? (response['totals'] as Record<string, unknown>) : null;
  const totals: NonNullable<RawUsagePayload['totals']> = {};

  if (totalsSource) {
    const totalKeys = ['input_tokens', 'output_tokens', 'total_tokens', 'tool_calls', 'cost_usd'] as const;
    for (const key of totalKeys) {
      if (Object.prototype.hasOwnProperty.call(totalsSource, key)) {
        const value = totalsSource[key];
        if (value !== undefined && value !== null) {
          totals[key] = value as NonNullable<RawUsagePayload['totals']>[typeof key];
        }
      }
    }
  }

  const directTotals: Array<[
    keyof NonNullable<RawUsagePayload['totals']>,
    unknown,
  ]> = [
    ['input_tokens', response['input_tokens']],
    ['output_tokens', response['output_tokens']],
    ['total_tokens', response['total_tokens']],
    ['tool_calls', response['tool_calls']],
    ['cost_usd', response['cost_usd']],
  ];

  for (const [key, value] of directTotals) {
    if (value !== undefined && value !== null) {
      totals[key] = value as NonNullable<RawUsagePayload['totals']>[typeof key];
    }
  }

  if (Object.keys(totals).length === 0) return null;

  const periodDaysRaw = Object.prototype.hasOwnProperty.call(response, 'period_days')
    ? toNumber(response['period_days'])
    : undefined;
  // RawUsagePayload.period_days is number | undefined, not number | null
  const periodDays = periodDaysRaw ?? undefined;

  const period = isRecord(response['period']) ? (response['period'] as RawUsagePayload['period']) : undefined;
  const windowStart = response['window_start'] ?? null;
  const windowEnd = response['window_end'] ?? null;

  return {
    ...(periodDays !== undefined ? { period_days: periodDays } : {}),
    ...(windowStart !== null && typeof windowStart === 'string' ? { window_start: windowStart } : {}),
    ...(windowEnd !== null && typeof windowEnd === 'string' ? { window_end: windowEnd } : {}),
    ...(period !== undefined ? { period } : {}),
    ...(Object.keys(totals).length > 0 ? { totals } : {}),
    ...(Object.prototype.hasOwnProperty.call(response, 'source_label')
      ? { source_label: typeof response['source_label'] === 'string' ? response['source_label'] : null }
      : {}),
  };
}

function pickProviderQuotasFromResponse(response: UsageSourcePayload): RawProviderQuotaPayload[] | undefined {
  const candidates: unknown[] = [
    response.provider_quotas,
    response.provider_limits,
  ];

  // Also check inside the usage wrapper if present
  const usageObj = response?.usage;
  if (isRecord(usageObj)) {
    const usageRecord = usageObj as Record<string, unknown>;
    candidates.push(usageRecord.provider_quotas);
    candidates.push(usageRecord.provider_limits);
  }

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        provider: typeof entry.provider === 'string' ? entry.provider : 'unknown',
        remaining_requests: entry.remaining_requests as RawProviderQuotaPayload['remaining_requests'],
        request_limit: entry.request_limit as RawProviderQuotaPayload['request_limit'],
        remaining_tokens: entry.remaining_tokens as RawProviderQuotaPayload['remaining_tokens'],
        token_limit: entry.token_limit as RawProviderQuotaPayload['token_limit'],
        reset_at: typeof entry.reset_at === 'string' ? entry.reset_at : null,
      }));
  }
  return undefined;
}

function makeUsageAlerts(params: {
  lastError: string | null;
  hasUsagePayload: boolean;
  hasAnyMetricValue: boolean;
  hasAllMetricValues: boolean;
  receivedAt: string;
}): UsageAlert[] {
  const now = params.receivedAt;
  if (params.lastError) {
    return [
      {
        id: 'usage-refresh-failed',
        severity: 'critical',
        source: 'usage-cli',
        message: params.lastError,
        occurredAt: now,
      },
    ];
  }
  if (!params.hasUsagePayload) {
    return [
      {
        id: 'usage-payload-missing',
        severity: 'warning',
        source: 'usage-cli',
        message:
          'Usage adapter returned no usage payload; telemetry remains unknown until a verified source is wired.',
        occurredAt: now,
      },
    ];
  }
  if (!params.hasAnyMetricValue) {
    return [
      {
        id: 'usage-metric-values-missing',
        severity: 'warning',
        source: 'usage-cli',
        message: 'Usage payload was present, but all metric values are missing.',
        occurredAt: now,
      },
    ];
  }
  if (!params.hasAllMetricValues) {
    return [
      {
        id: 'usage-metric-values-partial',
        severity: 'warning',
        source: 'usage-cli',
        message: 'Usage payload was present, but only some metric values were reported.',
        occurredAt: now,
      },
    ];
  }
  return [];
}

/** Bind a usage adapter (Cloud-owned) so `refreshUsage` can pull real snapshots. */
export function setUsageAdapter(next: UsageAdapter | null): void {
  adapter = next;
}

/** Clear store data to the conservative unknown baseline. */
export function resetUsageToUnknown(periodDays = 7): void {
  resetToInitial(periodDays);
}

/**
 * Test-only reset to canonical baseline.
 * Kept as a dedicated helper to avoid mutating test fixtures with production wording.
 */
export function _resetForTest(): void {
  resetToInitial();
}

/** Load and normalize one usage snapshot from the bound adapter. */
export async function refreshUsage(days = 7): Promise<void> {
  if (!adapter) {
    resetUsageToUnknown(days);
    setError('No usage adapter bound');
    return;
  }

  try {
    const response = (await adapter.fetchUsage(days)) as UsageSourcePayload;
    const payload = pickUsagePayloadFromResponse(response);
    const providerQuotaPayload = pickProviderQuotasFromResponse(response);
    const receivedAt = new Date().toISOString();
    const hasUsagePayload = payload !== null;
    const normalized = normalizeUsagePayload(payload, {
      source: 'usage-cli',
      freshness: 'live',
      confidence: 'unverified',
      receivedAt,
      sourceLabel: payload?.source_label ?? (typeof response.source_label === 'string' ? response.source_label : null),
    });
    const hasAnyMetricValue = normalized.metrics.some((metric) => metric.value !== null);
    const hasAllMetricValues = normalized.metrics.every((metric) => metric.value !== null);
    const normalizedWithFreshness = {
      ...normalized,
      metrics: hasAnyMetricValue
        ? hasAllMetricValues
          ? normalized.metrics
          : withPartialMetricFreshness(normalized.metrics)
        : withMissingMetricFreshness(normalized.metrics),
    };
    const quotas = normalizeProviderQuotas(providerQuotaPayload, {
      source: 'provider-rate-limits',
      freshness: 'live',
      confidence: 'unknown',
      receivedAt,
    });

    setUsageSnapshot(normalizedWithFreshness);
    setProviderQuotas(quotas);
    setAlerts(
      makeUsageAlerts({
        lastError: null,
        hasUsagePayload,
        hasAnyMetricValue,
        hasAllMetricValues,
        receivedAt,
      }),
    );

    if (!hasUsagePayload || !hasAnyMetricValue) {
      setError('Usage adapter did not return metric values');
      return;
    }

    if (!hasAllMetricValues) {
      setError('Usage adapter returned partial metric values');
      return;
    }

    setError(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setError(message);
    setAlerts(makeUsageAlerts({
      lastError: message,
      hasUsagePayload: false,
      hasAnyMetricValue: false,
      hasAllMetricValues: false,
      receivedAt: new Date().toISOString(),
    }));
    resetUsageToUnknown(days);
  }
}

/** Ingest a pre-normalized alert list for local evaluation. */
export function ingestUsageAlerts(alerts: UsageAlert[]): void {
  setAlerts(alerts);
}

/** Acknowledge a single alert by id. */
export function acknowledgeUsageAlert(alertId: string): void {
  if (state.alerts.value === null) return;
  const next = state.alerts.value.filter((alert) => alert.id !== alertId);
  setAlerts(next);
}

/** Selectors used by the Ops panel and diagnostics UI. */
export function getUsageState(): UsageStoreState {
  return state;
}

/** React hook for OpsPanel or future alert surfaces. */
export function useUsageStore(): UsageStoreState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export const usageStore = {
  get state(): UsageStoreState {
    return state;
  },
  setUsageAdapter,
  resetUsageToUnknown,
  refreshUsage,
  ingestUsageAlerts,
  acknowledgeUsageAlert,
  getUsageState,
};
