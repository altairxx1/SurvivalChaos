/**
 * Converts extracted object data into race-pack overrides.
 *   npm run build-packs [-- --in src/data/extracted]
 * Reads src/data/overrides/id-map.json ({ units: { "lordaeron.footman": "h000" }, upgrades: { "up.meleeWeapons": "R000" } })
 * and writes src/data/overrides/extracted.json, which src/data/index.ts merges into the race packs.
 * Custom objects only store the fields that differ from their WC3 base object; missing fields keep the pack value
 * and are listed in the report so they can be filled from the wiki or base SLK data.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const dir = args.includes('--in') ? args[args.indexOf('--in') + 1]! : 'src/data/extracted';
const idMap = JSON.parse(readFileSync('src/data/overrides/id-map.json', 'utf8')) as { units: Record<string, string>; upgrades: Record<string, string> };
const load = (f: string) => existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, number | string>[] : [];
const units = new Map(load('objects.units.json').map(u => [u._id as string, u]));
const upgrades = new Map(load('objects.upgrades.json').map(u => [u._id as string, u]));

const ATTACK: Record<string, string> = { normal: 'normal', pierce: 'pierce', siege: 'siege', magic: 'magic', chaos: 'chaos', spells: 'spells', hero: 'hero' };
const ARMOR: Record<string, string> = { small: 'light', medium: 'medium', large: 'heavy', fort: 'fortified', hero: 'hero', none: 'unarmored', divine: 'divine', normal: 'medium' };
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

const out: { units: Record<string, unknown>; upgrades: Record<string, unknown>; _source: string } = { units: {}, upgrades: {}, _source: dir };
const report: string[] = ['# build-packs report', ''];
for (const [ours, wc3] of Object.entries(idMap.units)) {
  const u = units.get(wc3); if (!u) { report.push(`- ${ours}: object ${wc3} not found`); continue; }
  const o: Record<string, unknown> = {}; const w: Record<string, unknown> = {};
  const set = (k: string, v: unknown, target = o) => { if (v !== undefined) target[k] = v; };
  set('name', typeof u.name === 'string' ? u.name : undefined); set('hp', num(u.hp)); set('mana', num(u.mana)); set('hpRegen', num(u.hpRegen)); set('manaRegen', num(u.manaRegen));
  set('armor', num(u.armor)); set('armorType', typeof u.armorType === 'string' ? ARMOR[u.armorType] : undefined); set('speed', num(u.moveSpeed)); set('radius', num(u.collision));
  set('acquire', num(u.acquireRange)); set('level', num(u.level));
  if (num(u.bountyBase) !== undefined) set('bounty', Math.round(num(u.bountyBase)! + (num(u.bountyDice) ?? 0) * ((num(u.bountySides) ?? 0) + 1) / 2));
  set('attackType', typeof u.attack1Type === 'string' ? ATTACK[u.attack1Type] : undefined, w); set('base', num(u.attack1Base), w); set('dice', num(u.attack1Dice), w); set('sides', num(u.attack1Sides), w);
  set('cooldown', num(u.attack1Cooldown), w); set('range', num(u.attack1Range), w); set('damagePoint', num(u.attack1DamagePoint), w);
  if (Object.keys(w).length) o.weapon = w;
  out.units[ours] = o;
  const missing = ['hp', 'armor', 'speed'].filter(k => o[k] === undefined);
  report.push(`- ${ours} <- ${wc3} (${u._base}): ${Object.keys(o).join(', ')}${missing.length ? ` — not in map (inherits WC3 base '${u._base}'): ${missing.join(', ')}` : ''}`);
}
for (const [ours, wc3] of Object.entries(idMap.upgrades)) {
  const g = upgrades.get(wc3); if (!g) { report.push(`- ${ours}: upgrade ${wc3} not found`); continue; }
  const o: Record<string, unknown> = {};
  if (typeof g.name === 'string') o.name = g.name;
  if (num(g.levels)) o.maxLevel = num(g.levels);
  if (num(g.goldBase) !== undefined) o.cost = [num(g.goldBase), num(g.goldPerLevel) ?? 0];
  if (num(g.timeBase) !== undefined) o.time = [num(g.timeBase), num(g.timePerLevel) ?? 0];
  out.upgrades[ours] = o; report.push(`- ${ours} <- ${wc3}: ${Object.keys(o).join(', ')}`);
}
writeFileSync('src/data/overrides/extracted.json', JSON.stringify(out, null, 1));
writeFileSync(join(dir, 'build-packs.md'), report.join('\n'));
console.log(report.join('\n'), `\nwrote src/data/overrides/extracted.json (${Object.keys(out.units).length} units, ${Object.keys(out.upgrades).length} upgrades)`);
