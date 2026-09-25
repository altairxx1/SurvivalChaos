/**
 * Headless bot-vs-bot games. Usage: npm run sim:headless -- [games=1] [seed=1] [maxMinutes=60] [races=random,random,random,random] [difficulty=normal]
 */
import { createBots, createSimulation, stepWithBots } from '../../src/app/createGame';
import type { Difficulty } from '../../src/ai/Bot';

const [games = '1', seed0 = '1', maxMin = '60', races = 'random,random,random,random', diff = 'normal'] = process.argv.slice(2);
const results: { seed: number; winner: string; minutes: number; races: string[] }[] = [];
for (let g = 0; g < Number(games); g++) {
  const seed = Number(seed0) + g;
  const sim = createSimulation({ seed, mode: 'standard', players: races.split(',').map((r, i) => ({ name: `Bot ${i + 1}`, raceId: r, controller: 'bot', color: '' })) });
  const bots = createBots(sim, diff.split(',') as Difficulty[]);
  const t0 = performance.now(); let maxEnt = 0;
  const limit = Number(maxMin) * 60 * 20;
  while (sim.phase === 'playing' && sim.tick < limit) {
    stepWithBots(sim, bots);
    for (const ev of sim.events) {
      if (ev.t === 'eliminated') console.log(`  ${(sim.tick / 1200).toFixed(1)}min: P${ev.player + 1} ${sim.players[ev.player]!.raceId} eliminated by ${ev.by >= 0 ? sim.players[ev.by]!.raceId : '-'}`);
      if (ev.t === 'death' && process.env.VERBOSE) { const e = sim.get(ev.id); if (e?.kind === 'building') console.log(`  ${(sim.tick / 1200).toFixed(1)}min: ${e.def} of P${e.owner + 1} destroyed`); }
    }
    sim.events.length = 0;
    maxEnt = Math.max(maxEnt, sim.entities.length);
    if (sim.tick % (20 * 60 * 5) === 0) {
      const line = sim.players.map(p => `${p.raceId.padEnd(9)} ${p.alive ? 'ALIVE' : 'dead '} g=${String(Math.round(p.gold)).padStart(5)} k=${String(p.kills).padStart(4)} fort=${p.fortressLevel} ups=${Object.values(p.upgrades).reduce((a, b) => a + b, 0)}`).join(' | ');
      console.log(`[seed ${seed}] ${String(sim.tick / 1200).padStart(3)}min ents=${sim.entities.length} ${line}`);
    }
  }
  const ms = performance.now() - t0;
  const winner = sim.winner >= 0 ? `${sim.players[sim.winner]!.raceId} (P${sim.winner + 1})` : 'none';
  console.log(`seed ${seed}: winner=${winner} after ${(sim.tick / 1200).toFixed(1)} min, sim ${(ms / 1000).toFixed(1)}s (${(ms / sim.tick).toFixed(3)} ms/tick, max entities ${maxEnt}), hash=${sim.hash()}`);
  results.push({ seed, winner, minutes: sim.tick / 1200, races: sim.players.map(p => p.raceId) });
}
if (results.length > 1) {
  const wins: Record<string, number> = {};
  for (const r of results) wins[r.winner.split(' ')[0]!] = (wins[r.winner.split(' ')[0]!] ?? 0) + 1;
  console.log('wins by race:', wins, 'avg minutes:', (results.reduce((a, r) => a + r.minutes, 0) / results.length).toFixed(1));
}
