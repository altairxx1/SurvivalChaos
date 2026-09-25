import type { AbilityDef, BuffDef, BuildingDef, BuildingKind, GameModeDef, HeroDef, ItemDef, RaceDef, UnitDef, UpgradeDef } from './types';

export interface DataBundle {
  races: RaceDef[];
  buildings: Record<BuildingKind, BuildingDef>;
  sharedUpgrades: UpgradeDef[];
  items: ItemDef[];
  modes: Record<string, GameModeDef>;
}

/** Indexes every definition by id. Built once per game from a DataBundle (race packs + shared data). */
export class Registry {
  readonly races = new Map<string, RaceDef>();
  readonly units = new Map<string, UnitDef>();
  readonly heroes = new Map<string, HeroDef>();
  readonly abilities = new Map<string, AbilityDef>();
  readonly buffs = new Map<string, BuffDef>();
  readonly upgrades = new Map<string, UpgradeDef>();
  readonly items = new Map<string, ItemDef>();
  readonly buildings: Record<BuildingKind, BuildingDef>;
  readonly modes: Record<string, GameModeDef>;
  readonly itemsByLevel: ItemDef[][] = [[], [], [], [], [], []];

  constructor(readonly data: DataBundle) {
    this.buildings = data.buildings; this.modes = data.modes;
    for (const u of data.sharedUpgrades) this.upgrades.set(u.id, u);
    for (const it of data.items) { this.items.set(it.id, it); this.itemsByLevel[it.level]!.push(it); }
    for (const r of data.races) {
      this.races.set(r.id, r);
      for (const u of r.units) this.units.set(u.id, u);
      for (const h of r.heroes) { this.heroes.set(h.id, h); this.units.set(h.id, h); }
      for (const a of r.abilities) this.abilities.set(a.id, a);
      for (const b of r.buffs) this.buffs.set(b.id, b);
      for (const u of r.upgrades) this.upgrades.set(u.id, u);
    }
  }

  race(id: string): RaceDef { const r = this.races.get(id); if (!r) throw new Error(`unknown race ${id}`); return r; }
  unit(id: string): UnitDef { const u = this.units.get(id); if (!u) throw new Error(`unknown unit ${id}`); return u; }
  upgrade(id: string): UpgradeDef { const u = this.upgrades.get(id); if (!u) throw new Error(`unknown upgrade ${id}`); return u; }
  ability(id: string): AbilityDef { const a = this.abilities.get(id); if (!a) throw new Error(`unknown ability ${id}`); return a; }
  buff(id: string): BuffDef { const b = this.buffs.get(id); if (!b) throw new Error(`unknown buff ${id}`); return b; }
  item(id: string): ItemDef { const i = this.items.get(id); if (!i) throw new Error(`unknown item ${id}`); return i; }

  /** Validates cross references; returns a list of problems (empty = ok). Used by tests and the extractor. */
  validate(): string[] {
    const errs: string[] = [];
    const chk = (ok: boolean, msg: string) => { if (!ok) errs.push(msg); };
    for (const r of this.races.values()) {
      for (const k of ['melee', 'ranged', 'caster', 'mounted', 'heavy'] as const) chk(this.units.has(r[k]), `${r.id}.${k} -> ${r[k]}`);
      r.waves.forEach((w, i) => w.forEach(e => chk(this.units.has(e.unit), `${r.id} wave ${i} -> ${e.unit}`)));
      r.specials.forEach(s => chk(this.units.has(s.unit), `${r.id} special -> ${s.unit}`));
      [...r.forgeUpgrades, ...r.sanctumUpgrades].forEach(u => chk(this.upgrades.has(u), `${r.id} upgrade -> ${u}`));
      for (const u of r.units) u.abilities.forEach(a => chk(this.abilities.has(a), `${u.id} ability -> ${a}`));
      for (const h of r.heroes) h.heroAbilities.forEach(a => chk(this.abilities.has(a), `${h.id} hero ability -> ${a}`));
      for (const a of r.abilities) for (const e of a.effects) {
        if ('buff' in e) chk(this.buffs.has(e.buff), `${a.id} buff -> ${e.buff}`);
        if (e.t === 'summon') chk(this.units.has(e.unit), `${a.id} summon -> ${e.unit}`);
      }
      for (const u of r.upgrades) for (const e of u.effects) if (e.t === 'ability') chk(this.abilities.has(e.ability), `${u.id} grants -> ${e.ability}`);
    }
    return errs;
  }
}

export function lv(v: number | number[], level: number): number {
  if (typeof v === 'number') return v;
  return v[Math.max(0, Math.min(v.length - 1, level - 1))]!;
}
