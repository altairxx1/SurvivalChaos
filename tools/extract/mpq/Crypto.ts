/** MPQ hashing and encryption (Blizzard's "Storm" algorithms). */
export const CRYPT_TABLE = (() => {
  const t = new Uint32Array(0x500); let seed = 0x00100001;
  for (let i1 = 0; i1 < 0x100; i1++) for (let i = 0, i2 = i1; i < 5; i++, i2 += 0x100) {
    seed = (seed * 125 + 3) % 0x2aaaab; const a = (seed & 0xffff) << 16;
    seed = (seed * 125 + 3) % 0x2aaaab; const b = seed & 0xffff;
    t[i2] = (a | b) >>> 0;
  }
  return t;
})();

export const HASH_OFFSET = 0, HASH_A = 1, HASH_B = 2, HASH_KEY = 3;

export function hashString(str: string, type: number): number {
  let s1 = 0x7fed7fed, s2 = 0xeeeeeeee;
  for (const chr of str.toUpperCase().replace(/\//g, '\\')) {
    const ch = chr.charCodeAt(0) & 0xff;
    s1 = (CRYPT_TABLE[type * 0x100 + ch]! ^ ((s1 + s2) >>> 0)) >>> 0;
    s2 = (ch + s1 + s2 + ((s2 << 5) >>> 0) + 3) >>> 0;
  }
  return s1 >>> 0;
}

export function decrypt(data: Uint32Array, key: number): void {
  let s2 = 0xeeeeeeee; let k = key >>> 0;
  for (let i = 0; i < data.length; i++) {
    s2 = (s2 + CRYPT_TABLE[0x400 + (k & 0xff)]!) >>> 0;
    const ch = (data[i]! ^ ((k + s2) >>> 0)) >>> 0;
    k = ((((~k << 21) >>> 0) + 0x11111111) >>> 0 | (k >>> 11)) >>> 0;
    s2 = (ch + s2 + ((s2 << 5) >>> 0) + 3) >>> 0;
    data[i] = ch;
  }
}

export function encrypt(data: Uint32Array, key: number): void {
  let s2 = 0xeeeeeeee; let k = key >>> 0;
  for (let i = 0; i < data.length; i++) {
    s2 = (s2 + CRYPT_TABLE[0x400 + (k & 0xff)]!) >>> 0;
    const plain = data[i]!;
    data[i] = (plain ^ ((k + s2) >>> 0)) >>> 0;
    k = ((((~k << 21) >>> 0) + 0x11111111) >>> 0 | (k >>> 11)) >>> 0;
    s2 = (plain + s2 + ((s2 << 5) >>> 0) + 3) >>> 0;
  }
}

/** Encryption key of a file: hash of its base name (optionally adjusted by offset/size, "fix key"). */
export function fileKey(name: string, offset: number, size: number, fixKey: boolean): number {
  const base = name.split(/[\\/]/).pop()!;
  let k = hashString(base, HASH_KEY);
  if (fixKey) k = ((k + offset) ^ size) >>> 0;
  return k;
}
