# Extracting data from the original map

The remake is data-driven: code holds the mechanics, `src/data` holds the numbers. Until the original map is extracted,
race packs contain hand-tuned **placeholder** values (WC3 conventions, balanced with the headless bot runner).

## 1. Extract

```bash
npm run extract -- "original/Survival Chaos 4.31.w3x"
# or, if the map is protected and our reader fails, extract files with an MPQ editor and point at the folder:
npm run extract -- original/extracted
```

The built-in MPQ reader locates files by name (no listfile needed), handles encrypted tables/files and zlib. Other
compressions (PKWARE implode, bzip2, huffman) fall back to StormLib compiled to WebAssembly (`@wowserhq/stormjs`).

Output in `src/data/extracted/` (git-ignored):

| File | Content |
|---|---|
| `report.md` | Summary of everything found |
| `info.json`, `strings.json` | map info (w3i) and resolved `TRIGSTR_` strings (wts) |
| `terrain.json`, `terrain.bin` | w3e header and per-vertex height, water, ground tile, flags, layer, cliff (12 bytes/vertex) |
| `doodads.json` | trees, rocks, destructables (doo) |
| `units-placed.json`, `layout.extracted.json` | pre-placed buildings grouped by owner and assigned to map edges |
| `objects.*.json` | units, abilities, upgrades, items, buffs, destructables with readable field names |
| `war3map.j` / `.lua`, `script-hints.json` | script (if not protected), `Rect` literals, timer periods, referenced ids |

## 2. Map ids and build overrides

Fill `src/data/overrides/id-map.json`, e.g.

```json
{ "units": { "lordaeron.footman": "h000", "lordaeron.archer": "h001" }, "upgrades": { "up.meleeWeapons": "R000" } }
```

then `npm run build-packs`. It writes `src/data/overrides/extracted.json`, which is merged into the packs at load time,
and `build-packs.md` listing fields that are not in the map (custom objects only store differences from their WC3 base
object; those base values come from the wiki or the game's SLK tables).

## 3. Map geometry

`layout.extracted.json` lists the owner clusters with their building positions. Update `src/data/maps/survivalChaos.ts`
(half size, base inset, lane inset and the base-local placements) to match; the renderer and simulation derive everything
else from it. The terrain generator can be replaced by `terrain.bin` once the layout is confirmed.

## 4. Cross-check with the community database

`npm run wiki` downloads survivalchaos.uk / sc-helper pages (they are parsed from the map as well) into
`src/data/extracted/wiki/`. These hosts must be allowed by the network policy of the machine running the script.
