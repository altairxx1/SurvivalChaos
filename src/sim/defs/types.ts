/**
 * The data contract. Everything here is plain JSON-serialisable so that race packs can be
 * produced by the extraction pipeline (tools/extract) and dropped into src/data without code changes.
 */
export type AttackType = 'normal' | 'pierce' | 'siege' | 'magic' | 'chaos' | 'spells' | 'hero';
export type ArmorType = 'light' | 'medium' | 'heavy' | 'fortified' | 'hero' | 'unarmored' | 'divine';
export type UnitClass = 'melee' | 'ranged' | 'caster' | 'mounted' | 'heavy' | 'siege' | 'special' | 'hero' | 'summon';
export type Faction = 'alliance' | 'horde' | 'chaos' | 'independent';
export type Slot = 'left' | 'top' | 'right' | 'bottom';
/** Lane relative to its owner: 'cw' = toward the clockwise neighbour, 'ccw' = counter-clockwise neighbour, 'cross' = opposite player. */
export type LaneDir = 'ccw' | 'cross' | 'cw';
export type BuildingKind = 'fortress' | 'barracks' | 'tower' | 'altar' | 'forge' | 'sanctum' | 'goldAltar' | 'mercCamp';
/** Scalar or per-level array (heroes / multi-level research). */
export type Lv = number | number[];

export interface ProjectileSpec { speed: number; fx: string; arc?: number }
export interface Weapon {
  attackType: AttackType;
  base: number; dice: number; sides: number;   // damage = base + dice x d(sides)
  cooldown: number;                             // seconds
  range: number;
  damagePoint?: number;                         // seconds between swing start and hit
  projectile?: ProjectileSpec;
  splash?: { radius: number; factor: number };
  bounce?: { count: number; falloff: number; range: number };
  air?: boolean;                                // can hit flyers
}

export type ModelArchetype = 'infantry' | 'spearman' | 'archer' | 'caster' | 'cavalry' | 'wolfrider' | 'brute' | 'beast'
  | 'ghoul' | 'skeleton' | 'fiend' | 'giant' | 'siege' | 'flyer' | 'dragon' | 'treant' | 'hero';
export interface ModelSpec {
  arch: ModelArchetype; scale: number;
  body: string; accent: string; skin?: string;
  weapon?: 'sword' | 'axe' | 'spear' | 'bow' | 'staff' | 'hammer' | 'glaive' | 'claws' | 'scythe' | 'none';
  shield?: boolean; horns?: boolean; glow?: string;
}

export interface UnitDef {
  id: string; name: string; race: string; cls: UnitClass;
  hp: number; mana: number; hpRegen: number; manaRegen: number;
  armor: number; armorType: ArmorType;
  speed: number;              // world units per second
  radius: number;             // collision radius
  acquire: number;            // acquisition range
  weapon?: Weapon;
  abilities: string[];        // innate abilities
  bounty: number; xp: number; level: number;
  flying?: boolean;
  model: ModelSpec;
  description: string;
}

export interface HeroDef extends UnitDef {
  cost: number; cooldown: number;           // seconds between purchases
  perLevel: { hp: number; damage: number; armor: number; mana: number };
  heroAbilities: string[];                  // 3 normal + 1 ultimate (last), auto-learned
}

export interface SpecialDef { unit: string; cost: number; cooldown: number; count: number }

export interface WaveEntry { unit: string; count: number }

export interface UnitFilter { cls?: UnitClass[]; units?: string[]; buildings?: BuildingKind[]; heroes?: boolean }
export type StatKey = 'damage' | 'armor' | 'hp' | 'mana' | 'attackSpeed' | 'speed' | 'hpRegen' | 'manaRegen' | 'range' | 'evasion' | 'critChance' | 'lifesteal';
export type UpgradeEffect =
  | { t: 'stat'; filter: UnitFilter; stat: StatKey; add?: number; mul?: number }   // per level
  | { t: 'ability'; filter: UnitFilter; ability: string }                           // granted at level >= 1
  | { t: 'income'; add: number }                                                    // per level
  | { t: 'bounty'; mul: number }                                                    // per level, additive %
  | { t: 'artifactChance'; add: number }                                            // per level
  | { t: 'tier' }                                                                   // barracks tier +1 (building scope)
  | { t: 'fortress' }                                                               // fortress level +1
  | { t: 'towerLevel' };                                                            // tower level +1 (building scope)

export interface UpgradeDef {
  id: string; name: string; icon: string; hotkey: string;
  scope: 'player' | 'building';
  maxLevel: number;
  cost: [number, number];      // base, +per level
  time: [number, number];      // seconds: base, +per level
  requires?: { fortress?: number; upgrade?: [string, number] };
  effects: UpgradeEffect[];
  description: string;
}

export interface StatMods {
  damageMul?: number; armorAdd?: number; attackSpeedMul?: number; speedMul?: number;
  hpRegenAdd?: number; manaRegenAdd?: number; evasionAdd?: number; lifesteal?: number;
  critChance?: number; critMul?: number; bashChance?: number; bashDuration?: number;
  damageTakenMul?: number; pierceTakenMul?: number; thorns?: number; rangeAdd?: number; damageAdd?: number;
}

export interface BuffDef {
  id: string; name: string; mods: StatMods;
  stun?: boolean; dot?: number;             // damage per second
  hot?: number;                             // heal per second
  debuff?: boolean; fx?: string;
}

export type AbilityEffect =
  | { t: 'damage'; amount: Lv; aoe?: Lv; attackType?: AttackType }
  | { t: 'heal'; amount: Lv; aoe?: Lv }
  | { t: 'buff'; buff: string; duration: Lv; aoe?: Lv }
  | { t: 'stun'; duration: Lv; aoe?: Lv }
  | { t: 'chain'; amount: Lv; bounces: Lv; falloff: number; range: number }
  | { t: 'summon'; unit: string; count: Lv; duration: number }
  | { t: 'manaBurn'; amount: Lv }
  | { t: 'passive'; mods: StatMods; perLevel?: StatMods }
  | { t: 'aura'; buff: string; radius: number; allies: boolean };

export interface AbilityDef {
  id: string; name: string; icon: string;
  kind: 'active' | 'passive' | 'aura';
  target: 'enemy' | 'ally' | 'self' | 'enemyArea' | 'allyArea';
  mana: Lv; cooldown: Lv; range: number; castPoint?: number;
  effects: AbilityEffect[];
  ai?: { minEnemies?: number; allyHpBelow?: number; selfHpBelow?: number; onlyHeroes?: boolean };
  fx: string;
  description: string;
}

export interface ItemDef {
  id: string; name: string; icon: string; family: string; level: 1 | 2 | 3 | 4 | 5;
  mods: StatMods & { hpAdd?: number; manaAdd?: number };
  combinesInto?: string;
}

export interface RaceModifiers {
  goldBounty: number; buyCooldown: number; attackRate: number; researchSpeed: number;
  buildingHpRegen: number; buildingDamage: number; mana: number; evasion: number;
  income: number; unitHp: number; unitDamage: number; moveSpeed: number; upgradeCost: number;
}

export interface RaceDef {
  id: string; name: string; faction: Faction; color: string;
  description: string; bonuses: string[];
  modifiers: Partial<RaceModifiers>;
  units: UnitDef[];
  heroes: HeroDef[];
  specials: SpecialDef[];
  waves: WaveEntry[][];                     // index = barracks tier - 1
  melee: string; ranged: string; caster: string; mounted: string; heavy: string;
  forgeUpgrades: string[];                   // ids of upgrades available at the Forge
  sanctumUpgrades: string[];                 // race ability research
  upgrades: UpgradeDef[];                    // race-specific upgrade defs
  abilities: AbilityDef[];
  buffs: BuffDef[];
  buildingStyle: { roof: string; wall: string; trim: string; shape: 'stone' | 'hut' | 'crypt' | 'tree' };
}

export interface BuildingDef {
  id: string; name: string; kind: BuildingKind;
  hp: number; armor: number; armorType: ArmorType; hpRegen: number; radius: number;
  weapon?: Weapon; bounty: number; xp: number;
}

export interface GameModeDef {
  id: string; name: string;
  startGold: number; incomeInterval: number; baseIncome: number; bountyMul: number;
  waveInterval: number; firstWave: number; researchSpeed: number;
  middleRadius: number; middleBonus: number;
  artifactBaseChance: number;
  devAllowed: boolean;
}
