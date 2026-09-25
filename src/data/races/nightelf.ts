import type { RaceDef } from '../../sim/defs/types';
import { heroFactory, melee, ranged, sanctumUpgrade, unitFactory } from './helpers';

const R = 'nightelf';
const u = unitFactory(R); const h = heroFactory(R);
const PURPLE = '#6a4ab0', TEAL = '#3ab0a0', SKIN = '#9a8ad0', LEAF = '#3a8a3a';

export const nightelf: RaceDef = {
  id: R, name: 'Night Elf', faction: 'independent', color: '#8a5ad0',
  description: 'Agile children of the stars. Fragile, but evasive and deadly at range.',
  bonuses: ['+5% evasion for all units', '-8% unit hit points', 'Bouncing Huntress glaives'],
  modifiers: { evasion: 0.05, unitHp: 0.92 },
  melee: `${R}.sentinel`, ranged: `${R}.archer`, caster: `${R}.druid`, mounted: `${R}.huntress`, heavy: `${R}.mountainGiant`,
  units: [
    u({ id: 'sentinel', name: 'Sentinel', cls: 'melee', hp: 400, armor: 2, armorType: 'medium', weapon: melee(13, 3, 1.3), speed: 290, bounty: 6,
      model: { arch: 'infantry', scale: 1, body: PURPLE, accent: TEAL, skin: SKIN, weapon: 'glaive' } }),
    u({ id: 'mountainGiant', name: 'Mountain Giant', cls: 'heavy', hp: 1300, armor: 4, armorType: 'heavy', speed: 230, radius: 42, weapon: melee(28, 6, 2.2), abilities: ['hardenedSkin'], bounty: 18, xp: 60, level: 5,
      model: { arch: 'treant', scale: 1.35, body: '#6a6a5a', accent: LEAF } }),
    u({ id: 'archer', name: 'Archer', cls: 'ranged', hp: 280, armor: 0, armorType: 'medium', weapon: ranged(15, 3, 1.5, 600, 'moonArrow'), speed: 290, bounty: 6,
      model: { arch: 'archer', scale: 0.95, body: PURPLE, accent: '#d0d0ff', skin: SKIN, weapon: 'bow' } }),
    u({ id: 'druid', name: 'Druid of the Talon', cls: 'caster', hp: 300, mana: 300, armor: 0, armorType: 'unarmored', weapon: ranged(10, 3, 1.75, 600, 'natureBolt', 'magic', 900, 0.05),
      abilities: ['rejuvenation'], bounty: 8, model: { arch: 'caster', scale: 1, body: LEAF, accent: '#d0c090', skin: SKIN, weapon: 'staff', glow: '#9aff7a' } }),
    u({ id: 'huntress', name: 'Huntress', cls: 'mounted', hp: 620, armor: 2, armorType: 'medium', speed: 350, radius: 32, weapon: { ...ranged(18, 4, 1.8, 250, 'glaive', 'normal', 1100, 0.05), bounce: { count: 1, falloff: 0.35, range: 250 } }, bounty: 12, xp: 45, level: 3,
      model: { arch: 'cavalry', scale: 1.1, body: PURPLE, accent: '#e0e0e0', skin: SKIN, weapon: 'glaive' } }),
    u({ id: 'chimaera', name: 'Chimaera', cls: 'special', hp: 1100, armor: 2, armorType: 'heavy', speed: 300, radius: 48, flying: true,
      weapon: { ...ranged(65, 15, 2.5, 500, 'acid', 'siege', 800, 0.05), splash: { radius: 120, factor: 0.5 } }, bounty: 30, xp: 90, level: 5,
      model: { arch: 'dragon', scale: 1.3, body: '#5a8a3a', accent: '#b0d060', glow: '#aaff5a' } }),
    u({ id: 'glaiveThrower', name: 'Glaive Thrower', cls: 'siege', hp: 300, armor: 2, armorType: 'heavy', speed: 220, radius: 40, weapon: { ...ranged(75, 15, 3.5, 1100, 'bigGlaive', 'siege', 900, 0.3), splash: { radius: 120, factor: 0.5 } },
      bounty: 20, xp: 60, level: 3, model: { arch: 'siege', scale: 1.1, body: '#5a4a3a', accent: PURPLE } }),
  ],
  heroes: [
    h({ id: 'demonHunter', name: 'Demon Hunter', cls: 'hero', hp: 650, mana: 250, armor: 3, weapon: melee(25, 6, 1.6, 'hero'), speed: 320,
      heroAbilities: ['manaBurn', 'immolation', 'evasion', 'metamorphosis'], perLevel: { hp: 85, damage: 3.5, armor: 0.7, mana: 18 },
      model: { arch: 'hero', scale: 1.25, body: '#3a2a5a', accent: '#9aff5a', skin: SKIN, weapon: 'glaive', glow: '#9aff5a' } }),
    h({ id: 'priestess', name: 'Priestess of the Moon', cls: 'hero', hp: 550, mana: 300, armor: 2, weapon: ranged(24, 6, 1.9, 650, 'moonArrow', 'hero'), speed: 330, radius: 34,
      heroAbilities: ['searingArrows', 'scout', 'trueshotAura', 'starfall'], perLevel: { hp: 65, damage: 3.5, armor: 0.4, mana: 25 },
      model: { arch: 'cavalry', scale: 1.25, body: '#e0e0ff', accent: PURPLE, skin: SKIN, weapon: 'bow', glow: '#c0d0ff' } }),
    h({ id: 'keeper', name: 'Keeper of the Grove', cls: 'hero', hp: 520, mana: 400, armor: 1, weapon: ranged(20, 6, 2.1, 600, 'natureBolt', 'hero', 900, 0.05), speed: 300, radius: 34,
      heroAbilities: ['entanglingRoots', 'forceOfNature', 'thornsAura', 'tranquility'], perLevel: { hp: 55, damage: 3, armor: 0.3, mana: 45 },
      model: { arch: 'hero', scale: 1.35, body: LEAF, accent: '#8a6a3a', skin: SKIN, weapon: 'staff', horns: true, glow: '#9aff7a' } }),
  ],
  specials: [{ unit: `${R}.chimaera`, cost: 190, cooldown: 45, count: 1 }, { unit: `${R}.glaiveThrower`, cost: 120, cooldown: 35, count: 2 }],
  waves: [
    [{ unit: `${R}.sentinel`, count: 2 }, { unit: `${R}.archer`, count: 1 }, { unit: `${R}.druid`, count: 1 }],
    [{ unit: `${R}.sentinel`, count: 2 }, { unit: `${R}.archer`, count: 2 }, { unit: `${R}.druid`, count: 1 }, { unit: `${R}.huntress`, count: 1 }],
    [{ unit: `${R}.sentinel`, count: 2 }, { unit: `${R}.archer`, count: 2 }, { unit: `${R}.druid`, count: 1 }, { unit: `${R}.huntress`, count: 2 }, { unit: `${R}.mountainGiant`, count: 1 }],
  ],
  forgeUpgrades: ['up.meleeWeapons', 'up.rangedWeapons', 'up.armor', 'up.casterTraining', 'up.mountedTraining', 'up.vitality', 'up.masonry'],
  sanctumUpgrades: [`${R}.up.marksmanship`, `${R}.up.roar`, `${R}.up.moonGlaive`, `${R}.up.shadowmeld`],
  upgrades: [
    sanctumUpgrade(R, 'marksmanship', 'Marksmanship', 'bow', 'Q', 175, 40, { units: [`${R}.archer`] }, { stat: { stat: 'damage', mul: 0.25 } }, 'Archers deal 25% more damage.'),
    sanctumUpgrade(R, 'roar', 'Roar', 'claws', 'W', 150, 35, { units: [`${R}.druid`] }, { ability: 'roar' }, 'Druids can Roar, increasing the damage of nearby allies.'),
    sanctumUpgrade(R, 'moonGlaive', 'Upgraded Moon Glaive', 'glaive', 'E', 150, 35, { units: [`${R}.huntress`] }, { stat: { stat: 'damage', mul: 0.2 } }, 'Huntresses deal 20% more damage.'),
    sanctumUpgrade(R, 'shadowmeld', 'Elune’s Grace', 'moon', 'R', 200, 45, { cls: ['melee', 'ranged', 'caster', 'mounted', 'heavy'] }, { stat: { stat: 'evasion', add: 0.06 } }, 'All army units gain +6% evasion.'),
  ],
  abilities: [
    { id: `${R}.rejuvenation`, name: 'Rejuvenation', icon: 'leaf', kind: 'active', target: 'ally', mana: 100, cooldown: 8, range: 600, effects: [{ t: 'buff', buff: `${R}.rejuv`, duration: 12 }], ai: { allyHpBelow: 0.6 }, fx: 'rejuvenation', description: 'Heals a friendly unit over time.' },
    { id: `${R}.roar`, name: 'Roar', icon: 'claws', kind: 'active', target: 'allyArea', mana: 75, cooldown: 20, range: 0, effects: [{ t: 'buff', buff: `${R}.roared`, duration: 30, aoe: 600 }], ai: { minEnemies: 2 }, fx: 'roar', description: 'Nearby allies deal 25% more damage.' },
    { id: `${R}.hardenedSkin`, name: 'Hardened Skin', icon: 'rock', kind: 'passive', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'passive', mods: { damageTakenMul: 0.85 } }], fx: '', description: 'Takes 15% less damage.' },
    { id: `${R}.manaBurn`, name: 'Mana Burn', icon: 'fire', kind: 'active', target: 'enemy', mana: 50, cooldown: 7, range: 300, effects: [{ t: 'manaBurn', amount: [60, 110, 160] }, { t: 'damage', amount: [60, 110, 160], attackType: 'spells' }], ai: {}, fx: 'manaBurn', description: 'Burns mana and deals damage.' },
    { id: `${R}.immolation`, name: 'Immolation', icon: 'fire', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.immolated`, radius: 200, allies: false }], fx: 'immolation', description: 'Burns nearby enemies.' },
    { id: `${R}.evasion`, name: 'Evasion', icon: 'wind', kind: 'passive', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'passive', mods: { evasionAdd: 0.15 }, perLevel: { evasionAdd: 0.1 } }], fx: '', description: 'Chance to avoid attacks.' },
    { id: `${R}.metamorphosis`, name: 'Metamorphosis', icon: 'star', kind: 'active', target: 'self', mana: 150, cooldown: 90, range: 0, effects: [{ t: 'heal', amount: 500 }, { t: 'buff', buff: `${R}.meta`, duration: 30 }], ai: { minEnemies: 3 }, fx: 'metamorphosis', description: 'Ultimate: transforms into a demon.' },
    { id: `${R}.searingArrows`, name: 'Searing Arrows', icon: 'fire', kind: 'passive', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'passive', mods: { damageAdd: 12 }, perLevel: { damageAdd: 10 } }], fx: '', description: 'Adds fire damage to attacks.' },
    { id: `${R}.scout`, name: 'Moonbeam', icon: 'moon', kind: 'active', target: 'enemy', mana: 60, cooldown: 8, range: 700, effects: [{ t: 'damage', amount: [90, 150, 220], attackType: 'spells' }], ai: {}, fx: 'moonbeam', description: 'A beam of moonlight strikes an enemy.' },
    { id: `${R}.trueshotAura`, name: 'Trueshot Aura', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.trueshot`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby allies deal more damage.' },
    { id: `${R}.starfall`, name: 'Starfall', icon: 'star', kind: 'active', target: 'enemyArea', mana: 200, cooldown: 90, range: 0, effects: [{ t: 'damage', amount: 480, aoe: 650, attackType: 'spells' }], ai: { minEnemies: 5 }, fx: 'starfall', description: 'Ultimate: stars fall from the sky.' },
    { id: `${R}.entanglingRoots`, name: 'Entangling Roots', icon: 'leaf', kind: 'active', target: 'enemy', mana: 75, cooldown: 8, range: 700, effects: [{ t: 'stun', duration: [3, 4, 5] }, { t: 'damage', amount: [60, 120, 180], attackType: 'spells' }], ai: {}, fx: 'ensnare', description: 'Roots an enemy.' },
    { id: `${R}.forceOfNature`, name: 'Force of Nature', icon: 'tree', kind: 'active', target: 'self', mana: 125, cooldown: 20, range: 0, effects: [{ t: 'summon', unit: `${R}.treant`, count: [2, 3, 4], duration: 40 }], ai: { minEnemies: 1 }, fx: 'summon', description: 'Summons treants.' },
    { id: `${R}.thornsAura`, name: 'Thorns Aura', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.thorny`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby allies return melee damage.' },
    { id: `${R}.tranquility`, name: 'Tranquility', icon: 'leaf', kind: 'active', target: 'allyArea', mana: 175, cooldown: 90, range: 0, effects: [{ t: 'buff', buff: `${R}.tranquil`, duration: 20, aoe: 800 }], ai: { minEnemies: 4 }, fx: 'tranquility', description: 'Ultimate: heals all nearby allies over time.' },
  ],
  buffs: [
    { id: `${R}.rejuv`, name: 'Rejuvenation', mods: {}, hot: 25, fx: 'rejuvenation' },
    { id: `${R}.roared`, name: 'Roar', mods: { damageMul: 0.25 }, fx: 'roar' },
    { id: `${R}.immolated`, name: 'Immolation', mods: {}, dot: 12, debuff: true, fx: 'burn' },
    { id: `${R}.meta`, name: 'Metamorphosis', mods: { damageAdd: 25, armorAdd: 2, rangeAdd: 400, attackSpeedMul: 0.2 }, fx: 'metamorphosis' },
    { id: `${R}.trueshot`, name: 'Trueshot Aura', mods: { damageMul: 0.15 }, fx: 'aura' },
    { id: `${R}.thorny`, name: 'Thorns Aura', mods: { thorns: 12 }, fx: 'aura' },
    { id: `${R}.tranquil`, name: 'Tranquility', mods: {}, hot: 30, fx: 'rejuvenation' },
  ],
  buildingStyle: { roof: '#4a3a8a', wall: '#6a5a4a', trim: '#7ad0c0', shape: 'tree' },
};

nightelf.units.push(unitFactory(R)({ id: 'treant', name: 'Treant', cls: 'summon', hp: 300, armor: 0, armorType: 'heavy', weapon: melee(14, 4, 1.4), bounty: 3, xp: 10,
  model: { arch: 'treant', scale: 0.8, body: '#5a4a2a', accent: LEAF } }));
