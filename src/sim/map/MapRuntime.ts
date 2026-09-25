import type { BuildingKind, LaneDir, Slot } from '../defs/types';
import type { LocalPlacement } from '../../data/maps/survivalChaos';

export interface MapLayoutData {
  id: string; name: string; halfSize: number; baseInset: number; laneInset: number;
  slots: Slot[]; placements: LocalPlacement[];
}
export interface Vec2 { x: number; y: number }
export interface WorldPlacement { kind: BuildingKind; x: number; y: number; lane?: LaneDir; facing: number }
/** A lane path owned by one player, walking toward one target player. */
export interface LanePath { owner: number; target: number; dir: LaneDir; points: Vec2[] }

const FRAMES: Record<Slot, { ox: number; oy: number; ux: number; uy: number; vx: number; vy: number; facing: number }> = {
  left: { ox: -1, oy: 0, ux: 1, uy: 0, vx: 0, vy: 1, facing: 0 },
  top: { ox: 0, oy: 1, ux: 0, uy: -1, vx: 1, vy: 0, facing: -Math.PI / 2 },
  right: { ox: 1, oy: 0, ux: -1, uy: 0, vx: 0, vy: -1, facing: Math.PI },
  bottom: { ox: 0, oy: -1, ux: 0, uy: 1, vx: -1, vy: 0, facing: Math.PI / 2 },
};

/**
 * Converts the base-local layout into world coordinates and builds the 12 lane paths
 * (3 per player). Pure and deterministic.
 */
export class MapRuntime {
  readonly half: number;
  readonly lanes: LanePath[] = [];

  constructor(readonly layout: MapLayoutData) { this.half = layout.halfSize; }

  slotIndex(s: Slot): number { return this.layout.slots.indexOf(s); }
  slotOf(i: number): Slot { return this.layout.slots[i]!; }

  /** base-local (u, v) -> world */
  world(slot: Slot, u: number, v: number): Vec2 {
    const f = FRAMES[slot];
    const ox = f.ox * (this.half - this.layout.baseInset), oy = f.oy * (this.half - this.layout.baseInset);
    return { x: ox + f.ux * u + f.vx * v, y: oy + f.uy * u + f.vy * v };
  }
  facing(slot: Slot): number { return FRAMES[slot].facing; }

  placements(slot: Slot): WorldPlacement[] {
    return this.layout.placements.map(p => ({ kind: p.kind, lane: p.lane, facing: this.facing(slot), ...this.world(slot, p.u, p.v) }));
  }
  private local(kind: BuildingKind, lane?: LaneDir): LocalPlacement {
    const p = this.layout.placements.find(q => q.kind === kind && (lane === undefined || q.lane === lane));
    if (!p) throw new Error(`layout has no ${kind} ${lane ?? ''}`);
    return p;
  }
  fortressPos(slot: Slot): Vec2 { const p = this.local('fortress'); return this.world(slot, p.u, p.v); }
  barracksPos(slot: Slot, lane: LaneDir): Vec2 { const p = this.local('barracks', lane); return this.world(slot, p.u, p.v); }

  /** Target slot index for a lane of the player in slot index i (4 slot map). */
  laneTarget(i: number, dir: LaneDir): number { const n = this.layout.slots.length; return dir === 'cw' ? (i + 1) % n : dir === 'ccw' ? (i + n - 1) % n : (i + 2) % n; }

  /** Builds the lane path for a player index (slot index) and direction. */
  buildLane(i: number, dir: LaneDir): LanePath {
    const s = this.slotOf(i); const j = this.laneTarget(i, dir); const t = this.slotOf(j);
    const H = this.half, L = this.layout.laneInset, B = this.layout.baseInset;
    let points: Vec2[];
    if (dir === 'cross') {
      points = [this.barracksPos(s, 'cross'), { x: 0, y: 0 }, this.barracksPos(t, 'cross'), this.fortressPos(t)];
    } else {
      const sign = dir === 'cw' ? 1 : -1;
      const start = this.barracksPos(s, dir);
      const corner = this.world(s, L - B, sign * (H - L));
      const end = this.barracksPos(t, dir === 'cw' ? 'ccw' : 'cw');
      points = [start, corner, end, this.fortressPos(t)];
    }
    return { owner: i, target: j, dir, points };
  }

  buildAllLanes(): void {
    this.lanes.length = 0;
    for (let i = 0; i < this.layout.slots.length; i++) for (const d of ['ccw', 'cross', 'cw'] as LaneDir[]) this.lanes.push(this.buildLane(i, d));
  }
  laneIndex(owner: number, dir: LaneDir): number { return this.lanes.findIndex(l => l.owner === owner && l.dir === dir); }

  /** Distance from a point to the nearest segment of a lane polyline. */
  static distToPath(pts: Vec2[], x: number, y: number): number {
    let best = Infinity;
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]!, b = pts[k + 1]!; const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a.x + dx * t - x, py = a.y + dy * t - y; const d = px * px + py * py;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}
