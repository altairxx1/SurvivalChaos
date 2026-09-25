/**
 * Map layout for Survival Chaos. PLACEHOLDER geometry derived from the known topology
 * (4 bases at the centre of each edge, 3 lanes per base, contested middle).
 * tools/extract/build-map.ts will replace these numbers with the ones from war3mapUnits.doo / w3r.
 *
 * Base-local frame: origin on the edge centre, +u points into the map, +v points toward the
 * clockwise neighbour (slots in clockwise order: left, top, right, bottom).
 */
import type { BuildingKind, LaneDir, Slot } from '../../sim/defs/types';

export interface LocalPlacement { kind: BuildingKind; u: number; v: number; lane?: LaneDir }

export const MAP_LAYOUT = {
  id: 'survival-chaos',
  name: 'Survival Chaos',
  halfSize: 6656,           // playable area is [-halfSize, halfSize]^2 (104 x 104 WC3 tiles)
  baseInset: 900,           // distance from the map edge to the base origin
  laneInset: 1250,          // distance from the map edge to the edge lanes
  slots: ['left', 'top', 'right', 'bottom'] as Slot[],   // clockwise order
  placements: [
    { kind: 'fortress', u: -120, v: 0 },
    { kind: 'barracks', u: 700, v: 0, lane: 'cross' },
    { kind: 'barracks', u: 350, v: 950, lane: 'cw' },
    { kind: 'barracks', u: 350, v: -950, lane: 'ccw' },
    { kind: 'tower', u: 1150, v: 380 },
    { kind: 'tower', u: 1150, v: -380 },
    { kind: 'tower', u: 700, v: 1450 },
    { kind: 'tower', u: 700, v: -1450 },
    { kind: 'altar', u: -250, v: 620 },
    { kind: 'forge', u: -250, v: -620 },
    { kind: 'sanctum', u: 80, v: 1500 },
    { kind: 'goldAltar', u: 80, v: -1500 },
    { kind: 'mercCamp', u: -380, v: 1180 },
  ] as LocalPlacement[],
};
