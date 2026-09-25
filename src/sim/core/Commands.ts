import type { LaneDir } from '../defs/types';
import type { GameFlags } from '../state/types';

/** Every change to the game goes through a Command, whether it comes from the local player, a bot, a replay or the network. */
export type Command =
  | { t: 'research'; player: number; building: number; upgrade: string }
  | { t: 'cancel'; player: number; building: number; index: number }
  | { t: 'buyHero'; player: number; hero: string; lane: LaneDir }
  | { t: 'buySpecial'; player: number; unit: string; lane: LaneDir }
  | { t: 'surrender'; player: number }
  | { t: 'chat'; player: number; text: string }
  | { t: 'dev'; player: number; op: DevOp };

export type DevOp =
  | { k: 'gold'; target: number; amount: number; set?: boolean }
  | { k: 'income'; target: number; amount: number }
  | { k: 'spawn'; target: number; unit: string; lane: LaneDir; count: number; x?: number; y?: number }
  | { k: 'kill'; ids: number[] }
  | { k: 'killUnits'; target: number }
  | { k: 'heal'; ids: number[] }
  | { k: 'god'; target: number; on: boolean }
  | { k: 'flag'; flag: keyof GameFlags; on: boolean }
  | { k: 'eliminate'; target: number }
  | { k: 'setUpgrade'; target: number; upgrade: string; level: number }
  | { k: 'wave'; target: number }
  | { k: 'heroLevel'; id: number; levels: number }
  | { k: 'giveItem'; id: number; item: string }
  | { k: 'resetCooldowns'; target: number };

export interface StampedCommand { tick: number; seq: number; cmd: Command }
