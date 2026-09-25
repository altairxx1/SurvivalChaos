/** Subset of UnitMetaData/AbilityMetaData/UpgradeMetaData field ids -> readable names (numbers only, no Blizzard text). */
export const UNIT_FIELDS: Record<string, string> = {
  unam: 'name', upro: 'propernames', utip: 'tooltip', utub: 'tooltipExtended', uhot: 'hotkey', ubpx: 'buttonX', ubpy: 'buttonY',
  uhpm: 'hp', uhpr: 'hpRegen', umpm: 'mana', umpi: 'manaInitial', umpr: 'manaRegen', udef: 'armor', udty: 'armorType', udup: 'armorUpgradeBonus',
  ua1t: 'attack1Type', ua1b: 'attack1Base', ua1d: 'attack1Dice', ua1s: 'attack1Sides', ua1c: 'attack1Cooldown', ua1r: 'attack1Range', ua1z: 'attack1ProjSpeed',
  ua1m: 'attack1ProjArc', ua1w: 'attack1WeaponType', udp1: 'attack1DamagePoint', ua1f: 'attack1SplashFull', ua1h: 'attack1SplashMed', ua1q: 'attack1SplashSmall',
  ua2t: 'attack2Type', ua2b: 'attack2Base', ua2d: 'attack2Dice', ua2s: 'attack2Sides', ua2c: 'attack2Cooldown', ua2r: 'attack2Range',
  uaen: 'attacksEnabled', uacq: 'acquireRange', umvs: 'moveSpeed', umvr: 'turnRate', umvt: 'moveType', ucol: 'collision', usid: 'sightDay', usin: 'sightNight',
  uabi: 'abilities', udaa: 'defaultActiveAbility', uhab: 'heroAbilities', ulev: 'level', ubba: 'bountyBase', ubdi: 'bountyDice', ubsi: 'bountySides',
  ugol: 'goldCost', ulum: 'lumberCost', ubld: 'buildTime', ufoo: 'food', ufma: 'foodMade', upgr: 'upgradesUsed', uupt: 'upgradesTo', ures: 'researches',
  utra: 'trains', useu: 'sells', ubui: 'builds', ureq: 'requirements', urqa: 'requirementLevels', utyp: 'classification', urac: 'race', umdl: 'model',
  usca: 'scale', ussc: 'selectionScale', uclr: 'tintRed', uclg: 'tintGreen', uclb: 'tintBlue', uhom: 'hideMinimap', upri: 'priority', upoi: 'points',
  ustr: 'strength', uagi: 'agility', uint: 'intelligence', ustp: 'strengthPerLevel', uagp: 'agilityPerLevel', uinp: 'intelligencePerLevel', upra: 'primaryAttribute',
  ucs1: 'attack1Enabled', urpo: 'repulsePriority', ubdg: 'isBuilding', ufle: 'canFlee', utar: 'targetedAs', ua1g: 'attack1Targets', ua2g: 'attack2Targets',
};
export const ABILITY_FIELDS: Record<string, string> = {
  anam: 'name', atp1: 'tooltip', aub1: 'tooltipExtended', ahky: 'hotkey', abpx: 'buttonX', abpy: 'buttonY', alev: 'levels', areq: 'requirements',
  amcs: 'manaCost', acdn: 'cooldown', aran: 'range', aare: 'area', adur: 'duration', ahdu: 'heroDuration', atar: 'targets', abuf: 'buffs', aeff: 'effects', acat: 'casterArt', atat: 'targetArt',
  aher: 'isHero', aite: 'isItem', arac: 'race', acap: 'caster', Hbz1: 'blizzardWaves', Hbz2: 'blizzardDamage', Htb1: 'stormBoltDamage', Hbh1: 'bashChance', Hbh3: 'bashDamage',
};
export const UPGRADE_FIELDS: Record<string, string> = {
  gnam: 'name', gtip: 'tooltip', gub1: 'tooltipExtended', ghk1: 'hotkey', gbpx: 'buttonX', gbpy: 'buttonY', glvl: 'levels', gcls: 'class', grac: 'race',
  gglb: 'goldBase', gglm: 'goldPerLevel', glmb: 'lumberBase', glmm: 'lumberPerLevel', gtib: 'timeBase', gtim: 'timePerLevel', greq: 'requirements', grqc: 'requirementCounts',
  gef1: 'effect1', gba1: 'effect1Base', gmo1: 'effect1PerLevel', gco1: 'effect1Code', gef2: 'effect2', gba2: 'effect2Base', gmo2: 'effect2PerLevel', gco2: 'effect2Code',
  gef3: 'effect3', gba3: 'effect3Base', gmo3: 'effect3PerLevel', gco3: 'effect3Code', gef4: 'effect4', gba4: 'effect4Base', gmo4: 'effect4PerLevel', gco4: 'effect4Code',
};
export const ITEM_FIELDS: Record<string, string> = { unam: 'name', utip: 'tooltip', utub: 'tooltipExtended', iabi: 'abilities', ilev: 'level', iclass: 'class', igol: 'goldCost', ilvo: 'levelUnclassified' };
