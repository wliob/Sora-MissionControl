// ── Isometric projection + office layout constants ──────────────────

// Tile size at 1x logical scale. The projection is a 2:1 diamond.
export const TILE_W = 128; // screen X width of one tile
export const TILE_H = 64; // screen Y height of one tile

// World grid (col, row). Top-left origin; isometric NE = +X.
export const GRID_COLS = 16;
export const GRID_ROWS = 12;

// Isometric projection: (col, row) -> screen (x, y)
export function gridToScreen(col: number, row: number): { x: number; y: number } {
  const x = (col - row) * (TILE_W / 2);
  const y = (col + row) * (TILE_H / 2);
  return { x, y };
}

// Inverse: screen (x, y) -> nearest grid (col, row)
export function screenToGrid(x: number, y: number): { col: number; row: number } {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const sum = y / halfH;
  const diff = x / halfW;
  const col = (sum + diff) / 2;
  const row = (sum - diff) / 2;
  return { col, row };
}

// Depth sort key for iso sprites. Higher col+row = closer to camera.
export function isoDepth(col: number, row: number): number {
  return col + row;
}

export interface ZoneDef {
  id: string;
  name: string;
  colRange: [number, number];
  rowRange: [number, number];
  floorFrame: string;
  labelCol: number;
  labelRow: number;
  isWalkway?: boolean;
}

export const ZONES: ZoneDef[] = [
  {
    id: 'workstations',
    name: 'Workstations',
    colRange: [8, 14],
    rowRange: [1, 4],
    floorFrame: 'floor_workstations',
    labelCol: 11,
    labelRow: 1,
  },
  {
    id: 'collaboration',
    name: 'Collaboration',
    colRange: [1, 6],
    rowRange: [6, 9],
    floorFrame: 'floor_collaboration',
    labelCol: 3.5,
    labelRow: 6,
  },
  {
    id: 'break_room',
    name: 'Break Room',
    colRange: [8, 14],
    rowRange: [7, 10],
    floorFrame: 'floor_break_room',
    labelCol: 11,
    labelRow: 7,
  },
  {
    id: 'archive',
    name: 'Archive',
    colRange: [1, 6],
    rowRange: [1, 4],
    floorFrame: 'floor_archive',
    labelCol: 3.5,
    labelRow: 1,
  },
  {
    id: 'walkway',
    name: 'Walkway',
    colRange: [0, 15],
    rowRange: [0, 11],
    floorFrame: 'floor_archive',
    labelCol: 7.5,
    labelRow: 5.5,
    isWalkway: true,
  },
];

// Phase B conductor station zone — central raised platform, spans cols 6-9, rows 3-6.
export const CONDUCTOR_ZONE: ZoneDef = {
  id: 'conductor_station',
  name: 'Conductor Station',
  colRange: [6, 9],
  rowRange: [3, 6],
  floorFrame: 'floor_workstations',
  labelCol: 7.5,
  labelRow: 5.5,
};

export interface AgentDesk {
  id: string;
  name: string;
  color: number;
  deskCol: number;
  deskRow: number;
}

// Phase B: 6 agents + Sora conductor station.
// Desk positions from Korra's design spec §1.3.
// Colors from Phase A guild palette.
export const AGENT_DESKS: AgentDesk[] = [
  { id: 'cloud', name: 'Cloud', color: 0x4488ff, deskCol: 9, deskRow: 2 },
  { id: 'biscuit', name: 'Biscuit', color: 0xffb000, deskCol: 11, deskRow: 2 },
  { id: 'korra', name: 'Korra', color: 0xff4499, deskCol: 13, deskRow: 2 },
  { id: 'lelouch', name: 'Lelouch', color: 0x9944ff, deskCol: 11, deskRow: 3 },
  { id: 'tifa', name: 'Tifa', color: 0x00ff66, deskCol: 13, deskRow: 3 },
  { id: 'rain', name: 'Rain', color: 0x00ccff, deskCol: 14, deskRow: 1 },
];

// Sora's conductor station desk placement.
export const CONDUCTOR_DESK: AgentDesk = {
  id: 'sora',
  name: 'Sora',
  color: 0xf0e8d8,
  deskCol: 7.5,
  deskRow: 5.5,
};

export interface PropDef {
  col: number;
  row: number;
  frame: string;
  atlas: 'furniture-0' | 'furniture-1';
  offsetY?: number;
  scale?: number;
}

export const PROPS: PropDef[] = [
  // Workstations desks + chairs + monitors — 6 agents
  // Cloud (9, 2)
  { col: 9, row: 2, frame: 'desk', atlas: 'furniture-1', offsetY: -18 },
  { col: 9, row: 2, frame: 'chair', atlas: 'furniture-1', offsetY: 8, scale: 0.95 },
  { col: 9, row: 2, frame: 'monitor', atlas: 'furniture-1', offsetY: -28, scale: 0.9 },

  // Biscuit (11, 2)
  { col: 11, row: 2, frame: 'desk', atlas: 'furniture-1', offsetY: -18 },
  { col: 11, row: 2, frame: 'chair', atlas: 'furniture-1', offsetY: 8, scale: 0.95 },
  { col: 11, row: 2, frame: 'monitor', atlas: 'furniture-1', offsetY: -28, scale: 0.9 },

  // Korra (13, 2)
  { col: 13, row: 2, frame: 'desk', atlas: 'furniture-1', offsetY: -18 },
  { col: 13, row: 2, frame: 'chair', atlas: 'furniture-1', offsetY: 8, scale: 0.95 },
  { col: 13, row: 2, frame: 'monitor', atlas: 'furniture-1', offsetY: -28, scale: 0.9 },

  // Lelouch (11, 3)
  { col: 11, row: 3, frame: 'desk', atlas: 'furniture-1', offsetY: -18 },
  { col: 11, row: 3, frame: 'chair', atlas: 'furniture-1', offsetY: 8, scale: 0.95 },
  { col: 11, row: 3, frame: 'monitor', atlas: 'furniture-1', offsetY: -28, scale: 0.9 },

  // Tifa (13, 3)
  { col: 13, row: 3, frame: 'desk', atlas: 'furniture-1', offsetY: -18 },
  { col: 13, row: 3, frame: 'chair', atlas: 'furniture-1', offsetY: 8, scale: 0.95 },
  { col: 13, row: 3, frame: 'monitor', atlas: 'furniture-1', offsetY: -28, scale: 0.9 },

  // Rain (14, 1) — far-right corner
  { col: 14, row: 1, frame: 'desk', atlas: 'furniture-1', offsetY: -18 },
  { col: 14, row: 1, frame: 'chair', atlas: 'furniture-1', offsetY: 8, scale: 0.95 },
  { col: 14, row: 1, frame: 'monitor', atlas: 'furniture-1', offsetY: -28, scale: 0.9 },

  // Sora's conductor station (center, cols 6-9, rows 3-6, raised platform)
  // Elevated desk platform — uses conductor_desk frame at 1.15× scale.
  { col: 7.5, row: 5.5, frame: 'conductor_desk', atlas: 'furniture-1', offsetY: -32, scale: 1.15 },
  { col: 7.5, row: 5.5, frame: 'chair', atlas: 'furniture-1', offsetY: 4, scale: 0.95 },
  { col: 7.5, row: 5.5, frame: 'monitor', atlas: 'furniture-1', offsetY: -42, scale: 1.1 },
  // Guild banner backdrop behind conductor station
  { col: 7.5, row: 3.2, frame: 'guild_banner', atlas: 'furniture-0', offsetY: -20, scale: 1.1 },

  // Collaboration: round table + four chairs
  { col: 3, row: 7, frame: 'round_table', atlas: 'furniture-0', offsetY: -10 },
  { col: 2.3, row: 7, frame: 'meeting_chair', atlas: 'furniture-0', offsetY: 4, scale: 0.95 },
  { col: 3.7, row: 7, frame: 'meeting_chair', atlas: 'furniture-0', offsetY: 4, scale: 0.95 },
  { col: 3, row: 6.3, frame: 'meeting_chair', atlas: 'furniture-0', offsetY: 4, scale: 0.95 },
  { col: 3, row: 7.7, frame: 'meeting_chair', atlas: 'furniture-0', offsetY: 4, scale: 0.95 },
  { col: 5, row: 6.5, frame: 'whiteboard', atlas: 'furniture-1', offsetY: -16, scale: 0.9 },

  // Break room
  { col: 10, row: 8, frame: 'couch', atlas: 'furniture-0', offsetY: -8 },
  { col: 12, row: 7, frame: 'coffee_machine', atlas: 'furniture-1', offsetY: -4, scale: 0.9 },
  { col: 11, row: 9, frame: 'rug_break', atlas: 'furniture-0', offsetY: 0, scale: 0.95 },
  { col: 13, row: 9.5, frame: 'plant_large', atlas: 'furniture-0', offsetY: -12, scale: 0.85 },
  { col: 9, row: 9, frame: 'lamp_floor', atlas: 'furniture-0', offsetY: -16, scale: 0.9 },

  // Archive
  { col: 2, row: 1.5, frame: 'bookshelf', atlas: 'furniture-0', offsetY: -16, scale: 0.95 },
  { col: 3.5, row: 1.5, frame: 'bookshelf', atlas: 'furniture-0', offsetY: -16, scale: 0.95 },
  { col: 5, row: 1.5, frame: 'bookshelf', atlas: 'furniture-0', offsetY: -16, scale: 0.95 },
  { col: 2, row: 3.8, frame: 'bookshelf', atlas: 'furniture-0', offsetY: -16, scale: 0.95 },
  { col: 3.5, row: 3.8, frame: 'bookshelf', atlas: 'furniture-0', offsetY: -16, scale: 0.95 },

  // Central kanban prop (now replaced by conductor station — kept as fallback)
  { col: 7.5, row: 5.5, frame: 'kanban_board_prop', atlas: 'furniture-1', offsetY: -14, scale: 0.85 },
];

export function getWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  const tl = gridToScreen(0, 0);
  const br = gridToScreen(GRID_COLS - 1, GRID_ROWS - 1);
  return {
    minX: tl.x,
    maxX: br.x,
    minY: tl.y,
    maxY: br.y,
  };
}
