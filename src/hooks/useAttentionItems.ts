/**
 * useAttentionItems — shell-level attention ranking hook.
 *
 * Subscribes to the stores that feed the Attention Ranking Engine and
 * recomputes ranked items when any of those inputs change:
 *   - boardStore: Kanban task data + provenance
 *   - teamStore: lead workload/blocker/status summaries
 *   - sessionConnectionStore: source health / degraded connection signals
 *   - calendarStore: deadline and meeting pressure
 */

import { useMemo } from 'react';
import { useBoardStoreSnapshot } from '@/state/boardStore';
import { useTeamState } from '@/state/teamStore';
import { useConnectionStateValue } from '@/state/sessionConnectionStore';
import { useCalendarState } from '@/state/calendarStore';
import type { AttentionItem } from '@/types/team';
import type { KanbanTaskCard } from '@/types/board';
import type { Confidence, Freshness } from '@/types/provenance';
import type { CalendarEvent } from '@/types/calendar';
import {
  buildRankingInput,
  rankAttentionItems,
  unknownCalendarWindow,
  type CalendarUrgencyWindow,
} from '@/state/attentionRankingEngine';

function flattenTasks(tasks: KanbanTaskCard[][]): KanbanTaskCard[] {
  return tasks.reduce<KanbanTaskCard[]>((acc, group) => {
    acc.push(...group);
    return acc;
  }, []);
}

function connectionAdjustedFreshness(
  freshness: Freshness,
  overall: string,
  hasTasks: boolean,
): Freshness {
  if (overall === 'offline' || overall === 'unauthorized') {
    return hasTasks ? 'stale' : 'missing';
  }
  if (overall === 'degraded' && freshness === 'live') return 'stale';
  return freshness;
}

function calendarWindowFromEvents(events: CalendarEvent[], freshness: Freshness, now = new Date()): CalendarUrgencyWindow {
  if (freshness === 'missing') return unknownCalendarWindow();

  const live = freshness === 'live' || freshness === 'fresh';
  if (!live && events.length === 0) {
    return {
      hasDeadline: false,
      deadlineWithin: null,
      hasMeetingImminent: false,
      dataSource: 'unavailable',
    };
  }

  let nearestDeadlineMs = Number.POSITIVE_INFINITY;
  let hasMeetingImminent = false;

  for (const event of events) {
    if (event.status === 'completed') continue;
    const eventTime = new Date(event.timestamp).getTime();
    if (!Number.isFinite(eventTime)) continue;
    const deltaMs = eventTime - now.getTime();
    if (deltaMs < 0 && event.status !== 'missed') continue;

    if (event.eventType === 'deadline' || event.eventType === 'milestone' || event.eventType === 'review') {
      nearestDeadlineMs = Math.min(nearestDeadlineMs, Math.max(0, deltaMs));
    }

    if (event.eventType === 'meeting' && deltaMs >= 0 && deltaMs <= 60 * 60 * 1000) {
      hasMeetingImminent = true;
    }
  }

  let deadlineWithin: CalendarUrgencyWindow['deadlineWithin'] = null;
  if (Number.isFinite(nearestDeadlineMs)) {
    if (nearestDeadlineMs <= 0) deadlineWithin = 'now';
    else if (nearestDeadlineMs <= 60 * 60 * 1000) deadlineWithin = '1h';
    else if (nearestDeadlineMs <= 24 * 60 * 60 * 1000) deadlineWithin = '24h';
    else if (nearestDeadlineMs <= 7 * 24 * 60 * 60 * 1000) deadlineWithin = '7d';
  }

  return {
    hasDeadline: deadlineWithin !== null,
    deadlineWithin,
    hasMeetingImminent,
    dataSource: live ? 'live' : 'unavailable',
  };
}

export function useAttentionItems(limit = 5): AttentionItem[] {
  const boardSnapshot = useBoardStoreSnapshot();
  const teamState = useTeamState();
  const connectionState = useConnectionStateValue();
  const calendarState = useCalendarState();

  return useMemo(() => {
    const board = boardSnapshot.board.value;
    const tasks = board ? flattenTasks(board.columns.map((column) => column.tasks)) : [];

    const rawFreshness = boardSnapshot.board.provenance?.freshness ?? teamState.freshness ?? 'missing';
    const boardFreshness = connectionAdjustedFreshness(
      rawFreshness,
      connectionState.value?.overall ?? 'unknown',
      tasks.length > 0,
    );
    const boardConfidence = boardSnapshot.board.provenance?.confidence ?? 'unknown';
    const calendarWindow = calendarWindowFromEvents(calendarState.events, calendarState.freshness);

    const input = buildRankingInput({
      tasks,
      boardFreshness,
      boardConfidence: boardConfidence as Confidence,
      calendarWindow,
      isMissing: boardFreshness === 'missing',
    });

    // Feed team-derived workload/status data into the ranking input. This
    // supplements the task-only defaults from buildRankingInput with the
    // broader team state the shell already derives.
    for (const lead of teamState.leadSnapshots) {
      const key = lead.agentId.toLowerCase();
      input.agentStatuses[key] = lead.status !== 'OFFLINE';
      input.agentWorkloads[key] = lead.workload.score;
      input.agentBlockers[key] = lead.blockers;
    }

    return rankAttentionItems(input).slice(0, limit);
  }, [boardSnapshot, teamState, connectionState, calendarState, limit]);
}
