import * as THREE from 'three';
import type { MapRuntime, Vec2 } from '../../sim/map/MapRuntime';
import { MapRuntime as MR } from '../../sim/map/MapRuntime';

/**
 * Procedural terrain built from the lane/base layout: flat dirt lanes, paved base plateaus,
 * a stone plaza in the middle, forested hills between lanes, ponds and a cliff border.
 * When the real war3map.w3e heightmap is extracted it replaces heightField() and colorAt().
 */

// ---- small deterministic value noise (render only)
function hash2(x: number, y: number): number { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 4): number { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); a *= 0.5; f *= 2.03; } return s; }

export interface TerrainInfo {
  size: number; res: number; heights: Float32Array;
  lanes: Vec2[][]; bases: { x: number; y: number; ux: number; uy: number }[]; ponds: Vec2[];
  heightAt(x: number, y: number): number;
  laneDist(x: number, y: number): number;
  baseDist(x: number, y: number): number;
}

const ROAD = 170, ROAD_BLEND = 320, PLAZA = 760, WATER_LEVEL = -30;

export function buildTerrainInfo(map: MapRuntime): TerrainInfo {
  const H = map.half; const res = 257; const size = H * 2 + 1200; // extra border outside the playable area
  const lanes = dedupeLanes(map);
  const bases = map.layout.slots.map(s => { const o = map.world(s, 400, 0); const f = map.world(s, 1, 0); return { x: o.x, y: o.y, ux: f.x - map.world(s, 0, 0).x, uy: f.y - map.world(s, 0, 0).y }; });
  const q = H * 0.42; const ponds: Vec2[] = [{ x: q, y: q }, { x: -q, y: q }, { x: q, y: -q }, { x: -q, y: -q }];
  const laneDist = (x: number, y: number) => { let d = Infinity; for (const l of lanes) d = Math.min(d, MR.distToPath(l, x, y)); return d; };
  const baseDist = (x: number, y: number) => {
    let d = Infinity;
    for (const b of bases) { const dx = x - b.x, dy = y - b.y; const u = dx * b.ux + dy * b.uy; const v = -dx * b.uy + dy * b.ux; const e = Math.sqrt((u / 1500) ** 2 + (v / 2250) ** 2); d = Math.min(d, (e - 1) * 1500); }
    return d;
  };
  const heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = -size / 2 + (i / (res - 1)) * size, y = -size / 2 + (j / (res - 1)) * size;
    heights[j * res + i] = rawHeight(x, y, H, laneDist(x, y), baseDist(x, y), ponds);
  }
  const heightAt = (x: number, y: number) => {
    const fx = ((x + size / 2) / size) * (res - 1), fy = ((y + size / 2) / size) * (res - 1);
    const i = Math.max(0, Math.min(res - 2, Math.floor(fx))), j = Math.max(0, Math.min(res - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - i)), ty = Math.min(1, Math.max(0, fy - j));
    const a = heights[j * res + i]!, b = heights[j * res + i + 1]!, c = heights[(j + 1) * res + i]!, d = heights[(j + 1) * res + i + 1]!;
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return { size, res, heights, lanes, bases, ponds, heightAt, laneDist, baseDist };
}

function dedupeLanes(map: MapRuntime): Vec2[][] {
  const out: Vec2[][] = [];
  for (const l of map.lanes) {
    const pts = l.points.slice(0, -1); // skip final segment into the fortress (inside base)
    const key = (p: Vec2[]) => p.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).sort().join('|');
    if (!out.some(o => key(o) === key(pts))) out.push(pts);
  }
  return out;
}

function rawHeight(x: number, y: number, H: number, ld: number, bd: number, ponds: Vec2[]): number {
  const n = fbm(x / 1400, y / 1400, 4);
  let h = (n - 0.45) * 260 + fbm(x / 350 + 11, y / 350 + 7, 2) * 40;
  // hills rise away from lanes
  const away = Math.min(1, Math.max(0, (ld - ROAD) / 900));
  h = h * away + 20 * away;
  // flat lanes, plateaus, plaza
  if (ld < ROAD_BLEND) { const t = smooth(Math.max(0, (ld - ROAD) / (ROAD_BLEND - ROAD))); h = h * t; }
  if (bd < 400) { const t = smooth(Math.max(0, Math.min(1, bd / 400))); h = h * t + 8 * (1 - t); }
  const r = Math.sqrt(x * x + y * y);
  if (r < PLAZA + 300) { const t = smooth(Math.max(0, (r - PLAZA) / 300)); h = h * t; }
  for (const p of ponds) { const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2); if (d < 750) { const t = smooth(1 - d / 750); h = h * (1 - t) - 140 * t; } }
  // cliff border
  const edge = Math.max(Math.abs(x), Math.abs(y)) - (H - 120);
  if (edge > 0) h += Math.min(1, edge / 250) * (420 + fbm(x / 300, y / 300) * 200);
  return h;
}

const C = (hex: string) => new THREE.Color(hex);
const GRASS_A = C('#4f7a2c'), GRASS_B = C('#6c8f35'), GRASS_DARK = C('#35591f'), DIRT = C('#8a6a43'), DIRT_DARK = C('#6e5334');
const STONE = C('#8d8474'), STONE_DARK = C('#6d6558'), ROCK = C('#6f6a62'), SAND = C('#b8a577'), PLAZA_C = C('#9a9180');

export function buildTerrainMesh(info: TerrainInfo): THREE.Mesh {
  const { size, res, heights } = info;
  const geo = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
  geo.rotateX(-Math.PI / 2); // plane now in XZ with +Z = -y(sim)
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3); const col = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = -pos.getZ(k);
    const i = Math.round(((x + size / 2) / size) * (res - 1)), j = Math.round(((y + size / 2) / size) * (res - 1));
    const h = heights[j * res + i]!; pos.setY(k, h);
    colorAt(info, x, y, h, col);
    colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // slope-based rock colouring (after normals)
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    const slope = 1 - nrm.getY(k);
    if (slope > 0.18) { const t = Math.min(1, (slope - 0.18) * 3); colors[k * 3] = colors[k * 3]! * (1 - t) + ROCK.r * t; colors[k * 3 + 1] = colors[k * 3 + 1]! * (1 - t) + ROCK.g * t; colors[k * 3 + 2] = colors[k * 3 + 2]! * (1 - t) + ROCK.b * t; }
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: detailTexture() });
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.name = 'terrain';
  return mesh;
}

function colorAt(info: TerrainInfo, x: number, y: number, h: number, out: THREE.Color): void {
  const n = fbm(x / 500, y / 500, 3), n2 = noise2(x / 90, y / 90);
  out.copy(GRASS_A).lerp(GRASS_B, n).lerp(GRASS_DARK, Math.max(0, n2 - 0.6));
  const ld = info.laneDist(x, y);
  if (ld < ROAD + 90) { const t = smooth(Math.min(1, Math.max(0, (ROAD + 90 - ld) / 150))); out.lerp(n2 > 0.5 ? DIRT : DIRT_DARK, t * 0.95); }
  const bd = info.baseDist(x, y);
  if (bd < 60) { const t = smooth(Math.min(1, (60 - bd) / 200)); out.lerp(n2 > 0.45 ? STONE : STONE_DARK, t * 0.85); }
  const r = Math.sqrt(x * x + y * y);
  if (r < PLAZA) { const ring = Math.abs(((r / 120) % 1) - 0.5) < 0.06 ? STONE_DARK : PLAZA_C; out.lerp(ring, smooth(Math.min(1, (PLAZA - r) / 120))); }
  if (h < WATER_LEVEL + 25) out.lerp(SAND, Math.min(1, (WATER_LEVEL + 25 - h) / 40));
}

function detailTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = 200 + Math.floor((noise2((i % 256) / 6, Math.floor(i / 256) / 6) * 0.6 + hash2(i, 7) * 0.4) * 55); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWater(info: TerrainInfo): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(info.size, info.size, 1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#2e6f8e', transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.2, emissive: '#0b2a3a', emissiveIntensity: 0.4 });
  const m = new THREE.Mesh(geo, mat); m.position.y = WATER_LEVEL; m.name = 'water'; m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ doodads
function mergeColored(parts: { geo: THREE.BufferGeometry; color: string }[]): THREE.BufferGeometry {
  const geos = parts.map(p => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo; const c = new THREE.Color(p.color); const n = g.attributes.position!.count;
    const arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv'); return g;
  });
  let total = 0; for (const g of geos) total += g.attributes.position!.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position!.array as Float32Array, o * 3); nor.set(g.attributes.normal!.array as Float32Array, o * 3); col.set(g.attributes.color!.array as Float32Array, o * 3); o += g.attributes.position!.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
export { mergeColored };

function pineGeo() {
  const trunk = new THREE.CylinderGeometry(9, 13, 70, 6); trunk.translate(0, 35, 0);
  const c1 = new THREE.ConeGeometry(75, 130, 7); c1.translate(0, 120, 0);
  const c2 = new THREE.ConeGeometry(58, 110, 7); c2.translate(0, 185, 0);
  const c3 = new THREE.ConeGeometry(38, 90, 7); c3.translate(0, 240, 0);
  return mergeColored([{ geo: trunk, color: '#5a3d22' }, { geo: c1, color: '#2f5a2a' }, { geo: c2, color: '#386a30' }, { geo: c3, color: '#437a36' }]);
}
function oakGeo() {
  const trunk = new THREE.CylinderGeometry(11, 16, 90, 6); trunk.translate(0, 45, 0);
  const b1 = new THREE.IcosahedronGeometry(80, 0); b1.translate(0, 150, 0);
  const b2 = new THREE.IcosahedronGeometry(60, 0); b2.translate(45, 120, 25);
  const b3 = new THREE.IcosahedronGeometry(55, 0); b3.translate(-40, 125, -30);
  return mergeColored([{ geo: trunk, color: '#5e4127' }, { geo: b1, color: '#4f7d2e' }, { geo: b2, color: '#5b8a33' }, { geo: b3, color: '#46732a' }]);
}
function rockGeo() { const r = new THREE.DodecahedronGeometry(40, 0); r.scale(1.3, 0.8, 1); r.translate(0, 15, 0); return mergeColored([{ geo: r, color: '#7d776d' }]); }

export function buildDoodads(info: TerrainInfo, quality: 'low' | 'medium' | 'high'): THREE.Group {
  const group = new THREE.Group(); group.name = 'doodads';
  const H = info.size / 2 - 600;
  const trees: { x: number; y: number; s: number; r: number; t: number }[] = [];
  const rocks: { x: number; y: number; s: number; r: number }[] = [];
  const step = quality === 'low' ? 230 : 170;
  for (let y = -H - 400; y < H + 400; y += step) for (let x = -H - 400; x < H + 400; x += step) {
    const jx = x + (hash2(x, y) - 0.5) * step * 0.9, jy = y + (hash2(y, x) - 0.5) * step * 0.9;
    const ld = info.laneDist(jx, jy), bd = info.baseDist(jx, jy); const r = Math.sqrt(jx * jx + jy * jy);
    const h = info.heightAt(jx, jy);
    if (h < -20) continue;
    if (ld < 380 || bd < 250 || r < 1300) { if (ld > 260 && ld < 420 && hash2(jx, 3) < 0.05 && bd > 100) rocks.push({ x: jx, y: jy, s: 0.6 + hash2(jx, jy) * 0.9, r: hash2(jy, 1) * 6.28 }); continue; }
    if (fbm(jx / 900, jy / 900, 2) < 0.34 && ld > 700) continue; // clearings
    trees.push({ x: jx, y: jy, s: 0.8 + hash2(jx, 9) * 0.6, r: hash2(jy, 5) * 6.28, t: hash2(jx, jy) < 0.62 ? 0 : 1 });
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const geos = [pineGeo(), oakGeo()];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
  for (let t = 0; t < 2; t++) {
    const list = trees.filter(tr => tr.t === t);
    const im = new THREE.InstancedMesh(geos[t]!, mat, list.length);
    list.forEach((tr, i) => {
      q.setFromAxisAngle(up, tr.r); s.setScalar(tr.s); p.set(tr.x, info.heightAt(tr.x, tr.y) - 4, -tr.y);
      m4.compose(p, q, s); im.setMatrixAt(i, m4);
      tint.setHSL(0.25 + hash2(tr.x, 2) * 0.08, 0.35, 0.45 + hash2(tr.y, 4) * 0.25); im.setColorAt(i, tint);
    });
    im.castShadow = quality === 'high'; im.receiveShadow = false; im.name = t === 0 ? 'pines' : 'oaks';
    im.computeBoundingSphere();
    group.add(im);
  }
  const rim = new THREE.InstancedMesh(rockGeo(), mat, rocks.length);
  rocks.forEach((rk, i) => { q.setFromAxisAngle(up, rk.r); s.setScalar(rk.s); p.set(rk.x, info.heightAt(rk.x, rk.y), -rk.y); m4.compose(p, q, s); rim.setMatrixAt(i, m4); });
  rim.castShadow = true; group.add(rim);
  group.add(buildPlazaRuins(info));
  return group;
}

/** Ancient stone circle in the contested middle and obelisks at the lane corners. */
function buildPlazaRuins(info: TerrainInfo): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#8c8577', roughness: 0.85, flatShading: true });
  const rune = new THREE.MeshStandardMaterial({ color: '#6fd0ff', emissive: '#3fa8ff', emissiveIntensity: 2.2 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8; const r = 640;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(60, 260 - (k % 3) * 70, 60), stone);
    pillar.position.set(Math.cos(a) * r, (260 - (k % 3) * 70) / 2 - 5, -Math.sin(a) * r); pillar.rotation.y = -a; pillar.castShadow = true;
    g.add(pillar);
    if (k % 2 === 0) { const cap = new THREE.Mesh(new THREE.BoxGeometry(80, 22, 80), stone); cap.position.set(pillar.position.x, 262 - (k % 3) * 70, pillar.position.z); cap.castShadow = true; g.add(cap); }
  }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(150, 170, 16, 16), stone); disc.position.y = 4; disc.receiveShadow = true; g.add(disc);
  const glyph = new THREE.Mesh(new THREE.TorusGeometry(110, 6, 6, 32), rune); glyph.rotation.x = Math.PI / 2; glyph.position.y = 14; g.add(glyph);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(38, 0), rune); crystal.position.y = 90; crystal.name = 'centerCrystal'; g.add(crystal);
  for (const l of info.lanes) if (l.length >= 3) {
    const c = l[1]!; if (Math.abs(c.x) < 100 && Math.abs(c.y) < 100) continue;
    const ob = new THREE.Mesh(new THREE.ConeGeometry(45, 320, 4), stone); ob.position.set(c.x * 1.06, info.heightAt(c.x, c.y) + 160, -c.y * 1.06); ob.castShadow = true; g.add(ob);
  }
  return g;
}

/** Top-down colour image of the terrain for the minimap (sim +y is up). */
export function minimapImage(info: TerrainInfo, size: number, half: number): ImageData {
  const img = new ImageData(size, size); const c = new THREE.Color();
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = -half + (px + 0.5) / size * half * 2, y = half - (py + 0.5) / size * half * 2;
    const h = info.heightAt(x, y);
    colorAt(info, x, y, h, c);
    if (h < WATER_LEVEL) c.set('#2e6f8e');
    const shade = 0.85 + Math.max(-0.2, Math.min(0.3, h / 800));
    const i = (py * size + px) * 4;
    img.data[i] = Math.min(255, c.r * 255 * shade); img.data[i + 1] = Math.min(255, c.g * 255 * shade); img.data[i + 2] = Math.min(255, c.b * 255 * shade); img.data[i + 3] = 255;
  }
  return img;
}
