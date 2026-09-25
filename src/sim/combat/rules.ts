import { FORTRESS_LEVEL, TOWER_LEVEL } from '../../data/shared';
import type { ArmorType, AttackType } from '../defs/types';
import { DAMAGE_TABLE } from '../../data/shared';
import { powInt } from '../core/DMath';

export const BUILDINGS_RULES = {
  fortressHpPerLevel: FORTRESS_LEVEL.hpPerLevel, fortressDamagePerLevel: FORTRESS_LEVEL.damageMulPerLevel,
  towerDamagePerLevel: TOWER_LEVEL.damageMul, towerHpPerLevel: TOWER_LEVEL.hpMul,
};

/** WC3 armor: positive armor reduces damage by 0.06a/(1+0.06a); negative armor increases it by 2 - 0.94^(-a). */
export function armorMultiplier(armor: number): number {
  if (armor >= 0) return 1 - (0.06 * armor) / (1 + 0.06 * armor);
  return 2 - powInt(0.94, -Math.round(armor));
}
export function typeMultiplier(a: AttackType, t: ArmorType): number { return DAMAGE_TABLE[a][t]; }
