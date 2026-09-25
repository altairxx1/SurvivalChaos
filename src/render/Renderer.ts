import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Simulation } from '../sim/Simulation';
import type { Entity, SimEvent } from '../sim/state/types';
import { RtsCamera } from './RtsCamera';
import { buildDoodads, buildTerrainInfo, buildTerrainMesh, buildWater, type TerrainInfo } from './terrain/Terrain';
import { UnitRenderer } from './units/UnitRenderer';
import { addBanners, addGlows, buildBuildingModel } from './models/buildingModels';
import { Effects, FX_COLORS } from './fx/Effects';

export type Quality = 'low' | 'medium' | 'high';
export interface RenderSettings { quality: Quality; showBars: 'always' | 'damaged' | 'never'; pixelRatio: number }

/** Interpolation helper between the previous and current sim tick. */
export class Interp {
  alpha = 1;
  prev = new Map<number, { x: number; y: number; f: number }>();
  capture(sim: Simulation): void {
    this.prev.clear();
    for (const e of sim.entities) this.prev.set(e.id, { x: e.x, y: e.y, f: e.facing });
  }
  pos(e: Entity): { x: number; y: number; f: number } {
    const p = this.prev.get(e.id); const a = this.alpha;
    if (!p) return { x: e.x, y: e.y, f: e.facing };
    let df = e.facing - p.f; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
    return { x: p.x + (e.x - p.x) * a, y: p.y + (e.y - p.y) * a, f: p.f + df * Math.min(1, a * 1.5) };
  }
}

interface BuildingView { group: THREE.Group; height: number; banners: THREE.Mesh[]; glows: THREE.Mesh[]; baseScale: number; emit: number; fx: THREE.Vector3[] }

const PROJ_STYLE: Record<string, 'arrow' | 'orb' | 'rock' | 'glaive'> = {
  arrow: 'arrow', towerArrow: 'arrow', moonArrow: 'arrow', spear: 'arrow', web: 'orb', boulder: 'rock', mortarShell: 'rock', corpse: 'rock', glaive: 'glaive', bigGlaive: 'glaive',
};

export class Renderer {
  readonly webgl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cam: RtsCamera;
  readonly terrain: TerrainInfo;
  readonly units: UnitRenderer;
  readonly fx = new Effects();
  readonly interp = new Interp();
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  private buildings = new Map<number, BuildingView>();
  private projMeshes: Record<string, THREE.InstancedMesh> = {};
  private bars: THREE.InstancedMesh; private barFill: THREE.InstancedBufferAttribute; private barCol: THREE.InstancedBufferAttribute;
  private selRing: THREE.Mesh; private hoverRing: THREE.Mesh; private heroRings: THREE.InstancedMesh;
  private flashes = new Map<number, number>();
  private doodads: THREE.Group;
  private centerCrystal: THREE.Object3D | undefined;
  private overlays = new THREE.Group();
  selected = 0; hovered = 0;
  settings: RenderSettings;
  altHeld = false;
  time = 0;
  onFloatText: (x: number, y: number, z: number, text: string, cls: string) => void = () => {};

  constructor(readonly canvas: HTMLCanvasElement, readonly sim: Simulation, settings: RenderSettings, teamColors: string[]) {
    this.settings = settings;
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: settings.quality !== 'low', powerPreference: 'high-performance' });
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping; this.webgl.toneMappingExposure = 1.0;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cam = new RtsCamera(canvas);
    this.cam.bounds = sim.map.half - 400;
    this.scene.background = new THREE.Color('#8fb4d8');
    this.scene.fog = new THREE.Fog('#9ab8d6', 5200, 12500);
    const hemi = new THREE.HemisphereLight('#cfe4ff', '#4a3a28', 1.1); this.scene.add(hemi);
    this.sun.position.set(-2000, 4000, 1500); this.sun.castShadow = true;
    this.scene.add(this.sun, this.sun.target);

    this.terrain = buildTerrainInfo(sim.map);
    this.cam.heightAt = (x, y) => Math.max(0, this.terrain.heightAt(x, y));
    this.scene.add(buildTerrainMesh(this.terrain), buildWater(this.terrain));
    this.doodads = buildDoodads(this.terrain, settings.quality);
    this.scene.add(this.doodads);
    this.centerCrystal = this.doodads.getObjectByName('centerCrystal');
    this.units = new UnitRenderer(sim.reg, teamColors);
    this.scene.add(this.units.group, this.fx.group, this.overlays);

    // projectiles
    const pm = (geo: THREE.BufferGeometry, emissive: boolean) => {
      const mat = emissive ? new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }) : new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
      const m = new THREE.InstancedMesh(geo, mat, 512); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(512 * 3), 3); this.scene.add(m); return m;
    };
    this.projMeshes.arrow = pm(new THREE.BoxGeometry(46, 2.5, 2.5), false);
    this.projMeshes.orb = pm(new THREE.IcosahedronGeometry(11, 1), true);
    this.projMeshes.rock = pm(new THREE.DodecahedronGeometry(15, 0), false);
    this.projMeshes.glaive = pm(new THREE.TorusGeometry(14, 3, 4, 10).rotateX(Math.PI / 2), false);

    // health bars
    const barGeo = new THREE.PlaneGeometry(1, 1);
    this.barFill = new THREE.InstancedBufferAttribute(new Float32Array(2048 * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.barCol = new THREE.InstancedBufferAttribute(new Float32Array(2048 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    barGeo.setAttribute('aFill', this.barFill); barGeo.setAttribute('aCol', this.barCol);
    const barMat = new THREE.ShaderMaterial({
      vertexShader: `attribute vec2 aFill; attribute vec3 aCol; varying vec2 vUv; varying vec2 vFill; varying vec3 vCol;
        void main(){ vUv = uv; vFill = aFill; vCol = aCol; vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);
          vec2 sc = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz)); c.xy += position.xy * sc; gl_Position = projectionMatrix * c; }`,
      fragmentShader: `varying vec2 vUv; varying vec2 vFill; varying vec3 vCol;
        void main(){ float border = step(vUv.y, 0.12) + step(0.88, vUv.y) + step(vUv.x, 0.02) + step(0.98, vUv.x);
          vec3 c = vUv.x < vFill.x ? vCol : vec3(0.08); if (border > 0.0) c = vec3(0.0); gl_FragColor = vec4(c, 1.0); }`,
      depthTest: false, depthWrite: false, transparent: true,
    });
    this.bars = new THREE.InstancedMesh(barGeo, barMat, 2048); this.bars.frustumCulled = false; this.bars.renderOrder = 20; this.bars.count = 0; this.scene.add(this.bars);

    const ringGeo = new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2);
    this.selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#3cff5a', transparent: true, opacity: 0.9, depthWrite: false })); this.selRing.visible = false; this.selRing.renderOrder = 5;
    this.hoverRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffe060', transparent: true, opacity: 0.6, depthWrite: false })); this.hoverRing.visible = false; this.hoverRing.renderOrder = 5;
    this.heroRings = new THREE.InstancedMesh(new THREE.RingGeometry(0.7, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }), 64);
    this.heroRings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3); this.heroRings.frustumCulled = false; this.heroRings.count = 0; this.heroRings.renderOrder = 4;
    this.scene.add(this.selRing, this.hoverRing, this.heroRings);
    this.applySettings(settings);
    this.teamColors = teamColors;
  }
  private teamColors: string[];

  applySettings(s: RenderSettings): void {
    this.settings = s;
    const q = s.quality;
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, s.pixelRatio));
    this.webgl.shadowMap.enabled = q !== 'low';
    const sz = q === 'high' ? 4096 : 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera; sc.left = -2600; sc.right = 2600; sc.top = 2600; sc.bottom = -2600; sc.near = 100; sc.far = 9000; sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 2;
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); (this.sun.shadow as unknown as { map: null }).map = null; }
    this.fx.quality = q === 'low' ? 0.4 : q === 'medium' ? 0.75 : 1;
    if (q === 'low') { this.composer = null; this.bloom = null; }
    else {
      const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
      this.composer = new EffectComposer(this.webgl);
      this.composer.addPass(new RenderPass(this.scene, this.cam.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.55, 0.45, 0.82);
      this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    }
    this.resize();
    this.scene.traverse(o => { if ((o as THREE.Mesh).material) ((o as THREE.Mesh).material as THREE.Material).needsUpdate = true; });
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.webgl.setSize(w, h, false); this.cam.resize(w, h); this.composer?.setSize(w, h);
    const pr = this.webgl.getPixelRatio();
    this.fx.add.setScale(h * pr * 0.9); this.fx.alpha.setScale(h * pr * 0.9);
  }

  worldPos(e: Entity): THREE.Vector3 {
    const p = this.interp.pos(e);
    const y = this.terrain.heightAt(p.x, p.y) + (e.flying ? 190 : 0);
    return new THREE.Vector3(p.x, Math.max(y, e.flying ? y : -20), -p.y);
  }

  // ------------------------------------------------------------------ sim events -> FX
  onEvents(events: SimEvent[], localPlayer: number): void {
    const sim = this.sim;
    for (const ev of events) {
      switch (ev.t) {
        case 'hit': {
          this.flashes.set(ev.id, this.time);
          const e = sim.get(ev.id); if (!e) break;
          if (!this.onScreen(ev.x, ev.y)) break;
          const h = e.kind === 'unit' ? this.units.heightOf(e.def) * 0.6 : 80;
          this.fx.hit(ev.x, this.terrain.heightAt(ev.x, ev.y) + h + (e.flying ? 190 : 0), -ev.y, ev.attackType, ev.crit, e.kind === 'unit' && e.cls !== 'siege');
          if (ev.crit && ev.amount > 20) this.onFloatText(ev.x, this.terrain.heightAt(ev.x, ev.y) + 140, -ev.y, `${Math.round(ev.amount)}!`, 'crit');
          break;
        }
        case 'death': {
          const e = sim.get(ev.id); if (!e) break;
          const y = this.terrain.heightAt(ev.x, ev.y);
          if (e.kind === 'building') { this.fx.explosion(ev.x, y + 60, -ev.y, e.radius); }
          else if (e.kind === 'unit') { this.fx.death(ev.x, y, -ev.y, e.cls === 'heavy' || e.cls === 'special' || !!e.hero); }
          if (ev.bounty > 0 && ev.killerOwner === localPlayer) { this.onFloatText(ev.x, y + 120, -ev.y, `+${ev.bounty}`, 'gold'); this.fx.gold(ev.x, y, -ev.y); }
          break;
        }
        case 'cast': {
          const c = sim.get(ev.id);
          const from = new THREE.Vector3(ev.x, this.terrain.heightAt(ev.x, ev.y) + (c?.flying ? 190 : 0), -ev.y);
          const to = new THREE.Vector3(ev.tx, this.terrain.heightAt(ev.tx, ev.ty), -ev.ty);
          if (this.onScreen(ev.tx, ev.ty)) this.fx.spell(ev.fx, from, to, ev.aoe);
          break;
        }
        case 'chain': {
          const pts = ev.points.map(p => new THREE.Vector3(p.x, this.terrain.heightAt(p.x, p.y) + 60, -p.y));
          this.fx.beam(pts, FX_COLORS[ev.fx] ?? '#8ad8ff', 5);
          break;
        }
        case 'levelUp': { const e = sim.get(ev.id); if (e) { const p = this.worldPos(e); this.fx.levelUp(p.x, p.y, p.z); } break; }
        case 'heal': { if (ev.amount > 30) { const e = sim.get(ev.id); if (e) { const p = this.worldPos(e); this.onFloatText(p.x, p.y + 110, p.z, `+${Math.round(ev.amount)}`, 'heal'); } } break; }
        case 'spawn': {
          const e = sim.get(ev.id);
          if (e && e.kind === 'unit' && (e.hero || e.cls === 'special')) { const p = this.worldPos(e); this.fx.spell('summon', p, p, 0); this.fx.ring(p.x, p.y, p.z, this.teamColors[e.owner]!, 140, 0.7); }
          break;
        }
        case 'item': { const e = sim.get(ev.id); if (e) { const p = this.worldPos(e); this.fx.levelUp(p.x, p.y, p.z); this.onFloatText(p.x, p.y + 150, p.z, ev.combined ? 'Artifact combined!' : 'Artifact found!', 'item'); } break; }
      }
    }
  }

  private onScreen(x: number, y: number): boolean {
    const t = this.cam.target; const r = this.cam.dist * 1.8;
    return Math.abs(x - t.x) < r && Math.abs(y - t.y) < r;
  }

  // ------------------------------------------------------------------ frame
  render(dt: number): void {
    this.time += dt;
    const sim = this.sim;
    this.cam.update(dt, false);
    const t = this.cam.target; const gy = this.terrain.heightAt(t.x, t.y);
    this.sun.position.set(t.x - 1800, gy + 3800, -t.y + 1400); this.sun.target.position.set(t.x, gy, -t.y); this.sun.target.updateMatrixWorld();
    if (this.centerCrystal) { this.centerCrystal.rotation.y += dt; this.centerCrystal.position.y = 90 + Math.sin(this.time * 2) * 10; const own = sim.middleOwner; ((this.centerCrystal as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.set(own >= 0 ? this.teamColors[own]! : '#3fa8ff'); }

    this.units.update(sim, this.interp, this.terrain, this.flashes, this.time);
    this.updateBuildings(dt);
    this.updateProjectiles();
    this.updateBars();
    this.updateRings();
    this.fx.update(dt);
    if (this.flashes.size > 400) for (const [id, tt] of this.flashes) if (this.time - tt > 0.3) this.flashes.delete(id);
    if (this.composer) this.composer.render(); else this.webgl.render(this.scene, this.cam.camera);
  }

  private updateBuildings(dt: number): void {
    const sim = this.sim; const seen = new Set<number>();
    for (const e of sim.entities) {
      if (e.kind !== 'building') continue;
      seen.add(e.id);
      let v = this.buildings.get(e.id);
      if (!v) {
        const race = sim.race(e.owner);
        const m = buildBuildingModel(e.bld!.kind, race.buildingStyle, e.radius);
        const banners = addBanners(m.group, m.banners, this.teamColors[e.owner]!);
        const glows = addGlows(m.group, m.glows, race.buildingStyle.trim);
        m.group.position.set(e.x, this.terrain.heightAt(e.x, e.y) - 4, -e.y); m.group.rotation.y = e.facing;
        this.scene.add(m.group);
        v = { group: m.group, height: m.height, banners, glows, baseScale: 1, emit: 0, fx: [0, 1, 2].map(() => new THREE.Vector3((Math.random() - 0.5) * e.radius, m.height * (0.3 + Math.random() * 0.5), (Math.random() - 0.5) * e.radius)) };
        this.buildings.set(e.id, v);
      }
      const lvl = e.bld!.kind === 'fortress' ? sim.players[e.owner]!.fortressLevel - 1 : e.bld!.kind === 'barracks' ? (e.bld!.levels['up.tier'] ?? 0) : e.bld!.kind === 'tower' ? (e.bld!.levels['up.towerLevel'] ?? 0) * 0.5 : 0;
      const scale = 1 + lvl * 0.08;
      v.group.scale.setScalar(scale);
      for (const b of v.banners) b.rotation.y = Math.sin(this.time * 2 + e.id) * 0.25;
      for (const g of v.glows) { g.rotation.y += dt * 1.5; (g.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(this.time * 3 + e.id) * 0.6 + lvl; }
      if (!e.alive) {
        const t = (sim.tick - e.diedAt) / 20;
        v.group.position.y = this.terrain.heightAt(e.x, e.y) - 4 - t * v.height * 0.25; v.group.rotation.z = Math.sin(t * 9) * 0.02;
        if (Math.random() < dt * 20) this.fx.smoke(e.x + (Math.random() - 0.5) * e.radius, this.terrain.heightAt(e.x, e.y) + 20, -e.y + (Math.random() - 0.5) * e.radius, true);
        continue;
      }
      const frac = e.hp / e.stats.maxHp;
      if (frac < 0.65 && this.onScreen(e.x, e.y)) {
        v.emit += dt * (frac < 0.35 ? 14 : 5);
        while (v.emit > 1) { v.emit--; const p = v.fx[Math.floor(Math.random() * v.fx.length)]!; this.fx.smoke(e.x + p.x * scale, v.group.position.y + p.y * scale, -e.y + p.z * scale, frac < 0.4); }
      }
    }
    for (const [id, v] of this.buildings) if (!seen.has(id)) { this.scene.remove(v.group); v.group.traverse(o => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); this.buildings.delete(id); }
  }

  private updateProjectiles(): void {
    const sim = this.sim; const counts: Record<string, number> = { arrow: 0, orb: 0, rock: 0, glaive: 0 };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(0, 0, 0, 'YXZ'), p3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    for (const e of sim.entities) {
      if (e.kind !== 'projectile' || !e.alive) continue;
      const pr = e.proj!; const style = PROJ_STYLE[pr.fx] ?? 'orb';
      const mesh = this.projMeshes[style]!; const i = counts[style]!++; if (i >= 512) continue;
      const p = this.interp.pos(e);
      const total = Math.max(1, Math.hypot(pr.tx - pr.sx, pr.ty - pr.sy)); const done = Math.min(1, Math.hypot(p.x - pr.sx, p.y - pr.sy) / total);
      const src = sim.get(pr.source); const tgt = sim.get(pr.target);
      const h0 = this.terrain.heightAt(pr.sx, pr.sy) + (src?.kind === 'building' ? 160 : src?.flying ? 230 : 55);
      const h1 = this.terrain.heightAt(pr.tx, pr.ty) + (tgt?.flying ? 230 : 45);
      const arcH = pr.arc * total * 0.9 * 4 * done * (1 - done);
      const y = h0 + (h1 - h0) * done + arcH;
      const slope = pr.arc * total * 0.9 * 4 * (1 - 2 * done) / total - (h1 - h0) / total;
      e3.set(0, p.f, style === 'glaive' ? 0 : Math.atan(-slope) * 0.9); if (style === 'glaive') e3.y = this.time * 20;
      q.setFromEuler(e3); p3.set(p.x, y, -p.y); m4.compose(p3, q, one); mesh.setMatrixAt(i, m4);
      c.set(style === 'arrow' ? '#d8c8a0' : style === 'rock' ? '#8a7a6a' : FX_COLORS[pr.fx] ?? '#9ad0ff'); mesh.setColorAt(i, c);
      if (style === 'orb' && Math.random() < 0.8) this.fx.trail(p.x, y, -p.y, FX_COLORS[pr.fx] ?? '#9ad0ff');
    }
    for (const k in this.projMeshes) { const m = this.projMeshes[k]!; m.count = Math.min(512, counts[k]!); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  private updateBars(): void {
    const mode = this.settings.showBars; const sim = this.sim;
    let n = 0; const m4 = new THREE.Matrix4(); const c = new THREE.Color();
    if (mode !== 'never' || this.altHeld) for (const e of sim.entities) {
      if (!e.alive || e.kind === 'projectile' || n >= 2048) continue;
      const frac = e.hp / e.stats.maxHp;
      if (!(this.altHeld || mode === 'always' || frac < 0.999 || e.id === this.selected || e.hero)) continue;
      if (!this.onScreen(e.x, e.y)) continue;
      const p = this.interp.pos(e);
      const h = e.kind === 'building' ? (this.buildings.get(e.id)?.height ?? 150) * 1.05 : this.units.heightOf(e.def) + 18;
      const y = this.terrain.heightAt(p.x, p.y) + h + (e.flying ? 190 : 0);
      const w = e.kind === 'building' ? Math.min(260, e.radius * 1.6) : Math.max(40, e.radius * 2.2) * (e.hero ? 1.4 : 1);
      m4.makeScale(w, e.kind === 'building' ? 11 : 7.5, 1); m4.setPosition(p.x, y, -p.y);
      this.bars.setMatrixAt(n, m4);
      c.setHSL(0.33 * Math.max(0, Math.min(1, frac)), 0.95, 0.45);
      this.barFill.setXY(n, frac, 0); this.barCol.setXYZ(n, c.r, c.g, c.b);
      n++;
    }
    this.bars.count = n; this.bars.instanceMatrix.needsUpdate = true; this.barFill.needsUpdate = true; this.barCol.needsUpdate = true;
  }

  private updateRings(): void {
    const place = (ring: THREE.Mesh, id: number, color?: string) => {
      const e = id ? this.sim.get(id) : undefined;
      if (!e || !e.alive) { ring.visible = false; return; }
      const p = this.worldPos(e); ring.visible = true; ring.position.set(p.x, p.y + 3, p.z); ring.scale.setScalar(e.radius * 1.25 + 10);
      if (color) (ring.material as THREE.MeshBasicMaterial).color.set(color);
    };
    const sel = this.sim.get(this.selected);
    place(this.selRing, this.selected, sel && sel.owner !== this.localPlayer ? '#ff4040' : '#3cff5a');
    place(this.hoverRing, this.hovered !== this.selected ? this.hovered : 0);
    let n = 0; const m4 = new THREE.Matrix4(); const c = new THREE.Color();
    for (const e of this.sim.entities) {
      if (!e.alive || !e.hero || n >= 64) continue;
      const p = this.worldPos(e); m4.makeScale(e.radius * 1.6, 1, e.radius * 1.6); m4.setPosition(p.x, p.y + 2, p.z);
      this.heroRings.setMatrixAt(n, m4); c.set(this.teamColors[e.owner]!); this.heroRings.setColorAt(n, c); n++;
    }
    this.heroRings.count = n; this.heroRings.instanceMatrix.needsUpdate = true; if (this.heroRings.instanceColor) this.heroRings.instanceColor.needsUpdate = true;
  }
  localPlayer = 0;

  // ------------------------------------------------------------------ picking / projection
  /** Returns the entity under the given screen position (CSS pixels), preferring small targets on top. */
  pick(sx: number, sy: number): number {
    const rect = this.canvas.getBoundingClientRect();
    let best = 0, bestD = Infinity; const v = new THREE.Vector3();
    for (const e of this.sim.entities) {
      if (!e.alive || e.kind === 'projectile' || !this.onScreen(e.x, e.y)) continue;
      const p = this.worldPos(e);
      const h = e.kind === 'building' ? (this.buildings.get(e.id)?.height ?? 120) * 0.45 : this.units.heightOf(e.def) * 0.5;
      v.set(p.x, p.y + h, p.z).project(this.cam.camera);
      if (v.z > 1) continue;
      const x = rect.left + (v.x + 1) / 2 * rect.width, y = rect.top + (1 - v.y) / 2 * rect.height;
      // screen radius from world radius
      const edge = new THREE.Vector3(p.x + (e.kind === 'building' ? e.radius : Math.max(30, e.radius * 1.4)), p.y + h, p.z).project(this.cam.camera);
      const rpx = Math.abs(edge.x - v.x) / 2 * rect.width + 4;
      const d = Math.hypot(sx - x, sy - y);
      const score = d / rpx + (e.kind === 'building' ? 0.35 : 0);
      if (d <= rpx && score < bestD) { bestD = score; best = e.id; }
    }
    return best;
  }

  /** Screen position -> sim ground coordinates. */
  groundAt(sx: number, sy: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.cam.camera);
    const o = ray.ray.origin, d = ray.ray.direction; let t = 0;
    for (let i = 0; i < 80; i++) { const p = o.clone().addScaledVector(d, t); const h = this.terrain.heightAt(p.x, -p.z); if (p.y <= h) break; t += Math.max(10, (p.y - h) * 0.6); }
    const p = o.clone().addScaledVector(d, t);
    return { x: p.x, y: -p.z };
  }

  /** Corners of the camera view on the ground (sim coords) for the minimap. */
  viewCorners(): { x: number; y: number }[] {
    const rect = this.canvas.getBoundingClientRect();
    return [[rect.left, rect.top], [rect.right, rect.top], [rect.right, rect.bottom - rect.height * 0.25], [rect.left, rect.bottom - rect.height * 0.25]].map(([x, y]) => this.groundAt(x!, y!) ?? { x: 0, y: 0 });
  }

  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.cam.camera); const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  }

  setOverlay(kind: 'lanes' | 'ranges', on: boolean): void {
    const name = `overlay-${kind}`; const ex = this.overlays.getObjectByName(name);
    if (ex) { this.overlays.remove(ex); }
    if (!on) return;
    const g = new THREE.Group(); g.name = name;
    if (kind === 'lanes') {
      for (const l of this.sim.map.lanes) {
        const pts = l.points.map(p => new THREE.Vector3(p.x, this.terrain.heightAt(p.x, p.y) + 25, -p.y));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: this.teamColors[l.owner], depthTest: false })));
      }
    } else {
      for (const e of this.sim.entities) if (e.alive && e.kind === 'building' && e.stats.range > 0) {
        const r = new THREE.Mesh(new THREE.RingGeometry(e.stats.range - 6, e.stats.range, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: this.teamColors[e.owner], transparent: true, opacity: 0.5, depthTest: false }));
        r.position.set(e.x, this.terrain.heightAt(e.x, e.y) + 20, -e.y); g.add(r);
      }
    }
    this.overlays.add(g);
  }

  dispose(): void { this.webgl.dispose(); this.composer?.dispose(); }
}
