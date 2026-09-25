import type { RaceDef, UnitDef, UpgradeDef, Weapon } from '../../sim/defs/types';

export interface UnitOverride extends Partial<Omit<UnitDef, 'weapon' | 'model'>> { weapon?: Partial<Weapon> }
export interface Overrides { units?: Record<string, UnitOverride>; upgrades?: Record<string, Partial<UpgradeDef>>; _source?: string }

/** Applies extracted/hand-written overrides on top of the race packs (returns new objects, packs stay untouched). */
export function applyOverrides(races: RaceDef[], ov: Overrides): RaceDef[] {
  if (!ov.units && !ov.upgrades) return races;
  const unit = <T extends UnitDef>(u: T): T => {
    const o = ov.units?.[u.id]; if (!o) return u;
    const { weapon, ...rest } = o;
    return { ...u, ...rest, weapon: u.weapon || weapon ? { ...(u.weapon ?? { attackType: 'normal', base: 0, dice: 1, sides: 1, cooldown: 1.5, range: 100 }), ...weapon } as Weapon : undefined };
  };
  return races.map(r => ({ ...r, units: r.units.map(unit), heroes: r.heroes.map(unit), upgrades: r.upgrades.map(up => ({ ...up, ...(ov.upgrades?.[up.id] ?? {}) })) }));
}
