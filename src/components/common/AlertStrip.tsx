/**
 * AlertStrip — quiet threshold-band alert display for the live ops panel.
 * Compact, no marketing KPI styling. Risk-first.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'unknown';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  source: string;
  message: string;
  freshness?: string;
}

interface AlertStripProps {
  alerts: AlertItem[];
  onAcknowledge?: (id: string) => void;
}

const SEVERITY_META: Record<AlertSeverity, { color: string; bg: string; label: string }> = {
  critical: { color: 'var(--accent-red)', bg: 'var(--accent-red-glow)', label: 'CRIT' },
  warning: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-glow)', label: 'WARN' },
  info: { color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-glow)', label: 'INFO' },
  unknown: { color: 'var(--text-muted)', bg: 'var(--status-unknown-bg)', label: '—' },
};

export function AlertStrip({ alerts, onAcknowledge }: AlertStripProps) {
  if (alerts.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-4)',
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 'var(--text-sm)',
          fontStyle: 'italic',
        }}
      >
        No alert events currently reported.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {alerts.map((alert) => {
        const meta = SEVERITY_META[alert.severity];
        return (
          <div
            key={alert.id}
            className="row-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              borderBottom: '1px solid var(--border-faint)',
            }}
          >
            <span
              className="mono"
              style={{
                color: meta.color,
                background: meta.bg,
                border: `1px solid ${meta.color}44`,
                padding: '1px 5px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              {meta.label}
            </span>
            <span
              className="mono"
              style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--text-xs)',
                flexShrink: 0,
                minWidth: '64px',
              }}
            >
              {alert.source}
            </span>
            <span
              style={{
                flex: 1,
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {alert.message}
            </span>
            {alert.freshness && (
              <span
                className="mono"
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 'var(--text-xs)',
                  flexShrink: 0,
                }}
              >
                {alert.freshness}
              </span>
            )}
            {onAcknowledge && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="ack-btn"
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  flexShrink: 0,
                }}
              >
                ack
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { AlertItem };
export type { AlertStripProps as AlertStripPropsType };