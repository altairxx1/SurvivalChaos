import { Registry } from './defs/Registry';
import type { BuildingKind, GameModeDef, HeroDef, LaneDir, RaceDef, Slot, UpgradeDef } from './defs/types';
import { RngStreams } from './core/Rng';
import { atan2, dist2 } from './core/DMath';
import type { Command, DevOp, StampedCommand } from './core/Commands';
import { MapRuntime, type MapLayoutData, type Vec2 } from './map/MapRuntime';
import { SpatialHash } from './map/SpatialHash';
import { Anim, type Entity, type GameFlags, type PlayerState, type SimEvent, type Stats } from './state/types';
import { computeStats, heroAbilityLevels, raceMods, TICK_RATE } from './combat/stats';
import { HERO_MAX_LEVEL, HERO_XP, INVENTORY_SLOTS, ITEM_FAMILIES, RESEARCH_QUEUE_MAX } from '../data/shared';
import { stepUnits } from './systems/units';
import { stepAbilities, stepAuras, stepBuffs } from './systems/abilities';

export interface PlayerInit { name: string; raceId: string; controller: 'human' | 'bot' | 'none'; color: string }
export interface GameInit { seed: number; mode: string; players: PlayerInit[] }

export const PLAYER_COLORS = ['#d8342c', '#2f6fe0', '#1fb8a8', '#8e3fc0'];

const EMPTY_STATS: Stats = {
  maxHp: 1, maxMana: 0, hpRegen: 0, manaRegen: 0, armor: 0, armorType: 'unarmored', attackType: 'normal', dmgBase: 0, dice: 0, sides: 0, dmgMul: 1, dmgAdd: 0,
  cooldown: 0, damagePoint: 0, range: 0, acquire: 0, speed: 0, evasion: 0, critChance: 0, critMul: 1, lifesteal: 0, bashChance: 0, bashDuration: 0,
  damageTakenMul: 1, pierceTakenMul: 1, thorns: 0, canHitAir: false, hasWeapon: false,
};

/** Upgrade ids available at each shared building kind (race-specific kinds are resolved from the race pack). */
const BUILDING_UPGRADES: Partial<Record<BuildingKind, string[]>> = {
  fortress: ['up.fortress'], barracks: ['up.tier'], tower: ['up.towerLevel'], goldAltar: ['up.goldMining', 'up.bountyHunter', 'up.artifacts'],
};

/**
 * The deterministic game simulation. Runs at 20 ticks per second, consumes Commands, emits SimEvents.
 * Contains no DOM, wall-clock or Math.random usage (see docs/DETERMINISM.md).
 */
export class Simulation {
  tick = 0;
  readonly reg: Registry;
  readonly mode: GameModeDef;
  readonly map: MapRuntime;
  readonly rng: RngStreams;
  readonly players: PlayerState[] = [];
  readonly entities: Entity[] = [];
  readonly byId = new Map<number, Entity>();
  readonly grid = new SpatialHash(400);
  flags: GameFlags = { freeBuild: false, instantResearch: false, reveal: false, noSpawn: false, botsFrozen: false };
  events: SimEvent[] = [];
  nextId = 1;
  nextWave = 0;
  nextIncome = 0;
  middleOwner = -1;
  winner = -1;
  phase: 'playing' | 'ended' = 'playing';
  private pending: StampedCommand[] = [];
  private seq = 0;

  constructor(readonly init: GameInit, reg: Registry, layout: MapLayoutData) {
    this.reg = reg;
    this.mode = reg.modes[init.mode] ?? reg.modes.standard!;
    this.rng = new RngStreams(init.seed);
    this.map = new MapRuntime(layout);
    this.map.buildAllLanes();
    const raceIds = [...reg.races.keys()];
    init.players.forEach((pi, i) => {
      const raceId = pi.raceId === 'random' || !reg.races.has(pi.raceId) ? this.rng.misc.pick(raceIds) : pi.raceId;
      const slot = layout.slots[i]!;
      this.players.push({
        id: i, slot, name: pi.name, raceId, color: pi.color || PLAYER_COLORS[i]!, controller: pi.controller,
        alive: pi.controller !== 'none', eliminatedAt: -1, gold: this.mode.startGold, totalGold: this.mode.startGold, income: 0,
        kills: 0, lost: 0, upgrades: {}, heroCd: {}, specialCd: {}, fortressLevel: 1, god: false,
      });
    });
    for (const p of this.players) if (p.alive) this.createBase(p);
    this.nextWave = Math.round(this.mode.firstWave * TICK_RATE);
    this.nextIncome = Math.round(this.mode.incomeInterval * TICK_RATE);
  }

  // ---------------------------------------------------------------- entities
  race(p: number): RaceDef { return this.reg.race(this.players[p]!.raceId); }
  get(id: number): Entity | undefined { return this.byId.get(id); }
  emit(e: SimEvent): void { this.events.push(e); }

  newEntity(kind: Entity['kind'], owner: number, def: string, x: number, y: number): Entity {
    const e: Entity = {
      id: this.nextId++, kind, owner, def, cls: kind === 'building' ? 'building' : kind === 'projectile' ? 'projectile' : 'melee',
      x, y, facing: 0, radius: 16, flying: false, hp: 1, mana: 0, alive: true, diedAt: -1, removeAt: -1,
      lane: -1, wp: 0, target: 0, retarget: 0, attackCd: 0, swing: -1, swingTarget: 0, castCd: {}, abilities: [], buffs: [],
      stun: 0, expireAt: 0, anim: Anim.Idle, animT: this.tick, stats: EMPTY_STATS, dirty: true, lastHitBy: 0, kills: 0,
    };
    this.entities.push(e); this.byId.set(e.id, e);
    return e;
  }

  refreshStats(e: Entity): void {
    if (e.kind === 'projectile') return;
    const oldMax = e.stats.maxHp, oldMana = e.stats.maxMana;
    e.stats = computeStats(this.reg, e, this.players[e.owner]!);
    e.dirty = false;
    if (oldMax !== e.stats.maxHp && oldMax > 1) e.hp = Math.min(e.stats.maxHp, e.hp * e.stats.maxHp / oldMax);
    if (oldMana !== e.stats.maxMana && oldMana > 0) e.mana = Math.min(e.stats.maxMana, e.mana * e.stats.maxMana / oldMana);
  }

  private createBase(p: PlayerState): void {
    for (const pl of this.map.placements(p.slot)) {
      const b = this.reg.buildings[pl.kind];
      const e = this.newEntity('building', p.id, `${p.raceId}.${pl.kind}`, pl.x, pl.y);
      e.radius = b.radius; e.facing = pl.facing;
      e.bld = { kind: pl.kind, lane: pl.lane, levels: {}, queue: [] };
      this.refreshStats(e); e.hp = e.stats.maxHp;
    }
  }

  spawnUnit(owner: number, unitId: string, x: number, y: number, lane: number, opts?: { expireIn?: number; hero?: boolean }): Entity {
    const def = this.reg.unit(unitId);
    const e = this.newEntity('unit', owner, unitId, x, y);
    e.cls = def.cls; e.radius = def.radius; e.flying = !!def.flying; e.lane = lane; e.wp = 1;
    if (lane >= 0) { const pts = this.map.lanes[lane]!.points; e.wp = nearestWaypoint(pts, x, y); const t = pts[Math.min(e.wp, pts.length - 1)]!; e.facing = atan2(t.y - y, t.x - x); }
    if (opts?.hero) e.hero = { level: 1, xp: 0, items: new Array(INVENTORY_SLOTS).fill(null), abilityLevels: heroAbilityLevels(1) };
    if (opts?.expireIn) e.expireAt = this.tick + opts.expireIn;
    this.refreshStats(e);
    e.hp = e.stats.maxHp; e.mana = e.stats.maxMana;
    e.retarget = e.id % 8; e.anim = Anim.Walk;
    this.emit({ t: 'spawn', id: e.id });
    return e;
  }

  laneFor(owner: number, dir: LaneDir): number { return this.map.laneIndex(owner, dir); }

  /** Spawn position in front of the barracks of a lane (formation offset k). */
  spawnPoint(owner: number, dir: LaneDir, k: number): Vec2 {
    const lane = this.map.lanes[this.laneFor(owner, dir)]!;
    const a = lane.points[0]!, b = lane.points[1]!;
    const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const fx = dx / d, fy = dy / d; const row = Math.floor(k / 3), col = (k % 3) - 1;
    return { x: a.x + fx * (230 + row * 70) - fy * col * 70, y: a.y + fy * (230 + row * 70) + fx * col * 70 };
  }

  // ---------------------------------------------------------------- commands
  enqueue(cmd: Command, tick = this.tick): void { this.pending.push({ tick: Math.max(tick, this.tick), seq: this.seq++, cmd }); }
  pendingCommands(): readonly StampedCommand[] { return this.pending; }

  private applyCommands(): void {
    if (!this.pending.length) return;
    const now: StampedCommand[] = []; const later: StampedCommand[] = [];
    for (const c of this.pending) (c.tick <= this.tick ? now : later).push(c);
    now.sort((a, b) => a.tick - b.tick || a.seq - b.seq);
    this.pending = later;
    for (const c of now) this.execute(c.cmd);
  }

  private reject(player: number, reason: string): false { this.emit({ t: 'reject', player, reason }); return false; }

  execute(cmd: Command): boolean {
    const p = this.players[cmd.player];
    if (!p) return false;
    if (cmd.t === 'dev') return this.execDev(cmd.op);
    if (!p.alive || this.phase !== 'playing') return false;
    switch (cmd.t) {
      case 'research': return this.cmdResearch(p, cmd.building, cmd.upgrade);
      case 'cancel': return this.cmdCancel(p, cmd.building, cmd.index);
      case 'buyHero': return this.cmdBuyHero(p, cmd.hero, cmd.lane);
      case 'buySpecial': return this.cmdBuySpecial(p, cmd.unit, cmd.lane);
      case 'surrender': this.eliminate(p.id, -1); return true;
      case 'chat': return true;
    }
  }

  /** Upgrade ids a building offers, in command-card order. */
  buildingUpgrades(e: Entity): string[] {
    const kind = e.bld!.kind; const race = this.race(e.owner);
    if (kind === 'forge') return race.forgeUpgrades;
    if (kind === 'sanctum') return race.sanctumUpgrades;
    return BUILDING_UPGRADES[kind] ?? [];
  }

  currentLevel(p: PlayerState, e: Entity, up: UpgradeDef): number {
    return up.scope === 'building' ? (e.bld!.levels[up.id] ?? 0) : (p.upgrades[up.id] ?? 0);
  }
  /** Levels queued but not finished (across all buildings for player scope). */
  pendingLevels(p: PlayerState, e: Entity, up: UpgradeDef): number {
    if (up.scope === 'building') return e.bld!.queue.filter(j => j.upgrade === up.id).length;
    let n = 0;
    for (const b of this.entities) if (b.kind === 'building' && b.owner === p.id && b.alive) for (const j of b.bld!.queue) if (j.upgrade === up.id) n++;
    return n;
  }
  upgradeCost(p: PlayerState, up: UpgradeDef, level: number): number {
    return Math.round((up.cost[0] + up.cost[1] * (level - 1)) * raceMods(this.reg, p.raceId).upgradeCost);
  }
  upgradeTime(up: UpgradeDef, level: number): number { return Math.round((up.time[0] + up.time[1] * (level - 1)) * TICK_RATE); }

  /** Why an upgrade cannot be queued right now (null = allowed). Shared by commands, UI tooltips and bots. */
  researchBlocker(p: PlayerState, e: Entity, upId: string): string | null {
    const up = this.reg.upgrades.get(upId); if (!up) return 'Unknown upgrade';
    if (!e.alive || e.owner !== p.id || !e.bld) return 'Invalid building';
    if (!this.buildingUpgrades(e).includes(upId)) return 'Not available here';
    const next = this.currentLevel(p, e, up) + this.pendingLevels(p, e, up) + 1;
    if (next > up.maxLevel) return 'Maximum level reached';
    if (e.bld.queue.length >= RESEARCH_QUEUE_MAX) return 'Queue is full';
    const needFort = up.effects.some(ef => ef.t === 'tier') ? next : up.requires?.fortress ?? 0;
    if (needFort > p.fortressLevel) return `Requires Fortress level ${needFort}`;
    if (up.requires?.upgrade) { const [rid, rl] = up.requires.upgrade; if ((p.upgrades[rid] ?? 0) < rl) return `Requires ${this.reg.upgrade(rid).name} ${rl}`; }
    if (!this.flags.freeBuild && p.gold < this.upgradeCost(p, up, next)) return 'Not enough gold';
    return null;
  }

  private cmdResearch(p: PlayerState, bId: number, upId: string): boolean {
    const e = this.get(bId); if (!e) return this.reject(p.id, 'Invalid building');
    const why = this.researchBlocker(p, e, upId); if (why) return this.reject(p.id, why);
    const up = this.reg.upgrade(upId);
    const level = this.currentLevel(p, e, up) + this.pendingLevels(p, e, up) + 1;
    const cost = this.flags.freeBuild ? 0 : this.upgradeCost(p, up, level);
    p.gold -= cost;
    const total = this.upgradeTime(up, level);
    e.bld!.queue.push({ upgrade: upId, level, remaining: total, total, cost });
    this.emit({ t: 'queued', player: p.id, upgrade: upId, building: e.id });
    return true;
  }

  private cmdCancel(p: PlayerState, bId: number, index: number): boolean {
    const e = this.get(bId); if (!e || !e.bld || e.owner !== p.id) return false;
    const job = e.bld.queue[index]; if (!job) return false;
    // cancelling a level also cancels later queued levels of the same upgrade in this building
    const removed = e.bld.queue.filter((j, i) => i >= index && j.upgrade === job.upgrade);
    e.bld.queue = e.bld.queue.filter(j => !removed.includes(j));
    for (const j of removed) p.gold += j.cost;
    return true;
  }

  heroBlocker(p: PlayerState, heroId: string): string | null {
    const h = this.reg.heroes.get(heroId); if (!h || h.race !== p.raceId) return 'Unknown hero';
    if (!this.findBuilding(p.id, 'altar')) return 'Altar of Heroes destroyed';
    if (this.entities.some(e => e.alive && e.owner === p.id && e.def === heroId)) return 'Hero is already on the battlefield';
    if ((p.heroCd[heroId] ?? 0) > this.tick) return 'Hero is not ready yet';
    if (!this.flags.freeBuild && p.gold < h.cost) return 'Not enough gold';
    return null;
  }

  private cmdBuyHero(p: PlayerState, heroId: string, lane: LaneDir): boolean {
    const why = this.heroBlocker(p, heroId); if (why) return this.reject(p.id, why);
    const h = this.reg.heroes.get(heroId) as HeroDef;
    if (!this.flags.freeBuild) p.gold -= h.cost;
    p.heroCd[heroId] = this.tick + Math.round(h.cooldown * TICK_RATE * raceMods(this.reg, p.raceId).buyCooldown);
    const sp = this.spawnPoint(p.id, lane, 1);
    const e = this.spawnUnit(p.id, heroId, sp.x, sp.y, this.laneFor(p.id, lane), { hero: true });
    this.emit({ t: 'heroBought', player: p.id, id: e.id, hero: heroId });
    return true;
  }

  specialBlocker(p: PlayerState, unitId: string): string | null {
    const s = this.race(p.id).specials.find(x => x.unit === unitId); if (!s) return 'Unknown unit';
    if (!this.findBuilding(p.id, 'mercCamp')) return 'Mercenary Camp destroyed';
    if ((p.specialCd[unitId] ?? 0) > this.tick) return 'Not ready yet';
    if (!this.flags.freeBuild && p.gold < s.cost) return 'Not enough gold';
    return null;
  }

  private cmdBuySpecial(p: PlayerState, unitId: string, lane: LaneDir): boolean {
    const why = this.specialBlocker(p, unitId); if (why) return this.reject(p.id, why);
    const s = this.race(p.id).specials.find(x => x.unit === unitId)!;
    if (!this.flags.freeBuild) p.gold -= s.cost;
    p.specialCd[unitId] = this.tick + Math.round(s.cooldown * TICK_RATE * raceMods(this.reg, p.raceId).buyCooldown);
    for (let k = 0; k < s.count; k++) { const sp = this.spawnPoint(p.id, lane, k + 3); this.spawnUnit(p.id, unitId, sp.x, sp.y, this.laneFor(p.id, lane)); }
    this.emit({ t: 'special', player: p.id, unit: unitId });
    return true;
  }

  findBuilding(owner: number, kind: BuildingKind, lane?: LaneDir): Entity | undefined {
    return this.entities.find(e => e.alive && e.kind === 'building' && e.owner === owner && e.bld!.kind === kind && (lane === undefined || e.bld!.lane === lane));
  }

  private execDev(op: DevOp): boolean {
    if (!this.mode.devAllowed) return false;
    const P = (i: number) => this.players[i];
    switch (op.k) {
      case 'gold': { const p = P(op.target); if (!p) return false; p.gold = op.set ? op.amount : p.gold + op.amount; break; }
      case 'income': { const p = P(op.target); if (!p) return false; p.income = op.amount; break; }
      case 'spawn': {
        const lane = this.laneFor(op.target, op.lane);
        for (let k = 0; k < op.count; k++) {
          const sp = op.x !== undefined && op.y !== undefined ? { x: op.x + (k % 5) * 50, y: op.y + Math.floor(k / 5) * 50 } : this.spawnPoint(op.target, op.lane, k);
          const isHero = this.reg.heroes.has(op.unit);
          this.spawnUnit(op.target, op.unit, sp.x, sp.y, lane, { hero: isHero });
        }
        break;
      }
      case 'kill': for (const id of op.ids) { const e = this.get(id); if (e?.alive) this.kill(e, null); } break;
      case 'killUnits': for (const e of this.entities) if (e.alive && e.kind === 'unit' && (op.target < 0 || e.owner === op.target)) this.kill(e, null); break;
      case 'heal': for (const id of op.ids) { const e = this.get(id); if (e?.alive) { e.hp = e.stats.maxHp; e.mana = e.stats.maxMana; } } break;
      case 'god': { const p = P(op.target); if (p) p.god = op.on; break; }
      case 'flag': this.flags[op.flag] = op.on; break;
      case 'eliminate': this.eliminate(op.target, -1); break;
      case 'setUpgrade': {
        const p = P(op.target); const up = this.reg.upgrades.get(op.upgrade); if (!p || !up) return false;
        if (up.scope === 'player') {
          const was = p.upgrades[op.upgrade] ?? 0; p.upgrades[op.upgrade] = Math.max(0, Math.min(up.maxLevel, op.level));
          if (up.effects.some(ef => ef.t === 'fortress')) p.fortressLevel = 1 + p.upgrades[op.upgrade]!;
          if (was !== p.upgrades[op.upgrade]) this.markDirty(p.id);
        } else {
          for (const e of this.entities) if (e.alive && e.owner === p.id && e.bld && this.buildingUpgrades(e).includes(op.upgrade)) { e.bld.levels[op.upgrade] = Math.max(0, Math.min(up.maxLevel, op.level)); e.dirty = true; }
        }
        break;
      }
      case 'wave': this.spawnWave(op.target); break;
      case 'heroLevel': { const e = this.get(op.id); if (e?.hero) for (let i = 0; i < op.levels; i++) this.addXp(e, (HERO_XP[e.hero.level - 1] ?? 0) - e.hero.xp + 1); break; }
      case 'giveItem': { const e = this.get(op.id); if (e?.hero && this.reg.items.has(op.item)) this.giveItem(e, op.item); break; }
      case 'resetCooldowns': { const p = P(op.target); if (p) { p.heroCd = {}; p.specialCd = {}; } break; }
    }
    this.emit({ t: 'dev', text: op.k });
    return true;
  }

  markDirty(owner: number): void { for (const e of this.entities) if (e.owner === owner && e.alive) e.dirty = true; }

  // ---------------------------------------------------------------- systems
  step(): void {
    if (this.phase === 'ended') { this.tick++; return; }
    this.applyCommands();
    this.stepEconomy();
    this.stepResearch();
    this.stepWaves();
    for (const e of this.entities) if (e.dirty && e.alive) this.refreshStats(e);
    this.rebuildGrid();
    stepBuffs(this);
    stepAuras(this);
    stepAbilities(this);
    stepUnits(this);
    this.stepRegen();
    this.cleanup();
    this.tick++;
  }

  rebuildGrid(): void {
    this.grid.clear();
    for (const e of this.entities) if (e.alive && e.kind !== 'projectile') this.grid.insert(e.id, e.x, e.y);
  }

  income(p: PlayerState): number {
    let inc = this.mode.baseIncome;
    for (const id in p.upgrades) { const up = this.reg.upgrades.get(id); if (!up) continue; for (const ef of up.effects) if (ef.t === 'income') inc += ef.add * p.upgrades[id]!; }
    return Math.round(inc * raceMods(this.reg, p.raceId).income) + p.income;
  }

  private stepEconomy(): void {
    if (this.tick < this.nextIncome) return;
    this.nextIncome += Math.round(this.mode.incomeInterval * TICK_RATE);
    // middle control: the player with the most unit strength near the centre gets a bonus
    const strength = this.players.map(() => 0);
    const r = this.mode.middleRadius;
    for (const e of this.entities) if (e.alive && e.kind === 'unit' && e.x * e.x + e.y * e.y < r * r) strength[e.owner]! += e.hp;
    let best = -1, bestS = 0, second = 0;
    strength.forEach((s, i) => { if (s > bestS) { second = bestS; bestS = s; best = i; } else if (s > second) second = s; });
    this.middleOwner = bestS > 0 && bestS > second * 1.25 ? best : -1;
    for (const p of this.players) {
      if (!p.alive) continue;
      const mid = p.id === this.middleOwner ? this.mode.middleBonus : 0;
      const amount = this.income(p) + mid;
      p.gold += amount; p.totalGold += amount;
      this.emit({ t: 'income', player: p.id, amount, middle: mid > 0 });
    }
  }

  private stepResearch(): void {
    for (const e of this.entities) {
      if (!e.alive || e.kind !== 'building' || !e.bld!.queue.length) continue;
      const p = this.players[e.owner]!; const job = e.bld!.queue[0]!;
      job.remaining -= this.mode.researchSpeed * raceMods(this.reg, p.raceId).researchSpeed;
      if (this.flags.instantResearch) job.remaining = 0;
      if (job.remaining > 0) continue;
      e.bld!.queue.shift();
      const up = this.reg.upgrade(job.upgrade);
      if (up.scope === 'player') {
        p.upgrades[up.id] = Math.max(p.upgrades[up.id] ?? 0, job.level);
        if (up.effects.some(ef => ef.t === 'fortress')) p.fortressLevel = 1 + p.upgrades[up.id]!;
        this.markDirty(p.id);
      } else { e.bld!.levels[up.id] = job.level; e.dirty = true; }
      this.emit({ t: 'research', player: p.id, upgrade: up.id, level: job.level, building: e.id });
    }
  }

  private stepWaves(): void {
    if (this.tick < this.nextWave) return;
    this.nextWave += Math.round(this.mode.waveInterval * TICK_RATE);
    if (this.flags.noSpawn) return;
    for (const p of this.players) if (p.alive) this.spawnWave(p.id);
  }

  spawnWave(owner: number): void {
    const race = this.race(owner);
    for (const b of this.entities) {
      if (!b.alive || b.owner !== owner || b.kind !== 'building' || b.bld!.kind !== 'barracks') continue;
      const tier = 1 + (b.bld!.levels['up.tier'] ?? 0);
      const comp = race.waves[Math.min(tier, race.waves.length) - 1]!;
      const dir = b.bld!.lane!; const lane = this.laneFor(owner, dir);
      let k = 0;
      for (const w of comp) for (let c = 0; c < w.count; c++) { const sp = this.spawnPoint(owner, dir, k++); this.spawnUnit(owner, w.unit, sp.x, sp.y, lane); }
    }
    this.emit({ t: 'wave', player: owner });
  }

  private stepRegen(): void {
    for (const e of this.entities) {
      if (!e.alive || e.kind === 'projectile') continue;
      if (e.hp < e.stats.maxHp) e.hp = Math.min(e.stats.maxHp, e.hp + e.stats.hpRegen / TICK_RATE);
      if (e.mana < e.stats.maxMana) e.mana = Math.min(e.stats.maxMana, e.mana + e.stats.manaRegen / TICK_RATE);
      if (e.expireAt && this.tick >= e.expireAt) this.kill(e, null);
    }
  }

  private cleanup(): void {
    let w = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i]!;
      if (!e.alive && e.removeAt <= this.tick) { this.byId.delete(e.id); continue; }
      this.entities[w++] = e;
    }
    this.entities.length = w;
  }

  // ---------------------------------------------------------------- death, rewards, victory
  kill(e: Entity, killer: Entity | null, killerOwner = killer ? killer.owner : -1): void {
    if (!e.alive) return;
    e.alive = false; e.hp = 0; e.diedAt = this.tick; e.anim = Anim.Death; e.animT = this.tick; e.target = 0; e.buffs = []; e.swing = -1;
    e.removeAt = this.tick + (e.kind === 'building' ? 120 : e.kind === 'projectile' ? 0 : 70);
    if (e.kind === 'projectile') return;
    const victim = this.players[e.owner]!; if (e.kind === 'unit') victim.lost++;
    let bounty = 0;
    const kOwner = killerOwner;
    if (kOwner !== e.owner && kOwner >= 0) {
      const kp = this.players[kOwner]!;
      if (killer) killer.kills++;
      kp.kills++;
      const baseBounty = e.kind === 'building' ? this.reg.buildings[e.bld!.kind].bounty : this.reg.unit(e.def).bounty;
      let bMul = 1; for (const id in kp.upgrades) { const up = this.reg.upgrades.get(id); if (up) for (const ef of up.effects) if (ef.t === 'bounty') bMul += ef.mul * kp.upgrades[id]!; }
      bounty = Math.round(baseBounty * this.mode.bountyMul * raceMods(this.reg, kp.raceId).goldBounty * bMul);
      if (kp.alive) { kp.gold += bounty; kp.totalGold += bounty; }
      // experience for nearby heroes of the killer
      const xp = e.kind === 'building' ? this.reg.buildings[e.bld!.kind].xp : this.reg.unit(e.def).xp;
      const heroes = this.entities.filter(h => h.alive && h.hero && h.owner === kOwner && dist2(h.x, h.y, e.x, e.y) < 1200 * 1200);
      for (const h of heroes) this.addXp(h, xp / heroes.length);
      // artifacts
      if (killer && killer.hero && killer.alive && e.kind === 'unit' && e.cls !== 'summon') {
        let chance = this.mode.artifactBaseChance;
        for (const id in kp.upgrades) { const up = this.reg.upgrades.get(id); if (up) for (const ef of up.effects) if (ef.t === 'artifactChance') chance += ef.add * kp.upgrades[id]!; }
        if (this.rng.drops.chance(chance)) this.giveItem(killer, `item.${this.rng.drops.pick(ITEM_FAMILIES)}.1`);
      }
    }
    this.emit({ t: 'death', id: e.id, killer: killer?.id ?? 0, x: e.x, y: e.y, bounty, killerOwner: kOwner });
    if (e.kind === 'building' && e.bld!.kind === 'fortress') this.eliminate(e.owner, kOwner);
  }

  addXp(h: Entity, amount: number): void {
    if (!h.hero || h.hero.level >= HERO_MAX_LEVEL) return;
    h.hero.xp += amount;
    while (h.hero.level < HERO_MAX_LEVEL && h.hero.xp >= HERO_XP[h.hero.level - 1]!) {
      h.hero.level++; h.hero.abilityLevels = heroAbilityLevels(h.hero.level);
      h.dirty = true; this.refreshStats(h); h.hp = Math.min(h.stats.maxHp, h.hp + h.stats.maxHp * 0.25);
      this.emit({ t: 'levelUp', id: h.id, level: h.hero.level });
    }
  }

  giveItem(h: Entity, itemId: string): void {
    const inv = h.hero!.items;
    let combined = false;
    let cur: string | undefined = itemId;
    // combine with an identical artifact if present (repeat up the chain)
    while (cur) {
      const idx = inv.indexOf(cur); const def = this.reg.item(cur);
      if (idx >= 0 && def.combinesInto) { inv[idx] = null; cur = def.combinesInto; combined = true; continue; }
      break;
    }
    const free = inv.indexOf(null);
    if (free >= 0) inv[free] = cur!;
    else { // full: replace the weakest item
      let wi = 0; for (let i = 1; i < inv.length; i++) if (this.reg.item(inv[i]!).level < this.reg.item(inv[wi]!).level) wi = i;
      inv[wi] = cur!;
    }
    h.dirty = true;
    this.emit({ t: 'item', id: h.id, item: cur!, combined });
  }

  eliminate(pid: number, by: number): void {
    const p = this.players[pid]; if (!p || !p.alive) return;
    p.alive = false; p.eliminatedAt = this.tick;
    for (const e of this.entities) if (e.owner === pid && e.alive && e.kind !== 'projectile') this.kill(e, null);
    this.emit({ t: 'eliminated', player: pid, by });
    const alive = this.players.filter(q => q.alive);
    if (alive.length <= 1 && this.phase === 'playing') {
      this.phase = 'ended'; this.winner = alive[0]?.id ?? -1;
      this.emit({ t: 'victory', winner: this.winner });
    }
  }

  // ---------------------------------------------------------------- determinism helpers
  /** FNV-1a hash of the relevant game state; compared across peers/replays to detect desyncs. */
  hash(): number {
    let h = 0x811c9dc5;
    const mix = (v: number) => { h ^= v | 0; h = Math.imul(h, 0x01000193) >>> 0; };
    mix(this.tick);
    for (const p of this.players) { mix(Math.round(p.gold)); mix(p.alive ? 1 : 0); mix(p.fortressLevel); }
    for (const e of this.entities) { mix(e.id); mix(Math.round(e.x * 16)); mix(Math.round(e.y * 16)); mix(Math.round(e.hp * 16)); mix(e.alive ? 1 : 0); }
    return h >>> 0;
  }

  snapshot(): string {
    return JSON.stringify({
      tick: this.tick, init: this.init, players: this.players, entities: this.entities, flags: this.flags, nextId: this.nextId,
      nextWave: this.nextWave, nextIncome: this.nextIncome, middleOwner: this.middleOwner, winner: this.winner, phase: this.phase,
      rng: this.rng.state(), pending: this.pending, seq: this.seq,
    });
  }

  static restore(json: string, reg: Registry, layout: MapLayoutData): Simulation {
    const s = JSON.parse(json);
    const sim = new Simulation(s.init, reg, layout);
    sim.tick = s.tick; sim.players.splice(0, sim.players.length, ...s.players);
    sim.entities.length = 0; sim.byId.clear();
    for (const e of s.entities) { sim.entities.push(e); sim.byId.set(e.id, e); }
    Object.assign(sim, { flags: s.flags, nextId: s.nextId, nextWave: s.nextWave, nextIncome: s.nextIncome, middleOwner: s.middleOwner, winner: s.winner, phase: s.phase, pending: s.pending, seq: s.seq });
    sim.rng.setState(s.rng);
    sim.events = [];
    return sim;
  }

  slotOf(p: number): Slot { return this.players[p]!.slot; }
}

function nearestWaypoint(pts: Vec2[], x: number, y: number): number {
  // the next waypoint is the first one after the closest segment
  let best = 1, bestD = Infinity;
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k]!, b = pts[k + 1]!; const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + dx * t - x, py = a.y + dy * t - y; const d = px * px + py * py;
    if (d < bestD) { bestD = d; best = k + 1; }
  }
  return best;
}
