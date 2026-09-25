import * as THREE from 'three';

/**
 * Warcraft III style camera: fixed pitch, wheel zoom, arrow keys / screen-edge / middle-drag panning,
 * limited rotation, smooth motion. Works in sim coordinates (x, y) for the target.
 */
export class RtsCamera {
  readonly camera: THREE.PerspectiveCamera;
  target = new THREE.Vector2(0, 0);      // sim coords
  private goal = new THREE.Vector2(0, 0);
  dist = 2100; private goalDist = 2100;
  yaw = 0; private goalYaw = 0;
  pitch = 0.95;                           // radians from horizontal
  minDist = 900; maxDist = 4200;
  speed = 1;                              // user setting multiplier
  edgePan = true;
  bounds = 6600;
  private keys = new Set<string>();
  private mouse = { x: -1, y: -1, inside: false };
  private drag: { x: number; y: number; tx: number; ty: number } | null = null;
  heightAt: (x: number, y: number) => number = () => 0;

  constructor(private dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(42, 1, 50, 40000);
    window.addEventListener('keydown', e => { if (!isTyping(e)) this.keys.add(e.key); });
    window.addEventListener('keyup', e => this.keys.delete(e.key));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('wheel', e => { e.preventDefault(); this.goalDist = THREE.MathUtils.clamp(this.goalDist * (e.deltaY > 0 ? 1.12 : 0.89), this.minDist, this.maxDist); }, { passive: false });
    dom.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.drag) { const k = this.dist / 900; const dx = (e.clientX - this.drag.x) * k, dy = (e.clientY - this.drag.y) * k; const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        this.goal.set(this.drag.tx - (dx * c - dy * s), this.drag.ty + (dy * c + dx * s)); this.clampGoal(); } });
    dom.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    dom.addEventListener('mousedown', e => { if (e.button === 1) { e.preventDefault(); this.drag = { x: e.clientX, y: e.clientY, tx: this.goal.x, ty: this.goal.y }; } });
    window.addEventListener('mouseup', e => { if (e.button === 1) this.drag = null; });
  }

  lookAt(x: number, y: number, instant = false): void { this.goal.set(x, y); this.clampGoal(); if (instant) this.target.copy(this.goal); }
  rotate(delta: number): void { this.goalYaw = THREE.MathUtils.clamp(this.goalYaw + delta, -Math.PI, Math.PI); }
  resetRotation(): void { this.goalYaw = 0; }
  setYawInstant(y: number): void { this.goalYaw = this.yaw = y; }
  private clampGoal() { this.goal.x = THREE.MathUtils.clamp(this.goal.x, -this.bounds, this.bounds); this.goal.y = THREE.MathUtils.clamp(this.goal.y, -this.bounds, this.bounds); }

  resize(w: number, h: number): void { this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); }

  update(dt: number, uiBlocksEdge: boolean): void {
    const pan = 2600 * this.speed * dt * (this.dist / 2100);
    let dx = 0, dy = 0;
    if (this.keys.has('ArrowLeft')) dx -= 1; if (this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('ArrowUp')) dy += 1; if (this.keys.has('ArrowDown')) dy -= 1;
    if (this.edgePan && this.mouse.inside && !uiBlocksEdge && !this.drag) {
      const m = 6, w = window.innerWidth, h = window.innerHeight;
      if (this.mouse.x <= m) dx -= 1; if (this.mouse.x >= w - m) dx += 1; if (this.mouse.y <= m) dy += 1; if (this.mouse.y >= h - m) dy -= 1;
    }
    if (dx || dy) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); this.goal.x += (dx * c - dy * s) * pan; this.goal.y += (dy * c + dx * s) * pan; this.clampGoal(); }
    if (this.keys.has('Insert') || this.keys.has('PageUp')) this.rotate(-dt * 1.5);
    if (this.keys.has('Delete') || this.keys.has('PageDown')) this.rotate(dt * 1.5);
    const k = 1 - Math.pow(0.0001, dt);
    this.target.lerp(this.goal, k); this.dist += (this.goalDist - this.dist) * k; this.yaw += (this.goalYaw - this.yaw) * k;
    const groundY = this.heightAt(this.target.x, this.target.y);
    const horiz = Math.cos(this.pitch) * this.dist, up = Math.sin(this.pitch) * this.dist;
    // camera sits "south" of the target (toward -y sim => +z three), rotated by yaw
    const ox = Math.sin(this.yaw) * horiz, oz = Math.cos(this.yaw) * horiz;
    this.camera.position.set(this.target.x + ox, groundY + up, -this.target.y + oz);
    this.camera.lookAt(this.target.x, groundY + 30, -this.target.y);
  }
}

function isTyping(e: KeyboardEvent): boolean { const t = e.target as HTMLElement | null; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }
