import { dirname, basename, resolve } from 'node:path';

/**
 * Fallback reader backed by StormLib (WebAssembly, MIT). Handles every MPQ compression type
 * (implode, bzip2, huffman, lzma) and odd archive layouts. Loaded lazily because it is large.
 */
export async function openWithStormLib(path: string): Promise<{ read(name: string): Buffer | null; close(): void }> {
  const { FS, MPQ } = await import('@wowserhq/stormjs') as unknown as { FS: any; MPQ: any };
  const abs = resolve(path); const mount = '/mapdir';
  try { FS.mkdir(mount); } catch { /* exists */ }
  try { FS.mount(FS.filesystems.NODEFS, { root: dirname(abs) }, mount); } catch { /* already mounted */ }
  const mpq = await MPQ.open(`${mount}/${basename(abs)}`, 'r');
  return {
    read(name: string) {
      try { const f = mpq.openFile(name); const d: Uint8Array = f.read(); f.close(); return Buffer.from(d); } catch { return null; }
    },
    close() { try { mpq.close(); } catch { /* ignore */ } },
  };
}
