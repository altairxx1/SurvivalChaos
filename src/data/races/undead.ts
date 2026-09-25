import type { RaceDef } from '../../sim/defs/types';
import { heroFactory, melee, ranged, sanctumUpgrade, unitFactory } from './helpers';

const R = 'undead';
const u = unitFactory(R); const h = heroFactory(R);
const BONE = '#d8d0b8', DARK = '#3a2f4a', GREEN = '#5aff7a', FLESH = '#8a9a7a';

export const undead: RaceDef = {
  id: R, name: 'Undead', faction: 'chaos', color: '#6a4a8a',
  description: 'The Scourge feeds on the dead. Weak individually, they overwhelm with numbers and dark magic.',
  bonuses: ['+10% gold bounty', '-5% unit hit points', 'Necromancers raise skeletons'],
  modifiers: { goldBounty: 1.1, unitHp: 0.95 },
  melee: `${R}.ghoul`, ranged: `${R}.cryptFiend`, caster: `${R}.necromancer`, mounted: `${R}.deathRider`, heavy: `${R}.abomination`,
  units: [
    u({ id: 'ghoul', name: 'Ghoul', cls: 'melee', hp: 370, armor: 0, armorType: 'heavy', weapon: melee(12, 2, 1.3), speed: 290, bounty: 5,
      model: { arch: 'ghoul', scale: 0.95, body: FLESH, accent: DARK, weapon: 'claws' } }),
    u({ id: 'abomination', name: 'Abomination', cls: 'heavy', hp: 1100, armor: 2, armorType: 'heavy', speed: 250, radius: 38, abilities: ['diseaseCloud'], weapon: melee(32, 6, 1.9), bounty: 16, xp: 60, level: 4,
      model: { arch: 'giant', scale: 1.2, body: '#9ab08a', accent: '#6a3a3a', skin: '#9ab08a', weapon: 'scythe' } }),
    u({ id: 'cryptFiend', name: 'Crypt Fiend', cls: 'ranged', hp: 450, armor: 0, armorType: 'medium', speed: 250, radius: 32, weapon: ranged(26, 6, 2, 500, 'web', 'pierce', 900, 0.2), bounty: 7,
      model: { arch: 'fiend', scale: 1, body: '#3a4a3a', accent: '#8a6a3a' } }),
    u({ id: 'necromancer', name: 'Necromancer', cls: 'caster', hp: 300, mana: 250, armor: 0, armorType: 'unarmored', weapon: ranged(9, 3, 1.75, 600, 'shadowBolt', 'magic', 900, 0.05),
      abilities: ['raiseDead'], bounty: 8, model: { arch: 'caster', scale: 1, body: DARK, accent: BONE, weapon: 'staff', glow: GREEN } }),
    u({ id: 'deathRider', name: 'Death Rider', cls: 'mounted', hp: 700, armor: 3, armorType: 'heavy', speed: 360, radius: 34, weapon: melee(26, 6, 1.5), bounty: 12, xp: 45, level: 3,
      model: { arch: 'cavalry', scale: 1.1, body: '#2a2a3a', accent: BONE, weapon: 'scythe', glow: GREEN } }),
    u({ id: 'skeleton', name: 'Skeleton Warrior', cls: 'summon', hp: 150, armor: 0, armorType: 'heavy', weapon: melee(7, 2, 1.45), bounty: 3, xp: 10,
      model: { arch: 'skeleton', scale: 0.9, body: BONE, accent: DARK, weapon: 'sword' } }),
    u({ id: 'frostWyrm', name: 'Frost Wyrm', cls: 'special', hp: 1300, armor: 1, armorType: 'heavy', speed: 300, radius: 50, flying: true,
      weapon: { ...ranged(85, 20, 3, 500, 'frostBreath', 'magic', 900, 0.05), splash: { radius: 150, factor: 0.5 } }, bounty: 32, xp: 100, level: 6,
      model: { arch: 'dragon', scale: 1.4, body: '#bfe0f0', accent: '#5a8ab0', glow: '#9fe8ff' } }),
    u({ id: 'meatWagon', name: 'Meat Wagon', cls: 'siege', hp: 380, armor: 2, armorType: 'heavy', speed: 220, radius: 40, weapon: { ...ranged(70, 20, 4, 1100, 'corpse', 'siege', 650, 0.6), splash: { radius: 150, factor: 0.5 } },
      bounty: 20, xp: 60, level: 3, model: { arch: 'siege', scale: 1.1, body: '#4a3a2a', accent: FLESH } }),
  ],
  heroes: [
    h({ id: 'deathKnight', name: 'Death Knight', cls: 'hero', hp: 700, mana: 250, armor: 4, weapon: melee(26, 6, 2.2, 'hero'), speed: 320, radius: 34,
      heroAbilities: ['deathCoil', 'deathPact', 'unholyAura', 'animateDead'], perLevel: { hp: 100, damage: 3, armor: 0.6, mana: 18 },
      model: { arch: 'cavalry', scale: 1.3, body: '#1a1a2a', accent: '#6a8aa0', weapon: 'sword', glow: GREEN } }),
    h({ id: 'lich', name: 'Lich', cls: 'hero', hp: 500, mana: 400, armor: 1, weapon: ranged(22, 6, 2.1, 600, 'frostBolt', 'hero', 900, 0.05), speed: 280,
      heroAbilities: ['frostNova', 'frostArmor', 'darkRitualAura', 'deathAndDecay'], perLevel: { hp: 55, damage: 3, armor: 0.3, mana: 45 },
      model: { arch: 'hero', scale: 1.3, body: '#bfe0f0', accent: '#4a6a9a', weapon: 'staff', glow: '#7fe8ff' } }),
    h({ id: 'dreadlord', name: 'Dreadlord', cls: 'hero', hp: 650, mana: 300, armor: 2, weapon: melee(28, 6, 2.1, 'hero'), speed: 290,
      heroAbilities: ['carrionSwarm', 'sleep', 'vampiricAura', 'infernal'], perLevel: { hp: 90, damage: 3, armor: 0.5, mana: 25 },
      model: { arch: 'hero', scale: 1.35, body: '#3a1a3a', accent: '#8a2a4a', weapon: 'claws', horns: true, glow: '#c04aff' } }),
  ],
  specials: [{ unit: `${R}.frostWyrm`, cost: 200, cooldown: 50, count: 1 }, { unit: `${R}.meatWagon`, cost: 120, cooldown: 35, count: 2 }],
  waves: [
    [{ unit: `${R}.ghoul`, count: 2 }, { unit: `${R}.cryptFiend`, count: 1 }, { unit: `${R}.necromancer`, count: 1 }],
    [{ unit: `${R}.ghoul`, count: 3 }, { unit: `${R}.cryptFiend`, count: 1 }, { unit: `${R}.necromancer`, count: 1 }, { unit: `${R}.deathRider`, count: 1 }],
    [{ unit: `${R}.ghoul`, count: 3 }, { unit: `${R}.cryptFiend`, count: 2 }, { unit: `${R}.necromancer`, count: 1 }, { unit: `${R}.deathRider`, count: 1 }, { unit: `${R}.abomination`, count: 1 }],
  ],
  forgeUpgrades: ['up.meleeWeapons', 'up.rangedWeapons', 'up.armor', 'up.casterTraining', 'up.mountedTraining', 'up.vitality', 'up.masonry'],
  sanctumUpgrades: [`${R}.up.ghoulFrenzy`, `${R}.up.cripple`, `${R}.up.skeletalMastery`, `${R}.up.web`],
  upgrades: [
    sanctumUpgrade(R, 'ghoulFrenzy', 'Ghoul Frenzy', 'claws', 'Q', 150, 35, { units: [`${R}.ghoul`] }, { stat: { stat: 'attackSpeed', mul: 0.3 } }, 'Ghouls attack 30% faster.'),
    sanctumUpgrade(R, 'cripple', 'Cripple', 'skull', 'W', 175, 40, { units: [`${R}.necromancer`] }, { ability: 'cripple' }, 'Necromancers learn Cripple: reduces damage, movement and attack speed.'),
    sanctumUpgrade(R, 'skeletalMastery', 'Skeletal Mastery', 'bone', 'E', 150, 35, { units: [`${R}.skeleton`] }, { stat: { stat: 'damage', mul: 0.5 } }, 'Raised skeletons deal 50% more damage.'),
    sanctumUpgrade(R, 'web', 'Web', 'net', 'R', 125, 30, { units: [`${R}.cryptFiend`] }, { ability: 'web' }, 'Crypt Fiends can Web enemies in place.'),
  ],
  abilities: [
    { id: `${R}.raiseDead`, name: 'Raise Dead', icon: 'bone', kind: 'active', target: 'self', mana: 90, cooldown: 24, range: 0, effects: [{ t: 'summon', unit: `${R}.skeleton`, count: 2, duration: 30 }], ai: { minEnemies: 1 }, fx: 'summon', description: 'Raises two skeleton warriors.' },
    { id: `${R}.diseaseCloud`, name: 'Disease Cloud', icon: 'skull', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.disease`, radius: 220, allies: false }], fx: 'aura', description: 'Enemies nearby take damage over time.' },
    { id: `${R}.cripple`, name: 'Cripple', icon: 'skull', kind: 'active', target: 'enemy', mana: 125, cooldown: 12, range: 600, effects: [{ t: 'buff', buff: `${R}.crippled`, duration: 10 }], ai: {}, fx: 'cripple', description: 'Cripples an enemy.' },
    { id: `${R}.web`, name: 'Web', icon: 'net', kind: 'active', target: 'enemy', mana: 0, cooldown: 12, range: 500, effects: [{ t: 'stun', duration: 3 }], ai: {}, fx: 'ensnare', description: 'Webs an enemy.' },
    { id: `${R}.deathCoil`, name: 'Death Coil', icon: 'skull', kind: 'active', target: 'enemy', mana: 75, cooldown: 6, range: 800, effects: [{ t: 'damage', amount: [100, 200, 300], attackType: 'spells' }], ai: {}, fx: 'deathCoil', description: 'A coil of death that damages an enemy.' },
    { id: `${R}.deathPact`, name: 'Death Pact', icon: 'blood', kind: 'active', target: 'self', mana: 50, cooldown: 20, range: 0, effects: [{ t: 'heal', amount: [250, 400, 550] }], ai: { selfHpBelow: 0.45 }, fx: 'deathCoil', description: 'Consumes dark energy to heal.' },
    { id: `${R}.unholyAura`, name: 'Unholy Aura', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.unholy`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby allies move faster and regenerate.' },
    { id: `${R}.animateDead`, name: 'Animate Dead', icon: 'bone', kind: 'active', target: 'self', mana: 175, cooldown: 90, range: 0, effects: [{ t: 'summon', unit: `${R}.skeleton`, count: 6, duration: 40 }], ai: { minEnemies: 4 }, fx: 'summon', description: 'Ultimate: raises an army of the dead.' },
    { id: `${R}.frostNova`, name: 'Frost Nova', icon: 'snow', kind: 'active', target: 'enemy', mana: 125, cooldown: 8, range: 700, effects: [{ t: 'damage', amount: [100, 150, 200], aoe: 250, attackType: 'spells' }, { t: 'buff', buff: `${R}.frozen`, duration: 4, aoe: 250 }], ai: { minEnemies: 2 }, fx: 'frostNova', description: 'Blasts enemies with frost.' },
    { id: `${R}.frostArmor`, name: 'Frost Armor', icon: 'snow', kind: 'active', target: 'ally', mana: 40, cooldown: 4, range: 700, effects: [{ t: 'buff', buff: `${R}.frostArmored`, duration: 30 }], ai: { minEnemies: 1 }, fx: 'frostArmor', description: 'Gives an ally extra armor.' },
    { id: `${R}.darkRitualAura`, name: 'Dark Ritual', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.ritual`, radius: 800, allies: true }], fx: 'aura', description: 'Nearby allies regenerate mana.' },
    { id: `${R}.deathAndDecay`, name: 'Death and Decay', icon: 'skull', kind: 'active', target: 'enemyArea', mana: 250, cooldown: 90, range: 900, effects: [{ t: 'damage', amount: 450, aoe: 450, attackType: 'chaos' }], ai: { minEnemies: 4 }, fx: 'deathAndDecay', description: 'Ultimate: decays everything in an area.' },
    { id: `${R}.carrionSwarm`, name: 'Carrion Swarm', icon: 'bat', kind: 'active', target: 'enemyArea', mana: 110, cooldown: 10, range: 700, effects: [{ t: 'damage', amount: [75, 125, 200], aoe: 300, attackType: 'spells' }], ai: { minEnemies: 2 }, fx: 'carrionSwarm', description: 'A swarm of bats damages enemies in a cone.' },
    { id: `${R}.sleep`, name: 'Sleep', icon: 'moon', kind: 'active', target: 'enemy', mana: 50, cooldown: 6, range: 800, effects: [{ t: 'stun', duration: [4, 6, 8] }], ai: { onlyHeroes: false }, fx: 'sleep', description: 'Puts an enemy to sleep.' },
    { id: `${R}.vampiricAura`, name: 'Vampiric Aura', icon: 'aura', kind: 'aura', target: 'self', mana: 0, cooldown: 0, range: 0, effects: [{ t: 'aura', buff: `${R}.vampiric`, radius: 900, allies: true }], fx: 'aura', description: 'Nearby melee allies drain life.' },
    { id: `${R}.infernal`, name: 'Inferno', icon: 'fire', kind: 'active', target: 'enemyArea', mana: 175, cooldown: 90, range: 900, effects: [{ t: 'damage', amount: 200, aoe: 300, attackType: 'spells' }, { t: 'stun', duration: 2, aoe: 300 }, { t: 'summon', unit: `${R}.infernal`, count: 1, duration: 60 }], ai: { minEnemies: 3 }, fx: 'inferno', description: 'Ultimate: an Infernal crashes from the sky.' },
  ],
  buffs: [
    { id: `${R}.disease`, name: 'Disease', mods: {}, dot: 4, debuff: true, fx: 'poison' },
    { id: `${R}.crippled`, name: 'Cripple', mods: { speedMul: -0.5, attackSpeedMul: -0.5, damageMul: -0.5 }, debuff: true, fx: 'cripple' },
    { id: `${R}.unholy`, name: 'Unholy Aura', mods: { speedMul: 0.1, hpRegenAdd: 1.5 }, fx: 'aura' },
    { id: `${R}.frozen`, name: 'Frost', mods: { speedMul: -0.5, attackSpeedMul: -0.25 }, debuff: true, fx: 'frost' },
    { id: `${R}.frostArmored`, name: 'Frost Armor', mods: { armorAdd: 3 }, fx: 'frostArmor' },
    { id: `${R}.ritual`, name: 'Dark Ritual', mods: { manaRegenAdd: 1.5 }, fx: 'aura' },
    { id: `${R}.vampiric`, name: 'Vampiric Aura', mods: { lifesteal: 0.15 }, fx: 'aura' },
  ],
  buildingStyle: { roof: '#3a2f4a', wall: '#5a5a6a', trim: '#5aff7a', shape: 'crypt' },
};

undead.units.push(unitFactory(R)({ id: 'infernal', name: 'Infernal', cls: 'summon', hp: 1500, armor: 6, armorType: 'heavy', speed: 240, radius: 40, weapon: melee(45, 10, 1.8, 'chaos'),
  bounty: 20, xp: 60, level: 6, model: { arch: 'giant', scale: 1.3, body: '#3a2a1a', accent: '#ff6a1a', skin: '#3a2a1a', glow: '#ff6a1a' } }));
