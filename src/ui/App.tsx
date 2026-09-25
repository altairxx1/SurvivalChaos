import { useEffect } from 'preact/hooks';
import { GameSession, type LobbyConfig } from '../app/GameSession';
import { audio, dialog, screen, selected, session, settings, uiTick, laneMode, devOpen } from './store';
import { CreditsDialog, HelpDialog, Lobby, MainMenu, SettingsPanel } from './screens/Menus';
import { Hud } from './hud/Hud';

const canvas = () => document.getElementById('game-canvas') as HTMLCanvasElement;

/** Attract mode: four bots battle behind the main menu. */
function startBackground(): void {
  stopSession();
  const cfg: LobbyConfig = { mode: 'standard', seed: Math.floor(Math.random() * 1e9), slots: [0, 1, 2, 3].map(i => ({ name: `AI ${i + 1}`, controller: 'bot' as const, raceId: 'random', difficulty: 'hard' as const })) };
  const s = new GameSession(canvas(), cfg, { ...settings.value, showFps: false }, audio, { spectator: true });
  s.speed = 1; s.onEnd = () => { setTimeout(() => { if (screen.value !== 'game') startBackground(); }, 4000); };
  s.start(); session.value = s;
}

function stopSession(): void { session.value?.stop(); session.value = null; }

function startGame(cfg: LobbyConfig): void {
  audio.unlock();
  stopSession();
  selected.value = 0; laneMode.value = null; dialog.value = null; devOpen.value = false;
  const s = new GameSession(canvas(), cfg, settings.value, audio);
  s.onUiTick = () => { uiTick.value++; };
  s.onEnd = () => { setTimeout(() => { dialog.value = 'end'; }, 2500); };
  s.message(`You are ${s.sim.players[s.localPlayer]!.name}, playing ${s.sim.race(s.localPlayer).name}. Defend your Fortress and destroy all enemies!`, 'good');
  s.start(); session.value = s; screen.value = 'game';
  if (import.meta.env.DEV) (window as unknown as { __sc: GameSession }).__sc = s;  // console access for debugging
}

function quitToMenu(): void { screen.value = 'menu'; startBackground(); }

export function App() {
  useEffect(() => {
    startBackground();
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    const onResize = () => session.value?.renderer.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); window.removeEventListener('resize', onResize); };
  }, []);
  // un-pause when a menu dialog closes
  useEffect(() => { const s = session.value; if (s && screen.value === 'game' && dialog.value === null && s.menuPaused) { s.menuPaused = false; s.paused = false; } }, [dialog.value]);
  const s = session.value;
  const d = dialog.value;
  return (
    <>
      {screen.value === 'menu' && <MainMenu onStart={startGame} />}
      {screen.value === 'lobby' && <Lobby onStart={startGame} />}
      {screen.value === 'game' && s && !s.spectator && <Hud s={s} onQuit={quitToMenu} />}
      {d === 'settings' && screen.value !== 'game' && <SettingsPanel onApply={st => session.value?.applySettings({ ...st, showFps: false })} />}
      {d === 'help' && <HelpDialog />}
      {d === 'credits' && <CreditsDialog />}
    </>
  );
}
