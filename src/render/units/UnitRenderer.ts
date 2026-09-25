import * as THREE from 'three';
import type { Registry } from '../../sim/defs/Registry';
import type { Simulation } from '../../sim/Simulation';
import { Anim, type Entity } from '../../sim/state/types';
import { buildUnitGeometry, createUnitMaterial } from '../models/unitModels';
import type { TerrainInfo } from '../terrain/Terrain';
import type { Interp } from '../Renderer';

interface Batch { mesh: THREE.InstancedMesh; cap: number; anim: THREE.InstancedBufferAttribute; team: THREE.InstancedBufferAttribute; geo: THREE.BufferGeometry; height: number }

const FLY_HEIGHT = 190;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(0, 0, 0, 'YXZ'), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();

/** One InstancedMesh (one draw call) per unit type; animation, team colour and hit flash via instance attributes. */
export class UnitRenderer {
  readonly group = new THREE.Group();
  private batches = new Map<string, Batch>();
  private material = createUnitMaterial();
  private teamColors: THREE.Color[] = [];
  heights = new Map<string, number>();

  constructor(private reg: Registry, colors: string[]) { this.group.name = 'units'; this.teamColors = colors.map(c => new THREE.Color(c)); }

  setTeamColors(colors: string[]): void { this.teamColors = colors.map(c => new THREE.Color(c)); }

  heightOf(def: string): number {
    let h = this.heights.get(def);
    if (h === undefined) { h = this.batch(def).height; }
    return h;
  }

  private batch(def: string, need = 16): Batch {
    let b = this.batches.get(def);
    if (b && b.cap >= need) return b;
    const cap = Math.max(need, b ? b.cap * 2 : 32);
    let geo: THREE.BufferGeometry, height: number;
    if (b) { geo = b.geo; height = b.height; this.group.remove(b.mesh); b.mesh.dispose(); }
    else { const built = buildUnitGeometry(this.reg.unit(def).model); geo = built.geometry; height = built.height; this.heights.set(def, height); }
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const team = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnim', anim); geo.setAttribute('aTeamColor', team);
    const mesh = new THREE.InstancedMesh(geo, this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.count = 0;
    this.group.add(mesh);
    b = { mesh, cap, anim, team, geo, height };
    this.batches.set(def, b);
    return b;
  }

  update(sim: Simulation, it: Interp, terrain: TerrainInfo, flashes: Map<number, number>, now: number): void {
    const counts = new Map<string, number>();
    // count first so batches can grow before writing
    for (const e of sim.entities) if (e.kind === 'unit') counts.set(e.def, (counts.get(e.def) ?? 0) + 1);
    for (const b of this.batches.values()) b.mesh.count = 0;
    for (const [def, n] of counts) this.batch(def, n);
    const idx = new Map<string, number>();
    const tickF = sim.tick - 1 + it.alpha;
    for (const e of sim.entities) {
      if (e.kind !== 'unit') continue;
      const b = this.batches.get(e.def)!; const i = idx.get(e.def) ?? 0; idx.set(e.def, i + 1);
      const p = it.pos(e);
      let y = terrain.heightAt(p.x, p.y);
      if (e.flying) y = Math.max(y, 0) + FLY_HEIGHT + Math.sin(now * 2 + e.id) * 12;
      let tilt = 0, sink = 0;
      if (!e.alive) { const t = (tickF - e.diedAt) / 20; tilt = Math.min(1, t * 2.4) * (Math.PI / 2) * (e.id & 1 ? 1 : -1); sink = Math.max(0, t - 1.6) * 45; if (e.flying) sink += Math.min(1, t * 1.5) * FLY_HEIGHT; }
      e3.set(tilt, p.f, 0); q.setFromEuler(e3);
      v3.set(p.x, y - sink, -p.y);
      m4.compose(v3, q, one); b.mesh.setMatrixAt(i, m4);
      const st = !e.alive ? 0 : e.stun > 0 ? 0 : e.anim === Anim.Walk ? 1 : e.anim === Anim.Attack ? 2 : e.anim === Anim.Cast ? 3 : 0;
      const phase = Math.max(0, (tickF - e.animT) / 20);
      let speed = 1;
      if (st === 1) speed = Math.max(0.5, e.stats.speed * 20 / 270);
      else if (st === 2) speed = 1 / (2.6 * Math.max(0.12, (e.stats.damagePoint / 20) * 1.7));
      const f = flashes.get(e.id); const flash = f !== undefined ? Math.max(0, 1 - (now - f) / 0.14) : 0;
      b.anim.setXYZW(i, st, phase, speed, flash);
      col.copy(this.teamColors[e.owner] ?? col.set('#888'));
      b.team.setXYZ(i, col.r, col.g, col.b);
    }
    for (const [def, b] of this.batches) {
      b.mesh.count = idx.get(def) ?? 0;
      b.mesh.instanceMatrix.needsUpdate = true; b.anim.needsUpdate = true; b.team.needsUpdate = true;
    }
  }

  entityHeight(e: Entity): number { return e.kind === 'unit' ? this.heightOf(e.def) : 0; }
}
