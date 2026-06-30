/**
 * DeskIndicators — Per-desk visual indicators for the immersive office.
 *
 * Phase B: Each agent's desk carries a stack of visual indicators:
 *   1. Monitor Glow    — CRT phosphor circle behind the monitor (color + intensity)
 *   2. Work Animation  — Triggered on actual task processing (via agent FSM)
 *   3. Blocker Icon    — Red/amber badge with "!" glyph above monitor
 *   4. Project Badge   — Text label with active project name above desk
 *
 * Indicators are PixiJS Graphics/Text objects attached to the FX layer
 * or per-agent containers. They are lightweight (~3 objects per desk).
 *
 * Implementation note: The Agent class already handles blocker badges
 * (showBlockedFx/hideBlockedFx). This module provides the monitor glow
 * and project badge rendering, plus the truth-gated work animation trigger.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { AgentState } from '@/office/engine/AgentStateMachine';

/** Agent guild house colors in hex numbers (matching Phase A palette). */
const AGENT_HEX_COLORS: Record<string, number> = {
  cloud: 0x4488ff,
  biscuit: 0xffb000,
  korra: 0xff4499,
  lelouch: 0x9944ff,
  tifa: 0x00ff66,
  rain: 0x00ccff,
};

/** Get the hex color for an agent ID. */
export function getAgentColorHex(agentId: string): number {
  return AGENT_HEX_COLORS[agentId] ?? 0x888888;
}

/**
 * Create a monitor glow Graphics circle positioned behind the monitor sprite.
 *
 * Glow intensity depends on agent state:
 *   - working/reviewing → agent's guild color at 0.12 alpha
 *   - blocked           → amber CRT (#ffb000) at 0.15 alpha
 *   - idle              → neutral white at 0.05 alpha
 *   - absent/offline    → no glow (returns null)
 */
export function createMonitorGlow(
  agentState: AgentState | null,
  agentColor: number,
): Graphics | null {
  if (!agentState) return null;

  const { activity } = agentState;

  let color: number;
  let alpha: number;

  switch (activity) {
    case 'working':
    case 'reviewing':
      color = agentColor;
      alpha = 0.12;
      break;
    case 'blocked':
      color = 0xffb000; // CRT amber
      alpha = 0.15;
      break;
    case 'moving':
    case 'celebrating':
      color = agentColor;
      alpha = 0.08;
      break;
    case 'idle':
    default:
      color = 0xffffff; // Neutral white
      alpha = 0.05;
      break;
  }

  // Create CRT glow with concentric circle falloff
  const glow = new Graphics();
  const radius = 40;
  const steps = 4;
  for (let s = steps; s >= 0; s--) {
    const t = s / steps;
    const r = radius * (0.5 + t * 0.5);
    const a = alpha * Math.pow(1 - t, 2.5);
    glow.circle(0, 0, r);
    glow.fill({ color, alpha: a });
  }

  return glow;
}

/**
 * Create a project badge pill — small label showing the active project name.
 *
 * Trigger: Agent has a verified task assigned. Badge shows the task title
 * truncated to 16 characters. Hidden when no task.
 *
 * Position: y-offset −82px from desk center (between blocker icon and monitor).
 */
export function createProjectBadge(
  taskTitle: string | null,
): Container | null {
  if (!taskTitle) return null;

  const displayText = taskTitle.length > 16
    ? taskTitle.slice(0, 15) + '\u2026'
    : taskTitle;

  const badgeText = new Text({
    text: displayText,
    style: new TextStyle({
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 9,
      fill: 0xffffff,
    }),
  });
  badgeText.anchor.set(0.5, 0.5);
  badgeText.alpha = 0.85;

  // Pill background
  const padding = 6;
  const bg = new Graphics();
  const width = badgeText.width + padding * 2;
  const height = badgeText.height + padding * 2;
  bg.roundRect(-width / 2, -height / 2, width, height, 6);
  bg.fill({ color: 0xd4943a, alpha: 0.15 }); // Guild amber at 15%

  const container = new Container();
  container.addChild(bg);
  container.addChild(badgeText);
  container.y = -82; // Spec: y-offset −82px from desk center

  return container;
}

/**
 * Determine whether a work animation should play.
 *
 * Truth contract (Phase B): Work animation only plays when:
 *   - Agent FSM state is `working` or `reviewing`
 *   - A verified board task exists and is in `in_progress`, `blocked`, or `review` status
 *   - The activity is driven by real board data, not demo idle loops
 *
 * Returns false for idle/absent/moving/celebrating states.
 */
export function shouldPlayWorkAnimation(state: AgentState | null): boolean {
  if (!state) return false;
  if (!state.task) return false;

  const validStatuses = ['in_progress', 'blocked', 'review'];
  const activityHasWork = state.activity === 'working' || state.activity === 'reviewing';

  return activityHasWork && validStatuses.includes(state.task.status);
}
