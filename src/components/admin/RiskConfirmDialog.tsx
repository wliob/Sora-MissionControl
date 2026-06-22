/**
 * RiskConfirmDialog — shared confirmation dialog for all admin surfaces.
 *
 * Consolidates the two prior ConfirmDialog variants:
 *   - components/admin/ConfirmDialog.tsx (open/title/message/danger props)
 *   - components/common/ConfirmDialog.tsx (ConfirmationRequest from admin.ts)
 *
 * Supports three severity tiers matching the CWS action tier system:
 *   - safe:    no dialog (shouldn't render)
 *   - risk:    amber accent, standard confirm/cancel
 *   - danger:  red accent, optional typed-phrase gate
 *
 * The typed-phrase gate requires the user to type a confirmation phrase
 * (e.g. the entity name) before the Confirm button enables. This prevents
 * accidental destructive clicks for irreversible actions like cron.remove.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionTier } from '@/types/admin-cws';

interface RiskConfirmDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Short title for the dialog header. */
  title: string;
  /** Human-readable confirmation message; never includes secrets. */
  message: string;
  /** Severity tier for visual styling and behavior. */
  tier: ActionTier;
  /** Whether the user must type a phrase to enable the Confirm button. */
  requiresTypedPhrase: boolean;
  /** The phrase the user must type when requiresTypedPhrase is true. */
  typedPhrase?: string;
  /** Label for the confirm button (defaults to "Confirm"). */
  confirmLabel?: string;
  /** Called when the user confirms (after typed phrase if required). */
  onConfirm: () => void;
  /** Called when the user cancels or clicks outside. */
  onCancel: () => void;
}

export function RiskConfirmDialog({
  open,
  title,
  message,
  tier,
  requiresTypedPhrase,
  typedPhrase = '',
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: RiskConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');

  // Reset typed input when dialog opens or phrase changes
  useEffect(() => {
    if (open) {
      setTyped('');
      cancelRef.current?.focus();
    }
  }, [open]);

  // Focus the input when typed phrase is required
  useEffect(() => {
    if (open && requiresTypedPhrase) {
      // Small delay so the dialog renders first
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open, requiresTypedPhrase]);

  // Escape key cancels
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const phraseMatch = requiresTypedPhrase
    ? typed.trim().toLowerCase() === typedPhrase.trim().toLowerCase()
    : true;

  const handleConfirm = useCallback(() => {
    if (!phraseMatch) return;
    onConfirm();
  }, [phraseMatch, onConfirm]);

  if (!open) return null;

  const isDanger = tier === 'danger';
  const accentColor = isDanger ? 'var(--accent-red)' : 'var(--accent-amber)';
  const accentGlow = isDanger ? 'var(--accent-red-glow)' : 'var(--accent-amber-glow)';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '440px',
          maxWidth: '90vw',
          background: 'var(--bg-2)',
          border: `1px solid ${accentColor}44`,
          borderRadius: 'var(--radius-lg)',
          boxShadow: `0 0 0 1px ${accentColor}22, 0 8px 32px rgba(0,0,0,0.5)`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--border-faint)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: accentColor,
              boxShadow: `0 0 8px ${accentColor}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 'var(--text-xs)',
              color: accentColor,
              background: accentGlow,
              border: `1px solid ${accentColor}44`,
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              marginLeft: 'auto',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {tier}
          </span>
        </header>

        {/* Body */}
        <div style={{ padding: 'var(--space-5)' }}>
          <p
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: requiresTypedPhrase ? 'var(--space-3)' : 0,
            }}
          >
            {message}
          </p>

          {/* Typed phrase gate */}
          {requiresTypedPhrase && (
            <div
              style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: 'var(--bg-1)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-faint)',
              }}
            >
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--space-2)',
                  lineHeight: 1.5,
                }}
              >
                Type <strong style={{ color: 'var(--text-primary)' }}>{typedPhrase}</strong> to confirm:
              </p>
              <input
                ref={inputRef}
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={typedPhrase}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--bg-0)',
                  border: `1px solid ${phraseMatch ? 'var(--accent-green)' : 'var(--border-base)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-5) var(--space-5)',
          }}
        >
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              background: 'var(--surface-base)',
              border: '1px solid var(--border-base)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!phraseMatch}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: !phraseMatch
                ? 'var(--text-dim)'
                : isDanger
                  ? 'var(--bg-0)'
                  : 'var(--text-primary)',
              background: !phraseMatch
                ? 'var(--surface-base)'
                : accentColor,
              border: `1px solid ${!phraseMatch ? 'var(--border-base)' : accentColor}`,
              borderRadius: 'var(--radius-md)',
              boxShadow:
                phraseMatch
                  ? `0 0 12px ${accentGlow}`
                  : 'none',
              cursor: !phraseMatch ? 'default' : 'pointer',
              opacity: !phraseMatch ? 0.5 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
