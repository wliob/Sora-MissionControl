// ── Office store: agent FSMs + connection state + demo data ───────────
//
// This is the data layer for the embedded office. It manages:
// - Per-agent XState actors (one per department lead)
// - Agent state snapshots (derived from FSM subscriptions)
// - A demo/mock mode that feeds scripted events to the FSMs
//
// Phase B: Extended to 6 agents (Rain included). Conductor station state
// is derived from agent states rather than having its own FSM.
//
// When the dashboard's backbone (boardStore) is connected, applySnapshot()
// and applyEvent() receive adapted data from adapter.ts.

import { create } from 'zustand';
import { AGENT_DESKS } from '@/office/engine/iso';
import {
  createAgentStateMachine,
  getAgentState,
  type AgentMachineActor,
  type AgentState,
  type AgentZone,
} from '@/office/engine/AgentStateMachine';
import type { Board, WsEvent } from '@/office/types';

/** Derived conductor station state. */
export interface ConductorState {
  totalAgents: number;
  onlineAgents: number;
  agentsWorking: number;
  agentsBlocked: number;
  agentsIdle: number;
  overallHealth: 'verified' | 'degraded' | 'unavailable';
  lastUpdate: number;
}

export interface OfficeStore {
  agents: Map<string, AgentState>;
  actors: Map<string, AgentMachineActor>;
  /** True when running in demo mode (no live board connection). */
  demoMode: boolean;
  /** Derived conductor station health state. */
  conductorState: ConductorState;

  initAgents: () => void;
  applySnapshot: (board: Board) => void;
  applyEvent: (event: WsEvent) => void;
  getStateFor: (agentId: string) => AgentState | undefined;
  setAgentZone: (agentId: string, zone: AgentZone) => void;
  setDemoMode: (demo: boolean) => void;
  recomputeConductorState: () => void;
  destroy: () => void;
}

function agentIdFromName(name: string): string {
  return name.toLowerCase();
}

function deriveHealth(agents: Map<string, AgentState>): ConductorState['overallHealth'] {
  if (agents.size === 0) return 'unavailable';
  let blocked = 0;
  let working = 0;
  for (const [, state] of agents) {
    if (state.activity === 'blocked') blocked++;
    if (state.activity === 'working' || state.activity === 'reviewing') working++;
  }
  if (blocked > 2) return 'degraded';
  return 'verified';
}

function computeConductorState(agents: Map<string, AgentState>): ConductorState {
  let online = 0;
  let working = 0;
  let blocked = 0;
  let idle = 0;
  for (const [, state] of agents) {
    if (state.activity !== 'idle' || state.task) online++;
    if (state.activity === 'working' || state.activity === 'reviewing') working++;
    if (state.activity === 'blocked') blocked++;
    if (state.activity === 'idle' && !state.task) idle++;
  }
  return {
    totalAgents: AGENT_DESKS.length,
    onlineAgents: online,
    agentsWorking: working,
    agentsBlocked: blocked,
    agentsIdle: idle,
    overallHealth: deriveHealth(agents),
    lastUpdate: Date.now(),
  };
}

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  agents: new Map(),
  actors: new Map(),
  demoMode: false,
  conductorState: {
    totalAgents: AGENT_DESKS.length,
    onlineAgents: 0,
    agentsWorking: 0,
    agentsBlocked: 0,
    agentsIdle: 0,
    overallHealth: 'unavailable',
    lastUpdate: 0,
  },

  initAgents: () => {
    const actors = new Map<string, AgentMachineActor>();
    const states = new Map<string, AgentState>();

    for (const desk of AGENT_DESKS) {
      const actor = createAgentStateMachine(desk.id, desk.name);
      actor.start();
      actor.subscribe((snapshot) => {
        const next = getAgentState(snapshot);
        states.set(desk.id, next);
        set({ agents: new Map(states) });
        // Recompute conductor state when any agent changes
        const conductorState = computeConductorState(new Map(states));
        set({ conductorState });
      });
      actors.set(desk.id, actor);
      states.set(desk.id, getAgentState(actor.getSnapshot()));
    }

    const conductorState = computeConductorState(new Map(states));
    set({ actors, agents: new Map(states), conductorState });
  },

  applySnapshot: (board: Board) => {
    const { actors } = get();
    const allTasks: Board['columns'][0]['tasks'] = [];
    for (const column of board.columns) {
      allTasks.push(...column.tasks);
    }
    for (const actor of actors.values()) {
      actor.send({ type: 'SNAPSHOT', tasks: allTasks });
    }
  },

  applyEvent: (event: WsEvent) => {
    const { actors } = get();
    if (event.task.assignee) {
      const agentId = agentIdFromName(event.task.assignee);
      const actor = actors.get(agentId);
      if (actor) {
        actor.send({ type: 'WS_EVENT', event });
      }
    }
    // Re-evaluate all agents on structural events
    if (
      event.type === 'task.reassigned' ||
      event.type === 'task.unblocked' ||
      event.type === 'task.blocked'
    ) {
      for (const actor of actors.values()) {
        actor.send({ type: 'WS_EVENT', event });
      }
    }
  },

  getStateFor: (agentId: string) => get().agents.get(agentId),

  setAgentZone: (agentId: string, zone: AgentZone) => {
    const { actors, agents } = get();
    const actor = actors.get(agentId);
    if (!actor) return;
    const state = actor.getSnapshot().value;
    const top = typeof state === 'string' ? state : Object.keys(state)[0];
    if (top === 'moving') {
      actor.send({ type: 'ARRIVED' });
    }
    if (top === 'celebrating' && zone === 'archive') {
      actor.send({ type: 'CELEBRATION_DONE' });
    }
    const next = getAgentState(actor.getSnapshot());
    agents.set(agentId, next);
    set({ agents: new Map(agents) });
    const conductorState = computeConductorState(new Map(agents));
    set({ conductorState });
  },

  setDemoMode: (demo: boolean) => set({ demoMode: demo }),

  recomputeConductorState: () => {
    const { agents } = get();
    const conductorState = computeConductorState(agents);
    set({ conductorState });
  },

  destroy: () => {
    const { actors } = get();
    for (const actor of actors.values()) {
      actor.stop();
    }
    actors.clear();
    set({
      actors: new Map(),
      agents: new Map(),
      conductorState: {
        totalAgents: AGENT_DESKS.length,
        onlineAgents: 0,
        agentsWorking: 0,
        agentsBlocked: 0,
        agentsIdle: 0,
        overallHealth: 'unavailable',
        lastUpdate: 0,
      },
    });
  },
}));
