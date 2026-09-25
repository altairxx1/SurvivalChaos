import type { HeroDef, ModelSpec, UnitClass, UnitDef, Weapon, ArmorType, UpgradeDef, UnitFilter, StatKey } from '../../sim/defs/types';

type UnitInput = {
  id: string; name: string; cls: UnitClass; hp: number; armor: number; armorType?: ArmorType;
  mana?: number; hpRegen?: number; manaRegen?: number; speed?: number; radius?: number; acquire?: number;
  weapon?: Weapon; abilities?: string[]; bounty?: number; xp?: number; level?: number; flying?: boolean;
  model: ModelSpec; description?: string;
};

export function unitFactory(race: string) {
  return (u: UnitInput): UnitDef => ({
    id: `${race}.${u.id}`, name: u.name, race, cls: u.cls, hp: u.hp, mana: u.mana ?? 0,
    hpRegen: u.hpRegen ?? 0.25, manaRegen: u.manaRegen ?? (u.mana ? 0.67 : 0),
    armor: u.armor, armorType: u.armorType ?? 'medium', speed: u.speed ?? 270, radius: u.radius ?? 24,
    acquire: u.acquire ?? Math.max(600, (u.weapon?.range ?? 100) + 150), weapon: u.weapon,
    abilities: (u.abilities ?? []).map(a => a.includes('.') ? a : `${race}.${a}`),
    bounty: u.bounty ?? 6, xp: u.xp ?? 25, level: u.level ?? 2, flying: u.flying, model: u.model,
    description: u.description ?? '',
  });
}

type HeroInput = UnitInput & { cost?: number; cooldown?: number; perLevel?: HeroDef['perLevel']; heroAbilities: string[] };
export function heroFactory(race: string) {
  const mk = unitFactory(race);
  return (h: HeroInput): HeroDef => ({
    ...mk({ ...h, cls: 'hero', armorType: 'hero', bounty: h.bounty ?? 150, xp: h.xp ?? 200, level: h.level ?? 1, radius: h.radius ?? 28 }),
    cost: h.cost ?? 275, cooldown: h.cooldown ?? 60,
    perLevel: h.perLevel ?? { hp: 70, damage: 3, armor: 0.4, mana: 25 },
    heroAbilities: h.heroAbilities.map(a => `${race}.${a}`),
  });
}

/** melee weapon shortcut */
export const melee = (base: number, sides: number, cooldown = 1.35, type: Weapon['attackType'] = 'normal', range = 100): Weapon =>
  ({ attackType: type, base, dice: 1, sides, cooldown, range, damagePoint: 0.4 });
/** ranged weapon shortcut */
export const ranged = (base: number, sides: number, cooldown: number, range: number, fx: string, type: Weapon['attackType'] = 'pierce', speed = 1000, arc = 0.2): Weapon =>
  ({ attackType: type, base, dice: 1, sides, cooldown, range, damagePoint: 0.35, projectile: { speed, fx, arc } });

export function sanctumUpgrade(race: string, id: string, name: string, icon: string, hotkey: string, cost: number, time: number,
  filter: UnitFilter, grant: { ability?: string; stat?: { stat: StatKey; add?: number; mul?: number } }, description: string, maxLevel = 1): UpgradeDef {
  return {
    id: `${race}.up.${id}`, name, icon, hotkey, scope: 'player', maxLevel, cost: [cost, Math.round(cost / 2)], time: [time, 10],
    effects: [
      ...(grant.ability ? [{ t: 'ability' as const, filter, ability: `${race}.${grant.ability}` }] : []),
      ...(grant.stat ? [{ t: 'stat' as const, filter, ...grant.stat }] : []),
    ],
    description,
  };
}
