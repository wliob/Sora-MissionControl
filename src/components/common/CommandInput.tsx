/**
 * CommandInput — command-bar style input for the chat command surface.
 * Focused, keyboard-friendly, quiet active state.
 */

import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface CommandInputProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Accent color for the focused state — matches the selected agent */
  accent?: string;
  /**
   * Optional controlled value. When provided (with `onChange`), the input is
   * controlled by the parent so draft state can live in an external store and
   * rehydrate on context switches. When omitted, the input is uncontrolled.
   */
  value?: string;
  /** Required when `value` is provided; mirrors the draft into the store. */
  onChange?: (text: string) => void;
}

export function CommandInput({
  onSubmit,
  placeholder = 'Issue a directive…',
  disabled = false,
  accent = 'var(--accent-cyan)',
  value,
  onChange,
}: CommandInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const [focused, setFocused] = useState(false);
  const isControlled = value !== undefined;
  const current = isControlled ? (value as string) : internalValue;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = current.trim();
    if (!text || disabled) return;
    onSubmit(text);
    if (!isControlled) setInternalValue('');
    else onChange?.('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Esc blurs; Enter handled by form submit
    if (e.key === 'Escape') {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        background: 'var(--bg-1)',
        borderTop: '1px solid var(--border-faint)',
        transition: `border-color var(--dur-micro) var(--ease-out)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--bg-0)',
          border: `1px solid ${focused ? accent : 'var(--border-base)'}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: focused ? `0 0 0 1px ${accent}33, 0 0 10px ${accent}22` : 'none',
          transition: `border-color var(--dur-micro) var(--ease-out), box-shadow var(--dur-micro) var(--ease-out)`,
        }}
      >
        <span
          className="mono"
          style={{
            color: accent,
            fontSize: 'var(--text-sm)',
            opacity: focused ? 1 : 0.5,
            transition: 'opacity var(--dur-micro)',
            flexShrink: 0,
          }}
        >
          ›
        </span>
        <input
          type="text"
          value={current}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => (isControlled ? onChange?.(e.target.value) : setInternalValue(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-base)',
            fontFamily: 'var(--font-ui)',
            border: 'none',
            outline: 'none',
            minWidth: 0,
          }}
        />
        <kbd
          className="mono"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-dim)',
            padding: '1px 5px',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-2)',
            flexShrink: 0,
          }}
        >
          ↵
        </kbd>
      </div>
      <button
        type="submit"
        disabled={disabled || !current.trim()}
        style={{
          padding: 'var(--space-2) var(--space-3)',
          background: current.trim() ? accent : 'var(--surface-base)',
          color: current.trim() ? 'var(--bg-0)' : 'var(--text-dim)',
          border: `1px solid ${current.trim() ? accent : 'var(--border-base)'}`,
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          transition: 'background-color var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out), border-color var(--dur-micro) var(--ease-out)',
          opacity: disabled ? 0.4 : 1,
          cursor: disabled || !current.trim() ? 'default' : 'pointer',
        }}
      >
        Dispatch
      </button>
    </form>
  );
}