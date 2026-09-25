import type { UnitClass } from '../sim/defs/types';

/** Emoji glyphs used as placeholder icons for command buttons (replaceable by an icon atlas later). */
export const ICONS: Record<string, string> = {
  sword: '⚔️', bow: '🏹', shield: '🛡️', orb: '🔮', horse: '🐎', heart: '❤️', brick: '🧱', castle: '🏰', barracks: '🛖', tower: '🗼', coins: '💰',
  skull: '💀', gem: '💎', hourglass: '⌛', fire: '🔥', snow: '❄️', holy: '✨', aura: '🌀', water: '💧', star: '⭐', hammer: '🔨', thunder: '⚡',
  axe: '🪓', blood: '🩸', net: '🕸️', wind: '🌪️', wolf: '🐺', eye: '👁️', rock: '🪨', wave: '🌊', hoof: '🐂', bone: '🦴', bat: '🦇', moon: '🌙',
  leaf: '🍃', claws: '🐾', tree: '🌳', glaive: '🌀', ring: '💍', gloves: '🧤', boots: '👢', pendant: '📿', lane: '➤', cancel: '✖️',
};
export const CLASS_ICON: Record<UnitClass, string> = { melee: '🗡️', ranged: '🏹', caster: '🧙', mounted: '🐎', heavy: '🛡️', siege: '💣', special: '🐉', hero: '👑', summon: '👻' };
export const BUILDING_ICON: Record<string, string> = { fortress: '🏰', barracks: '🛖', tower: '🗼', altar: '⛩️', forge: '⚒️', sanctum: '📜', goldAltar: '💰', mercCamp: '⛺' };
export const ICON_BG: Record<string, string> = {
  sword: '#5a3020', bow: '#3a4a20', shield: '#30405a', orb: '#40285a', horse: '#4a3a20', heart: '#5a2028', brick: '#4a3a30', castle: '#3a3a4a', barracks: '#4a3020',
  tower: '#3a3a3a', coins: '#5a4a10', skull: '#2a2a2a', gem: '#1a4a5a', fire: '#5a2a10', snow: '#1a3a5a', holy: '#5a5020', thunder: '#20305a',
};
export const icon = (k: string | undefined) => (k && ICONS[k]) || '❔';
