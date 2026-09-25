import * as THREE from 'three';

/**
 * Pooled CPU-simulated particles rendered as one THREE.Points draw call per blend mode.
 * Procedural soft-circle texture, no external assets.
 */
export interface ParticleSpawn {
  x: number; y: number; z: number; vx?: number; vy?: number; vz?: number;
  life: number; size: number; sizeEnd?: number; color: THREE.Color | string; alpha?: number; alphaEnd?: number;
  gravity?: number; drag?: number;
}

let SOFT_TEX: THREE.Texture | null = null;
function softTexture(): THREE.Texture {
  if (SOFT_TEX) return SOFT_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  SOFT_TEX = new THREE.CanvasTexture(c); return SOFT_TEX;
}

export class ParticlePool {
  readonly points: THREE.Points;
  private readonly cap: number;
  private n = 0;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array; private size: Float32Array;
  private life: Float32Array; private maxLife: Float32Array; private s0: Float32Array; private s1: Float32Array; private a0: Float32Array; private a1: Float32Array;
  private grav: Float32Array; private drag: Float32Array; private rgb: Float32Array;
  private geo: THREE.BufferGeometry;
  budgetScale = 1;

  constructor(cap: number, additive: boolean) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    this.life = new Float32Array(cap); this.maxLife = new Float32Array(cap); this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap);
    this.a0 = new Float32Array(cap); this.a1 = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.rgb = new Float32Array(cap * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: softTexture() }, uScale: { value: 800 } },
      vertexShader: `attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec4 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 10 : 9;
  }

  setScale(px: number): void { (this.points.material as THREE.ShaderMaterial).uniforms.uScale!.value = px; }

  spawn(p: ParticleSpawn): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx ?? 0; this.vel[i * 3 + 1] = p.vy ?? 0; this.vel[i * 3 + 2] = p.vz ?? 0;
    this.life[i] = 0; this.maxLife[i] = p.life; this.s0[i] = p.size; this.s1[i] = p.sizeEnd ?? p.size;
    this.a0[i] = p.alpha ?? 1; this.a1[i] = p.alphaEnd ?? 0; this.grav[i] = p.gravity ?? 0; this.drag[i] = p.drag ?? 0;
    const c = typeof p.color === 'string' ? TMP.set(p.color) : p.color; this.rgb[i * 3] = c.r; this.rgb[i * 3 + 1] = c.g; this.rgb[i * 3 + 2] = c.b;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.n) {
      this.life[i]! += dt;
      if (this.life[i]! >= this.maxLife[i]!) { this.swapRemove(i); continue; }
      const t = this.life[i]! / this.maxLife[i]!; const d = 1 - Math.min(1, this.drag[i]! * dt);
      this.vel[i * 3]! *= d; this.vel[i * 3 + 1]! *= d; this.vel[i * 3 + 2]! *= d; this.vel[i * 3 + 1]! -= this.grav[i]! * dt;
      this.pos[i * 3]! += this.vel[i * 3]! * dt; this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt; this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      this.size[i] = this.s0[i]! + (this.s1[i]! - this.s0[i]!) * t;
      this.col[i * 4] = this.rgb[i * 3]!; this.col[i * 4 + 1] = this.rgb[i * 3 + 1]!; this.col[i * 4 + 2] = this.rgb[i * 3 + 2]!;
      this.col[i * 4 + 3] = this.a0[i]! + (this.a1[i]! - this.a0[i]!) * t;
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  private swapRemove(i: number): void {
    const j = --this.n; if (i === j) return;
    const copy = (arr: Float32Array, k: number) => { for (let q = 0; q < k; q++) arr[i * k + q] = arr[j * k + q]!; };
    copy(this.pos, 3); copy(this.vel, 3); copy(this.rgb, 3); copy(this.col, 4);
    for (const a of [this.size, this.life, this.maxLife, this.s0, this.s1, this.a0, this.a1, this.grav, this.drag]) a[i] = a[j]!;
  }
  get count(): number { return this.n; }
}
const TMP = new THREE.Color();
