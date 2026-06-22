/**
 * SecretReveal — one-time secret display with copy button.
 *
 * Used when a key is created or regenerated: the raw secret is shown once,
 * with a prominent warning and a copy-to-clipboard button. After the user
 * dismisses it, the secret is gone forever (only the masked version remains
 * in the store).
 *
 * Security note: the `secret` prop comes from the ephemeral action result
 * (adminKeyMcpStore.state.lastResult.createdKey.secret), NOT from the
 * persistent store state. The store drops it after this component dismisses.
 */

import { useState } from 'react';

interface SecretRevealProps {
  /** The raw secret to show — comes from the ephemeral action result. */
  secret: string;
  /** Label describing what this secret is, e.g. "API key" or "MCP token". */
  label: string;
  /** Called when the user clicks "I've copied it" / dismisses. */
  onDismiss: () => void;
}

export function SecretReveal({ secret, label, onDismiss }: SecretRevealProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        padding: 'var(--space-4)',
        background: 'rgba(251, 191, 36, 0.06)',
        border: '1px solid var(--accent-amber)44',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--accent-amber)',
            boxShadow: '0 0 8px var(--accent-amber)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--accent-amber)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          One-time {label} display
        </span>
      </div>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-3)',
          lineHeight: 1.5,
        }}
      >
        Copy this secret now. It will never be shown again.
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <code
          className="mono"
          style={{
            flex: 1,
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-0)',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            wordBreak: 'break-all',
            userSelect: 'all',
          }}
        >
          {secret}
        </code>
        <button
          className="admin-btn"
          onClick={copy}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: copied ? 'var(--accent-green)' : 'var(--text-primary)',
            background: copied ? 'var(--accent-green-glow)' : 'var(--surface-base)',
            border: `1px solid ${copied ? 'var(--accent-green)' : 'var(--border-base)'}`,
            borderRadius: 'var(--radius-md)',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <button
        className="admin-btn"
        onClick={onDismiss}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: '1px solid var(--border-base)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        I've copied it — dismiss
      </button>
    </div>
  );
}