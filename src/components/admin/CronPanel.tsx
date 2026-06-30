/**
 * CronPanel — Cron job management surface wired to cwsAdminStore.
 *
 * Flows:
 *  - List cron jobs with schedule, status, last/next run, prompt preview.
 *  - Pause/Resume: risk-tier confirmation.
 *  - Run now: risk-tier confirmation with live-scheduler warning copy.
 *  - Remove: danger-tier confirmation with typed-phrase gate.
 *  - Create: form with name/schedule/prompt → risk-tier confirmation →
 *    store creates → one-time SecretReveal for fullPrompt/fullScript →
 *    dismiss.
 *
 * Security:
 *  - promptPreview is always truncated; full prompt/script only appear
 *    in the one-time SecretReveal from lastResult.createdCron.
 *  - No raw secrets ever in list view.
 *  - When adapter is not bound, renders "unavailable" banner, not mock data.
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  cwsAdminStore,
  useCwsAdminState,
  hasCwsAdapter,
} from '@/state/cwsAdminStore';
import type { CronJob } from '@/types/admin-cws';
import { AdminSectionShell } from '@/components/admin/AdminSectionShell';
import { RiskConfirmDialog } from '@/components/admin/RiskConfirmDialog';
import { SecretReveal } from '@/components/admin/SecretReveal';
import { MaskedField } from '@/components/admin/MaskedField';

type PanelMode = 'list' | 'create';

export function CronPanel() {
  const state = useCwsAdminState();
  const [mode, setMode] = useState<PanelMode>('list');
  const adapterBound = hasCwsAdapter();

  // One-time secret from creation
  const createdCron = state.lastResult?.createdCron ?? null;
  const showSecret = createdCron != null;

  useEffect(() => {
    if (mode === 'create' && state.lastResult?.ok && state.lastResult.action.kind === 'cron.create') {
      setMode('list');
    }
  }, [mode, state.lastResult]);

  return (
    <>
      <AdminSectionShell
        title="Cron Jobs"
        count={state.cronJobs.length}
        actions={
          adapterBound && mode === 'list' ? (
            <button
              className="admin-btn"
              onClick={() => setMode('create')}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--accent-cyan)',
                background: 'var(--accent-cyan-glow)',
                border: '1px solid var(--accent-cyan)44',
                borderRadius: 'var(--radius-md)',
              }}
            >
              + New Job
            </button>
          ) : undefined
        }
      >
        {!adapterBound ? (
          <UnavailableBanner section="Cron" />
        ) : showSecret && createdCron ? (
          <>
            <SecretReveal
              secret={createdCron.fullPrompt}
              label={`prompt for cron "${createdCron.name}"`}
              onDismiss={() => cwsAdminStore.clearCwsLastResult()}
            />
            {createdCron.fullScript && (
              <SecretReveal
                secret={createdCron.fullScript}
                label={`script for cron "${createdCron.name}"`}
                onDismiss={() => cwsAdminStore.clearCwsLastResult()}
              />
            )}
          </>
        ) : mode === 'create' ? (
          <CreateCronForm onCancel={() => setMode('list')} />
        ) : state.cronJobs.length === 0 ? (
          <EmptyState message="No cron jobs configured" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {state.cronJobs.map((job) => (
              <CronRow key={job.id} job={job} busy={state.busy} />
            ))}
          </div>
        )}
      </AdminSectionShell>

      {/* Render pending confirmations for cron actions */}
      {state.pending
        .filter((p) => p.action.kind.startsWith('cron.'))
        .map((p) => (
          <RiskConfirmDialog
            key={p.nonce}
            open
            title={confirmTitle(p.action.kind)}
            message={p.summary}
            tier={p.tier}
            requiresTypedPhrase={p.requiresTypedPhrase}
            typedPhrase={phraseTarget(p.action)}
            confirmLabel={actionVerb(p.action.kind)}
            onConfirm={() => cwsAdminStore.confirmCwsAction(p.nonce)}
            onCancel={() => cwsAdminStore.cancelCwsAction(p.nonce)}
          />
        ))}
    </>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function confirmTitle(kind: string): string {
  if (kind === 'cron.create') return 'Create Cron Job';
  if (kind === 'cron.remove') return 'Remove Cron Job';
  if (kind === 'cron.pause') return 'Pause Cron Job';
  if (kind === 'cron.resume') return 'Resume Cron Job';
  if (kind === 'cron.update') return 'Update Cron Job';
  if (kind === 'cron.run') return 'Run Cron Job Now';
  return 'Confirm Action';
}

function actionVerb(kind: string): string {
  switch (kind) {
    case 'cron.create': return 'Create';
    case 'cron.remove': return 'Remove';
    case 'cron.pause': return 'Pause';
    case 'cron.resume': return 'Resume';
    case 'cron.update': return 'Update';
    case 'cron.run': return 'Run now';
    default: return 'Confirm';
  }
}

/** For danger-tier actions requiring typed phrase, return the entity name. */
function phraseTarget(action: { kind: string; id?: string }): string {
  if ('id' in action && typeof action.id === 'string') {
    return action.id;
  }
  if ('name' in action && typeof action.name === 'string') {
    return action.name;
  }
  return '';
}

/* ── Cron row ─────────────────────────────────────────────────────────── */

function CronRow({ job, busy }: { job: CronJob; busy: boolean }) {
  return (
    <div
      style={{
        padding: 'var(--space-3)',
        background: 'var(--bg-2)',
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {job.name}
          </span>
          <CronStatusBadge enabled={job.enabled} paused={job.paused} error={job.error} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {!job.paused && (
            <ActionButton
              label="Pause"
              subtle
              onClick={() =>
                cwsAdminStore.requestCwsAction({ kind: 'cron.pause', id: job.id })
              }
              disabled={busy || !job.enabled}
            />
          )}
          {job.paused && (
            <ActionButton
              label="Resume"
              subtle
              onClick={() =>
                cwsAdminStore.requestCwsAction({ kind: 'cron.resume', id: job.id })
              }
              disabled={busy}
            />
          )}
          <ActionButton
            label="Run now"
            subtle
            onClick={() =>
              cwsAdminStore.requestCwsAction({ kind: 'cron.run', id: job.id })
            }
            disabled={busy || !job.enabled}
          />
          <ActionButton
            label="Remove"
            subtle
            danger
            onClick={() =>
              cwsAdminStore.requestCwsAction({ kind: 'cron.remove', id: job.id })
            }
            disabled={busy}
          />
        </div>
      </div>

      {/* Fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-3)',
        }}
      >
        <MaskedField label="Schedule" value={job.schedule} />
        <MaskedField label="Model" value={job.modelOverride ?? 'default'} mono={false} />
        <MaskedField label="Last run" value={job.lastRunAt ? job.lastRunAt.slice(0, 19).replace('T', ' ') : null} mono={false} />
        <MaskedField label="Next run" value={job.nextRunAt ? job.nextRunAt.slice(0, 19).replace('T', ' ') : null} mono={false} />
        {job.promptPreview && (
          <MaskedField label="Prompt" value={job.promptPreview} mono={false} />
        )}
        {job.hasScript && (
          <MaskedField label="Script" value="attached (not displayed)" mono={false} />
        )}
        {job.skills.length > 0 && (
          <MaskedField label="Skills" value={job.skills.join(', ')} mono={false} />
        )}
        {job.error && (
          <MaskedField
            label="Error"
            value={job.error}
            mono={false}
            status={
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-red)' }}>
                ⚠
              </span>
            }
          />
        )}
      </div>
    </div>
  );
}

/* ── Create cron form ─────────────────────────────────────────────────── */

function CreateCronForm({
  onCancel,
}: {
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [skills, setSkills] = useState('');
  const [modelOverride, setModelOverride] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !schedule.trim() || !prompt.trim()) return;
    cwsAdminStore.requestCwsAction({
      kind: 'cron.create',
      name: name.trim(),
      schedule: schedule.trim(),
      prompt: prompt.trim(),
      script: script.trim() || undefined,
      skills: skills.trim() ? skills.split(',').map((s) => s.trim()) : undefined,
      modelOverride: modelOverride.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        maxWidth: '480px',
      }}
    >
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Create a new cron job. This mutates the live scheduler, may consume cost/quota on each run, and will require explicit confirmation before creation. The full prompt and script will still be shown once after creation.
      </p>
      <EditField label="Name" value={name} onChange={setName} placeholder="e.g. daily-summary" />
      <EditField label="Schedule" value={schedule} onChange={setSchedule} placeholder="0 9 * * * or 30m" />
      <EditField label="Prompt" value={prompt} onChange={setPrompt} placeholder="What should the agent do?" />
      <EditField label="Script (optional)" value={script} onChange={setScript} placeholder="Path to script file" />
      <EditField label="Skills (comma-separated)" value={skills} onChange={setSkills} placeholder="e.g. github-pr-workflow, plan" />
      <EditField label="Model override (optional)" value={modelOverride} onChange={setModelOverride} placeholder="e.g. anthropic/claude-sonnet-4" />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="submit"
          disabled={!name.trim() || !schedule.trim() || !prompt.trim()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: name.trim() && schedule.trim() && prompt.trim() ? 'var(--bg-0)' : 'var(--text-dim)',
            background: name.trim() && schedule.trim() && prompt.trim() ? 'var(--accent-cyan)' : 'var(--surface-base)',
            border: `1px solid ${name.trim() && schedule.trim() && prompt.trim() ? 'var(--accent-cyan)' : 'var(--border-base)'}`,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Create Job
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── Shared UI atoms ──────────────────────────────────────────────────── */

function UnavailableBanner({ section }: { section: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        textAlign: 'center',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {section} admin is unavailable
      </div>
      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}
      >
        No CWS admin adapter is bound. Connect a Hermes backend to manage {section.toLowerCase()} jobs.
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        textAlign: 'center',
        color: 'var(--text-dim)',
        fontSize: 'var(--text-sm)',
      }}
    >
      {message}
    </div>
  );
}

function CronStatusBadge({
  enabled,
  paused,
  error,
}: {
  enabled: boolean;
  paused: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--accent-red)',
          padding: '1px 6px',
          background: 'var(--accent-red-glow)',
          border: '1px solid var(--accent-red)44',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        Error
      </span>
    );
  }
  if (paused) {
    return (
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--accent-amber)',
          padding: '1px 6px',
          background: 'var(--accent-amber-glow)',
          border: '1px solid var(--accent-amber)44',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        Paused
      </span>
    );
  }
  if (enabled) {
    return (
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--accent-green)',
          padding: '1px 6px',
          background: 'var(--accent-green-glow)',
          border: '1px solid var(--accent-green)44',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        Active
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        padding: '1px 6px',
        background: 'var(--surface-base)',
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      Disabled
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  subtle = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  subtle?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`admin-action-btn${danger ? ' admin-action-btn-danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '2px 8px',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        color: disabled
          ? 'var(--text-dim)'
          : danger
            ? 'var(--accent-red)'
            : subtle
              ? 'var(--text-muted)'
              : 'var(--text-primary)',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        className="mono"
        style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--bg-0)',
          border: '1px solid var(--border-base)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          outline: 'none',
          transition: 'border-color var(--dur-micro)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-cyan)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-base)';
        }}
      />
    </div>
  );
}
