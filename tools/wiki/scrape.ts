/**
 * Downloads the community Survival Chaos database pages (data parsed from the map) for cross-checking.
 *   npm run wiki [-- --base https://survivalchaos.uk]
 * Pages are cached in tools/wiki/.cache. Embedded JSON payloads (Next/Nuxt/Astro data blobs) are extracted to
 * src/data/extracted/wiki/*.json; tables are converted to rows. Requires the hosts to be allowed by the network policy.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1]! : 'https://survivalchaos.uk';
const cache = 'tools/wiki/.cache', out = 'src/data/extracted/wiki';
mkdirSync(cache, { recursive: true }); mkdirSync(out, { recursive: true });
const RACES = ['Lordaeron', 'Dwarf', 'Rogue', 'Gnome', 'Worgen', 'Scarlet', 'Wildhammer', 'Orc', 'Troll', 'Tauren', 'Goblin', 'Pandaren', 'Saurok', 'Demon', 'Undead', 'Fel Orc', 'Dark Horde', 'Dark Iron', 'Silithid', 'Ancients', 'Night Elf', 'Naga', 'Blood Elf', 'Draenei', 'Void Elf', 'Nightborne'];

async function get(path: string): Promise<string | null> {
  const file = join(cache, path.replace(/[^a-z0-9]+/gi, '_') + '.html');
  if (existsSync(file)) return readFileSync(file, 'utf8');
  try {
    const r = await fetch(base + path, { headers: { 'user-agent': 'survival-chaos-remake-data-check' } });
    if (!r.ok) { console.warn(`${path}: HTTP ${r.status}`); return null; }
    const t = await r.text(); writeFileSync(file, t); await new Promise(res => setTimeout(res, 400)); return t;
  } catch (e) { console.warn(`${path}: ${(e as Error).message}`); return null; }
}

function embeddedJson(html: string): unknown[] {
  const blobs: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]*(?:id="__NEXT_DATA__"|type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)) { try { blobs.push(JSON.parse(m[1]!)); } catch { /* not json */ } }
  return blobs;
}
function tables(html: string): string[][][] {
  const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map(t => [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => strip(c[1]!))));
}

async function main() {
  const index = await get('/og/races'); const misc = await get('/og/misc');
  const pages: Record<string, string | null> = { races: index, misc };
  const links = index ? [...new Set([...index.matchAll(/href="(\/og\/races\/[a-z0-9-]+)"/g)].map(m => m[1]!))] : [];
  for (const l of links) pages[l] = await get(l);
  for (const [k, html] of Object.entries(pages)) {
    if (!html) continue;
    writeFileSync(join(out, `${k.replace(/[^a-z0-9]+/gi, '_')}.json`), JSON.stringify({ url: base + k, embedded: embeddedJson(html), tables: tables(html) }, null, 1));
  }
  console.log(`fetched ${Object.values(pages).filter(Boolean).length} pages (${links.length} race pages linked; expected races: ${RACES.length}) into ${out}`);
}
void main();
