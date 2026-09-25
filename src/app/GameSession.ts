import type { Simulation, GameInit } from '../sim/Simulation';
import type { Command } from '../sim/core/Commands';
import type { SimEvent } from '../sim/state/types';
import { Bot, PROFILES, type Difficulty } from '../ai/Bot';
import { Renderer } from '../render/Renderer';
import { AudioEngine, type SfxId } from '../audio/AudioEngine';
import { LocalTransport, type CommandTransport } from '../net/Transport';
import { createSimulation, getRegistry } from './createGame';
import type { Settings } from './settings';
import { Simulation as SimClass } from '../sim/Simulation';
import { MAP_LAYOUT } from '../data';

export interface HudMessage { id: number; text: string; color?: string; time: number; kind: 'info' | 'error' | 'warn' | 'good' }
export interface Ping { x: number; y: number; time: number; color: string }
export interface FloatText { x: number; y: number; z: number; text: string; cls: string; born: number }
export interface LobbySlot { name: string; controller: 'human' | 'bot' | 'none'; raceId: string; difficulty: Difficulty }
export interface LobbyConfig { slots: LobbySlot[]; mode: string; seed: number }

const TICK = 1 / 20;
let msgId = 1;

/** Owns one running game: simulation, bots, renderer, audio routing, UI-facing state. */
export class GameSession {
  sim: Simulation;
  renderer: Renderer;
  bots: Bot[] = [];
  transport: CommandTransport;
  localPlayer: number;
  speed = 1; paused = false; menuPaused = false;
  private acc = 0; private lastT = 0; private raf = 0; private stepOnce = 0;
  messages: HudMessage[] = []; pings: Ping[] = []; floats: FloatText[] = [];
  fps = 0; tickMs = 0; private fpsAcc = 0; private fpsN = 0;
  private lastAttackWarn = -1000;
  onUiTick: () => void = () => {};
  onEnd: (winner: number) => void = () => {};
  ended = false;
  readonly spectator: boolean;
  private uiTimer = 0;
  difficulties: Difficulty[];

  constructor(readonly canvas: HTMLCanvasElement, readonly config: LobbyConfig, public settings: Settings, readonly audio: AudioEngine, opts: { spectator?: boolean } = {}) {
    this.spectator = !!opts.spectator;
    const init: GameInit = { seed: config.seed, mode: config.mode, players: config.slots.map(s => ({ name: s.name, raceId: s.raceId, controller: s.controller, color: '' })) };
    this.sim = createSimulation(init);
    this.localPlayer = Math.max(0, config.slots.findIndex(s => s.controller === 'human'));
    this.difficulties = config.slots.map(s => s.difficulty);
    this.bots = this.sim.players.filter(p => p.controller === 'bot').map(p => new Bot(p.id, PROFILES[this.difficulties[p.id] ?? 'normal']));
    this.transport = new LocalTransport(() => this.sim);
    this.renderer = new Renderer(canvas, this.sim, { quality: settings.quality, showBars: settings.showBars, pixelRatio: settings.pixelRatio }, this.sim.players.map(p => p.color));
    this.renderer.localPlayer = this.localPlayer;
    this.renderer.onFloatText = (x, y, z, text, cls) => { if (this.floats.length < 60) this.floats.push({ x, y, z, text, cls, born: performance.now() }); };
    this.applySettings(settings);
    const base = this.sim.map.fortressPos(this.sim.players[this.localPlayer]!.slot);
    if (this.spectator) { this.renderer.cam.lookAt(0, 0, true); this.renderer.cam.dist = 3000; }
    else { this.renderer.cam.lookAt(base.x * 0.88, base.y * 0.88, true); this.faceCenter(); }
    this.renderer.interp.capture(this.sim);
  }

  /** Rotate the camera so the local base is at the bottom of the screen, like the original's per-player view. */
  private faceCenter(): void {
    const slot = this.sim.players[this.localPlayer]!.slot;
    const yaw = { bottom: 0, left: -Math.PI / 2, top: Math.PI, right: Math.PI / 2 }[slot];
    this.renderer.cam.setYawInstant(yaw);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.renderer.applySettings({ quality: s.quality, showBars: s.showBars, pixelRatio: s.pixelRatio });
    this.renderer.cam.speed = s.cameraSpeed; this.renderer.cam.edgePan = s.edgePan && !this.spectator;
    this.audio.apply(s.audio);
  }

  start(): void {
    this.lastT = performance.now();
    const loop = (t: number) => { this.raf = requestAnimationFrame(loop); this.frame(t); };
    this.raf = requestAnimationFrame(loop);
    this.audio.music?.play(this.spectator ? 'menu' : 'battle');
  }

  stop(): void { cancelAnimationFrame(this.raf); this.renderer.dispose(); }

  issue(cmd: Command): void { if (!this.spectator) this.transport.send(cmd); }
  step(n = 1): void { this.stepOnce += n; }

  private frame(t: number): void {
    const dt = Math.min(0.1, (t - this.lastT) / 1000); this.lastT = t;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if (!this.paused) this.acc += dt * this.speed;
    let steps = 0; const maxSteps = Math.max(8, Math.ceil(this.speed * 3));
    const t0 = performance.now();
    while ((this.acc >= TICK || this.stepOnce > 0) && steps < maxSteps) {
      this.renderer.interp.capture(this.sim);
      for (const b of this.bots) for (const c of b.think(this.sim)) this.sim.enqueue(c);
      this.sim.step();
      this.handleEvents(this.sim.events);
      this.renderer.onEvents(this.sim.events, this.localPlayer);
      this.sim.events = [];
      if (this.stepOnce > 0) this.stepOnce--; else this.acc -= TICK;
      steps++;
    }
    if (steps) this.tickMs = (performance.now() - t0) / steps;
    if (this.acc > TICK * maxSteps) this.acc = 0; // do not spiral when the tab was hidden
    this.renderer.interp.alpha = this.paused && !steps ? 1 : Math.min(1, this.acc / TICK);
    if (this.spectator) { this.renderer.cam.rotate(dt * 0.05); }
    this.renderer.render(dt);
    const c = this.renderer.cam; this.audio.listener = { x: c.target.x, y: c.target.y, zoom: c.dist };
    if (this.audio.music) this.audio.music.intensity = Math.min(1, this.nearbyFighting() / 25);
    this.uiTimer += dt;
    if (this.uiTimer > 0.1) { this.uiTimer = 0; this.prune(); this.onUiTick(); }
  }

  private nearbyFighting(): number {
    const t = this.renderer.cam.target; let n = 0;
    for (const e of this.sim.entities) if (e.alive && e.kind === 'unit' && e.target && Math.abs(e.x - t.x) < 1500 && Math.abs(e.y - t.y) < 1500) n++;
    return n;
  }

  private prune(): void {
    const now = performance.now();
    this.messages = this.messages.filter(m => now - m.time < (m.kind === 'error' ? 2500 : 9000)).slice(-8);
    this.pings = this.pings.filter(p => now - p.time < 3000);
    this.floats = this.floats.filter(f => now - f.born < 1400);
  }

  message(text: string, kind: HudMessage['kind'] = 'info', color?: string): void { this.messages.push({ id: msgId++, text, color, time: performance.now(), kind }); }

  private sfx(id: SfxId, x?: number, y?: number, vol = 1): void { this.audio.play(id, x !== undefined && y !== undefined ? { x, y } : undefined, vol); }

  private handleEvents(events: SimEvent[]): void {
    const sim = this.sim; const me = this.localPlayer; const reg = getRegistry();
    const pname = (i: number) => { const p = sim.players[i]!; return `${p.name} (${reg.race(p.raceId).name})`; };
    for (const ev of events) {
      switch (ev.t) {
        case 'attack': {
          const e = sim.get(ev.id); if (!e || !e.stats.projectile) break;
          if (e.stats.attackType === 'pierce' || e.kind === 'building') this.sfx('arrow', e.x, e.y, 0.35);
          break;
        }
        case 'hit': {
          const src = sim.get(ev.source); if (!src) break;
          const melee = !src.stats.projectile;
          const id: SfxId = ev.attackType === 'siege' ? 'blunt' : ev.attackType === 'magic' || ev.attackType === 'spells' ? 'magic' : melee ? (src.stats.attackType === 'normal' || src.stats.attackType === 'hero' ? 'sword' : 'blunt') : 'arrow';
          this.sfx(id, ev.x, ev.y, melee ? 0.4 : 0.25);
          const t = sim.get(ev.id);
          if (t && t.owner === me && t.kind === 'building' && sim.tick - this.lastAttackWarn > 20 * 20) {
            this.lastAttackWarn = sim.tick; this.message('Your base is under attack!', 'warn'); this.sfx('warn');
            this.pings.push({ x: ev.x, y: ev.y, time: performance.now(), color: '#ff3030' });
          }
          break;
        }
        case 'death': {
          const e = sim.get(ev.id); if (!e) break;
          if (e.kind === 'building') { this.sfx('collapse', ev.x, ev.y, 1.2); this.sfx('explosion', ev.x, ev.y);
            if (e.owner === me) this.message(`Your ${reg.buildings[e.bld!.kind].name} has been destroyed!`, 'warn');
            else if (ev.killerOwner === me) this.message(`You destroyed ${pname(e.owner)}'s ${reg.buildings[e.bld!.kind].name}. +${ev.bounty} gold`, 'good');
          } else if (e.kind === 'unit') {
            this.sfx(e.hero || e.cls === 'heavy' || e.cls === 'special' ? 'deathBig' : 'death', ev.x, ev.y, 0.45);
            if (e.hero) this.message(`${pname(e.owner)}'s ${reg.unit(e.def).name} has fallen${ev.killerOwner >= 0 ? ` to ${pname(ev.killerOwner)}` : ''}.`, e.owner === me ? 'warn' : 'info');
            if (ev.killerOwner === me && ev.bounty > 0) this.sfx('gold', ev.x, ev.y, 0.3);
          }
          break;
        }
        case 'cast': {
          const fx = ev.fx;
          const id: SfxId = /fire|inferno|immolation|metamorphosis|bloodlust/i.test(fx) ? 'fire' : /frost|blizzard|snow/i.test(fx) ? 'frost' : /lightning|storm|thunder|chain/i.test(fx) ? 'lightning'
            : /holy|divine|heal|rejuv|tranq/i.test(fx) ? 'holy' : /stomp|quake|shock/i.test(fx) ? 'blunt' : 'magic';
          this.sfx(id, ev.tx, ev.ty, 0.7);
          break;
        }
        case 'chain': this.sfx('lightning', ev.points[1]?.x ?? 0, ev.points[1]?.y ?? 0, 0.7); break;
        case 'research': if (ev.player === me) { const up = reg.upgrade(ev.upgrade); this.message(`Research complete: ${up.name}${up.maxLevel > 1 ? ` (Level ${ev.level})` : ''}`, 'good'); this.sfx('research'); } break;
        case 'queued': if (ev.player === me) this.sfx('queue'); break;
        case 'reject': if (ev.player === me) { this.message(ev.reason, 'error'); this.sfx('error'); } break;
        case 'heroBought': {
          const h = reg.unit(ev.hero);
          if (ev.player === me) { this.message(`${h.name} has entered the battle!`, 'good'); this.sfx('hero'); }
          else { this.message(`${pname(ev.player)} has summoned the hero ${h.name}!`, 'info', sim.players[ev.player]!.color); this.sfx('hero', undefined, undefined, 0.4); }
          break;
        }
        case 'special': if (ev.player === me) this.sfx('hero', undefined, undefined, 0.6); break;
        case 'levelUp': { const e = sim.get(ev.id); if (e && e.owner === me) { this.message(`${reg.unit(e.def).name} reached level ${ev.level}!`, 'good'); this.sfx('levelup'); } break; }
        case 'item': { const e = sim.get(ev.id); if (e && e.owner === me) { this.message(`${reg.unit(e.def).name} ${ev.combined ? 'combined artifacts into' : 'found'} ${reg.item(ev.item).name}.`, 'good'); this.sfx('item'); } break; }
        case 'wave': if (ev.player === me) this.sfx('wave', undefined, undefined, 0.35); break;
        case 'income': if (ev.player === me && ev.middle) this.message(`You control the middle! +${sim.mode.middleBonus} bonus gold`, 'good'); break;
        case 'eliminated': this.message(`${pname(ev.player)} has been eliminated${ev.by >= 0 ? ` by ${pname(ev.by)}` : ''}!`, ev.player === me ? 'warn' : 'info', sim.players[ev.player]!.color);
          if (ev.player === me && !this.spectator) this.sfx('defeat'); break;
        case 'victory': this.ended = true; if (!this.spectator) this.sfx(ev.winner === me ? 'victory' : 'defeat'); this.onEnd(ev.winner); break;
        case 'dev': break;
      }
    }
  }

  /** Dev: take control of another player (the previous slot is handed to a bot). */
  setLocalPlayer(p: number): void {
    if (p === this.localPlayer || !this.sim.players[p]) return;
    const prev = this.localPlayer;
    this.sim.players[prev]!.controller = 'bot'; this.bots.push(new Bot(prev, PROFILES[this.difficulties[prev] ?? 'normal']));
    this.bots = this.bots.filter(b => b.player !== p); this.sim.players[p]!.controller = 'human';
    this.localPlayer = p; this.renderer.localPlayer = p;
    const f = this.sim.map.fortressPos(this.sim.players[p]!.slot); this.renderer.cam.lookAt(f.x * 0.88, f.y * 0.88); this.faceCenter();
    this.message(`Now controlling ${this.sim.players[p]!.name}`, 'info');
  }

  setBotDifficulty(p: number, d: Difficulty): void { this.difficulties[p] = d; const b = this.bots.find(x => x.player === p); if (b) b.profile = PROFILES[d]; }

  saveSnapshot(): string { return this.sim.snapshot(); }
  loadSnapshot(json: string): void {
    const sim = SimClass.restore(json, getRegistry(), MAP_LAYOUT);
    this.sim.events = [];
    // swap in place so the renderer keeps its scene
    Object.assign(this.sim, sim);
    (this.sim as unknown as { pending: unknown }).pending = (sim as unknown as { pending: unknown }).pending;
    this.renderer.interp.capture(this.sim);
    this.message('Snapshot loaded', 'info');
  }
}
