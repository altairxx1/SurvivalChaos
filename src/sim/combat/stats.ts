import type { Registry } from '../defs/Registry';
import { lv } from '../defs/Registry';
import type { RaceModifiers, StatMods, UnitDef, UnitFilter, UpgradeDef, BuildingKind, HeroDef } from '../defs/types';
import type { Entity, PlayerState, Stats } from '../state/types';
import { BUILDINGS_RULES } from './rules';

export const TICK_RATE = 20;

interface Acc {
  hpMul: number; hpAdd: number; manaMul: number; manaAdd: number; dmgMul: number; dmgAdd: number; armorAdd: number;
  asMul: number; speedMul: number; hpRegenAdd: number; manaRegenAdd: number; rangeAdd: number;
  evasion: number; crit: number; critMul: number; lifesteal: number; bash: number; bashDur: number;
  dtMul: number; pierceMul: number; thorns: number;
}
const newAcc = (): Acc => ({ hpMul: 0, hpAdd: 0, manaMul: 0, manaAdd: 0, dmgMul: 0, dmgAdd: 0, armorAdd: 0, asMul: 0, speedMul: 0, hpRegenAdd: 0, manaRegenAdd: 0,
  rangeAdd: 0, evasion: 0, crit: 0, critMul: 0, lifesteal: 0, bash: 0, bashDur: 0, dtMul: 1, pierceMul: 1, thorns: 0 });

export function applyMods(a: Acc, m: StatMods & { hpAdd?: number; manaAdd?: number }, scale = 1): void {
  if (m.damageMul) a.dmgMul += m.damageMul * scale;
  if (m.damageAdd) a.dmgAdd += m.damageAdd * scale;
  if (m.armorAdd) a.armorAdd += m.armorAdd * scale;
  if (m.attackSpeedMul) a.asMul += m.attackSpeedMul * scale;
  if (m.speedMul) a.speedMul += m.speedMul * scale;
  if (m.hpRegenAdd) a.hpRegenAdd += m.hpRegenAdd * scale;
  if (m.manaRegenAdd) a.manaRegenAdd += m.manaRegenAdd * scale;
  if (m.evasionAdd) a.evasion += m.evasionAdd * scale;
  if (m.lifesteal) a.lifesteal += m.lifesteal * scale;
  if (m.critChance) a.crit += m.critChance * scale;
  if (m.critMul) a.critMul = Math.max(a.critMul, m.critMul * scale);
  if (m.bashChance) a.bash += m.bashChance * scale;
  if (m.bashDuration) a.bashDur = Math.max(a.bashDur, m.bashDuration);
  if (m.damageTakenMul !== undefined) a.dtMul *= m.damageTakenMul;
  if (m.pierceTakenMul !== undefined) a.pierceMul *= m.pierceTakenMul;
  if (m.thorns) a.thorns += m.thorns * scale;
  if (m.rangeAdd) a.rangeAdd += m.rangeAdd * scale;
  if (m.hpAdd) a.hpAdd += m.hpAdd * scale;
  if (m.manaAdd) a.manaAdd += m.manaAdd * scale;
}

export function filterMatches(f: UnitFilter, def: UnitDef | null, bkind: BuildingKind | null): boolean {
  if (bkind) return !!f.buildings && f.buildings.includes(bkind);
  if (!def) return false;
  if (def.cls === 'hero') return !!f.heroes || !!f.units?.includes(def.id);
  if (f.units && f.units.includes(def.id)) return true;
  if (f.cls && f.cls.includes(def.cls)) return true;
  return false;
}

export function raceMods(reg: Registry, raceId: string): RaceModifiers {
  const m = reg.race(raceId).modifiers;
  return {
    goldBounty: m.goldBounty ?? 1, buyCooldown: m.buyCooldown ?? 1, attackRate: m.attackRate ?? 1, researchSpeed: m.researchSpeed ?? 1,
    buildingHpRegen: m.buildingHpRegen ?? 1, buildingDamage: m.buildingDamage ?? 1, mana: m.mana ?? 1, evasion: m.evasion ?? 0,
    income: m.income ?? 1, unitHp: m.unitHp ?? 1, unitDamage: m.unitDamage ?? 1, moveSpeed: m.moveSpeed ?? 1, upgradeCost: m.upgradeCost ?? 1,
  };
}

function applyUpgrades(reg: Registry, a: Acc, p: PlayerState, def: UnitDef | null, bkind: BuildingKind | null, extraLevels?: Record<string, number>): string[] {
  const granted: string[] = [];
  const visit = (up: UpgradeDef, level: number) => {
    if (level <= 0) return;
    for (const e of up.effects) {
      if (e.t === 'stat' && filterMatches(e.filter, def, bkind)) {
        const add = (e.add ?? 0) * level, mul = (e.mul ?? 0) * level;
        switch (e.stat) {
          case 'damage': a.dmgMul += mul; a.dmgAdd += add; break;
          case 'armor': a.armorAdd += add; break;
          case 'hp': a.hpMul += mul; a.hpAdd += add; break;
          case 'mana': a.manaMul += mul; a.manaAdd += add; break;
          case 'attackSpeed': a.asMul += mul + add; break;
          case 'speed': a.speedMul += mul + add; break;
          case 'hpRegen': a.hpRegenAdd += add; break;
          case 'manaRegen': a.manaRegenAdd += add; break;
          case 'range': a.rangeAdd += add; break;
          case 'evasion': a.evasion += add + mul; break;
          case 'critChance': a.crit += add + mul; break;
          case 'lifesteal': a.lifesteal += add + mul; break;
        }
      } else if (e.t === 'ability' && filterMatches(e.filter, def, bkind)) granted.push(e.ability);
    }
  };
  for (const id in p.upgrades) { const up = reg.upgrades.get(id); if (up) visit(up, p.upgrades[id]!); }
  if (extraLevels) for (const id in extraLevels) { const up = reg.upgrades.get(id); if (up && up.scope === 'building') visit(up, extraLevels[id]!); }
  return granted;
}

/** Resolves final stats: base definition x race modifiers x upgrades x hero level/items x passives x buffs. */
export function computeStats(reg: Registry, e: Entity, p: PlayerState): Stats {
  const race = raceMods(reg, p.raceId);
  const a = newAcc();
  if (e.kind === 'building') {
    const kind = e.bld!.kind; const b = reg.buildings[kind];
    applyUpgrades(reg, a, p, null, kind, e.bld!.levels);
    for (const bf of e.buffs) applyMods(a, reg.buff(bf.id).mods);
    let hp = b.hp, dmgMul = race.buildingDamage;
    if (kind === 'fortress') { hp += BUILDINGS_RULES.fortressHpPerLevel * (p.fortressLevel - 1); dmgMul *= 1 + BUILDINGS_RULES.fortressDamagePerLevel * (p.fortressLevel - 1); }
    if (kind === 'tower') { const tl = e.bld!.levels['up.towerLevel'] ?? 0; hp *= 1 + BUILDINGS_RULES.towerHpPerLevel * tl; dmgMul *= 1 + BUILDINGS_RULES.towerDamagePerLevel * tl; }
    const w = b.weapon;
    return {
      maxHp: Math.round(hp * (1 + a.hpMul) + a.hpAdd), maxMana: 0, hpRegen: b.hpRegen * race.buildingHpRegen, manaRegen: 0,
      armor: b.armor + a.armorAdd, armorType: b.armorType,
      attackType: w?.attackType ?? 'normal', dmgBase: w?.base ?? 0, dice: w?.dice ?? 0, sides: w?.sides ?? 0,
      dmgMul: dmgMul * (1 + a.dmgMul), dmgAdd: a.dmgAdd,
      cooldown: w ? Math.max(1, Math.round(w.cooldown * TICK_RATE)) : 0, damagePoint: w ? Math.round((w.damagePoint ?? 0.1) * TICK_RATE) : 0,
      range: w ? w.range + a.rangeAdd : 0, acquire: w ? w.range + 50 : 0, speed: 0,
      evasion: 0, critChance: 0, critMul: 1, lifesteal: 0, bashChance: 0, bashDuration: 0, damageTakenMul: a.dtMul, pierceTakenMul: a.pierceMul, thorns: a.thorns,
      projectile: w?.projectile, splash: w?.splash, canHitAir: true, hasWeapon: !!w,
    };
  }
  const def = reg.unit(e.def);
  const granted = applyUpgrades(reg, a, p, def, null);
  // ability list: innate + granted + hero learned
  const abilities: string[] = [...def.abilities];
  for (const g of granted) if (!abilities.includes(g)) abilities.push(g);
  let heroLevel = 1;
  if (e.hero) {
    const h = def as HeroDef; heroLevel = e.hero.level;
    h.heroAbilities.forEach((ab, i) => { if ((e.hero!.abilityLevels[i] ?? 0) > 0) abilities.push(ab); });
    a.hpAdd += h.perLevel.hp * (heroLevel - 1); a.dmgAdd += h.perLevel.damage * (heroLevel - 1);
    a.armorAdd += h.perLevel.armor * (heroLevel - 1); a.manaAdd += h.perLevel.mana * (heroLevel - 1);
    for (const it of e.hero.items) if (it) applyMods(a, reg.item(it).mods);
  }
  e.abilities = abilities;
  for (const abId of abilities) {
    const ab = reg.abilities.get(abId); if (!ab || ab.kind !== 'passive') continue;
    const l = abilityLevel(reg, e, abId);
    for (const ef of ab.effects) if (ef.t === 'passive') { applyMods(a, ef.mods); if (ef.perLevel && l > 1) applyMods(a, ef.perLevel, l - 1); }
  }
  for (const bf of e.buffs) applyMods(a, reg.buff(bf.id).mods);
  const isHero = def.cls === 'hero';
  const w = def.weapon;
  const hpBase = def.hp * (isHero ? 1 : race.unitHp);
  const as = Math.max(0.2, 1 + a.asMul);
  return {
    maxHp: Math.max(1, Math.round((hpBase + a.hpAdd) * (1 + a.hpMul))),
    maxMana: Math.round((def.mana * race.mana + a.manaAdd) * (1 + a.manaMul)),
    hpRegen: def.hpRegen + a.hpRegenAdd, manaRegen: def.manaRegen + a.manaRegenAdd,
    armor: def.armor + a.armorAdd, armorType: def.armorType,
    attackType: w?.attackType ?? 'normal', dmgBase: w?.base ?? 0, dice: w?.dice ?? 0, sides: w?.sides ?? 0,
    dmgMul: (isHero ? 1 : race.unitDamage) * Math.max(0, 1 + a.dmgMul), dmgAdd: a.dmgAdd,
    cooldown: w ? Math.max(2, Math.round(w.cooldown * TICK_RATE / race.attackRate / as)) : 0,
    damagePoint: w ? Math.max(1, Math.round((w.damagePoint ?? 0.3) * TICK_RATE / Math.min(as, 2))) : 0,
    range: w ? w.range + a.rangeAdd : 0, acquire: def.acquire + a.rangeAdd,
    speed: Math.min(522, def.speed * race.moveSpeed * Math.max(0.1, 1 + a.speedMul)) / TICK_RATE,
    evasion: Math.min(0.8, a.evasion + race.evasion), critChance: a.crit, critMul: Math.max(1, a.critMul), lifesteal: a.lifesteal,
    bashChance: a.bash, bashDuration: a.bashDur, damageTakenMul: a.dtMul, pierceTakenMul: a.pierceMul, thorns: a.thorns,
    projectile: w?.projectile, splash: w?.splash, bounce: w?.bounce, canHitAir: !!w && (!!w.projectile || !!w.air), hasWeapon: !!w,
  };
}

export function abilityLevel(reg: Registry, e: Entity, abilityId: string): number {
  if (!e.hero) return 1;
  const h = reg.heroes.get(e.def); if (!h) return 1;
  const i = h.heroAbilities.indexOf(abilityId);
  return i < 0 ? 1 : Math.max(1, e.hero.abilityLevels[i] ?? 1);
}

/** Auto-learn schedule for heroes (players never control heroes in Survival Chaos). */
export function heroAbilityLevels(level: number): number[] {
  return [Math.min(3, Math.floor((level + 1) / 2)), Math.min(3, Math.floor(level / 2)), Math.min(3, Math.floor((level - 1) / 2)), level >= 6 ? 1 : 0];
}

export { lv };
