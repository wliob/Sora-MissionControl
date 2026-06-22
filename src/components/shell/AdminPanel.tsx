/**
 * AdminPanel — model management admin surface.
 *
 * Lists configured models with masked secrets, provides view/edit actions,
 * and gates destructive actions behind ConfirmDialog. Follows the
 * mission-control visual language: dark, quiet, risk-first.
 *
 * Per docs/section-contracts.md §Admin/control module:
 *  - No secret values: the panel only ever displays `apiKeyMasked`.
 *  - Destructive/risky actions (disable, delete, setDefault, resetCredential)
 *    show a ConfirmDialog before executing.
 *  - Non-destructive actions (enable, editConfig) execute immediately.
 */

import { useEffect, useState } from 'react';
import type { ModelEntry, ModelStatus, ModelCredentialPresence } from '@/types/admin';
import { useAdminState, adminStore } from '@/modules/admin/adminStore';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const STATUS_META: Record<ModelStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'var(--accent-green)', bg: 'var(--accent-green-glow)' },
  available: { label: 'Available', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-glow)' },
  disabled: { label: 'Disabled', color: 'var(--text-muted)', bg: 'var(--status-unknown-bg)' },
  error: { label: 'Error', color: 'var(--accent-red)', bg: 'var(--accent-red-glow)' },
  unknown: { label: 'Unknown', color: 'var(--text-muted)', bg: 'var(--status-unknown-bg)' },
};

const CRED_META: Record<ModelCredentialPresence, { label: string; color: string }> = {
  configured: { label: 'Key set', color: 'var(--accent-green)' },
  missing: { label: 'No key', color: 'var(--accent-amber)' },
  error: { label: 'Key error', color: 'var(--accent-red)' },
  unknown: { label: '—', color: 'var(--text-dim)' },
};

export function AdminPanel() {
  const state = useAdminState();
  const models = state.models.value ?? [];
  const selected = state.selectedModelId
    ? models.find((m) => m.id === state.selectedModelId) ?? null
    : null;
  const pending = state.pendingConfirmations;

  // Auto-load models on mount if an adapter is bound.
  useEffect(() => {
    if (adminStore.hasAdapter()) {
      void adminStore.loadModels();
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-faint)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Models
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>
          {models.length} configured
        </span>
      </div>

      {/* Adapter-unavailable banner */}
      {!adminStore.hasAdapter() && !state.lastError && (
        <div
          className="mono"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--status-unknown-bg)',
            borderBottom: '1px solid var(--border-faint)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          MODEL ADAPTER UNAVAILABLE · controls are disabled until Cloud binds a verified backend
        </div>
      )}

      {/* Error banner */}
      {state.lastError && (
        <div
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--accent-red-glow)',
            borderBottom: '1px solid var(--accent-red)33',
            color: 'var(--accent-red)',
            fontSize: 'var(--text-xs)',
            flexShrink: 0,
          }}
        >
          {state.lastError}
        </div>
      )}

      {/* Body: split list / detail */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Model list */}
        <div
          style={{
            width: '280px',
            borderRight: '1px solid var(--border-faint)',
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          {models.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-6) var(--space-4)',
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: 'var(--text-sm)',
                fontStyle: 'italic',
              }}
            >
              {state.lastError ? 'Failed to load' : 'No models loaded'}
            </div>
          ) : (
            models.map((model) => (
              <ModelListRow
                key={model.id}
                model={model}
                selected={state.selectedModelId === model.id}
                onSelect={() => adminStore.selectModel(model.id)}
              />
            ))
          )}
        </div>

        {/* Detail / edit view */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {selected ? (
            <ModelDetail model={selected} />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-dim)',
                fontSize: 'var(--text-sm)',
                fontStyle: 'italic',
              }}
            >
              Select a model to view details
            </div>
          )}
        </div>
      </div>

      {/* Pending confirmation dialogs */}
      {pending.map((c) => (
        <ConfirmDialog
          key={c.id}
          confirmation={c}
          onConfirm={(id) => void adminStore.confirmAction(id)}
          onCancel={(id) => adminStore.cancelAction(id)}
        />
      ))}
    </div>
  );
}

/** Alias export for use in the unified admin surface. */
export { AdminPanel as ModelAdminPanel };

/* ── Model list row ────────────────────────────────────────────────────── */

function ModelListRow({
  model,
  selected,
  onSelect,
}: {
  model: ModelEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const sm = STATUS_META[model.status];
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        width: '100%',
        padding: 'var(--space-3) var(--space-4)',
        textAlign: 'left',
        background: selected ? 'var(--surface-active)' : 'transparent',
        borderBottom: '1px solid var(--border-faint)',
        borderLeft: selected ? '2px solid var(--accent-cyan)' : '2px solid transparent',
        transition: 'background var(--dur-micro)',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--surface-base)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {model.label ?? model.model}
        </span>
        {model.isDefault && (
          <span
            className="mono"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--accent-violet)',
              background: 'var(--accent-violet-glow)',
              padding: '1px 5px',
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
            }}
          >
            DEFAULT
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-dim)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {model.id}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            color: sm.color,
            background: sm.bg,
            padding: '1px 5px',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${sm.color}33`,
            flexShrink: 0,
          }}
        >
          {sm.label}
        </span>
      </div>
    </button>
  );
}

/* ── Model detail / edit ────────────────────────────────────────────────── */

function ModelDetail({ model }: { model: ModelEntry }) {
  const [editLabel, setEditLabel] = useState(model.label ?? '');
  const sm = STATUS_META[model.status];
  const cm = CRED_META[model.credentialPresence];

  // Sync edit field when the selected model changes.
  useEffect(() => {
    setEditLabel(model.label ?? '');
  }, [model.id]);

  return (
    <div
      style={{
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {model.label ?? model.model}
          </div>
          <div className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)', marginTop: 'var(--space-1)' }}>
            {model.id}
          </div>
        </div>
        <span
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            color: sm.color,
            background: sm.bg,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${sm.color}33`,
            fontWeight: 600,
          }}
        >
          {sm.label}
        </span>
      </div>

      {/* Error display */}
      {model.error && (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'var(--accent-red-glow)',
            border: '1px solid var(--accent-red)33',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-red)',
            fontSize: 'var(--text-xs)',
          }}
        >
          {model.error}
        </div>
      )}

      {/* Secret-safe field grid */}
      <FieldGrid>
        <Field label="Provider" value={model.provider} />
        <Field label="Model" value={model.model} />
        <Field
          label="API Key"
          value={model.apiKeyMasked ?? '—'}
          mono
          accent={cm.color}
          hint={cm.label}
        />
        <Field
          label="Credential"
          value={cm.label}
          accent={cm.color}
        />
        <Field label="Context Window" value={model.contextWindow ? model.contextWindow.toLocaleString() : 'unknown'} />
        <Field label="Max Output" value={model.maxOutput ? model.maxOutput.toLocaleString() : 'unknown'} />
        <Field label="Default" value={model.isDefault ? 'yes' : 'no'} />
        <Field label="Fallback" value={model.isFallback ? 'yes' : 'no'} />
        <Field label="Last Checked" value={model.lastCheckedAt ?? 'never'} mono />
      </FieldGrid>

      {/* Edit form (non-secret config) */}
      <div
        style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-1)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-faint)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div
          className="mono"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          Edit Configuration
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Display Label</label>
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder={model.model}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--bg-0)',
              border: '1px solid var(--border-base)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>
        <button
          className="admin-btn"
          onClick={() =>
            adminStore.requestAction(model.id, 'model.editConfig', {
              kind: 'editConfig',
              label: editLabel || null,
            })
          }
          disabled={!adminStore.hasAdapter()}
          style={{
            alignSelf: 'flex-start',
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-sm)',
            color: 'var(--accent-cyan)',
            background: 'var(--accent-cyan-glow)',
            border: '1px solid var(--accent-cyan)44',
            borderRadius: 'var(--radius-md)',
            opacity: adminStore.hasAdapter() ? 1 : 0.4,
            cursor: adminStore.hasAdapter() ? 'pointer' : 'default',
          }}
        >
          Save Config
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {model.status === 'disabled' ? (
          <ActionButton
            label="Enable"
            accent="cyan"
            disabled={!adminStore.hasAdapter()}
            onClick={() => adminStore.requestAction(model.id, 'model.enable', { kind: 'enable' })}
          />
        ) : (
          <ActionButton
            label="Disable"
            accent="amber"
            destructive
            disabled={!adminStore.hasAdapter()}
            onClick={() => adminStore.requestAction(model.id, 'model.disable', { kind: 'disable' })}
          />
        )}
        {!model.isDefault && (
          <ActionButton
            label="Set Default"
            accent="violet"
            destructive
            disabled={!adminStore.hasAdapter()}
            onClick={() => adminStore.requestAction(model.id, 'model.setDefault', { kind: 'setDefault' })}
          />
        )}
        <ActionButton
          label={model.isFallback ? 'Remove Fallback' : 'Set Fallback'}
          accent="violet"
          destructive
          disabled={!adminStore.hasAdapter()}
          onClick={() =>
            adminStore.requestAction(model.id, 'model.setFallback', {
              kind: 'setFallback',
              isFallback: !model.isFallback,
            })
          }
        />
        <ActionButton
          label="Reset Credential"
          accent="red"
          destructive
          disabled={!adminStore.hasAdapter()}
          onClick={() => adminStore.requestAction(model.id, 'model.resetCredential', { kind: 'resetCredential' })}
        />
        <ActionButton
          label="Delete"
          accent="red"
          destructive
          disabled={!adminStore.hasAdapter()}
          onClick={() => adminStore.requestAction(model.id, 'model.delete', { kind: 'delete' })}
        />
      </div>

      {/* Recent results for this model */}
      <RecentResults modelId={model.id} />
    </div>
  );
}

/* ── Reusable field grid ────────────────────────────────────────────────── */

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-2) var(--space-4)',
        padding: 'var(--space-4)',
        background: 'var(--bg-1)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-faint)',
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  accent,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <span
        className="mono"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span
          className={mono ? 'mono' : ''}
          style={{
            fontSize: 'var(--text-sm)',
            color: accent ?? 'var(--text-secondary)',
          }}
        >
          {value}
        </span>
        {hint && (
          <span
            className="mono"
            style={{
              fontSize: 'var(--text-xs)',
              color: accent ?? 'var(--text-dim)',
              padding: '1px 4px',
              background: 'var(--surface-base)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Action button ───────────────────────────────────────────────────────── */

function ActionButton({
  label,
  accent,
  destructive = false,
  disabled = false,
  onClick,
}: {
  label: string;
  accent: 'cyan' | 'violet' | 'amber' | 'red';
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const color = `var(--accent-${accent})`;
  const glow = `var(--accent-${accent}-glow)`;
  return (
    <button
      className="admin-accent-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 'var(--space-2) var(--space-3)',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        color,
        background: glow,
        border: `1px solid ${color}44`,
        borderRadius: 'var(--radius-md)',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.borderColor = `${color}88`;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.borderColor = `${color}44`;
      }}
      title={destructive ? 'This action requires confirmation' : undefined}
    >
      {destructive ? '⚠ ' : ''}{label}
    </button>
  );
}

/* ── Recent results ─────────────────────────────────────────────────────── */

function RecentResults({ modelId }: { modelId: string }) {
  const state = useAdminState();
  const results = state.lastResults.filter((r) => r.modelId === modelId).slice(-5).reverse();

  if (results.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Recent Actions
      </span>
      {results.map((r) => (
        <div
          key={r.id}
          className="mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          <span
            style={{
              color: r.status === 'success' ? 'var(--accent-green)' : r.status === 'failed' ? 'var(--accent-red)' : 'var(--text-dim)',
            }}
          >
            {r.status === 'success' ? '✓' : r.status === 'failed' ? '✗' : '○'}
          </span>
          <span style={{ flex: 1 }}>{r.actionType}</span>
          {r.error && (
            <span style={{ color: 'var(--accent-red)', fontStyle: 'italic' }}>{r.error}</span>
          )}
        </div>
      ))}
    </div>
  );
}