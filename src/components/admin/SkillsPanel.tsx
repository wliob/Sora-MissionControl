/**
 * SkillsPanel — Skills management surface wired to cwsAdminStore.
 *
 * Flows:
 *  - List skills with source, enabled/disabled status, category, sensitive access flag.
 *  - Enable/Disable: risk-tier confirmation (skills with sensitive access
 *    get extra warning text in the confirmation summary).
 *  - No create/delete: skills are managed externally via Hermes CLI/config.
 *
 * Security:
 *  - Skills are read-only from the admin surface; only enable/disable is allowed.
 *  - When adapter is not bound, renders "unavailable" banner, not mock data.
 *  - hasSensitiveAccess is displayed as a warning badge, not as access details.
 */

import { useCwsAdminState, hasCwsAdapter, cwsAdminStore } from '@/state/cwsAdminStore';
import type { SkillEntry, SkillSource } from '@/types/admin-cws';
import { RiskConfirmDialog } from '@/components/admin/RiskConfirmDialog';
import { AdminSectionShell } from '@/components/admin/AdminSectionShell';
import { MaskedField } from '@/components/admin/MaskedField';

export function SkillsPanel() {
  const state = useCwsAdminState();
  const adapterBound = hasCwsAdapter();

  return (
    <>
      <AdminSectionShell title="Skills" count={state.skills.length}>
        {!adapterBound ? (
          <UnavailableBanner section="Skills" />
        ) : state.skills.length === 0 ? (
          <EmptyState message="No skills found" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {state.skills.map((skill) => (
              <SkillRow key={skill.name} skill={skill} busy={state.busy} />
            ))}
          </div>
        )}
      </AdminSectionShell>

      {/* Render pending confirmations for skill actions */}
      {state.pending
        .filter((p) => p.action.kind.startsWith('skill.'))
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
  if (kind === 'skill.enable') return 'Enable Skill';
  if (kind === 'skill.disable') return 'Disable Skill';
  return 'Confirm Action';
}

function actionVerb(kind: string): string {
  switch (kind) {
    case 'skill.enable': return 'Enable';
    case 'skill.disable': return 'Disable';
    default: return 'Confirm';
  }
}

function phraseTarget(action: { kind: string; name?: string }): string {
  if ('name' in action && typeof action.name === 'string') {
    return action.name;
  }
  return '';
}

/* ── Skill row ────────────────────────────────────────────────────────── */

function SkillRow({ skill, busy }: { skill: SkillEntry; busy: boolean }) {
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
            {skill.name}
          </span>
          <SkillEnabledBadge enabled={skill.enabled} />
          <SourceBadge source={skill.source} />
          {skill.hasSensitiveAccess && <SensitiveBadge />}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {!skill.enabled && (
            <ActionButton
              label="Enable"
              subtle
              onClick={() =>
                cwsAdminStore.requestCwsAction({ kind: 'skill.enable', name: skill.name })
              }
              disabled={busy}
            />
          )}
          {skill.enabled && (
            <ActionButton
              label="Disable"
              subtle
              danger
              onClick={() =>
                cwsAdminStore.requestCwsAction({ kind: 'skill.disable', name: skill.name })
              }
              disabled={busy}
            />
          )}
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
        {skill.description && (
          <MaskedField label="Description" value={skill.description} mono={false} />
        )}
        {skill.category && (
          <MaskedField label="Category" value={skill.category} mono={false} />
        )}
        {skill.subSkillCount !== null && (
          <MaskedField label="Sub-skills" value={String(skill.subSkillCount)} />
        )}
        {skill.lastModifiedAt && (
          <MaskedField label="Last modified" value={skill.lastModifiedAt.slice(0, 10)} mono={false} />
        )}
      </div>
    </div>
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

function SkillEnabledBadge({ enabled }: { enabled: boolean }) {
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

function SourceBadge({ source }: { source: SkillSource }) {
  const colors: Record<SkillSource, { color: string; bg: string; border: string }> = {
    builtin: { color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-glow)', border: 'var(--accent-cyan)44' },
    user: { color: 'var(--accent-violet)', bg: 'var(--accent-violet-glow)', border: 'var(--accent-violet)44' },
    plugin: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-glow)', border: 'var(--accent-amber)44' },
    unknown: { color: 'var(--text-muted)', bg: 'var(--surface-base)', border: 'var(--border-base)' },
  };
  const c = colors[source] ?? colors.unknown;
  return (
    <span
      className="mono"
      style={{
        fontSize: 'var(--text-xs)',
        color: c.color,
        padding: '1px 6px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {source}
    </span>
  );
}

function SensitiveBadge() {
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
      ⚠ Sensitive
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
