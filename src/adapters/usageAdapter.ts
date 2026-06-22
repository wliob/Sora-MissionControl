/**
 * Usage adapter helpers — normalize raw usage payloads from Hermes sources.
 *
 * `hermes insights` is the verified target for Phase 5's first implementation.
 * The payload shape is intentionally treated as opportunistic: adapters can pass
 * extra fields without breaking normalization, and missing fields remain unknown.
 */

import type { Confidence, DataSource, Freshness } from '@/types/provenance';
import { createUnknownUsageSnapshot, type ProviderQuotaSnapshot, type UsageMetric, type UsageSnapshot, USAGE_METRIC_SEEDS } from '@/types/usage';

export interface RawUsagePayload {
  period_days?: number;
  window_start?: string | null;
  window_end?: string | null;
  period?: {
    days?: number;
    start?: string | null;
    end?: string | null;
  };
  totals?: {
    input_tokens?: number | string | null;
    output_tokens?: number | string | null;
    total_tokens?: number | string | null;
    tool_calls?: number | string | null;
    cost_usd?: number | string | null;
  };
  source_label?: string | null;
}

export interface RawProviderQuotaPayload {
  provider?: string;
  remaining_requests?: number | string | null;
  request_limit?: number | string | null;
  remaining_tokens?: number | string | null;
  token_limit?: number | string | null;
  reset_at?: string | null;
}

export interface RawUsageResponse {
  usage?: RawUsagePayload;
  period_days?: number;
  period?: RawUsagePayload['period'];
}

type MetricInput = {
  id: UsageMetric['id'];
  raw: number | string | null | undefined;
  seedLabel: string;
};

interface NormalizeOptions {
  source?: DataSource;
  freshness?: Freshness;
  confidence?: Confidence;
  receivedAt?: string;
  sourceLabel?: string | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNonNegativeOrNull(value: unknown): number | null {
  const n = toNumber(value);
  return n === null || n < 0 ? null : n;
}

/** Normalize a usage payload into a Phase 5 canonical usage snapshot. */
export function normalizeUsagePayload(
  raw: RawUsagePayload | null | undefined,
  opts: NormalizeOptions = {},
): UsageSnapshot {
  const {
    source = 'usage-cli',
    freshness = 'fresh',
    confidence = 'verified',
    receivedAt = new Date().toISOString(),
    sourceLabel = null,
  } = opts;

  const periodDays =
    toNonNegativeOrNull(raw?.period_days) ??
    toNonNegativeOrNull(raw?.period?.days) ??
    7;

  const metricSeedById = Object.fromEntries(
    USAGE_METRIC_SEEDS.map((seed) => [seed.id, seed.label]),
  ) as Record<string, string>;

  const totals = raw?.totals ?? {};
  const metricInputs: MetricInput[] = [
    { id: 'input-tokens', raw: totals.input_tokens, seedLabel: metricSeedById['input-tokens'] },
    { id: 'output-tokens', raw: totals.output_tokens, seedLabel: metricSeedById['output-tokens'] },
    { id: 'total-tokens', raw: totals.total_tokens, seedLabel: metricSeedById['total-tokens'] },
    { id: 'tool-calls', raw: totals.tool_calls, seedLabel: metricSeedById['tool-calls'] },
    { id: 'cost-usd', raw: totals.cost_usd, seedLabel: metricSeedById['cost-usd'] },
  ];

  const metrics: UsageMetric[] = metricInputs.map((entry) => ({
    id: entry.id,
    label: entry.seedLabel,
    value: toNonNegativeOrNull(entry.raw),
    unit: entry.id === 'cost-usd' ? 'usd' : entry.id === 'tool-calls' ? 'calls' : 'tokens',
    provenance: {
      source,
      freshness,
      confidence,
      receivedAt,
      ...(raw === null || raw === undefined || toNonNegativeOrNull(entry.raw) === null ? { note: 'Field not reported by usage source' } : {}),
    },
  }));

  return {
    periodDays,
    windowStart:
      raw?.window_start ?? raw?.period?.start ?? null,
    windowEnd:
      raw?.window_end ?? raw?.period?.end ?? null,
    receivedAt,
    metrics,
    sourceLabel,
  };
}

/** Normalize provider quota payloads. */
export function normalizeProviderQuotas(
  items: RawProviderQuotaPayload[] | null | undefined,
  opts: NormalizeOptions = {},
): ProviderQuotaSnapshot[] {
  const {
    source = 'provider-rate-limits',
    freshness = 'fresh',
    confidence = 'unverified',
    receivedAt = new Date().toISOString(),
  } = opts;
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((entry) => ({
    provider: String(entry.provider ?? 'unknown'),
    remainingRequests: toNonNegativeOrNull(entry.remaining_requests),
    requestLimit: toNonNegativeOrNull(entry.request_limit),
    remainingTokens: toNonNegativeOrNull(entry.remaining_tokens),
    tokenLimit: toNonNegativeOrNull(entry.token_limit),
    resetAt: entry.reset_at ?? null,
    provenance: {
      source,
      freshness,
      confidence,
      receivedAt,
      ...(entry.provider == null ? { note: 'Provider name missing' } : {}),
    },
  }));
}

/** Build a safe unknown snapshot when no data was returned. */
export function createUnknownUsageSnapshotResponse(): UsageSnapshot {
  return createUnknownUsageSnapshot();
}
