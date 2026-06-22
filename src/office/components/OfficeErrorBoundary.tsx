// ── OfficeErrorBoundary — prevents Pixi canvas failures from crashing the app ─
//
// Wraps OfficeCanvas so that if PixiJS init throws synchronously during
// render (no WebGL context, atlas 404, GPU crash), the error is caught by
// the boundary instead of propagating to the root and unmounting the
// entire MissionControl shell.
//
// The fallback is a graceful "office unavailable" card with a retry
// button that remounts the canvas subtree.

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface OfficeErrorBoundaryProps {
  children: ReactNode;
  /** Optional callback fired when an error is caught. Useful for logging. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

export interface OfficeErrorBoundaryState {
  error: Error | null;
  /** Incremented on each retry to force child remount. */
  retryKey: number;
}

export class OfficeErrorBoundary extends Component<
  OfficeErrorBoundaryProps,
  OfficeErrorBoundaryState
> {
  constructor(props: OfficeErrorBoundaryProps) {
    super(props);
    this.state = { error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<OfficeErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('OfficeErrorBoundary caught:', error, info);
    this.props.onError?.(error, info);
  }

  handleRetry = (): void => {
    this.setState({ error: null, retryKey: this.state.retryKey + 1 });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          aria-label="Office canvas unavailable"
          data-office-error-boundary="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-0)',
            zIndex: 50,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '40px 32px',
              maxWidth: 400,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-2)',
              border: '1px solid var(--border-active)',
            }}
          >
            <div
              className="mission-glyph"
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-xl)',
                margin: '0 auto 16px',
                opacity: 0.9,
              }}
            />
            <h2
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              Office unavailable
            </h2>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              The 3D office canvas encountered an error and has been safely disabled.
              The rest of Mission Control is unaffected. Retry to re-initialise the
              canvas.
            </p>
            <p
              className="mono"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-red)',
                marginBottom: 24,
                padding: '8px 12px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-red-glow)',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message || 'Unknown error'}
            </p>
            <button
              onClick={this.handleRetry}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-xl)',
                fontWeight: 500,
                fontSize: 'var(--text-sm)',
                background: 'var(--accent-cyan)',
                color: 'var(--bg-0)',
                minHeight: 44,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Retry canvas
            </button>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}