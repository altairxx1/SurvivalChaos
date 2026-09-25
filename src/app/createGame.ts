import { Registry } from '../sim/defs/Registry';
import { Simulation, type GameInit } from '../sim/Simulation';
import { DEFAULT_DATA, MAP_LAYOUT } from '../data';
import { Bot, PROFILES, type Difficulty } from '../ai/Bot';

let registry: Registry | null = null;
export function getRegistry(): Registry { return registry ??= new Registry(DEFAULT_DATA); }

export function createSimulation(init: GameInit): Simulation { return new Simulation(init, getRegistry(), MAP_LAYOUT); }

export function createBots(sim: Simulation, difficulty: Difficulty | Difficulty[]): Bot[] {
  return sim.players.filter(p => p.controller === 'bot').map(p => new Bot(p.id, PROFILES[Array.isArray(difficulty) ? difficulty[p.id] ?? 'normal' : difficulty]));
}

/** Advances the simulation one tick, feeding bot commands first. */
export function stepWithBots(sim: Simulation, bots: Bot[]): void {
  for (const b of bots) for (const c of b.think(sim)) sim.enqueue(c);
  sim.step();
}
