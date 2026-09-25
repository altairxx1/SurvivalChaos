/**
 * WebAudio engine. Every sound is synthesized in code (no assets required); if a CC0/CC-BY file is listed in
 * public/assets/manifest.json under the same id it is used instead (see tools/assets/fetch-assets.mjs).
 */
export type SfxId = 'sword' | 'blunt' | 'arrow' | 'magic' | 'fire' | 'frost' | 'lightning' | 'holy' | 'explosion' | 'death' | 'deathBig' | 'collapse'
  | 'click' | 'error' | 'research' | 'gold' | 'hero' | 'levelup' | 'wave' | 'warn' | 'victory' | 'defeat' | 'item' | 'queue';

export interface AudioSettings { master: number; music: number; sfx: number; ui: number }

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode; private musicBus!: GainNode; private sfxBus!: GainNode; private uiBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private buffers = new Map<string, AudioBuffer>();
  private last = new Map<string, number>();
  private counts = new Map<string, number>();
  settings: AudioSettings = { master: 0.8, music: 0.5, sfx: 0.7, ui: 0.7 };
  listener = { x: 0, y: 0, zoom: 2100 };
  music: MusicEngine | null = null;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const ctx = new AudioContext(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(comp);
    this.uiBus = ctx.createGain(); this.uiBus.connect(comp);
    const len = ctx.sampleRate; this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply(this.settings);
    this.music = new MusicEngine(ctx, this.musicBus, this.noiseBuf);
    void this.loadManifest();
  }

  apply(s: AudioSettings): void {
    this.settings = s; if (!this.ctx) return;
    this.master.gain.value = s.master; this.musicBus.gain.value = s.music * 0.55; this.sfxBus.gain.value = s.sfx; this.uiBus.gain.value = s.ui;
  }

  private async loadManifest(): Promise<void> {
    try {
      const r = await fetch('assets/manifest.json'); if (!r.ok) return;
      const m = await r.json() as { entries: { id: string; kind: string; file?: string }[] };
      for (const e of m.entries) if (e.kind === 'audio' && e.file) {
        try { const a = await fetch(`assets/${e.file}`); if (!a.ok) continue; this.buffers.set(e.id, await this.ctx!.decodeAudioData(await a.arrayBuffer())); } catch { /* optional asset missing */ }
      }
      const tracks = m.entries.filter(e => e.kind === 'audio' && e.id.startsWith('music.')).map(e => this.buffers.get(e.id)).filter((b): b is AudioBuffer => !!b);
      if (tracks.length && this.music) this.music.tracks = tracks;
    } catch { /* no manifest: synth only */ }
  }

  /** Plays a sound; x/y in sim coords for positional attenuation (omit for UI sounds). */
  play(id: SfxId, pos?: { x: number; y: number }, vol = 1): void {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // throttle: at most 4 of the same sound per 80ms
    const lt = this.last.get(id) ?? 0;
    if (now - lt < 0.08) { const c = (this.counts.get(id) ?? 0) + 1; this.counts.set(id, c); if (c > 3) return; } else { this.last.set(id, now); this.counts.set(id, 0); }
    let gain = vol, pan = 0;
    if (pos) {
      const dx = pos.x - this.listener.x, dy = pos.y - this.listener.y; const d = Math.hypot(dx, dy);
      const range = 1400 + this.listener.zoom * 0.9; if (d > range) return;
      gain *= (1 - d / range) ** 1.5 * (2100 / Math.max(1500, this.listener.zoom)); pan = Math.max(-1, Math.min(1, dx / range));
    }
    const out = ctx.createGain(); out.gain.value = gain;
    const panner = ctx.createStereoPanner(); panner.pan.value = pan; out.connect(panner);
    const ui = !pos && ['click', 'error', 'research', 'gold', 'hero', 'levelup', 'wave', 'warn', 'victory', 'defeat', 'item', 'queue'].includes(id);
    panner.connect(ui ? this.uiBus : this.sfxBus);
    const file = this.buffers.get(`sfx.${id}`);
    if (file) { const s = ctx.createBufferSource(); s.buffer = file; s.playbackRate.value = 0.94 + Math.random() * 0.12; s.connect(out); s.start(); return; }
    SYNTH[id](ctx, out, now, this.noiseBuf);
  }
}

// ---------------------------------------------------------------------------------------- synth recipes
type Recipe = (ctx: AudioContext, out: AudioNode, t: number, noise: AudioBuffer) => void;
function env(ctx: AudioContext, t: number, a: number, peak: number, d: number): GainNode { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); return g; }
function noise(ctx: AudioContext, buf: AudioBuffer, t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, out: AudioNode, a = 0.002): void {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = env(ctx, t, a, peak, dur); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
}
function tone(ctx: AudioContext, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, out: AudioNode, a = 0.005): void {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + dur);
  const g = env(ctx, t, a, peak, dur); o.connect(g).connect(out); o.start(t); o.stop(t + a + dur + 0.05);
}
const R = (a: number, b: number) => a + Math.random() * (b - a);
const SYNTH: Record<SfxId, Recipe> = {
  sword: (c, o, t, n) => { noise(c, n, t, 0.09, 'bandpass', R(2400, 3600), 3, 0.5, o); tone(c, t, 'triangle', R(1700, 2300), 1400, 0.18, 0.08, o); },
  blunt: (c, o, t, n) => { noise(c, n, t, 0.12, 'lowpass', 600, 1, 0.7, o); tone(c, t, 'sine', 140, 60, 0.12, 0.4, o); },
  arrow: (c, o, t, n) => { noise(c, n, t, 0.07, 'highpass', 3500, 1, 0.25, o); tone(c, t, 'sine', 900, 300, 0.06, 0.05, o); },
  magic: (c, o, t) => { tone(c, t, 'sine', R(500, 700), 1400, 0.25, 0.15, o, 0.02); tone(c, t + 0.03, 'triangle', 1400, 2200, 0.2, 0.05, o, 0.02); },
  fire: (c, o, t, n) => { noise(c, n, t, 0.45, 'lowpass', 900, 0.7, 0.55, o, 0.04); tone(c, t, 'sawtooth', 120, 60, 0.3, 0.06, o); },
  frost: (c, o, t, n) => { noise(c, n, t, 0.4, 'highpass', 5000, 2, 0.3, o, 0.01); for (let i = 0; i < 4; i++) tone(c, t + i * 0.04, 'sine', 2400 + i * 400, 3000, 0.12, 0.05, o); },
  lightning: (c, o, t, n) => { for (let i = 0; i < 6; i++) noise(c, n, t + i * 0.035, 0.05, 'bandpass', R(1500, 5000), 1, 0.5, o); tone(c, t, 'sawtooth', 90, 40, 0.4, 0.12, o); },
  holy: (c, o, t) => { [523, 659, 784, 1046].forEach((f, i) => tone(c, t + i * 0.05, 'sine', f, f, 0.8, 0.07, o, 0.05)); },
  explosion: (c, o, t, n) => { noise(c, n, t, 1.2, 'lowpass', 400, 0.8, 1, o, 0.005); tone(c, t, 'sine', 90, 30, 0.8, 0.8, o); },
  death: (c, o, t) => { tone(c, t, 'sawtooth', R(220, 320), 90, 0.3, 0.12, o, 0.01); },
  deathBig: (c, o, t, n) => { tone(c, t, 'sawtooth', 160, 45, 0.6, 0.2, o, 0.02); noise(c, n, t, 0.4, 'lowpass', 500, 1, 0.4, o); },
  collapse: (c, o, t, n) => { noise(c, n, t, 2.5, 'lowpass', 250, 0.6, 1, o, 0.05); for (let i = 0; i < 5; i++) noise(c, n, t + R(0.1, 1.6), 0.2, 'bandpass', R(300, 900), 2, 0.4, o); },
  click: (c, o, t) => tone(c, t, 'square', 1200, 900, 0.03, 0.08, o, 0.001),
  queue: (c, o, t) => { tone(c, t, 'triangle', 700, 700, 0.06, 0.12, o); tone(c, t + 0.06, 'triangle', 940, 940, 0.08, 0.12, o); },
  error: (c, o, t) => { tone(c, t, 'square', 180, 150, 0.18, 0.12, o); },
  research: (c, o, t) => { [659, 784, 988].forEach((f, i) => tone(c, t + i * 0.09, 'triangle', f, f, 0.3, 0.15, o)); },
  gold: (c, o, t) => { tone(c, t, 'sine', 1800, 1800, 0.08, 0.1, o); tone(c, t + 0.06, 'sine', 2400, 2400, 0.12, 0.1, o); },
  hero: (c, o, t) => { [262, 330, 392, 523].forEach(f => tone(c, t, 'sawtooth', f, f, 1.2, 0.05, o, 0.08)); },
  levelup: (c, o, t) => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, t + i * 0.07, 'triangle', f, f, 0.25, 0.12, o)); },
  item: (c, o, t) => { [880, 1318, 1760].forEach((f, i) => tone(c, t + i * 0.05, 'sine', f, f, 0.3, 0.1, o)); },
  wave: (c, o, t, n) => { noise(c, n, t, 0.25, 'lowpass', 200, 1, 0.4, o); tone(c, t, 'sine', 70, 50, 0.3, 0.4, o); },
  warn: (c, o, t) => { tone(c, t, 'square', 440, 440, 0.12, 0.1, o); tone(c, t + 0.18, 'square', 440, 440, 0.12, 0.1, o); },
  victory: (c, o, t) => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(c, t + i * 0.16, 'sawtooth', f, f, 0.6, 0.08, o, 0.02)); },
  defeat: (c, o, t) => { [392, 349, 311, 262].forEach((f, i) => tone(c, t + i * 0.3, 'sawtooth', f, f * 0.98, 0.8, 0.08, o, 0.03)); },
};

// ---------------------------------------------------------------------------------------- generative music
/** A small step sequencer producing a looping fantasy war theme: pads, bass, taiko drums, pentatonic flute. */
export class MusicEngine {
  private next = 0; private step = 0; private timer: number | null = null; private mode: 'menu' | 'battle' | 'off' = 'off';
  tracks: AudioBuffer[] = []; private trackSrc: AudioBufferSourceNode | null = null; private trackIdx = 0;
  intensity = 0.3;
  private readonly bpm = 84;
  private readonly chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [50, 53, 57], [53, 57, 60], [52, 56, 59], [57, 60, 64]]; // Am F C G Dm F E Am
  private readonly scale = [57, 60, 62, 64, 67, 69, 72, 74, 76];
  constructor(private ctx: AudioContext, private out: AudioNode, private noiseBuf: AudioBuffer) {}

  play(mode: 'menu' | 'battle'): void {
    if (this.mode === mode) return; this.mode = mode;
    if (this.tracks.length) { this.playTrack(); return; }
    if (this.timer === null) { this.next = this.ctx.currentTime + 0.1; this.timer = window.setInterval(() => this.schedule(), 100); }
  }
  stop(): void { this.mode = 'off'; if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } this.trackSrc?.stop(); this.trackSrc = null; }

  private playTrack(): void {
    this.trackSrc?.stop(); const s = this.ctx.createBufferSource(); s.buffer = this.tracks[this.trackIdx++ % this.tracks.length]!; s.connect(this.out); s.start();
    s.onended = () => { if (this.mode !== 'off' && this.trackSrc === s) this.playTrack(); }; this.trackSrc = s;
  }

  private schedule(): void {
    const spb = 60 / this.bpm / 2; // eighth notes
    while (this.next < this.ctx.currentTime + 0.3) { this.playStep(this.step, this.next, spb); this.next += spb; this.step++; }
  }

  private playStep(s: number, t: number, spb: number): void {
    const bar = Math.floor(s / 16) % this.chords.length; const pos = s % 16; const chord = this.chords[bar]!;
    const battle = this.mode === 'battle';
    if (pos === 0) for (const n of chord) this.pad(midi(n), t, spb * 16);
    if (pos % 4 === 0) this.bass(midi(chord[0]! - 12), t, spb * 3);
    if (battle) {
      if ([0, 3, 6, 8, 10].includes(pos) && (pos !== 10 || this.intensity > 0.5)) this.drum(t, pos === 0 || pos === 8 ? 1 : 0.6);
      if ((pos === 4 || pos === 12) && this.intensity > 0.25) this.snare(t);
    }
    const density = battle ? 0.28 + this.intensity * 0.2 : 0.18;
    if (pos % 2 === 0 && Math.random() < density) { const n = this.scale[Math.floor(Math.random() * this.scale.length)]!; this.flute(midi(n + 12), t, spb * (Math.random() < 0.3 ? 4 : 2)); }
  }

  private pad(f: number, t: number, d: number): void {
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 1.2); g.gain.linearRampToValueAtTime(0, t + d + 0.8);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; g.connect(lp).connect(this.out);
    for (const det of [-7, 7]) { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(g); o.start(t); o.stop(t + d + 1); }
  }
  private bass(f: number, t: number, d: number): void { const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = env(this.ctx, t, 0.02, 0.18, d); o.connect(g).connect(this.out); o.start(t); o.stop(t + d + 0.1); }
  private drum(t: number, v: number): void { tone(this.ctx, t, 'sine', 110, 42, 0.35, 0.5 * v, this.out, 0.002); noise(this.ctx, this.noiseBuf, t, 0.08, 'lowpass', 300, 1, 0.25 * v, this.out); }
  private snare(t: number): void { noise(this.ctx, this.noiseBuf, t, 0.14, 'bandpass', 1800, 0.8, 0.18, this.out); }
  private flute(f: number, t: number, d: number): void {
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const vib = this.ctx.createOscillator(); vib.frequency.value = 5; const vg = this.ctx.createGain(); vg.gain.value = f * 0.008; vib.connect(vg).connect(o.frequency);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.08); g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(g).connect(this.out); o.start(t); vib.start(t); o.stop(t + d + 0.05); vib.stop(t + d + 0.05);
  }
}
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
