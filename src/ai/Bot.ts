import type { Simulation } from '../sim/Simulation';
import type { Command } from '../sim/core/Commands';
import type { Entity } from '../sim/state/types';
import type { LaneDir } from '../sim/defs/types';
import { dist2 } from '../sim/core/DMath';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';
export interface BotProfile { difficulty: Difficulty; thinkEvery: number; mistakes: number; reserve: number; heroBias: number }

export const PROFILES: Record<Difficulty, BotProfile> = {
  easy: { difficulty: 'easy', thinkEvery: 80, mistakes: 0.35, reserve: 60, heroBias: 0.6 },
  normal: { difficulty: 'normal', thinkEvery: 40, mistakes: 0.15, reserve: 20, heroBias: 1 },
  hard: { difficulty: 'hard', thinkEvery: 20, mistakes: 0.05, reserve: 0, heroBias: 1.2 },
  insane: { difficulty: 'insane', thinkEvery: 10, mistakes: 0, reserve: 0, heroBias: 1.3 },
};

const LANES: LaneDir[] = ['ccw', 'cross', 'cw'];

interface Candidate { score: number; cmd: Command; label: string }

/**
 * Utility-based bot. Reads the simulation, scores the actions a player could take and issues
 * Commands through the same path a human uses. Deterministic: uses only sim.rng.bots.
 */
export class Bot {
  lastDecision = '';
  constructor(readonly player: number, public profile: BotProfile) {}

  think(sim: Simulation): Command[] {
    const p = sim.players[this.player]!;
    if (!p.alive || sim.flags.botsFrozen || sim.phase !== 'playing') return [];
    if ((sim.tick + this.player * 7) % this.profile.thinkEvery !== 0) return [];
    const rng = sim.rng.bots;
    const out: Command[] = [];
    const pressure = this.lanePressure(sim);
    let budget = p.gold - this.profile.reserve;
    const race = sim.race(this.player);
    const minutes = sim.tick / 1200;
    const blds = sim.entities.filter(e => e.alive && e.kind === 'building' && e.owner === this.player);
    const byKind = (k: string) => blds.filter(b => b.bld!.kind === k);

    for (let iter = 0; iter < 3 && budget > 0; iter++) {
      const cands: Candidate[] = [];
      const research = (b: Entity | undefined, up: string, score: number, label: string) => {
        if (!b) return;
        if (sim.researchBlocker(p, b, up)) return;
        const def = sim.reg.upgrade(up);
        const lvl = sim.currentLevel(p, b, def) + sim.pendingLevels(p, b, def) + 1;
        if (sim.upgradeCost(p, def, lvl) > budget) return;
        cands.push({ score, cmd: { t: 'research', player: this.player, building: b.id, upgrade: up }, label });
      };
      const lvl = (up: string) => p.upgrades[up] ?? 0;

      // economy early
      research(byKind('goldAltar')[0], 'up.goldMining', 72 - lvl('up.goldMining') * 7 - minutes * 1.5, 'gold');
      research(byKind('goldAltar')[0], 'up.bountyHunter', 40 - lvl('up.bountyHunter') * 5, 'bounty');
      research(byKind('goldAltar')[0], 'up.artifacts', 25 + (sim.entities.some(e => e.alive && e.hero && e.owner === this.player) ? 12 : 0) - lvl('up.artifacts') * 5, 'artifacts');
      // barracks tiers: most pressured lane first
      for (const b of byKind('barracks')) {
        const pr = pressure[LANES.indexOf(b.bld!.lane!)]!;
        research(b, 'up.tier', 62 + pr * 25 + minutes * 0.8, `tier ${b.bld!.lane}`);
      }
      // fortress
      research(byKind('fortress')[0], 'up.fortress', 35 + minutes * 2.2, 'fortress');
      // forge
      const forge = byKind('forge')[0];
      for (const up of race.forgeUpgrades) {
        const base = up === 'up.masonry' ? 20 + Math.max(...pressure) * 20 : up === 'up.mountedTraining' ? 38 : 52;
        research(forge, up, base - lvl(up) * 3.2 + rng.next() * 6, up);
      }
      const sanctum = byKind('sanctum')[0];
      for (const up of race.sanctumUpgrades) research(sanctum, up, 48 + rng.next() * 8, up);
      // towers under pressure
      for (const tw of byKind('tower')) {
        const near = this.threatNear(sim, tw, 1400);
        research(tw, 'up.towerLevel', 20 + near * 35 - (tw.bld!.levels['up.towerLevel'] ?? 0) * 4, 'tower');
      }
      // heroes
      const worst = pressure.indexOf(Math.max(...pressure));
      const laneForSend = pressure[worst]! > 0.25 ? LANES[worst]! : LANES[rng.int(0, 2)]!;
      for (const h of race.heroes) {
        if (sim.heroBlocker(p, h.id)) continue;
        if (h.cost > budget) continue;
        cands.push({ score: (58 + minutes * 1.5 + pressure[worst]! * 20) * this.profile.heroBias + rng.next() * 5, cmd: { t: 'buyHero', player: this.player, hero: h.id, lane: laneForSend }, label: `hero ${h.name}` });
      }
      for (const s of race.specials) {
        if (sim.specialBlocker(p, s.unit)) continue;
        if (s.cost > budget) continue;
        cands.push({ score: 30 + pressure[worst]! * 45 + minutes, cmd: { t: 'buySpecial', player: this.player, unit: s.unit, lane: laneForSend }, label: 'special' });
      }
      if (!cands.length) break;
      cands.sort((a, b) => b.score - a.score);
      let pick = cands[0]!;
      if (rng.chance(this.profile.mistakes) && cands.length > 1) pick = cands[rng.int(1, cands.length - 1)]!;
      if (rng.chance(this.profile.mistakes * 0.5)) break;      // hesitation
      out.push(pick.cmd);
      this.lastDecision = pick.label;
      budget -= this.costOf(sim, pick.cmd);
      if (pick.cmd.t !== 'research') break;
    }
    return out;
  }

  private costOf(sim: Simulation, c: Command): number {
    const p = sim.players[this.player]!;
    if (c.t === 'buyHero') return sim.reg.heroes.get(c.hero)!.cost;
    if (c.t === 'buySpecial') return sim.race(this.player).specials.find(s => s.unit === c.unit)!.cost;
    if (c.t === 'research') { const b = sim.get(c.building)!; const up = sim.reg.upgrade(c.upgrade); return sim.upgradeCost(p, up, sim.currentLevel(p, b, up) + sim.pendingLevels(p, b, up) + 1); }
    return 0;
  }

  /** 0..1 enemy pressure per lane (enemy unit hit points near that lane's barracks, relative to own). */
  lanePressure(sim: Simulation): number[] {
    return LANES.map(dir => {
      const b = sim.findBuilding(this.player, 'barracks', dir);
      const at = b ?? sim.findBuilding(this.player, 'fortress');
      if (!at) return 1;
      const t = this.threatNear(sim, at, 1600);
      const damage = b ? 1 - b.hp / b.stats.maxHp : 1;
      return Math.min(1, t * 0.7 + damage * 0.6);
    });
  }

  private threatNear(sim: Simulation, at: Entity, r: number): number {
    let enemy = 0, own = 0;
    sim.grid.query(at.x, at.y, r, id => {
      const o = sim.byId.get(id)!;
      if (!o.alive || o.kind !== 'unit' || dist2(at.x, at.y, o.x, o.y) > r * r) return;
      if (o.owner === this.player) own += o.hp; else enemy += o.hp;
    });
    return enemy <= 0 ? 0 : Math.min(1, enemy / (enemy + own + 1500));
  }
}
