import type { RaceDef } from '../../sim/defs/types';
import { lordaeron } from './lordaeron';
import { orc } from './orc';
import { undead } from './undead';
import { nightelf } from './nightelf';

/** Races implemented in milestone 1 (the 4-race vertical slice). */
export const RACES: RaceDef[] = [lordaeron, orc, undead, nightelf];

/** The full v4.30/4.31 roster. Races without a pack are shown as "coming soon" in race selection. */
export const ROSTER: { id: string; name: string; faction: RaceDef['faction'] }[] = [
  ...['Lordaeron', 'Dwarf', 'Rogue', 'Gnome', 'Worgen', 'Scarlet', 'Wildhammer'].map(n => ({ n, f: 'alliance' as const })),
  ...['Orc', 'Troll', 'Tauren', 'Goblin', 'Pandaren', 'Saurok'].map(n => ({ n, f: 'horde' as const })),
  ...['Demon', 'Undead', 'Fel Orc', 'Dark Horde', 'Dark Iron', 'Silithid', 'Ancients'].map(n => ({ n, f: 'chaos' as const })),
  ...['Night Elf', 'Naga', 'Blood Elf', 'Draenei', 'Void Elf', 'Nightborne'].map(n => ({ n, f: 'independent' as const })),
].map(({ n, f }) => ({ id: n.toLowerCase().replace(/[^a-z]/g, ''), name: n, faction: f }));
