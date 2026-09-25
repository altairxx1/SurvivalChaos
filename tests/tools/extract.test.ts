import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { encrypt, fileKey, hashString, decrypt } from '../../tools/extract/mpq/Crypto';
import { MpqArchive, FLAG_COMPRESS, FLAG_ENCRYPTED, FLAG_EXISTS, FLAG_SINGLE_UNIT } from '../../tools/extract/mpq/MpqArchive';
import { parseObjects, parseUnitsDoo, parseW3e, parseWts, flattenObject } from '../../tools/extract/parsers/formats';
import { UNIT_FIELDS } from '../../tools/extract/meta/fields';
import { inferLayout } from '../../tools/extract/layout';

function encBytes(b: Buffer, key: number): Buffer {
  const n = Math.floor(b.length / 4); const u = new Uint32Array(n); for (let i = 0; i < n; i++) u[i] = b.readUInt32LE(i * 4);
  encrypt(u, key); const o = Buffer.from(b); for (let i = 0; i < n; i++) o.writeUInt32LE(u[i]!, i * 4); return o;
}

/** Builds a small MPQ v1 archive (512-byte W3M header first, like a real .w3x). */
function buildMpq(files: { name: string; data: Buffer; single?: boolean }[]): Buffer {
  const SECTOR = 4096; const HASH_N = 16; const w3mHeader = Buffer.alloc(512); w3mHeader.write('HM3W', 0, 'latin1');
  const bodies: Buffer[] = []; const blocks: number[][] = []; let pos = 32;
  for (const f of files) {
    const offset = pos; let body: Buffer; let flags = FLAG_EXISTS | FLAG_COMPRESS | FLAG_ENCRYPTED;
    const key = fileKey(f.name, offset, f.data.length, false);
    if (f.single) {
      flags |= FLAG_SINGLE_UNIT; const c = Buffer.concat([Buffer.from([2]), deflateSync(f.data)]); body = encBytes(c.length < f.data.length ? c : Buffer.from(f.data), key);
    } else {
      const n = Math.ceil(f.data.length / SECTOR); const sectors: Buffer[] = [];
      for (let s = 0; s < n; s++) { const raw = f.data.subarray(s * SECTOR, (s + 1) * SECTOR); const c = Buffer.concat([Buffer.from([2]), deflateSync(raw)]); sectors.push(encBytes(c.length < raw.length ? c : Buffer.from(raw), (key + s) >>> 0)); }
      const table = new Uint32Array(n + 1); let o = (n + 1) * 4; for (let s = 0; s < n; s++) { table[s] = o; o += sectors[s]!.length; } table[n] = o;
      encrypt(table, (key - 1) >>> 0); const tb = Buffer.alloc((n + 1) * 4); table.forEach((v, i) => tb.writeUInt32LE(v, i * 4));
      body = Buffer.concat([tb, ...sectors]);
    }
    bodies.push(body); blocks.push([offset, body.length, f.data.length, flags]); pos += body.length;
  }
  const hash = new Uint32Array(HASH_N * 4).fill(0xffffffff);
  files.forEach((f, bi) => { let i = hashString(f.name, 0) % HASH_N; while (hash[i * 4 + 3] !== 0xffffffff) i = (i + 1) % HASH_N; hash.set([hashString(f.name, 1), hashString(f.name, 2), 0, bi], i * 4); });
  const block = new Uint32Array(blocks.flat());
  encrypt(hash, hashString('(hash table)', 3)); encrypt(block, hashString('(block table)', 3));
  const hashPos = pos, blockPos = pos + HASH_N * 16;
  const header = Buffer.alloc(32); header.writeUInt32LE(0x1a51504d, 0); header.writeUInt32LE(32, 4); header.writeUInt32LE(blockPos + files.length * 16, 8);
  header.writeUInt16LE(0, 12); header.writeUInt16LE(3, 14); header.writeUInt32LE(hashPos, 16); header.writeUInt32LE(blockPos, 20); header.writeUInt32LE(HASH_N, 24); header.writeUInt32LE(files.length, 28);
  const tbl = (u: Uint32Array) => { const b = Buffer.alloc(u.length * 4); u.forEach((v, i) => b.writeUInt32LE(v, i * 4)); return b; };
  return Buffer.concat([w3mHeader, header, ...bodies, tbl(hash), tbl(block)]);
}

describe('MPQ', () => {
  it('encrypt/decrypt round trip and known hash values', () => {
    const d = new Uint32Array([1, 2, 3, 0xdeadbeef]); const c = new Uint32Array(d); encrypt(c, 0x1234); expect(c).not.toEqual(d); decrypt(c, 0x1234); expect(c).toEqual(d);
    // StormLib reference values for the table keys
    expect(hashString('(hash table)', 3)).toBe(0xc3af3770);
    expect(hashString('(block table)', 3)).toBe(0xec83b3a3);
  });
  it('reads multi-sector encrypted zlib files and single-unit files by name', () => {
    const big = Buffer.alloc(10000); for (let i = 0; i < big.length; i++) big[i] = (i * 7) & 0xff;
    const mpq = new MpqArchive(buildMpq([{ name: 'war3map.w3e', data: big }, { name: 'war3map.wts', data: Buffer.from('STRING 1\n{\nHello\n}\n'), single: true }]));
    expect(mpq.read('war3map.w3e')!.equals(big)).toBe(true);
    expect(mpq.read('WAR3MAP.WTS')!.toString()).toContain('Hello');
    expect(mpq.read('missing.txt')).toBeNull();
  });
});

describe('WC3 format parsers', () => {
  it('parses wts strings', () => { expect(parseWts(Buffer.from('STRING 3\n{\nFootman\n}\nSTRING 7 // c\n{\nMulti\nLine\n}\n'))).toEqual({ 3: 'Footman', 7: 'Multi\nLine' }); });

  it('parses w3e terrain (classic 7-byte tiles)', () => {
    const w = 3, h = 2; const hd = Buffer.alloc(4 + 4 + 1 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4);
    let o = 0; hd.write('W3E!', o, 'latin1'); o += 4; hd.writeInt32LE(11, o); o += 4; hd.write('L', o, 'latin1'); o += 1; hd.writeInt32LE(0, o); o += 4;
    hd.writeInt32LE(1, o); o += 4; hd.write('Ldrt', o, 'latin1'); o += 4; hd.writeInt32LE(1, o); o += 4; hd.write('CLdi', o, 'latin1'); o += 4;
    hd.writeInt32LE(w, o); o += 4; hd.writeInt32LE(h, o); o += 4;
    const tail = Buffer.alloc(8); tail.writeFloatLE(-256, 0); tail.writeFloatLE(-128, 4);
    const tiles = Buffer.alloc(w * h * 7); for (let i = 0; i < w * h; i++) { tiles.writeInt16LE(0x2000 + i * 4, i * 7); tiles.writeInt16LE(0x2000, i * 7 + 2); tiles[i * 7 + 4] = 0x20 | (i % 2); tiles[i * 7 + 6] = 0x02; }
    const t = parseW3e(Buffer.concat([hd.subarray(0, o), tail, tiles]));
    expect(t.width).toBe(3); expect(t.groundTiles).toEqual(['Ldrt']); expect(t.offsetX).toBe(-256);
    expect(Array.from(t.heights)).toEqual([0, 1, 2, 3, 4, 5]); expect(t.ground[1]).toBe(1); expect(t.layer[0]).toBe(2);
  });

  it('parses object data (units, classic v2) and resolves field names', () => {
    const parts: Buffer[] = []; const i32 = (v: number) => { const b = Buffer.alloc(4); b.writeInt32LE(v); parts.push(b); }; const id = (s: string) => parts.push(Buffer.from(s, 'latin1'));
    i32(2); i32(0); i32(1); id('hfoo'); id('h000'); i32(2);
    id('uhpm'); i32(0); i32(420); id('\0\0\0\0');
    id('unam'); i32(3); parts.push(Buffer.from('TRIGSTR_5\0')); id('\0\0\0\0');
    const o = parseObjects(Buffer.concat(parts), false);
    expect(o.objects[0]).toMatchObject({ base: 'hfoo', id: 'h000', custom: true });
    expect(flattenObject(o.objects[0]!, UNIT_FIELDS, { 5: 'Footman' })).toMatchObject({ hp: 420, name: 'Footman' });
  });

  it('parses placed units and infers base slots', () => {
    const rec = (idStr: string, x: number, y: number, owner: number) => {
      const b: Buffer[] = []; const i32 = (v: number) => { const x = Buffer.alloc(4); x.writeInt32LE(v); b.push(x); }; const f = (v: number) => { const x = Buffer.alloc(4); x.writeFloatLE(v); b.push(x); };
      b.push(Buffer.from(idStr, 'latin1')); i32(0); f(x); f(y); f(0); f(0); f(1); f(1); f(1); b.push(Buffer.from([2])); i32(owner); b.push(Buffer.from([0, 0])); i32(-1); i32(-1); i32(-1); i32(0);
      i32(0); f(-1); i32(1); i32(0); i32(0); i32(0); i32(0); i32(0); i32(-1); i32(-1); i32(-1); i32(7);
      return Buffer.concat(b);
    };
    const head = Buffer.alloc(16); head.write('W3do', 0, 'latin1'); head.writeInt32LE(8, 4); head.writeInt32LE(11, 8); head.writeInt32LE(3, 12);
    // reforged subversion 11 includes a 4-byte skin id after scale: insert it
    const withSkin = (b: Buffer) => Buffer.concat([b.subarray(0, 36), Buffer.from('hfoo', 'latin1'), b.subarray(36)]);
    const buf = Buffer.concat([head, withSkin(rec('htow', -5000, 10, 0)), withSkin(rec('hbar', -4500, 900, 0)), withSkin(rec('otrb', 5000, 0, 2))]);
    const u = parseUnitsDoo(buf).units;
    expect(u.map(x => [x.id, x.owner])).toEqual([['htow', 0], ['hbar', 0], ['otrb', 2]]);
    const lay = inferLayout(u, { htow: 'Town Hall' }, { minX: -6000, minY: -6000, maxX: 6000, maxY: 6000 });
    expect(lay.owners.find(o => o.owner === 0)!.slot).toBe('left');
    expect(lay.owners.find(o => o.owner === 2)!.slot).toBe('right');
  });
});
