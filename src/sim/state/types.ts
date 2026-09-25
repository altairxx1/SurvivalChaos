import type { ArmorType, AttackType, LaneDir, ProjectileSpec, Slot, UnitClass } from '../defs/types';

export const enum Anim { Idle = 0, Walk = 1, Attack = 2, Cast = 3, Death = 4, Stand = 5 }

export interface Stats {
  maxHp: number; maxMana: number; hpRegen: number; manaRegen: number;   // regen per second
  armor: number; armorType: ArmorType;
  attackType: AttackType; dmgBase: number; dice: number; sides: number; dmgMul: number; dmgAdd: number;
  cooldown: number;           // ticks between attacks
  damagePoint: number;        // ticks
  range: number; acquire: number;
  speed: number;              // world units per tick
  evasion: number; critChance: number; critMul: number; lifesteal: number;
  bashChance: number; bashDuration: number;
  damageTakenMul: number; pierceTakenMul: number; thorns: number;
  projectile?: ProjectileSpec; splash?: { radius: number; factor: number }; bounce?: { count: number; falloff: number; range: number };
  canHitAir: boolean; hasWeapon: boolean;
}

export interface BuffInst { id: string; until: number; source: number; stacks: number }

export interface ResearchJob { upgrade: string; level: number; remaining: number; total: number; cost: number }

export interface BuildingState {
  kind: import('../defs/types').BuildingKind;
  lane?: LaneDir;
  levels: Record<string, number>;       // building-scoped upgrade levels (tier, towerLevel)
  queue: ResearchJob[];
}

export interface HeroState { level: number; xp: number; items: (string | null)[]; abilityLevels: number[] }

export interface ProjectileState {
  source: number; target: number; tx: number; ty: number; speed: number; fx: string; arc: number;
  sx: number; sy: number;                // start position (for arc rendering)
  dmg: number; attackType: AttackType; splash?: { radius: number; factor: number };
  bounce?: { count: number; falloff: number; range: number; hit: number[] };
  owner: number; isAttack: boolean;
}

export interface Entity {
  id: number; kind: 'unit' | 'building' | 'projectile';
  owner: number; def: string; cls: UnitClass | 'building' | 'projectile';
  x: number; y: number; facing: number; radius: number; flying: boolean;
  hp: number; mana: number;
  alive: boolean; diedAt: number; removeAt: number;
  lane: number; wp: number;                 // lane path index and next waypoint
  target: number; retarget: number;
  attackCd: number; swing: number; swingTarget: number;
  castCd: Record<string, number>;
  abilities: string[];                      // effective ability list (innate + granted)
  buffs: BuffInst[];
  stun: number;
  expireAt: number;                         // summons
  anim: Anim; animT: number;
  stats: Stats; dirty: boolean;
  lastHitBy: number; kills: number;
  hero?: HeroState; bld?: BuildingState; proj?: ProjectileState;
}

export interface PlayerState {
  id: number; slot: Slot; name: string; raceId: string; color: string;
  controller: 'human' | 'bot' | 'none';
  alive: boolean; eliminatedAt: number;
  gold: number; totalGold: number; income: number;
  kills: number; lost: number;
  upgrades: Record<string, number>;         // player-scoped upgrade levels
  heroCd: Record<string, number>;           // tick when purchasable again
  specialCd: Record<string, number>;
  fortressLevel: number;
  god: boolean;
}

export type SimEvent =
  | { t: 'spawn'; id: number }
  | { t: 'attack'; id: number; target: number }
  | { t: 'hit'; id: number; source: number; amount: number; crit: boolean; x: number; y: number; attackType: AttackType }
  | { t: 'miss'; id: number; x: number; y: number }
  | { t: 'death'; id: number; killer: number; x: number; y: number; bounty: number; killerOwner: number }
  | { t: 'cast'; id: number; ability: string; fx: string; x: number; y: number; tx: number; ty: number; target: number; aoe: number }
  | { t: 'chain'; fx: string; points: { x: number; y: number }[] }
  | { t: 'heal'; id: number; amount: number }
  | { t: 'research'; player: number; upgrade: string; level: number; building: number }
  | { t: 'queued'; player: number; upgrade: string; building: number }
  | { t: 'wave'; player: number }
  | { t: 'heroBought'; player: number; id: number; hero: string }
  | { t: 'special'; player: number; unit: string }
  | { t: 'levelUp'; id: number; level: number }
  | { t: 'item'; id: number; item: string; combined: boolean }
  | { t: 'eliminated'; player: number; by: number }
  | { t: 'victory'; winner: number }
  | { t: 'income'; player: number; amount: number; middle: boolean }
  | { t: 'reject'; player: number; reason: string }
  | { t: 'dev'; text: string };

export interface GameFlags { freeBuild: boolean; instantResearch: boolean; reveal: boolean; noSpawn: boolean; botsFrozen: boolean }
