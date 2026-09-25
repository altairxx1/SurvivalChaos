import type { PlacedUnit } from './parsers/formats';

export interface OwnerCluster { owner: number; count: number; cx: number; cy: number; slot?: 'left' | 'top' | 'right' | 'bottom'; types: { id: string; name?: string; n: number }[]; objects: { id: string; name?: string; x: number; y: number }[] }

/**
 * Groups pre-placed objects by owning player and assigns each large cluster to a map edge.
 * Buildings of the 4 player bases are expected at the centre of each edge (see MAP_LAYOUT).
 * The result is reviewed by a human and then mapped to building kinds via overrides/building-ids.json.
 */
export function inferLayout(units: PlacedUnit[], names: Record<string, string>, bounds: { minX: number; minY: number; maxX: number; maxY: number } | null) {
  const owners = new Map<number, PlacedUnit[]>();
  for (const u of units) { if (!owners.has(u.owner)) owners.set(u.owner, []); owners.get(u.owner)!.push(u); }
  const cx0 = bounds ? (bounds.minX + bounds.maxX) / 2 : 0, cy0 = bounds ? (bounds.minY + bounds.maxY) / 2 : 0;
  const clusters: OwnerCluster[] = [...owners.entries()].map(([owner, list]) => {
    const cx = list.reduce((a, u) => a + u.x, 0) / list.length, cy = list.reduce((a, u) => a + u.y, 0) / list.length;
    const byType = new Map<string, number>(); for (const u of list) byType.set(u.id, (byType.get(u.id) ?? 0) + 1);
    const dx = cx - cx0, dy = cy - cy0;
    const slot = Math.hypot(dx, dy) < 800 ? undefined : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'bottom' : 'top');
    return { owner, count: list.length, cx, cy, slot, types: [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: names[id], n })),
      objects: list.map(u => ({ id: u.id, name: names[u.id], x: Math.round(u.x), y: Math.round(u.y) })) } as OwnerCluster;
  }).sort((a, b) => b.count - a.count);
  return { center: { x: cx0, y: cy0 }, bounds, owners: clusters };
}
