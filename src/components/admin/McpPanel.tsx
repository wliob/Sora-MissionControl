/**
 * McpPanel — MCP server management surface.
 *
 * Flows:
 *  - List MCP entries with masked tokens, enabled/disabled status, test results.
 *  - Create MCP entry: form with name/url/transport/token/note → store creates
 *    entry → one-time SecretReveal shows the raw token (if set) → dismiss.
 *  - Update MCP entry: inline edit of name/url/transport/note/enabled (non-
 *    destructive unless token changes, which triggers one-time reveal).
 *  - Test MCP: triggers a connection test (non-destructive, no confirm).
 *  - Remove MCP: confirm dialog → store removes → entry disappears.
 *
 * Security:
 *  - Tokens are NEVER displayed in the list — only masked fingerprints.
 *  - The raw token appears exactly once, in the SecretReveal, sourced from
 *    the ephemeral `lastResult.createdMcp.token`, never from store state.
 *  - Remove requires explicit confirmation.
 *
 * Adapter boundary:
 *  - When no Key/MCP adapter is bound, the "+ Add Server" button and all
 *    mutating controls (edit, test, remove) are disabled.
 *  - The store returns empty lists with missing provenance, so the panel
 *    cannot look healthy when there is no verified backend.
 */

import { useState, type FormEvent } from 'react';
import { adminKeyMcpStore, useKeyMcpAdminState, hasKeyMcpAdapter } from '@/state/adminKeyMcpStore';
import type { McpEntry, McpEntryCreated } from '@/types/admin-keymcp';
import { AdminSectionShell } from '@/components/admin/AdminSectionShell';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SecretReveal } from '@/components/admin/SecretReveal';
import { MaskedField } from '@/components/admin/MaskedField';

type PanelMode = 'list' | 'create';

export function McpPanel() {
  const state = useKeyMcpAdminState();
  const [mode, setMode] = useState<PanelMode>('list');
  const adapterBound = hasKeyMcpAdapter();

  const createdMcp: McpEntryCreated | null = state.lastResult?.createdMcp ?? null;
  const showSecret = createdMcp != null && createdMcp.token != null;

  return (
    <>
      <AdminSectionShell
        title="MCP Servers"
        count={adapterBound ? state.mcpEntries.length : undefined}
        actions={
          mode === 'list' && adapterBound ? (
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
              + Add Server
            </button>
          ) : undefined
        }
      >
        {showSecret && createdMcp && createdMcp.token ? (
          <SecretReveal
            secret={createdMcp.token}
            label={`MCP token for "${createdMcp.name}"`}
            onDismiss={() => adminKeyMcpStore.clearLastResult()}
          />
        ) : mode === 'create' ? (
          <CreateMcpForm onCancel={() => setMode('list')} onCreated={() => setMode('list')} />
        ) : !adapterBound ? (
          <EmptyState message="No adapter bound — MCP server management unavailable" />
        ) : state.mcpEntries.length === 0 ? (
          <EmptyState message="No MCP servers configured" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {state.mcpEntries.map((entry) => (
              <McpRow key={entry.id} entry={entry} busy={state.busy} adapterBound={adapterBound} />
            ))}
          </div>
        )}
      </AdminSectionShell>

      {state.pending
        .filter((p) => p.action.kind === 'mcp.remove')
        .map((p) => (
          <ConfirmDialog
            key={p.nonce}
            open
            title="Confirm destructive action"
            message={p.summary}
            confirmLabel="Remove"
            danger
            onConfirm={() => adminKeyMcpStore.confirmAction(p.nonce)}
            onCancel={() => adminKeyMcpStore.cancelAction(p.nonce)}
          />
        ))}
    </>
  );
}

/* ── MCP row ─────────────────────────────────────────────────────────── */

function McpRow({ entry, busy, adapterBound }: { entry: McpEntry; busy: boolean; adapterBound: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  const [url, setUrl] = useState(entry.url);
  const [transport, setTransport] = useState(entry.transport);
  const [note, setNote] = useState(entry.note ?? '');

  function saveEdit() {
    adminKeyMcpStore.requestAction({
      kind: 'mcp.update',
      id: entry.id,
      name,
      url,
      transport,
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
      }}
    >
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
            {entry.name}
          </span>
          <EnabledBadge enabled={entry.enabled} />
          <TransportBadge transport={entry.transport} />
        </div>
        {!editing && (
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <ActionButton
              label="Test"
              subtle
              onClick={() => adminKeyMcpStore.requestAction({ kind: 'mcp.test', id: entry.id })}
              disabled={busy || !adapterBound}
            />
            <ActionButton label="Edit" subtle onClick={() => setEditing(true)} disabled={busy || !adapterBound} />
            <ActionButton
              label="Remove"
              subtle
              danger
              onClick={() => adminKeyMcpStore.requestAction({ kind: 'mcp.remove', id: entry.id })}
              disabled={busy || !adapterBound}
            />
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <EditField label="Name" value={name} onChange={setName} />
          <EditField label="URL" value={url} onChange={setUrl} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label
              className="mono"
              style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}
            >
              Transport
            </label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as McpEntry['transport'])}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--bg-0)',
                border: '1px solid var(--border-base)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="http">http</option>
              <option value="stdio">stdio</option>
              <option value="sse">sse</option>
            </select>
          </div>
          <EditField label="Note" value={note} onChange={setNote} placeholder="Optional" />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={saveEdit}
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
              Save
            </button>
            <button
              onClick={() => {
                setName(entry.name);
                setUrl(entry.url);
                setTransport(entry.transport);
                setNote(entry.note ?? '');
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <MaskedField label="URL" value={entry.url} mono={false} />
          <MaskedField label="Token" value={entry.maskedToken} />
          <MaskedField label="Created" value={entry.createdAt.slice(0, 10)} mono={false} />
          {entry.lastTest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span
                className="mono"
                style={{
                  fontSize: 'var(--text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                }}
              >
                Last test
              </span>
              <TestResultBadge result={entry.lastTest} />
            </div>
          )}
          {entry.note && <MaskedField label="Note" value={entry.note} mono={false} />}
        </div>
      )}
    </div>
  );
}

/* ── Create MCP form ────────────────────────────────────────────────── */

function CreateMcpForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [transport, setTransport] = useState<McpEntry['transport']>('http');
  const [token, setToken] = useState('');
  const [note, setNote] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    adminKeyMcpStore.requestAction({
      kind: 'mcp.create',
      name: name.trim(),
      url: url.trim(),
      transport,
      token: token.trim() || null,
      note: note.trim() || undefined,
    });
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '400px' }}
    >
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Add an MCP server. If you set a token, it will be shown exactly once after creation.
      </p>
      <EditField label="Name" value={name} onChange={setName} placeholder="e.g. context7" />
      <EditField label="URL" value={url} onChange={setUrl} placeholder="http://localhost:8000/mcp" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label
          className="mono"
          style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}
        >
          Transport
        </label>
        <select
          value={transport}
          onChange={(e) => setTransport(e.target.value as McpEntry['transport'])}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-0)',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="http">http</option>
          <option value="stdio">stdio</option>
          <option value="sse">sse</option>
        </select>
      </div>
      <EditField label="Token (optional)" value={token} onChange={setToken} placeholder="Leave empty for no auth" />
      <EditField label="Note (optional)" value={note} onChange={setNote} placeholder="What is this server for?" />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="submit"
          disabled={!name.trim() || !url.trim()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: name.trim() && url.trim() ? 'var(--bg-0)' : 'var(--text-dim)',
            background: name.trim() && url.trim() ? 'var(--accent-violet)' : 'var(--surface-base)',
            border: `1px solid ${name.trim() && url.trim() ? 'var(--accent-violet)' : 'var(--border-base)'}`,
            borderRadius: 'var(--radius-md)',
          }}
        >
          Add Server
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

/* ── Badges and atoms ────────────────────────────────────────────────── */

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
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
      Enabled
    </span>
  ) : (
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

function TransportBadge({ transport }: { transport: McpEntry['transport'] }) {
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
      {transport}
    </span>
  );
}

function TestResultBadge({ result }: { result: NonNullable<McpEntry['lastTest']> }) {
  if (result.ok) {
    return (
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-green)' }}>
        ✓ {result.latencyMs}ms
      </span>
    );
  }
  return (
    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-red)' }}>
      ✗ {result.error ?? 'failed'}
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
