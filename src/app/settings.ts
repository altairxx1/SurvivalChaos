import type { Quality } from '../render/Renderer';
import type { AudioSettings } from '../audio/AudioEngine';

export interface Settings {
  quality: Quality; pixelRatio: number; showBars: 'always' | 'damaged' | 'never';
  audio: AudioSettings; cameraSpeed: number; edgePan: boolean; gridHotkeys: boolean; showFps: boolean; playerName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'high', pixelRatio: 1.5, showBars: 'damaged', audio: { master: 0.8, music: 0.45, sfx: 0.7, ui: 0.7 },
  cameraSpeed: 1, edgePan: true, gridHotkeys: false, showFps: true, playerName: 'Player',
};

const KEY = 'survivalchaos.settings.v1';
export function loadSettings(): Settings {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw), audio: { ...DEFAULT_SETTINGS.audio, ...JSON.parse(raw).audio } }; } catch { /* storage unavailable */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings): void { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
