import type { Simulation } from '../Simulation';
import { Anim, type Entity } from '../state/types';
import type { AbilityDef, AbilityEffect } from '../defs/types';
import { lv } from '../defs/Registry';
import { abilityLevel } from '../combat/stats';
import { atan2, dist2 } from '../core/DMath';
import { dealDamage } from './units';

const AURA_PERIOD = 10;        // ticks between aura refreshes
const AI_PERIOD = 5;           // ticks between cast decisions per unit
const DOT_PERIOD = 10;
/** Fixed spawn directions for summons (avoids trig). */
const RING = [[1, 0], [0.5, 0.866], [-0.5, 0.866], [-1, 0], [-0.5, -0.866], [0.5, -0.866]];

export function addBuff(sim: Simulation, t: Entity, buffId: string, durationTicks: number, source: number): void {
  if (!t.alive) return;
  const ex = t.buffs.find(b => b.id === buffId);
  if (ex) { ex.until = Math.max(ex.until, sim.tick + durationTicks); return; }
  t.buffs.push({ id: buffId, until: sim.tick + durationTicks, source, stacks: 1 });
  t.dirty = true;
}

/** Buff expiry plus damage/heal over time. */
export function stepBuffs(sim: Simulation): void {
  const dotTick = sim.tick % DOT_PERIOD === 0;
  for (const e of sim.entities) {
    if (!e.alive || !e.buffs.length) continue;
    let removed = false;
    for (let i = e.buffs.length - 1; i >= 0; i--) {
      const b = e.buffs[i]!;
      if (b.until <= sim.tick) { e.buffs.splice(i, 1); removed = true; continue; }
      if (!dotTick) continue;
      const def = sim.reg.buff(b.id);
      if (def.dot) { const src = sim.get(b.source) ?? null; dealDamage(sim, src, src?.owner ?? -1, e, def.dot * DOT_PERIOD / 20, 'spells', false); if (!e.alive) break; }
      if (def.hot && e.hp < e.stats.maxHp) { const amt = def.hot * DOT_PERIOD / 20; e.hp = Math.min(e.stats.maxHp, e.hp + amt); }
    }
    if (removed) e.dirty = true;
  }
}

/** Auras periodically (re)apply a short buff to units in range. */
export function stepAuras(sim: Simulation): void {
  for (const e of sim.entities) {
    if (!e.alive || e.kind !== 'unit' || (sim.tick + e.id) % AURA_PERIOD !== 0) continue;
    for (const abId of e.abilities) {
      const ab = sim.reg.abilities.get(abId); if (!ab || ab.kind !== 'aura') continue;
      for (const ef of ab.effects) {
        if (ef.t !== 'aura') continue;
        sim.grid.query(e.x, e.y, ef.radius, id => {
          const o = sim.byId.get(id)!;
          if (!o.alive || o.kind !== 'unit') return;
          if ((o.owner === e.owner) !== ef.allies) return;
          if (dist2(e.x, e.y, o.x, o.y) > ef.radius * ef.radius) return;
          addBuff(sim, o, ef.buff, AURA_PERIOD + 4, e.id);
        });
      }
    }
  }
}

function countEnemies(sim: Simulation, e: Entity, x: number, y: number, r: number): number {
  let n = 0;
  sim.grid.query(x, y, r, id => { const o = sim.byId.get(id)!; if (o.alive && o.owner !== e.owner && o.kind === 'unit' && dist2(x, y, o.x, o.y) <= r * r) n++; });
  return n;
}

function nearestEnemy(sim: Simulation, e: Entity, range: number, unitsOnly: boolean, heroesOnly = false): Entity | undefined {
  let best: Entity | undefined, bd = Infinity;
  sim.grid.query(e.x, e.y, range + 50, id => {
    const o = sim.byId.get(id)!;
    if (!o.alive || o.owner === e.owner || (unitsOnly && o.kind !== 'unit') || (heroesOnly && !o.hero)) return;
    const d = dist2(e.x, e.y, o.x, o.y); if (d <= range * range && (d < bd || (d === bd && o.id < best!.id))) { bd = d; best = o; }
  });
  return best;
}

function pickAlly(sim: Simulation, e: Entity, ab: AbilityDef, range: number): Entity | undefined {
  const hpBelow = ab.ai?.allyHpBelow;
  const buffId = ab.effects.find(f => f.t === 'buff') as Extract<AbilityEffect, { t: 'buff' }> | undefined;
  let best: Entity | undefined, bestScore = Infinity;
  sim.grid.query(e.x, e.y, range + 50, id => {
    const o = sim.byId.get(id)!;
    if (!o.alive || o.owner !== e.owner || o.kind !== 'unit' || dist2(e.x, e.y, o.x, o.y) > range * range) return;
    let score: number;
    if (hpBelow !== undefined) { const f = o.hp / o.stats.maxHp; if (f >= hpBelow) return; score = f; }
    else {
      if (!o.target) return;                                   // only buff units that are fighting
      if (buffId && o.buffs.some(b => b.id === buffId.buff)) return;
      score = -(o.stats.maxHp + (o.hero ? 5000 : 0));
    }
    if (score < bestScore) { bestScore = score; best = o; }
  });
  return best;
}

/** AI casting for units and heroes (players never control units in Survival Chaos). */
export function stepAbilities(sim: Simulation): void {
  for (const e of sim.entities) {
    if (!e.alive || e.kind !== 'unit' || e.stun > 0 || e.swing >= 0 || (sim.tick + e.id) % AI_PERIOD !== 0) continue;
    for (const abId of e.abilities) {
      const ab = sim.reg.abilities.get(abId); if (!ab || ab.kind !== 'active') continue;
      const level = abilityLevel(sim.reg, e, abId);
      if ((e.castCd[abId] ?? 0) > sim.tick) continue;
      const mana = lv(ab.mana, level); if (e.mana < mana) continue;
      const ai = ab.ai ?? {};
      let target: Entity | undefined; let px = e.x, py = e.y;
      const range = ab.range;
      switch (ab.target) {
        case 'enemy': {
          const cur = e.target ? sim.get(e.target) : undefined;
          target = cur && cur.alive && cur.kind === 'unit' && dist2(e.x, e.y, cur.x, cur.y) <= range * range && (!ai.onlyHeroes || cur.hero) ? cur : nearestEnemy(sim, e, range, true, ai.onlyHeroes);
          if (!target) continue;
          if (ai.minEnemies && countEnemies(sim, e, target.x, target.y, 350) < ai.minEnemies) continue;
          px = target.x; py = target.y; break;
        }
        case 'enemyArea': {
          const aoe = maxAoe(ab, level);
          if (range > 0) {
            const t = nearestEnemy(sim, e, range, true); if (!t) continue;
            px = t.x; py = t.y;
          }
          if (countEnemies(sim, e, px, py, aoe || 300) < (ai.minEnemies ?? 1)) continue;
          break;
        }
        case 'ally': { target = pickAlly(sim, e, ab, range); if (!target) continue; if (ai.minEnemies && countEnemies(sim, e, e.x, e.y, 900) < ai.minEnemies) continue; px = target.x; py = target.y; break; }
        case 'allyArea': { if (countEnemies(sim, e, e.x, e.y, 900) < (ai.minEnemies ?? 1)) continue; break; }
        case 'self': {
          if (ai.selfHpBelow !== undefined && e.hp / e.stats.maxHp >= ai.selfHpBelow) continue;
          if (ai.minEnemies && countEnemies(sim, e, e.x, e.y, 800) < ai.minEnemies) continue;
          if (ai.selfHpBelow === undefined && !ai.minEnemies && !e.target) continue;
          target = e; break;
        }
      }
      e.mana -= mana;
      e.castCd[abId] = sim.tick + Math.round(lv(ab.cooldown, level) * 20);
      e.anim = Anim.Cast; e.animT = sim.tick;
      if (px !== e.x || py !== e.y) e.facing = atan2(py - e.y, px - e.x);
      castAbility(sim, e, ab, level, target, px, py);
      break;      // one cast per decision window
    }
  }
}

function maxAoe(ab: AbilityDef, level: number): number {
  let a = 0; for (const ef of ab.effects) if ('aoe' in ef && ef.aoe !== undefined) a = Math.max(a, lv(ef.aoe, level));
  return a;
}

function inArea(sim: Simulation, e: Entity, x: number, y: number, r: number, allies: boolean, fn: (o: Entity) => void): void {
  const hits: Entity[] = [];
  sim.grid.query(x, y, r + 60, id => {
    const o = sim.byId.get(id)!;
    if (!o.alive || (o.owner === e.owner) !== allies) return;
    const rr = r + o.radius; if (dist2(x, y, o.x, o.y) <= rr * rr) hits.push(o);
  });
  for (const o of hits) fn(o);
}

export function castAbility(sim: Simulation, e: Entity, ab: AbilityDef, level: number, target: Entity | undefined, px: number, py: number): void {
  sim.emit({ t: 'cast', id: e.id, ability: ab.id, fx: ab.fx, x: e.x, y: e.y, tx: px, ty: py, target: target?.id ?? 0, aoe: maxAoe(ab, level) });
  for (const ef of ab.effects) {
    switch (ef.t) {
      case 'damage': {
        const amt = lv(ef.amount, level), at = ef.attackType ?? 'spells';
        if (ef.aoe) inArea(sim, e, px, py, lv(ef.aoe, level), false, o => dealDamage(sim, e, e.owner, o, amt, at, false));
        else if (target && target.owner !== e.owner) dealDamage(sim, e, e.owner, target, amt, at, false);
        break;
      }
      case 'heal': {
        const amt = lv(ef.amount, level);
        const heal = (o: Entity) => { if (o.kind !== 'unit') return; const before = o.hp; o.hp = Math.min(o.stats.maxHp, o.hp + amt); sim.emit({ t: 'heal', id: o.id, amount: o.hp - before }); };
        if (ef.aoe) inArea(sim, e, px, py, lv(ef.aoe, level), true, heal); else heal(target ?? e);
        break;
      }
      case 'buff': {
        const dur = Math.round(lv(ef.duration, level) * 20);
        const def = sim.reg.buff(ef.buff);
        const onEnemies = def.debuff === true;
        const apply = (o: Entity) => { if (o.kind === 'unit') addBuff(sim, o, ef.buff, dur, e.id); };
        if (ef.aoe) inArea(sim, e, px, py, lv(ef.aoe, level), !onEnemies, apply);
        else if (ab.target === 'self' || (!onEnemies && !target)) apply(e);
        else if (target) apply(target);
        break;
      }
      case 'stun': {
        const dur = Math.round(lv(ef.duration, level) * 20);
        const stun = (o: Entity) => { if (o.kind === 'unit') o.stun = Math.max(o.stun, dur); };
        if (ef.aoe) inArea(sim, e, px, py, lv(ef.aoe, level), false, stun); else if (target && target.owner !== e.owner) stun(target);
        break;
      }
      case 'chain': {
        if (!target) break;
        let amt = lv(ef.amount, level); const hit: number[] = []; let cur: Entity | undefined = target;
        const points = [{ x: e.x, y: e.y }];
        for (let b = 0; b <= lv(ef.bounces, level) && cur; b++) {
          hit.push(cur.id); points.push({ x: cur.x, y: cur.y });
          dealDamage(sim, e, e.owner, cur, amt, 'spells', false);
          amt *= 1 - ef.falloff;
          const from: Entity = cur; let next: Entity | undefined; let nd = Infinity;
          sim.grid.query(from.x, from.y, ef.range, id => {
            const o = sim.byId.get(id)!;
            if (!o.alive || o.owner === e.owner || o.kind !== 'unit' || hit.includes(o.id)) return;
            const d = dist2(from.x, from.y, o.x, o.y); if (d <= ef.range * ef.range && d < nd) { nd = d; next = o; }
          });
          cur = next;
        }
        sim.emit({ t: 'chain', fx: ab.fx, points });
        break;
      }
      case 'summon': {
        const n = lv(ef.count, level);
        for (let k = 0; k < n; k++) {
          const off = 80 + 20 * k;
          const dv = RING[k % 6]!;
          sim.spawnUnit(e.owner, ef.unit, e.x + dv[0]! * off, e.y + dv[1]! * off, e.lane, { expireIn: ef.duration * 20 });
        }
        break;
      }
      case 'manaBurn': {
        if (target && target.owner !== e.owner) target.mana = Math.max(0, target.mana - lv(ef.amount, level));
        break;
      }
      case 'passive': case 'aura': break;
    }
  }
}
