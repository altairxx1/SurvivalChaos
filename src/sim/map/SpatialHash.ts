/** Uniform grid for neighbour queries. Rebuilt every tick; iteration order is deterministic (insertion order). */
export class SpatialHash {
  private cells = new Map<number, number[]>();
  constructor(readonly cellSize: number) {}
  private key(cx: number, cy: number): number { return (cx + 512) * 4096 + (cy + 512); }
  clear(): void { for (const a of this.cells.values()) a.length = 0; }
  insert(id: number, x: number, y: number): void {
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    let a = this.cells.get(k); if (!a) { a = []; this.cells.set(k, a); } a.push(id);
  }
  /** Calls fn for every id whose cell overlaps the square around (x, y) with the given radius. */
  query(x: number, y: number, r: number, fn: (id: number) => void): void {
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs), y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = this.cells.get(this.key(cx, cy)); if (!a) continue;
      for (let i = 0; i < a.length; i++) fn(a[i]!);
    }
  }
}
