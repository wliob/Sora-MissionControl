/**
 * Shell store — tracks active view, selected agent, and connection health.
 * Phase 1 local state; Phase 3 will route through Cloud's shared stores.
 */

import { useSyncExternalStore } from 'react';
import type { AgentId, ConnectionState, PrimaryView } from '@/types';

interface ShellState {
  view: PrimaryView;
  selectedAgent: AgentId | null;
  connection: ConnectionState;
  fps: number;
  eventTickerOpen: boolean;
}

const initial: ShellState = {
  view: 'office',
  selectedAgent: null,
  connection: 'unknown',
  fps: 0,
  eventTickerOpen: false,
};

let state: ShellState = { ...initial };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

export const shellStore = {
  get state() {
    return state;
  },
  setView(view: PrimaryView) {
    if (state.view === view) return;
    state = { ...state, view };
    emit();
  },
  setSelectedAgent(agent: AgentId | null) {
    if (state.selectedAgent === agent) return;
    state = { ...state, selectedAgent: agent };
    emit();
  },
  setConnection(connection: ConnectionState) {
    if (state.connection === connection) return;
    state = { ...state, connection };
    emit();
  },
  setFps(fps: number) {
    if (state.fps === fps) return;
    state = { ...state, fps };
    emit();
  },
  setEventTickerOpen(open: boolean) {
    if (state.eventTickerOpen === open) return;
    state = { ...state, eventTickerOpen: open };
    emit();
  },
};

export function useShellState(): ShellState {
  return useSyncExternalStore(subscribe, getSnapshot);
}