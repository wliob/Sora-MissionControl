/**
 * KeysPanel — API key management surface.
 *
 * Flows:
 *  - List keys with masked secrets, active/revoked status, timestamps.
 *  - Create key: form with label/provider/note → store creates key →
 *    one-time SecretReveal shows the raw secret → dismiss → masked only.
 *  - Update key: inline edit of label/note/active toggle (non-destructive).
 *  - Revoke key: confirm dialog → store revokes → key shows revoked.
 *  - Regenerate key: confirm dialog → store regenerates → one-time
 *    SecretReveal shows the new secret → dismiss → masked only.
 *  - Delete key: confirm dialog → store deletes → key disappears.
 *
 * Security:
 *  - Secrets are NEVER displayed in the list — only masked fingerprints.
 *  - The raw secret appears exactly once, in the SecretReveal, sourced from
 *    the ephemeral `lastResult.createdKey.secret`, never from store state.
 *  - Revoke, regenerate, and delete all require explicit confirmation.
 *
 * Adapter boundary:
 *  - When no Key/MCP adapter is bound, the "+ New Key" button and all
 *    mutating controls (edit, regenerate, revoke, delete) are disabled.
 *  - The store returns empty lists with missing provenance, so the panel
 *    cannot look healthy when there is no verified backend.
 */

import { useState, type FormEvent } from 'react';
import { adminKeyMcpStore, useKeyMcpAdminState, hasKeyMcpAdapter } from '@/state/adminKeyMcpStore';
import type { ApiKey } from '@/types/admin-keymcp';
import { AdminSectionShell } from '@/components/admin/AdminSectionShell';
import { RiskConfirmDialog } from '@/components/admin/RiskConfirmDialog';
import { SecretReveal } from '@/components/admin/SecretReveal';
import { MaskedField } from '@/components/admin/MaskedField';

type PanelMode = 'list' | 'create';

export function KeysPanel() {
  const state = useKeyMcpAdminState();
  const [mode, setMode] = useState<PanelMode>('list');
  const adapterBound = hasKeyMcpAdapter();

  // Find the one-time secret from the last action result, if it's a key creation/regeneration
  const createdKey = state.lastResult?.createdKey ?? null;
  const showSecret = createdKey != null;

  return (
    <>
      <AdminSectionShell
        title="API Keys"
        count={adapterBound ? state.keys.length : undefined}
        actions={
          mode === 'list' && adapterBound ? (
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
              + New Key
            </button>
          ) : undefined
        }
      >
        {showSecret && createdKey ? (
          <SecretReveal
            secret={createdKey.secret}
            label={`API key "${createdKey.label}"`}
            onDismiss={() => {
              adminKeyMcpStore.clearLastResult();
            }}
          />
        ) : mode === 'create' ? (
          <CreateKeyForm
            onCancel={() => setMode('list')}
            onCreated={() => setMode('list')}
          />
        ) : !adapterBound ? (
          <EmptyState message="No adapter bound — key management unavailable" />
        ) : state.keys.length === 0 ? (
          <EmptyState message="No API keys configured" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {state.keys.map((key) => (
              <KeyRow
                key={key.id}
                apiKey={key}
                pendingConfirm={state.pending.find(
                  (p) => p.action.kind !== 'mcp.test' && 'id' in p.action && p.action.id === key.id,
                )}
                busy={state.busy}
                adapterBound={adapterBound}
              />
            ))}
          </div>
        )}
      </AdminSectionShell>

      {/* Render pending confirmations for keys */}
      {state.pending
        .filter((p) => p.action.kind.startsWith('key.'))
        .map((p) => (
          <RiskConfirmDialog
            key={p.nonce}
            open
            title={confirmTitle(p.action.kind)}
            message={p.summary}
            tier={p.tier}
            requiresTypedPhrase={p.requiresTypedPhrase}
            typedPhrase={p.typedPhrase}
            confirmLabel={actionVerb(p.action.kind)}
            onConfirm={() => adminKeyMcpStore.confirmAction(p.nonce)}
            onCancel={() => adminKeyMcpStore.cancelAction(p.nonce)}
          />
        ))}
    </>
  );
}

function confirmTitle(kind: string): string {
  switch (kind) {
    case 'key.revoke':
      return 'Revoke API Key';
    case 'key.regenerate':
      return 'Regenerate API Key';
    case 'key.delete':
      return 'Delete API Key';
    default:
      return 'Confirm Key Action';
  }
}

function actionVerb(kind: string): string {
  switch (kind) {
    case 'key.revoke':
      return 'Revoke';
    case 'key.regenerate':
      return 'Regenerate';
    case 'key.delete':
      return 'Delete';
    default:
      return 'Confirm';
  }
}

/* ── Key row ────────────────────────────────────────────────────────── */

interface KeyRowProps {
  apiKey: ApiKey;
  pendingConfirm?: { nonce: string };
  busy: boolean;
  adapterBound: boolean;
}

function KeyRow({ apiKey, busy, adapterBound }: KeyRowProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(apiKey.label);
  const [note, setNote] = useState(apiKey.note ?? '');

  function saveEdit() {
    adminKeyMcpStore.requestAction({
      kind: 'key.update',
      id: apiKey.id,
      label,
      note: note || undefined,
    });
    setEditing(false);
  }

  return (
    <div
      style={{
        padding: 'var(--space-3)',
        background: 'var(--bg-2)',
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-md)',
        transition: 'border-color var(--dur-micro)',
      }}
    >
      {/* Header row: label + status + actions */}
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
            {apiKey.label}
          </span>
          <StatusBadge active={apiKey.active} revoked={!!apiKey.revokedAt} />
        </div>
        {!editing && (
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <ActionButton label="Edit" subtle onClick={() => setEditing(true)} disabled={busy || !adapterBound} />
            <ActionButton
              label="Regenerate"
              subtle
              danger
              onClick={() =>
                adminKeyMcpStore.requestAction({ kind: 'key.regenerate', id: apiKey.id })
              }
              disabled={busy || !apiKey.active || !adapterBound}
            />
            <ActionButton
              label="Revoke"
              subtle
              danger
              onClick={() => adminKeyMcpStore.requestAction({ kind: 'key.revoke', id: apiKey.id })}
              disabled={busy || !apiKey.active || !adapterBound}
            />
            <ActionButton
              label="Delete"
              subtle
              danger
              onClick={() => adminKeyMcpStore.requestAction({ kind: 'key.delete', id: apiKey.id })}
              disabled={busy || !adapterBound}
            />
          </div>
        )}
      </div>

      {/* Fields */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <EditField label="Label" value={label} onChange={setLabel} />
          <EditField label="Note" value={note} onChange={setNote} placeholder="Optional note" />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={saveEdit}
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
              Save
            </button>
            <button
              onClick={() => {
                setLabel(apiKey.label);
                setNote(apiKey.note ?? '');
                setEditing(false);
              }}
              style={{
                padding: 'var(--space-2) var(--space-3)',
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
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-3)',
          }}
        >
          <MaskedField label="Secret" value={apiKey.maskedSecret} />
          <MaskedField label="Provider" value={apiKey.provider} mono={false} />
          <MaskedField label="Created" value={apiKey.createdAt.slice(0, 10)} mono={false} />
          <MaskedField
            label="Last rotated"
            value={apiKey.lastRotatedAt ? apiKey.lastRotatedAt.slice(0, 10) : null}
            mono={false}
          />
          {apiKey.note && (
            <MaskedField label="Note" value={apiKey.note} mono={false} />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Create key form ────────────────────────────────────────────────── */

function CreateKeyForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [label, setLabel] = useState('');
  const [provider, setProvider] = useState('openrouter');
  const [note, setNote] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    adminKeyMcpStore.requestAction({
      kind: 'key.create',
      label: label.trim(),
      provider,
      note: note.trim() || undefined,
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
        maxWidth: '400px',
      }}
    >
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Create a new API key. The secret will be shown exactly once after creation.
      </p>
      <EditField label="Label" value={label} onChange={setLabel} placeholder="e.g. OpenRouter production" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          className="mono"
          style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}
        >
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-0)',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="openrouter">openrouter</option>
          <option value="anthropic">anthropic</option>
          <option value="openai">openai</option>
          <option value="custom">custom</option>
          <option value="local-ollama">local-ollama</option>
        </select>
      </div>
      <EditField label="Note (optional)" value={note} onChange={setNote} placeholder="What is this key for?" />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="submit"
          disabled={!label.trim()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: label.trim() ? 'var(--bg-0)' : 'var(--text-dim)',
            background: label.trim() ? 'var(--accent-cyan)' : 'var(--surface-base)',
            border: `1px solid ${label.trim() ? 'var(--accent-cyan)' : 'var(--border-base)'}`,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Create Key
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

/* ── Shared UI atoms ────────────────────────────────────────────────── */

function StatusBadge({ active, revoked }: { active: boolean; revoked: boolean }) {
  if (revoked) {
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
        Revoked
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

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-8) var(--space-4)',
        textAlign: 'center',
        color: 'var(--text-dim)',
        fontSize: 'var(--text-sm)',
        fontStyle: 'italic',
      }}
    >
      {message}
    </div>
  );
}
