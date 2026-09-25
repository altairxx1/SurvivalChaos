import type { DataBundle } from '../sim/defs/Registry';
import { BUILDINGS, GAME_MODES, ITEMS, SHARED_UPGRADES } from './shared';
import { RACES } from './races';

export const DEFAULT_DATA: DataBundle = { races: RACES, buildings: BUILDINGS, sharedUpgrades: SHARED_UPGRADES, items: ITEMS, modes: GAME_MODES };
export { MAP_LAYOUT } from './maps/survivalChaos';
export { ROSTER, RACES } from './races';
