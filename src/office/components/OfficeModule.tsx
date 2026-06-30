// ── OfficeModule — the complete embedded office module ──────────────────
//
// This is the integration point. It composes:
// - OfficeCanvas (PixiJS GameRuntime)
// - RoomTabs (zone navigation)
// - StatusBar (agent activity snippets)
// - Agent info panel (tap detail)
//
// Phase B additions:
// - Pop-out button + full-screen toggle in RoomTabs bar
// - Pop-out mode awareness (read-only contract)
// - ConductorStation React overlay positioned over canvas
//
// It manages agent state via useOfficeStore and feeds board data to the
// FSMs. In demo mode, it uses scripted mock data. When connected to the
// dashboard backbone, it receives adapted data from adapter.ts.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { OfficeCanvas } from '@/office/components/OfficeCanvas';
import { OfficeErrorBoundary } from '@/office/components/OfficeErrorBoundary';
import { RoomTabs } from '@/office/components/RoomTabs';
import { StatusBar } from '@/office/components/StatusBar';
import { PopOutButton } from '@/office/components/PopOutButton';
import { useOfficeStore } from '@/office/store';
import { DEMO_BOARD, DEMO_EVENT_SCRIPT } from '@/office/demoData';
import type { GameRuntime, GameRuntimeStats } from '@/office/engine/GameRuntime';
import type { AgentAssetError } from '@/office/entities/Agent';
import type { AgentState } from '@/office/engine/AgentStateMachine';
import type { ZoneDef } from '@/office/engine/iso';
import { AGENT_DESKS } from '@/office/engine/iso';
import { shellStore, useShellState } from '@/state/shellStore';
import { onSessionConnectionEvent } from '@/state/sessionConnectionStore';
import { useBoardStoreSnapshot } from '@/state/boardStore';
import { adaptBoard } from '@/office/adapter';
import { getBrowserBackbone } from '@/state/backbone';
import { canSend } from '@/modules/chat/chatStore';
import { useAttentionItems } from '@/hooks/useAttentionItems';
import { isAgentId } from '@/types';
import type { KanbanTaskCard, KanbanStatus } from '@/types/board';

const AGENT_COLORS: Record<string, string> = {};
for (const desk of AGENT_DESKS) {
  AGENT_COLORS[desk.id] = '#' + desk.color.toString(16).padStart(6, '0');
}

const CURRENT_WORK_PRIORITY: Record<KanbanStatus, number> = {
  running: 0,
  blocked: 1,
  review: 2,
  ready: 3,
  scheduled: 4,
  todo: 5,
  triage: 6,
  done: 7,
};

function flattenBoardTasks(board: ReturnType<typeof useBoardStoreSnapshot>['board']['value']): KanbanTaskCard[] {
  if (!board) return [];
  return board.columns.flatMap((column) => column.tasks);
}

function compareCurrentWork(a: KanbanTaskCard, b: KanbanTaskCard): number {
  const statusDelta = CURRENT_WORK_PRIORITY[a.status] - CURRENT_WORK_PRIORITY[b.status];
  if (statusDelta !== 0) return statusDelta;
  return b.priority - a.priority;
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

function navigateToPath(path: string): void {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Agent info panel — shows details when an agent is selected. */
function AgentInfoPanel({
  agent,
  onClose,
  onViewCurrentWork,
  currentWorkEnabled,
  currentWorkNote,
  onOpenChat,
  chatEnabled,
  chatLabel,
  chatNote,
  popoutMode,
}: {
  agent: AgentState;
  onClose: () => void;
  onViewCurrentWork: () => void;
  currentWorkEnabled: boolean;
  currentWorkNote: string | null;
  onOpenChat: () => void;
  chatEnabled: boolean;
  chatLabel: string;
  chatNote: string | null;
  popoutMode?: boolean;
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

      {/* Action buttons — hidden in pop-out mode (read-only contract) */}
      {!popoutMode && (
        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <button
            type="button"
            data-office-current-work-button
            disabled={!currentWorkEnabled}
            className="admin-btn"
            onClick={onViewCurrentWork}
            style={{
              minHeight: 44,
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-faint)',
              borderRadius: 'var(--radius-sm)',
              background: currentWorkEnabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              color: currentWorkEnabled ? 'var(--text-primary)' : 'var(--text-dim)',
              cursor: currentWorkEnabled ? 'pointer' : 'not-allowed',
              opacity: currentWorkEnabled ? 1 : 0.6,
            }}
          >
            View current work
          </button>
          <button
            type="button"
            data-office-open-chat-button
            disabled={!chatEnabled}
            className="admin-btn"
            onClick={onOpenChat}
            style={{
              minHeight: 44,
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-faint)',
              borderRadius: 'var(--radius-sm)',
              background: chatEnabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              color: chatEnabled ? 'var(--text-primary)' : 'var(--text-dim)',
              cursor: chatEnabled ? 'pointer' : 'not-allowed',
              opacity: chatEnabled ? 1 : 0.6,
            }}
          >
            {chatLabel}
          </button>
          {currentWorkNote && (
            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
              {currentWorkNote}
            </div>
          )}
          {chatNote && (
            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
              {chatNote}
            </div>
          )}
        </div>
      )}

      {popoutMode && (
        <div style={{ marginTop: 24, padding: '12px 0', borderTop: '1px solid var(--border-faint)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)', lineHeight: 1.5, fontStyle: 'italic' }}>
            Pop-out mode — read only. Commands are unavailable in this view.
          </p>
        </div>
      )}
    </div>
  );
}

export interface OfficeModuleProps {
  /** When true, runs in demo mode with scripted mock data. */
  demoMode?: boolean;
  /** When true, the office is in pop-out read-only mode (no commands, no nav). */
  popoutMode?: boolean;
}

export function OfficeModule({ demoMode = false, popoutMode = false }: OfficeModuleProps) {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [runtimeStats, setRuntimeStats] = useState<GameRuntimeStats | null>(null);
  // Sora stability audit #4 / R12: collect spritesheet load failures.
  const [assetErrors, setAssetErrors] = useState<AgentAssetError[]>([]);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const { selectedAgent: selectedShellAgent } = useShellState();
  const attentionItems = useAttentionItems(5);

  const { agents, initAgents, applySnapshot, applyEvent, destroy, setDemoMode } = useOfficeStore();

  // Initialize agent FSMs once.
  useEffect(() => {
    initAgents();
    return () => destroy();
  }, [initAgents, destroy]);

  // Phase 2 fix: bridge store FSM zone changes to the visual GameRuntime.
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
  // adapted snapshots into the office FSMs.
  const boardSnapshot = useBoardStoreSnapshot();
  useEffect(() => {
    if (demoMode) return;
    const rawBoard = boardSnapshot.board.value;
    if (!rawBoard) return;
    applySnapshot(adaptBoard(rawBoard));
  }, [boardSnapshot.board, demoMode, applySnapshot]);

  // Phase 3 / Sora stability audit #6 / R10: reconnect catch-up animation.
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
    const nextAgent = id !== null && isAgentId(id) ? id : null;
    shellStore.setSelectedAgent(nextAgent);
    shellStore.setSelectedOwner(nextAgent);
    runtimeRef.current?.followAgent(nextAgent);
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
    shellStore.setFps(stats.fps);
  }, []);

  const handleAssetError = useCallback((info: AgentAssetError) => {
    setAssetErrors((prev) => {
      const key = `${info.agentId}:${info.animType}`;
      if (prev.some((e) => `${e.agentId}:${e.animType}` === key)) return prev;
      return [...prev, info];
    });
  }, []);

  const handleResume = useCallback(() => {
    if (demoMode) {
      applySnapshot(DEMO_BOARD);
      return;
    }
    try {
      void getBrowserBackbone()?.syncOnce();
    } catch {
      // Backbone may not be started yet.
    }
  }, [demoMode, applySnapshot]);

  useEffect(() => {
    runtimeRef.current?.followAgent(selectedShellAgent);
  }, [selectedShellAgent]);

  const selectedAgent = selectedShellAgent ? agents.get(selectedShellAgent) ?? null : null;
  const topAttentionAgent = useMemo(() => {
    for (const item of attentionItems) {
      const source = item.source;
      if (typeof source === 'string' && isAgentId(source.toLowerCase())) return source.toLowerCase();
    }
    return null;
  }, [attentionItems]);
  const attentionFocusTask = useMemo(() => {
    if (!topAttentionAgent) return null;
    return flattenBoardTasks(boardSnapshot.board.value)
      .filter((task) => task.assignee?.toLowerCase() === topAttentionAgent)
      .sort(compareCurrentWork)[0] ?? null;
  }, [boardSnapshot.board.value, topAttentionAgent]);
  const currentWorkTasks = useMemo(() => {
    if (!selectedAgent) return [];
    return flattenBoardTasks(boardSnapshot.board.value)
      .filter((task) => task.assignee === selectedAgent.agentId)
      .sort(compareCurrentWork);
  }, [boardSnapshot.board.value, selectedAgent]);
  const currentWorkTask = currentWorkTasks[0] ?? null;
  const currentWorkNote = !selectedAgent
    ? null
    : !currentWorkTask
      ? `Current work unavailable until a verified Kanban task is mapped for ${selectedAgent.name}.`
      : null;
  const chatEnabled = !popoutMode && selectedAgent !== null && canSend();
  const chatLabel = popoutMode
    ? 'Chat unavailable (pop-out mode)'
    : !selectedAgent
      ? 'Open chat unavailable'
      : !canSend()
        ? 'Open chat unavailable'
        : 'Open chat';
  const chatNote = popoutMode
    ? null
    : !selectedAgent
      ? null
      : canSend()
        ? null
        : 'Chat transport is not bound right now.';

  const handleViewCurrentWork = useCallback(() => {
    if (popoutMode) return;
    if (!selectedAgent || !currentWorkTask || !selectedShellAgent) return;
    shellStore.setSelectedOwner(selectedAgent.agentId);
    shellStore.setSelectedAgent(selectedShellAgent);
    shellStore.setView('kanban');
    navigateToPath('/kanban');
  }, [currentWorkTask, selectedAgent, selectedShellAgent, popoutMode]);

  const handleOpenChat = useCallback(() => {
    if (popoutMode) return;
    if (!selectedAgent || !canSend() || !selectedShellAgent) return;
    shellStore.setSelectedOwner(selectedAgent.agentId);
    shellStore.setSelectedAgent(selectedShellAgent);
    shellStore.setView('chat');
    navigateToPath('/chat');
  }, [selectedAgent, selectedShellAgent, popoutMode]);

  useEffect(() => {
    if (selectedShellAgent || !topAttentionAgent || !attentionFocusTask) return;
    runtimeRef.current?.followAgent(topAttentionAgent);
  }, [attentionFocusTask, selectedShellAgent, topAttentionAgent]);

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
      {/* Room navigation tabs + pop-out buttons */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(8, 11, 18, 0.94)',
          borderBottom: '1px solid var(--border-faint)',
        }}
      >
        <div style={{ flex: 1 }}>
          <RoomTabs onFocusZone={handleFocusZone} activeZone={activeZoneId} />
        </div>
        {/* Pop-out + full-screen toggle — hidden in pop-out window itself */}
        {!popoutMode && <PopOutButton />}
      </div>

      {/* Pixi canvas + overlays */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <OfficeErrorBoundary>
          <OfficeCanvas
            onSelectAgent={handleSelectAgent}
            onFocusZone={handleFocusZone}
            onReady={handleReady}
            onStats={handleStats}
            onAssetError={handleAssetError}
            onResume={handleResume}
            popoutMode={popoutMode}
          />
        </OfficeErrorBoundary>

        {/* Agent info panel */}
        {selectedAgent && (
          <AgentInfoPanel
            agent={selectedAgent}
            onClose={() => shellStore.setSelectedAgent(null)}
            onViewCurrentWork={handleViewCurrentWork}
            currentWorkEnabled={currentWorkTask !== null}
            currentWorkNote={currentWorkNote}
            onOpenChat={handleOpenChat}
            chatEnabled={chatEnabled}
            chatLabel={chatLabel}
            chatNote={chatNote}
            popoutMode={popoutMode}
          />
        )}
        {!selectedAgent && topAttentionAgent && attentionFocusTask && (
          <div
            data-office-attention-focus
            className="mono"
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              zIndex: 30,
              maxWidth: 360,
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-faint)',
              background: 'rgba(8, 11, 18, 0.86)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-xs)',
            }}
          >
            Attention focus: {topAttentionAgent} - {attentionFocusTask.title}
          </div>
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
