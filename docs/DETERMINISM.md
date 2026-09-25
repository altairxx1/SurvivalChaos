# Determinism rules (src/sim, src/ai)

* No `Math.random`, `Date`, `performance`, `setTimeout`, DOM — use `sim.rng.<stream>` (xoshiro128**, seeded).
* No `Math.sin/cos/atan2/pow/exp/log` — use `DMath` (table trig, polynomial atan2, `powInt`). Only `+ - * / sqrt floor ceil abs min max`
  are used on floats; those are correctly rounded on every engine.
* Iterate entities in array order (id order). Never iterate a `Map`/`Set` keyed by objects.
* Every state change comes from a `Command` applied at a tick. Bots use `sim.rng.bots` so they never shift combat rolls.
* ESLint enforces the restricted globals/properties (`npm run lint`); `tests/sim/core.test.ts` runs two games in parallel and
  compares per-tick hashes, and checks snapshot/restore.
