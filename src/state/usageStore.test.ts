import { beforeEach, describe, expect, it } from 'vitest';
import { _resetForTest, getUsageState, refreshUsage, setUsageAdapter } from '@/state/usageStore';

function usageAdapterResponseUsageOnly(usage: Record<string, unknown>) {
  return {
    usage,
  };
}

describe('usageStore adapter boundary and phase-5 risk states', () => {
  beforeEach(() => {
    _resetForTest();
    setUsageAdapter(null);
  });

  it('holds unknown state when usage adapter is missing', async () => {
    await refreshUsage(7);

    const state = getUsageState();
    expect(state.lastError).toBe('No usage adapter bound');
    expect(state.snapshot.value?.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(state.snapshot.provenance.source).toBe('usage-cli');
    expect(state.snapshot.provenance.freshness).toBe('missing');
    expect(state.snapshot.provenance.confidence).toBe('unknown');
    expect(state.providerQuotas.value).toEqual([]);
    expect(state.providerQuotas.provenance.freshness).toBe('missing');
    expect(state.providerQuotas.provenance.confidence).toBe('unknown');
    expect(state.alerts.value).toEqual([]);
  });

  it('normalizes verified payload shape into usage metrics and quota rows', async () => {
    setUsageAdapter({
      fetchUsage: async () =>
        usageAdapterResponseUsageOnly({
          period_days: 14,
          window_start: '2026-06-01T00:00:00.000Z',
          window_end: '2026-06-08T00:00:00.000Z',
          totals: {
            input_tokens: '112',
            output_tokens: 88,
            total_tokens: 200,
            tool_calls: '14',
            cost_usd: '3.25',
          },
          source_label: 'kanban.stats',
          provider_limits: [
            {
              provider: 'openai',
              remaining_requests: '72',
              request_limit: 100,
              remaining_tokens: 1200,
              token_limit: 2000,
              reset_at: '2026-06-22T00:00:00.000Z',
            },
          ],
        }),
    });

    await refreshUsage(14);

    const state = getUsageState();
    expect(state.lastError).toBeNull();
    expect(state.snapshot.provenance.source).toBe('usage-cli');
    expect(state.snapshot.provenance.freshness).toBe('live');
    expect(state.snapshot.provenance.confidence).toBe('unverified');
    expect(state.snapshot.value!.periodDays).toBe(14);
    expect(state.snapshot.value!.windowStart).toBe('2026-06-01T00:00:00.000Z');
    expect(state.snapshot.value!.windowEnd).toBe('2026-06-08T00:00:00.000Z');
    expect(state.snapshot.value!.sourceLabel).toBe('kanban.stats');
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'input-tokens')?.value).toBe(112);
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'output-tokens')?.value).toBe(88);
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'total-tokens')?.value).toBe(200);
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'tool-calls')?.value).toBe(14);
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'cost-usd')?.value).toBe(3.25);

    expect(state.providerQuotas.value).toHaveLength(1);
    expect(state.providerQuotas.value![0].provider).toBe('openai');
    expect(state.providerQuotas.value![0].remainingRequests).toBe(72);
    expect(state.providerQuotas.value![0].requestLimit).toBe(100);
    expect(state.providerQuotas.value![0].remainingTokens).toBe(1200);
    expect(state.providerQuotas.value![0].tokenLimit).toBe(2000);
    expect(state.providerQuotas.value![0].provenance.confidence).toBe('unknown');
    expect(state.providerQuotas.value![0].provenance.freshness).toBe('live');
    expect(state.alerts.value).toEqual([]);
  });

  it('extracts values from raw top-level payload wrappers', async () => {
    setUsageAdapter({
      fetchUsage: async () => ({
        data: {
          usage: {
            totals: {
              input_tokens: 30,
              output_tokens: 20,
              total_tokens: 50,
              tool_calls: 5,
              cost_usd: 1.2,
            },
          },
        },
      }),
    });

    await refreshUsage();

    const state = getUsageState();
    const lookup = Object.fromEntries(state.snapshot.value!.metrics.map((metric) => [metric.id, metric.value]));
    expect(lookup['input-tokens']).toBe(30);
    expect(lookup['output-tokens']).toBe(20);
    expect(lookup['total-tokens']).toBe(50);
    expect(lookup['tool-calls']).toBe(5);
    expect(lookup['cost-usd']).toBe(1.2);
    expect(state.snapshot.provenance.freshness).toBe('live');
  });

  it('marks payloads with no usable usage metrics as warning (no healthy rendering state)', async () => {
    setUsageAdapter({
      fetchUsage: async () =>
        usageAdapterResponseUsageOnly({
          totals: {
            input_tokens: -1,
            output_tokens: -4,
            total_tokens: -2,
            tool_calls: null,
            cost_usd: -1.5,
          },
        }),
    });

    await refreshUsage();

    const state = getUsageState();
    expect(state.snapshot.provenance.freshness).toBe('stale');
    expect(state.snapshot.value!.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(state.snapshot.value!.metrics.every((metric) => metric.provenance.freshness === 'missing')).toBe(true);
    expect(state.snapshot.value!.metrics.every((metric) => metric.provenance.note === 'Field not reported by usage source')).toBe(true);
    expect(state.alerts.value).toHaveLength(1);
    expect(state.alerts.value![0]?.severity).toBe('warning');
    expect(state.alerts.value![0]?.id).toBe('usage-metric-values-missing');
    expect(state.providerQuotas.value).toEqual([]);
    expect(state.providerQuotas.provenance.freshness).toBe('missing');
  });

  it('marks partial metric payloads as warning and degraded in source health', async () => {
    setUsageAdapter({
      fetchUsage: async () =>
        usageAdapterResponseUsageOnly({
          totals: {
            input_tokens: 100,
            output_tokens: null,
            total_tokens: 99,
            tool_calls: null,
            cost_usd: 1.7,
          },
        }),
    });

    await refreshUsage();

    const state = getUsageState();
    expect(state.lastError).toBe('Usage adapter returned partial metric values');
    expect(state.alerts.value).toHaveLength(1);
    expect(state.alerts.value![0]?.id).toBe('usage-metric-values-partial');
    expect(state.alerts.value![0]?.severity).toBe('warning');
    expect(state.snapshot.provenance.freshness).toBe('stale');
    expect(state.snapshot.provenance.confidence).toBe('unverified');
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'input-tokens')?.value).toBe(100);
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'output-tokens')?.value).toBeNull();
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'tool-calls')?.value).toBeNull();
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'cost-usd')?.value).toBe(1.7);
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'tool-calls')?.provenance.freshness).toBe('stale');
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'input-tokens')?.provenance.freshness).toBe('live');
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'total-tokens')?.provenance.freshness).toBe('live');
    expect(state.snapshot.value!.metrics.find((metric) => metric.id === 'cost-usd')?.provenance.freshness).toBe('live');
  });

  it('marks a complete payload miss as warning and keeps quotas unknown, not fabricated', async () => {
    setUsageAdapter({
      fetchUsage: async () => usageAdapterResponseUsageOnly({ window_start: '2026-06-01T00:00:00.000Z' }),
    });

    await refreshUsage();

    const state = getUsageState();
    expect(state.alerts.value).toHaveLength(1);
    expect(state.alerts.value![0]?.id).toBe('usage-metric-values-missing');
    expect(state.snapshot.value!.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(state.snapshot.provenance.freshness).toBe('stale');
    expect(state.providerQuotas.value).toEqual([]);
    expect(state.providerQuotas.provenance.confidence).toBe('unknown');
    expect(state.lastError).toBe('Usage adapter did not return metric values');
  });

  it('accepts provider_limits payload names as a quota source until a verified API exists', async () => {
    setUsageAdapter({
      fetchUsage: async () =>
        usageAdapterResponseUsageOnly({
          period_days: 7,
          totals: { total_tokens: 9, input_tokens: 4, output_tokens: 5, tool_calls: 1, cost_usd: 0 },
          provider_limits: [
            {
              provider: 'anthropic',
              remaining_requests: 3,
              request_limit: 40,
            },
          ],
        }),
    });

    await refreshUsage();

    const state = getUsageState();
    expect(state.providerQuotas.value).toHaveLength(1);
    expect(state.providerQuotas.value![0].provider).toBe('anthropic');
    expect(state.providerQuotas.value![0].remainingRequests).toBe(3);
    expect(state.providerQuotas.value![0].requestLimit).toBe(40);
    expect(state.providerQuotas.value![0].provenance.confidence).toBe('unknown');
    expect(state.providerQuotas.value![0].provenance.freshness).toBe('live');
  });
});
