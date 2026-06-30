/**
 * DecisionsPage — Decision/escalation records dashboard.
 *
 * Surfaces decision threads, escalation items, and action items extracted
 * from conversations. NOT a casual chat UI — this is a structured decision
 * archive with terminal-style log formatting. Visually distinct from
 * FloatingChatOverlay (which is a real-time messaging panel).
 *
 * Since there is no backend for decision records, this page surfaces
 * honest 'missing' freshness unavailable state.
 */

export function DecisionsPage() {
  // No backend — always render unavailable state
  return (
    <section className="dashboard-main-frame decisions-page">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-title-group">
          <div className="dashboard-placeholder-eyebrow mono">DECISION LOG</div>
          <h2 className="dashboard-header-title" style={{ fontSize: '20px' }}>Decisions</h2>
        </div>
        <span className="freshness-badge freshness-badge--unavailable mono">unavailable</span>
      </div>

      {/* Filter bar — disabled */}
      <div className="decisions-filter-bar mono">
        <span className="text-dim">[All Threads {'\u25BE'}]</span>
        <span className="text-dim">[All Agents {'\u25BE'}]</span>
        <span className="text-dim">[Last 7d {'\u25BE'}]</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>{'\u27F3'} refresh</span>
      </div>

      {/* Unavailable state — terminal-panel style, distinct from chat overlay */}
      <div className="decisions-empty-state">
        <div className="decisions-empty-panel">
          <span className="mono" style={{ color: 'var(--crt-amber)' }}>
            {'\u26A0'}  Decision data unavailable
          </span>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '12px' }}>
            The decision-records source is not connected.
            Check your connection to the Hermes runtime or admin proxy.
          </p>
          <p className="mono text-dim" style={{ marginTop: '8px' }}>
            Source: dashboard-api {'\u2502'} Status: offline
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)', marginTop: '16px', maxWidth: '420px', textAlign: 'center' }}>
            When connected, this screen will surface escalation items,
            decision threads, and action items extracted from conversations —
            rendered as a structured decision archive, not a casual chat UI.
          </p>
        </div>
      </div>

      {/* Status bar */}
      <footer className="decisions-status-bar mono">
        <span>{'\u27D0'} -- decisions {'\u2502'} system: OFFLINE {'\u2502'} {new Date().toISOString().slice(11, 16)} UTC</span>
      </footer>
    </section>
  );
}
