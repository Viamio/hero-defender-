'use strict';
/* =====================================================================
   HERO DEFENDER – pełna wersja: klasy postaci, Kuźnia Dusz, krainy
   ===================================================================== */

/* ---------------- Klasy ----------------
   atk.kind – rodzaj ataku głównego
   hp/spd   – mnożniki zdrowia i szybkości
   look     – kolory postaci i trzymana broń
----------------------------------------- */
const CLASS_DEFS = [
  { id: 'archer', name: 'Łucznik', icon: '🏹', desc: 'Szybkie, celne strzały z daleka.',
    skill: { name: 'Deszcz Strzał', icon: '☄', cd: 14, desc: 'grad strzał spada na największą grupę wrogów' },
    atk: { kind: 'arrow', rate: 2.4, dmg: 10, speed: 900, range: 340 }, hp: 1, spd: 1,
    look: { c1: '#1f3524', c2: '#2d4a33', hood: '#16261a', eye: '#ffb347', held: 'bow' } },
  { id: 'berserker', name: 'Berserker', icon: '🪓', desc: 'Rzuca ciężkimi toporami. Im mniej masz HP, tym mocniej bije.',
    skill: { name: 'Szał', icon: '😡', cd: 18, desc: 'przez 6 s atakuje dwa razy szybciej, biega szybciej i leczy się za zabójstwa' },
    atk: { kind: 'axe', rate: 1.25, dmg: 20, speed: 640, range: 300, pierce: 1 }, hp: 1.3, spd: 0.95,
    look: { c1: '#4a1e14', c2: '#6a2a1a', hood: '#8a6a4a', eye: '#ff4a2a', held: 'axe' } },
  { id: 'mage', name: 'Mag', icon: '🔮', desc: 'Kule ognia wybuchają i podpalają całe grupy wrogów.',
    skill: { name: 'Meteor', icon: '🌋', cd: 16, desc: 'ogromny meteor spada na największą grupę wrogów' },
    atk: { kind: 'fireball', rate: 1.3, dmg: 12, speed: 600, range: 360, boom: 55 }, hp: 0.85, spd: 1,
    look: { c1: '#24183e', c2: '#3a2a6a', hood: '#1a1030', eye: '#ff8a2a', held: 'staff', orb: '#ff8a2a' } },
  { id: 'hunter', name: 'Łowca Demonów', icon: '⚔️', desc: 'Bełty odbijają się między wrogami. +50% obrażeń bossom i elitom.',
    skill: { name: 'Święta Pieczęć', icon: '✴️', cd: 15, desc: 'krąg na ziemi spowalnia wrogów o 50% i rani ich' },
    atk: { kind: 'bolt', rate: 1.8, dmg: 12, speed: 1000, range: 380, ric: 2 }, hp: 1, spd: 1.05,
    look: { c1: '#2a2420', c2: '#4a3a2a', hood: '#1a1410', eye: '#ffe08a', held: 'bow' },
    unlock: { key: 'bosses', n: 5, text: 'Pokonaj łącznie 5 bossów' } },
  { id: 'necro', name: 'Nekromanta', icon: '💀', desc: 'Ciska czaszkami. Zabici wrogowie czasem wstają jako twoje szkielety.',
    skill: { name: 'Armia Umarłych', icon: '☠️', cd: 20, desc: 'przyzywa 6 szkieletów, które walczą po twojej stronie' },
    atk: { kind: 'skull', rate: 1.6, dmg: 11, speed: 560, range: 340 }, hp: 0.95, spd: 1,
    look: { c1: '#18181f', c2: '#2a2a3a', hood: '#0e0e14', eye: '#7aff7a', held: 'staff', orb: '#7aff7a' },
    unlock: { key: 'kills', n: 3000, text: 'Zabij łącznie 3000 wrogów' } },
  { id: 'alch', name: 'Alchemik', icon: '⚗️', desc: 'Fiolki z ogniem, lodem albo trucizną wybuchają w tłumie.',
    skill: { name: 'Wielka Mikstura', icon: '🧪', cd: 16, desc: 'ogromna kałuża kwasu, która długo trawi wrogów' },
    atk: { kind: 'potion', rate: 1.25, dmg: 12, range: 330, boom: 52 }, hp: 1, spd: 1,
    look: { c1: '#1e3a2e', c2: '#2a4a3a', hood: '#a08050', eye: '#9cff5a', held: 'flask' },
    unlock: { key: 'wave', n: 20, text: 'Przetrwaj 20 fal w jednej grze' } },
  { id: 'storm', name: 'Kapłan Burzy', icon: '⚡', desc: 'Błyskawice przeskakują między wrogami i ich ogłuszają.',
    skill: { name: 'Burza', icon: '🌩️', cd: 18, desc: 'przez 6 s pioruny walą w wrogów na całym ekranie' },
    atk: { kind: 'lightning', rate: 1.4, dmg: 9, range: 320, jumps: 3 }, hp: 0.9, spd: 1.05,
    look: { c1: '#1a2440', c2: '#2a3a5a', hood: '#d8d8e8', eye: '#9ad8ff', held: 'staff', orb: '#9ad8ff' },
    unlock: { key: 'trio', n: 3, text: 'Dojdź do fali 15 Łucznikiem, Berserkerem i Magiem' } },
];
const classDef = id => CLASS_DEFS.find(c => c.id === id) || CLASS_DEFS[0];

function unlockProgress(c) {
  if (!c.unlock) return null;
  const u = c.unlock, cb = SAVE.classBest || {};
  const cur = u.key === 'bosses' ? SAVE.totalBosses || 0
    : u.key === 'kills' ? SAVE.totalKills || 0
    : u.key === 'wave' ? (SAVE.best || {}).wave || 0
    : ['archer', 'berserker', 'mage'].filter(id => (cb[id] || 0) >= 15).length;
  return { cur: Math.min(cur, u.n), n: u.n };
}
function isUnlocked(c) {
  if (!c.unlock) return true;
  if ((SAVE.unlocked || {})[c.id]) return true;
  const p = unlockProgress(c);
  return p.cur >= p.n;
}

/* ---------------- Kuźnia Dusz: stałe ulepszenia ---------------- */
const SHOP = [
  { id: 'hp', name: 'Wytrzymałość', icon: '❤️', max: 5, base: 25, desc: L => `+${L * 10}% maksymalnego HP`,
    apply: (G, L) => { G.p.max *= 1 + 0.1 * L; G.p.hp = G.p.max; } },
  { id: 'dmg', name: 'Siła', icon: '⚔️', max: 5, base: 30, desc: L => `+${L * 6}% obrażeń`,
    apply: (G, L) => { G.s.dmgMult += 0.06 * L; } },
  { id: 'spd', name: 'Zwinność', icon: '👢', max: 5, base: 20, desc: L => `+${L * 4}% szybkości chodzenia`,
    apply: (G, L) => { G.s.moveMult += 0.04 * L; } },
  { id: 'armor', name: 'Pancerz', icon: '🛡️', max: 5, base: 30, desc: L => `${L * 3}% mniej otrzymanych obrażeń`,
    apply: (G, L) => { G.s.armor += 0.03 * L; } },
  { id: 'regen', name: 'Regeneracja', icon: '💚', max: 3, base: 40, desc: L => `+${(L * 0.2).toFixed(1).replace('.', ',')} HP/s`,
    apply: (G, L) => { G.s.hpRegen += 0.2 * L; } },
  { id: 'cd', name: 'Wprawa', icon: '⏱️', max: 5, base: 35, desc: L => `ataki i bronie ${L * 3}% szybsze`,
    apply: (G, L) => { G.s.cdMult *= 1 - 0.03 * L; G.s.rateMult += 0.03 * L; } },
  { id: 'area', name: 'Zasięg', icon: '📏', max: 3, base: 40, desc: L => `+${L * 5}% obszaru broni`,
    apply: (G, L) => { G.s.area += 0.05 * L; } },
  { id: 'magnet', name: 'Przyciąganie', icon: '🧲', max: 3, base: 15, desc: L => `+${L * 20}% zasięgu zbierania kryształów`,
    apply: (G, L) => { G.s.magnet *= 1 + 0.2 * L; } },
  { id: 'xp', name: 'Mądrość', icon: '📜', max: 5, base: 30, desc: L => `+${L * 6}% doświadczenia`,
    apply: (G, L) => { G.s.xpMult += 0.06 * L; } },
  { id: 'luck', name: 'Szczęście', icon: '🍀', max: 4, base: 50, desc: L => `rzadkie karty ${L * 25}% częściej`,
    apply: (G, L) => { G.luck = 1 + 0.25 * L; } },
  { id: 'greed', name: 'Chciwość', icon: '👻', max: 5, base: 25, desc: L => `+${L * 10}% zdobywanych dusz`,
    apply: () => {} },
  { id: 'reroll', name: 'Przezorność', icon: '🎲', max: 3, base: 40, desc: L => `+${L} przelosowania kart`,
    apply: (G, L) => { G.rerolls += L; } },
  { id: 'revive', name: 'Druga Szansa', icon: '✨', max: 1, base: 400, desc: () => 'raz na grę wstajesz z 50% HP',
    apply: (G, L) => { G.revives = L; } },
  { id: 'slots', name: 'Pas na Broń', icon: '🎒', max: 1, base: 600, desc: () => '+1 miejsce na broń (7 zamiast 6)',
    apply: (G, L) => { if (L) G.maxW = BALANCE.maxWeapons + 1; } },
];
const shopLvl = id => ((SAVE.up || {})[id]) || 0;
const shopCost = (u, L) => Math.round(u.base * Math.pow(1.7, L));
function applyShop(G) { for (const u of SHOP) { const L = shopLvl(u.id); if (L) u.apply(G, L); } }

/* ---------------- Krainy: zmieniają się co 10 fal ---------------- */
const ZONES = [
  { name: 'Cmentarz', sub: 'Umarli nie śpią', tint: null, fx: null },
  { name: 'Piekielne Pustkowia', sub: 'Uwaga na wybuchowe chochliki!', tint: 'rgba(255,50,10,.15)', fx: 'ember' },
  { name: 'Lodowa Krypta', sub: 'Upiory zamrażają dotykiem', tint: 'rgba(60,140,255,.12)', fx: 'snow' },
];
const zoneIdx = w => Math.floor((Math.max(1, w) - 1) / 10) % ZONES.length;
