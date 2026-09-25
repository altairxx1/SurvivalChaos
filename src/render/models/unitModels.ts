import * as THREE from 'three';
import type { ModelSpec } from '../../sim/defs/types';

/**
 * Procedural stylised low-poly unit models (CC0, generated in code).
 * Every vertex carries: color, aTeam (1 = team coloured), aPart (animation group), aPivot (joint), aGlow (emissive).
 * Parts: 0 static, 1/2 legs, 3 weapon arm, 4 off arm, 5/6 mount legs (front/back), 7 wings, 8 tail/head bob.
 * Model forward is +X, up is +Y, right-hand side is +Z.
 */
export const PART = { STATIC: 0, LEG_L: 1, LEG_R: 2, ARM_W: 3, ARM_O: 4, MLEG_F: 5, MLEG_B: 6, WING: 7, BOB: 8 } as const;
type Col = string;
interface Piece { geo: THREE.BufferGeometry; color: Col; team?: boolean; part?: number; pivot?: [number, number, number]; glow?: number }

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 6) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); return g; };
const cone = (r: number, h: number, x: number, y: number, z: number, seg = 6) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(x, y, z); return g; };
const ball = (r: number, x: number, y: number, z: number, detail = 0) => { const g = new THREE.IcosahedronGeometry(r, detail); g.translate(x, y, z); return g; };
const rotZ = (g: THREE.BufferGeometry, a: number, px = 0, py = 0, pz = 0) => { g.translate(-px, -py, -pz); g.rotateZ(a); g.translate(px, py, pz); return g; };
const rotX = (g: THREE.BufferGeometry, a: number, px = 0, py = 0, pz = 0) => { g.translate(-px, -py, -pz); g.rotateX(a); g.translate(px, py, pz); return g; };

const METAL = '#b9c0c8', WOOD = '#7a5532', DARKW = '#4a3320', BONE = '#e2dac2';

function weaponPieces(kind: ModelSpec['weapon'], hx: number, hy: number, hz: number, part: number, pivot: [number, number, number], s: ModelSpec): Piece[] {
  const P = (geo: THREE.BufferGeometry, color: Col, glow = 0): Piece => ({ geo, color, part, pivot, glow });
  switch (kind) {
    case 'sword': return [P(box(4, 44, 3, hx + 2, hy + 22, hz), METAL), P(box(4, 3, 14, hx + 2, hy + 1, hz), s.accent)];
    case 'axe': return [P(box(4, 50, 4, hx, hy + 20, hz), WOOD), P(box(18, 20, 3, hx + 9, hy + 40, hz), METAL)];
    case 'hammer': return [P(box(4, 55, 4, hx, hy + 22, hz), WOOD), P(box(22, 16, 16, hx, hy + 50, hz), METAL)];
    case 'spear': return [P(rotZ(cyl(2, 2, 120, hx, hy, hz), -Math.PI / 2 + 0.3, hx, hy, hz), WOOD), P(rotZ(cone(5, 18, hx, hy + 68, hz), -Math.PI / 2 + 0.3, hx, hy, hz), METAL)];
    case 'staff': return [P(box(4, 80, 4, hx, hy + 18, hz), DARKW), P(ball(8, hx, hy + 62, hz, 1), s.glow ?? '#9ad8ff', 2.5)];
    case 'glaive': return [P(box(3, 30, 3, hx, hy + 10, hz), DARKW), P(rotX(new THREE.TorusGeometry(14, 2.5, 4, 10).translate(hx, hy + 30, hz), 0, hx, hy + 30, hz), METAL)];
    case 'scythe': return [P(box(4, 70, 4, hx, hy + 25, hz), DARKW), P(box(30, 4, 3, hx + 14, hy + 58, hz), METAL)];
    case 'claws': return [P(cone(3, 16, hx + 6, hy - 4, hz + 3), BONE), P(cone(3, 16, hx + 6, hy - 4, hz - 3), BONE)];
    case 'bow': return [];
    default: return [];
  }
}

/** Humanoid rider/body; returns pieces. yBase is the hip height. */
function humanoid(s: ModelSpec, opt: { yBase: number; bulk: number; legs: boolean; robe?: boolean; skinHead?: boolean; hunch?: number; bone?: boolean }): Piece[] {
  const b = opt.bulk; const y0 = opt.yBase; const body = opt.bone ? BONE : s.body; const skin = s.skin ?? (opt.bone ? BONE : '#e0b890');
  const pcs: Piece[] = [];
  if (opt.legs) {
    pcs.push({ geo: box(10 * b, y0, 10 * b, 0, y0 / 2, 8 * b), color: s.accent, part: PART.LEG_R, pivot: [0, y0, 8 * b] });
    pcs.push({ geo: box(10 * b, y0, 10 * b, 0, y0 / 2, -8 * b), color: s.accent, part: PART.LEG_L, pivot: [0, y0, -8 * b] });
  }
  if (opt.robe) pcs.push({ geo: cone(20 * b, y0 + 18, 0, (y0 + 18) / 2, 0, 7), color: body });
  const hunch = opt.hunch ?? 0;
  const tors = box(22 * b, 30 * b, 26 * b, hunch * 10, y0 + 15 * b, 0); if (hunch) rotZ(tors, -hunch * 0.5, 0, y0, 0);
  pcs.push({ geo: tors, color: body });
  pcs.push({ geo: box(3, 22 * b, 16 * b, 11.5 * b + hunch * 10, y0 + 13 * b, 0), color: s.body, team: true });   // tabard
  const headY = y0 + 30 * b + 9 * b - hunch * 8; const headX = hunch * 22;
  pcs.push({ geo: ball(9 * b, headX, headY, 0, 1), color: skin });
  if (!opt.bone && !opt.robe) pcs.push({ geo: cyl(9.5 * b, 10 * b, 7 * b, headX, headY + 4 * b, 0, 7), color: s.accent });
  if (opt.robe) pcs.push({ geo: cone(11 * b, 18 * b, headX, headY + 9 * b, 0, 6), color: s.body, team: true });
  if (s.horns) { pcs.push({ geo: rotZ(cone(3 * b, 16 * b, headX, headY + 12 * b, 8 * b), -0.5, headX, headY, 8 * b), color: BONE }); pcs.push({ geo: rotZ(cone(3 * b, 16 * b, headX, headY + 12 * b, -8 * b), -0.5, headX, headY, -8 * b), color: BONE }); }
  // arms
  const sy = y0 + 27 * b; const armLen = 26 * b;
  const wPivot: [number, number, number] = [hunch * 8, sy, 17 * b]; const oPivot: [number, number, number] = [hunch * 8, sy, -17 * b];
  pcs.push({ geo: box(8 * b, armLen, 8 * b, hunch * 8, sy - armLen / 2, 17 * b), color: opt.bone ? BONE : skin, part: PART.ARM_W, pivot: wPivot });
  pcs.push({ geo: box(8 * b, armLen, 8 * b, hunch * 8, sy - armLen / 2, -17 * b), color: opt.bone ? BONE : skin, part: PART.ARM_O, pivot: oPivot });
  pcs.push({ geo: box(12 * b, 8 * b, 12 * b, hunch * 8, sy, 15 * b), color: s.accent });
  pcs.push({ geo: box(12 * b, 8 * b, 12 * b, hunch * 8, sy, -15 * b), color: s.accent });
  pcs.push(...weaponPieces(s.weapon, hunch * 8 + 4, sy - armLen, 17 * b, PART.ARM_W, wPivot, s));
  if (s.shield) pcs.push({ geo: box(4, 30 * b, 24 * b, hunch * 8 + 4, sy - armLen + 4, -22 * b), color: s.body, team: true, part: PART.ARM_O, pivot: oPivot });
  if (s.weapon === 'bow') pcs.push({ geo: new THREE.TorusGeometry(26 * b, 1.6, 3, 10, Math.PI).rotateZ(-Math.PI / 2).translate(hunch * 8 + 6, sy - armLen + 4, -20 * b), color: WOOD, part: PART.ARM_O, pivot: oPivot });
  return pcs;
}

function quadruped(opt: { len: number; h: number; w: number; color: Col; accent: Col; head: Col; legLen: number; horns?: boolean; tail?: boolean }): Piece[] {
  const { len, h, w, legLen } = opt; const pcs: Piece[] = [];
  pcs.push({ geo: box(len, h, w, 0, legLen + h / 2, 0), color: opt.color });
  pcs.push({ geo: box(len * 0.6, h * 0.35, w + 2, -len * 0.05, legLen + h * 0.85, 0), color: opt.accent, team: true }); // saddle cloth
  pcs.push({ geo: rotZ(box(h * 0.55, h * 0.9, w * 0.55, len / 2 + 6, legLen + h * 0.9, 0), -0.6, len / 2, legLen + h * 0.6, 0), color: opt.color });
  pcs.push({ geo: box(h * 0.8, h * 0.5, w * 0.5, len / 2 + h * 0.55, legLen + h * 1.25, 0), color: opt.head, part: PART.BOB, pivot: [len / 2, legLen + h, 0] });
  if (opt.horns) { pcs.push({ geo: rotZ(cone(3, 18, len / 2 + h * 0.6, legLen + h * 1.6, 8), -0.4), color: BONE }); pcs.push({ geo: rotZ(cone(3, 18, len / 2 + h * 0.6, legLen + h * 1.6, -8), -0.4), color: BONE }); }
  const lw = Math.max(7, w * 0.22);
  for (const [lx, part] of [[len / 2 - lw, PART.MLEG_F], [-len / 2 + lw, PART.MLEG_B]] as const) for (const z of [w / 2 - lw / 2, -w / 2 + lw / 2]) {
    pcs.push({ geo: box(lw, legLen, lw, lx, legLen / 2, z), color: opt.color, part: z > 0 ? part : (part === PART.MLEG_F ? PART.MLEG_B : PART.MLEG_F), pivot: [lx, legLen, z] });
  }
  if (opt.tail !== false) pcs.push({ geo: rotZ(box(len * 0.35, 5, 5, -len / 2 - len * 0.15, legLen + h * 0.8, 0), 0.5, -len / 2, legLen + h * 0.8, 0), color: opt.color });
  return pcs;
}

function wings(span: number, x: number, y: number, color: Col, membrane: Col): Piece[] {
  const make = (side: number): Piece[] => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([x + 20, y, side * 6, x - 25, y, side * 6, x - 5, y + 10, side * span, x + 20, y, side * 6, x - 5, y + 10, side * span, x + 30, y + 14, side * span * 0.8,
      x - 25, y, side * 6, x + 20, y, side * 6, x - 5, y + 10, side * span, x + 20, y, side * 6, x + 30, y + 14, side * span * 0.8, x - 5, y + 10, side * span]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3)); g.computeVertexNormals();
    return [{ geo: g, color: membrane, part: PART.WING, pivot: [x, y, side * 6] }, { geo: box(8, 6, span, x + 10, y + 5, side * span / 2), color, part: PART.WING, pivot: [x, y, side * 6] }];
  };
  return [...make(1), ...make(-1)];
}

export function buildModelPieces(s: ModelSpec): Piece[] {
  switch (s.arch) {
    case 'infantry': return humanoid(s, { yBase: 34, bulk: 1, legs: true });
    case 'spearman': return humanoid({ ...s }, { yBase: 36, bulk: 1.05, legs: true });
    case 'archer': return humanoid(s, { yBase: 34, bulk: 0.9, legs: true });
    case 'caster': return humanoid(s, { yBase: 30, bulk: 0.95, legs: false, robe: true });
    case 'brute': return humanoid({ ...s, skin: s.skin ?? '#5f8f3a' }, { yBase: 32, bulk: 1.25, legs: true });
    case 'ghoul': return humanoid({ ...s, skin: s.body }, { yBase: 26, bulk: 1, legs: true, hunch: 1 });
    case 'skeleton': return humanoid(s, { yBase: 32, bulk: 0.85, legs: true, bone: true });
    case 'hero': return [...humanoid(s, { yBase: 36, bulk: 1.15, legs: true, robe: s.weapon === 'staff' }),
      { geo: box(3, 44, 30, -14, 58, 0), color: s.body, team: true },
      { geo: ball(6, 0, 110, 0, 0), color: s.glow ?? '#ffe08a', glow: 3 }];
    case 'giant': return humanoid({ ...s, skin: s.skin ?? s.body }, { yBase: 40, bulk: 1.7, legs: true });
    case 'cavalry': case 'wolfrider': {
      const wolf = s.arch === 'wolfrider';
      const mount = quadruped({ len: wolf ? 70 : 84, h: wolf ? 30 : 36, w: wolf ? 26 : 30, color: wolf ? '#6a6a6a' : '#6e4b2e', accent: s.body, head: wolf ? '#5a5a5a' : '#5e3f25', legLen: wolf ? 30 : 42 });
      const riderY = (wolf ? 30 : 42) + (wolf ? 30 : 36) - 6;
      const rider = humanoid(s, { yBase: 0, bulk: 1, legs: false }).map(p => ({ ...p, geo: p.geo.translate(-6, riderY, 0), pivot: p.pivot ? [p.pivot[0] - 6, p.pivot[1] + riderY, p.pivot[2]] as [number, number, number] : undefined }));
      return [...mount, ...rider];
    }
    case 'beast': return quadruped({ len: 90, h: 44, w: 44, color: s.body, accent: s.accent, head: s.body, legLen: 36, horns: true });
    case 'fiend': {
      const pcs: Piece[] = [{ geo: ball(26, -22, 40, 0, 1).scale(1, 0.8, 1), color: s.body }, { geo: box(26, 34, 22, 14, 50, 0), color: s.body }, { geo: ball(10, 26, 72, 0, 0), color: s.accent }];
      for (let k = 0; k < 3; k++) for (const side of [1, -1]) {
        const lx = -14 + k * 18; const part = (k + (side > 0 ? 0 : 1)) % 2 === 0 ? PART.LEG_L : PART.LEG_R;
        pcs.push({ geo: rotX(box(5, 50, 5, lx, 25, side * 22), side * 0.6, lx, 45, side * 12), color: s.accent, part, pivot: [lx, 45, side * 12] });
      }
      pcs.push({ geo: box(4, 4, 30, 14, 60, 0), color: s.body, team: true });
      return pcs;
    }
    case 'treant': {
      const pcs: Piece[] = [{ geo: cyl(14, 20, 70, 0, 45, 0, 7), color: '#5a4228' }, { geo: ball(40, 0, 100, 0, 0), color: s.accent }, { geo: ball(28, 18, 118, 12, 0), color: s.accent }, { geo: box(4, 20, 20, 16, 55, 0), color: s.body, team: true }];
      pcs.push({ geo: box(12, 34, 12, 0, 17, 10), color: '#5a4228', part: PART.LEG_R, pivot: [0, 34, 10] }, { geo: box(12, 34, 12, 0, 17, -10), color: '#5a4228', part: PART.LEG_L, pivot: [0, 34, -10] });
      pcs.push({ geo: rotX(box(8, 44, 8, 0, 60, 26), -0.5, 0, 80, 18), color: '#5a4228', part: PART.ARM_W, pivot: [0, 80, 18] }, { geo: rotX(box(8, 44, 8, 0, 60, -26), 0.5, 0, 80, -18), color: '#5a4228', part: PART.ARM_O, pivot: [0, 80, -18] });
      return pcs;
    }
    case 'siege': {
      const pcs: Piece[] = [{ geo: box(80, 16, 46, 0, 26, 0), color: s.body }, { geo: box(60, 6, 50, 0, 36, 0), color: s.accent, team: true }];
      for (const x of [-28, 28]) for (const z of [-26, 26]) pcs.push({ geo: rotX(cyl(15, 15, 6, x, 15, z, 8), Math.PI / 2, x, 15, z), color: DARKW });
      pcs.push({ geo: box(8, 60, 8, -10, 60, 0), color: WOOD, part: PART.ARM_W, pivot: [-10, 36, 0] }, { geo: box(18, 10, 18, -10, 90, 0), color: '#5a5a5a', part: PART.ARM_W, pivot: [-10, 36, 0] });
      return pcs;
    }
    case 'flyer': {
      const mount = quadruped({ len: 70, h: 32, w: 30, color: s.body, accent: s.accent, head: '#f0e6d0', legLen: 22 });
      const rider = humanoid({ ...s, body: s.accent }, { yBase: 0, bulk: 0.9, legs: false }).map(p => ({ ...p, geo: p.geo.translate(-6, 48, 0), pivot: p.pivot ? [p.pivot[0] - 6, p.pivot[1] + 48, p.pivot[2]] as [number, number, number] : undefined }));
      return [...mount, ...rider, ...wings(90, 0, 50, s.body, '#d8c8a8')];
    }
    case 'dragon': {
      const body: Piece[] = [{ geo: ball(34, 0, 60, 0, 1).scale(1.6, 0.8, 0.9), color: s.body }, { geo: box(12, 12, 40, 0, 72, 0), color: s.accent, team: true },
        { geo: rotZ(box(60, 14, 14, 60, 80, 0), 0.5, 40, 70, 0), color: s.body }, { geo: box(34, 18, 20, 95, 100, 0), color: s.body, part: PART.BOB, pivot: [80, 95, 0] },
        { geo: rotZ(box(90, 10, 10, -90, 55, 0), -0.2, -50, 60, 0), color: s.body }, { geo: ball(5, 110, 106, 8), color: s.glow ?? '#ff0', glow: 3 }, { geo: ball(5, 110, 106, -8), color: s.glow ?? '#ff0', glow: 3 }];
      body.push({ geo: box(10, 40, 10, 20, 20, 16), color: s.body, part: PART.MLEG_F, pivot: [20, 40, 16] }, { geo: box(10, 40, 10, -20, 20, -16), color: s.body, part: PART.MLEG_B, pivot: [-20, 40, -16] });
      return [...body, ...wings(130, 0, 75, s.accent, s.accent)];
    }
  }
}

/** Global model scale so units read well at the default RTS camera distance. */
export const UNIT_SCALE = 1.3;

export interface ModelGeometry { geometry: THREE.BufferGeometry; height: number; }

export function buildUnitGeometry(spec: ModelSpec): ModelGeometry {
  const pieces = buildModelPieces(spec);
  let total = 0;
  const prepared = pieces.map(p => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo; if (!g.attributes.normal) g.computeVertexNormals(); total += g.attributes.position!.count; return { p, g }; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  const team = new Float32Array(total), part = new Float32Array(total), pivot = new Float32Array(total * 3), glow = new Float32Array(total);
  let o = 0; const c = new THREE.Color();
  for (const { p, g } of prepared) {
    const n = g.attributes.position!.count;
    pos.set(g.attributes.position!.array as Float32Array, o * 3); nor.set(g.attributes.normal!.array as Float32Array, o * 3);
    c.set(p.color);
    for (let i = 0; i < n; i++) {
      const k = o + i; col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      team[k] = p.team ? 1 : 0; part[k] = p.part ?? 0; glow[k] = p.glow ?? 0;
      pivot[k * 3] = p.pivot?.[0] ?? 0; pivot[k * 3 + 1] = p.pivot?.[1] ?? 0; pivot[k * 3 + 2] = p.pivot?.[2] ?? 0;
    }
    o += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aTeam', new THREE.BufferAttribute(team, 1));
  geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1)); geo.setAttribute('aPivot', new THREE.BufferAttribute(pivot, 3));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  geo.computeBoundingBox();
  const s = spec.scale * UNIT_SCALE; geo.scale(s, s, s);
  // pivots must follow scale
  const pv = geo.attributes.aPivot as THREE.BufferAttribute; for (let i = 0; i < pv.count; i++) pv.setXYZ(i, pv.getX(i) * s, pv.getY(i) * s, pv.getZ(i) * s);
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return { geometry: geo, height: geo.boundingBox!.max.y };
}

/** Material with GPU procedural animation, team colour and hit flash via instanced attributes. */
export function createUnitMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1, flatShading: true });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aTeam; attribute float aPart; attribute vec3 aPivot; attribute float aGlow;
        attribute vec4 aAnim; attribute vec3 aTeamColor;
        varying float vGlow;
        vec3 rotAroundZ(vec3 p, vec3 pv, float a){ vec3 q=p-pv; float c=cos(a), s=sin(a); return vec3(q.x*c-q.y*s, q.x*s+q.y*c, q.z)+pv; }
        vec3 rotAroundX(vec3 p, vec3 pv, float a){ vec3 q=p-pv; float c=cos(a), s=sin(a); return vec3(q.x, q.y*c-q.z*s, q.y*s+q.z*c)+pv; }
        vec3 animate(vec3 p){
          float st = aAnim.x; float t = aAnim.y; float sp = aAnim.z; int part = int(aPart+0.5);
          bool walk = st > 0.5 && st < 1.5; bool atk = st > 1.5 && st < 2.5; bool casting = st > 2.5 && st < 3.5;
          float w = t*9.0*sp;
          if (part==1) p = rotAroundZ(p, aPivot, walk ? sin(w)*0.6 : 0.0);
          if (part==2) p = rotAroundZ(p, aPivot, walk ? -sin(w)*0.6 : 0.0);
          if (part==5) p = rotAroundZ(p, aPivot, walk ? sin(w*1.3)*0.7 : 0.0);
          if (part==6) p = rotAroundZ(p, aPivot, walk ? -sin(w*1.3)*0.7 : 0.0);
          if (part==3) { float a = walk ? -sin(w)*0.45 : 0.0; if (atk) { float k = clamp(t*sp*2.6,0.0,1.0); a = -1.9*sin(k*3.14159)+0.3*k; } if (casting) a = -2.4*min(1.0,t*4.0); p = rotAroundZ(p, aPivot, a); }
          if (part==4) { float a = walk ? sin(w)*0.45 : 0.0; if (casting) a = -2.2*min(1.0,t*4.0); p = rotAroundZ(p, aPivot, a); }
          if (part==7) { float f = sin(t*6.0)*0.55 + 0.1; p = rotAroundX(p, aPivot, aPivot.z > 0.0 ? f : -f); }
          if (part==8) p.y += walk ? sin(w*2.0)*1.5 : sin(t*2.0)*0.8;
          if (walk) p.y += abs(sin(w))*2.5;
          if (atk && part==0) { float k = clamp(t*sp*2.6,0.0,1.0); p.x += sin(k*3.14159)*5.0; }
          return p;
        }`)
      .replace('#include <begin_vertex>', `vec3 transformed = animate(vec3(position));`)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = vec3(normal);`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        vColor.rgb = mix(vColor.rgb, aTeamColor, aTeam);
        vColor.rgb = mix(vColor.rgb, vec3(1.0,0.95,0.9), aAnim.w*0.65);
        vGlow = aGlow;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * vGlow;`);
  };
  return mat;
}
