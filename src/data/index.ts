import type { DataBundle } from '../sim/defs/Registry';
import { BUILDINGS, GAME_MODES, ITEMS, SHARED_UPGRADES } from './shared';
import { RACES as BASE_RACES } from './races';
import { applyOverrides, type Overrides } from './overrides/apply';
import extracted from './overrides/extracted.json';

const OV = extracted as Overrides;
/** Race packs with values extracted from the original map applied on top (see tools/extract/build-packs.ts). */
export const RACES = applyOverrides(BASE_RACES, OV);
const upgrades = SHARED_UPGRADES.map(u => ({ ...u, ...(OV.upgrades?.[u.id] ?? {}) }));

export const DEFAULT_DATA: DataBundle = { races: RACES, buildings: BUILDINGS, sharedUpgrades: upgrades, items: ITEMS, modes: GAME_MODES };
export { MAP_LAYOUT } from './maps/survivalChaos';
export { ROSTER } from './races';
