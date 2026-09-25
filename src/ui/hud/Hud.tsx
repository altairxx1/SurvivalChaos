import { useEffect, useRef } from 'preact/hooks';
import type { GameSession } from '../../app/GameSession';
import type { Entity } from '../../sim/state/types';
import type { BuildingKind, LaneDir, UpgradeDef } from '../../sim/defs/types';
import { getRegistry } from '../../app/createGame';
import { dialog, devOpen, hovered, laneMode, screen, selected, session, settings, spawnAtCursor, tooltip, useUiTick, audio } from '../store';
import { BUILDING_ICON, CLASS_ICON, ICON_BG, icon } from '../icons';
import { minimapImage } from '../../render/terrain/Terrain';
import { DevMenu } from '../dev/DevMenu';
import { SettingsPanel } from '../screens/Menus';

const QUICK: { kind: BuildingKind; key: string }[] = [
  { kind: 'fortress', key: 'F1' }, { kind: 'altar', key: 'F2' }, { kind: 'forge', key: 'F3' }, { kind: 'sanctum', key: 'F4' }, { kind: 'goldAltar', key: 'F5' }, { kind: 'mercCamp', key: 'F6' }, { kind: 'barracks', key: 'F7' }, { kind: 'tower', key: 'F8' },
];
const GRID_KEYS = 'QWERASDFZXCV';
const fmtTime = (ticks: number) => { const s = Math.floor(ticks / 20); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

interface Btn { slot: number; hotkey: string; icon: string; bg?: string; level?: string; label?: string; blocked?: boolean; poor?: boolean; cd?: string;
  tip: { title: string; cost?: string; body: string; req?: string | null }; onClick: () => void }

function select(id: number) { selected.value = id; laneMode.value = null; tooltip.value = null; const s = session.value; if (s) s.renderer.selected = id; }

/** Builds the 4x3 command card for the current selection. */
function commandButtons(s: GameSession, e: Entity | undefined): Btn[] {
  const sim = s.sim; const me = s.localPlayer; const p = sim.players[me]!; const reg = getRegistry();
  const grid = settings.value.gridHotkeys;
  const lm = laneMode.value;
  if (lm) {
    const order: LaneDir[] = ['cw', 'cross', 'ccw'];
    const names = ['Left lane', 'Middle lane', 'Right lane'];
    const btns: Btn[] = order.map((dir, i) => {
      const t = sim.players[sim.map.laneTarget(me, dir)]!;
      return { slot: i, hotkey: GRID_KEYS[i]!, icon: ['⬅️', '⬆️', '➡️'][i]!, bg: t.color + '66', label: reg.race(t.raceId).name,
        tip: { title: `${names[i]} → ${t.name}`, body: `Send toward ${t.name} (${reg.race(t.raceId).name})${t.alive ? '' : ' — eliminated, units will reroute'}.` },
        onClick: () => { if (lm.kind === 'hero') s.issue({ t: 'buyHero', player: me, hero: lm.id, lane: dir }); else s.issue({ t: 'buySpecial', player: me, unit: lm.id, lane: dir }); laneMode.value = null; audio.play('click'); } };
    });
    btns.push({ slot: 11, hotkey: 'Escape', icon: icon('cancel'), tip: { title: 'Cancel', body: 'Cancel the purchase.' }, onClick: () => { laneMode.value = null; } });
    return btns;
  }
  if (!e || !e.alive || e.kind !== 'building' || e.owner !== me || !p.alive) return [];
  const out: Btn[] = [];
  const race = sim.race(me);
  sim.buildingUpgrades(e).forEach((id, i) => {
    const up = reg.upgrade(id) as UpgradeDef;
    const cur = sim.currentLevel(p, e, up), pend = sim.pendingLevels(p, e, up); const next = cur + pend + 1;
    const why = sim.researchBlocker(p, e, id);
    const cost = next <= up.maxLevel ? sim.upgradeCost(p, up, next) : 0; const time = Math.round(sim.upgradeTime(up, Math.min(next, up.maxLevel)) / 20 / sim.mode.researchSpeed);
    let title = up.name; if (up.id === 'up.fortress') title = next === 2 ? 'Upgrade to Stronghold' : 'Upgrade to Citadel'; if (up.id === 'up.tier') title = `Upgrade to Tier ${next + 1} Barracks`;
    out.push({ slot: i, hotkey: grid ? GRID_KEYS[i]! : up.hotkey, icon: icon(up.icon), bg: ICON_BG[up.icon], level: up.maxLevel > 1 ? `${cur}/${up.maxLevel}` : cur ? '✔' : undefined,
      blocked: !!why && why !== 'Not enough gold', poor: why === 'Not enough gold',
      tip: { title: `${title}${up.maxLevel > 1 && next <= up.maxLevel ? ` (Level ${next})` : ''}`, cost: next <= up.maxLevel ? `💰 ${cost}   ⌛ ${time}s` : undefined, body: up.description, req: why && why !== 'Not enough gold' ? why : null },
      onClick: () => s.issue({ t: 'research', player: me, building: e.id, upgrade: id }) });
  });
  if (e.bld!.kind === 'altar') race.heroes.forEach((h, i) => {
    const why = sim.heroBlocker(p, h.id); const cd = (p.heroCd[h.id] ?? 0) - sim.tick;
    out.push({ slot: i, hotkey: grid ? GRID_KEYS[i]! : 'QWE'[i]!, icon: '👑', bg: race.color + '55', label: h.name.split(' ')[0], blocked: !!why && why !== 'Not enough gold', poor: why === 'Not enough gold',
      cd: cd > 0 ? `${Math.ceil(cd / 20)}s` : undefined,
      tip: { title: `Summon ${h.name}`, cost: `💰 ${h.cost}   cooldown ${h.cooldown}s`, body: `${h.description} Abilities: ${h.heroAbilities.map(a => reg.ability(a).name).join(', ')}. Choose a lane after buying.`, req: why && why !== 'Not enough gold' ? why : null },
      onClick: () => { if (why && why !== 'Not enough gold') { s.message(why, 'error'); audio.play('error'); return; } if (why) { s.message(why, 'error'); audio.play('error'); return; } laneMode.value = { kind: 'hero', id: h.id }; audio.play('click'); } });
  });
  if (e.bld!.kind === 'mercCamp') race.specials.forEach((sp, i) => {
    const u = reg.unit(sp.unit); const why = sim.specialBlocker(p, sp.unit); const cd = (p.specialCd[sp.unit] ?? 0) - sim.tick;
    out.push({ slot: i, hotkey: grid ? GRID_KEYS[i]! : 'QW'[i]!, icon: CLASS_ICON[u.cls], bg: '#4a3a5a', label: u.name.split(' ')[0], blocked: !!why && why !== 'Not enough gold', poor: why === 'Not enough gold', cd: cd > 0 ? `${Math.ceil(cd / 20)}s` : undefined,
      tip: { title: `Hire ${sp.count > 1 ? `${sp.count}x ` : ''}${u.name}`, cost: `💰 ${sp.cost}   cooldown ${sp.cooldown}s`, body: `${u.description || u.name}. HP ${u.hp}, armor ${u.armor}. Choose a lane after buying.`, req: why && why !== 'Not enough gold' ? why : null },
      onClick: () => { if (why) { s.message(why, 'error'); audio.play('error'); return; } laneMode.value = { kind: 'special', id: sp.unit }; audio.play('click'); } });
  });
  return out;
}

function Buttons({ s }: { s: GameSession }) {
  useUiTick();
  const e = s.sim.get(selected.value);
  const btns = commandButtons(s, e);
  const cells = Array.from({ length: 12 }, (_, i) => btns.find(b => b.slot === i));
  return (
    <div class="panel cmdcard">
      {cells.map(b => b ? (
        <div class={`cbtn ${b.blocked ? 'blocked' : ''} ${b.poor ? 'poor' : ''}`} style={{ '--bg': b.bg ?? '#3a2e1e' }}
          onMouseEnter={() => { tooltip.value = { ...b.tip }; }} onMouseLeave={() => { tooltip.value = null; }}
          onClick={() => { b.onClick(); }}>
          {b.icon}
          <span class="hk">{b.hotkey === 'Escape' ? 'Esc' : b.hotkey}</span>
          {b.level && <span class="lv">{b.level}</span>}
          {b.label && !b.level && <span class="label">{b.label}</span>}
          {b.cd && <div class="cd">{b.cd}</div>}
        </div>
      ) : <div class="cempty" />)}
    </div>
  );
}

export function useHotkeys(s: GameSession) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement; if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA')) return;
      if (ev.key === 'Alt') { s.renderer.altHeld = true; ev.preventDefault(); return; }
      if (dialog.value) { if (ev.key === 'Escape' && dialog.value !== 'end') { closeDialog(s); } return; }
      if (ev.key === '`' || ev.key === '~' || ev.key === 'F9') { devOpen.value = !devOpen.value; ev.preventDefault(); return; }
      if (ev.key === 'F10' || (ev.key === 'Escape' && !laneMode.value && !spawnAtCursor.value)) { openPause(s); ev.preventDefault(); return; }
      if (ev.key === 'Escape') { laneMode.value = null; spawnAtCursor.value = null; return; }
      if (ev.key === 'Pause' || ev.key === 'p' && ev.ctrlKey) { s.paused = !s.paused; ev.preventDefault(); return; }
      if (ev.key === '+' || ev.key === '=') { s.speed = Math.min(16, s.speed * 2); s.message(`Game speed ${s.speed}x`); return; }
      if (ev.key === '-') { s.speed = Math.max(0.25, s.speed / 2); s.message(`Game speed ${s.speed}x`); return; }
      if (ev.key === ' ' || ev.key === 'Home') { const f = s.sim.map.fortressPos(s.sim.players[s.localPlayer]!.slot); s.renderer.cam.lookAt(f.x * 0.88, f.y * 0.88); ev.preventDefault(); return; }
      const q = QUICK.find(k => k.key === ev.key);
      if (q) {
        ev.preventDefault();
        const list = s.sim.entities.filter(b => b.alive && b.kind === 'building' && b.owner === s.localPlayer && b.bld!.kind === q.kind);
        if (!list.length) return;
        const cur = list.findIndex(b => b.id === selected.value);
        const b = list[(cur + 1) % list.length]!; select(b.id);
        if (ev.shiftKey || cur >= 0) s.renderer.cam.lookAt(b.x, b.y);
        return;
      }
      const btns = commandButtons(s, s.sim.get(selected.value));
      const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
      const b = btns.find(x => x.hotkey.toUpperCase() === k.toUpperCase());
      if (b) { ev.preventDefault(); b.onClick(); }
    };
    const onUp = (ev: KeyboardEvent) => { if (ev.key === 'Alt') s.renderer.altHeld = false; };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp); };
  }, [s]);
}

function openPause(s: GameSession) { if (!s.ended && !s.paused) { s.paused = true; s.menuPaused = true; } dialog.value = 'pause'; }
function closeDialog(_s: GameSession) { dialog.value = null; }

function TopBar({ s }: { s: GameSession }) {
  useUiTick();
  const sim = s.sim; const p = sim.players[s.localPlayer]!;
  const nextIncome = Math.max(0, Math.ceil((sim.nextIncome - sim.tick) / 20));
  const nextWave = Math.max(0, Math.ceil((sim.nextWave - sim.tick) / 20));
  return (
    <div class="topbar">
      <button class="btn small" onClick={() => openPause(s)}>Menu (F10)</button>
      <button class="btn small" onClick={() => { dialog.value = 'help'; }}>Help</button>
      <button class="btn small" style={{ borderColor: '#2a6a8a' }} onClick={() => { devOpen.value = !devOpen.value; }}>Dev (`)</button>
      <div class="spacer" />
      <span class="clock">{fmtTime(sim.tick)}</span>
      <span class="muted">next wave {nextWave}s</span>
      {s.speed !== 1 && <span style={{ color: '#6ad0ff' }}>{s.speed}x</span>}
      {s.paused && <span style={{ color: 'var(--yellow)' }}>PAUSED</span>}
      <div class="spacer" />
      <span class="res" title="Gold">💰 {Math.floor(p.gold)}</span>
      <span class="res" title="Income per interval">+{sim.income(p)}{sim.middleOwner === s.localPlayer ? ` +${sim.mode.middleBonus}👑` : ''} <span class="muted">in {nextIncome}s</span></span>
      <span class="res" title="Your race" style={{ color: sim.race(s.localPlayer).color }}>{sim.race(s.localPlayer).name}</span>
    </div>
  );
}

function Scoreboard({ s }: { s: GameSession }) {
  useUiTick();
  const sim = s.sim;
  return (
    <div class="panel scoreboard" style={devOpen.value ? { display: 'none' } : undefined}>
      {sim.players.filter(p => p.controller !== 'none' || p.eliminatedAt >= 0).map(p => {
        const f = sim.findBuilding(p.id, 'fortress'); const frac = f ? f.hp / f.stats.maxHp : 0;
        return (
          <div class={`pl ${p.alive ? '' : 'dead'}`}>
            <div class="swatch" style={{ background: p.color, width: '12px', height: '12px' }} />
            <div style={{ color: p.id === s.localPlayer ? 'var(--gold)' : undefined }}>{p.name} <span style={{ color: 'var(--muted)' }}>{sim.race(p.id).name}</span>{sim.middleOwner === p.id ? ' 👑' : ''}</div>
            <div title="Kills">⚔ {p.kills}</div>
            <div class="hpmini" title="Fortress"><div style={{ width: `${frac * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function QuickBar({ s }: { s: GameSession }) {
  useUiTick();
  const mine = s.sim.entities.filter(b => b.alive && b.kind === 'building' && b.owner === s.localPlayer);
  return (
    <div class="quickbar">
      {QUICK.slice(0, 6).map(q => {
        const b = mine.find(x => x.bld!.kind === q.kind); if (!b) return null;
        const job = b.bld!.queue[0];
        return (
          <div class={`qb ${selected.value === b.id ? 'sel' : ''}`} title={`${getRegistry().buildings[q.kind].name} (${q.key})`} onClick={() => select(b.id)} onDblClick={() => s.renderer.cam.lookAt(b.x, b.y)}>
            {BUILDING_ICON[q.kind]}<span class="fk">{q.key}</span>
            <div class="hpline" style={{ width: `${(b.hp / b.stats.maxHp) * 100}%` }} />
            {job && <div class="prog" style={{ width: `${(1 - job.remaining / job.total) * 100}%` }} />}
          </div>
        );
      })}
    </div>
  );
}

function Minimap({ s }: { s: GameSession }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const size = 192; cv.width = size * 2; cv.height = size * 2;
    const g = cv.getContext('2d')!; const H = s.sim.map.half;
    const base = document.createElement('canvas'); base.width = base.height = size * 2;
    base.getContext('2d')!.putImageData(minimapImage(s.renderer.terrain, size * 2, H), 0, 0);
    const toPx = (x: number, y: number) => [(x + H) / (2 * H) * cv.width, (H - y) / (2 * H) * cv.height] as const;
    let raf = 0, last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw); if (t - last < 60) return; last = t;
      g.drawImage(base, 0, 0);
      g.globalAlpha = 0.35; g.strokeStyle = '#e8d8b0'; g.lineWidth = 2;
      for (const l of s.sim.map.lanes) { g.beginPath(); l.points.forEach((p, i) => { const [x, y] = toPx(p.x, p.y); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }
      g.globalAlpha = 1;
      for (const e of s.sim.entities) {
        if (!e.alive || e.kind === 'projectile') continue;
        const [x, y] = toPx(e.x, e.y); g.fillStyle = s.sim.players[e.owner]!.color;
        if (e.kind === 'building') { const r = e.bld!.kind === 'fortress' ? 9 : e.bld!.kind === 'tower' ? 4 : 6; g.fillRect(x - r, y - r, r * 2, r * 2); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(x - r, y - r, r * 2, r * 2); }
        else { const r = e.hero ? 5 : 2.2; g.fillRect(x - r, y - r, r * 2, r * 2); if (e.hero) { g.strokeStyle = '#fff'; g.strokeRect(x - r, y - r, r * 2, r * 2); } }
      }
      const now = performance.now();
      for (const p of s.pings) { const [x, y] = toPx(p.x, p.y); const k = ((now - p.time) % 1000) / 1000; g.strokeStyle = p.color; g.lineWidth = 3; g.globalAlpha = 1 - k; g.beginPath(); g.arc(x, y, 6 + k * 26, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
      const c = s.renderer.viewCorners(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); c.forEach((p, i) => { const [x, y] = toPx(p.x, p.y); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); g.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [s]);
  const toWorld = (ev: MouseEvent) => { const r = (ev.target as HTMLCanvasElement).getBoundingClientRect(); const H = s.sim.map.half; return { x: ((ev.clientX - r.left) / r.width) * 2 * H - H, y: H - ((ev.clientY - r.top) / r.height) * 2 * H }; };
  const act = (ev: MouseEvent) => {
    const w = toWorld(ev);
    if (ev.altKey || ev.button === 2) { s.pings.push({ ...w, time: performance.now(), color: s.sim.players[s.localPlayer]!.color }); audio.play('click'); return; }
    s.renderer.cam.lookAt(w.x, w.y);
  };
  return <div class="panel minimap-wrap"><canvas ref={ref} onMouseDown={act} onMouseMove={ev => { if (ev.buttons === 1 && !ev.altKey) act(ev); }} onContextMenu={e => e.preventDefault()} /></div>;
}

function InfoPanel({ s }: { s: GameSession }) {
  useUiTick();
  const reg = getRegistry(); const sim = s.sim;
  const e = sim.get(selected.value);
  if (!e || !e.alive) {
    const p = sim.players[s.localPlayer]!;
    return <div class="panel infopanel"><div class="portrait" style={{ background: sim.race(p.id).color + '33' }}>{p.alive ? '🏳️' : '💀'}</div>
      <div><div class="name">{p.name}</div><div class="owner" style={{ color: sim.race(p.id).color }}>{sim.race(p.id).name} · {sim.race(p.id).faction}</div>
        <div class="stats"><span>Kills <b>{p.kills}</b></span><span>Lost <b>{p.lost}</b></span><span>Gold earned <b>{Math.floor(p.totalGold)}</b></span><span>Income <b>{sim.income(p)}</b></span><span>Fortress <b>Lv {p.fortressLevel}</b></span><span>Upgrades <b>{Object.values(p.upgrades).reduce((a, b) => a + b, 0)}</b></span></div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>{sim.race(p.id).bonuses.join(' · ')}</div>
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}>Select a building (click or F1–F8) to research upgrades.</div></div></div>;
  }
  const owner = sim.players[e.owner]!;
  const st = e.stats;
  const isB = e.kind === 'building';
  const name = isB ? (e.bld!.kind === 'fortress' ? ['Fortress', 'Stronghold', 'Citadel'][owner.fortressLevel - 1] : reg.buildings[e.bld!.kind].name) : reg.unit(e.def).name;
  const dmgMin = Math.round((st.dmgBase + st.dice) * st.dmgMul + st.dmgAdd), dmgMax = Math.round((st.dmgBase + st.dice * st.sides) * st.dmgMul + st.dmgAdd);
  const portrait = isB ? BUILDING_ICON[e.bld!.kind] : CLASS_ICON[reg.unit(e.def).cls];
  const tier = isB && e.bld!.kind === 'barracks' ? 1 + (e.bld!.levels['up.tier'] ?? 0) : 0;
  const hdef = e.hero ? reg.heroes.get(e.def) : undefined;
  const xpNeed = e.hero ? [200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400][e.hero.level - 1] : 0;
  return (
    <div class="panel infopanel">
      <div>
        <div class="portrait" style={{ background: owner.color + '44' }}>{portrait}</div>
        <div class="bar hp"><div style={{ width: `${(e.hp / st.maxHp) * 100}%` }} /><span>{Math.ceil(e.hp)} / {st.maxHp}</span></div>
        {st.maxMana > 0 && <div class="bar mana"><div style={{ width: `${(e.mana / st.maxMana) * 100}%` }} /><span>{Math.floor(e.mana)} / {st.maxMana}</span></div>}
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div class="name">{name}{e.hero ? ` · Level ${e.hero.level}` : ''}{tier ? ` · Tier ${tier}` : ''}{isB && e.bld!.kind === 'tower' && e.bld!.levels['up.towerLevel'] ? ` · Level ${1 + e.bld!.levels['up.towerLevel']!}` : ''}</div>
        <div class="owner" style={{ color: owner.color }}>{owner.name} · {sim.race(e.owner).name}{!isB && e.lane >= 0 ? ` · lane → ${sim.players[sim.map.lanes[e.lane]!.target]!.name}` : ''}</div>
        {e.hero && <div class="bar xp" style={{ height: '10px' }}><div style={{ width: `${Math.min(100, (e.hero.xp / (xpNeed || 1)) * 100)}%` }} /></div>}
        <div class="stats">
          {st.hasWeapon && <span>Damage <b>{dmgMin}–{dmgMax}</b> <i>{st.attackType}</i></span>}
          <span>Armor <b>{Math.round(st.armor * 10) / 10}</b> <i>{st.armorType}</i></span>
          {st.hasWeapon && <span>Range <b>{st.range}</b></span>}
          {st.hasWeapon && <span>Cooldown <b>{(st.cooldown / 20).toFixed(2)}s</b></span>}
          {!isB && <span>Speed <b>{Math.round(st.speed * 20)}</b></span>}
          {st.evasion > 0 && <span>Evasion <b>{Math.round(st.evasion * 100)}%</b></span>}
          {!isB && <span>Kills <b>{e.kills}</b></span>}
          {isB && e.bld!.kind === 'barracks' && <span style={{ gridColumn: 'span 3' }}>Wave: <b>{sim.race(e.owner).waves[tier - 1]!.map(w => `${w.count}× ${reg.unit(w.unit).name}`).join(', ')}</b></span>}
        </div>
        {!isB && e.abilities.length > 0 && <div class="buffs">{e.abilities.map(a => { const d = reg.abilities.get(a); return d ? <span class="buff" title={d.description}>{icon(d.icon)} {d.name}</span> : null; })}</div>}
        {e.buffs.length > 0 && <div class="buffs">{e.buffs.map(b => { const d = reg.buff(b.id); return <span class={`buff ${d.debuff ? 'debuff' : ''}`}>{d.name}</span>; })}</div>}
        {e.hero && <div class="items">{e.hero.items.map(it => { const d = it ? reg.item(it) : null; return <div class="islot" title={d ? `${d.name}` : 'Empty slot'} onMouseEnter={() => { if (d) tooltip.value = { title: d.name, body: Object.entries(d.mods).map(([k, v]) => `${k}: ${v}`).join(', ') }; }} onMouseLeave={() => { tooltip.value = null; }}>{d ? icon(d.icon) : ''}{d && <span class="lv">{d.level}</span>}</div>; })}</div>}
        {isB && e.bld!.queue.length > 0 && <div class="queue">{e.bld!.queue.map((j, i) => { const up = reg.upgrade(j.upgrade); return (
          <div class="qitem" title={`${up.name} ${j.level} — click to cancel`} onClick={() => { if (e.owner === s.localPlayer) { s.issue({ t: 'cancel', player: s.localPlayer, building: e.id, index: i }); audio.play('click'); } }}>
            {icon(up.icon)}<span class="lv">{j.level}</span>{i === 0 && <div class="prog" style={{ width: `${(1 - j.remaining / j.total) * 100}%` }} />}
          </div>); })}</div>}
        {hdef && e.hero && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>XP {Math.floor(e.hero.xp)} / {xpNeed ?? 'max'}</div>}
      </div>
    </div>
  );
}

function Tooltip() {
  const t = tooltip.value; if (!t) return null;
  return <div class="panel tooltip"><div class="tt-title">{t.title}</div>{t.cost && <div class="tt-cost">{t.cost}</div>}<div class="tt-desc">{t.body}</div>{t.req && <div class="tt-req">{t.req}</div>}</div>;
}

function Messages({ s }: { s: GameSession }) {
  useUiTick();
  const normal = s.messages.filter(m => m.kind !== 'error'); const err = [...s.messages].reverse().find(m => m.kind === 'error');
  return <>
    <div class="messages">{normal.map(m => <div class={`m ${m.kind}`} style={m.color ? { color: m.color } : undefined}>{m.text}</div>)}</div>
    {err && performance.now() - err.time < 2500 && <div class="error-msg">{err.text}</div>}
  </>;
}

/** Floating combat text: pooled DOM nodes positioned every animation frame. */
function FloatLayer({ s }: { s: GameSession }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current!; const pool: HTMLDivElement[] = []; let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick); const now = performance.now();
      while (pool.length < s.floats.length) { const d = document.createElement('div'); root.appendChild(d); pool.push(d); }
      pool.forEach((d, i) => {
        const f = s.floats[i]; if (!f) { d.style.display = 'none'; return; }
        const k = (now - f.born) / 1400; const p = s.renderer.project(f.x, f.y + k * 90, f.z);
        d.style.display = p.visible ? 'block' : 'none'; d.className = `ftext ${f.cls}`; d.textContent = f.text;
        d.style.left = `${p.x}px`; d.style.top = `${p.y}px`; d.style.opacity = String(Math.max(0, 1 - k * k));
      });
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [s]);
  return <div class="floats" ref={ref} />;
}

function PauseMenu({ s, onQuit }: { s: GameSession; onQuit: () => void }) {
  return (
    <div class="overlay"><div class="panel dialog">
      <h2>Game Menu</h2>
      <div class="btns">
        <button class="btn primary" onClick={() => closeDialog(s)}>Return to Game</button>
        <button class="btn" onClick={() => { dialog.value = 'settings'; }}>Options</button>
        <button class="btn" onClick={() => { dialog.value = 'help'; }}>Help</button>
        {!s.ended && s.sim.players[s.localPlayer]!.alive && <button class="btn" onClick={() => { s.issue({ t: 'surrender', player: s.localPlayer }); closeDialog(s); }}>Surrender</button>}
        <button class="btn" onClick={() => { dialog.value = null; onQuit(); }}>Quit to Main Menu</button>
      </div>
    </div></div>
  );
}

function EndScreen({ s, onQuit }: { s: GameSession; onQuit: () => void }) {
  const sim = s.sim; const win = sim.winner === s.localPlayer;
  return (
    <div class="overlay"><div class="panel dialog" style={{ minWidth: '620px' }}>
      <div class={`end-title ${win ? 'win' : 'lose'}`}>{win ? 'Victory!' : 'Defeat'}</div>
      <div style={{ textAlign: 'center', marginBottom: '12px', color: 'var(--muted)' }}>{sim.winner >= 0 ? `${sim.players[sim.winner]!.name} (${sim.race(sim.winner).name}) is the last one standing` : 'No survivors'} · {fmtTime(sim.tick)}</div>
      <table class="score"><thead><tr><th>Player</th><th>Race</th><th>Kills</th><th>Units lost</th><th>Gold earned</th><th>Upgrades</th><th>Result</th></tr></thead>
        <tbody>{sim.players.filter(p => p.controller !== 'none' || p.eliminatedAt >= 0).map(p => (
          <tr><td style={{ color: p.color }}>{p.name}</td><td>{sim.race(p.id).name}</td><td>{p.kills}</td><td>{p.lost}</td><td>{Math.floor(p.totalGold)}</td><td>{Object.values(p.upgrades).reduce((a, b) => a + b, 0)}</td>
            <td>{p.alive ? '🏆 Winner' : `Out at ${fmtTime(p.eliminatedAt)}`}</td></tr>))}</tbody></table>
      <div class="row" style={{ marginTop: '16px' }}>
        <button class="btn" onClick={() => { dialog.value = null; }}>Keep watching</button><div class="spacer" />
        <button class="btn primary" onClick={() => { dialog.value = null; onQuit(); }}>Main Menu</button>
      </div>
    </div></div>
  );
}

export function Hud({ s, onQuit }: { s: GameSession; onQuit: () => void }) {
  useHotkeys(s);
  useUiTick();
  useEffect(() => {
    const cv = s.canvas;
    let lastHover = 0;
    const down = (ev: MouseEvent) => {
      audio.unlock();
      if (ev.button !== 0) { if (ev.button === 2) { laneMode.value = null; spawnAtCursor.value = null; } return; }
      const sp = spawnAtCursor.value;
      if (sp) { const g = s.renderer.groundAt(ev.clientX, ev.clientY); if (g) s.issue({ t: 'dev', player: s.localPlayer, op: { k: 'spawn', target: sp.player, unit: sp.unit, lane: 'cross', count: sp.count, x: g.x, y: g.y } }); if (!ev.shiftKey) spawnAtCursor.value = null; return; }
      const id = s.renderer.pick(ev.clientX, ev.clientY); select(id); if (id) audio.play('click');
    };
    const move = (ev: MouseEvent) => { const t = performance.now(); if (t - lastHover < 50) return; lastHover = t; const id = s.renderer.pick(ev.clientX, ev.clientY); hovered.value = id; s.renderer.hovered = id; };
    const ctx = (ev: Event) => ev.preventDefault();
    cv.addEventListener('mousedown', down); cv.addEventListener('mousemove', move); cv.addEventListener('contextmenu', ctx);
    return () => { cv.removeEventListener('mousedown', down); cv.removeEventListener('mousemove', move); cv.removeEventListener('contextmenu', ctx); };
  }, [s]);
  const d = dialog.value;
  return (
    <>
      <FloatLayer s={s} />
      <TopBar s={s} />
      <Scoreboard s={s} />
      <QuickBar s={s} />
      {settings.value.showFps && <div class="fps">{s.fps} fps · sim {s.tickMs.toFixed(2)} ms · {s.sim.entities.length} ents</div>}
      <Messages s={s} />
      {laneMode.value && <div class="panel lane-hint">Choose a lane to send your {laneMode.value.kind === 'hero' ? 'hero' : 'mercenaries'} (Q / W / E, Esc to cancel)</div>}
      {spawnAtCursor.value && <div class="panel spawn-hint">Click on the map to spawn {spawnAtCursor.value.count}× {getRegistry().unit(spawnAtCursor.value.unit).name} (shift-click to keep placing, right-click to stop)</div>}
      <Tooltip />
      <div class="bottom">
        <Minimap s={s} />
        <InfoPanel s={s} />
        <Buttons s={s} />
      </div>
      {devOpen.value && <DevMenu s={s} />}
      {d === 'pause' && <PauseMenu s={s} onQuit={onQuit} />}
      {d === 'end' && <EndScreen s={s} onQuit={onQuit} />}
      {d === 'settings' && <SettingsPanel onApply={st => s.applySettings(st)} />}
    </>
  );
}

export function endGame() { dialog.value = 'end'; }
export { screen };
