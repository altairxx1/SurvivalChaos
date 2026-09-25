/**
 * Shared (race independent) data. PLACEHOLDER VALUES: tuned by hand to WC3 conventions until
 * tools/extract produces the real numbers from the original map (see docs/EXTRACTION.md).
 */
import type { AttackType, ArmorType, BuildingDef, BuildingKind, GameModeDef, ItemDef, UpgradeDef, UnitClass } from '../sim/defs/types';

/** Warcraft III 1.3x damage table: attack type -> armor type -> multiplier. */
export const DAMAGE_TABLE: Record<AttackType, Record<ArmorType, number>> = {
  normal: { light: 1.0, medium: 1.5, heavy: 1.0, fortified: 0.7, hero: 1.0, unarmored: 1.0, divine: 0.05 },
  pierce: { light: 2.0, medium: 0.75, heavy: 1.0, fortified: 0.35, hero: 0.5, unarmored: 1.5, divine: 0.05 },
  siege: { light: 1.0, medium: 0.5, heavy: 1.0, fortified: 1.5, hero: 0.5, unarmored: 1.5, divine: 0.05 },
  magic: { light: 1.25, medium: 0.75, heavy: 2.0, fortified: 0.35, hero: 0.5, unarmored: 1.0, divine: 0.05 },
  chaos: { light: 1.0, medium: 1.0, heavy: 1.0, fortified: 1.0, hero: 1.0, unarmored: 1.0, divine: 1.0 },
  spells: { light: 1.0, medium: 1.0, heavy: 1.0, fortified: 1.0, hero: 0.7, unarmored: 1.0, divine: 0.05 },
  hero: { light: 1.0, medium: 1.0, heavy: 1.0, fortified: 0.5, hero: 1.0, unarmored: 1.0, divine: 0.05 },
};

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  fortress: { id: 'fortress', name: 'Fortress', kind: 'fortress', hp: 20000, armor: 7, armorType: 'fortified', hpRegen: 3, radius: 250,
    weapon: { attackType: 'chaos', base: 110, dice: 1, sides: 30, cooldown: 1.0, range: 900, damagePoint: 0.1, projectile: { speed: 1100, fx: 'fortressBolt', arc: 0.15 }, splash: { radius: 140, factor: 0.5 } }, bounty: 600, xp: 500 },
  barracks: { id: 'barracks', name: 'Barracks', kind: 'barracks', hp: 6500, armor: 5, armorType: 'fortified', hpRegen: 1, radius: 170, bounty: 150, xp: 200 },
  tower: { id: 'tower', name: 'Guard Tower', kind: 'tower', hp: 3400, armor: 5, armorType: 'fortified', hpRegen: 1, radius: 85,
    weapon: { attackType: 'chaos', base: 75, dice: 1, sides: 20, cooldown: 0.9, range: 750, damagePoint: 0.1, projectile: { speed: 1400, fx: 'towerArrow', arc: 0.1 } }, bounty: 100, xp: 100 },
  altar: { id: 'altar', name: 'Altar of Heroes', kind: 'altar', hp: 2720, armor: 2, armorType: 'fortified', hpRegen: 1, radius: 140, bounty: 80, xp: 60 },
  forge: { id: 'forge', name: 'War Forge', kind: 'forge', hp: 2550, armor: 2, armorType: 'fortified', hpRegen: 1, radius: 140, bounty: 80, xp: 60 },
  sanctum: { id: 'sanctum', name: 'Sanctum', kind: 'sanctum', hp: 2380, armor: 2, armorType: 'fortified', hpRegen: 1, radius: 130, bounty: 80, xp: 60 },
  goldAltar: { id: 'goldAltar', name: 'Altar of Gold', kind: 'goldAltar', hp: 2380, armor: 2, armorType: 'fortified', hpRegen: 1, radius: 130, bounty: 80, xp: 60 },
  mercCamp: { id: 'mercCamp', name: 'Mercenary Camp', kind: 'mercCamp', hp: 2380, armor: 2, armorType: 'fortified', hpRegen: 1, radius: 140, bounty: 80, xp: 60 },
};

const ARMY: UnitClass[] = ['melee', 'ranged', 'caster', 'mounted', 'heavy', 'siege', 'special', 'summon'];

export const SHARED_UPGRADES: UpgradeDef[] = [
  { id: 'up.meleeWeapons', name: 'Melee Weapons', icon: 'sword', hotkey: 'Q', scope: 'player', maxLevel: 10, cost: [60, 30], time: [15, 3],
    effects: [{ t: 'stat', filter: { cls: ['melee', 'heavy'] }, stat: 'damage', mul: 0.1 }], description: 'Increases the attack damage of melee and heavy units by 10% per level.' },
  { id: 'up.rangedWeapons', name: 'Ranged Weapons', icon: 'bow', hotkey: 'W', scope: 'player', maxLevel: 10, cost: [60, 30], time: [15, 3],
    effects: [{ t: 'stat', filter: { cls: ['ranged', 'siege'] }, stat: 'damage', mul: 0.1 }], description: 'Increases the attack damage of ranged and siege units by 10% per level.' },
  { id: 'up.armor', name: 'Unit Armor', icon: 'shield', hotkey: 'E', scope: 'player', maxLevel: 10, cost: [70, 35], time: [18, 3],
    effects: [{ t: 'stat', filter: { cls: ARMY }, stat: 'armor', add: 1 }], description: 'Increases the armor of all army units by 1 per level.' },
  { id: 'up.casterTraining', name: 'Caster Training', icon: 'orb', hotkey: 'R', scope: 'player', maxLevel: 5, cost: [80, 40], time: [20, 5],
    effects: [{ t: 'stat', filter: { cls: ['caster'] }, stat: 'damage', mul: 0.12 }, { t: 'stat', filter: { cls: ['caster'] }, stat: 'hp', mul: 0.08 }, { t: 'stat', filter: { cls: ['caster'] }, stat: 'mana', mul: 0.15 }],
    description: 'Casters gain +12% damage, +8% hit points and +15% mana per level.' },
  { id: 'up.mountedTraining', name: 'Mounted Training', icon: 'horse', hotkey: 'A', scope: 'player', maxLevel: 5, cost: [90, 45], time: [20, 5],
    effects: [{ t: 'stat', filter: { cls: ['mounted'] }, stat: 'damage', mul: 0.1 }, { t: 'stat', filter: { cls: ['mounted'] }, stat: 'hp', mul: 0.1 }],
    description: 'Mounted units gain +10% damage and +10% hit points per level.' },
  { id: 'up.vitality', name: 'Vitality', icon: 'heart', hotkey: 'S', scope: 'player', maxLevel: 10, cost: [70, 35], time: [18, 3],
    effects: [{ t: 'stat', filter: { cls: ARMY }, stat: 'hp', mul: 0.06 }], description: 'Increases the hit points of all army units by 6% per level.' },
  { id: 'up.masonry', name: 'Masonry', icon: 'brick', hotkey: 'D', scope: 'player', maxLevel: 5, cost: [100, 50], time: [25, 5],
    effects: [{ t: 'stat', filter: { buildings: ['fortress', 'barracks', 'tower', 'altar', 'forge', 'sanctum', 'goldAltar', 'mercCamp'] }, stat: 'armor', add: 2 },
      { t: 'stat', filter: { buildings: ['fortress', 'barracks', 'tower', 'altar', 'forge', 'sanctum', 'goldAltar', 'mercCamp'] }, stat: 'hp', mul: 0.1 }],
    description: 'Buildings gain +2 armor and +10% hit points per level.' },

  { id: 'up.fortress', name: 'Upgrade Fortress', icon: 'castle', hotkey: 'U', scope: 'player', maxLevel: 2, cost: [450, 450], time: [60, 30],
    effects: [{ t: 'fortress' }, { t: 'income', add: 10 }], description: 'Upgrades the Fortress: +3000 hit points, +50% damage, +10 income. Level 2 unlocks tier 3 Barracks.' },
  { id: 'up.tier', name: 'Upgrade Barracks', icon: 'barracks', hotkey: 'U', scope: 'building', maxLevel: 2, cost: [300, 300], time: [40, 20],
    effects: [{ t: 'tier' }], description: 'Upgrades this Barracks to the next tier. Higher tiers spawn larger waves with mounted and heavy units. Tier 3 requires a level 2 Fortress.' },
  { id: 'up.towerLevel', name: 'Upgrade Tower', icon: 'tower', hotkey: 'U', scope: 'building', maxLevel: 5, cost: [90, 45], time: [20, 5],
    effects: [{ t: 'towerLevel' }], description: 'Upgrades this tower: +25% damage and +15% hit points per level.' },

  { id: 'up.goldMining', name: 'Gold Gathering', icon: 'coins', hotkey: 'Q', scope: 'player', maxLevel: 10, cost: [100, 50], time: [20, 4],
    effects: [{ t: 'income', add: 5 }], description: 'Increases your periodic income by 5 gold per level.' },
  { id: 'up.bountyHunter', name: 'Bounty Hunter', icon: 'skull', hotkey: 'W', scope: 'player', maxLevel: 5, cost: [120, 60], time: [25, 5],
    effects: [{ t: 'bounty', mul: 0.06 }], description: 'Increases gold received from kills by 6% per level.' },
  { id: 'up.artifacts', name: 'Artifact Hunting', icon: 'gem', hotkey: 'E', scope: 'player', maxLevel: 5, cost: [150, 75], time: [25, 5],
    effects: [{ t: 'artifactChance', add: 0.015 }], description: 'Heroes find artifacts more often (+1.5% chance per kill per level). Two equal artifacts combine into a stronger one, up to level 5.' },
];

const FAMILIES: { family: string; name: string; icon: string; per: (l: number) => ItemDef['mods'] }[] = [
  { family: 'claws', name: 'Claws of Attack', icon: 'claws', per: l => ({ damageAdd: [4, 8, 14, 22, 32][l - 1] }) },
  { family: 'ring', name: 'Ring of Protection', icon: 'ring', per: l => ({ armorAdd: [2, 3, 5, 7, 10][l - 1] }) },
  { family: 'periapt', name: 'Periapt of Vitality', icon: 'heart', per: l => ({ hpAdd: [150, 300, 500, 750, 1100][l - 1] }) },
  { family: 'gloves', name: 'Gloves of Haste', icon: 'gloves', per: l => ({ attackSpeedMul: [0.1, 0.18, 0.28, 0.4, 0.55][l - 1] }) },
  { family: 'boots', name: 'Boots of Speed', icon: 'boots', per: l => ({ speedMul: [0.06, 0.1, 0.14, 0.18, 0.24][l - 1] }) },
  { family: 'orb', name: 'Vampiric Orb', icon: 'orb', per: l => ({ lifesteal: [0.06, 0.1, 0.15, 0.2, 0.28][l - 1] }) },
  { family: 'pendant', name: 'Pendant of Energy', icon: 'pendant', per: l => ({ manaAdd: [100, 200, 320, 480, 700][l - 1], manaRegenAdd: [0.5, 1, 1.5, 2.5, 4][l - 1] }) },
];
export const ITEMS: ItemDef[] = FAMILIES.flatMap(f => [1, 2, 3, 4, 5].map(l => ({
  id: `item.${f.family}.${l}`, name: `${f.name} ${'I II III IV V'.split(' ')[l - 1]}`, icon: f.icon, family: f.family,
  level: l as ItemDef['level'], mods: f.per(l), combinesInto: l < 5 ? `item.${f.family}.${l + 1}` : undefined,
})));
export const ITEM_FAMILIES = FAMILIES.map(f => f.family);

export const GAME_MODES: Record<string, GameModeDef> = {
  standard: { id: 'standard', name: 'Standard', startGold: 250, incomeInterval: 10, baseIncome: 20, bountyMul: 1, waveInterval: 25, firstWave: 6,
    researchSpeed: 1, middleRadius: 1300, middleBonus: 12, artifactBaseChance: 0.03, devAllowed: true },
  doubleGold: { id: 'doubleGold', name: '2x Gold', startGold: 500, incomeInterval: 10, baseIncome: 40, bountyMul: 2, waveInterval: 25, firstWave: 6,
    researchSpeed: 1, middleRadius: 1300, middleBonus: 24, artifactBaseChance: 0.03, devAllowed: true },
  fast: { id: 'fast', name: 'Fast (2x research)', startGold: 400, incomeInterval: 8, baseIncome: 25, bountyMul: 1.25, waveInterval: 20, firstWave: 5,
    researchSpeed: 2, middleRadius: 1300, middleBonus: 15, artifactBaseChance: 0.04, devAllowed: true },
};

/** Fortress level scaling (level 1 = base). */
export const FORTRESS_LEVEL = { hpPerLevel: 3000, damageMulPerLevel: 0.5, names: ['Fortress', 'Stronghold', 'Citadel'] };
export const TOWER_LEVEL = { damageMul: 0.25, hpMul: 0.15 };
/** Hero XP needed to reach level n+1 (index n-1). WC3 table. */
export const HERO_XP = [200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400];
export const HERO_MAX_LEVEL = 10;
export const RESEARCH_QUEUE_MAX = 5;
export const INVENTORY_SLOTS = 6;
