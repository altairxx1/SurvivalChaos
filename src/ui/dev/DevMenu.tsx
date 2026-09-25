import { useState } from 'preact/hooks';
import type { GameSession } from '../../app/GameSession';
import type { DevOp } from '../../sim/core/Commands';
import type { GameFlags } from '../../sim/state/types';
import type { LaneDir } from '../../sim/defs/types';
import { getRegistry } from '../../app/createGame';
import { selected, spawnAtCursor, useUiTick, devOpen } from '../store';
import type { Difficulty } from '../../ai/Bot';

/** Developer / sandbox menu: every game-changing action is a 'dev' Command so it is recorded and replayable. */
export function DevMenu({ s }: { s: GameSession }) {
  useUiTick();
  const reg = getRegistry(); const sim = s.sim;
  const [target, setTarget] = useState(s.localPlayer);
  const [race, setRace] = useState(sim.players[s.localPlayer]!.raceId);
  const [unit, setUnit] = useState(() => reg.race(sim.players[s.localPlayer]!.raceId).units[0]!.id);
  const [count, setCount] = useState(5);
  const [lane, setLane] = useState<LaneDir>('cross');
  const [goldAmt, setGoldAmt] = useState(1000);
  const [item, setItem] = useState('item.claws.1');
  const [overlays, setOverlays] = useState({ lanes: false, ranges: false });
  const dev = (op: DevOp) => s.issue({ t: 'dev', player: s.localPlayer, op });
  const flag = (f: keyof GameFlags) => <label class="row" style={{ margin: 0 }}><input type="checkbox" checked={sim.flags[f]} onChange={e => dev({ k: 'flag', flag: f, on: (e.target as HTMLInputElement).checked })} /> {f}</label>;
  const sel = sim.get(selected.value);
  const raceUnits = [...reg.race(race).units, ...reg.race(race).heroes];
  const maxUpgrades = () => {
    const r = sim.race(target); const ids = [...r.forgeUpgrades, ...r.sanctumUpgrades, 'up.goldMining', 'up.bountyHunter', 'up.artifacts', 'up.fortress', 'up.tier', 'up.towerLevel'];
    for (const id of ids) dev({ k: 'setUpgrade', target, upgrade: id, level: reg.upgrade(id).maxLevel });
  };
  const download = () => { const blob = new Blob([s.saveSnapshot()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `survivalchaos-t${sim.tick}.json`; a.click(); };
  const upload = (f: File | undefined) => { if (f) void f.text().then(t => s.loadSnapshot(t)); };
  return (
    <div class="panel dev" onMouseDown={e => e.stopPropagation()}>
      <div class="row"><h3>Developer Menu</h3><div class="spacer" /><button class="btn small" onClick={() => { devOpen.value = false; }}>✕</button></div>
      <div style={{ color: '#8ab' }}>tick {sim.tick} · {s.fps} fps · sim {s.tickMs.toFixed(2)} ms · ents {sim.entities.length} · seed {sim.init.seed} · hash {sim.hash().toString(16)}</div>

      <details open><summary>Time</summary>
        <div class="row">{[0, 0.25, 0.5, 1, 2, 4, 8, 16].map(v => <button class="btn small" style={{ borderColor: (v === 0 ? s.paused : !s.paused && s.speed === v) ? '#6ad0ff' : undefined }} onClick={() => { if (v === 0) s.paused = true; else { s.paused = false; s.speed = v; } }}>{v === 0 ? '⏸' : `${v}x`}</button>)}</div>
        <div class="row"><button class="btn small" onClick={() => { s.paused = true; s.step(1); }}>Step 1 tick</button><button class="btn small" onClick={() => { s.paused = true; s.step(20); }}>Step 1 s</button><button class="btn small" onClick={() => { s.step(20 * 60); }}>+1 min</button></div>
      </details>

      <details open><summary>Player</summary>
        <div class="row">Target <select value={target} onChange={e => setTarget(Number((e.target as HTMLSelectElement).value))}>{sim.players.map(p => <option value={p.id}>{p.id + 1}: {p.name} ({reg.race(p.raceId).name}){p.alive ? '' : ' ✝'}</option>)}</select>
          <button class="btn small" onClick={() => s.setLocalPlayer(target)} disabled={target === s.localPlayer}>Control</button></div>
        <div class="row"><button class="btn small" onClick={() => dev({ k: 'gold', target, amount: 100 })}>+100</button><button class="btn small" onClick={() => dev({ k: 'gold', target, amount: 1000 })}>+1k</button><button class="btn small" onClick={() => dev({ k: 'gold', target, amount: 10000 })}>+10k</button>
          <input type="number" style={{ width: '70px' }} value={goldAmt} onInput={e => setGoldAmt(Number((e.target as HTMLInputElement).value))} /><button class="btn small" onClick={() => dev({ k: 'gold', target, amount: goldAmt, set: true })}>Set</button></div>
        <div class="row">Bonus income <input type="number" style={{ width: '60px' }} value={sim.players[target]!.income} onChange={e => dev({ k: 'income', target, amount: Number((e.target as HTMLInputElement).value) })} />
          <label class="row" style={{ margin: 0 }}><input type="checkbox" checked={sim.players[target]!.god} onChange={e => dev({ k: 'god', target, on: (e.target as HTMLInputElement).checked })} /> god mode</label></div>
        <div class="row"><button class="btn small" onClick={maxUpgrades}>Max upgrades</button><button class="btn small" onClick={() => dev({ k: 'resetCooldowns', target })}>Reset cooldowns</button>
          <button class="btn small" onClick={() => dev({ k: 'wave', target })}>Force wave</button><button class="btn small" onClick={() => dev({ k: 'killUnits', target })}>Kill units</button>
          <button class="btn small" onClick={() => dev({ k: 'eliminate', target })}>Eliminate</button></div>
        {sim.players[target]!.controller === 'bot' && <div class="row">Bot difficulty <select value={s.difficulties[target]} onChange={e => s.setBotDifficulty(target, (e.target as HTMLSelectElement).value as Difficulty)}>{['easy', 'normal', 'hard', 'insane'].map(d => <option value={d}>{d}</option>)}</select>
          <span style={{ color: '#8ab' }}>last: {s.bots.find(b => b.player === target)?.lastDecision}</span></div>}
      </details>

      <details open><summary>Flags</summary><div class="row">{flag('freeBuild')}{flag('instantResearch')}{flag('noSpawn')}{flag('botsFrozen')}{flag('reveal')}</div>
        <div class="row"><button class="btn small" onClick={() => dev({ k: 'killUnits', target: -1 })}>Kill ALL units</button><button class="btn small" onClick={() => { for (const p of sim.players) if (p.alive) dev({ k: 'wave', target: p.id }); }}>Wave for all</button></div>
      </details>

      <details open><summary>Spawn</summary>
        <div class="row"><select value={race} onChange={e => { const r = (e.target as HTMLSelectElement).value; setRace(r); setUnit(reg.race(r).units[0]!.id); }}>{[...reg.races.values()].map(r => <option value={r.id}>{r.name}</option>)}</select>
          <select value={unit} onChange={e => setUnit((e.target as HTMLSelectElement).value)}>{raceUnits.map(u => <option value={u.id}>{u.name} ({u.cls})</option>)}</select></div>
        <div class="row">× <input type="number" style={{ width: '50px' }} value={count} onInput={e => setCount(Math.max(1, Number((e.target as HTMLInputElement).value)))} />
          for P{target + 1} lane <select value={lane} onChange={e => setLane((e.target as HTMLSelectElement).value as LaneDir)}><option value="cw">left (cw)</option><option value="cross">middle</option><option value="ccw">right (ccw)</option></select></div>
        <div class="row"><button class="btn small" onClick={() => dev({ k: 'spawn', target, unit, lane, count })}>Spawn at lane</button><button class="btn small" onClick={() => { spawnAtCursor.value = { unit, player: target, count }; }}>Spawn at cursor…</button></div>
      </details>

      <details><summary>Selection {sel ? `#${sel.id}` : ''}</summary>
        {sel ? <>
          <div class="row"><button class="btn small" onClick={() => dev({ k: 'kill', ids: [sel.id] })}>Kill</button><button class="btn small" onClick={() => dev({ k: 'heal', ids: [sel.id] })}>Heal</button>
            {sel.hero && <><button class="btn small" onClick={() => dev({ k: 'heroLevel', id: sel.id, levels: 1 })}>+1 level</button>
              <select value={item} onChange={e => setItem((e.target as HTMLSelectElement).value)}>{[...reg.items.values()].map(i => <option value={i.id}>{i.name}</option>)}</select>
              <button class="btn small" onClick={() => dev({ k: 'giveItem', id: sel.id, item })}>Give</button></>}</div>
          <pre>{inspect(sel)}</pre>
        </> : <div style={{ color: '#8ab' }}>Click a unit or building to inspect it.</div>}
      </details>

      <details><summary>Overlays & debug</summary>
        <div class="row"><label class="row" style={{ margin: 0 }}><input type="checkbox" checked={overlays.lanes} onChange={e => { const on = (e.target as HTMLInputElement).checked; setOverlays({ ...overlays, lanes: on }); s.renderer.setOverlay('lanes', on); }} /> lane paths</label>
          <label class="row" style={{ margin: 0 }}><input type="checkbox" checked={overlays.ranges} onChange={e => { const on = (e.target as HTMLInputElement).checked; setOverlays({ ...overlays, ranges: on }); s.renderer.setOverlay('ranges', on); }} /> tower ranges</label></div>
        <div class="row"><button class="btn small" onClick={download}>Save snapshot</button><label class="btn small">Load snapshot<input type="file" accept=".json" style={{ display: 'none' }} onChange={e => upload((e.target as HTMLInputElement).files?.[0])} /></label></div>
        <pre>{sim.players.map(p => `P${p.id + 1} ${p.raceId} gold=${Math.floor(p.gold)} inc=${sim.income(p)} fort=${p.fortressLevel} kills=${p.kills} lost=${p.lost}\n  ${Object.entries(p.upgrades).map(([k, v]) => `${k.replace(/^.*up\./, '')}:${v}`).join(' ')}`).join('\n')}</pre>
      </details>
    </div>
  );
}

function inspect(e: import('../../sim/state/types').Entity): string {
  const st = e.stats;
  return [
    `${e.def} owner=${e.owner} kind=${e.kind} cls=${e.cls}`,
    `pos=(${Math.round(e.x)}, ${Math.round(e.y)}) hp=${e.hp.toFixed(1)}/${st.maxHp} mana=${e.mana.toFixed(0)}/${st.maxMana}`,
    `lane=${e.lane} wp=${e.wp} target=${e.target} anim=${e.anim} stun=${e.stun} cd=${e.attackCd} swing=${e.swing}`,
    `dmg=${st.dmgBase}+${st.dice}d${st.sides} x${st.dmgMul.toFixed(2)} +${st.dmgAdd.toFixed(1)} ${st.attackType} cd=${st.cooldown}t range=${st.range}`,
    `armor=${st.armor.toFixed(1)} ${st.armorType} speed=${(st.speed * 20).toFixed(0)} evasion=${st.evasion.toFixed(2)} crit=${st.critChance}x${st.critMul} ls=${st.lifesteal}`,
    `abilities=${e.abilities.join(', ') || '-'}`,
    `buffs=${e.buffs.map(b => b.id).join(', ') || '-'}`,
    e.hero ? `hero lvl=${e.hero.level} xp=${e.hero.xp.toFixed(0)} abil=${e.hero.abilityLevels.join('/')} items=${e.hero.items.filter(Boolean).join(', ')}` : '',
    e.bld ? `levels=${JSON.stringify(e.bld.levels)} queue=${e.bld.queue.map(j => `${j.upgrade}@${j.level}:${Math.ceil(j.remaining / 20)}s`).join(', ')}` : '',
  ].filter(Boolean).join('\n');
}
