import { inflateSync } from 'node:zlib';
import { decrypt, fileKey, hashString, HASH_A, HASH_B, HASH_OFFSET } from './Crypto';

export const FLAG_IMPLODE = 0x100, FLAG_COMPRESS = 0x200, FLAG_ENCRYPTED = 0x10000, FLAG_FIX_KEY = 0x20000, FLAG_SINGLE_UNIT = 0x1000000, FLAG_SECTOR_CRC = 0x4000000, FLAG_EXISTS = 0x80000000;

interface HashEntry { a: number; b: number; locale: number; block: number }
interface BlockEntry { offset: number; csize: number; size: number; flags: number }

export class UnsupportedCompression extends Error {}

/**
 * Minimal MPQ (v1) reader sufficient for Warcraft III maps: header search, encrypted hash/block tables,
 * lookup by file name (no listfile required), sector tables, encryption and zlib compression.
 * Map protectors often corrupt sizes/listfiles; this reader is tolerant and clamps table sizes to the file.
 * Other compressions (PKWARE implode, bzip2, huffman) raise UnsupportedCompression; use the StormLib fallback.
 */
export class MpqArchive {
  private base = 0; private sectorSize = 4096;
  private hashes: HashEntry[] = []; private blocks: BlockEntry[] = [];

  constructor(readonly buf: Buffer) {
    for (let off = 0; off + 32 <= buf.length; off += 512) {
      if (buf.readUInt32LE(off) === 0x1a51504d) { this.base = off; break; }            // 'MPQ\x1A'
      if (off > 0x100000) throw new Error('No MPQ header found');
    }
    const h = this.base;
    const shift = buf.readUInt16LE(h + 14); this.sectorSize = 512 << (shift & 0x1f);
    const hashPos = buf.readUInt32LE(h + 16), blockPos = buf.readUInt32LE(h + 20);
    let hashCount = buf.readUInt32LE(h + 24), blockCount = buf.readUInt32LE(h + 28);
    // protectors put huge counts here; clamp to what fits in the file
    hashCount = Math.min(hashCount, Math.floor((buf.length - (h + hashPos)) / 16));
    blockCount = Math.min(blockCount, Math.floor((buf.length - (h + blockPos)) / 16));
    const ht = this.readTable(h + hashPos, hashCount, hashString('(hash table)', 3));
    for (let i = 0; i < hashCount; i++) this.hashes.push({ a: ht[i * 4]!, b: ht[i * 4 + 1]!, locale: ht[i * 4 + 2]! & 0xffff, block: ht[i * 4 + 3]! });
    const bt = this.readTable(h + blockPos, blockCount, hashString('(block table)', 3));
    for (let i = 0; i < blockCount; i++) this.blocks.push({ offset: bt[i * 4]!, csize: bt[i * 4 + 1]!, size: bt[i * 4 + 2]!, flags: bt[i * 4 + 3]! });
  }

  private readTable(pos: number, count: number, key: number): Uint32Array {
    const out = new Uint32Array(count * 4);
    for (let i = 0; i < out.length; i++) out[i] = this.buf.readUInt32LE(pos + i * 4);
    decrypt(out, key);
    return out;
  }

  private find(name: string): BlockEntry | undefined {
    if (!this.hashes.length) return undefined;
    const n = this.hashes.length; const start = hashString(name, HASH_OFFSET) % n; const a = hashString(name, HASH_A), b = hashString(name, HASH_B);
    for (let i = 0; i < n; i++) {
      const e = this.hashes[(start + i) % n]!;
      if (e.block === 0xffffffff) return undefined;
      if (e.a === a && e.b === b && e.block < this.blocks.length) { const bl = this.blocks[e.block]!; if (bl.flags & FLAG_EXISTS) return bl; }
    }
    return undefined;
  }

  has(name: string): boolean { return !!this.find(name); }

  read(name: string): Buffer | null {
    const bl = this.find(name); if (!bl) return null;
    const start = this.base + bl.offset;
    const key = bl.flags & FLAG_ENCRYPTED ? fileKey(name, bl.offset, bl.size, !!(bl.flags & FLAG_FIX_KEY)) : 0;
    if (bl.flags & FLAG_SINGLE_UNIT) {
      let raw: Buffer = Buffer.from(this.buf.subarray(start, start + bl.csize));
      if (bl.flags & FLAG_ENCRYPTED) raw = decryptBytes(raw, key);
      return bl.csize < bl.size && (bl.flags & (FLAG_COMPRESS | FLAG_IMPLODE)) ? decompress(raw, bl.size, bl.flags) : raw;
    }
    const nSectors = Math.ceil(bl.size / this.sectorSize);
    const compressed = (bl.flags & (FLAG_COMPRESS | FLAG_IMPLODE)) !== 0;
    let offsets: number[];
    if (compressed) {
      const count = nSectors + 1 + (bl.flags & FLAG_SECTOR_CRC ? 1 : 0);
      const t = new Uint32Array(count); for (let i = 0; i < count; i++) t[i] = this.buf.readUInt32LE(start + i * 4);
      if (bl.flags & FLAG_ENCRYPTED) decrypt(t, (key - 1) >>> 0);
      offsets = Array.from(t);
    } else offsets = Array.from({ length: nSectors + 1 }, (_, i) => Math.min(i * this.sectorSize, bl.csize));
    const parts: Buffer[] = [];
    for (let s = 0; s < nSectors; s++) {
      let raw: Buffer = Buffer.from(this.buf.subarray(start + offsets[s]!, start + offsets[s + 1]!));
      if (bl.flags & FLAG_ENCRYPTED) raw = decryptBytes(raw, (key + s) >>> 0);
      const expect = Math.min(this.sectorSize, bl.size - s * this.sectorSize);
      parts.push(compressed && raw.length < expect ? decompress(raw, expect, bl.flags) : raw);
    }
    return Buffer.concat(parts).subarray(0, bl.size);
  }

  /** Names from the embedded (listfile), if the map still has one. */
  listfile(): string[] { const l = this.read('(listfile)'); return l ? l.toString('latin1').split(/[\r\n;]+/).filter(Boolean) : []; }
}

function decryptBytes(b: Buffer, key: number): Buffer {
  const n = Math.floor(b.length / 4); const u = new Uint32Array(n);
  for (let i = 0; i < n; i++) u[i] = b.readUInt32LE(i * 4);
  decrypt(u, key);
  const out = Buffer.from(b); for (let i = 0; i < n; i++) out.writeUInt32LE(u[i]!, i * 4);
  return out;
}

function decompress(raw: Buffer, size: number, flags: number): Buffer {
  if (flags & FLAG_IMPLODE && !(flags & FLAG_COMPRESS)) throw new UnsupportedCompression('PKWARE implode');
  const type = raw[0]!; const body = raw.subarray(1);
  if (type === 0x02) return inflateSync(body);
  if (type === 0x00) return body;
  throw new UnsupportedCompression(`compression mask 0x${type.toString(16)} (size ${size})`);
}
