/**
 * WebhookPanel — Webhook management surface wired to cwsAdminStore.
 *
 * Flows:
 *  - List webhooks with event, callback URL, masked secret, status.
 *  - Remove: danger-tier confirmation with typed-phrase gate.
 *  - Create: form with name/event/callbackUrl/secret → store creates →
 *    one-time SecretReveal for raw secret → dismiss.
 *
 * Security:
 *  - callbackUrl is masked if it contains embedded credentials.
 *  - maskedSecret is a fingerprint only; raw secret appears exactly once
 *    in the SecretReveal from lastResult.createdWebhook.
 *  - When adapter is not bound, renders "unavailable" banner, not mock data.
 */

import { useState, type FormEvent } from 'react';
import {
  cwsAdminStore,
  useCwsAdminState,
  hasCwsAdapter,
} from '@/state/cwsAdminStore';
import type { WebhookEntry, WebhookEvent } from '@/types/admin-cws';
import { RiskConfirmDialog } from '@/components/admin/RiskConfirmDialog';
import { AdminSectionShell } from '@/components/admin/AdminSectionShell';
import { SecretReveal } from '@/components/admin/SecretReveal';
import { MaskedField } from '@/components/admin/MaskedField';

type PanelMode = 'list' | 'create';

const WEBHOOK_EVENTS: WebhookEvent[] = [
  'message.received',
  'message.sent',
  'cron.completed',
  'cron.failed',
  'agent.started',
  'agent.completed',
  'agent.error',
];

export function WebhookPanel() {
  const state = useCwsAdminState();
  const [mode, setMode] = useState<PanelMode>('list');
  const adapterBound = hasCwsAdapter();

  // One-time secret from creation
  const createdWebhook = state.lastResult?.createdWebhook ?? null;
  const showSecret = createdWebhook != null;

  return (
    <>
      <AdminSectionShell
        title="Webhooks"
        count={state.webhooks.length}
        actions={
          adapterBound && mode === 'list' ? (
            <button
              className="admin-btn"
              onClick={() => setMode('create')}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--accent-violet)',
                background: 'var(--accent-violet-glow)',
                border: '1px solid var(--accent-violet)44',
                borderRadius: 'var(--radius-md)',
              }}
            >
              + New Webhook
            </button>
          ) : undefined
        }
      >
        {!adapterBound ? (
          <UnavailableBanner section="Webhook" />
        ) : showSecret && createdWebhook ? (
          <>
            <SecretReveal
              secret={createdWebhook.secret}
              label={`signing secret for webhook "${createdWebhook.name}"`}
              onDismiss={() => cwsAdminStore.clearCwsLastResult()}
            />
            <SecretReveal
              secret={createdWebhook.rawCallbackUrl}
              label={`callback URL for webhook "${createdWebhook.name}"`}
              onDismiss={() => cwsAdminStore.clearCwsLastResult()}
            />
          </>
        ) : mode === 'create' ? (
          <CreateWebhookForm
            onCancel={() => setMode('list')}
            onCreated={() => setMode('list')}
          />
        ) : state.webhooks.length === 0 ? (
          <EmptyState message="No webhooks configured" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {state.webhooks.map((wh) => (
              <WebhookRow key={wh.id} webhook={wh} busy={state.busy} />
            ))}
          </div>
        )}
      </AdminSectionShell>

      {/* Render pending confirmations for webhook actions */}
      {state.pending
        .filter((p) => p.action.kind.startsWith('webhook.'))
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
  if (kind === 'webhook.remove') return 'Remove Webhook';
  if (kind === 'webhook.update') return 'Update Webhook';
  return 'Confirm Action';
}

function actionVerb(kind: string): string {
  switch (kind) {
    case 'webhook.remove': return 'Remove';
    case 'webhook.update': return 'Update';
    default: return 'Confirm';
  }
}

function phraseTarget(action: { kind: string; id?: string }): string {
  if ('id' in action && typeof action.id === 'string') {
    return action.id;
  }
  return '';
}

/* ── Webhook row ──────────────────────────────────────────────────────── */

function WebhookRow({ webhook, busy }: { webhook: WebhookEntry; busy: boolean }) {
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
            {webhook.name}
          </span>
          <WebhookStatusBadge active={webhook.active} error={webhook.error} />
          <EventBadge event={webhook.event} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          <ActionButton
            label="Remove"
            subtle
            danger
            onClick={() =>
              cwsAdminStore.requestCwsAction({ kind: 'webhook.remove', id: webhook.id })
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
        <MaskedField label="Callback URL" value={webhook.callbackUrl} mono={false} />
        <MaskedField
          label="Secret"
          value={webhook.maskedSecret}
          status={
            webhook.hasSecret ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-green)' }}>configured</span>
            ) : undefined
          }
        />
        <MaskedField label="Created" value={webhook.createdAt.slice(0, 10)} mono={false} />
        <MaskedField
          label="Last triggered"
          value={webhook.lastTriggeredAt ? webhook.lastTriggeredAt.slice(0, 19).replace('T', ' ') : null}
          mono={false}
        />
        {webhook.error && (
          <MaskedField
            label="Error"
            value={webhook.error}
            mono={false}
            status={
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-red)' }}>⚠</span>
            }
          />
        )}
      </div>
    </div>
  );
}

/* ── Create webhook form ──────────────────────────────────────────────── */

function CreateWebhookForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [event, setEvent] = useState<WebhookEvent>('message.received');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [secret, setSecret] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !callbackUrl.trim()) return;
    cwsAdminStore.requestCwsAction({
      kind: 'webhook.create',
      name: name.trim(),
      event,
      callbackUrl: callbackUrl.trim(),
      secret: secret.trim() || undefined,
    });
    onCreated();
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
        Create a new webhook. The signing secret and callback URL will be shown once after creation.
      </p>
      <EditField label="Name" value={name} onChange={setName} placeholder="e.g. slack-notify" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          className="mono"
          style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}
        >
          Event
        </label>
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value as WebhookEvent)}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-0)',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}
        >
          {WEBHOOK_EVENTS.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
      </div>
      <EditField label="Callback URL" value={callbackUrl} onChange={setCallbackUrl} placeholder="https://example.com/webhook" />
      <EditField label="Signing secret (optional)" value={secret} onChange={setSecret} placeholder="Leave empty for auto-generated" />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="submit"
          disabled={!name.trim() || !callbackUrl.trim()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: name.trim() && callbackUrl.trim() ? 'var(--bg-0)' : 'var(--text-dim)',
            background: name.trim() && callbackUrl.trim() ? 'var(--accent-violet)' : 'var(--surface-base)',
            border: `1px solid ${name.trim() && callbackUrl.trim() ? 'var(--accent-violet)' : 'var(--border-base)'}`,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Create Webhook
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
        No CWS admin adapter is bound. Connect a Hermes backend to manage {section.toLowerCase()}.
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

function WebhookStatusBadge({
  active,
  error,
}: {
  active: boolean;
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
  if (active) {
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
      Inactive
    </span>
  );
}

function EventBadge({ event }: { event: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        padding: '1px 6px',
        background: 'var(--surface-base)',
        border: '1px solid var(--border-faint)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {event}
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
          e.currentTarget.style.borderColor = 'var(--accent-violet)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-base)';
        }}
      />
    </div>
  );
}
