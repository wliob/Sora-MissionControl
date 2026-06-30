/**
 * MissionBar — Hermes-style page header.
 *
 * The left rail owns navigation. The banner only shows the active page title
 * plus compact state/actions, matching the dashboard contract.
 */

import { StatusPill } from '@/components/common/StatusPill';
import { initialBoardState } from '@/types/board';
import { useBoardStoreSnapshot } from '@/state/boardStore';
import { useConnectionStateValue } from '@/state/sessionConnectionStore';
import { truthProvenanceLabel } from '@/utils/truthVocabulary';

interface MissionBarProps {
  title?: string;
}

export function MissionBar({ title = 'Kanban' }: MissionBarProps) {
  const boardSnapshot = useBoardStoreSnapshot();
  const connectionState = useConnectionStateValue();
  const fallbackBoard = initialBoardState().value!;
  const totalTasks = (boardSnapshot.board.value ?? fallbackBoard).columns.reduce((sum, column) => sum + column.tasks.length, 0);
  const restState = connectionState.value?.sources['kanban-rest']?.state ?? 'unknown';

  return (
    <header className="dashboard-header" role="banner">
      <div className="dashboard-header-title-group">
        <h1 className="dashboard-header-title">{title}</h1>
        {title === 'Kanban' && <span className="dashboard-header-count">{totalTasks}</span>}
      </div>
      <div className="dashboard-header-actions">
        <StatusPill state={restState} size="sm" />
        <span className="dashboard-header-meta mono">
          {truthProvenanceLabel(boardSnapshot.board.provenance)}
        </span>
      </div>
    </header>
  );
}
