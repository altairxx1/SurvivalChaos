import type { RaceDef } from '../../sim/defs/types';
import { heroFactory, melee, ranged, sanctumUpgrade, unitFactory } from './helpers';

const R = 'lordaeron';
const u = unitFactory(R); const h = heroFactory(R);
const BLUE = '#3f6fd8', STEEL = '#b9c3cf', GOLD = '#e0b84a';

export const lordaeron: RaceDef = {
  id: R, name: 'Lordaeron', faction: 'alliance', color: '#4a7be0',
  description: 'Jacks of all trades but masters of none. Very basic and simple, but versatile and adaptive.',
  bonuses: ['+15% research speed', '+5% unit hit points', 'Balanced units with no weaknesses'],
  modifiers: { researchSpeed: 1.15, unitHp: 1.05 },
  melee: `${R}.footman`, ranged: `${R}.archer`, caster: `${R}.mage`, mounted: `${R}.knight`, heavy: `${R}.pikeman`,
  units: [
    u({ id: 'footman', name: 'Footman', cls: 'melee', hp: 420, armor: 2, armorType: 'heavy', weapon: melee(11, 2), bounty: 6,
      model: { arch: 'infantry', scale: 1, body: BLUE, accent: STEEL, weapon: 'sword', shield: true }, description: 'Sturdy front-line soldier.' }),
    u({ id: 'pikeman', name: 'Pikeman', cls: 'heavy', hp: 560, armor: 3, armorType: 'heavy', weapon: melee(16, 4, 1.4, 'pierce', 140), bounty: 9, xp: 35,
      model: { arch: 'spearman', scale: 1.05, body: BLUE, accent: GOLD, weapon: 'spear' }, description: 'Long-reach infantry, strong against mounted units.' }),
    u({ id: 'archer', name: 'Archer', cls: 'ranged', hp: 310, armor: 0, armorType: 'medium', weapon: ranged(15, 3, 1.5, 550, 'arrow'), bounty: 6,
      model: { arch: 'archer', scale: 0.95, body: '#4f7a3a', accent: BLUE, weapon: 'bow' } }),
    u({ id: 'mage', name: 'Mage', cls: 'caster', hp: 300, mana: 300, armor: 0, armorType: 'unarmored', weapon: ranged(10, 3, 1.75, 600, 'magicMissile', 'magic', 900, 0.05),
      abilities: ['fireball'], bounty: 8, model: { arch: 'caster', scale: 1, body: '#8a3fd0', accent: GOLD, weapon: 'staff', glow: '#ff9a3a' } }),
    u({ id: 'knight', name: 'Knight', cls: 'mounted', hp: 850, armor: 5, armorType: 'heavy', speed: 350, radius: 34, weapon: melee(30, 8, 1.4), bounty: 14, xp: 50, level: 4,
      model: { arch: 'cavalry', scale: 1.1, body: BLUE, accent: STEEL, weapon: 'sword', shield: true } }),
    u({ id: 'gryphon', name: 'Gryphon Rider', cls: 'special', hp: 1100, armor: 2, armorType: 'light', speed: 380, radius: 40, flying: true,
      weapon: ranged(48, 10, 2.2, 450, 'stormHammer', 'magic', 900, 0.05), bounty: 30, xp: 90, level: 5,
      model: { arch: 'flyer', scale: 1.2, body: '#d8c29a', accent: BLUE, weapon: 'hammer' } }),
    u({ id: 'mortar', name: 'Mortar Team', cls: 'siege', hp: 380, armor: 0, armorType: 'heavy', speed: 240, weapon: { ...ranged(55, 10, 3.5, 1150, 'mortarShell', 'siege', 700, 0.6), splash: { radius: 150, factor: 0.5 } },
      bounty: 20, xp: 60, level: 3, model: { arch: 'siege', scale: 1, body: '#6b5842', accent: BLUE } }),
  ],
  heroes: [
    h({ id: 'paladin', name: 'Paladin', cls: 'hero', hp: 700, mana: 280, armor: 4, weapon: melee(24, 6, 2.2, 'hero'), speed: 280,
      heroAbilities: ['holyLight', 'divineShield', 'devotionAura', 'resurrection'], perLevel: { hp: 100, damage: 2.5, armor: 0.6, mana: 20 },
      model: { arch: 'hero', scale: 1.3, body: STEEL, accent: GOLD, weapon: 'hammer', shield: true, glow: '#ffe28a' }, description: 'Warrior hero, heals allies.' }),
    h({ id: 'archmage', name: 'Archmage', cls: 'hero', hp: 500, mana: 400, armor: 1, weapon: ranged(20, 6, 2.1, 600, 'magicMissile', 'hero', 900, 0.05), speed: 280,
      heroAbilities: ['blizzard', 'waterElemental', 'brillianceAura', 'massTeleportNova'], perLevel: { hp: 60, damage: 3, armor: 0.3, mana: 45 },
      model: { arch: 'hero', scale: 1.25, body: '#6a3fc2', accent: '#e8e8f0', weapon: 'staff', glow: '#7fd4ff' } }),
    h({ id: 'mountainKing', name: 'Mountain King', cls: 'hero', hp: 750, mana: 225, armor: 3, weapon: melee(26, 8, 2.2, 'hero'), speed: 270,
      heroAbilities: ['stormBolt', 'thunderClap', 'bash', 'avatar'], perLevel: { hp: 110, damage: 3, armor: 0.5, mana: 15 },
      model: { arch: 'hero', scale: 1.2, body: '#8a5a2b', accent: STEEL, weapon: 'hammer', glow: '#9ad0ff' } }),
  ],
  specials: [{ unit: `${R}.gryphon`, cost: 180, cooldown: 45, count: 1 }, { unit: `${R}.mortar`, cost: 120, cooldown: 35, count: 2 }],
  waves: [
    [{ unit: `${R}.footman`, count: 2 }, { unit: `${R}.archer`, count: 1 }, { unit: `${R}.mage`, count: 1 }],
    [{ unit: `${R}.footman`, count: 2 }, { unit: `${R}.pikeman`, count: 1 }, { unit: `${R}.archer`, count: 1 }, { unit: `${R}.mage`, count: 1 }, { unit: `${R}.knight`, count: 1 }],
    [{ unit: `${R}.footman`, count: 2 }, { unit: `${R}.pikeman`, count: 1 }, { unit: `${R}.archer`, count: 2 }, { unit: `${R}.mage`, count: 1 }, { unit: `${R}.knight`, count: 2 }],
  ],
  forgeUpgrades: ['up.meleeWeapons', 'up.rangedWeapons', 'up.armor', 'up.casterTraining', 'up.mountedTraining', 'up.vitality', 'up.masonry'],
  sanctumUpgrades: [`${R}.up.defend`, `${R}.up.slow`, `${R}.up.chivalry`, `${R}.up.longbows`],
  upgrades: [
    sanctumUpgrade(R, 'defend', 'Defend', 'shield', 'Q', 150, 35, { units: [`${R}.footman`] }, { ability: 'defend' }, 'Footmen take 40% less damage from piercing attacks.'),
    sanctumUpgrade(R, 'slow', 'Slow', 'hourglass', 'W', 175, 40, { units: [`${R}.mage`] }, { ability: 'slow' }, 'Mages learn Slow: reduces enemy movement and attack speed.'),
    sanctumUpgrade(R, 'chivalry', 'Chivalry', 'horse', 'E', 200, 45, { units: [`${R}.knight`] }, { ability: 'knightBash' }, 'Knights have a 15% chance to stun their target for 1 second.'),
    sanctumUpgrade(R, 'longbows', 'Long Rifles', 'bow', 'R', 125, 30, { units: [`${R}.archer`] }, { stat: { stat: 'range', add: 150 } }, 'Archers gain +150 attack range.'),
  ],
  abilities: [
    { id: `${R}.fireball`, name: 'Fireball', icon: 'fire', kind: 'active', target: 'enemy', mana: 60, cooldown: 9, range: 600, effects: [{ t: 'damage', amount: 70, attackType: 'spells' }], ai: {}, fx: 'fireball', description: 'Hurls a fireball dealing 70 damage.' },
    { id: `${R}.slow`, name: 'Slow', icon: 'hourglass', kind: 'active', target: 'enemy', mana: 50, cooldown: 10, range: 600, effects: [{ t: 'buff', buff: `${R}.slowed`, duration: 8 }], ai: {}, fx: 'slow', description: 'Slows movement by 60% and attack rate by 25%.' },
    { id: `${R}.defend`, name: 'Defend', icon: 'shield', kind: 'passive', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'passive', mods: { pierceTakenMul: 0.6 } }], fx: '', description: 'Takes 40% less piercing damage.' },
    { id: `${R}.knightBash`, name: 'Chivalry', icon: 'horse', kind: 'passive', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'passive', mods: { bashChance: 0.15, bashDuration: 1 } }], fx: '', description: '15% chance to stun.' },
    { id: `${R}.holyLight`, name: 'Holy Light', icon: 'holy', kind: 'active', target: 'ally', mana: 65, cooldown: 7, range: 700, effects: [{ t: 'heal', amount: [200, 400, 600] }], ai: { allyHpBelow: 0.55 }, fx: 'holyLight', description: 'Heals a friendly unit.' },
    { id: `${R}.divineShield`, name: 'Divine Shield', icon: 'shield', kind: 'active', target: 'self', mana: 25, cooldown: [35, 50, 65], range: 0, effects: [{ t: 'buff', buff: `${R}.divine`, duration: [8, 12, 16] }], ai: { selfHpBelow: 0.35 }, fx: 'divineShield', description: 'Becomes invulnerable for a short time.' },
    { id: `${R}.devotionAura`, name: 'Devotion Aura', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.devotion`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby allies gain armor.' },
    { id: `${R}.resurrection`, name: 'Guardian Light', icon: 'holy', kind: 'active', target: 'allyArea', mana: 150, cooldown: 90, range: 0, effects: [{ t: 'heal', amount: 500, aoe: 700 }], ai: { minEnemies: 4 }, fx: 'holyNova', description: 'Ultimate: heals all nearby allies for 500.' },
    { id: `${R}.blizzard`, name: 'Blizzard', icon: 'snow', kind: 'active', target: 'enemyArea', mana: 75, cooldown: 8, range: 800, effects: [{ t: 'damage', amount: [90, 150, 220], aoe: 250, attackType: 'spells' }], ai: { minEnemies: 3 }, fx: 'blizzard', description: 'Ice shards damage units in an area.' },
    { id: `${R}.waterElemental`, name: 'Summon Water Elemental', icon: 'water', kind: 'active', target: 'self', mana: 125, cooldown: 25, range: 0, effects: [{ t: 'summon', unit: `${R}.waterElemental`, count: [1, 1, 2], duration: 45 }], ai: { minEnemies: 1 }, fx: 'summon', description: 'Summons a Water Elemental.' },
    { id: `${R}.brillianceAura`, name: 'Brilliance Aura', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.brilliance`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby allies regenerate mana faster.' },
    { id: `${R}.massTeleportNova`, name: 'Arcane Nova', icon: 'star', kind: 'active', target: 'enemyArea', mana: 150, cooldown: 60, range: 0, effects: [{ t: 'damage', amount: 400, aoe: 600, attackType: 'spells' }], ai: { minEnemies: 5 }, fx: 'arcaneNova', description: 'Ultimate: arcane explosion around the hero.' },
    { id: `${R}.stormBolt`, name: 'Storm Bolt', icon: 'hammer', kind: 'active', target: 'enemy', mana: 75, cooldown: 9, range: 600, effects: [{ t: 'damage', amount: [100, 225, 350], attackType: 'spells' }, { t: 'stun', duration: [2, 3, 4] }], ai: {}, fx: 'stormBolt', description: 'Throws a hammer that damages and stuns.' },
    { id: `${R}.thunderClap`, name: 'Thunder Clap', icon: 'thunder', kind: 'active', target: 'enemyArea', mana: 90, cooldown: 7, range: 0, effects: [{ t: 'damage', amount: [60, 110, 150], aoe: 300, attackType: 'spells' }, { t: 'buff', buff: `${R}.slowed`, duration: 4, aoe: 300 }], ai: { minEnemies: 3 }, fx: 'thunderClap', description: 'Slams the ground, damaging and slowing nearby enemies.' },
    { id: `${R}.bash`, name: 'Bash', icon: 'hammer', kind: 'passive', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'passive', mods: { bashChance: 0.2, bashDuration: 1.5, damageAdd: 15 }, perLevel: { bashChance: 0.08 } }], fx: '', description: 'Chance to stun.' },
    { id: `${R}.avatar`, name: 'Avatar', icon: 'star', kind: 'active', target: 'self', mana: 150, cooldown: 90, range: 0, effects: [{ t: 'buff', buff: `${R}.avatar`, duration: 30 }], ai: { minEnemies: 3 }, fx: 'avatar', description: 'Ultimate: grows in size, gaining armor and damage.' },
  ],
  buffs: [
    { id: `${R}.slowed`, name: 'Slowed', mods: { speedMul: -0.6, attackSpeedMul: -0.25 }, debuff: true, fx: 'slow' },
    { id: `${R}.divine`, name: 'Divine Shield', mods: { damageTakenMul: 0 }, fx: 'divineShield' },
    { id: `${R}.devotion`, name: 'Devotion Aura', mods: { armorAdd: 3 }, fx: 'aura' },
    { id: `${R}.brilliance`, name: 'Brilliance Aura', mods: { manaRegenAdd: 1.5 }, fx: 'aura' },
    { id: `${R}.avatar`, name: 'Avatar', mods: { armorAdd: 5, damageAdd: 20, damageTakenMul: 0.8 }, fx: 'avatar' },
  ],
  buildingStyle: { roof: '#2f55b0', wall: '#c9c2b2', trim: '#e0b84a', shape: 'stone' },
};

lordaeron.units.push(unitFactory(R)({ id: 'waterElemental', name: 'Water Elemental', cls: 'summon', hp: 525, armor: 1, armorType: 'heavy', weapon: ranged(18, 5, 1.5, 300, 'waterBolt', 'pierce', 900, 0.1),
  bounty: 5, model: { arch: 'beast', scale: 1, body: '#3fa8e0', accent: '#bfe8ff', glow: '#6fd0ff' } }));
