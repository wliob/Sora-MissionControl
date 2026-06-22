/**
 * ConfirmDialog — modal confirmation for destructive/risky admin actions.
 *
 * Renders a confirmation prompt over a dimmed backdrop. The user must
 * explicitly click "Confirm" to proceed or "Cancel" to dismiss. Keyboard
 * support: Escape cancels; focus starts on Cancel so stray Enter does not
 * confirm a destructive action by default.
 *
 * The dialog is intentionally stark — destructive actions get a red accent
 * and a warning label so they feel different from safe clicks.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ConfirmationRequest } from '@/types/admin';

interface ConfirmDialogProps {
  confirmation: ConfirmationRequest;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}

export function ConfirmDialog({ confirmation, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(() => {
    onConfirm(confirmation.id);
  }, [confirmation.id, onConfirm]);

  const handleCancel = useCallback(() => {
    onCancel(confirmation.id);
  }, [confirmation.id, onCancel]);

  // Keyboard: Escape cancels. Focus the safe cancel action on mount so a stray
  // Enter keypress cannot confirm a destructive action by default.
  useEffect(() => {
    cancelRef.current?.focus();
  }, [confirmation.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCancel]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
        zIndex: 1000,
      }}
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--accent-red)44',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--accent-red)33',
          padding: 'var(--space-6)',
          maxWidth: '440px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Warning header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            className="mono"
            style={{
              color: 'var(--accent-red)',
              background: 'var(--accent-red-glow)',
              border: '1px solid var(--accent-red)44',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            ⚠ CONFIRM
          </span>
          <span
            id="confirm-dialog-title"
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {actionLabel(confirmation.action.type)}
          </span>
        </div>

        {/* Confirmation message */}
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {confirmation.message}
        </p>

        {/* Target model id (mono, for traceability) */}
        <div
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-dim)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-1)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-faint)',
          }}
        >
          target: {confirmation.action.modelId}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button
            className="admin-btn"
            ref={cancelRef}
            onClick={handleCancel}
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
            className="admin-btn"
            onClick={handleConfirm}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--bg-0)',
              background: 'var(--accent-red)',
              border: '1px solid var(--accent-red)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 0 12px var(--accent-red-glow)',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/** Human-readable action label for the dialog title. */
function actionLabel(type: string): string {
  switch (type) {
    case 'model.disable': return 'Disable Model';
    case 'model.delete': return 'Delete Model';
    case 'model.setDefault': return 'Change Default Model';
    case 'model.setFallback': return 'Change Fallback Model';
    case 'model.resetCredential': return 'Reset Credential';
    default: return 'Confirm Action';
  }
}