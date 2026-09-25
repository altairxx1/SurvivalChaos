/**
 * Parsers for the Warcraft III map files inside a .w3x. Tolerant of classic (1.2x-1.31) and Reforged (1.32+) versions.
 * Only numbers/geometry/ids are extracted; no art or sound.
 */
export class Reader {
  pos = 0;
  constructor(readonly b: Buffer) {}
  get left(): number { return this.b.length - this.pos; }
  i32(): number { const v = this.b.readInt32LE(this.pos); this.pos += 4; return v; }
  u32(): number { const v = this.b.readUInt32LE(this.pos); this.pos += 4; return v; }
  i16(): number { const v = this.b.readInt16LE(this.pos); this.pos += 2; return v; }
  u16(): number { const v = this.b.readUInt16LE(this.pos); this.pos += 2; return v; }
  u8(): number { return this.b[this.pos++]!; }
  f32(): number { const v = this.b.readFloatLE(this.pos); this.pos += 4; return v; }
  id(): string { const s = this.b.toString('latin1', this.pos, this.pos + 4); this.pos += 4; return s; }
  str(): string { const end = this.b.indexOf(0, this.pos); const e = end < 0 ? this.b.length : end; const s = this.b.toString('utf8', this.pos, e); this.pos = e + 1; return s; }
  skip(n: number): void { this.pos += n; }
}

// ---------------------------------------------------------------- war3map.wts
export function parseWts(buf: Buffer): Record<number, string> {
  const txt = buf.toString('utf8').replace(/^﻿/, ''); const out: Record<number, string> = {};
  const re = /STRING\s+(\d+)[^{]*\{\r?\n?([\s\S]*?)\r?\n?\}/g; let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) out[Number(m[1])] = m[2]!;
  return out;
}
export function resolveTrigStr(s: string, wts: Record<number, string>): string {
  return s.replace(/TRIGSTR_(\d+)/g, (_, n) => wts[Number(n)] ?? `TRIGSTR_${n}`);
}

// ---------------------------------------------------------------- war3map.w3i
export interface MapInfo { version: number; name: string; author: string; description: string; players: string; playableWidth: number; playableHeight: number; tileset: string; cameraBounds: number[]; flags: number }
export function parseW3i(buf: Buffer): MapInfo {
  const r = new Reader(buf); const version = r.i32(); r.i32(); r.i32();
  if (version >= 28) r.skip(16);
  const name = r.str(), author = r.str(), description = r.str(), players = r.str();
  const cameraBounds = Array.from({ length: 8 }, () => r.f32()); r.skip(16);
  const playableWidth = r.i32(), playableHeight = r.i32(), flags = r.i32(); const tileset = String.fromCharCode(r.u8());
  return { version, name, author, description, players, playableWidth, playableHeight, tileset, cameraBounds, flags };
}

// ---------------------------------------------------------------- war3map.w3e (terrain)
export interface Terrain { version: number; tileset: string; groundTiles: string[]; cliffTiles: string[]; width: number; height: number; offsetX: number; offsetY: number;
  /** world z per vertex (row-major, y up from offsetY) */ heights: Float32Array; water: Float32Array; ground: Uint8Array; flags: Uint8Array; layer: Uint8Array; cliff: Uint8Array }
export function parseW3e(buf: Buffer): Terrain {
  const r = new Reader(buf);
  if (r.id() !== 'W3E!') throw new Error('not a w3e file');
  const version = r.i32(); const tileset = String.fromCharCode(r.u8()); r.i32();
  const groundTiles = Array.from({ length: r.i32() }, () => r.id()); const cliffTiles = Array.from({ length: r.i32() }, () => r.id());
  const width = r.i32(), height = r.i32(); const offsetX = r.f32(), offsetY = r.f32();
  const n = width * height; const stride = Math.round(r.left / n);
  if (stride !== 7 && stride !== 8) throw new Error(`unexpected tile record size ${r.left / n}`);
  const heights = new Float32Array(n), water = new Float32Array(n), ground = new Uint8Array(n), flags = new Uint8Array(n), layer = new Uint8Array(n), cliff = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const h = r.i16(); const w = r.i16();
    let tex: number, fl: number;
    if (stride === 8) { const v = r.u16(); tex = v & 0x3f; fl = v >> 6; } else { const v = r.u8(); tex = v & 0x0f; fl = v >> 4; }
    r.u8(); // texture details
    const lc = r.u8(); cliff[i] = lc >> 4; layer[i] = lc & 0x0f;
    ground[i] = tex; flags[i] = fl;
    heights[i] = (h - 0x2000 + (layer[i]! - 2) * 0x200) / 4;
    water[i] = ((w & 0x3fff) - 0x2000) / 4 - 89.6;
    if (w & 0x4000) flags[i]! |= 0x80;           // boundary
  }
  return { version, tileset, groundTiles, cliffTiles, width, height, offsetX, offsetY, heights, water, ground, flags, layer, cliff };
}

// ---------------------------------------------------------------- war3map.doo (doodads/destructables)
export interface Doodad { id: string; variation: number; x: number; y: number; z: number; angle: number; scale: [number, number, number]; life: number; editorId: number }
export function parseDoo(buf: Buffer): { version: number; doodads: Doodad[] } {
  const r = new Reader(buf);
  if (r.id() !== 'W3do') throw new Error('not a doo file');
  const version = r.i32(), sub = r.i32(); const count = r.i32(); const doodads: Doodad[] = [];
  const reforged = sub >= 11;
  for (let i = 0; i < count && r.left > 0; i++) {
    const id = r.id(); const variation = r.i32(); const x = r.f32(), y = r.f32(), z = r.f32(); const angle = r.f32(); const scale: [number, number, number] = [r.f32(), r.f32(), r.f32()];
    if (reforged) r.skip(4);
    r.u8(); const life = r.u8();
    if (version >= 8) { r.i32(); const sets = r.i32(); for (let s = 0; s < sets; s++) { const items = r.i32(); r.skip(items * 8); } }
    const editorId = r.i32();
    doodads.push({ id, variation, x, y, z, angle, scale, life, editorId });
  }
  return { version, doodads };
}

// ---------------------------------------------------------------- war3mapUnits.doo (pre-placed units, buildings, start locations)
export interface PlacedUnit { id: string; x: number; y: number; z: number; angle: number; owner: number; hp: number; mana: number; heroLevel: number; editorId: number }
export function parseUnitsDoo(buf: Buffer): { version: number; units: PlacedUnit[] } {
  const r = new Reader(buf);
  if (r.id() !== 'W3do') throw new Error('not a units doo file');
  const version = r.i32(), sub = r.i32(); const count = r.i32(); const units: PlacedUnit[] = [];
  const reforged = sub >= 11;
  for (let i = 0; i < count && r.left > 0; i++) {
    const id = r.id(); r.i32(); const x = r.f32(), y = r.f32(), z = r.f32(); const angle = r.f32(); r.skip(12);
    if (reforged) r.skip(4);
    r.u8(); const owner = r.i32(); r.u8(); r.u8(); const hp = r.i32(), mana = r.i32();
    if (version >= 8) r.i32();
    const sets = r.i32(); for (let s = 0; s < sets; s++) { const items = r.i32(); r.skip(items * 8); }
    r.i32(); r.f32(); const heroLevel = r.i32();
    if (version >= 8) r.skip(12);
    const inv = r.i32(); r.skip(inv * 8);
    const abil = r.i32(); r.skip(abil * 12);
    const rnd = r.i32();
    if (rnd === 0) r.skip(4); else if (rnd === 1) r.skip(8); else if (rnd === 2) { const n = r.i32(); r.skip(n * 8); }
    r.i32(); r.i32(); const editorId = r.i32();
    units.push({ id, x, y, z, angle, owner, hp, mana, heroLevel, editorId });
  }
  return { version, units };
}

// ---------------------------------------------------------------- object data (w3u w3t w3b w3h | w3a w3d w3q)
export type ModValue = number | string;
export interface ObjectMod { field: string; level: number; data: number; value: ModValue }
export interface ObjectDef { base: string; id: string; custom: boolean; mods: ObjectMod[] }
export function parseObjects(buf: Buffer, withLevels: boolean): { version: number; objects: ObjectDef[] } {
  const r = new Reader(buf); const version = r.i32(); const objects: ObjectDef[] = [];
  for (const custom of [false, true]) {
    if (r.left < 4) break;
    const count = r.i32();
    for (let i = 0; i < count && r.left > 0; i++) {
      const base = r.id(); const nid = r.id(); const id = custom ? nid : base;
      const sets = version >= 3 ? r.i32() : 1; const mods: ObjectMod[] = [];
      for (let s = 0; s < sets; s++) {
        if (version >= 3) r.i32(); // set flags
        const n = r.i32();
        for (let k = 0; k < n; k++) {
          const field = r.id(); let level = 0, data = 0;
          if (withLevels) { level = r.i32(); data = r.i32(); }
          const type = r.i32(); let value: ModValue;
          if (type === 0) value = r.i32(); else if (type === 1 || type === 2) value = r.f32(); else value = r.str();
          r.skip(4); // end token
          mods.push({ field, level, data, value });
        }
      }
      objects.push({ base, id, custom, mods });
    }
  }
  return { version, objects };
}

/** Flattens an ObjectDef into { fieldName[level]: value } using a field-name dictionary. */
export function flattenObject(o: ObjectDef, names: Record<string, string>, wts: Record<number, string>): Record<string, ModValue> {
  const out: Record<string, ModValue> = { _id: o.id, _base: o.base };
  for (const m of o.mods) {
    const key = (names[m.field] ?? m.field) + (m.level ? `@${m.level}` : '') + (m.data ? `#${'?ABCDEFGHI'[m.data] ?? m.data}` : '');
    out[key] = typeof m.value === 'string' ? resolveTrigStr(m.value, wts) : m.value;
  }
  return out;
}
