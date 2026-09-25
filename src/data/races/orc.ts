import type { RaceDef } from '../../sim/defs/types';
import { heroFactory, melee, ranged, sanctumUpgrade, unitFactory } from './helpers';

const R = 'orc';
const u = unitFactory(R); const h = heroFactory(R);
const RED = '#b0301f', SKIN = '#5f8f3a', LEATHER = '#6b4a2b';

export const orc: RaceDef = {
  id: R, name: 'Orc', faction: 'horde', color: '#c0392b',
  description: 'Brutal warriors with high hit points. Slower to research but hard to kill.',
  bonuses: ['+10% unit hit points', '-10% research speed', 'Strong melee'],
  modifiers: { unitHp: 1.1, researchSpeed: 0.9 },
  melee: `${R}.grunt`, ranged: `${R}.headhunter`, caster: `${R}.shaman`, mounted: `${R}.raider`, heavy: `${R}.tauren`,
  units: [
    u({ id: 'grunt', name: 'Grunt', cls: 'melee', hp: 480, armor: 1, armorType: 'heavy', weapon: melee(15, 4, 1.5), bounty: 6,
      model: { arch: 'brute', scale: 1.05, body: RED, accent: LEATHER, skin: SKIN, weapon: 'axe' } }),
    u({ id: 'tauren', name: 'Tauren', cls: 'heavy', hp: 1100, armor: 3, armorType: 'medium', speed: 250, radius: 36, weapon: { ...melee(30, 8, 1.9), splash: { radius: 120, factor: 0.4 } }, bounty: 16, xp: 60, level: 4,
      model: { arch: 'giant', scale: 1.15, body: '#6b4a2b', accent: RED, skin: '#8a6a4a', weapon: 'hammer', horns: true } }),
    u({ id: 'headhunter', name: 'Headhunter', cls: 'ranged', hp: 330, armor: 0, armorType: 'medium', weapon: ranged(21, 3, 2.3, 550, 'spear'), bounty: 6,
      model: { arch: 'archer', scale: 1, body: '#2f7a6a', accent: RED, skin: '#4f8fa0', weapon: 'spear' } }),
    u({ id: 'shaman', name: 'Shaman', cls: 'caster', hp: 330, mana: 250, armor: 0, armorType: 'unarmored', weapon: ranged(9, 3, 1.75, 600, 'lightningOrb', 'magic', 900, 0.05),
      abilities: ['lightningShield'], bounty: 8, model: { arch: 'caster', scale: 1, body: LEATHER, accent: RED, skin: SKIN, weapon: 'staff', glow: '#7fd4ff' } }),
    u({ id: 'raider', name: 'Wolf Raider', cls: 'mounted', hp: 650, armor: 1, armorType: 'medium', speed: 380, radius: 34, weapon: { ...melee(24, 6, 1.85, 'siege'), }, bounty: 12, xp: 45, level: 3,
      model: { arch: 'wolfrider', scale: 1.1, body: RED, accent: '#5a5a5a', skin: SKIN, weapon: 'sword' } }),
    u({ id: 'kodo', name: 'Kodo Beast', cls: 'special', hp: 1200, armor: 1, armorType: 'heavy', speed: 240, radius: 48, abilities: ['warDrums'],
      weapon: ranged(24, 8, 1.4, 500, 'spear', 'pierce'), bounty: 25, xp: 80, level: 5, model: { arch: 'beast', scale: 1.4, body: '#8a7a6a', accent: RED } }),
    u({ id: 'catapult', name: 'Demolisher', cls: 'siege', hp: 425, armor: 2, armorType: 'heavy', speed: 220, radius: 40, weapon: { ...ranged(80, 20, 4, 1100, 'boulder', 'siege', 650, 0.6), splash: { radius: 160, factor: 0.5 } },
      bounty: 20, xp: 60, level: 3, model: { arch: 'siege', scale: 1.1, body: LEATHER, accent: RED } }),
  ],
  heroes: [
    h({ id: 'blademaster', name: 'Blademaster', cls: 'hero', hp: 650, mana: 225, armor: 2, weapon: melee(26, 8, 1.7, 'hero'), speed: 300,
      heroAbilities: ['windWalk', 'mirrorStrike', 'criticalStrike', 'bladestorm'], perLevel: { hp: 80, damage: 4, armor: 0.6, mana: 15 },
      model: { arch: 'hero', scale: 1.2, body: '#a03020', accent: '#d0d0d0', skin: SKIN, weapon: 'sword', glow: '#ff6a3a' } }),
    h({ id: 'farSeer', name: 'Far Seer', cls: 'hero', hp: 550, mana: 380, armor: 1, weapon: ranged(22, 6, 2.1, 600, 'lightningOrb', 'hero', 900, 0.05), speed: 320,
      heroAbilities: ['chainLightning', 'spiritWolves', 'farSight', 'earthquake'], perLevel: { hp: 60, damage: 3, armor: 0.3, mana: 40 },
      model: { arch: 'cavalry', scale: 1.25, body: '#3a5a8a', accent: '#e0e0e0', skin: SKIN, weapon: 'staff', glow: '#7fd4ff' } }),
    h({ id: 'taurenChieftain', name: 'Tauren Chieftain', cls: 'hero', hp: 900, mana: 200, armor: 2, weapon: melee(30, 8, 2.2, 'hero', 120), speed: 270, radius: 36,
      heroAbilities: ['shockwave', 'warStomp', 'enduranceAura', 'reincarnationRoar'], perLevel: { hp: 120, damage: 3.5, armor: 0.5, mana: 15 },
      model: { arch: 'giant', scale: 1.4, body: '#6b4a2b', accent: '#e0b84a', skin: '#8a6a4a', weapon: 'hammer', horns: true, glow: '#ffc04a' } }),
  ],
  specials: [{ unit: `${R}.kodo`, cost: 170, cooldown: 45, count: 1 }, { unit: `${R}.catapult`, cost: 130, cooldown: 35, count: 2 }],
  waves: [
    [{ unit: `${R}.grunt`, count: 2 }, { unit: `${R}.headhunter`, count: 1 }, { unit: `${R}.shaman`, count: 1 }],
    [{ unit: `${R}.grunt`, count: 2 }, { unit: `${R}.headhunter`, count: 1 }, { unit: `${R}.shaman`, count: 1 }, { unit: `${R}.raider`, count: 1 }, { unit: `${R}.tauren`, count: 1 }],
    [{ unit: `${R}.grunt`, count: 3 }, { unit: `${R}.headhunter`, count: 2 }, { unit: `${R}.shaman`, count: 1 }, { unit: `${R}.raider`, count: 2 }, { unit: `${R}.tauren`, count: 1 }],
  ],
  forgeUpgrades: ['up.meleeWeapons', 'up.rangedWeapons', 'up.armor', 'up.casterTraining', 'up.mountedTraining', 'up.vitality', 'up.masonry'],
  sanctumUpgrades: [`${R}.up.berserker`, `${R}.up.bloodlust`, `${R}.up.ensnare`, `${R}.up.regeneration`],
  upgrades: [
    sanctumUpgrade(R, 'berserker', 'Berserker Strength', 'axe', 'Q', 175, 40, { units: [`${R}.grunt`] }, { stat: { stat: 'hp', mul: 0.2 } }, 'Grunts gain +20% hit points.'),
    sanctumUpgrade(R, 'bloodlust', 'Bloodlust', 'blood', 'W', 175, 40, { units: [`${R}.shaman`] }, { ability: 'bloodlust' }, 'Shamans learn Bloodlust: +40% attack speed and +25% movement speed on an ally.'),
    sanctumUpgrade(R, 'ensnare', 'Ensnare', 'net', 'E', 150, 35, { units: [`${R}.raider`] }, { ability: 'ensnare' }, 'Raiders can Ensnare enemies, rooting them in place.'),
    sanctumUpgrade(R, 'regeneration', 'Troll Regeneration', 'heart', 'R', 125, 30, { cls: ['melee', 'ranged', 'heavy', 'mounted'] }, { stat: { stat: 'hpRegen', add: 1.5 } }, 'Army units regenerate 1.5 hit points per second faster.'),
  ],
  abilities: [
    { id: `${R}.lightningShield`, name: 'Lightning Shield', icon: 'thunder', kind: 'active', target: 'ally', mana: 75, cooldown: 12, range: 600, effects: [{ t: 'buff', buff: `${R}.lshield`, duration: 12 }], ai: { minEnemies: 2 }, fx: 'lightningShield', description: 'Surrounds an ally with lightning that damages nearby enemies.' },
    { id: `${R}.bloodlust`, name: 'Bloodlust', icon: 'blood', kind: 'active', target: 'ally', mana: 50, cooldown: 8, range: 600, effects: [{ t: 'buff', buff: `${R}.bloodlusted`, duration: 25 }], ai: { minEnemies: 1 }, fx: 'bloodlust', description: 'Increases attack and movement speed of an ally.' },
    { id: `${R}.ensnare`, name: 'Ensnare', icon: 'net', kind: 'active', target: 'enemy', mana: 0, cooldown: 12, range: 550, effects: [{ t: 'stun', duration: 3 }], ai: {}, fx: 'ensnare', description: 'Roots a target.' },
    { id: `${R}.warDrums`, name: 'War Drums', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.drums`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby allies deal 15% more damage.' },
    { id: `${R}.windWalk`, name: 'Wind Walk', icon: 'wind', kind: 'active', target: 'self', mana: 75, cooldown: 12, range: 0, effects: [{ t: 'buff', buff: `${R}.windwalk`, duration: 4 }], ai: { minEnemies: 1 }, fx: 'windWalk', description: 'Bursts forward, next strikes deal bonus damage.' },
    { id: `${R}.mirrorStrike`, name: 'Blade Flurry', icon: 'sword', kind: 'active', target: 'enemyArea', mana: 80, cooldown: 10, range: 0, effects: [{ t: 'damage', amount: [80, 140, 200], aoe: 250, attackType: 'hero' }], ai: { minEnemies: 2 }, fx: 'bladeFlurry', description: 'Strikes all enemies around the Blademaster.' },
    { id: `${R}.criticalStrike`, name: 'Critical Strike', icon: 'sword', kind: 'passive', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'passive', mods: { critChance: 0.15, critMul: 2 }, perLevel: { critMul: 1 } }], fx: '', description: '15% chance to deal 2x/3x/4x damage.' },
    { id: `${R}.bladestorm`, name: 'Bladestorm', icon: 'wind', kind: 'active', target: 'enemyArea', mana: 200, cooldown: 90, range: 0, effects: [{ t: 'damage', amount: 450, aoe: 350, attackType: 'hero' }, { t: 'buff', buff: `${R}.windwalk`, duration: 3 }], ai: { minEnemies: 4 }, fx: 'bladestorm', description: 'Ultimate: a whirlwind of blades.' },
    { id: `${R}.chainLightning`, name: 'Chain Lightning', icon: 'thunder', kind: 'active', target: 'enemy', mana: 120, cooldown: 9, range: 700, effects: [{ t: 'chain', amount: [85, 125, 180], bounces: [4, 5, 6], falloff: 0.15, range: 500 }], ai: { minEnemies: 2 }, fx: 'chainLightning', description: 'Lightning that jumps between enemies.' },
    { id: `${R}.spiritWolves`, name: 'Feral Spirit', icon: 'wolf', kind: 'active', target: 'self', mana: 75, cooldown: 25, range: 0, effects: [{ t: 'summon', unit: `${R}.spiritWolf`, count: 2, duration: 45 }], ai: { minEnemies: 1 }, fx: 'summon', description: 'Summons two spirit wolves.' },
    { id: `${R}.farSight`, name: 'Spirit Link', icon: 'eye', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.spiritLink`, radius: 700, allies: true }], fx: 'aura', description: 'Nearby allies take 15% less damage.' },
    { id: `${R}.earthquake`, name: 'Earthquake', icon: 'rock', kind: 'active', target: 'enemyArea', mana: 150, cooldown: 75, range: 900, effects: [{ t: 'damage', amount: 350, aoe: 400, attackType: 'siege' }, { t: 'buff', buff: `${R}.quaked`, duration: 6, aoe: 400 }], ai: { minEnemies: 4 }, fx: 'earthquake', description: 'Ultimate: shakes the earth, crushing buildings and units.' },
    { id: `${R}.shockwave`, name: 'Shockwave', icon: 'wave', kind: 'active', target: 'enemyArea', mana: 100, cooldown: 8, range: 700, effects: [{ t: 'damage', amount: [75, 130, 200], aoe: 280, attackType: 'spells' }], ai: { minEnemies: 2 }, fx: 'shockwave', description: 'Sends a wave of force.' },
    { id: `${R}.warStomp`, name: 'War Stomp', icon: 'hoof', kind: 'active', target: 'enemyArea', mana: 90, cooldown: 7, range: 0, effects: [{ t: 'damage', amount: [25, 50, 75], aoe: 300, attackType: 'spells' }, { t: 'stun', duration: [2, 2.5, 3], aoe: 300 }], ai: { minEnemies: 3 }, fx: 'warStomp', description: 'Stuns nearby enemies.' },
    { id: `${R}.enduranceAura`, name: 'Endurance Aura', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.endurance`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby allies attack and move faster.' },
    { id: `${R}.reincarnationRoar`, name: 'Ancestral Fury', icon: 'star', kind: 'active', target: 'self', mana: 150, cooldown: 90, range: 0, effects: [{ t: 'heal', amount: 800 }, { t: 'buff', buff: `${R}.bloodlusted`, duration: 20, aoe: 700 }], ai: { selfHpBelow: 0.3 }, fx: 'holyNova', description: 'Ultimate: heals itself and bloodlusts nearby allies.' },
  ],
  buffs: [
    { id: `${R}.lshield`, name: 'Lightning Shield', mods: { thorns: 20 }, fx: 'lightningShield' },
    { id: `${R}.bloodlusted`, name: 'Bloodlust', mods: { attackSpeedMul: 0.4, speedMul: 0.25 }, fx: 'bloodlust' },
    { id: `${R}.drums`, name: 'War Drums', mods: { damageMul: 0.15 }, fx: 'aura' },
    { id: `${R}.windwalk`, name: 'Wind Walk', mods: { speedMul: 0.5, damageAdd: 40 }, fx: 'windWalk' },
    { id: `${R}.spiritLink`, name: 'Spirit Link', mods: { damageTakenMul: 0.85 }, fx: 'aura' },
    { id: `${R}.quaked`, name: 'Earthquake', mods: { speedMul: -0.5 }, debuff: true, dot: 30, fx: 'slow' },
    { id: `${R}.endurance`, name: 'Endurance Aura', mods: { attackSpeedMul: 0.1, speedMul: 0.1 }, fx: 'aura' },
  ],
  buildingStyle: { roof: '#8a2a1a', wall: '#7a5a3a', trim: '#d0a060', shape: 'hut' },
};

orc.units.push(unitFactory(R)({ id: 'spiritWolf', name: 'Spirit Wolf', cls: 'summon', hp: 300, armor: 0, armorType: 'medium', speed: 350, weapon: melee(11, 2, 1.35),
  bounty: 4, model: { arch: 'beast', scale: 0.8, body: '#7ab0e0', accent: '#dfefff', glow: '#9fd8ff' } }));
