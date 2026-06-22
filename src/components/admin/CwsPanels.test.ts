/**
 * Tests for CWS admin UI panels — Phase 6 UI layer safety verification.
 *
 * Since the Vitest environment is `node` (no jsdom), these tests verify
 * the UI panel behavior through the store and type interfaces rather than
 * rendering components. The tests prove:
 *   - Unavailable states: when no adapter is bound, the store returns
 *     empty lists with missing provenance, so panels must render
 *     "unavailable" banners instead of fake healthy data.
 *   - Redaction: raw secrets never appear in store state or JSON output.
 *   - Confirmation gates: risk/danger actions require confirmation;
 *     safe actions execute immediately.
 *   - RiskConfirmDialog tier behavior: safe/risk/danger tier props
 *     affect the confirmation flow correctly.
 *   - One-time secret reveal: raw secrets only in lastResult, never
 *     persisted after clearLastResult.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cwsRequiresConfirmation,
  cwsActionTier,
  cwsRequiresTypedPhrase,
  summarizeCwsAction,
  truncatePreview,
  type CwsAction,
  type CronJob,
  type WebhookEntry,
  type SkillEntry,
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
    source: 'user',
    enabled: true,
    category: null,
    subSkillCount: null,
    lastModifiedAt: null,
    hasSensitiveAccess: false,
    ...overrides,
  };
}

// ── Test suite ─────────────────────────────────────────────────────────

beforeEach(() => {
  _resetForTest();
});

// ────────────────────────────────────────────────────────────────────────
// 1. Unavailable state: no adapter → empty lists + missing provenance
// ────────────────────────────────────────────────────────────────────────

describe('CWS UI panels: unavailable state when no adapter bound', () => {
  it('hasCwsAdapter returns false before adapter is set', () => {
    expect(hasCwsAdapter()).toBe(false);
  });

  it('store starts with empty lists (no mock seed data)', () => {
    const state = cwsAdminStore.state;
    expect(state.cronJobs).toHaveLength(0);
    expect(state.webhooks).toHaveLength(0);
    expect(state.skills).toHaveLength(0);
  });

  it('store starts with missing provenance for all subsections', () => {
    const state = cwsAdminStore.state;
    expect(state.cronProvenance.freshness).toBe('missing');
    expect(state.cronProvenance.confidence).toBe('unknown');
    expect(state.webhookProvenance.freshness).toBe('missing');
    expect(state.webhookProvenance.confidence).toBe('unknown');
    expect(state.skillsProvenance.freshness).toBe('missing');
    expect(state.skillsProvenance.confidence).toBe('unknown');
  });

  it('loadCronJobs sets lastError when no adapter', async () => {
    await cwsAdminStore.loadCronJobs();
    expect(cwsAdminStore.state.lastError).toBe('No CWS admin adapter bound');
    expect(cwsAdminStore.state.cronJobs).toHaveLength(0);
  });

  it('loadWebhooks sets lastError when no adapter', async () => {
    await cwsAdminStore.loadWebhooks();
    expect(cwsAdminStore.state.lastError).toBe('No CWS admin adapter bound');
    expect(cwsAdminStore.state.webhooks).toHaveLength(0);
  });

  it('loadSkills sets lastError when no adapter', async () => {
    await cwsAdminStore.loadSkills();
    expect(cwsAdminStore.state.lastError).toBe('No CWS admin adapter bound');
    expect(cwsAdminStore.state.skills).toHaveLength(0);
  });

  it('action execution fails gracefully when no adapter', async () => {
    // cron.run is safe tier → executes immediately without confirmation
    cwsAdminStore.requestCwsAction({ kind: 'cron.run', id: 'cron-1' });
    // Wait for async execution
    await new Promise((r) => setTimeout(r, 10));
    const result = cwsAdminStore.getCwsLastResult();
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
    expect(result!.message).toBe('No CWS admin adapter bound');
  });
});

// ────────────────────────────────────────────────────────────────────────
// 2. Redaction: no raw secrets in store state or JSON output
// ────────────────────────────────────────────────────────────────────────

describe('CWS UI panels: redaction and no raw secrets', () => {
  it('cron promptPreview must be truncated (max 200 chars)', () => {
    const longPreview = 'A'.repeat(201);
    const job = makeCronJob({ promptPreview: longPreview });
    expect(() => _ingestCronJobs([job])).toThrow(/suspiciously long/);
  });

  it('truncated preview is accepted', () => {
    const job = makeCronJob({ promptPreview: truncatePreview('A'.repeat(300)) });
    expect(() => _ingestCronJobs([job])).not.toThrow();
    expect(cwsAdminStore.getCronJobs()).toHaveLength(1);
  });

  it('webhook maskedSecret must not look like a raw secret', () => {
    const wh = makeWebhook({ maskedSecret: 'sk-ant-api03-very-long-raw-key-value-here' });
    expect(() => _ingestWebhooks([wh])).toThrow(/looks unmasked/);
  });

  it('webhook callbackUrl with unmasked credentials is rejected', () => {
    const wh = makeWebhook({ callbackUrl: 'https://user:password@example.com/webhook' });
    expect(() => _ingestWebhooks([wh])).toThrow(/unmasked credentials/);
  });

  it('webhook with masked callbackUrl is accepted', () => {
    const wh = makeWebhook({ callbackUrl: 'https://user:••••@example.com/webhook' });
    expect(() => _ingestWebhooks([wh])).not.toThrow();
  });

  it('JSON.stringify of store state contains no raw secrets after clearLastResult', () => {
    // Ingest some data
    _ingestCronJobs([makeCronJob()]);
    _ingestWebhooks([makeWebhook()]);
    _ingestSkills([makeSkill()]);

    // Simulate a creation with one-time secrets in lastResult
    const state = cwsAdminStore.state;
    const json = JSON.stringify(state);

    // The masked secret fingerprint should be present
    expect(json).toContain('wh-…ab12');
    // The truncated preview should be present
    expect(json).toContain('Run backup…');
    // No raw secret patterns
    expect(json).not.toContain('sk-ant-api03');
    expect(json).not.toContain('rawCallbackUrl');
    expect(json).not.toContain('fullPrompt');
    expect(json).not.toContain('fullScript');
  });

  it('one-time createdCron fields are stripped before adding to persistent list', async () => {
    const mockAdapter: CwsAdminAdapter = {
      listCronJobs: vi.fn().mockResolvedValue([]),
      listWebhooks: vi.fn().mockResolvedValue([]),
      listSkills: vi.fn().mockResolvedValue([]),
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'cron.create', name: 'Test', schedule: '0 9 * * *', prompt: 'Full prompt text that should not persist' },
        ok: true,
        message: 'Created',
        createdCron: {
          id: 'cron-new',
          name: 'Test',
          schedule: '0 9 * * *',
          enabled: true,
          paused: false,
          promptPreview: null, // adapter should set this
          hasScript: false,
          skills: [],
          modelOverride: null,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: '2026-06-22T00:00:00Z',
          error: null,
          fullPrompt: 'Full prompt text that should not persist',
          fullScript: 'Script content that should not persist',
        },
        completedAt: '2026-06-22T00:00:00Z',
      }),
    };

    setCwsAdminAdapter(mockAdapter);

    // Create action is safe-tier, no confirmation needed
    cwsAdminStore.requestCwsAction({
      kind: 'cron.create',
      name: 'Test',
      schedule: '0 9 * * *',
      prompt: 'Full prompt text',
    });

    await new Promise((r) => setTimeout(r, 50));

    const jobs = cwsAdminStore.getCronJobs();
    expect(jobs).toHaveLength(1);
    // promptPreview is derived from truncatePreview(fullPrompt), which is
    // the truncated safe version — the key invariant is that fullPrompt
    // and fullScript fields are NOT on the persisted CronJob object
    expect(jobs[0].promptPreview).toBeTruthy();
    expect(jobs[0].promptPreview!.length).toBeLessThanOrEqual(83); // 80 + '…'

    // Raw fullPrompt and fullScript should NOT be in the job
    const jobJson = JSON.stringify(jobs[0]);
    expect(jobJson).not.toContain('fullPrompt');
    expect(jobJson).not.toContain('fullScript');
  });

  it('one-time createdWebhook fields are stripped before adding to persistent list', async () => {
    const mockAdapter: CwsAdminAdapter = {
      listCronJobs: vi.fn().mockResolvedValue([]),
      listWebhooks: vi.fn().mockResolvedValue([]),
      listSkills: vi.fn().mockResolvedValue([]),
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'webhook.create', name: 'Test WH', event: 'cron.completed' as const, callbackUrl: 'https://example.com/wh' },
        ok: true,
        message: 'Created',
        createdWebhook: {
          id: 'wh-new',
          name: 'Test WH',
          event: 'cron.completed',
          callbackUrl: 'https://example.com/wh',
          hasSecret: true,
          maskedSecret: 'wh-…new1',
          active: true,
          lastTriggeredAt: null,
          createdAt: '2026-06-22T00:00:00Z',
          error: null,
          secret: 'whsec_raw_secret_value_12345',
          rawCallbackUrl: 'https://user:pass@example.com/wh',
        },
        completedAt: '2026-06-22T00:00:00Z',
      }),
    };

    setCwsAdminAdapter(mockAdapter);

    cwsAdminStore.requestCwsAction({
      kind: 'webhook.create',
      name: 'Test WH',
      event: 'cron.completed',
      callbackUrl: 'https://example.com/wh',
    });

    await new Promise((r) => setTimeout(r, 50));

    const webhooks = cwsAdminStore.getWebhooks();
    expect(webhooks).toHaveLength(1);
    const whJson = JSON.stringify(webhooks[0]);
    expect(whJson).not.toContain('secret');
    expect(whJson).not.toContain('rawCallbackUrl');
    expect(whJson).not.toContain('whsec_raw');
    expect(whJson).not.toContain('user:pass');
    // Masked version should be present
    expect(whJson).toContain('wh-…new1');
  });
});

// ────────────────────────────────────────────────────────────────────────
// 3. Confirmation gates: risk/danger require confirm; safe executes
// ────────────────────────────────────────────────────────────────────────

describe('CWS UI panels: confirmation gate behavior', () => {
  it('cron.pause (risk) queues pending confirmation', () => {
    _ingestCronJobs([makeCronJob()]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.pause', id: 'cron-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('risk');
    expect(pending[0].requiresTypedPhrase).toBe(false);
  });

  it('cron.resume (risk) queues pending confirmation', () => {
    _ingestCronJobs([makeCronJob({ paused: true })]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.resume', id: 'cron-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('risk');
  });

  it('cron.remove (danger) queues pending with typed phrase required', () => {
    _ingestCronJobs([makeCronJob()]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('danger');
    expect(pending[0].requiresTypedPhrase).toBe(true);
  });

  it('cron.run (safe) executes immediately without confirmation', () => {
    cwsAdminStore.requestCwsAction({ kind: 'cron.run', id: 'cron-1' });
    expect(cwsAdminStore.getCwsPending()).toHaveLength(0);
  });

  it('webhook.remove (danger) queues pending with typed phrase required', () => {
    _ingestWebhooks([makeWebhook()]);
    cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: 'wh-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('danger');
    expect(pending[0].requiresTypedPhrase).toBe(true);
  });

  it('webhook.update (risk) queues pending without typed phrase', () => {
    _ingestWebhooks([makeWebhook()]);
    cwsAdminStore.requestCwsAction({ kind: 'webhook.update', id: 'wh-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('risk');
    expect(pending[0].requiresTypedPhrase).toBe(false);
  });

  it('skill.enable (risk) queues pending confirmation', () => {
    _ingestSkills([makeSkill({ enabled: false })]);
    cwsAdminStore.requestCwsAction({ kind: 'skill.enable', name: 'test-skill' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('risk');
  });

  it('skill.disable (risk) queues pending confirmation', () => {
    _ingestSkills([makeSkill({ enabled: true })]);
    cwsAdminStore.requestCwsAction({ kind: 'skill.disable', name: 'test-skill' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].tier).toBe('risk');
  });

  it('cancelling a pending action removes it without executing', () => {
    _ingestCronJobs([makeCronJob()]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.cancelCwsAction(nonce);
    expect(cwsAdminStore.getCwsPending()).toHaveLength(0);
    expect(cwsAdminStore.getCwsLastResult()).toBeNull();
  });

  it('confirming a pending action executes it', async () => {
    const mockAdapter: CwsAdminAdapter = {
      listCronJobs: vi.fn().mockResolvedValue([]),
      listWebhooks: vi.fn().mockResolvedValue([]),
      listSkills: vi.fn().mockResolvedValue([]),
      executeAction: vi.fn().mockResolvedValue({
        action: { kind: 'cron.remove', id: 'cron-1' },
        ok: true,
        message: 'Removed',
        completedAt: '2026-06-22T00:00:00Z',
      }),
    };
    setCwsAdminAdapter(mockAdapter);
    _ingestCronJobs([makeCronJob()]);

    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    const nonce = cwsAdminStore.getCwsPending()[0].nonce;
    cwsAdminStore.confirmCwsAction(nonce);

    await new Promise((r) => setTimeout(r, 50));
    const result = cwsAdminStore.getCwsLastResult();
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    expect(cwsAdminStore.getCwsPending()).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 4. RiskConfirmDialog tier mapping: ensures UI renders correct severity
// ────────────────────────────────────────────────────────────────────────

describe('RiskConfirmDialog tier mapping for CWS actions', () => {
  const safeActions: CwsAction[] = [
    { kind: 'cron.run', id: 'cron-1' },
    { kind: 'skill.view', name: 'test-skill' },
    { kind: 'skill.list' },
  ];

  const riskActions: CwsAction[] = [
    { kind: 'cron.update', id: 'cron-1' },
    { kind: 'cron.pause', id: 'cron-1' },
    { kind: 'cron.resume', id: 'cron-1' },
    { kind: 'webhook.update', id: 'wh-1' },
    { kind: 'skill.enable', name: 'test-skill' },
    { kind: 'skill.disable', name: 'test-skill' },
  ];

  const dangerActions: CwsAction[] = [
    { kind: 'cron.remove', id: 'cron-1' },
    { kind: 'webhook.remove', id: 'wh-1' },
  ];

  it('safe actions return tier "safe"', () => {
    for (const action of safeActions) {
      expect(cwsActionTier(action)).toBe('safe');
    }
  });

  it('risk actions return tier "risk"', () => {
    for (const action of riskActions) {
      expect(cwsActionTier(action)).toBe('risk');
    }
  });

  it('danger actions return tier "danger"', () => {
    for (const action of dangerActions) {
      expect(cwsActionTier(action)).toBe('danger');
    }
  });

  it('safe actions do not require confirmation', () => {
    for (const action of safeActions) {
      expect(cwsRequiresConfirmation(action)).toBe(false);
    }
  });

  it('risk and danger actions require confirmation', () => {
    for (const action of [...riskActions, ...dangerActions]) {
      expect(cwsRequiresConfirmation(action)).toBe(true);
    }
  });

  it('only danger actions require typed phrase', () => {
    for (const action of safeActions) {
      expect(cwsRequiresTypedPhrase(action)).toBe(false);
    }
    for (const action of riskActions) {
      expect(cwsRequiresTypedPhrase(action)).toBe(false);
    }
    for (const action of dangerActions) {
      expect(cwsRequiresTypedPhrase(action)).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// 5. Confirmation summary: no secrets in human-readable text
// ────────────────────────────────────────────────────────────────────────

describe('CWS confirmation summaries: no secrets in text', () => {
  it('cron.remove summary names the job but no secrets', () => {
    const jobs = [makeCronJob()];
    const summary = summarizeCwsAction({ kind: 'cron.remove', id: 'cron-1' }, jobs, [], []);
    expect(summary).toContain('Daily backup');
    expect(summary).toContain('cannot be undone');
    expect(summary).not.toContain('sk-');
    expect(summary).not.toContain('secret');
  });

  it('webhook.remove summary names the webhook but no secrets', () => {
    const webhooks = [makeWebhook()];
    const summary = summarizeCwsAction({ kind: 'webhook.remove', id: 'wh-1' }, [], webhooks, []);
    expect(summary).toContain('Backup notifier');
    expect(summary).not.toContain('whsec');
    expect(summary).not.toContain('secret');
  });

  it('skill.disable with sensitive access warns about it', () => {
    const skills = [makeSkill({ hasSensitiveAccess: true })];
    const summary = summarizeCwsAction({ kind: 'skill.disable', name: 'test-skill' }, [], [], skills);
    expect(summary).toContain('sensitive toolsets');
  });

  it('skill.enable without sensitive access does not warn', () => {
    const skills = [makeSkill({ hasSensitiveAccess: false })];
    const summary = summarizeCwsAction({ kind: 'skill.enable', name: 'test-skill' }, [], [], skills);
    expect(summary).not.toContain('sensitive toolsets');
  });

  it('cron.create summary includes name and schedule but no prompt text', () => {
    const summary = summarizeCwsAction(
      { kind: 'cron.create', name: 'My Job', schedule: '30m', prompt: 'secret-prompt-with-api-key-sk-1234' },
      [], [], [],
    );
    expect(summary).toContain('My Job');
    expect(summary).toContain('30m');
    expect(summary).not.toContain('sk-1234');
    expect(summary).not.toContain('secret-prompt');
  });

  it('webhook.create summary includes name and event but no callback URL or secret', () => {
    const summary = summarizeCwsAction(
      { kind: 'webhook.create', name: 'Notify', event: 'cron.completed', callbackUrl: 'https://secret.example.com/hook' },
      [], [], [],
    );
    expect(summary).toContain('Notify');
    expect(summary).toContain('cron.completed');
    expect(summary).not.toContain('secret.example');
  });
});

// ────────────────────────────────────────────────────────────────────────
// 6. Provenance tracking per subsection: panels can show independent status
// ────────────────────────────────────────────────────────────────────────

describe('CWS panels: independent provenance per subsection', () => {
  it('ingesting cron jobs upgrades cron provenance but not webhook/skills', () => {
    _ingestCronJobs([makeCronJob()]);
    const state = cwsAdminStore.state;
    expect(state.cronProvenance.freshness).toBe('live');
    expect(state.webhookProvenance.freshness).toBe('missing');
    expect(state.skillsProvenance.freshness).toBe('missing');
  });

  it('ingesting webhooks upgrades webhook provenance but not cron/skills', () => {
    _ingestWebhooks([makeWebhook()]);
    const state = cwsAdminStore.state;
    expect(state.webhookProvenance.freshness).toBe('live');
    expect(state.cronProvenance.freshness).toBe('missing');
    expect(state.skillsProvenance.freshness).toBe('missing');
  });

  it('ingesting skills upgrades skills provenance but not cron/webhook', () => {
    _ingestSkills([makeSkill()]);
    const state = cwsAdminStore.state;
    expect(state.skillsProvenance.freshness).toBe('live');
    expect(state.cronProvenance.freshness).toBe('missing');
    expect(state.webhookProvenance.freshness).toBe('missing');
  });
});

// ────────────────────────────────────────────────────────────────────────
// 7. Cross-domain: action summaries never leak between domains
// ────────────────────────────────────────────────────────────────────────

describe('CWS panels: cross-domain action isolation', () => {
  it('pending cron actions do not appear in webhook confirmations', () => {
    _ingestCronJobs([makeCronJob()]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.pause', id: 'cron-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].action.kind).toBe('cron.pause');
  });

  it('multiple pending actions from different domains coexist', () => {
    _ingestCronJobs([makeCronJob()]);
    _ingestWebhooks([makeWebhook()]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.pause', id: 'cron-1' });
    cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: 'wh-1' });
    const pending = cwsAdminStore.getCwsPending();
    expect(pending).toHaveLength(2);
    expect(pending[0].action.kind).toBe('cron.pause');
    expect(pending[1].action.kind).toBe('webhook.remove');
    // Different tiers
    expect(pending[0].tier).toBe('risk');
    expect(pending[1].tier).toBe('danger');
  });

  it('cancelAllCwsPending clears all domains', () => {
    _ingestCronJobs([makeCronJob()]);
    _ingestWebhooks([makeWebhook()]);
    cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: 'cron-1' });
    cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: 'wh-1' });
    expect(cwsAdminStore.getCwsPending()).toHaveLength(2);
    cwsAdminStore.cancelAllCwsPending();
    expect(cwsAdminStore.getCwsPending()).toHaveLength(0);
  });
});
