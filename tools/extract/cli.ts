/**
 * w3x -> JSON extraction.
 *   npm run extract -- "original/Survival Chaos 4.31.w3x" [--out src/data/extracted]
 *   npm run extract -- original/extracted            (folder with files already pulled out by an MPQ editor)
 * Writes raw JSON dumps, terrain.bin, layout.extracted.json, script-hints.json and report.md.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { MpqArchive, UnsupportedCompression } from './mpq/MpqArchive';
import { openWithStormLib } from './mpq/storm';
import { flattenObject, parseDoo, parseObjects, parseUnitsDoo, parseW3e, parseW3i, parseWts, resolveTrigStr, type PlacedUnit } from './parsers/formats';
import { ABILITY_FIELDS, ITEM_FIELDS, UNIT_FIELDS, UPGRADE_FIELDS } from './meta/fields';
import { inferLayout } from './layout';

const FILES = ['war3map.w3i', 'war3map.wts', 'war3map.w3e', 'war3map.doo', 'war3mapUnits.doo', 'war3map.w3u', 'war3map.w3t', 'war3map.w3b', 'war3map.w3d', 'war3map.w3a', 'war3map.w3h', 'war3map.w3q',
  'war3map.w3r', 'war3map.w3c', 'war3map.j', 'scripts\\war3map.j', 'war3map.lua', 'war3mapMisc.txt', 'war3mapSkin.txt', 'war3mapExtra.txt', 'war3map.imp', '(listfile)'];

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith('--'));
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1]! : 'src/data/extracted';
  if (!input || !existsSync(input)) { console.error('usage: npm run extract -- <map.w3x | extracted-folder> [--out dir]'); process.exit(1); }
  mkdirSync(out, { recursive: true });
  const files = await openInput(input);
  const log: string[] = [`# Extraction report`, ``, `Source: \`${input}\``, ``];
  const got = (n: string) => files.get(n) ?? files.get(n.toLowerCase()) ?? null;
  log.push(`Files found: ${[...files.keys()].join(', ') || 'none'}`, '');

  const wts = got('war3map.wts') ? parseWts(got('war3map.wts')!) : {};
  writeFileSync(join(out, 'strings.json'), JSON.stringify(wts, null, 1));
  if (got('war3map.w3i')) { try { const info = parseW3i(got('war3map.w3i')!); const r = { ...info, name: resolveTrigStr(info.name, wts), author: resolveTrigStr(info.author, wts), description: resolveTrigStr(info.description, wts) };
    writeFileSync(join(out, 'info.json'), JSON.stringify(r, null, 1)); log.push(`## Map`, `${r.name} by ${r.author} — playable ${r.playableWidth}x${r.playableHeight} tiles, tileset ${r.tileset}, w3i v${r.version}`, ''); } catch (e) { log.push(`w3i: ${(e as Error).message}`); } }

  let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  if (got('war3map.w3e')) {
    try {
      const t = parseW3e(got('war3map.w3e')!);
      bounds = { minX: t.offsetX, minY: t.offsetY, maxX: t.offsetX + (t.width - 1) * 128, maxY: t.offsetY + (t.height - 1) * 128 };
      writeFileSync(join(out, 'terrain.json'), JSON.stringify({ version: t.version, tileset: t.tileset, groundTiles: t.groundTiles, cliffTiles: t.cliffTiles, width: t.width, height: t.height, offsetX: t.offsetX, offsetY: t.offsetY, bounds }, null, 1));
      const bin = Buffer.alloc(t.width * t.height * 12);
      for (let i = 0; i < t.width * t.height; i++) { bin.writeFloatLE(t.heights[i]!, i * 12); bin.writeFloatLE(t.water[i]!, i * 12 + 4); bin[i * 12 + 8] = t.ground[i]!; bin[i * 12 + 9] = t.flags[i]!; bin[i * 12 + 10] = t.layer[i]!; bin[i * 12 + 11] = t.cliff[i]!; }
      writeFileSync(join(out, 'terrain.bin'), bin);
      log.push(`## Terrain`, `${t.width}x${t.height} vertices (${t.width - 1}x${t.height - 1} tiles), world [${bounds.minX}, ${bounds.minY}] .. [${bounds.maxX}, ${bounds.maxY}], ground tiles ${t.groundTiles.join(' ')}`, '');
    } catch (e) { log.push(`w3e: ${(e as Error).message}`); }
  }
  if (got('war3map.doo')) { try { const d = parseDoo(got('war3map.doo')!); writeFileSync(join(out, 'doodads.json'), JSON.stringify(d.doodads));
    const byType: Record<string, number> = {}; for (const x of d.doodads) byType[x.id] = (byType[x.id] ?? 0) + 1;
    log.push(`## Doodads`, `${d.doodads.length} placed (doo v${d.version}); types: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k}×${v}`).join(', ')}`, ''); } catch (e) { log.push(`doo: ${(e as Error).message}`); } }

  const objectFiles: [string, boolean, Record<string, string>, string][] = [
    ['war3map.w3u', false, UNIT_FIELDS, 'units'], ['war3map.w3t', false, ITEM_FIELDS, 'items'], ['war3map.w3b', false, UNIT_FIELDS, 'destructables'], ['war3map.w3h', false, {}, 'buffs'],
    ['war3map.w3a', true, ABILITY_FIELDS, 'abilities'], ['war3map.w3d', true, {}, 'doodadTypes'], ['war3map.w3q', true, UPGRADE_FIELDS, 'upgrades']];
  const unitNames: Record<string, string> = {};
  log.push('## Object data');
  for (const [file, levels, names, key] of objectFiles) {
    const b = got(file); if (!b) continue;
    try { const o = parseObjects(b, levels); const flat = o.objects.map(x => flattenObject(x, names, wts)); writeFileSync(join(out, `objects.${key}.json`), JSON.stringify(flat, null, 1));
      if (key === 'units') for (const f of flat) unitNames[f._id as string] = String(f.name ?? f._base);
      log.push(`- ${key}: ${o.objects.length} (${o.objects.filter(x => x.custom).length} custom), format v${o.version}`);
    } catch (e) { log.push(`- ${key}: ${(e as Error).message}`); }
  }
  log.push('');

  let placed: PlacedUnit[] = [];
  if (got('war3mapUnits.doo')) { try { placed = parseUnitsDoo(got('war3mapUnits.doo')!).units; writeFileSync(join(out, 'units-placed.json'), JSON.stringify(placed.map(u => ({ ...u, name: unitNames[u.id] })), null, 1)); } catch (e) { log.push(`unitsdoo: ${(e as Error).message}`); } }
  if (placed.length) {
    const layout = inferLayout(placed, unitNames, bounds);
    writeFileSync(join(out, 'layout.extracted.json'), JSON.stringify(layout, null, 1));
    log.push(`## Pre-placed units`, `${placed.length} total. Per owner:`);
    for (const o of layout.owners) log.push(`- player ${o.owner}: ${o.count} objects around (${Math.round(o.cx)}, ${Math.round(o.cy)}) slot=${o.slot ?? '?'} — ${o.types.slice(0, 12).map(t => `${t.name ?? t.id}×${t.n}`).join(', ')}`);
    log.push('');
  }
  const script = got('war3map.j') ?? got('scripts\\war3map.j') ?? got('war3map.lua');
  if (script) {
    const src = script.toString('latin1'); writeFileSync(join(out, got('war3map.lua') ? 'war3map.lua' : 'war3map.j'), src);
    const rects = [...src.matchAll(/Rect\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map(m => m.slice(1, 5).map(Number));
    const timers = [...src.matchAll(/TimerStart\([^,]+,\s*([\d.]+)/g)].map(m => Number(m[1]));
    const rawIds = [...new Set([...src.matchAll(/'([A-Za-z0-9]{4})'/g)].map(m => m[1]!))];
    writeFileSync(join(out, 'script-hints.json'), JSON.stringify({ rects, timers, rawIds, length: src.length }, null, 1));
    log.push(`## Script`, `${src.length} chars; ${rects.length} Rect literals, ${timers.length} TimerStart periods (${[...new Set(timers)].slice(0, 12).join(', ')}), ${rawIds.length} object ids referenced`, '');
  } else log.push('## Script', 'No war3map.j/lua found (protected map?). Waves/income timings must come from the wiki or manual measurement.', '');
  for (const extra of ['war3mapMisc.txt', 'war3mapExtra.txt']) { const b = got(extra); if (b) writeFileSync(join(out, extra), b); }
  log.push('## Next step', 'Review `layout.extracted.json` and `objects.units.json`, then run `npm run build-packs` to regenerate race packs (see docs/EXTRACTION.md).');
  writeFileSync(join(out, 'report.md'), log.join('\n'));
  console.log(log.join('\n'));
}

async function openInput(input: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  if (statSync(input).isDirectory()) {
    for (const f of FILES) { const p = join(input, f.replace('\\', '/')); if (existsSync(p)) files.set(f, readFileSync(p)); }
    return files;
  }
  let mpq: MpqArchive | null = null;
  try { mpq = new MpqArchive(readFileSync(input)); } catch (e) { console.warn(`built-in MPQ reader failed (${(e as Error).message}), using StormLib`); }
  let storm: Awaited<ReturnType<typeof openWithStormLib>> | null = null;
  for (const f of FILES) {
    let b: Buffer | null = null;
    if (mpq) { try { b = mpq.read(f); } catch (e) { if (!(e instanceof UnsupportedCompression)) console.warn(`${f}: ${(e as Error).message}`); } }
    if (!b && (!mpq || mpq.has(f))) { try { storm ??= await openWithStormLib(input); b = storm.read(f); } catch (e) { console.warn(`StormLib ${f}: ${(e as Error).message}`); } }
    if (b) files.set(f, b);
  }
  storm?.close();
  return files;
}

void main();
export { copyFileSync };
