// ── A* pathfinding on the office grid ───────────────────────────────

import { GRID_COLS, GRID_ROWS, PROPS } from '@/office/engine/iso';

export interface GridCell {
  col: number;
  row: number;
}

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parent: Node | null;
}

const WALKABLE_DIAGONAL = false;

function buildBlockedGrid(): boolean[][] {
  const blocked: boolean[][] = Array.from({ length: GRID_COLS }, () =>
    Array.from({ length: GRID_ROWS }, () => false),
  );

  for (const prop of PROPS) {
    const col = Math.round(prop.col);
    const row = Math.round(prop.row);
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      blocked[col][row] = true;
    }
  }

  return blocked;
}

let blockedGrid: boolean[][] | null = null;

function isBlocked(col: number, row: number): boolean {
  if (blockedGrid === null) {
    blockedGrid = buildBlockedGrid();
  }
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
  return blockedGrid[col][row];
}

/**
 * Find the nearest walkable tile to (col, row) using a spiral BFS outwards.
 * Returns the original cell if it is already walkable. Used to resolve zone
 * centers that sit on top of furniture props (e.g. workstations center sits
 * on a desk+chair+monitor stack). Returns null if no walkable tile is found
 * within the grid bounds.
 */
function nearestWalkable(col: number, row: number): GridCell | null {
  if (!isBlocked(col, row)) return { col, row };
  // Spiral outwards, ring by ring, up to the grid diagonal.
  const maxRadius = Math.max(GRID_COLS, GRID_ROWS);
  for (let radius = 1; radius < maxRadius; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        // Only check the current ring (skip inner cells already checked).
        if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
        const c = col + dc;
        const r = row + dr;
        if (!isBlocked(c, r)) return { col: c, row: r };
      }
    }
  }
  return null;
}

function heuristic(a: GridCell, b: GridCell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function key(col: number, row: number): string {
  return `${col},${row}`;
}

function reconstructPath(node: Node): GridCell[] {
  const path: GridCell[] = [];
  let current: Node | null = node;
  while (current !== null) {
    path.push({ col: current.col, row: current.row });
    current = current.parent;
  }
  return path.reverse();
}

export function findPath(from: GridCell, to: GridCell): GridCell[] {
  // Phase 2 fix: zone centers and prop tiles can be blocked by furniture.
  // Resolve a blocked destination to the nearest walkable tile so agents can
  // still path to those zones instead of silently failing (findPath returned
  // [] and agents never moved to workstations/collaboration).
  const resolvedTo = nearestWalkable(to.col, to.row);
  if (resolvedTo === null) {
    return [];
  }
  if (isBlocked(from.col, from.row)) {
    // Start tile blocked: resolve it too so the agent can begin pathing.
    const resolvedFrom = nearestWalkable(from.col, from.row);
    if (resolvedFrom === null) return [];
    return findPath(resolvedFrom, resolvedTo);
  }
  if (from.col === resolvedTo.col && from.row === resolvedTo.row) {
    return [{ col: from.col, row: from.row }];
  }

  const openSet = new Map<string, Node>();
  const closedSet = new Set<string>();

  const start: Node = {
    col: from.col,
    row: from.row,
    g: 0,
    f: heuristic(from, resolvedTo),
    parent: null,
  };
  openSet.set(key(start.col, start.row), start);

  const directions: GridCell[] = [
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: -1 },
  ];
  if (WALKABLE_DIAGONAL) {
    directions.push(
      { col: 1, row: 1 },
      { col: 1, row: -1 },
      { col: -1, row: 1 },
      { col: -1, row: -1 },
    );
  }

  while (openSet.size > 0) {
    let current: Node | null = null;
    for (const node of Array.from(openSet.values())) {
      if (current === null || node.f < current.f) {
        current = node;
      }
    }
    if (current === null) break;

    const currentKey = key(current.col, current.row);
    openSet.delete(currentKey);
    closedSet.add(currentKey);

    if (current.col === resolvedTo.col && current.row === resolvedTo.row) {
      return reconstructPath(current);
    }

    for (const dir of directions) {
      const nextCol = current.col + dir.col;
      const nextRow = current.row + dir.row;
      const nextKey = key(nextCol, nextRow);

      if (closedSet.has(nextKey)) continue;
      if (isBlocked(nextCol, nextRow)) continue;

      const moveCost = Math.abs(dir.col) + Math.abs(dir.row) === 2 ? 1.414 : 1;
      const g = current.g + moveCost;
      const existing = openSet.get(nextKey);

      if (!existing || g < existing.g) {
        const nextNode: Node = {
          col: nextCol,
          row: nextRow,
          g,
          f: g + heuristic({ col: nextCol, row: nextRow }, resolvedTo),
          parent: current,
        };
        openSet.set(nextKey, nextNode);
      }
    }
  }

  return [];
}

export function resetPathfindingCache(): void {
  blockedGrid = null;
}