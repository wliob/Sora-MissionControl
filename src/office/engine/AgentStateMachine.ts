// ── Per-agent XState machine for the embedded office ─────────────────

import { assign, createActor, createMachine } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import type { Task, WsEvent } from '@/office/types';

export type AgentActivity =
  | 'idle'
  | 'moving'
  | 'working'
  | 'blocked'
  | 'reviewing'
  | 'celebrating';

export type AgentZone =
  | 'home'
  | 'workstations'
  | 'collaboration'
  | 'break_room'
  | 'archive';

export interface AgentState {
  agentId: string;
  name: string;
  activity: AgentActivity;
  zone: AgentZone;
  task: Task | null;
  pendingZone: AgentZone | null;
}

export type AgentMachineEvent =
  | { type: 'SNAPSHOT'; tasks: Task[] }
  | { type: 'WS_EVENT'; event: WsEvent }
  | { type: 'ARRIVED' }
  | { type: 'CELEBRATION_DONE' }
  | { type: 'GO_HOME' };

interface MachineContext {
  agentId: string;
  name: string;
  task: Task | null;
  targetZone: AgentZone;
}

const STATUS_ZONE_MAP: Record<string, AgentZone> = {
  in_progress: 'workstations',
  blocked: 'workstations',
  review: 'collaboration',
  done: 'archive',
};

function pickActiveTask(agentId: string, tasks: Task[]): Task | null {
  const mine = tasks.filter(
    (t) =>
      t.assignee?.toLowerCase() === agentId.toLowerCase() &&
      ['in_progress', 'blocked', 'review'].includes(t.status),
  );
  if (mine.length === 0) return null;
  mine.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  return mine[0];
}

function deriveTargetZone(task: Task | null): AgentZone {
  if (!task) return 'break_room';
  return STATUS_ZONE_MAP[task.status] ?? 'workstations';
}

function isEventForAgent(event: WsEvent, agentId: string): boolean {
  if (!event.task.assignee) return false;
  return event.task.assignee.toLowerCase() === agentId.toLowerCase();
}

function topState(value: SnapshotFrom<typeof agentMachine>['value']): string {
  return typeof value === 'string' ? value : Object.keys(value)[0];
}

function applyTaskAndZone(
  _ctx: MachineContext,
  task: Task | null,
): Partial<MachineContext> {
  return {
    task,
    targetZone: deriveTargetZone(task),
  };
}

const agentMachine = createMachine(
  {
    id: 'agent',
    initial: 'idle',
    context: ({ input }: { input: { agentId: string; name: string } }): MachineContext => ({
      agentId: input.agentId,
      name: input.name,
      task: null,
      targetZone: 'break_room',
    }),
    states: {
      idle: {
        entry: assign({ targetZone: 'break_room' }),
        on: {
          SNAPSHOT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) =>
                applyTaskAndZone(
                  context,
                  pickActiveTask(context.agentId, (event as { tasks: Task[] }).tasks),
                ),
            ),
          },
          WS_EVENT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) => {
                const ev = (event as { event: WsEvent }).event;
                if (!isEventForAgent(ev, context.agentId)) return {};
                return applyTaskAndZone(context, ev.task);
              },
            ),
          },
          ARRIVED: { target: 'working', guard: 'hasWorkingTask' },
        },
      },
      moving: {
        on: {
          SNAPSHOT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) =>
                applyTaskAndZone(
                  context,
                  pickActiveTask(context.agentId, (event as { tasks: Task[] }).tasks),
                ),
            ),
          },
          WS_EVENT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) => {
                const ev = (event as { event: WsEvent }).event;
                if (!isEventForAgent(ev, context.agentId)) return {};
                return applyTaskAndZone(context, ev.task);
              },
            ),
          },
          ARRIVED: [
            { target: 'celebrating', guard: 'arrivedAtArchive' },
            { target: 'working', guard: 'hasWorkingTask' },
            { target: 'idle' },
          ],
        },
      },
      working: {
        entry: assign({ targetZone: 'workstations' }),
        on: {
          SNAPSHOT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) =>
                applyTaskAndZone(
                  context,
                  pickActiveTask(context.agentId, (event as { tasks: Task[] }).tasks),
                ),
            ),
          },
          WS_EVENT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) => {
                const ev = (event as { event: WsEvent }).event;
                if (!isEventForAgent(ev, context.agentId)) return {};
                return applyTaskAndZone(context, ev.task);
              },
            ),
          },
        },
      },
      blocked: {
        entry: assign({ targetZone: 'workstations' }),
        on: {
          SNAPSHOT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) =>
                applyTaskAndZone(
                  context,
                  pickActiveTask(context.agentId, (event as { tasks: Task[] }).tasks),
                ),
            ),
          },
          WS_EVENT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) => {
                const ev = (event as { event: WsEvent }).event;
                if (!isEventForAgent(ev, context.agentId)) return {};
                return applyTaskAndZone(context, ev.task);
              },
            ),
          },
        },
      },
      reviewing: {
        entry: assign({ targetZone: 'collaboration' }),
        on: {
          SNAPSHOT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) =>
                applyTaskAndZone(
                  context,
                  pickActiveTask(context.agentId, (event as { tasks: Task[] }).tasks),
                ),
            ),
          },
          WS_EVENT: {
            actions: assign(
              ({
                context,
                event,
              }: {
                context: MachineContext;
                event: unknown;
              }) => {
                const ev = (event as { event: WsEvent }).event;
                if (!isEventForAgent(ev, context.agentId)) return {};
                return applyTaskAndZone(context, ev.task);
              },
            ),
          },
        },
      },
      celebrating: {
        entry: assign({ targetZone: 'archive' }),
        on: {
          CELEBRATION_DONE: [
            { target: 'moving', guard: 'hasPendingWork' },
            { target: 'idle' },
          ],
        },
      },
    },
  },
  {
    guards: {
      hasWorkingTask: ({ context }: { context: MachineContext }) => {
        if (!context.task) return false;
        return ['in_progress', 'blocked', 'review'].includes(context.task.status);
      },
      hasPendingWork: ({ context }: { context: MachineContext }) => {
        if (!context.task) return false;
        return ['in_progress', 'blocked', 'review'].includes(context.task.status);
      },
      arrivedAtArchive: ({ context }: { context: MachineContext }) =>
        context.targetZone === 'archive',
    },
  },
);

export function createAgentStateMachine(agentId: string, name: string) {
  return createActor(agentMachine, { input: { agentId, name } });
}

export function getAgentState(
  snapshot: SnapshotFrom<typeof agentMachine>,
): AgentState {
  const ctx = snapshot.context as MachineContext;
  const state = topState(snapshot.value);

  let activity: AgentActivity = 'idle';
  if (state === 'moving') activity = 'moving';
  else if (state === 'working') activity = 'working';
  else if (state === 'blocked') activity = 'blocked';
  else if (state === 'reviewing') activity = 'reviewing';
  else if (state === 'celebrating') activity = 'celebrating';

  return {
    agentId: ctx.agentId,
    name: ctx.name,
    activity,
    zone: ctx.targetZone,
    task: ctx.task,
    pendingZone: state === 'moving' ? ctx.targetZone : null,
  };
}

export type AgentMachineActor = ReturnType<typeof createAgentStateMachine>;