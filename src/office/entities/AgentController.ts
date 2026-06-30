// ── Agent movement controller ─────────────────────────────────────────

import { Agent, type AnimationId } from '@/office/entities/Agent';
import { findPath, type GridCell } from '@/office/engine/pathfinding';
import { gridToScreen, isoDepth, ZONES } from '@/office/engine/iso';
import {
  createAgentStateMachine,
  getAgentState,
  type AgentMachineActor,
  type AgentZone,
} from '@/office/engine/AgentStateMachine';
import {
  createCatchUpState,
  sampleCatchUp,
  shouldCatchUp,
  type CatchUpState,
} from '@/office/engine/catchUpAnimation';

const WAYPOINT_ARRIVE_EPSILON = 2;
const MOVE_SPEED = 3.5;
const WORK_DURATION_MS = 2000;
const CHEER_DURATION_MS = 2500;

export class AgentController {
  readonly agent: Agent;

  private machine: AgentMachineActor;
  private path: GridCell[] = [];
  private waypointIndex = 0;
  private isMoving = false;
  private workingUntil = 0;
  private cheerTimeout: ReturnType<typeof setTimeout> | null = null;
  private previousActivity = 'idle';
  private previousZone: AgentZone = 'home';
  private reducedMotion: boolean;
  private _isActive = false;
  /**
   * Active reconnect catch-up animation, or null when the agent is not
   * catching up. When non-null, `update()` interpolates the agent's visual
   * position from `catchUp.fromCol/fromRow` to `toCol/toRow` over 1 second
   * with an ease-out curve, and normal pathfinding movement is suspended.
   * Phase 3 / Sora stability audit #6 / R10.
   */
  private catchUp: CatchUpState | null = null;

  onActiveChange?: (active: boolean) => void;

  constructor(agent: Agent, reducedMotion = false) {
    this.agent = agent;
    this.reducedMotion = reducedMotion;
    this.machine = createAgentStateMachine(agent.id, agent.name);
    this.machine.start();

    this.agent.setOnAnimComplete((id) => {
      if (id === 'cheer') {
        this.machine.send({ type: 'CELEBRATION_DONE' });
      }
    });

    this.machine.subscribe((snapshot) => {
      const agentState = getAgentState(snapshot);
      const activity = agentState.activity;
      const task = agentState.task;
      const zone = agentState.zone;

      if (zone !== this.previousZone) {
        this.walkToZone(zone);
      }
      this.previousZone = zone;

      if (activity !== this.previousActivity) {
        if (this.previousActivity === 'blocked') {
          this.agent.hideBlockedFx();
        }
        switch (activity) {
          case 'working':
            this.agent.showStatusCallout(
              task ? `working: ${task.title}` : 'working',
            );
            this.agent.showStateBadge('WORK', true);
            break;
          case 'blocked':
            this.agent.showStatusCallout('blocked');
            this.agent.showStateBadge('BLOCK');
            break;
          case 'reviewing':
            this.agent.showStatusCallout(
              task ? `review: ${task.title}` : 'review',
            );
            this.agent.showStateBadge('REVIEW');
            break;
          case 'celebrating':
            this.agent.showStatusCallout('verified complete');
            this.agent.showStateBadge('DONE');
            break;
          case 'idle':
            this.agent.showStateBadge('IDLE');
            if (zone === 'break_room') {
              this.agent.showStatusCallout('standby');
            }
            break;
          case 'moving':
            // Keep current state badge during movement — don't change
            break;
        }
      }
      this.previousActivity = activity;

      switch (activity) {
        case 'idle':
          void this.agent.setAnimation('idle');
          this.setActive(false);
          break;
        case 'moving':
          void this.agent.setAnimation('walk');
          this.setActive(true);
          break;
        case 'working':
          void this.agent.setAnimation('work');
          this.workingUntil = performance.now() + WORK_DURATION_MS;
          this.setActive(true);
          break;
        case 'blocked':
          void this.agent.setAnimation('block');
          this.agent.showBlockedFx();
          this.setActive(true);
          break;
        case 'reviewing':
          void this.agent.setAnimation('work');
          this.setActive(true);
          break;
        case 'celebrating':
          if (!this.reducedMotion) {
            void this.agent.setAnimation('cheer');
            if (this.cheerTimeout) clearTimeout(this.cheerTimeout);
            this.cheerTimeout = setTimeout(() => {
              this.cheerTimeout = null;
              const snap = this.machine.getSnapshot();
              const top = typeof snap.value === 'string' ? snap.value : Object.keys(snap.value)[0];
              if (top === 'celebrating') {
                this.machine.send({ type: 'CELEBRATION_DONE' });
              }
            }, CHEER_DURATION_MS);
          } else {
            void this.agent.setAnimation('idle');
            this.machine.send({ type: 'CELEBRATION_DONE' });
          }
          this.setActive(true);
          break;
      }
    });
  }

  private walkToZone(zoneId: AgentZone): void {
    if (zoneId === 'home') return;
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) return;

    const col = Math.floor((zone.colRange[0] + zone.colRange[1]) / 2);
    const row = Math.floor((zone.rowRange[0] + zone.rowRange[1]) / 2);
    this.moveTo({ col, row });
  }

  /**
   * Phase 2 fix: public entry point for external (dashboard data layer) zone
   * sync. Mirrors the private walkToZone so the GameRuntime can route derived
   * zones from useOfficeStore FSMs to the visual agent without duplicating
   * the zone-center resolution logic. findPath now resolves blocked centers
   * to the nearest walkable tile (fix #2), so this works for workstations and
   * collaboration whose centers sit on furniture.
   */
  walkToZoneExternal(zoneId: string): void {
    if (zoneId === 'home') return;
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) return;
    const col = Math.floor((zone.colRange[0] + zone.colRange[1]) / 2);
    const row = Math.floor((zone.rowRange[0] + zone.rowRange[1]) / 2);
    this.moveTo({ col, row });
  }

  /**
   * Begin a reconnect catch-up animation from the agent's current grid
   * position to the given target grid cell. The animation runs for 1 second
   * (ease-out cubic) and supersedes normal pathfinding movement while active.
   *
   * If the agent is already within the distance epsilon of the target, no
   * animation is started — the agent is snapped to the exact target instead.
   *
   * Phase 3 / Sora stability audit #6 / R10.
   *
   * Returns true if a catch-up animation was started, false if the agent was
   * already at the target (no animation needed).
   */
  beginCatchUp(toCol: number, toRow: number, now: number = performance.now()): boolean {
    if (!shouldCatchUp(this.agent.col, this.agent.row, toCol, toRow)) {
      // Already at the target — just snap and signal no animation.
      this.agent.setGrid(toCol, toRow);
      this.catchUp = null;
      return false;
    }
    // Cancel any in-flight pathfinding; catch-up takes over visual position.
    this.path = [];
    this.waypointIndex = 0;
    this.isMoving = false;
    this.catchUp = createCatchUpState(
      this.agent.col,
      this.agent.row,
      toCol,
      toRow,
      now,
    );
    return true;
  }

  /**
   * Begin a catch-up animation toward the center of a named zone. Convenience
   * wrapper around {@link beginCatchUp} that resolves the zone center cell.
   */
  beginCatchUpToZone(zoneId: string, now: number = performance.now()): boolean {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) return false;
    const col = Math.floor((zone.colRange[0] + zone.colRange[1]) / 2);
    const row = Math.floor((zone.rowRange[0] + zone.rowRange[1]) / 2);
    return this.beginCatchUp(col, row, now);
  }

  get id(): string { return this.agent.id; }
  get col(): number { return this.agent.col; }
  get row(): number { return this.agent.row; }
  get depth(): number { return isoDepth(this.agent.col, this.agent.row); }
  get isActive(): boolean { return this._isActive; }
  /** True while a reconnect catch-up animation is in progress. */
  get isCatchUpActive(): boolean { return this.catchUp !== null; }

  private setActive(active: boolean): void {
    if (this._isActive === active) return;
    this._isActive = active;
    this.onActiveChange?.(active);
  }

  moveTo(target: GridCell): boolean {
    // A new explicit path cancels any active catch-up animation.
    this.catchUp = null;
    if (target.col === this.agent.col && target.row === this.agent.row) {
      this.stop();
      return true;
    }

    const path = findPath(
      { col: this.agent.col, row: this.agent.row },
      target,
    );
    if (path.length <= 1) {
      return false;
    }

    if (this.reducedMotion) {
      const dest = path[path.length - 1];
      this.agent.setGrid(dest.col, dest.row);
      this.path = [];
      this.waypointIndex = 0;
      this.isMoving = false;
      this.machine.send({ type: 'ARRIVED' });
      return true;
    }

    this.path = path;
    this.waypointIndex = 1;
    this.isMoving = true;
    return true;
  }

  stop(): void {
    this.path = [];
    this.waypointIndex = 0;
    this.isMoving = false;
    this.workingUntil = 0;
    this.catchUp = null;
    if (this.cheerTimeout) {
      clearTimeout(this.cheerTimeout);
      this.cheerTimeout = null;
    }
    const { x, y } = gridToScreen(this.agent.col, this.agent.row);
    this.agent.setPosition(x, y);
  }

  update(): boolean {
    const snapshot = this.machine.getSnapshot();
    const state = getAgentState(snapshot).activity;

    // Reconnect catch-up animation takes precedence over normal pathfinding.
    // The agent visually lerps from its old grid position to the new zone
    // center over 1 second (ease-out cubic) instead of snap-teleporting.
    // Phase 3 / Sora stability audit #6 / R10.
    if (this.catchUp) {
      const now = performance.now();
      const sample = sampleCatchUp(this.catchUp, now);
      // Set the visual position to the interpolated grid cell. We use
      // setGrid so depth sorting tracks the interpolated position.
      this.agent.setGrid(sample.col, sample.row);
      // Force the walk animation so the agent looks alive during catch-up.
      // setAnimation is async and may reject if the agent's body has been
      // destroyed (e.g. during teardown); swallow that — position is the
      // important part, the animation is cosmetic.
      void this.agent.setAnimation('walk').catch(() => {});
      this.setActive(true);
      if (sample.done) {
        // Snap to exact target and resume normal behaviour.
        this.agent.setGrid(this.catchUp.toCol, this.catchUp.toRow);
        this.catchUp = null;
      }
      return true;
    }

    if (state === 'working') {
      if (performance.now() >= this.workingUntil) {
        this.machine.send({ type: 'ARRIVED' });
      }
      return false;
    }

    if (!this.isMoving || this.waypointIndex >= this.path.length) {
      if (this.isMoving) {
        this.arrive();
        return true;
      }
      return false;
    }

    const target = this.path[this.waypointIndex];
    const targetScreen = gridToScreen(target.col, target.row);
    const dx = targetScreen.x - this.agent.container.x;
    const dy = targetScreen.y - this.agent.container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= WAYPOINT_ARRIVE_EPSILON) {
      this.agent.setGrid(target.col, target.row);
      this.waypointIndex++;
      if (this.waypointIndex >= this.path.length) {
        this.arrive();
      }
      return true;
    }

    const step = Math.min(dist, MOVE_SPEED);
    const nx = dx / dist;
    const ny = dy / dist;
    this.agent.setPosition(
      this.agent.container.x + nx * step,
      this.agent.container.y + ny * step,
    );

    const { col, row } = this.screenToGrid(this.agent.container.x, this.agent.container.y);
    this.agent.setGrid(col, row);
    return true;
  }

  setAnimation(id: AnimationId): void {
    void this.agent.setAnimation(id);
  }

  destroy(): void {
    this.stop();
    this.machine.stop();
    this.agent.destroy();
  }

  sendEvent(event: Parameters<AgentMachineActor['send']>[0]): void {
    this.machine.send(event);
  }

  private arrive(): void {
    if (this.path.length > 0) {
      const destination = this.path[this.path.length - 1];
      this.agent.setGrid(destination.col, destination.row);
    }
    this.path = [];
    this.waypointIndex = 0;
    this.isMoving = false;
    this.machine.send({ type: 'ARRIVED' });
  }

  private screenToGrid(x: number, y: number): GridCell {
    const halfW = 64;
    const halfH = 32;
    const sum = y / halfH;
    const diff = x / halfW;
    const col = Math.round((sum + diff) / 2);
    const row = Math.round((sum - diff) / 2);
    return { col, row };
  }
}