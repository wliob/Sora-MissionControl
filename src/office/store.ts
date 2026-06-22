// ── Office store: agent FSMs + connection state + demo data ───────────
//
// This is the data layer for the embedded office. It manages:
// - Per-agent XState actors (one per department lead)
// - Agent state snapshots (derived from FSM subscriptions)
// - A demo/mock mode that feeds scripted events to the FSMs
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

export interface OfficeStore {
  agents: Map<string, AgentState>;
  actors: Map<string, AgentMachineActor>;
  /** True when running in demo mode (no live board connection). */
  demoMode: boolean;

  initAgents: () => void;
  applySnapshot: (board: Board) => void;
  applyEvent: (event: WsEvent) => void;
  getStateFor: (agentId: string) => AgentState | undefined;
  setAgentZone: (agentId: string, zone: AgentZone) => void;
  setDemoMode: (demo: boolean) => void;
  destroy: () => void;
}

function agentIdFromName(name: string): string {
  return name.toLowerCase();
}

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  agents: new Map(),
  actors: new Map(),
  demoMode: false,

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
      });
      actors.set(desk.id, actor);
      states.set(desk.id, getAgentState(actor.getSnapshot()));
    }

    set({ actors, agents: new Map(states) });
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
  },

  setDemoMode: (demo: boolean) => set({ demoMode: demo }),

  destroy: () => {
    const { actors } = get();
    for (const actor of actors.values()) {
      actor.stop();
    }
    actors.clear();
    set({ actors: new Map(), agents: new Map() });
  },
}));