/**
 * ConfirmDialog — modal confirmation for destructive/risky admin actions.
 * Renders above all content with a backdrop, requires an explicit click
 * on Confirm or Cancel. Never auto-confirms.
 */

import { useEffect, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Detailed context shown below the message. */
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, confirm button uses danger styling (red). */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '440px',
          maxWidth: '90vw',
          background: 'var(--bg-2)',
          border: `1px solid ${danger ? 'var(--accent-red)44' : 'var(--border-active)'}`,
          borderRadius: 'var(--radius-lg)',
          boxShadow: danger
            ? '0 0 0 1px var(--accent-red)22, 0 8px 32px rgba(0,0,0,0.5)'
            : '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
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
              background: danger ? 'var(--accent-red)' : 'var(--accent-amber)',
              boxShadow: `0 0 8px ${danger ? 'var(--accent-red)' : 'var(--accent-amber)'}`,
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
        </header>
        <div style={{ padding: 'var(--space-5)' }}>
          <p
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: detail ? 'var(--space-3)' : 0,
            }}
          >
            {message}
          </p>
          {detail && (
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                padding: 'var(--space-3)',
                background: 'var(--bg-1)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-faint)',
              }}
            >
              {detail}
            </div>
          )}
        </div>
        <footer
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-5) var(--space-5)',
          }}
        >
          <button
            className="admin-btn"
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
            {cancelLabel}
          </button>
          <button
            className="admin-btn"
            onClick={onConfirm}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: danger ? 'var(--bg-0)' : 'var(--text-primary)',
              background: danger ? 'var(--accent-red)' : 'var(--accent-cyan)',
              border: `1px solid ${danger ? 'var(--accent-red)' : 'var(--accent-cyan)'}`,
              borderRadius: 'var(--radius-md)',
              boxShadow: danger
                ? '0 0 12px var(--accent-red-glow)'
                : '0 0 12px var(--accent-cyan-glow)',
            }}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
