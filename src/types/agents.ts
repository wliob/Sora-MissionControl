/**
 * Agent identity types — the canonical agent roster.
 *
 * Phase 1 defined AgentId, AgentMeta, AgentActivity, and AGENTS in
 * `src/types/index.ts`. This file is the canonical home for those types so
 * the auth/board/connection models can import them without a circular
 * dependency on index.ts. index.ts re-exports from here for backwards
 * compatibility with existing shell/office code.
 */

/**
 * The five department-lead profile ids. These match the Hermes profile
 * names and the 3D office's AGENT_DESKS layout. Custom profiles that are not
 * department leads are represented as free-form strings elsewhere (e.g. in
 * KanbanTaskCard.assignee) rather than extending this union.
 */
export type AgentId = 'cloud' | 'biscuit' | 'korra' | 'lelouch' | 'tifa';

export interface AgentMeta {
  id: AgentId;
  name: string;
  role: string;
  accent: string;
}

export const AGENTS: AgentMeta[] = [
  { id: 'cloud', name: 'Cloud', role: 'Systems & Infra', accent: 'var(--agent-cloud)' },
  { id: 'biscuit', name: 'Biscuit', role: 'Automation & Coding', accent: 'var(--agent-biscuit)' },
  { id: 'korra', name: 'Korra', role: 'Creative & Media', accent: 'var(--agent-korra)' },
  { id: 'lelouch', name: 'Lelouch', role: 'Lifestyle & Logistics', accent: 'var(--agent-lelouch)' },
  { id: 'tifa', name: 'Tifa', role: 'Finance & Trading', accent: 'var(--agent-tifa)' },
];

/**
 * Per-agent activity state. Drives the office FSM and the status bar. This
 * is a derived value: the office module computes it from board snapshots
 * and WS events, not from a dedicated store field.
 */
export type AgentActivity =
  | 'idle'
  | 'moving'
  | 'working'
  | 'blocked'
  | 'reviewing'
  | 'celebrating';

/**
 * Type guard for AgentId. Used by adapters to validate assignee fields
 * that may contain arbitrary profile names.
 */
export function isAgentId(value: unknown): value is AgentId {
  return (
    typeof value === 'string' &&
    AGENTS.some((a) => a.id === value)
  );
}

export const ACTIVITY_META: Record<
  AgentActivity,
  { label: string; color: string; icon: string }
> = {
  idle: { label: 'Idle', color: 'var(--text-muted)', icon: '·' },
  moving: { label: 'Moving', color: 'var(--accent-cyan)', icon: '→' },
  working: { label: 'Working', color: 'var(--accent-cyan)', icon: '▸' },
  blocked: { label: 'Blocked', color: 'var(--accent-red)', icon: '!' },
  reviewing: { label: 'Reviewing', color: 'var(--accent-violet)', icon: '◉' },
  celebrating: { label: 'Done', color: 'var(--accent-green)', icon: '✓' },
};