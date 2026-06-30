/**
 * ConductorStation — Sora's raised central station React overlay.
 *
 * Renders above the PixiJS canvas as a DOM overlay. Dual-pane layout:
 *   Left:  Dispatch log — live-scrolling event feed (5 most recent)
 *   Right: System state — truth label, agent counts, uptime
 *
 * Phase B: Positioned absolutely at the conductor station's screen location.
 * In the initial implementation, defaults to center of viewport. Will be
 * synced with the isometric grid-to-screen transform via a future camera
 * callback from GameRuntime.
 *
 * Uses restrained guild styling — amber accents, JetBrains Mono typography,
 * warm platinum tab header. The station is purely a read-only display.
 */

import { useMemo } from 'react';
import { useOfficeStore } from '@/office/store';
import { AGENT_DESKS } from '@/office/engine/iso';
import { PortraitImage } from '@/components/common/PortraitImage';

/** Dispatch log entry shape. */
interface DispatchEntry {
  time: string;
  agent: string;
  color: string;
  event: string;
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' });
}

function getAgentColorHex(agentId: string): string {
  const desk = AGENT_DESKS.find((d) => d.id === agentId);
  if (desk) return '#' + desk.color.toString(16).padStart(6, '0');
  // Fallback colors
  const fallbacks: Record<string, string> = {
    sora: '#f0e8d8',
    rain: '#00ccff',
    cloud: '#4488ff',
    biscuit: '#ffb000',
    korra: '#ff4499',
    lelouch: '#9944ff',
    tifa: '#00ff66',
  };
  return fallbacks[agentId] ?? '#888888';
}

function getAgentName(agentId: string): string {
  const desk = AGENT_DESKS.find((d) => d.id === agentId);
  if (desk) return desk.name;
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

export function ConductorStation() {
  const { agents } = useOfficeStore();

  // Build dispatch log from agent states — if no live data, show unknown state.
  const dispatchLog: DispatchEntry[] = useMemo(() => {
    const entries: DispatchEntry[] = [];

    for (const [id, state] of agents) {
      if (state.task) {
        const eventDesc = state.activity === 'blocked'
          ? `blocked — needs help`
          : state.activity === 'working'
            ? `working on "${state.task.title.slice(0, 28)}${state.task.title.length > 28 ? '…' : ''}"`
            : state.activity === 'reviewing'
              ? `review requested`
              : state.activity === 'celebrating'
                ? `completed task`
                : `idle`;
        entries.push({
          time: formatTime(),
          agent: getAgentName(id),
          color: getAgentColorHex(id),
          event: eventDesc,
        });
      }
    }

    // If no agent has a task, avoid implying a healthy empty state.
    if (entries.length === 0) {
      entries.push({
        time: formatTime(),
        agent: 'SYSTEM',
        color: '#f0e8d8',
        event: 'unknown — no verified dispatch activity',
      });
    }

    // Sort by time (could be improved with real timestamps) — latest first
    return entries.slice(-5).reverse();
  }, [agents]);

  // Agent online count
  const onlineCount = useMemo(() => {
    let count = 0;
    for (const [, state] of agents) {
      if (state.activity !== 'idle' || state.task) count++;
    }
    if (agents.size === 0) return 'unknown';
    return `${count}/${agents.size + 1}`; // +1 for Sora
  }, [agents]);

  // System health derivation
  const systemHealth = useMemo(() => {
    if (agents.size === 0) return { status: 'unavailable', color: '#ff4444' };
    let blocked = 0;
    for (const [, state] of agents) {
      if (state.activity === 'blocked') blocked++;
    }
    if (blocked > 1) return { status: 'degraded', color: '#ffb000' };
    return { status: 'verified', color: '#00ff41' };
  }, [agents]);

  const activeDelegations = useMemo(() => {
    // Count agents with review tasks (delegation gate)
    let count = 0;
    for (const [, state] of agents) {
      if (state.activity === 'reviewing') count++;
    }
    return count;
  }, [agents]);

  return (
    <div
      data-conductor-station="overlay"
      style={{
        position: 'absolute',
        // Center of viewport — will be tied to grid-to-screen transform later
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 30,
        pointerEvents: 'none',
        // The station itself is non-interactive (read-only for Phase B)
      }}
    >
      <div
        style={{
          width: 420,
          background: 'rgba(11, 17, 26, 0.96)',
          border: '1px solid var(--border-base, #2a3040)',
          borderRadius: 'var(--radius-lg, 8px)',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'none',
        }}
      >
        {/* Tab header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            borderBottom: '2px solid rgba(240, 232, 216, 0.35)',
            background: 'rgba(240, 232, 216, 0.03)',
          }}
        >
          {/* Sora portrait — 24x24 circle */}
          <PortraitImage
            agentId="sora"
            size={24}
            style={{
              borderColor: 'rgba(240, 232, 216, 0.4)',
              background: 'rgba(240, 232, 216, 0.2)',
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#f0e8d8',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            SORA · CONDUCTOR
          </span>
        </div>

        {/* Dual-pane body */}
        <div style={{ display: 'flex', minHeight: 140 }}>
          {/* Left pane: Dispatch Log */}
          <div
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRight: '1px solid var(--border-faint, rgba(42, 48, 64, 0.3))',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(212, 148, 58, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              DISPATCH
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                maxHeight: 100,
                overflow: 'hidden',
              }}
            >
              {dispatchLog.map((entry, i) => (
                <div
                  key={i}
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    lineHeight: '1.4',
                    display: 'flex',
                    gap: 6,
                    opacity: i === 0 ? 1 : 0.6 + (4 - i) * 0.1,
                  }}
                >
                  <span style={{ color: 'var(--text-dim, #6b7280)', flexShrink: 0 }}>
                    {entry.time}
                  </span>
                  <span style={{ color: entry.color, fontWeight: 500, flexShrink: 0 }}>
                    {entry.agent}:
                  </span>
                  <span style={{ color: 'var(--text-muted, #9ca3af)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.event}
                  </span>
                </div>
              ))}
              {/* Gradient fade at top if more entries above */}
              {dispatchLog.length >= 5 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 28,
                    left: 10,
                    right: 10,
                    height: 16,
                    background: 'linear-gradient(to bottom, rgba(11, 17, 26, 0.96), transparent)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          </div>

          {/* Right pane: System state */}
          <div style={{ flex: 0.85, padding: '8px 10px', position: 'relative' }}>
            {/* Guild insignia watermark */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 48,
                color: 'rgba(240, 232, 216, 0.03)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              ⏣
            </div>

            <div
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(212, 148, 58, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              SYSTEM
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 10,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* System truth label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: systemHealth.color, fontWeight: 500 }}>
                  {systemHealth.status}
                </span>
              </div>

              {/* Agent status */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim, #6b7280)' }}>AGENTS</span>
                <span style={{ color: 'var(--text-primary, #e6edf3)' }}>{onlineCount} ACTIVE</span>
              </div>

              {/* Active delegations */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim, #6b7280)' }}>DELEGATIONS</span>
                <span style={{ color: 'var(--text-primary, #e6edf3)' }}>
                  {activeDelegations} ACTIVE
                </span>
              </div>

              {/* Uptime */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim, #6b7280)' }}>UPTIME</span>
                <span style={{ color: 'var(--text-muted, #9ca3af)', fontSize: 9 }}>
                  {formatTime()} UTC
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
