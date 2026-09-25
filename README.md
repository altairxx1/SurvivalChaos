# Survival Chaos — standalone remake

A standalone browser (and Electron) remake of **Survival Chaos**, the Warcraft III custom map by **Sur5al**.
Four players at the centre of each map edge, three auto-spawning lanes each, a contested middle, and no unit
control: you win through upgrades, heroes, mercenaries and timing. Built with TypeScript, three.js and Preact.

> Unofficial fan project for personal/LAN use. It contains no Blizzard or Sur5al assets: all models, effects,
> music and sounds are generated in code. Optional CC0 packs can be downloaded (see *Assets*).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 and http://<your-lan-ip>:5173 for other PCs on your network
```

Click **Quick Start (You vs 3 Bots)** or **Single Player** to configure the lobby (races, bot difficulty, game mode, seed).

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server, reachable on the LAN (`--host`) |
| `npm run build` / `npm run preview` | Production build in `dist/` and a LAN-reachable preview server |
| `npm test` | Simulation, determinism and extraction tests (vitest) |
| `npm run e2e` | Browser smoke test (Playwright; `npx playwright install chromium` once) |
| `npm run sim:headless -- 10 1 60 lordaeron,orc,undead,nightelf` | Bot-vs-bot games without graphics (balance checks) |
| `npm run electron:start` | Build and open the desktop app; it also serves the game on port 4173 for the LAN |
| `npm run electron:build` | Package a portable app with electron-builder (`release/`) |
| `npm run extract -- "original/Survival Chaos 4.31.w3x"` | Dump the original map's data to `src/data/extracted/` |
| `npm run build-packs` | Turn extracted object data into race-pack overrides |
| `npm run wiki` | Download the community database pages for cross-checking |
| `npm run fetch-assets` | Download optional CC0 assets listed in `public/assets/manifest.json` |

## Controls

`F1`–`F8` select base buildings (fortress, altar, forge, sanctum, gold altar, mercenary camp, barracks, towers) ·
command-card hotkeys shown on each button (enable grid hotkeys QWER/ASDF/ZXCV in Options) · `Space` jump to base ·
arrows / screen edge / middle-drag to pan · wheel zoom · `Ins`/`Del` rotate · `Alt` show all health bars ·
`Alt`+click minimap to ping · `F10`/`Esc` game menu · `+`/`-` game speed · `Pause` pause · `` ` `` developer menu.

## Developer menu (`` ` ``)

Game speed 0–16x and single-tick stepping · take control of any player · add/set gold, bonus income · god mode ·
free build, instant research, no spawns, frozen bots · spawn any unit or hero at a lane or at the cursor · force waves ·
kill units · eliminate players · max all upgrades · reset cooldowns · level heroes and give artifacts · entity inspector ·
lane path and tower range overlays · save/load snapshots. Every dev action is a recorded command, so games stay deterministic.
In dev builds the running session is also available in the browser console as `window.__sc`.

## Project status

| Area | State |
|---|---|
| Deterministic simulation (20 Hz lockstep-ready), combat, lanes, waves, research, heroes, artifacts, abilities, bots | Done |
| Renderer (procedural terrain, instanced animated units, buildings, FX, bloom, shadows), HUD, menus, dev menu, audio | Done |
| Races | 4 of 25 playable: Lordaeron, Orc, Undead, Night Elf. The other 21 appear as "coming soon" |
| Exact numbers and map geometry | **Placeholder values** until the original map is extracted (see below) |
| LAN multiplayer | Transport interface in place; lockstep server is the next phase |
| Electron | Shell with LAN server included; the binary is downloaded by `npm install` on your machine |

### Getting 1:1 numbers and layout

1. Put the original map at `original/Survival Chaos 4.31.w3x` (or extract its files with an MPQ editor into `original/extracted/`).
2. `npm run extract -- "original/Survival Chaos 4.31.w3x"` → read `src/data/extracted/report.md`.
3. Map our ids to the map's object ids in `src/data/overrides/id-map.json`, then `npm run build-packs`.
4. Optionally `npm run wiki` (needs network access to survivalchaos.uk) and compare.

Details in [docs/EXTRACTION.md](docs/EXTRACTION.md). Architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
