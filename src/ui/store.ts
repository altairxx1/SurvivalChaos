import { signal } from '@preact/signals';
import type { GameSession, LobbyConfig } from '../app/GameSession';
import { loadSettings, type Settings } from '../app/settings';
import { AudioEngine } from '../audio/AudioEngine';

export type Screen = 'menu' | 'lobby' | 'game';
export const screen = signal<Screen>('menu');
export const settings = signal<Settings>(loadSettings());
export const session = signal<GameSession | null>(null);
export const uiTick = signal(0);                 // bumped ~10x per second while a game runs
export const selected = signal(0);
export const hovered = signal(0);
export const laneMode = signal<null | { kind: 'hero' | 'special'; id: string }>(null);
export const tooltip = signal<null | { title: string; cost?: string; body: string; req?: string | null; extra?: string }>(null);
export const devOpen = signal(false);
export const spawnAtCursor = signal<null | { unit: string; player: number; count: number }>(null);
export const dialog = signal<null | 'pause' | 'settings' | 'end' | 'help' | 'credits'>(null);
export const lastLobby = signal<LobbyConfig | null>(null);
export const audio = new AudioEngine();

/** Subscribes the calling component to the ~10 Hz HUD refresh. */
export function useUiTick(): number { return uiTick.value; }
