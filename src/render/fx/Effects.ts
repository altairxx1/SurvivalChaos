import * as THREE from 'three';
import { ParticlePool } from './Particles';
import type { AttackType } from '../../sim/defs/types';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Colour palette per spell/projectile fx id. Anything unknown falls back to arcane blue. */
export const FX_COLORS: Record<string, string> = {
  fireball: '#ff7a1a', fortressBolt: '#ffd24a', towerArrow: '#ffe8a0', arrow: '#f0e0b0', moonArrow: '#b8c8ff', magicMissile: '#c07aff', stormHammer: '#8ad0ff',
  mortarShell: '#ffb050', boulder: '#c0a080', lightningOrb: '#7ad4ff', spear: '#e0d0b0', shadowBolt: '#7aff8a', web: '#e8e8e8', frostBreath: '#9fe8ff',
  corpse: '#a05a4a', frostBolt: '#9fe0ff', natureBolt: '#8aff6a', acid: '#aaff3a', bigGlaive: '#e0e0ff', glaive: '#e0e0ff', waterBolt: '#5ac8ff',
  holyLight: '#ffe88a', holyNova: '#fff0a0', divineShield: '#ffe070', slow: '#b08aff', blizzard: '#bfeaff', summon: '#9a7aff', arcaneNova: '#d08aff',
  stormBolt: '#8ad0ff', thunderClap: '#c0d8ff', avatar: '#ffe08a', lightningShield: '#7ad4ff', bloodlust: '#ff3a3a', ensnare: '#c8b080', windWalk: '#c0ffff',
  bladeFlurry: '#ff6a3a', bladestorm: '#ff8a4a', chainLightning: '#8ad8ff', earthquake: '#b89060', shockwave: '#e0c090', warStomp: '#d0b080',
  cripple: '#8a4aff', deathCoil: '#7aff6a', frostNova: '#8ae0ff', frostArmor: '#bfe8ff', deathAndDecay: '#6a8a3a', carrionSwarm: '#5a3a6a', sleep: '#a08aff',
  inferno: '#ff5a1a', rejuvenation: '#8aff8a', roar: '#ffb04a', manaBurn: '#9aff3a', immolation: '#ff8a2a', metamorphosis: '#7aff4a', moonbeam: '#d8e0ff',
  starfall: '#e0e8ff', tranquility: '#a0ffb0', aura: '#ffffff', poison: '#7aff5a', frost: '#9fe8ff', burn: '#ff8a2a',
};
const HIT_COLORS: Record<AttackType, string> = { normal: '#ffe0b0', pierce: '#fff0c0', siege: '#ffb060', magic: '#b07aff', chaos: '#ff7a3a', spells: '#9ad0ff', hero: '#ffd070' };

interface Ring { mesh: THREE.Mesh; t: number; life: number; r0: number; r1: number }
interface Beam { mesh: THREE.Mesh; t: number; life: number }

export class Effects {
  readonly add = new ParticlePool(9000, true);
  readonly alpha = new ParticlePool(5000, false);
  readonly group = new THREE.Group();
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
  quality = 1;

  constructor() { this.group.add(this.add.points, this.alpha.points); this.group.name = 'fx'; }

  private n(k: number): number { return Math.max(1, Math.round(k * this.quality)); }

  update(dt: number): void {
    this.add.update(dt); this.alpha.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!; r.t += dt; const k = r.t / r.life;
      if (k >= 1) { this.group.remove(r.mesh); (r.mesh.material as THREE.Material).dispose(); this.rings.splice(i, 1); continue; }
      const s = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)); r.mesh.scale.set(s, 1, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]!; b.t += dt;
      if (b.t >= b.life) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); this.beams.splice(i, 1); continue; }
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - b.t / b.life;
    }
  }

  ring(x: number, y: number, z: number, color: string, radius: number, life = 0.6, from = 0.1): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.ringGeo, mat); m.position.set(x, y + 6, z); m.scale.setScalar(radius * from); m.renderOrder = 8;
    this.group.add(m); this.rings.push({ mesh: m, t: 0, life, r0: radius * from, r1: radius });
  }

  beam(points: THREE.Vector3[], color: string, width = 5, life = 0.35): void {
    if (points.length < 2) return;
    const jag: THREE.Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!, b = points[i + 1]!;
      for (let k = 0; k < 6; k++) { const t = k / 6; const p = a.clone().lerp(b, t); if (k > 0) p.add(new THREE.Vector3(rnd(-25, 25), rnd(-15, 25), rnd(-25, 25))); jag.push(p); }
    }
    jag.push(points[points.length - 1]!.clone());
    const curve = new THREE.CatmullRomCurve3(jag, false, 'catmullrom', 0.1);
    const geo = new THREE.TubeGeometry(curve, jag.length * 3, width, 4, false);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 11; this.group.add(m); this.beams.push({ mesh: m, t: 0, life });
    for (const p of jag) this.spark(p.x, p.y, p.z, color, 3, 60);
  }

  spark(x: number, y: number, z: number, color: string, count: number, speed: number, size = 14): void {
    for (let i = 0; i < this.n(count); i++) this.add.spawn({ x, y, z, vx: rnd(-speed, speed), vy: rnd(0, speed * 1.2), vz: rnd(-speed, speed), life: rnd(0.2, 0.45), size, sizeEnd: 2, color, gravity: 300, drag: 3 });
  }

  hit(x: number, y: number, z: number, at: AttackType, crit: boolean, organic: boolean): void {
    this.spark(x, y, z, HIT_COLORS[at], crit ? 10 : 4, crit ? 180 : 110, crit ? 22 : 14);
    if (organic && Math.random() < 0.5) for (let i = 0; i < this.n(3); i++) this.alpha.spawn({ x, y, z, vx: rnd(-60, 60), vy: rnd(20, 120), vz: rnd(-60, 60), life: 0.5, size: 10, sizeEnd: 6, color: '#8a1010', alpha: 0.9, gravity: 500 });
  }

  death(x: number, y: number, z: number, big: boolean, color = '#8a7a6a'): void {
    for (let i = 0; i < this.n(big ? 18 : 7); i++) this.alpha.spawn({ x: x + rnd(-20, 20), y: y + rnd(5, 30), z: z + rnd(-20, 20), vx: rnd(-40, 40), vy: rnd(20, 80), vz: rnd(-40, 40), life: rnd(0.8, 1.6), size: big ? 70 : 35, sizeEnd: big ? 140 : 70, color, alpha: 0.55, drag: 1.5 });
  }

  explosion(x: number, y: number, z: number, r: number): void {
    for (let i = 0; i < this.n(40); i++) this.add.spawn({ x: x + rnd(-r, r) * 0.4, y: y + rnd(0, r * 0.6), z: z + rnd(-r, r) * 0.4, vx: rnd(-r, r), vy: rnd(40, r * 1.5), vz: rnd(-r, r), life: rnd(0.5, 1.1), size: rnd(40, 90), sizeEnd: 10, color: Math.random() < 0.5 ? '#ffb040' : '#ff5a1a', gravity: 200, drag: 1.5 });
    for (let i = 0; i < this.n(40); i++) this.alpha.spawn({ x: x + rnd(-r, r) * 0.6, y: y + rnd(0, r), z: z + rnd(-r, r) * 0.6, vx: rnd(-50, 50), vy: rnd(40, 140), vz: rnd(-50, 50), life: rnd(1.5, 3.2), size: rnd(90, 160), sizeEnd: 260, color: '#4a4440', alpha: 0.6, drag: 0.8 });
    this.ring(x, y, z, '#ffb060', r * 2.2, 0.8);
  }

  smoke(x: number, y: number, z: number, fire: boolean): void {
    this.alpha.spawn({ x: x + rnd(-15, 15), y, z: z + rnd(-15, 15), vx: rnd(-10, 10), vy: rnd(60, 110), vz: rnd(-10, 10), life: rnd(1.5, 2.6), size: 40, sizeEnd: 130, color: '#3a3634', alpha: 0.45, drag: 0.3 });
    if (fire) this.add.spawn({ x: x + rnd(-15, 15), y, z: z + rnd(-15, 15), vx: rnd(-10, 10), vy: rnd(60, 120), vz: rnd(-10, 10), life: rnd(0.4, 0.8), size: 45, sizeEnd: 8, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffcf4a' });
  }

  trail(x: number, y: number, z: number, color: string): void {
    this.add.spawn({ x, y, z, vx: rnd(-8, 8), vy: rnd(-8, 8), vz: rnd(-8, 8), life: 0.3, size: 18, sizeEnd: 2, color, alpha: 0.8 });
  }

  gold(x: number, y: number, z: number): void {
    for (let i = 0; i < this.n(6); i++) this.add.spawn({ x, y: y + 40, z, vx: rnd(-40, 40), vy: rnd(120, 220), vz: rnd(-40, 40), life: 0.8, size: 12, sizeEnd: 4, color: '#ffd24a', gravity: 400 });
  }

  levelUp(x: number, y: number, z: number): void {
    for (let i = 0; i < this.n(40); i++) { const a = (i / 40) * Math.PI * 2; this.add.spawn({ x: x + Math.cos(a) * 50, y: y + 5, z: z + Math.sin(a) * 50, vy: rnd(150, 260), life: 1, size: 18, sizeEnd: 4, color: '#ffe070', drag: 1 }); }
    this.ring(x, y, z, '#ffe070', 160, 0.9);
  }

  /** Generic spell effect by fx id: picks a recipe (nova, column, rain, burst, swirl). */
  spell(fx: string, caster: THREE.Vector3, target: THREE.Vector3, aoe: number): void {
    const color = FX_COLORS[fx] ?? '#8ab8ff';
    const r = aoe > 0 ? aoe : 90;
    switch (fx) {
      case 'holyLight': case 'rejuvenation': case 'deathPact': case 'frostArmor': case 'bloodlust': case 'lightningShield': case 'divineShield': case 'windWalk': case 'avatar': case 'metamorphosis':
        for (let i = 0; i < this.n(26); i++) this.add.spawn({ x: target.x + rnd(-35, 35), y: target.y + rnd(0, 20), z: target.z + rnd(-35, 35), vy: rnd(80, 200), life: rnd(0.6, 1.1), size: 22, sizeEnd: 4, color, drag: 0.5 });
        this.ring(target.x, target.y, target.z, color, 90, 0.5);
        break;
      case 'blizzard': case 'starfall': case 'deathAndDecay': case 'inferno': case 'earthquake':
        for (let i = 0; i < this.n(fx === 'earthquake' || fx === 'deathAndDecay' ? 40 : 60); i++) {
          const ox = rnd(-r, r), oz = rnd(-r, r);
          if (fx === 'earthquake' || fx === 'deathAndDecay') this.alpha.spawn({ x: target.x + ox, y: target.y + 5, z: target.z + oz, vy: rnd(30, 90), life: rnd(0.8, 1.6), size: 60, sizeEnd: 140, color, alpha: 0.5 });
          else this.add.spawn({ x: target.x + ox, y: target.y + rnd(400, 800), z: target.z + oz, vy: -rnd(700, 1100), life: rnd(0.4, 0.8), size: fx === 'inferno' ? 60 : 26, sizeEnd: 10, color });
        }
        this.ring(target.x, target.y, target.z, color, r, 1.0, 0.8);
        if (fx === 'inferno') setTimeout(() => this.explosion(target.x, target.y, target.z, 160), 450);
        break;
      case 'thunderClap': case 'warStomp': case 'frostNova': case 'arcaneNova': case 'holyNova': case 'shockwave': case 'bladeFlurry': case 'bladestorm': case 'roar': case 'tranquility': case 'carrionSwarm':
        this.ring(target.x, target.y, target.z, color, r, 0.55);
        this.ring(target.x, target.y, target.z, color, r * 0.7, 0.8, 0.05);
        for (let i = 0; i < this.n(36); i++) { const a = (i / 36) * Math.PI * 2; this.add.spawn({ x: target.x, y: target.y + 15, z: target.z, vx: Math.cos(a) * r * 2, vy: rnd(10, 60), vz: Math.sin(a) * r * 2, life: 0.5, size: 30, sizeEnd: 6, color, drag: 2.5 }); }
        if (fx === 'warStomp' || fx === 'shockwave') this.death(target.x, target.y, target.z, true, '#9a8a6a');
        break;
      case 'summon':
        for (let i = 0; i < this.n(30); i++) { const a = (i / 30) * Math.PI * 4; this.add.spawn({ x: caster.x + Math.cos(a) * 60, y: caster.y + i * 3, z: caster.z + Math.sin(a) * 60, vx: -Math.sin(a) * 90, vy: 60, vz: Math.cos(a) * 90, life: 0.9, size: 22, sizeEnd: 3, color }); }
        break;
      default:
        // projectile-like bolt from caster to target + burst
        for (let k = 0; k <= 10; k++) { const p = caster.clone().lerp(target, k / 10); p.y += 60 + Math.sin((k / 10) * Math.PI) * 60; this.add.spawn({ x: p.x, y: p.y, z: p.z, life: 0.25 + k * 0.02, size: 26, sizeEnd: 6, color }); }
        this.spark(target.x, target.y + 40, target.z, color, 14, 160, 22);
        if (aoe > 0) this.ring(target.x, target.y, target.z, color, aoe, 0.5);
    }
  }
}
