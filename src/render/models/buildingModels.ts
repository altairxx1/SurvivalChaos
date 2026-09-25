import * as THREE from 'three';
import type { BuildingKind, RaceDef } from '../../sim/defs/types';
import { mergeColored } from '../terrain/Terrain';

/**
 * Procedural low-poly buildings. Four architectural styles (stone / hut / crypt / tree) are coloured
 * by the race pack's buildingStyle. Team-coloured banners and glowing accents use separate materials.
 */
type Style = RaceDef['buildingStyle'];
interface Part { geo: THREE.BufferGeometry; color: string }

const B = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const Cy = (rt: number, rb: number, h: number, x = 0, y = 0, z = 0, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s).translate(x, y + h / 2, z);
const Co = (r: number, h: number, x = 0, y = 0, z = 0, s = 8) => new THREE.ConeGeometry(r, h, s).translate(x, y + h / 2, z);
const Sp = (r: number, x = 0, y = 0, z = 0, d = 1) => new THREE.IcosahedronGeometry(r, d).translate(x, y, z);
/** Gable roof: ridge along X of length len, height h, spanning width wid along Z (with a small overhang). */
const prism = (len: number, h: number, wid: number, x = 0, y = 0, z = 0) => {
  const sh = new THREE.Shape(); sh.moveTo(-wid / 2, 0); sh.lineTo(wid / 2, 0); sh.lineTo(0, h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x - len / 2, y, z); return g;
};

function tower(st: Style, r: number, h: number, x: number, z: number, parts: Part[]) {
  if (st.shape === 'tree') { parts.push({ geo: Cy(r * 0.7, r, h, x, 0, z, 7), color: '#6a5038' }, { geo: Sp(r * 1.6, x, h + r * 0.6, z, 0), color: '#4a7a3a' }); return; }
  if (st.shape === 'hut') { parts.push({ geo: Cy(r * 0.9, r * 1.1, h, x, 0, z, 6), color: st.wall }, { geo: Co(r * 1.5, r * 1.6, x, h, z, 6), color: st.roof }); for (let k = 0; k < 4; k++) parts.push({ geo: Co(4, 30, x + Math.cos(k * 1.57) * r * 1.2, h + 10, z + Math.sin(k * 1.57) * r * 1.2, 4), color: '#e8e0c8' }); return; }
  parts.push({ geo: Cy(r, r * 1.1, h, x, 0, z, st.shape === 'crypt' ? 5 : 8), color: st.wall });
  parts.push({ geo: Cy(r * 1.2, r * 1.2, 12, x, h, z, st.shape === 'crypt' ? 5 : 8), color: st.trim });
  parts.push({ geo: Co(r * 1.25, r * (st.shape === 'crypt' ? 3 : 2), x, h + 12, z, st.shape === 'crypt' ? 5 : 8), color: st.roof });
}

export function buildBuildingModel(kind: BuildingKind, st: Style, radius: number): { group: THREE.Group; height: number; banners: THREE.Vector3[]; glows: THREE.Vector3[] } {
  const parts: Part[] = []; const banners: THREE.Vector3[] = []; const glows: THREE.Vector3[] = [];
  const r = radius; let height = 100;
  const wall = st.wall, roof = st.roof, trim = st.trim;
  const base = (w: number, d: number, h = 18) => parts.push({ geo: B(w, h, d), color: st.shape === 'tree' ? '#5a4a36' : '#7b7466' });
  switch (kind) {
    case 'fortress': {
      base(r * 2.1, r * 2.1, 24);
      if (st.shape === 'tree') {
        parts.push({ geo: Cy(r * 0.45, r * 0.65, r * 1.7, 0, 20, 0, 9), color: '#6a5038' }, { geo: Sp(r * 0.95, 0, r * 2.05, 0, 1), color: '#4f3f8a' }, { geo: Sp(r * 0.6, r * 0.5, r * 1.7, r * 0.3, 0), color: '#5a7a3a' });
        for (const [x, z] of [[r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) parts.push({ geo: Cy(18, 26, r * 0.5, x!, 20, z!, 6), color: '#6a5038' });
        height = r * 2.9; glows.push(new THREE.Vector3(0, r * 1.2, 0));
      } else {
        const keepH = st.shape === 'hut' ? r * 0.9 : r * 1.25;
        parts.push({ geo: st.shape === 'hut' ? Cy(r * 0.75, r * 0.85, keepH, 0, 20, 0, 7) : B(r * 1.25, keepH, r * 1.25, 0, 20, 0), color: wall });
        parts.push({ geo: st.shape === 'hut' ? Co(r * 1.05, r * 0.9, 0, 20 + keepH, 0, 7) : Co(r * 0.95, r * 0.9, 0, 20 + keepH, 0, 4), color: roof });
        if (st.shape !== 'hut') for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; parts.push({ geo: B(22, 22, 22, Math.cos(a) * r * 0.62, 20 + keepH, Math.sin(a) * r * 0.62), color: trim }); }
        for (const [x, z] of [[r * 0.82, r * 0.82], [-r * 0.82, r * 0.82], [r * 0.82, -r * 0.82], [-r * 0.82, -r * 0.82]]) tower(st, r * 0.22, r * 1.1, x!, z!, parts);
        parts.push({ geo: B(r * 1.6, r * 0.45, 14, 0, 20, r * 0.82), color: wall }, { geo: B(r * 1.6, r * 0.45, 14, 0, 20, -r * 0.82), color: wall }, { geo: B(14, r * 0.45, r * 1.6, r * 0.82, 20, 0), color: wall }, { geo: B(14, r * 0.45, r * 1.6, -r * 0.82, 20, 0), color: wall });
        height = 20 + keepH + r * 0.9;
        glows.push(new THREE.Vector3(r * 0.63, r * 0.45, 0));
      }
      banners.push(new THREE.Vector3(0, height + 10, 0), new THREE.Vector3(r * 0.82, r * 1.6, r * 0.82), new THREE.Vector3(-r * 0.82, r * 1.6, -r * 0.82));
      break;
    }
    case 'barracks': {
      base(r * 1.9, r * 1.4);
      if (st.shape === 'tree') { parts.push({ geo: Cy(r * 0.35, r * 0.55, r * 1.2, 0, 18, 0, 7), color: '#6a5038' }, { geo: Sp(r * 0.8, 0, r * 1.5, 0, 0), color: '#5a4a9a' }); height = r * 2.2; }
      else if (st.shape === 'hut') { parts.push({ geo: Cy(r * 0.75, r * 0.85, r * 0.6, 0, 18, 0, 6), color: wall }, { geo: Co(r * 1.1, r * 0.9, 0, 18 + r * 0.6, 0, 6), color: roof }); height = r * 1.6; }
      else { parts.push({ geo: B(r * 1.6, r * 0.65, r * 1.05, 0, 18, 0), color: wall }, { geo: prism(r * 1.75, r * 0.6, r * 1.2, 0, 18 + r * 0.65, 0), color: roof }, { geo: B(12, r * 0.4, r * 0.35, r * 0.8, 18, 0), color: '#3a2a1a' }); height = r * 1.5; }
      banners.push(new THREE.Vector3(r * 0.85, r * 1.1, r * 0.5), new THREE.Vector3(r * 0.85, r * 1.1, -r * 0.5));
      break;
    }
    case 'tower': {
      base(r * 1.5, r * 1.5, 12);
      tower(st, r * 0.55, r * 3.2, 0, 0, parts);
      height = r * 4.8; glows.push(new THREE.Vector3(0, r * 3.5, 0));
      banners.push(new THREE.Vector3(0, r * 4.6, 0));
      break;
    }
    case 'altar': {
      parts.push({ geo: Cy(r * 0.95, r * 1.05, 20, 0, 0, 0, 8), color: '#7b7466' }, { geo: Cy(r * 0.7, r * 0.8, 20, 0, 20, 0, 8), color: wall }, { geo: Cy(r * 0.45, r * 0.55, 20, 0, 40, 0, 8), color: trim });
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.78; parts.push({ geo: B(18, r * 0.9, 18, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8), color: wall }); }
      height = r * 1.3; glows.push(new THREE.Vector3(0, 95, 0)); banners.push(new THREE.Vector3(r * 0.8, r * 1.0, r * 0.8));
      break;
    }
    case 'forge': {
      base(r * 1.7, r * 1.5);
      parts.push({ geo: st.shape === 'tree' ? Cy(r * 0.5, r * 0.7, r * 0.8, 0, 18, 0, 7) : B(r * 1.3, r * 0.6, r * 1.1, 0, 18, 0), color: st.shape === 'tree' ? '#6a5038' : wall });
      parts.push({ geo: st.shape === 'hut' || st.shape === 'tree' ? Co(r * 0.95, r * 0.6, 0, 18 + r * (st.shape === 'tree' ? 0.8 : 0.6), 0, 6) : prism(r * 1.45, r * 0.5, r * 1.25, 0, 18 + r * 0.6, 0), color: roof });
      parts.push({ geo: B(r * 0.28, r * 1.3, r * 0.28, -r * 0.4, 18, -r * 0.35), color: '#5a524a' });
      parts.push({ geo: B(30, 18, 18, r * 0.8, 18, r * 0.3), color: '#3a3a3a' });
      height = r * 1.5; glows.push(new THREE.Vector3(r * 0.66, 30, 0)); banners.push(new THREE.Vector3(r * 0.7, r * 1.2, -r * 0.6));
      break;
    }
    case 'sanctum': {
      base(r * 1.6, r * 1.6);
      parts.push({ geo: Cy(r * 0.65, r * 0.75, r * 0.8, 0, 18, 0, 10), color: wall }, { geo: new THREE.SphereGeometry(r * 0.66, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 18 + r * 0.8, 0), color: roof });
      parts.push({ geo: Co(8, r * 0.6, 0, 18 + r * 1.4, 0, 6), color: trim });
      height = r * 2.1; glows.push(new THREE.Vector3(0, r * 2.1, 0)); banners.push(new THREE.Vector3(r * 0.7, r * 1.1, r * 0.4));
      break;
    }
    case 'goldAltar': {
      parts.push({ geo: Cy(r * 0.9, r, 22, 0, 0, 0, 8), color: '#7b7466' }, { geo: Cy(r * 0.6, r * 0.7, 26, 0, 22, 0, 8), color: trim });
      for (let k = 0; k < 7; k++) parts.push({ geo: Sp(14 + (k % 3) * 4, Math.cos(k) * r * 0.35, 58 + (k % 2) * 12, Math.sin(k) * r * 0.35, 0), color: '#e8c040' });
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; parts.push({ geo: B(16, r * 0.8, 16, Math.cos(a) * r * 0.85, 0, Math.sin(a) * r * 0.85), color: wall }); }
      height = r * 1.1; glows.push(new THREE.Vector3(0, 75, 0)); banners.push(new THREE.Vector3(r * 0.85, r * 0.9, 0));
      break;
    }
    case 'mercCamp': {
      base(r * 1.9, r * 1.9, 8);
      for (const [x, z, s] of [[0, 0, 1], [r * 0.55, r * 0.45, 0.7], [-r * 0.5, r * 0.5, 0.65], [r * 0.4, -r * 0.55, 0.75]] as const) parts.push({ geo: Co(r * 0.5 * s, r * 0.9 * s, x, 8, z, 6), color: s === 1 ? roof : '#9a8a6a' });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; parts.push({ geo: B(6, 40, 6, Math.cos(a) * r * 0.95, 8, Math.sin(a) * r * 0.95), color: '#6a4a2a' }); }
      height = r * 1.2; glows.push(new THREE.Vector3(-r * 0.2, 20, -r * 0.3)); banners.push(new THREE.Vector3(0, r * 1.0, 0));
      break;
    }
  }
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(mergeColored(parts), BUILDING_MAT);
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  return { group, height, banners, glows };
}

export const BUILDING_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: true });
const bannerGeo = new THREE.PlaneGeometry(26, 40).translate(13, -20, 0);
const poleGeo = new THREE.CylinderGeometry(2, 2, 60, 5).translate(0, -10, 0);
const poleMat = new THREE.MeshStandardMaterial({ color: '#5a4228' });

export function addBanners(group: THREE.Group, points: THREE.Vector3[], color: string): THREE.Mesh[] {
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8, emissive: color, emissiveIntensity: 0.15 });
  const out: THREE.Mesh[] = [];
  for (const p of points) {
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.copy(p).add(new THREE.Vector3(0, 20, 0)); group.add(pole);
    const b = new THREE.Mesh(bannerGeo, mat); b.position.copy(p).add(new THREE.Vector3(0, 48, 0)); b.castShadow = true; group.add(b); out.push(b);
  }
  return out;
}

export function addGlows(group: THREE.Group, points: THREE.Vector3[], color: string): THREE.Mesh[] {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5 });
  return points.map(p => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(12, 0), mat); m.position.copy(p); group.add(m); return m; });
}
