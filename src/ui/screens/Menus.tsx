import { useState } from 'preact/hooks';
import { dialog, lastLobby, screen, settings, audio } from '../store';
import { RACES, ROSTER } from '../../data';
import { GAME_MODES } from '../../data/shared';
import type { LobbyConfig, LobbySlot } from '../../app/GameSession';
import { saveSettings, type Settings } from '../../app/settings';
import { PLAYER_COLORS } from '../../sim/Simulation';
import type { Difficulty } from '../../ai/Bot';

export function MainMenu({ onStart }: { onStart: (cfg: LobbyConfig) => void }) {
  return (
    <div class="menu-screen">
      <div>
        <div class="title">Survival Chaos</div>
        <div class="subtitle">Be the last one standing in this battle madness</div>
        <div class="panel menu-box">
          <button class="btn primary" onClick={() => { audio.play('click'); screen.value = 'lobby'; }}>Single Player</button>
          <button class="btn" onClick={() => { audio.play('click'); onStart(quickConfig()); }}>Quick Start (You vs 3 Bots)</button>
          <button class="btn" disabled title="Planned: LAN lockstep multiplayer">LAN Multiplayer (coming soon)</button>
          <button class="btn" onClick={() => { audio.play('click'); dialog.value = 'settings'; }}>Options</button>
          <button class="btn" onClick={() => { audio.play('click'); dialog.value = 'help'; }}>How to Play</button>
          <button class="btn" onClick={() => { audio.play('click'); dialog.value = 'credits'; }}>Credits</button>
        </div>
      </div>
      <div class="version">Standalone remake of Survival Chaos by Sur5al · build {__BUILD__}</div>
    </div>
  );
}
declare const __BUILD__: string;

export function quickConfig(): LobbyConfig {
  return lastLobby.value ?? {
    mode: 'standard', seed: Math.floor(Math.random() * 1e9),
    slots: [
      { name: settings.value.playerName || 'Player', controller: 'human', raceId: 'random', difficulty: 'normal' },
      { name: 'Computer (Normal)', controller: 'bot', raceId: 'random', difficulty: 'normal' },
      { name: 'Computer (Normal)', controller: 'bot', raceId: 'random', difficulty: 'normal' },
      { name: 'Computer (Normal)', controller: 'bot', raceId: 'random', difficulty: 'normal' },
    ],
  };
}

const SLOT_NAMES = ['West', 'North', 'East', 'South'];
export function Lobby({ onStart }: { onStart: (cfg: LobbyConfig) => void }) {
  const [cfg, setCfg] = useState<LobbyConfig>(() => structuredClone(quickConfig()));
  const [info, setInfo] = useState<string>('lordaeron');
  const set = (i: number, patch: Partial<LobbySlot>) => { const s = cfg.slots.map((x, k) => k === i ? { ...x, ...patch } : x); setCfg({ ...cfg, slots: s }); };
  const race = RACES.find(r => r.id === info);
  const humans = cfg.slots.filter(s => s.controller === 'human').length;
  const active = cfg.slots.filter(s => s.controller !== 'none').length;
  return (
    <div class="menu-screen">
      <div class="panel lobby">
        <h2>Game Lobby</h2>
        {cfg.slots.map((s, i) => (
          <div class="slot">
            <div class="swatch" style={{ background: PLAYER_COLORS[i] }} title={SLOT_NAMES[i]} />
            <input type="text" value={s.name} onInput={e => set(i, { name: (e.target as HTMLInputElement).value })} />
            <select value={s.controller} onChange={e => { const c = (e.target as HTMLSelectElement).value as LobbySlot['controller']; set(i, { controller: c, name: c === 'bot' ? `Computer (${cap(s.difficulty)})` : c === 'human' ? (settings.value.playerName || 'Player') : 'Closed' }); }}>
              <option value="human" disabled={humans >= 1 && s.controller !== 'human'}>Human (you)</option>
              <option value="bot">Computer</option>
              <option value="none">Closed</option>
            </select>
            <select value={s.raceId} disabled={s.controller === 'none'} onChange={e => { const r = (e.target as HTMLSelectElement).value; set(i, { raceId: r }); if (r !== 'random') setInfo(r); }}>
              <option value="random">Random</option>
              {ROSTER.map(r => { const ok = RACES.some(x => x.id === r.id); return <option value={r.id} disabled={!ok}>{r.name}{ok ? '' : ' (soon)'}</option>; })}
            </select>
            <select value={s.difficulty} disabled={s.controller !== 'bot'} onChange={e => { const d = (e.target as HTMLSelectElement).value as Difficulty; set(i, { difficulty: d, name: s.controller === 'bot' ? `Computer (${cap(d)})` : s.name }); }}>
              {(['easy', 'normal', 'hard', 'insane'] as Difficulty[]).map(d => <option value={d}>{cap(d)}</option>)}
            </select>
          </div>
        ))}
        <div class="row" style={{ marginTop: '12px' }}>
          <label>Game mode</label>
          <select value={cfg.mode} onChange={e => setCfg({ ...cfg, mode: (e.target as HTMLSelectElement).value })}>
            {Object.values(GAME_MODES).map(m => <option value={m.id}>{m.name}</option>)}
          </select>
          <label>Seed</label>
          <input type="number" value={cfg.seed} style={{ width: '130px' }} onInput={e => setCfg({ ...cfg, seed: Number((e.target as HTMLInputElement).value) || 0 })} />
          <button class="btn small" onClick={() => setCfg({ ...cfg, seed: Math.floor(Math.random() * 1e9) })}>🎲</button>
        </div>
        <h3 style={{ marginTop: '16px' }}>Races</h3>
        <div class="race-grid">
          {(['alliance', 'horde', 'chaos', 'independent'] as const).map(f => (
            <div class="faction"><h4>{f}</h4>
              {ROSTER.filter(r => r.faction === f).map(r => { const ok = RACES.some(x => x.id === r.id);
                return <button class={`race-chip ${ok ? '' : 'soon'} ${info === r.id ? 'sel' : ''}`} onClick={() => ok && setInfo(r.id)} title={ok ? '' : 'Race pack not implemented yet'}>{r.name}{ok ? '' : ' · soon'}</button>; })}
            </div>
          ))}
        </div>
        <div class="race-info">
          {race ? <>
            <b style={{ color: race.color }}>{race.name}</b> <span style={{ color: 'var(--muted)' }}>({race.faction})</span> — {race.description}
            <div style={{ marginTop: '4px', color: 'var(--muted)' }}>{race.bonuses.join(' · ')}</div>
            <div style={{ marginTop: '4px' }}>Heroes: {race.heroes.map(h => h.name).join(', ')} · Specials: {race.specials.map(s => race.units.find(u => u.id === s.unit)?.name).join(', ')}</div>
          </> : 'Select a race to see its details.'}
        </div>
        <div class="row" style={{ marginTop: '16px' }}>
          <button class="btn" onClick={() => { screen.value = 'menu'; }}>Back</button>
          <div class="spacer" />
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{active < 2 ? 'At least 2 players are required' : humans === 0 ? 'Spectator game (all computers)' : ''}</span>
          <button class="btn primary" disabled={active < 2} onClick={() => { lastLobby.value = cfg; onStart(cfg); }}>Start Game</button>
        </div>
      </div>
    </div>
  );
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function SettingsPanel({ onApply }: { onApply?: (s: Settings) => void }) {
  const [s, setS] = useState<Settings>(structuredClone(settings.value));
  const upd = (p: Partial<Settings>) => setS({ ...s, ...p });
  const updA = (k: keyof Settings['audio'], v: number) => setS({ ...s, audio: { ...s.audio, [k]: v } });
  const apply = () => { settings.value = s; saveSettings(s); audio.apply(s.audio); onApply?.(s); dialog.value = null; };
  return (
    <div class="overlay" onClick={e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      <div class="panel dialog">
        <h2>Options</h2>
        <div class="settings-grid">
          <label>Player name</label><input type="text" value={s.playerName} onInput={e => upd({ playerName: (e.target as HTMLInputElement).value })} />
          <label>Graphics quality</label>
          <select value={s.quality} onChange={e => upd({ quality: (e.target as HTMLSelectElement).value as Settings['quality'] })}><option value="low">Low (no shadows/bloom)</option><option value="medium">Medium</option><option value="high">High</option></select>
          <label>Resolution scale</label><input type="range" min={0.5} max={2} step={0.25} value={s.pixelRatio} onInput={e => upd({ pixelRatio: Number((e.target as HTMLInputElement).value) })} />
          <label>Health bars</label>
          <select value={s.showBars} onChange={e => upd({ showBars: (e.target as HTMLSelectElement).value as Settings['showBars'] })}><option value="always">Always</option><option value="damaged">Damaged only</option><option value="never">Never (hold Alt)</option></select>
          <label>Master volume</label><input type="range" min={0} max={1} step={0.05} value={s.audio.master} onInput={e => updA('master', Number((e.target as HTMLInputElement).value))} />
          <label>Music volume</label><input type="range" min={0} max={1} step={0.05} value={s.audio.music} onInput={e => updA('music', Number((e.target as HTMLInputElement).value))} />
          <label>Sound effects</label><input type="range" min={0} max={1} step={0.05} value={s.audio.sfx} onInput={e => updA('sfx', Number((e.target as HTMLInputElement).value))} />
          <label>Interface sounds</label><input type="range" min={0} max={1} step={0.05} value={s.audio.ui} onInput={e => updA('ui', Number((e.target as HTMLInputElement).value))} />
          <label>Camera speed</label><input type="range" min={0.3} max={3} step={0.1} value={s.cameraSpeed} onInput={e => upd({ cameraSpeed: Number((e.target as HTMLInputElement).value) })} />
          <label>Screen-edge scrolling</label><input type="checkbox" checked={s.edgePan} onChange={e => upd({ edgePan: (e.target as HTMLInputElement).checked })} />
          <label>Grid hotkeys (QWER/ASDF/ZXCV)</label><input type="checkbox" checked={s.gridHotkeys} onChange={e => upd({ gridHotkeys: (e.target as HTMLInputElement).checked })} />
          <label>Show FPS</label><input type="checkbox" checked={s.showFps} onChange={e => upd({ showFps: (e.target as HTMLInputElement).checked })} />
        </div>
        <div class="row"><button class="btn" onClick={() => { dialog.value = null; }}>Cancel</button><div class="spacer" /><button class="btn primary" onClick={apply}>Apply</button></div>
      </div>
    </div>
  );
}

export function HelpDialog() {
  return (
    <div class="overlay" onClick={e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      <div class="panel dialog help">
        <h2>How to Play</h2>
        <p>Four players start at the centre of each map edge. Every base has a <b>Fortress</b>, three <b>Barracks</b> (one per lane), four <b>Towers</b> and support buildings. Barracks spawn a wave of units every 25 seconds automatically. Units walk their lane and fight everything on the way: the two lanes along the map edge lead to your neighbours, the middle lane crosses the centre to the player opposite you.</p>
        <p>You never control units. You win by choosing upgrades: research weapons and armor at the <b>War Forge</b>, race abilities at the <b>Sanctum</b>, income and artifacts at the <b>Altar of Gold</b>, upgrade <b>Barracks</b> tiers for bigger waves and the <b>Fortress</b> to unlock tier 3. Buy <b>Heroes</b> at the Altar and <b>mercenaries</b> at the Mercenary Camp, then pick the lane to send them. Holding the middle grants bonus income. Lose your Fortress and you are out — be the last one standing.</p>
        <p><kbd>F1</kbd>–<kbd>F6</kbd> select base buildings · <kbd>Space</kbd> jump to base · arrows / screen edge / middle mouse to pan · wheel to zoom · <kbd>Ins</kbd>/<kbd>Del</kbd> rotate · <kbd>Alt</kbd> show health bars · <kbd>Alt</kbd>+click minimap to ping · <kbd>F10</kbd>/<kbd>Esc</kbd> menu · <kbd>`</kbd> developer menu · <kbd>+</kbd>/<kbd>-</kbd> game speed · <kbd>Pause</kbd> pause.</p>
        <div class="btns"><button class="btn" onClick={() => { dialog.value = null; }}>Close</button></div>
      </div>
    </div>
  );
}

export function CreditsDialog() {
  return (
    <div class="overlay" onClick={e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      <div class="panel dialog help">
        <h2>Credits</h2>
        <p><b>Survival Chaos</b> was created by <b>Sur5al</b> as a Warcraft III custom map. This is an unofficial fan remake for personal/LAN use and contains no Blizzard or Sur5al assets.</p>
        <p>Engine: three.js (MIT), Preact (MIT). Models, effects, music and sound effects are generated procedurally in code (public domain). Optional CC0 asset packs (e.g. KayKit by Kay Lousberg) and CC0/CC-BY music listed in <code>public/assets/manifest.json</code> are credited in <code>public/assets/CREDITS.md</code> when installed.</p>
        <div class="btns"><button class="btn" onClick={() => { dialog.value = null; }}>Close</button></div>
      </div>
    </div>
  );
}
