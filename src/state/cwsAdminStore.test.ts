/**
 * Tests for cwsAdminStore — Phase 6 unified admin safety patterns.
 *
 * Covers:
 *   - Redaction guards: unmasked secrets rejected on ingest
 *   - Confirmation gates: destructive/risky actions require confirmation
 *   - Action tier classification: safe/risk/danger
 *   - One-time secret reveal: raw secrets only in lastResult, never persisted
 *   - Typed phrase requirement for most destructive actions
 *   - No modal stacking: only first pending rendered
 *   - Provenance tracking per subsection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cwsRequiresConfirmation,
  cwsActionTier,
  cwsRequiresTypedPhrase,
  summarizeCwsAction,
  truncatePreview,
  assertCwsFieldMasked,
  initialCwsAdminState,
  type CwsAction,
  type CronJob,
  type WebhookEntry,
  type SkillEntry,
  type CwsActionResult,
} from '@/types/admin-cws';
import {
  cwsAdminStore,
  _resetForTest,
  _ingestCronJobs,
  _ingestWebhooks,
  _ingestSkills,
  setCwsAdminAdapter,
  hasCwsAdapter,
  type CwsAdminAdapter,
} from '@/state/cwsAdminStore';

// ── Helpers ────────────────────────────────────────────────────────────

function makeCronJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: 'cron-1',
    name: 'Daily backup',
    schedule: '0 9 * * *',
    enabled: true,
    paused: false,
    promptPreview: 'Run backup…',
    hasScript: false,
    skills: [],
    modelOverride: null,
    lastRunAt: null,
    nextRunAt: '2026-06-22T09:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
    error: null,
    ...overrides,
  };
}

function makeWebhook(overrides: Partial<WebhookEntry> = {}): WebhookEntry {
  return {
    id: 'wh-1',
    name: 'Backup notifier',
    event: 'cron.completed',
    callbackUrl: 'https://example.com/webhook',
    hasSecret: true,
    maskedSecret: 'wh-…ab12',
    active: true,
    lastTriggeredAt: null,
    createdAt: '2026-06-01T00:00:00Z',
    error: null,
    ...overrides,
  };
}

function makeSkill(overrides: Partial<SkillEntry> = {}): SkillEntry {
  return {
    name: 'test-skill',
    description: 'A test skill',
    source: 'builtin',
    enabled: true,
    category: null,
    subSkillCount: null,
    lastModifiedAt: null,
    hasSensitiveAccess: false,
    ...overrides,
  };
}

function makeAdapter(resolves: Partial<CwsAdminAdapter> = {}): CwsAdminAdapter {
  return {
    listCronJobs: resolves.listCronJobs ?? (async () => []),
    listWebhooks: resolves.listWebhooks ?? (async () => []),
    listSkills: resolves.listSkills ?? (async () => []),
    executeAction: resolves.executeAction ?? (async () => ({
      action: { kind: 'cron.run', id: 'cron-1' },
      ok: true,
      message: 'Done',
      completedAt: new Date().toISOString(),
    })),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetForTest();
});

// ── 1. Type helpers: action tier classification ───────────────────────

describe('cwsActionTier', () => {
  it('classifies safe actions', () => {
    expect(cwsActionTier({ kind: 'skill.list' })).toBe('safe');
    expect(cwsActionTier({ kind: 'skill.view', name: 'x' })).toBe('safe');
  });

  it('classifies risk actions', () => {
    expect(cwsActionTier({ kind: 'cron.create', name: 'x', schedule: '*', prompt: 'do thing' })).toBe('risk');
    expect(cwsActionTier({ kind: 'cron.pause', id: 'x' })).toBe('risk');
    expect(cwsActionTier({ kind: 'cron.resume', id: 'x' })).toBe('risk');
    expect(cwsActionTier({ kind: 'cron.run', id: 'x' })).toBe('risk');
    expect(cwsActionTier({ kind: 'cron.update', id: 'x' })).toBe('risk');
    expect(cwsActionTier({ kind: 'webhook.update', id: 'x' })).toBe('risk');
    expect(cwsActionTier({ kind: 'skill.enable', name: 'x' })).toBe('risk');
    expect(cwsActionTier({ kind: 'skill.disable', name: 'x' })).toBe('risk');
  });

  it('classifies danger actions', () => {
    expect(cwsActionTier({ kind: 'cron.remove', id: 'x' })).toBe('danger');
    expect(cwsActionTier({ kind: 'webhook.remove', id: 'x' })).toBe('danger');
  });
});

describe('cwsRequiresConfirmation', () => {
  it('does not require confirmation for safe actions', () => {
    expect(cwsRequiresConfirmation({ kind: 'webhook.create', name: 'x', event: 'cron.completed', callbackUrl: '' })).toBe(false);
    expect(cwsRequiresConfirmation({ kind: 'skill.list' })).toBe(false);
    expect(cwsRequiresConfirmation({ kind: 'skill.view', name: 'x' })).toBe(false);
  });

  it('requires confirmation for risk and danger actions', () => {
    expect(cwsRequiresConfirmation({ kind: 'cron.create', name: 'x', schedule: '*', prompt: 'do thing' })).toBe(true);
    expect(cwsRequiresConfirmation({ kind: 'cron.pause', id: 'x' })).toBe(true);
    expect(cwsRequiresConfirmation({ kind: 'cron.run', id: 'x' })).toBe(true);
    expect(cwsRequiresConfirmation({ kind: 'cron.remove', id: 'x' })).toBe(true);
    expect(cwsRequiresConfirmation({ kind: 'webhook.remove', id: 'x' })).toBe(true);
    expect(cwsRequiresConfirmation({ kind: 'skill.enable', name: 'x' })).toBe(true);
    expect(cwsRequiresConfirmation({ kind: 'skill.disable', name: 'x' })).toBe(true);
  });
});

describe('cwsRequiresTypedPhrase', () => {
  it('requires typed phrase for danger actions', () => {
    expect(cwsRequiresTypedPhrase({ kind: 'cron.remove', id: 'x' })).toBe(true);
    expect(cwsRequiresTypedPhrase({ kind: 'webhook.remove', id: 'x' })).toBe(true);
  });

  it('does not require typed phrase for risk or safe actions', () => {
    expect(cwsRequiresTypedPhrase({ kind: 'cron.pause', id: 'x' })).toBe(false);
    expect(cwsRequiresTypedPhrase({ kind: 'skill.enable', name: 'x' })).toBe(false);
    expect(cwsRequiresTypedPhrase({ kind: 'cron.run', id: 'x' })).toBe(false);
  });
});

// ── 2. Redaction guards ──────────────────────────────────────────────

describe('truncatePreview', () => {
  it('returns null for null input', () => {
    expect(truncatePreview(null)).toBeNull();
  });

  it('returns short strings unchanged', () => {
    expect(truncatePreview('hello')).toBe('hello');
  });

  it('truncates long strings', () => {
    const long = 'a'.repeat(100);
    const result = truncatePreview(long);
    expect(result!.length).toBeLessThan(long.length);
    expect(result!.endsWith('…')).toBe(true);
  });

  it('respects custom maxLength', () => {
    const text = 'abcdefghij';
    expect(truncatePreview(text, 5)).toBe('ab…');
  });
});

describe('assertCwsFieldMasked', () => {
  it('passes for null values', () => {
    expect(() => assertCwsFieldMasked(null, 'test')).not.toThrow();
  });

  it('passes for short strings', () => {
    expect(() => assertCwsFieldMasked('short', 'test')).not.toThrow();
  });

  it('passes for masked strings with bullets', () => {
    expect(() => assertCwsFieldMasked('sk-••••…ab3f', 'test')).not.toThrow();
  });

  it('throws for long strings that look like API keys', () => {
    expect(() => assertCwsFieldMasked('sk-abcdef1234567890abcdef', 'test')).toThrow(
      /refusing to ingest/,
    );
  });
});

describe('cron ingest redaction guard', () => {
  it('accepts well-formed cron jobs with truncated previews', () => {
    const jobs = [makeCronJob({ promptPreview: 'Run backup…' })];
    expect(() => _ingestCronJobs(jobs)).not.toThrow();
    expect(cwsAdminStore.getCronJobs()).toHaveLength(1);
  });

  it('rejects cron jobs with suspiciously long promptPreview', () => {
    const longPreview = 'a'.repeat(300);
    const jobs = [makeCronJob({ promptPreview: longPreview })];
    expect(() => _ingestCronJobs(jobs)).toThrow(/suspiciously long/);
  });
});

describe('webhook ingest redaction guard', () => {
  it('accepts well-formed webhooks with masked secrets', () => {
    const webhooks = [makeWebhook({ maskedSecret: 'wh-…ab12' })];
    expect(() => _ingestWebhooks(webhooks)).not.toThrow();
    expect(cwsAdminStore.getWebhooks()).toHaveLength(1);
  });

  it('rejects webhooks with unmasked secrets', () => {
    const webhooks = [makeWebhook({ maskedSecret: 'sk-abcdef1234567890abcdef' })];
    expect(() => _ingestWebhooks(webhooks)).toThrow(/refusing to ingest/);
  });

  it('rejects webhooks with unmasked credentials in callbackUrl', () => {
    const webhooks = [makeWebhook({ callbackUrl: 'https://user:pass123@host/path' })];
    expect(() => _ingestWebhooks(webhooks)).toThrow(/unmasked credentials/);
  });

  it('accepts webhooks with masked credentials in callbackUrl', () => {
    const webhooks = [makeWebhook({ callbackUrl: 'https://••••@host/path' })];
    expect(() => _ingestWebhooks(webhooks)).not.toThrow();
  });
});

// ── 3. Confirmation gate flow ────────────────────────────────────────

describe('confirmation gate for destructive actions', () => {
  it('queues a pending confirmation for cron.create', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.create', name: 'cron-risk', schedule: '30m', prompt: 'do work' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].action.kind).toBe('cron.create');
    expect(pending[0].tier).toBe('risk');
    expect(pending[0].requiresTypedPhrase).toBe(false);
    expect(pending[0].summary).toContain('live scheduler');
    expect(pending[0].summary).toContain('cost');
    expect(pending[0].summary).not.toContain('do work');
  });

  it('queues a pending confirmation for cron.remove', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].action.kind).toBe('cron.remove');
    expect(pending[0].tier).toBe('danger');
    expect(pending[0].requiresTypedPhrase).toBe(true);
  });

  it('queues a pending confirmation for webhook.remove', () => {
    cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: 'wh-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('danger');
  });

  it('queues risk-tier confirmations without typed phrase', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.pause', id: 'cron-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('risk');
    expect(pending[0].requiresTypedPhrase).toBe(false);
  });

  it('queues a pending confirmation for cron.run', () => {
    _ingestCronJobs([makeCronJob()]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.run', id: 'cron-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].action.kind).toBe('cron.run');
    expect(pending[0].tier).toBe('risk');
    expect(pending[0].requiresTypedPhrase).toBe(false);
    expect(pending[0].summary).toContain('live scheduler');
    expect(pending[0].summary).toContain('quota');
  });

  it('cancels a pending confirmation without executing', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.cancelCwsAction(nonce);
    expect(cwsAdminStore.getCwsPending()).toHaveLength(0);
    expect(cwsAdminStore.getCwsLastResult()).toBeNull();
  });

  it('cancels all pending confirmations', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: 'wh-1' });
    expect(cwsAdminStore.getCwsPending()).toHaveLength(2);
    cwsAdminStore.cancelAllCwsPending();
    expect(cwsAdminStore.getCwsPending()).toHaveLength(0);
  });
});

describe('risk-gated cron actions execute only after confirmation', () => {
  it('does not execute cron.run before confirmation', async () => {
    const executeAction = vi.fn<() => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'cron.run', id: 'cron-1' },
      ok: true,
      message: 'Ran',
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));
    _ingestCronJobs([makeCronJob()]);

    cwsAdminStore.requestCwsAction({ kind: 'cron.run', id: 'cron-1' });

    expect(cwsAdminStore.getCwsPending()).toHaveLength(1);
    await Promise.resolve();
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('executes cron.run after confirmation', async () => {
    const executeAction = vi.fn<() => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'cron.run', id: 'cron-1' },
      ok: true,
      message: 'Ran',
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));
    _ingestCronJobs([makeCronJob()]);

    cwsAdminStore.requestCwsAction({ kind: 'cron.run', id: 'cron-1' });
    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.confirmCwsAction(nonce);

    await vi.waitFor(() => {
      expect(executeAction).toHaveBeenCalledOnce();
    });
  });

  it('does not execute cron.create before confirmation', async () => {
    const executeAction = vi.fn<() => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'cron.create', name: 'cron-risk', schedule: '30m', prompt: 'do work' },
      ok: true,
      message: 'Created',
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));

    cwsAdminStore.requestCwsAction({ kind: 'cron.create', name: 'cron-risk', schedule: '30m', prompt: 'do work' });

    expect(cwsAdminStore.getCwsPending()).toHaveLength(1);
    await Promise.resolve();
    expect(executeAction).not.toHaveBeenCalled();
  });
});

describe('confirmed action execution', () => {
  it('executes after confirmation', async () => {
    const executeAction = vi.fn<(action: CwsAction) => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'cron.remove', id: 'cron-1' } as CwsAction,
      ok: true,
      message: 'Removed',
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));
    _ingestCronJobs([makeCronJob()]);

    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    expect(cwsAdminStore.getCwsPending()).toHaveLength(1);

    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.confirmCwsAction(nonce);

    await vi.waitFor(() => {
      expect(executeAction).toHaveBeenCalledOnce();
    });
  });

  it('sets lastResult after execution', async () => {
    const executeAction = vi.fn<(action: CwsAction) => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'cron.remove', id: 'cron-1' } as CwsAction,
      ok: true,
      message: 'Removed',
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));
    _ingestCronJobs([makeCronJob()]);

    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.confirmCwsAction(nonce);

    await vi.waitFor(() => {
      expect(cwsAdminStore.getCwsLastResult()).not.toBeNull();
      expect(cwsAdminStore.getCwsLastResult()!.ok).toBe(true);
    });
  });

  it('records failure when no adapter is bound', async () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.confirmCwsAction(nonce);

    await vi.waitFor(() => {
      const result = cwsAdminStore.getCwsLastResult();
      expect(result).not.toBeNull();
      expect(result!.ok).toBe(false);
      expect(result!.message).toContain('No CWS admin adapter');
    });
  });
});

// ── 4. One-time secret reveal ────────────────────────────────────────

describe('one-time secret in lastResult', () => {
  it('stores createdCron with fullPrompt only in lastResult', async () => {
    const longPrompt = 'This is a very long secret prompt that contains sensitive information and should definitely be truncated in the preview because it exceeds the default 80 character limit by a significant margin';
    const executeAction = vi.fn<(action: CwsAction) => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'cron.create', name: 'test', schedule: '*', prompt: longPrompt },
      ok: true,
      message: 'Created',
      createdCron: {
        id: 'cron-new',
        name: 'test',
        schedule: '*',
        enabled: true,
        paused: false,
        promptPreview: truncatePreview(longPrompt),
        hasScript: false,
        skills: [],
        modelOverride: null,
        lastRunAt: null,
        nextRunAt: null,
        createdAt: new Date().toISOString(),
        error: null,
        fullPrompt: longPrompt,
        fullScript: null,
      },
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({
      executeAction,
      listCronJobs: async () => [
        makeCronJob({
          id: 'cron-real-1',
          name: 'test',
          promptPreview: truncatePreview(longPrompt),
        }),
      ],
    }));

    cwsAdminStore.requestCwsAction({
      kind: 'cron.create',
      name: 'test',
      schedule: '*',
      prompt: longPrompt,
    });
    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.confirmCwsAction(nonce);

    await vi.waitFor(() => {
      const result = cwsAdminStore.getCwsLastResult();
      expect(result).not.toBeNull();
      expect(result!.createdCron).toBeDefined();
      expect(result!.createdCron!.fullPrompt).toBe(longPrompt);
    });

    // The cron job list should have truncated preview, NOT full prompt
    const jobs = cwsAdminStore.getCronJobs();
    const newJob = jobs.find((j) => j.id === 'cron-real-1');
    expect(newJob).toBeDefined();
    expect(newJob!.promptPreview).not.toBe(longPrompt);
    expect(newJob!.promptPreview!.length).toBeLessThan(longPrompt.length);

    // After clearing lastResult, the full prompt is gone
    cwsAdminStore.clearCwsLastResult();
    expect(cwsAdminStore.getCwsLastResult()).toBeNull();

    // Verify the full JSON state does not contain the raw prompt
    const stateJson = JSON.stringify(cwsAdminStore.state);
    expect(stateJson).not.toContain(longPrompt);
  });

  it('stores createdWebhook with raw secret only in lastResult', async () => {
    const executeAction = vi.fn<() => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'webhook.create', name: 'test', event: 'cron.completed', callbackUrl: 'https://example.com' },
      ok: true,
      message: 'Created',
      createdWebhook: {
        id: 'wh-new',
        name: 'test',
        event: 'cron.completed',
        callbackUrl: 'https://example.com',
        hasSecret: true,
        maskedSecret: 'wh-…cd34',
        active: true,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        error: null,
        secret: 'whsec_raw_secret_value_12345',
        rawCallbackUrl: 'https://user:pass@host/path',
      },
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));

    cwsAdminStore.requestCwsAction({
      kind: 'webhook.create',
      name: 'test',
      event: 'cron.completed',
      callbackUrl: 'https://example.com',
    });

    await vi.waitFor(() => {
      const result = cwsAdminStore.getCwsLastResult();
      expect(result).not.toBeNull();
      expect(result!.createdWebhook).toBeDefined();
      expect(result!.createdWebhook!.secret).toBe('whsec_raw_secret_value_12345');
    });

    // After clearing, raw secret is gone from state
    cwsAdminStore.clearCwsLastResult();
    const stateJson = JSON.stringify(cwsAdminStore.state);
    expect(stateJson).not.toContain('whsec_raw_secret_value_12345');
    expect(stateJson).not.toContain('user:pass@host');
  });
});

// ── 5. No modal stacking ─────────────────────────────────────────────

describe('pending confirmation queue', () => {
  it('allows multiple pending confirmations (store tracks them)', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'c1' });
    cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: 'w1' });
    expect(cwsAdminStore.getCwsPending()).toHaveLength(2);
  });

  it('each pending confirmation gets a unique nonce', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'c1' });
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'c2' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending[0].nonce).not.toBe(pending[1].nonce);
  });

  it('confirming one action does not affect the other', async () => {
    const executeAction = vi.fn<(action: CwsAction) => Promise<CwsActionResult>>(async (action) => ({
      action,
      ok: true,
      message: 'Done',
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));

    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'c1' });
    cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: 'w1' });
    const nonce1 = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.confirmCwsAction(nonce1);

    expect(cwsAdminStore.getCwsPending()).toHaveLength(1);
    expect(cwsAdminStore.getCwsPending()[0].action.kind).toBe('webhook.remove');
  });
});

// ── 6. Provenance tracking ───────────────────────────────────────────

describe('provenance per subsection', () => {
  it('initial state has missing freshness', () => {
    const state = cwsAdminStore.state;
    expect(state.cronProvenance.freshness).toBe('missing');
    expect(state.webhookProvenance.freshness).toBe('missing');
    expect(state.skillsProvenance.freshness).toBe('missing');
  });

  it('updates cron provenance after ingest', () => {
    _ingestCronJobs([makeCronJob()]);
    expect(cwsAdminStore.state.cronProvenance.freshness).toBe('live');
    // Webhook and skills remain missing
    expect(cwsAdminStore.state.webhookProvenance.freshness).toBe('missing');
    expect(cwsAdminStore.state.skillsProvenance.freshness).toBe('missing');
  });

  it('updates webhook provenance after ingest', () => {
    _ingestWebhooks([makeWebhook()]);
    expect(cwsAdminStore.state.webhookProvenance.freshness).toBe('live');
    expect(cwsAdminStore.state.cronProvenance.freshness).toBe('missing');
  });

  it('updates skills provenance after ingest', () => {
    _ingestSkills([makeSkill()]);
    expect(cwsAdminStore.state.skillsProvenance.freshness).toBe('live');
  });
});

// ── 7. Adapter binding ──────────────────────────────────────────────

describe('adapter binding', () => {
  it('reports no adapter initially', () => {
    expect(hasCwsAdapter()).toBe(false);
  });

  it('reports adapter after binding', () => {
    setCwsAdminAdapter(makeAdapter());
    expect(hasCwsAdapter()).toBe(true);
  });

  it('clears adapter when set to null', () => {
    setCwsAdminAdapter(makeAdapter());
    expect(hasCwsAdapter()).toBe(true);
    setCwsAdminAdapter(null);
    expect(hasCwsAdapter()).toBe(false);
  });
});

// ── 8. Action summary generation ────────────────────────────────────

describe('summarizeCwsAction', () => {
  const cronJobs = [makeCronJob({ id: 'c1', name: 'Backup job' })];
  const webhooks = [makeWebhook({ id: 'w1', name: 'Notify hook' })];
  const skills = [makeSkill({ name: 's1' })];

  it('names the cron job in remove summary', () => {
    const summary = summarizeCwsAction({ kind: 'cron.remove', id: 'c1' }, cronJobs, webhooks, skills);
    expect(summary).toContain('Backup job');
    expect(summary).toContain('Permanently remove');
  });

  it('names the webhook in remove summary', () => {
    const summary = summarizeCwsAction({ kind: 'webhook.remove', id: 'w1' }, cronJobs, webhooks, skills);
    expect(summary).toContain('Notify hook');
  });

  it('mentions sensitive access for skill.enable', () => {
    const sensitiveSkills = [makeSkill({ name: 's1', hasSensitiveAccess: true })];
    const summary = summarizeCwsAction({ kind: 'skill.enable', name: 's1' }, cronJobs, webhooks, sensitiveSkills);
    expect(summary).toContain('sensitive');
  });

  it('falls back to id when job not found', () => {
    const summary = summarizeCwsAction({ kind: 'cron.remove', id: 'unknown' }, cronJobs, webhooks, skills);
    expect(summary).toContain('unknown');
  });

  it('warns about live scheduler cost and rollback for cron.create without leaking prompt text', () => {
    const summary = summarizeCwsAction(
      { kind: 'cron.create', name: 'cron-risk', schedule: '30m', prompt: 'secret prompt text' },
      cronJobs,
      webhooks,
      skills,
    );
    expect(summary).toContain('cron-risk');
    expect(summary).toContain('30m');
    expect(summary).toContain('live scheduler');
    expect(summary).toContain('cost');
    expect(summary).toContain('pause or remove');
    expect(summary).not.toContain('secret prompt text');
  });

  it('warns about immediate execution cost/quota for cron.run without leaking prompt previews', () => {
    const summary = summarizeCwsAction({ kind: 'cron.run', id: 'c1' }, cronJobs, webhooks, skills);
    expect(summary).toContain('Backup job');
    expect(summary).toContain('live scheduler');
    expect(summary).toContain('quota');
    expect(summary).not.toContain('Run backup…');
  });
});

// ── 9. Initial state factory ────────────────────────────────────────

describe('initialCwsAdminState', () => {
  it('returns empty state with missing provenance', () => {
    const state = initialCwsAdminState();
    expect(state.cronJobs).toEqual([]);
    expect(state.webhooks).toEqual([]);
    expect(state.skills).toEqual([]);
    expect(state.pending).toEqual([]);
    expect(state.lastResult).toBeNull();
    expect(state.busy).toBe(false);
    expect(state.lastError).toBeNull();
    expect(state.cronProvenance.freshness).toBe('missing');
    expect(state.cronProvenance.confidence).toBe('unknown');
  });
});

// ── 10. Full JSON serialization safety ──────────────────────────────

describe('full state JSON safety after clearLastResult', () => {
  it('contains no raw secrets after clearLastResult', async () => {
    const executeAction = vi.fn<() => Promise<CwsActionResult>>(async () => ({
      action: { kind: 'webhook.create', name: 'x', event: 'cron.completed', callbackUrl: 'https://example.com' },
      ok: true,
      message: 'Created',
      createdWebhook: {
        id: 'wh-new',
        name: 'x',
        event: 'cron.completed',
        callbackUrl: 'https://example.com',
        hasSecret: true,
        maskedSecret: 'wh-…cd34',
        active: true,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        error: null,
        secret: 'whsec_super_secret_12345678',
        rawCallbackUrl: 'https://admin:password123@host/path',
      },
      completedAt: new Date().toISOString(),
    }));
    setCwsAdminAdapter(makeAdapter({ executeAction }));

    cwsAdminStore.requestCwsAction({
      kind: 'webhook.create',
      name: 'x',
      event: 'cron.completed',
      callbackUrl: 'https://example.com',
    });

    await vi.waitFor(() => {
      expect(cwsAdminStore.getCwsLastResult()).not.toBeNull();
    });

    // Before clear: raw secret IS in lastResult
    const beforeClear = JSON.stringify(cwsAdminStore.state);
    expect(beforeClear).toContain('whsec_super_secret_12345678');

    // After clear: raw secret is GONE from entire state
    cwsAdminStore.clearCwsLastResult();
    const afterClear = JSON.stringify(cwsAdminStore.state);
    expect(afterClear).not.toContain('whsec_super_secret_12345678');
    expect(afterClear).not.toContain('password123');
  });
});
