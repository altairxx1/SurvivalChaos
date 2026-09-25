# Architecture

```
src/sim      deterministic simulation (no DOM, no wall clock, no Math.random) — lint-enforced
src/ai       bots; read the sim, emit Commands (deterministic, sim.rng.bots)
src/data     race packs, shared data, map layout, overrides merged from the extractor
src/render   three.js: terrain, instanced units (GPU vertex animation), buildings, FX, camera, picking
src/audio    WebAudio synthesized SFX + generative music; optional files from public/assets
src/ui       Preact HUD, menus, dev menu (signals, ~10 Hz refresh)
src/app      GameSession (fixed-step loop, interpolation, event routing), settings
src/net      CommandTransport (LocalTransport now, WebSocket lockstep next)
tools/       extraction (MPQ + WC3 parsers), wiki scraper, asset fetcher, headless sim
electron/    desktop shell + LAN static server
```

## Simulation

* Fixed 20 ticks/s. `Simulation.step()` runs systems in a fixed order: commands → economy → research → waves →
  stat refresh → spatial grid → buffs → auras → ability AI → units (targeting, movement, attacks, projectiles) → regen → cleanup.
* Entities are plain objects in an id-ordered array; iteration order is deterministic. `hash()` gives a per-tick FNV hash,
  `snapshot()/restore()` serialise the whole state (used by tests and the dev menu).
* All player input is a `Command` (`src/sim/core/Commands.ts`); bots and the dev menu use the same path.
* Combat follows Warcraft III: attack type × armor type table, armor reduction `0.06a/(1+0.06a)` (negative: `2-0.94^-a`),
  base + dice damage, cooldowns in ticks, damage point, projectiles, splash, bounce, crit, bash, evasion, lifesteal, thorns.
* Stats are resolved from base definition × race modifiers × upgrades × hero level/items × passives × buffs (`combat/stats.ts`).

## Rendering

* Units: one `InstancedMesh` per unit type. Models are generated from parts (legs, arms, wings…) with pivots; the vertex shader
  animates walk/attack/cast cycles and applies team colour and hit flash from per-instance attributes.
* Terrain is generated from the lane/base layout (replaceable by the extracted `terrain.bin`); trees and rocks are instanced.
* Particles are pooled CPU-simulated `THREE.Points` (additive + alpha), post-processing uses UnrealBloom.
* The renderer interpolates between the previous and current tick; it never mutates the simulation.

## Multiplayer readiness

The sim only depends on its seed and the ordered command stream, so the LAN phase adds a WebSocket relay that stamps each
command with `tick + inputDelay`, broadcasts per-tick bundles and compares hashes to detect desyncs.
