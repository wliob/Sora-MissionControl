import { useState, type FormEvent } from 'react';
import {
  adminSecureTransportGuidance,
  clearMissionControlAdminProxyToken,
  getMissionControlAdminProxyAuthState,
  isAdminSecureTransportError,
  isHttpLockedAdminOrigin,
  setMissionControlAdminProxyToken,
} from '@/services/hermes/adminProxyAdapter';
import { useKeyMcpAdminState } from '@/state/adminKeyMcpStore';
import { useCwsAdminState } from '@/state/cwsAdminStore';

function isUnauthorizedError(message: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('unauthorized') || normalized.includes('401');
}

function isSecureTransportError(message: string | null): boolean {
  return Boolean(message && isAdminSecureTransportError(message));
}

export function AdminProxyAuthControl() {
  const [tokenInput, setTokenInput] = useState('');
  const [authState, setAuthState] = useState(getMissionControlAdminProxyAuthState);
  const keyMcpState = useKeyMcpAdminState();
  const cwsState = useCwsAdminState();
  const proxyUnauthorized = isUnauthorizedError(keyMcpState.lastError) || isUnauthorizedError(cwsState.lastError);
  const secureTransportRequired =
    isHttpLockedAdminOrigin() ||
    isSecureTransportError(keyMcpState.lastError) ||
    isSecureTransportError(cwsState.lastError);

  function refreshAuthState() {
    setAuthState(getMissionControlAdminProxyAuthState());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const token = String(formData.get('adminProxyToken') ?? '');
    setMissionControlAdminProxyToken(token);
    setTokenInput('');
    event.currentTarget.reset();
    refreshAuthState();
  }

  function handleClear() {
    clearMissionControlAdminProxyToken();
    setTokenInput('');
    refreshAuthState();
  }

  const statusText = authState.hasToken
    ? 'Session token staged for this tab only'
    : 'No admin proxy token configured';

  if (secureTransportRequired) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-faint)',
          background: 'var(--bg-1)',
          color: 'var(--status-warning)',
          flexShrink: 0,
        }}
      >
        <span className="mono" style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
          Secure transport required
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {adminSecureTransportGuidance()}
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--border-faint)',
        background: 'var(--bg-1)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <label
        className="mono"
        htmlFor="admin-proxy-token"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Systems proxy token
      </label>
      <input
        id="admin-proxy-token"
        name="adminProxyToken"
        type="password"
        autoComplete="off"
        value={tokenInput}
        onChange={(event) => setTokenInput(event.currentTarget.value)}
        placeholder="Required only when the systems proxy requires operator auth"
        style={{
          width: 'min(360px, 100%)',
          minWidth: '220px',
          padding: 'var(--space-2) var(--space-3)',
          color: 'var(--text-primary)',
          background: 'var(--bg-0)',
          border: '1px solid var(--border-base)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
        }}
      />
      <button
        type="submit"
        className="admin-btn"
        style={{
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          color: 'var(--accent-cyan)',
          background: 'var(--accent-cyan-glow)',
          border: '1px solid var(--accent-cyan)44',
          borderRadius: 'var(--radius-md)',
        }}
      >
        Stage token
      </button>
      <button
        type="button"
        className="admin-btn"
        onClick={handleClear}
        disabled={!authState.hasToken && tokenInput.length === 0}
        style={{
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid var(--border-base)',
          borderRadius: 'var(--radius-md)',
          opacity: !authState.hasToken && tokenInput.length === 0 ? 0.55 : 1,
        }}
      >
        Clear staged token
      </button>
      <span
        className="mono"
        style={{
          fontSize: 'var(--text-xs)',
          color: authState.hasToken ? 'var(--accent-green)' : 'var(--text-dim)',
        }}
      >
        {statusText}
      </span>
      {proxyUnauthorized && (
        <span
          role="status"
          className="mono"
          style={{
            flexBasis: '100%',
            fontSize: 'var(--text-xs)',
            color: 'var(--status-warning)',
          }}
        >
          Systems proxy authorization required. Stage the current operator token for this tab and retry the admin request.
        </span>
      )}
    </form>
  );
}
