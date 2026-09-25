import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/sim/core/Rng';
import * as DM from '../../src/sim/core/DMath';
import { armorMultiplier, typeMultiplier } from '../../src/sim/combat/rules';
import { getRegistry, createSimulation, createBots, stepWithBots } from '../../src/app/createGame';
import { Simulation } from '../../src/sim/Simulation';
import { MAP_LAYOUT } from '../../src/data';

const init = (seed: number) => ({ seed, mode: 'standard', players: ['lordaeron', 'orc', 'undead', 'nightelf'].map((r, i) => ({ name: `P${i}`, raceId: r, controller: 'bot' as const, color: '' })) });

describe('deterministic primitives', () => {
  it('rng is reproducible and uniform-ish', () => {
    const a = new Rng(42), b = new Rng(42);
    const xs = Array.from({ length: 1000 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b.next()));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45); expect(mean).toBeLessThan(0.55);
    const d = new Rng(7); const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[d.int(1, 6) - 1]++;
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });
  it('table trig is accurate', () => {
    for (let a = -7; a < 7; a += 0.37) { expect(Math.abs(DM.sin(a) - Math.sin(a))).toBeLessThan(1e-5); expect(Math.abs(DM.cos(a) - Math.cos(a))).toBeLessThan(1e-5); }
    for (const [y, x] of [[1, 1], [-1, 2], [3, -4], [-2, -2], [0, 1], [1, 0]]) expect(Math.abs(DM.atan2(y!, x!) - Math.atan2(y!, x!))).toBeLessThan(2e-5);
    expect(DM.powInt(0.94, 3)).toBeCloseTo(0.830584, 6);
  });
});

describe('combat formulas (WC3)', () => {
  it('armor reduction', () => {
    expect(armorMultiplier(0)).toBe(1);
    expect(armorMultiplier(10)).toBeCloseTo(1 - 0.6 / 1.6, 10);
    expect(armorMultiplier(-5)).toBeCloseTo(2 - Math.pow(0.94, 5), 10);
  });
  it('damage table', () => {
    expect(typeMultiplier('pierce', 'light')).toBe(2);
    expect(typeMultiplier('siege', 'fortified')).toBe(1.5);
    expect(typeMultiplier('magic', 'heavy')).toBe(2);
    expect(typeMultiplier('chaos', 'fortified')).toBe(1);
  });
});

describe('data', () => {
  it('registry cross references resolve', () => { expect(getRegistry().validate()).toEqual([]); });
});

describe('simulation', () => {
  it('builds 4 bases with fortress, 3 barracks, 4 towers and 12 lanes', () => {
    const sim = createSimulation(init(1));
    expect(sim.map.lanes.length).toBe(12);
    for (const p of sim.players) {
      const b = sim.entities.filter(e => e.owner === p.id && e.kind === 'building');
      expect(b.filter(e => e.bld!.kind === 'fortress').length).toBe(1);
      expect(b.filter(e => e.bld!.kind === 'barracks').length).toBe(3);
      expect(b.filter(e => e.bld!.kind === 'tower').length).toBe(4);
    }
  });

  it('lanes connect each barracks to the target fortress', () => {
    const sim = createSimulation(init(1));
    for (const l of sim.map.lanes) {
      const end = l.points[l.points.length - 1]!; const f = sim.map.fortressPos(sim.players[l.target]!.slot);
      expect(end).toEqual(f);
      expect(l.target).not.toBe(l.owner);
    }
  });

  it('is deterministic: same seed and commands give identical hashes every tick', () => {
    const a = createSimulation(init(99)), b = createSimulation(init(99));
    const ba = createBots(a, 'hard'), bb = createBots(b, 'hard');
    for (let t = 0; t < 20 * 60 * 4; t++) {
      stepWithBots(a, ba); stepWithBots(b, bb); a.events.length = 0; b.events.length = 0;
      if (t % 100 === 0) expect(a.hash()).toBe(b.hash());
    }
    expect(a.hash()).toBe(b.hash());
    expect(a.entities.length).toBeGreaterThan(40);
  });

  it('snapshot / restore continues identically', () => {
    const a = createSimulation(init(5)); const bots = createBots(a, 'normal');
    for (let t = 0; t < 2400; t++) { stepWithBots(a, bots); a.events.length = 0; }
    const b = Simulation.restore(a.snapshot(), getRegistry(), MAP_LAYOUT); const bots2 = createBots(b, 'normal');
    for (let t = 0; t < 1200; t++) { stepWithBots(a, bots); stepWithBots(b, bots2); a.events.length = 0; b.events.length = 0; }
    expect(b.hash()).toBe(a.hash());
  });

  it('research costs gold and completes', () => {
    const sim = createSimulation(init(3));
    const forge = sim.findBuilding(0, 'forge')!; const gold = sim.players[0]!.gold;
    sim.enqueue({ t: 'research', player: 0, building: forge.id, upgrade: 'up.meleeWeapons' });
    sim.step();
    expect(sim.players[0]!.gold).toBe(gold - 60);
    for (let i = 0; i < 20 * 16; i++) sim.step();
    expect(sim.players[0]!.upgrades['up.meleeWeapons']).toBe(1);
  });

  it('tier 3 barracks requires fortress level 2', () => {
    const sim = createSimulation(init(3)); const p = sim.players[0]!;
    sim.flags.freeBuild = true; sim.flags.instantResearch = true;
    const bar = sim.findBuilding(0, 'barracks', 'cross')!;
    sim.enqueue({ t: 'research', player: 0, building: bar.id, upgrade: 'up.tier' }); sim.step(); sim.step();
    expect(bar.bld!.levels['up.tier']).toBe(1);
    expect(sim.researchBlocker(p, bar, 'up.tier')).toMatch(/Fortress level 2/);
  });

  it('heroes level up and artifacts combine up to level 5', () => {
    const sim = createSimulation(init(8)); sim.flags.freeBuild = true;
    sim.enqueue({ t: 'buyHero', player: 0, hero: 'lordaeron.paladin', lane: 'cross' }); sim.step();
    const h = sim.entities.find(e => e.def === 'lordaeron.paladin')!;
    expect(h.hero!.level).toBe(1);
    sim.addXp(h, 1000);
    expect(h.hero!.level).toBe(4);
    for (let i = 0; i < 16; i++) sim.giveItem(h, 'item.claws.1');
    expect(h.hero!.items).toContain('item.claws.5');
    sim.refreshStats(h);
    expect(h.stats.dmgAdd).toBeGreaterThan(30);
  });

  it('a full bot game ends with a single winner', () => {
    const sim = createSimulation(init(12)); const bots = createBots(sim, 'normal');
    while (sim.phase === 'playing' && sim.tick < 20 * 60 * 60) { stepWithBots(sim, bots); sim.events.length = 0; }
    expect(sim.phase).toBe('ended');
    expect(sim.players.filter(p => p.alive).length).toBe(1);
  });
});
