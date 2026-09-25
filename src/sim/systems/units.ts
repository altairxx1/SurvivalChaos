import type { Simulation } from '../Simulation';
import { Anim, type Entity } from '../state/types';
import type { AttackType } from '../defs/types';
import { armorMultiplier, typeMultiplier } from '../combat/rules';
import { atan2, dist2 } from '../core/DMath';
import { MapRuntime, type Vec2 } from '../map/MapRuntime';

/** How far units may stray from their lane while chasing a target. */
export const LEASH = 850;
const WAYPOINT_REACHED = 90;

/** Main per-tick unit update: stun, swing, targeting, attacking, movement, projectiles. */
export function stepUnits(sim: Simulation): void {
  const list = sim.entities;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    if (!e.alive) continue;
    if (e.kind === 'projectile') { stepProjectile(sim, e); continue; }
    if (e.attackCd > 0) e.attackCd--;
    if (e.stun > 0) { e.stun--; e.swing = -1; continue; }
    if (e.kind === 'building') { if (e.stats.hasWeapon) stepShooter(sim, e); continue; }
    stepUnit(sim, e);
  }
}

function stepShooter(sim: Simulation, e: Entity): void {
  if (e.swing >= 0) { if (e.swing-- === 0) resolveAttack(sim, e); return; }
  if (--e.retarget <= 0 || !validTarget(sim, e, e.target, e.stats.range + 50)) { e.target = acquire(sim, e, e.stats.range); e.retarget = 6; }
  const t = e.target ? sim.get(e.target) : undefined;
  if (t && e.attackCd <= 0 && inRange(e, t, e.stats.range)) startSwing(sim, e, t);
}

function validTarget(sim: Simulation, e: Entity, id: number, maxRange: number): boolean {
  if (!id) return false;
  const t = sim.get(id);
  if (!t || !t.alive || t.owner === e.owner || t.kind === 'projectile') return false;
  if (t.flying && !e.stats.canHitAir) return false;
  const r = maxRange + t.radius + e.radius;
  return dist2(e.x, e.y, t.x, t.y) <= r * r;
}

function inRange(e: Entity, t: Entity, range: number): boolean {
  const r = range + t.radius + e.radius;
  return dist2(e.x, e.y, t.x, t.y) <= r * r;
}

/** Target priority mirrors WC3 lane behaviour: units first (closest), then towers, then other buildings. */
function acquire(sim: Simulation, e: Entity, range: number): number {
  let best = 0, bestScore = Infinity;
  sim.grid.query(e.x, e.y, range + 300, id => {
    const t = sim.byId.get(id)!;
    if (!t.alive || t.owner === e.owner) return;
    if (t.flying && !e.stats.canHitAir) return;
    const r = range + t.radius + e.radius; const d2 = dist2(e.x, e.y, t.x, t.y);
    if (d2 > r * r) return;
    let score = Math.sqrt(d2) - t.radius;
    if (t.kind === 'building') score += t.bld!.kind === 'tower' ? 1500 : t.bld!.kind === 'fortress' ? 2500 : 2000;
    if (t.id === e.lastHitBy) score -= 200;
    if (score < bestScore || (score === bestScore && t.id < best)) { bestScore = score; best = t.id; }
  });
  return best;
}

function lanePoints(sim: Simulation, e: Entity): Vec2[] | null {
  if (e.lane < 0) return null;
  const lane = sim.map.lanes[e.lane]!;
  if (!sim.players[lane.target]!.alive) reroute(sim, e);
  return e.lane >= 0 ? sim.map.lanes[e.lane]!.points : null;
}

/** When the lane's target player is eliminated, switch to the cross lane of the nearest living enemy. */
function reroute(sim: Simulation, e: Entity): void {
  let best = -1, bestD = Infinity;
  for (const p of sim.players) {
    if (!p.alive || p.id === e.owner) continue;
    const f = sim.map.fortressPos(p.slot); const d = dist2(e.x, e.y, f.x, f.y);
    if (d < bestD) { bestD = d; best = p.id; }
  }
  if (best < 0) { e.lane = -1; return; }
  // find a lane (of any owner) that ends at that player's fortress and is closest to the unit
  let li = -1, lBest = Infinity;
  sim.map.lanes.forEach((l, i) => {
    if (l.target !== best) return;
    const d = MapRuntime.distToPath(l.points, e.x, e.y);
    if (d < lBest) { lBest = d; li = i; }
  });
  e.lane = li;
  if (li >= 0) {
    const pts = sim.map.lanes[li]!.points;
    let wp = 1, wd = Infinity;
    for (let k = 1; k < pts.length; k++) { const d = dist2(e.x, e.y, pts[k]!.x, pts[k]!.y); if (d < wd) { wd = d; wp = k; } }
    e.wp = wp;
  }
}

function stepUnit(sim: Simulation, e: Entity): void {
  if (e.swing >= 0) { if (e.swing-- === 0) resolveAttack(sim, e); return; }
  const s = e.stats;
  if (s.hasWeapon) {
    if (--e.retarget <= 0 || !validTarget(sim, e, e.target, s.acquire + 150)) {
      const cur = e.target ? sim.get(e.target) : undefined;
      const next = acquire(sim, e, s.acquire);
      // stick to a unit target we are already fighting unless it left range
      if (!(cur && cur.alive && cur.kind === 'unit' && validTarget(sim, e, cur.id, s.acquire) && next && sim.get(next)!.kind !== 'unit')) e.target = next;
      e.retarget = 8 + (e.id & 3);
    }
  } else e.target = 0;

  const t = e.target ? sim.get(e.target) : undefined;
  if (t) {
    if (inRange(e, t, s.range)) {
      e.facing = atan2(t.y - e.y, t.x - e.x);
      if (e.attackCd <= 0) startSwing(sim, e, t);
      else if (e.anim !== Anim.Attack) setAnim(sim, e, Anim.Stand);
      return;
    }
    // leash: do not chase too far from the lane
    const pts = lanePoints(sim, e);
    if (pts && t.kind === 'unit' && MapRuntime.distToPath(pts, t.x, t.y) > LEASH) { e.target = 0; e.retarget = 20; }
    else { moveToward(sim, e, t.x, t.y, s.range + t.radius + e.radius - 5); return; }
  }
  // march along the lane
  const pts = lanePoints(sim, e);
  if (!pts) { setAnim(sim, e, Anim.Stand); return; }
  let wp = pts[Math.min(e.wp, pts.length - 1)]!;
  if (e.wp < pts.length - 1 && dist2(e.x, e.y, wp.x, wp.y) < WAYPOINT_REACHED * WAYPOINT_REACHED) { e.wp++; wp = pts[e.wp]!; }
  if (e.wp >= pts.length - 1 && dist2(e.x, e.y, wp.x, wp.y) < 250 * 250) { setAnim(sim, e, Anim.Stand); return; }
  moveToward(sim, e, wp.x, wp.y, 0);
}

function setAnim(sim: Simulation, e: Entity, a: Anim): void { if (e.anim !== a) { e.anim = a; e.animT = sim.tick; } }

function moveToward(sim: Simulation, e: Entity, tx: number, ty: number, stopDist: number): void {
  const dx = tx - e.x, dy = ty - e.y; const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= stopDist + 1) { setAnim(sim, e, Anim.Stand); return; }
  const step = Math.min(e.stats.speed, d - stopDist);
  let nx = e.x + dx / d * step, ny = e.y + dy / d * step;
  // separation from other ground units and pushing out of buildings
  const r0 = e.radius;
  sim.grid.query(nx, ny, r0 + 60, id => {
    if (id === e.id) return;
    const o = sim.byId.get(id)!;
    if (!o.alive || o.flying !== e.flying) return;
    const ox = nx - o.x, oy = ny - o.y; const od2 = ox * ox + oy * oy; const minD = r0 + o.radius;
    if (od2 >= minD * minD) return;
    const od = Math.sqrt(od2);
    if (od < 0.001) { nx += (e.id & 1 ? 1 : -1); return; }
    const push = o.kind === 'building' ? (minD - od) : (minD - od) * 0.35;
    nx += ox / od * push; ny += oy / od * push;
  });
  const H = sim.map.half - 64;
  e.x = nx < -H ? -H : nx > H ? H : nx; e.y = ny < -H ? -H : ny > H ? H : ny;
  e.facing = atan2(dy, dx);
  setAnim(sim, e, Anim.Walk);
}

function startSwing(sim: Simulation, e: Entity, t: Entity): void {
  e.swing = e.stats.damagePoint; e.swingTarget = t.id; e.attackCd = e.stats.cooldown;
  e.facing = atan2(t.y - e.y, t.x - e.x);
  e.anim = Anim.Attack; e.animT = sim.tick;
  sim.emit({ t: 'attack', id: e.id, target: t.id });
}

function rollDamage(sim: Simulation, e: Entity): { dmg: number; crit: boolean } {
  const s = e.stats; let roll = s.dmgBase;
  for (let i = 0; i < s.dice; i++) roll += sim.rng.combat.int(1, Math.max(1, s.sides));
  let dmg = roll * s.dmgMul + s.dmgAdd; let crit = false;
  if (s.critChance > 0 && sim.rng.combat.chance(s.critChance)) { dmg *= s.critMul; crit = true; }
  return { dmg, crit };
}

function resolveAttack(sim: Simulation, e: Entity): void {
  const t = sim.get(e.swingTarget);
  if (!t || !t.alive) return;
  const { dmg, crit } = rollDamage(sim, e);
  const s = e.stats;
  if (s.projectile) {
    const p = spawnProjectile(sim, e, t, dmg, s.attackType, true);
    if (s.bounce) p.proj!.bounce = { ...s.bounce, hit: [t.id] };
    return;
  }
  applyHit(sim, e, t, dmg, s.attackType, crit);
}

export function spawnProjectile(sim: Simulation, src: Entity, t: Entity, dmg: number, attackType: AttackType, isAttack: boolean, fromX = src.x, fromY = src.y): Entity {
  const spec = src.stats.projectile ?? { speed: 1000, fx: 'arrow', arc: 0.1 };
  const p = sim.newEntity('projectile', src.owner, spec.fx, fromX, fromY);
  p.proj = { source: src.id, target: t.id, tx: t.x, ty: t.y, speed: spec.speed / 20, fx: spec.fx, arc: spec.arc ?? 0, sx: fromX, sy: fromY,
    dmg, attackType, splash: src.stats.splash, owner: src.owner, isAttack };
  p.facing = atan2(t.y - fromY, t.x - fromX);
  sim.emit({ t: 'spawn', id: p.id });
  return p;
}

function stepProjectile(sim: Simulation, p: Entity): void {
  const pr = p.proj!;
  const t = sim.get(pr.target);
  if (t && t.alive) { pr.tx = t.x; pr.ty = t.y; }
  const dx = pr.tx - p.x, dy = pr.ty - p.y; const d = Math.sqrt(dx * dx + dy * dy);
  if (d > pr.speed) { p.x += dx / d * pr.speed; p.y += dy / d * pr.speed; p.facing = atan2(dy, dx); return; }
  p.x = pr.tx; p.y = pr.ty;
  const src = sim.get(pr.source) ?? null;
  if (t && t.alive) {
    applyHit(sim, src, t, pr.dmg, pr.attackType, false, pr.owner, pr.splash, pr.isAttack);
    if (pr.bounce && pr.bounce.count > 0 && src) {
      let next: Entity | undefined; let nd = Infinity;
      sim.grid.query(t.x, t.y, pr.bounce.range, id => {
        const o = sim.byId.get(id)!;
        if (!o.alive || o.owner === pr.owner || o.kind !== 'unit' || pr.bounce!.hit.includes(o.id) || (o.flying && !src.stats.canHitAir)) return;
        const dd = dist2(t.x, t.y, o.x, o.y); if (dd < nd && dd <= pr.bounce!.range * pr.bounce!.range) { nd = dd; next = o; }
      });
      if (next) {
        const np = spawnProjectile(sim, src, next, pr.dmg * (1 - pr.bounce.falloff), pr.attackType, true, t.x, t.y);
        np.proj!.bounce = { ...pr.bounce, count: pr.bounce.count - 1, hit: [...pr.bounce.hit, next.id] };
      }
    }
  } else if (pr.splash) {
    splash(sim, src, pr.owner, pr.tx, pr.ty, pr.dmg, pr.attackType, pr.splash, 0);
  }
  sim.kill(p, null);
}

function splash(sim: Simulation, src: Entity | null, owner: number, x: number, y: number, dmg: number, at: AttackType, sp: { radius: number; factor: number }, except: number): void {
  const hits: Entity[] = [];
  sim.grid.query(x, y, sp.radius + 60, id => {
    const o = sim.byId.get(id)!;
    if (!o.alive || o.owner === owner || o.id === except || o.flying) return;
    const r = sp.radius + o.radius;
    if (dist2(x, y, o.x, o.y) <= r * r) hits.push(o);
  });
  for (const o of hits) dealDamage(sim, src, owner, o, dmg * sp.factor, at, false);
}

/** An attack landing: primary damage, splash, bash, lifesteal. */
function applyHit(sim: Simulation, src: Entity | null, t: Entity, dmg: number, at: AttackType, crit: boolean, owner = src?.owner ?? -1,
  sp = src?.stats.splash, isAttack = true): void {
  const dealt = dealDamage(sim, src, owner, t, dmg, at, isAttack, crit);
  if (sp) splash(sim, src, owner, t.x, t.y, dmg, at, sp, t.id);
  if (src && src.alive && dealt > 0) {
    if (src.stats.lifesteal > 0) src.hp = Math.min(src.stats.maxHp, src.hp + dealt * src.stats.lifesteal);
    if (src.stats.bashChance > 0 && t.alive && t.kind === 'unit' && sim.rng.combat.chance(src.stats.bashChance)) t.stun = Math.max(t.stun, Math.round(src.stats.bashDuration * 20));
  }
}

/** Central damage pipeline: evasion -> attack/armor type table -> armor -> damage taken modifiers -> god mode. Returns damage dealt. */
export function dealDamage(sim: Simulation, src: Entity | null, owner: number, t: Entity, amount: number, at: AttackType, isAttack: boolean, crit = false): number {
  if (!t.alive || amount <= 0) return 0;
  if (isAttack && t.stats.evasion > 0 && sim.rng.combat.chance(t.stats.evasion)) { sim.emit({ t: 'miss', id: t.id, x: t.x, y: t.y }); return 0; }
  if (sim.players[t.owner]?.god) return 0;
  let dmg = amount * typeMultiplier(at, t.stats.armorType) * armorMultiplier(t.stats.armor) * t.stats.damageTakenMul;
  if (at === 'pierce') dmg *= t.stats.pierceTakenMul;
  if (dmg <= 0) return 0;
  dmg = Math.round(dmg * 100) / 100;
  t.hp -= dmg;
  if (src) t.lastHitBy = src.id;
  sim.emit({ t: 'hit', id: t.id, source: src?.id ?? 0, amount: dmg, crit, x: t.x, y: t.y, attackType: at });
  // thorns reflect melee attacks
  if (isAttack && src && src.alive && t.stats.thorns > 0 && src.stats.range <= 150) dealDamage(sim, t, t.owner, src, t.stats.thorns, 'spells', false);
  if (t.hp <= 0) sim.kill(t, src && src.alive ? src : null, owner);
  return dmg;
}
