// ── OfficeModule — the complete embedded office module ──────────────────
//
// This is the integration point. It composes:
// - OfficeCanvas (PixiJS GameRuntime)
// - RoomTabs (zone navigation)
// - StatusBar (agent activity snippets)
// - Agent info panel (tap detail)
//
// It manages agent state via useOfficeStore and feeds board data to the
// FSMs. In demo mode, it uses scripted mock data. When connected to the
// dashboard backbone, it receives adapted data from adapter.ts.

import { useState, useCallback, useEffect, useRef } from 'react';
import { OfficeCanvas } from '@/office/components/OfficeCanvas';
import { OfficeErrorBoundary } from '@/office/components/OfficeErrorBoundary';
import { RoomTabs } from '@/office/components/RoomTabs';
import { StatusBar } from '@/office/components/StatusBar';
import { useOfficeStore } from '@/office/store';
import { DEMO_BOARD, DEMO_EVENT_SCRIPT } from '@/office/demoData';
import type { GameRuntime, GameRuntimeStats } from '@/office/engine/GameRuntime';
import type { AgentAssetError } from '@/office/entities/Agent';
import type { AgentState } from '@/office/engine/AgentStateMachine';
import type { ZoneDef } from '@/office/engine/iso';
import { AGENT_DESKS } from '@/office/engine/iso';
import { shellStore } from '@/state/shellStore';
import { onSessionConnectionEvent } from '@/state/sessionConnectionStore';
import { useBoardStoreSnapshot } from '@/state/boardStore';
import { adaptBoard } from '@/office/adapter';
import { getBrowserBackbone } from '@/state/backbone';

const AGENT_COLORS: Record<string, string> = {};
for (const desk of AGENT_DESKS) {
  AGENT_COLORS[desk.id] = '#' + desk.color.toString(16).padStart(6, '0');
}

function getTaskStatusText(status: string): string {
  switch (status) {
    case 'todo': return 'To Do';
    case 'in_progress': return 'In Progress';
    case 'blocked': return 'Blocked';
    case 'review': return 'In Review';
    case 'done': return 'Done';
    default: return status;
  }
}

/** Agent info panel — shows details when an agent is selected. */
function AgentInfoPanel({
  agent,
  onClose,
}: {
  agent: AgentState;
  onClose: () => void;
}) {
  const color = AGENT_COLORS[agent.agentId] ?? '#888888';

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 300,
        zIndex: 40,
        background: 'rgba(11, 17, 26, 0.98)',
        borderLeft: '1px solid var(--border-base)',
        padding: 20,
        overflowY: 'auto',
        animation: 'slideInRight var(--dur-panel) var(--ease-out)',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'var(--surface-base)',
          color: 'var(--text-muted)',
          fontSize: 18,
          minHeight: 44,
          minWidth: 44,
        }}
        aria-label="Close panel"
      >
        ×
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span
          style={{
            display: 'inline-block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: color,
          }}
        />
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {agent.name}
        </h2>
      </div>

      <dl style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 'var(--text-sm)' }}>
        <div>
          <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Activity
          </dt>
          <dd style={{ color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
            {agent.activity}
          </dd>
        </div>

        {agent.task && (
          <>
            <div>
              <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Task
              </dt>
              <dd style={{ color: 'var(--text-primary)' }}>{agent.task.title}</dd>
            </div>
            <div>
              <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Status
              </dt>
              <dd style={{ color: 'var(--text-primary)' }}>{getTaskStatusText(agent.task.status)}</dd>
            </div>
          </>
        )}

        <div>
          <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Location
          </dt>
          <dd style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
            {agent.zone.replace('_', ' ')}
          </dd>
        </div>

        <div>
          <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Agent ID
          </dt>
          <dd className="mono" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-xs)' }}>
            {agent.agentId}
          </dd>
        </div>

        {agent.task && (
          <div>
            <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              Task ID
            </dt>
            <dd className="mono" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
              {agent.task.id}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export interface OfficeModuleProps {
  /** When true, runs in demo mode with scripted mock data. */
  demoMode?: boolean;
}

export function OfficeModule({ demoMode = false }: OfficeModuleProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [runtimeStats, setRuntimeStats] = useState<GameRuntimeStats | null>(null);
  // Sora stability audit #4 / R12: collect spritesheet load failures so the
  // dashboard can show a subtle indicator instead of agents that look frozen.
  const [assetErrors, setAssetErrors] = useState<AgentAssetError[]>([]);
  const runtimeRef = useRef<GameRuntime | null>(null);

  const { agents, initAgents, applySnapshot, applyEvent, destroy, setDemoMode } = useOfficeStore();

  // Initialize agent FSMs once.
  useEffect(() => {
    initAgents();
    return () => destroy();
  }, [initAgents, destroy]);

  // Phase 2 fix: bridge store FSM zone changes to the visual GameRuntime so
  // the living scene reflects who is working/blocked/idle. The store FSMs
  // derive a target zone from board task status; we track the previous zone
  // per agent and route changes to runtime.syncAgentZone, which drives the
  // visual AgentController movement. This is the "movement" deliverable from
  // docs/work-split.md Phase 2 Verify.
  const prevZonesRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!runtimeRef.current) return;
    const prev = prevZonesRef.current;
    for (const [id, state] of agents) {
      const prevZone = prev.get(id);
      if (prevZone !== state.zone) {
        runtimeRef.current.syncAgentZone(id, state.zone);
        prev.set(id, state.zone);
      }
    }
  }, [agents]);

  // Feed demo or live data to the FSMs.
  useEffect(() => {
    if (demoMode) {
      setDemoMode(true);
      // Apply the static demo board immediately.
      applySnapshot(DEMO_BOARD);

      // Start the scripted event stream.
      const timers: ReturnType<typeof setTimeout>[] = [];
      let cumulativeDelay = 0;
      for (const entry of DEMO_EVENT_SCRIPT) {
        cumulativeDelay += entry.delay;
        const t = setTimeout(() => {
          applyEvent(entry.event);
        }, cumulativeDelay);
        timers.push(t);
      }

      // Loop: reset and replay the script after the last event.
      const loopTimer = setInterval(() => {
        applySnapshot(DEMO_BOARD);
      }, cumulativeDelay + 5000);
      timers.push(loopTimer as unknown as ReturnType<typeof setTimeout>);

      return () => {
        timers.forEach(clearTimeout);
        setDemoMode(false);
      };
    }
    // In non-demo mode, the dashboard's board data layer (when connected)
    // will call applySnapshot / applyEvent via adapter.ts.
  }, [demoMode, applySnapshot, applyEvent, setDemoMode]);

  // Sora stability audit #5: subscribe to the live board store and push
  // adapted snapshots into the office FSMs. This bridges the dashboard's
  // canonical board state to the office's internal Board shape so agents
  // reflect who is working/blocked/idle in real time. In demo mode this
  // subscription is skipped (the demo effect above feeds scripted data).
  const boardSnapshot = useBoardStoreSnapshot();
  useEffect(() => {
    if (demoMode) return;
    const rawBoard = boardSnapshot.board.value;
    if (!rawBoard) return;
    applySnapshot(adaptBoard(rawBoard));
  }, [boardSnapshot.board, demoMode, applySnapshot]);

  // Phase 3 / Sora stability audit #6 / R10: reconnect catch-up animation.
  // When the Kanban WS transitions to 'connected' after a drop, the board
  // snapshot is re-fetched (by the backbone syncOnce) and agent target zones
  // may have changed while we were disconnected. Instead of snap-teleporting
  // agents to their new zone positions, we trigger a 1-second ease-out lerp
  // from each agent's current visual grid position to its new zone center.
  // The GameRuntime.catchUpAllAgents method handles the per-agent distance
  // gate (agents already at their target are left alone).
  useEffect(() => {
    if (demoMode) return;
    const unsub = onSessionConnectionEvent((event) => {
      if (
        event.type === 'connection.changed' &&
        event.sourceId === 'kanban-ws' &&
        event.toState === 'connected'
      ) {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        // Build a per-agent zone map from the current office store state.
        // The store FSMs have already been updated by applySnapshot by the
        // time the connection.changed event fires (the backbone re-fetches
        // the board before marking the WS as connected).
        const agentZones = new Map<string, string>();
        for (const [id, state] of useOfficeStore.getState().agents) {
          agentZones.set(id, state.zone);
        }
        runtime.catchUpAllAgents(agentZones);
      }
    });
    return unsub;
  }, [demoMode]);

  const handleSelectAgent = useCallback((id: string | null) => {
    setSelectedAgentId(id);
  }, []);

  const handleFocusZone = useCallback((zone: ZoneDef | null) => {
    setActiveZoneId(zone?.id ?? null);
    runtimeRef.current?.focusZone(zone?.id ?? null);
  }, []);

  const handleReady = useCallback((runtime: GameRuntime) => {
    runtimeRef.current = runtime;
    setRuntimeStats(runtime.stats);
  }, []);

  const handleStats = useCallback((stats: GameRuntimeStats) => {
    setRuntimeStats(stats);
    // Phase 2 shared-state fix: surface live office FPS to the shell so the
    // MissionBar indicator activates. The stats callback fires at most once
    // per second (see OfficeCanvas telemetry effect), matching the
    // throttling recommendation in docs/motion-and-fps-report.md.
    shellStore.setFps(stats.fps);
  }, []);

  // Sora stability audit #4 / R12: collect spritesheet load failures. Each
  // failure appends to the list; the StatusBar shows a subtle amber indicator
  // when there are any. Dedup by agent+animType so repeated retries don't
  // spam the indicator.
  const handleAssetError = useCallback((info: AgentAssetError) => {
    setAssetErrors((prev) => {
      const key = `${info.agentId}:${info.animType}`;
      if (prev.some((e) => `${e.agentId}:${e.animType}` === key)) return prev;
      return [...prev, info];
    });
  }, []);

  // Sora stability audit #5: when the document becomes visible again after
  // being hidden, re-sync the board so the office doesn't render stale agent
  // state. In demo mode this re-applies the demo snapshot; in live mode it
  // triggers a backbone syncOnce() which re-fetches the board into boardStore
  // (the subscription above then pushes it into the office FSMs).
  const handleResume = useCallback(() => {
    if (demoMode) {
      applySnapshot(DEMO_BOARD);
      return;
    }
    // Re-fetch the board snapshot from the dashboard. The boardStore
    // subscription effect above will pick up the updated data and push
    // it into the office FSMs.
    try {
      void getBrowserBackbone()?.syncOnce();
    } catch {
      // Backbone may not be started yet (e.g. during tests). The boardStore
      // subscription will still pick up the next live update.
    }
  }, [demoMode, applySnapshot]);

  const selectedAgent = selectedAgentId ? agents.get(selectedAgentId) : null;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Room navigation tabs */}
      <div
        style={{
          flexShrink: 0,
          background: 'rgba(8, 11, 18, 0.94)',
          borderBottom: '1px solid var(--border-faint)',
        }}
      >
        <RoomTabs onFocusZone={handleFocusZone} activeZone={activeZoneId} />
      </div>

      {/* Pixi canvas + overlays — wrapped in error boundary so a Pixi
          init failure (no WebGL, atlas 404, GPU crash) degrades to a
          graceful fallback card instead of crashing the whole app. */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <OfficeErrorBoundary>
          <OfficeCanvas
            onSelectAgent={handleSelectAgent}
            onFocusZone={handleFocusZone}
            onReady={handleReady}
            onStats={handleStats}
            onAssetError={handleAssetError}
            onResume={handleResume}
          />
        </OfficeErrorBoundary>

        {/* Agent info panel */}
        {selectedAgent && (
          <AgentInfoPanel
            agent={selectedAgent}
            onClose={() => setSelectedAgentId(null)}
          />
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          flexShrink: 0,
          background: 'rgba(8, 11, 18, 0.96)',
          borderTop: '1px solid var(--border-faint)',
        }}
      >
        <StatusBar agents={agents} runtimeStats={runtimeStats} assetErrors={assetErrors} />
      </div>
    </div>
  );
}