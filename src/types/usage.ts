/**
 * Canonical usage and quota model for Phase 5 live ops.
 *
 * The store exposes one snapshot with provenance so the UI can render unknown,
 * unverified, and verified usage states without inventing numbers. The model
 * intentionally keeps per-metric provenance so a partially observed payload can
 * still render safely.
 */

import type { DataSource, Freshness, Confidence, Tracked } from './provenance';
import { tracked } from './provenance';

/**
 * Known usage metric ids used by the card render layer.
 */
export type UsageMetricId =
  | 'input-tokens'
  | 'output-tokens'
  | 'total-tokens'
  | 'tool-calls'
  | 'cost-usd';

/** Severity for runtime usage alerts shown in the Ops panel strip. */
export type UsageAlertSeverity = 'critical' | 'warning' | 'info' | 'unknown';

/** Snapshot-level metric row. */
export interface UsageMetric {
  /** Stable ID that maps to a card label in the Ops UI. */
  id: UsageMetricId;
  /** Human-readable card label. */
  label: string;
  /** Normalized numeric value; `null` means unknown/unavailable. */
  value: number | null;
  /** Render unit used in the Ops card text. */
  unit: 'tokens' | 'usd' | 'calls';
  /** Per-metric provenance metadata. */
  provenance: {
    source: DataSource;
    freshness: Freshness;
    confidence: Confidence;
    receivedAt: string;
    note?: string;
  };
}

/** The canonical usage payload consumed by the Ops panel. */
export interface UsageSnapshot {
  /** Snapshot window requested/used by the backend adapter (defaults to 7 days). */
  periodDays: number;
  /** Window start (ISO 8601) when backend reported it, null when unknown. */
  windowStart: string | null;
  /** Window end (ISO 8601) when backend reported it, null when unknown. */
  windowEnd: string | null;
  /** ISO 8601 ingestion time for the snapshot container. */
  receivedAt: string;
  /** One metric row per canonical usage concept. */
  metrics: UsageMetric[];
  /** Human-readable source tag from the adapter, e.g. `hermes insights` run context. */
  sourceLabel?: string | null;
}

/** Real-time limit/remaining numbers, when/if verified in a future phase. */
export interface ProviderQuotaSnapshot {
  provider: string;
  /** Remaining request quota, if available from a verified source. */
  remainingRequests: number | null;
  /** Total request quota window, if available. */
  requestLimit: number | null;
  /** Remaining token quota, if available from a verified source. */
  remainingTokens: number | null;
  /** Token window cap, if available. */
  tokenLimit: number | null;
  /** Optional reset timestamp from provider/bridge responses. */
  resetAt: string | null;
  /** Per-provider provenance. */
  provenance: {
    source: DataSource;
    freshness: Freshness;
    confidence: Confidence;
    receivedAt: string;
    note?: string;
  };
}

/** Operational risk item used by the Ops alert strip. */
export interface UsageAlert {
  id: string;
  severity: UsageAlertSeverity;
  /** Source label shown in a compact monospace column. */
  source: string;
  message: string;
  /** ISO 8601 timestamp of the alert event. */
  occurredAt: string;
}

/** State shape owned by `usageStore`. */
export interface UsageStoreState {
  /** Historical usage snapshot from `hermes insights` (or future equivalent). */
  snapshot: Tracked<UsageSnapshot>;
  /** Real-time provider quotas (unknown until a verified source lands). */
  providerQuotas: Tracked<ProviderQuotaSnapshot[]>;
  /** Alerting summary; empty by default. */
  alerts: Tracked<UsageAlert[]>;
  /** Raw non-secret error message from adapter/normalization failure. */
  lastError: string | null;
}

export interface UsageMetricSeed {
  id: UsageMetricId;
  label: string;
  unit: UsageMetric['unit'];
}

/** Canonical card seeds so UI rendering does not depend on adapter output order. */
export const USAGE_METRIC_SEEDS: UsageMetricSeed[] = [
  { id: 'total-tokens', label: 'Tokens (total)', unit: 'tokens' },
  { id: 'input-tokens', label: 'Tokens (input)', unit: 'tokens' },
  { id: 'output-tokens', label: 'Tokens (output)', unit: 'tokens' },
  { id: 'tool-calls', label: 'Tool calls', unit: 'calls' },
  { id: 'cost-usd', label: 'Estimated cost', unit: 'usd' },
];

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Construct a placeholder usage row with `null` values.
 */
export function createEmptyUsageMetric(seed: UsageMetricSeed): UsageMetric {
  return {
    id: seed.id,
    label: seed.label,
    value: null,
    unit: seed.unit,
    provenance: {
      source: 'usage-cli',
      freshness: 'missing',
      confidence: 'unknown',
      receivedAt: nowIso(),
      note: 'Source not yet verified',
    },
  };
}

/**
 * Create an initial (unknown) usage snapshot.
 */
export function createUnknownUsageSnapshot(periodDays = 7): UsageSnapshot {
  return {
    periodDays,
    windowStart: null,
    windowEnd: null,
    receivedAt: nowIso(),
    metrics: USAGE_METRIC_SEEDS.map(createEmptyUsageMetric),
    sourceLabel: null,
  };
}

/**
 * Initial usage-store state before an adapter is bound/verified.
 * Always starts with placeholder metrics (no invented values).
 */
export function initialUsageStoreState(): UsageStoreState {
  return {
    snapshot: tracked(createUnknownUsageSnapshot(), {
      source: 'usage-cli',
      freshness: 'missing',
      confidence: 'unknown',
      note: 'Usage source not verified yet',
    }),
    providerQuotas: tracked([], {
      source: 'provider-rate-limits',
      freshness: 'missing',
      confidence: 'unknown',
      note: 'Rate-limit source not verified yet',
    }),
    alerts: tracked([], {
      source: 'local-runtime',
      freshness: 'missing',
      confidence: 'unknown',
      note: 'No usage alerts available',
    }),
    lastError: null,
  };
}
