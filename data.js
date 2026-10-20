'use strict';
/* =====================================================================
   WIEŻA NIESKOŃCZONOŚCI — dane gry
   Wszystkie liczby balansu są tutaj, żeby łatwo je stroić.
   ===================================================================== */

const BALANCE = {
  heroHp: 120,
  heroSpeed: 150,
  magnet: 120,           // zasięg przyciągania kryształów
  maxWeapons: 6,        // ile dodatkowych broni może mieć bohater
  weaponChance: 0.75,   // szansa, że karta przy awansie to broń
  waveLen: 24,          // sekundy jednej fali
  spawnWindow: 19,      // w ciągu ilu sekund fala wypuszcza wrogów
  bossEvery: 5,         // boss co tyle fal
  regenPerWave: 0.05,   // leczenie bohatera na start fali (ułamek max HP)
  rerolls: 2,
  pityLevels: 12,       // po tylu levelach bez rzadkiej karty – gwarancja
  maxEnemies: 380,
  spawnX: 2,            // mnożnik liczby potworów (tryb ciężki: x2)
  enemyXp: 0.65,        // doświadczenie z jednego potwora (mniej, bo jest ich 2x więcej)
  // jak rośnie trudność
  hpMult: w => 1 + 0.16 * (w - 1) + 0.012 * (w - 1) * (w - 1),
  dmgMult: w => 1 + 0.06 * (w - 1),
  xpMult: w => 1 + 0.04 * (w - 1),
  waveCount: w => Math.min(320, Math.round((22 + w * 3.6 + w * w * 0.06) * BALANCE.spawnX)),
  xpNeed: L => Math.round(2 + 1.4 * L + 0.28 * Math.pow(L, 1.9)),
};

// Szanse rzadkości: 84 / 10 / 5 / 1
const RARITY = {
  names: ['POSPOLITA', 'RZADKA', 'EPICKA', 'LEGENDARNA'],
  mult: [1, 1.6, 2.4, 3.5],
  roll(min = 0, luck = 1) {
    if (min >= 1) { // skrzynia bossa / gwarancja
      const x = Math.random() * 100;
      return x < 6 * luck ? 3 : x < 30 * luck ? 2 : 1;
    }
    const x = Math.random() * 100;
    return x < 1 * luck ? 3 : x < 6 * luck ? 2 : x < 16 * luck ? 1 : 0;
  },
};

/* ---------------- Wrogowie ---------------- */
const ENEMIES = {
  // spd – prędkość (bohater ma 150), dmg – obrażenia przy dotyku, rate – co ile sekund może uderzyć
  skeleton: { name: 'Szkielet', hp: 16, spd: 62, dmg: 6, rate: 1.0, xp: 1, r: 13 },
  spider:   { name: 'Pająk', hp: 7, spd: 105, dmg: 3, rate: 0.8, xp: 0.6, r: 10 },
  ghoul:    { name: 'Ghul', hp: 70, spd: 46, dmg: 12, rate: 1.2, xp: 4, r: 20, bar: true },
  cultist:  { name: 'Kultysta', hp: 26, spd: 55, dmg: 8, rate: 2.6, xp: 3, r: 14, range: 260, bar: true },
  bat:      { name: 'Nietoperz', hp: 10, spd: 128, dmg: 4, rate: 0.9, xp: 1, r: 12, fly: true },
  // krainy
  imp:      { name: 'Chochlik', hp: 12, spd: 125, dmg: 14, rate: 1, xp: 1.3, r: 12, kamikaze: true },
  wraith:   { name: 'Upiór', hp: 30, spd: 78, dmg: 8, rate: 1.2, xp: 2, r: 15, fly: true, chill: true, bar: true },
};

const BOSSES = [
  { id: 'butcher', name: 'Rzeźnik z Krypty', hp: 800, spd: 58, dmg: 25, rate: 1.2, xp: 30, r: 40,
    special: 6, desc: 'przywołuje szkielety' },
  { id: 'queen', name: 'Królowa Pająków', hp: 600, spd: 64, dmg: 18, rate: 1.0, xp: 30, r: 38,
    special: 5, desc: 'wypuszcza roje pająków' },
  { id: 'priest', name: 'Upiorny Kapłan', hp: 550, spd: 52, dmg: 12, rate: 2.6, xp: 30, r: 32,
    range: 300, special: 9, desc: 'ciska klątwami z dystansu' },
];

function waveWeights(w) {
  const list = [['skeleton', 10]];
  if (w >= 2) list.push(['spider', 5]);
  if (w >= 3) list.push(['ghoul', 1.5 + w * 0.12]);
  if (w >= 5) list.push(['cultist', 1.5 + w * 0.08]);
  if (w >= 7) list.push(['bat', 3]);
  const z = Math.floor((w - 1) / 10);
  if (z % 3 === 1 || z >= 3) list.push(['imp', 6]);
  if (z % 3 === 2 || z >= 3) list.push(['wraith', 5]);
  return list;
}

/* ---------------- Pomocnicze ---------------- */
const pct = v => Math.round(v * 100) + '%';
const num = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
const lvlOf = (G, id) => G.cards[id] || 0;

/* =====================================================================
   BRONIE – działają same, obok łuku. Każda ma 8 poziomów.
   Tablice w `st` to wartości dla poziomów 1..8.
   dmg – mnożnik obrażeń bazowych bohatera, cd – sekundy między atakami
   ===================================================================== */
const WEAPONS = {
  pily: { name: 'Wirujące Ostrza', icon: '⚙️', type: 'Wręcz',
    desc: 'Ostrza krążą wokół bohatera i tną każdego, kto podejdzie.',
    st: { n: [2, 3, 3, 3, 4, 4, 5, 7], dmg: [0.9, 0.9, 1.15, 1.15, 1.15, 1.4, 1.4, 1.6], R: [85, 85, 85, 100, 100, 100, 100, 125], spd: [2.6, 2.6, 2.6, 3.4, 3.4, 3.4, 3.4, 3.8] },
    ups: [, , '+1 ostrze', '+25% obrażeń', 'szybszy obrót i większy krąg', '+1 ostrze', '+25% obrażeń', '+1 ostrze', '+2 ostrza, ogromny krąg'] },
  topor: { name: 'Topór Bojowy', icon: '🪓', type: 'Wręcz',
    desc: 'Potężne cięcie toporem w najbliższego wroga. Odrzuca przeciwników.',
    st: { cd: [1.3, 1.2, 1.2, 1.1, 1.0, 1.0, 0.9, 0.8], dmg: [2.4, 2.8, 3.2, 3.2, 3.6, 4.0, 4.4, 5.2], R: [95, 95, 105, 105, 115, 115, 125, 140], arc: [2.2, 2.2, 2.2, 3.2, 3.2, 3.2, 3.2, 6.29], back: [0, 0, 0, 0, 0, 1, 1, 0] },
    ups: [, , '+15% obrażeń, szybsze cięcia', '+15% obrażeń, dłuższy zasięg', 'szerszy zamach', '+12% obrażeń, szybciej, dalej', 'drugie cięcie za plecami', '+10% obrażeń, szybciej, dalej', 'cięcie dookoła (360°), +20% obrażeń'] },
  kosa: { name: 'Kosa Żniwiarza', icon: '☠️', type: 'Wręcz',
    desc: 'Co kilka sekund wielkie cięcie dookoła bohatera.',
    st: { cd: [3.4, 3.2, 3.0, 2.8, 2.6, 2.4, 2.2, 1.8], dmg: [3.5, 4, 4.5, 5, 5.5, 6, 7, 8], R: [130, 135, 140, 150, 155, 160, 170, 190], heal: [0, 0, 0, 0.5, 0.5, 1, 1, 1.5] },
    ups: [, , '+15% obrażeń, częściej', '+12% obrażeń, częściej', 'każde zabójstwo kosą leczy 0,5 HP', 'większy zasięg, częściej', 'leczenie 1 HP za zabójstwo', '+15% obrażeń, częściej', 'ogromne cięcie, leczenie 1,5 HP'] },
  arkebuz: { name: 'Arkebuz', icon: '🔫', type: 'Palna',
    desc: 'Strzela szybkimi kulami w najbliższego wroga z dużej odległości.',
    st: { n: [1, 1, 2, 2, 2, 3, 3, 4], cd: [1.4, 1.3, 1.3, 1.2, 1.1, 1.1, 1.0, 0.9], dmg: [3, 3.5, 3.5, 4, 4.5, 4.5, 5, 5.5], pierce: [0, 0, 0, 1, 1, 1, 2, 2] },
    ups: [, , '+15% obrażeń, szybsze przeładowanie', 'seria 2 kul', 'kule przebijają 1 wroga, +15% obrażeń', '+12% obrażeń, szybsze przeładowanie', 'seria 3 kul', 'przebicie +1, +10% obrażeń, szybciej', 'seria 4 kul, +10% obrażeń'] },
  garlacz: { name: 'Garłacz', icon: '💥', type: 'Palna',
    desc: 'Strzelba z bliska: wachlarz śrutu, który mocno odrzuca wrogów.',
    st: { n: [5, 6, 7, 7, 8, 9, 10, 12], cd: [1.6, 1.55, 1.5, 1.4, 1.35, 1.3, 1.2, 1.0], dmg: [1.0, 1.0, 1.1, 1.3, 1.3, 1.4, 1.5, 1.7] },
    ups: [, , '+1 śrut', '+1 śrut, +10% obrażeń', '+18% obrażeń, szybciej', '+1 śrut', '+1 śrut, +8% obrażeń', '+1 śrut, +7% obrażeń, szybciej', '+2 śruty, +13% obrażeń, szybciej'] },
  salwa: { name: 'Miotacz Strzał', icon: '🎇', type: 'Dystans',
    desc: 'Co chwilę wystrzeliwuje pierścień strzał we wszystkie strony.',
    st: { n: [8, 10, 12, 14, 16, 18, 20, 24], cd: [2.6, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 1.6], dmg: [1.1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8], pierce: [0, 0, 0, 0, 1, 1, 1, 2] },
    ups: [, , '+2 strzały', '+2 strzały, +9% obrażeń', '+2 strzały, +8% obrażeń', 'strzały przebijają 1 wroga, +2 strzały', '+2 strzały, +7% obrażeń', '+2 strzały, +7% obrażeń', '+4 strzały, przebicie +1, szybciej'] },
  noze: { name: 'Rzucane Noże', icon: '🔪', type: 'Dystans',
    desc: 'Bardzo szybko rzuca noże w kierunku, w którym idziesz.',
    st: { n: [1, 2, 2, 3, 3, 4, 4, 5], cd: [0.6, 0.6, 0.55, 0.55, 0.5, 0.5, 0.45, 0.4], dmg: [0.9, 0.9, 1.0, 1.0, 1.15, 1.15, 1.3, 1.5], pierce: [0, 0, 1, 1, 1, 2, 2, 3] },
    ups: [, , '+1 nóż', 'przebijają 1 wroga, +10% obrażeń, szybciej', '+1 nóż', '+15% obrażeń, szybciej', '+1 nóż, przebicie +1', '+13% obrażeń, szybciej', '+1 nóż, przebicie +1, +15% obrażeń'] },
  siekiery: { name: 'Rzucane Topory', icon: '🌪️', type: 'Dystans',
    desc: 'Topory lecą jak bumerang, tnąc wszystkich po drodze tam i z powrotem.',
    st: { n: [1, 1, 2, 2, 2, 3, 3, 4], cd: [2.4, 2.2, 2.2, 2.0, 1.9, 1.9, 1.7, 1.5], dmg: [2.0, 2.4, 2.4, 2.8, 3.2, 3.2, 3.6, 4.2], reach: [240, 240, 260, 260, 280, 280, 300, 320] },
    ups: [, , '+20% obrażeń, częściej', '+1 topór, dalej', '+17% obrażeń, częściej', '+14% obrażeń, dalej, częściej', '+1 topór', '+12% obrażeń, dalej, częściej', '+1 topór, +17% obrażeń'] },
  miotacz: { name: 'Miotacz Ognia', icon: '♨️', type: 'Ogień',
    desc: 'Zieje ogniem w pobliskich wrogów i ich podpala.',
    st: { R: [180, 195, 195, 210, 225, 235, 235, 260], cone: [0.35, 0.35, 0.42, 0.42, 0.42, 0.48, 0.48, 0.55], dmg: [0.28, 0.32, 0.32, 0.37, 0.37, 0.43, 0.43, 0.52], burn: [0.5, 0.5, 0.5, 0.7, 0.7, 0.7, 0.9, 1.1] },
    ups: [, , 'dalszy zasięg, +15% obrażeń', 'szerszy strumień', '+15% obrażeń, mocniejsze podpalenie, dalej', 'dalszy zasięg', '+15% obrażeń, szerszy strumień, dalej', 'mocniejsze podpalenie', 'wielki płomień, +20% obrażeń'] },
  balista: { name: 'Ciężka Kusza', icon: '🏹', type: 'Dystans',
    desc: 'Ciężkie bełty w najsilniejszego wroga, przebijają kilku przeciwników.',
    st: { n: [1, 1, 1, 2, 2, 2, 2, 3], cd: [1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.0], dmg: [3.0, 3.4, 3.8, 4.2, 4.6, 5.0, 5.5, 6.5], pierce: [3, 3, 4, 4, 5, 5, 6, 8] },
    ups: [, , '+13% obrażeń, szybciej', '+12% obrażeń, przebicie +1', 'strzela w 2 cele naraz', '+10% obrażeń, przebicie +1', '+9% obrażeń, szybciej', '+10% obrażeń, przebicie +1', '3 cele naraz, +18% obrażeń'] },
  kociol: { name: 'Garnce Smoły', icon: '⚱️', type: 'Pułapka',
    desc: 'Rzuca garnce w tłum: płonąca kałuża spowalnia o 50% i parzy.',
    st: { n: [1, 1, 1, 1, 2, 2, 2, 3], cd: [4, 3.8, 3.6, 3.4, 3.2, 3, 2.8, 2.4], dmg: [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9], R: [70, 70, 80, 80, 90, 90, 100, 115], dur: [5, 5, 5, 6, 6, 7, 7, 8] },
    ups: [, , 'częściej, +10% obrażeń', 'większa kałuża, +10% obrażeń', 'dłużej się pali, częściej', 'rzuca 2 garnce', 'większa kałuża, dłużej', '+15% obrażeń, częściej', '3 garnce, ogromne kałuże'] },
  bomby: { name: 'Bomby', icon: '💣', type: 'Wybuch',
    desc: 'Rzuca bomby w grupy wrogów. Wielki wybuch rani wszystkich wokół.',
    st: { n: [1, 1, 2, 2, 2, 3, 3, 4], cd: [2.8, 2.6, 2.6, 2.4, 2.2, 2.2, 2.0, 1.8], dmg: [3, 3.5, 3.5, 4, 4.5, 4.5, 5, 6], R: [70, 75, 75, 80, 90, 90, 100, 110] },
    ups: [, , '+15% obrażeń, większy wybuch', '+1 bomba', '+15% obrażeń, częściej', 'większy wybuch, +12% obrażeń, częściej', '+1 bomba', '+10% obrażeń, większy wybuch, częściej', '+1 bomba, +20% obrażeń'] },
  burzak: { name: 'Kamień Burzy', icon: '⚡', type: 'Magia',
    desc: 'Pioruny z nieba uderzają w losowych wrogów na ekranie.',
    st: { n: [1, 2, 2, 3, 3, 4, 4, 6], cd: [2.6, 2.5, 2.3, 2.2, 2.0, 1.9, 1.8, 1.5], dmg: [3.5, 3.5, 4.2, 4.2, 5, 5, 5.8, 6.5] },
    ups: [, , '+1 piorun', '+20% obrażeń, częściej', '+1 piorun', '+19% obrażeń, częściej', '+1 piorun', '+16% obrażeń, częściej', '+2 pioruny, +12% obrażeń'] },
  aura: { name: 'Święta Aura', icon: '🔆', type: 'Magia',
    desc: 'Świetlisty krąg wokół bohatera stale rani wrogów w pobliżu.',
    st: { R: [70, 78, 86, 94, 102, 110, 118, 135], dmg: [2, 2.4, 2.8, 3.2, 3.6, 4.2, 4.8, 5.6], slow: [0, 0, 0, 0.2, 0.2, 0.25, 0.3, 0.35] },
    ups: [, , 'większa, +20% obrażeń', 'większa, +17% obrażeń', 'spowalnia wrogów o 20%', 'większa, +12% obrażeń', 'większa, mocniej spowalnia, +17% obrażeń', 'większa, +14% obrażeń', 'ogromna, spowalnia o 35%'] },
  kruki: { name: 'Stado Kruków', icon: '🐦‍⬛', type: 'Towarzysz',
    desc: 'Kruk krąży wokół i dziobie wrogów.',
    st: { n: [1, 1, 2, 2, 3, 3, 4, 5], dmg: [0.8, 1.0, 1.0, 1.2, 1.2, 1.4, 1.4, 1.7], hit: [0.55, 0.5, 0.5, 0.45, 0.45, 0.4, 0.4, 0.35] },
    ups: [, , '+25% obrażeń, szybsze', '+1 kruk', '+20% obrażeń, szybsze', '+1 kruk', '+17% obrażeń, szybsze', '+1 kruk', '+1 kruk, +20% obrażeń'] },
};
const WMAX = 8;
const LVL_JUMP = [1, 1, 2, 3];          // ile poziomów daje karta danej rzadkości
const WBONUS = [0, 0.2, 0.3, 0.5];      // dodatkowa siła broni za rzadkość
const weaponOf = (G, id) => G.weapons.find(w => w.id === id);
const maxW = G => G.maxW || BALANCE.maxWeapons;
const wst = (w, k) => WEAPONS[w.id].st[k][w.lvl - 1];
const wLvl = (G, id) => (weaponOf(G, id) || {}).lvl || 0;

function addWeapon(G, id, r) {
  let w = weaponOf(G, id);
  if (!w) {
    if (G.weapons.length >= maxW(G)) return;
    w = { id, lvl: 0, bonus: 0, cd: 0.4, t: 0 };
    G.weapons.push(w);
  }
  w.lvl = Math.min(WMAX, w.lvl + LVL_JUMP[r]);
  w.bonus += WBONUS[r];
  G.cards[id] = w.lvl;
}
function weaponTo(G, id, r) { return Math.min(WMAX, wLvl(G, id) + LVL_JUMP[r]); }
function weaponDesc(G, id, r) {
  const D = WEAPONS[id], from = wLvl(G, id), to = weaponTo(G, id, r);
  const out = [];
  if (!from) out.push(`<b>Nowa broń!</b> ${D.desc}`);
  for (let L = Math.max(2, from + 1); L <= to; L++) out.push(`<b>Poz. ${L}:</b> ${D.ups[L]}`);
  if (WBONUS[r]) out.push(`<b>+${pct(WBONUS[r])}</b> siły broni`);
  return out.join('<br>');
}
function weaponCard(id) {
  const D = WEAPONS[id];
  return { id, name: D.name, icon: D.icon, kind: 'Broń · ' + D.type, max: WMAX, weapon: true,
    req: G => { const w = weaponOf(G, id); return w ? w.lvl < WMAX : G.weapons.length < maxW(G); },
    desc: (G, r) => weaponDesc(G, id, r),
    apply: (G, r) => addWeapon(G, id, r) };
}

/* ---------------- Karty ----------------
   minR/maxR – w jakich rzadkościach karta może wypaść
   r – wylosowana rzadkość (0-3), RARITY.mult[r] – mnożnik rzadkości
----------------------------------------------------------------- */
const CARDS = [
  ...Object.keys(WEAPONS).map(weaponCard),

  // ---- wzmocnienia wszystkich broni ----
  { id: 'grot', name: 'Ostre Krawędzie', icon: '🗡️', kind: 'Wzmocnienie', max: 8,
    desc: (G, r) => `<b>+${pct(0.12 * RARITY.mult[r])}</b> obrażeń wszystkich ataków.`,
    apply: (G, r) => { G.s.dmgMult += 0.12 * RARITY.mult[r]; } },
  { id: 'kuznia', name: 'Szybkie Ręce', icon: '⏱️', kind: 'Wzmocnienie', max: 5,
    desc: (G, r) => `Bronie atakują <b>${pct(1 - Math.max(0.45, G.s.cdMult * (1 - 0.08 * RARITY.mult[r])) / G.s.cdMult)}</b> częściej.`,
    apply: (G, r) => { G.s.cdMult = Math.max(0.45, G.s.cdMult * (1 - 0.08 * RARITY.mult[r])); } },
  { id: 'obszar', name: 'Długie Ramię', icon: '📏', kind: 'Wzmocnienie', max: 5,
    desc: (G, r) => `<b>+${pct(0.1 * RARITY.mult[r])}</b> zasięgu i obszaru broni (ostrza, cięcia, wybuchy, aura).`,
    apply: (G, r) => { G.s.area += 0.1 * RARITY.mult[r]; } },
  { id: 'kowal', name: 'Kowal Wojenny', icon: '⚒️', kind: 'Wzmocnienie', max: 5,
    desc: (G, r) => `<b>+${pct(0.18 * RARITY.mult[r])}</b> obrażeń dodatkowych broni.`,
    apply: (G, r) => { G.s.wpnDmg += 0.18 * RARITY.mult[r]; } },

  // ---- łuk ----
  { id: 'cieciwa', name: 'Bitewny Rytm', icon: '🥁', kind: 'Atak główny', max: 6,
    desc: (G, r) => `<b>+${pct(0.12 * RARITY.mult[r])}</b> szybkości ataku głównego.`,
    apply: (G, r) => { G.s.rateMult += 0.12 * RARITY.mult[r]; } },
  { id: 'przebicie', name: 'Przebicie', icon: '➶', kind: 'Atak główny', max: 4,
    desc: (G, r) => `Pociski ataku głównego przebijają <b>+${1 + (r >= 2 ? 1 : 0) + (r >= 3 ? 1 : 0)}</b> wroga.`,
    apply: (G, r) => { G.s.pierce += 1 + (r >= 2 ? 1 : 0) + (r >= 3 ? 1 : 0); } },
  { id: 'wielo', name: 'Wielostrzał', icon: '🔱', kind: 'Atak główny', max: 4,
    desc: (G, r) => `Atak główny wypuszcza <b>+${r >= 2 ? 2 : 1}</b> pocisk naraz${r === 1 ? ', <b>+10%</b> obrażeń' : ''}.`,
    apply: (G, r) => { G.s.multi += r >= 2 ? 2 : 1; if (r === 1) G.s.dmgMult += 0.1; } },
  { id: 'rykoszet', name: 'Rykoszet', icon: '↯', kind: 'Atak główny', max: 3,
    desc: (G, r) => `Pociski odbijają się do <b>+${r >= 2 ? 2 : 1}</b> kolejnego wroga.`,
    apply: (G, r) => { G.s.ricochet += r >= 2 ? 2 : 1; } },
  { id: 'oko', name: 'Celne Oko', icon: '🎯', kind: 'Wzmocnienie', max: 5,
    desc: (G, r) => `<b>+${pct(0.07 * RARITY.mult[r])}</b> szansy na trafienie krytyczne${r >= 2 ? ', krytyki <b>+50%</b> mocniejsze' : ''}.`,
    apply: (G, r) => { G.s.crit += 0.07 * RARITY.mult[r]; if (r >= 2) G.s.critMult += 0.5; } },
  { id: 'ostatnia', name: 'Złoty Pocisk', icon: '🌠', kind: 'Atak główny', max: 3, minR: 1,
    desc: (G, r) => `Co <b>${Math.max(8, 20 - 4 * lvlOf(G, 'ostatnia'))}</b> ataków wypuszczasz złoty pocisk przez cały ekran (<b>x${num(6 * RARITY.mult[r])}</b> obrażeń).`,
    apply: (G, r) => { G.s.bigEvery = Math.max(8, 20 - 4 * lvlOf(G, 'ostatnia')); G.s.bigMult = Math.max(G.s.bigMult, 6 * RARITY.mult[r]); } },

  // ---- żywioły (działają na strzały z łuku) ----
  { id: 'ogien', name: 'Płomień', icon: '🔥', kind: 'Żywioł', max: 5,
    desc: (G, r) => `Trafieni atakiem głównym płoną: <b>${num(3 * RARITY.mult[r])}</b> obrażeń/s przez 3 s.`,
    apply: (G, r) => { G.s.burn += 3 * RARITY.mult[r]; } },
  { id: 'lod', name: 'Mróz', icon: '❄️', kind: 'Żywioł', max: 4,
    desc: (G, r) => `Trafieni atakiem głównym są spowolnieni o <b>${pct(Math.min(0.65, G.s.slow + 0.15 * RARITY.mult[r]) - G.s.slow)}</b>.`,
    apply: (G, r) => { G.s.slow = Math.min(0.65, G.s.slow + 0.15 * RARITY.mult[r]); } },
  { id: 'jad', name: 'Jad', icon: '🧪', kind: 'Żywioł', max: 5,
    desc: (G, r) => `Atak główny zatruwa. Każda warstwa: <b>${num(1.2 * RARITY.mult[r])}</b> obr./s, kumuluje się do 8 razy.`,
    apply: (G, r) => { G.s.poison += 1.2 * RARITY.mult[r]; } },
  { id: 'piorun', name: 'Łańcuch Piorunów', icon: '🌩️', kind: 'Żywioł', max: 5,
    desc: (G, r) => `<b>${pct(0.12 * RARITY.mult[r])}</b> szansy, że trafienie wyzwoli piorun skaczący po <b>${r >= 2 ? 4 : 3}</b> wrogach.`,
    apply: (G, r) => { G.s.chain += 0.12 * RARITY.mult[r]; G.s.chainJumps = Math.max(G.s.chainJumps, r >= 2 ? 4 : 3); } },

  // ---- przy zabiciu ----
  { id: 'trupy', name: 'Wybuchowe Trupy', icon: '💀', kind: 'Przy zabiciu', max: 4,
    desc: (G, r) => `<b>${pct(0.12 * RARITY.mult[r])}</b> szansy, że zabity wróg wybuchnie, raniąc pobliskich.`,
    apply: (G, r) => { G.s.explode += 0.12 * RARITY.mult[r]; } },
  { id: 'dusze', name: 'Wysysanie Dusz', icon: '👻', kind: 'Przy zabiciu', max: 4,
    desc: (G, r) => `Każde zabójstwo leczy cię o <b>${num(0.15 * RARITY.mult[r])}</b> HP.`,
    apply: (G, r) => { G.s.lifesteal += 0.15 * RARITY.mult[r]; } },
  { id: 'madrosc', name: 'Księga Mądrości', icon: '📜', kind: 'Przy zabiciu', max: 4,
    desc: (G, r) => `<b>+${pct(0.15 * RARITY.mult[r])}</b> zdobywanego doświadczenia.`,
    apply: (G, r) => { G.s.xpMult += 0.15 * RARITY.mult[r]; } },

  // ---- obrona i ruch ----
  { id: 'mury', name: 'Żelazne Zdrowie', icon: '❤️', kind: 'Obrona', max: 6,
    desc: (G, r) => `<b>+${pct(0.15 * RARITY.mult[r])}</b> maksymalnego HP (i tyle leczy).`,
    apply: (G, r) => { const add = G.p.max * 0.15 * RARITY.mult[r]; G.p.max += add; G.p.hp += add; } },
  { id: 'kolce', name: 'Kolczasta Zbroja', icon: '🌵', kind: 'Obrona', max: 4,
    desc: (G, r) => `Wrogowie, którzy cię uderzą, otrzymują <b>${num(8 * RARITY.mult[r])}</b> obrażeń.`,
    apply: (G, r) => { G.s.thorns += 8 * RARITY.mult[r]; } },
  { id: 'odnowa', name: 'Odnowa', icon: '💚', kind: 'Obrona', max: 4,
    desc: (G, r) => `Regenerujesz <b>${num(0.4 * RARITY.mult[r])}</b> HP/s.`,
    apply: (G, r) => { G.s.hpRegen += 0.4 * RARITY.mult[r]; } },
  { id: 'pancerz', name: 'Kolczuga', icon: '🛡️', kind: 'Obrona', max: 4,
    desc: (G, r) => `Otrzymujesz <b>${pct(Math.min(0.6, G.s.armor + 0.07 * RARITY.mult[r]) - G.s.armor)}</b> mniej obrażeń.`,
    apply: (G, r) => { G.s.armor = Math.min(0.6, G.s.armor + 0.07 * RARITY.mult[r]); } },
  { id: 'buty', name: 'Lekkie Buty', icon: '👢', kind: 'Ruch', max: 5,
    desc: (G, r) => `<b>+${pct(0.08 * RARITY.mult[r])}</b> szybkości chodzenia.`,
    apply: (G, r) => { G.s.moveMult += 0.08 * RARITY.mult[r]; } },
  { id: 'magnes', name: 'Magnes Dusz', icon: '🧲', kind: 'Ruch', max: 4,
    desc: (G, r) => `<b>+${pct(0.4 * RARITY.mult[r])}</b> zasięgu zbierania kryształów.`,
    apply: (G, r) => { G.s.magnet *= 1 + 0.4 * RARITY.mult[r]; } },

  // ---- klątwy: ryzyko za nagrodę ----
  { id: 'ofiara', name: 'Krwawa Ofiara', icon: '🩸', kind: 'Klątwa', max: 2,
    desc: (G, r) => `<b>+${pct(0.4 * RARITY.mult[r])}</b> obrażeń, ale tracisz <b>15%</b> maksymalnego HP.`,
    apply: (G, r) => { G.s.dmgMult += 0.4 * RARITY.mult[r]; G.p.max *= 0.85; G.p.hp = Math.min(G.p.hp, G.p.max); } },
  { id: 'pakt', name: 'Pakt Ciemności', icon: '🌑', kind: 'Klątwa', max: 2,
    desc: (G, r) => `<b>+${pct(0.35 * RARITY.mult[r])}</b> doświadczenia, ale nadchodzi <b>20%</b> więcej wrogów.`,
    apply: (G, r) => { G.s.xpMult += 0.35 * RARITY.mult[r]; G.spawnMult += 0.2; } },

  // ---- synergie: pojawiają się tylko przy konkretnych kartach ----
  { id: 'szok', name: 'Szok Termiczny', icon: '💠', kind: 'Synergia', max: 1, syn: true,
    req: G => lvlOf(G, 'ogien') && lvlOf(G, 'lod'),
    desc: () => `Płonący i zamrożeni wrogowie otrzymują <b>+60%</b> obrażeń i pękają z eksplozją przy śmierci.`,
    apply: G => { G.f.szok = true; } },
  { id: 'burza', name: 'Burza Ognia', icon: '🌋', kind: 'Synergia', max: 1, syn: true,
    req: G => (lvlOf(G, 'piorun') || wLvl(G, 'burzak')) && (lvlOf(G, 'ogien') || wLvl(G, 'miotacz')),
    desc: () => `Pioruny podpalają, a trafiając płonącego wroga wywołują wybuch. <b>+50%</b> obrażeń piorunów.`,
    apply: G => { G.f.burza = true; } },
  { id: 'grad', name: 'Grad Pocisków', icon: '🌧️', kind: 'Synergia', max: 1, syn: true,
    req: G => G.s.multi >= 3 && lvlOf(G, 'rykoszet'),
    desc: () => `Każdy pocisk ma <b>30%</b> szansy rozszczepić się na 2 przy trafieniu.`,
    apply: G => { G.f.grad = true; } },
  { id: 'krwawy', name: 'Krwawy Pakt', icon: '❣️', kind: 'Synergia', max: 1, syn: true,
    req: G => lvlOf(G, 'ofiara') && lvlOf(G, 'dusze'),
    desc: () => `Leczenie za zabójstwa <b>x2</b> i <b>+15%</b> obrażeń.`,
    apply: G => { G.s.lifesteal *= 2; G.s.dmgMult += 0.15; G.f.krwawy = true; } },
  { id: 'zaraza', name: 'Zaraza', icon: '🦠', kind: 'Synergia', max: 1, syn: true,
    req: G => lvlOf(G, 'jad') >= 2 && lvlOf(G, 'trupy'),
    desc: () => `Zatruci wrogowie po śmierci zarażają jadem wszystkich wokół.`,
    apply: G => { G.f.zaraza = true; } },
  { id: 'arsenal', name: 'Chodzący Arsenał', icon: '🛡️', kind: 'Synergia', max: 1, syn: true,
    req: G => G.weapons.length >= maxW(G),
    desc: () => `Masz pełen arsenał! Wszystkie bronie <b>+25%</b> obrażeń i atakują <b>10%</b> częściej.`,
    apply: G => { G.s.wpnDmg += 0.25; G.s.cdMult *= 0.9; } },

  // ---- ewolucje: broń na poziomie 6+ i konkretna karta ----
  { id: 'upiory', name: 'Kusza Upiorów', icon: '👻', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'balista') >= 6 && lvlOf(G, 'przebicie'),
    desc: () => `Ciężka Kusza + Przebicie: <b>upiorne bełty</b> przenikają wszystkich wrogów, +50% obrażeń.`,
    apply: G => { G.f.upiory = true; } },
  { id: 'smok', name: 'Smocze Gardło', icon: '🐉', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'miotacz') >= 6 && lvlOf(G, 'ogien'),
    desc: () => `Miotacz + Płomień: płomień sięga <b>dwa razy dalej</b>, a podpalenie jest <b>x2</b>.`,
    apply: G => { G.f.smok = true; } },
  { id: 'taniec', name: 'Taniec Ostrzy', icon: '🌀', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'pily') >= 6 && lvlOf(G, 'oko'),
    desc: () => `Ostrza + Celne Oko: <b>+3 ostrza</b>, szerszy krąg, każde cięcie jest krytyczne.`,
    apply: G => { G.f.taniec = true; } },
  { id: 'rzeznik', name: 'Topór Rzeźnika', icon: '🩸', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'topor') >= 6 && lvlOf(G, 'mury'),
    desc: () => `Topór + Żelazne Zdrowie: cięcia <b>dookoła</b>, <b>+50%</b> obrażeń, każde trafienie leczy 0,3 HP.`,
    apply: G => { G.f.rzeznik = true; } },
  { id: 'grzmot', name: 'Grzmiący Arkebuz', icon: '🧨', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'arkebuz') >= 6 && lvlOf(G, 'kuznia'),
    desc: () => `Arkebuz + Szybkie Ręce: kule <b>wybuchają</b> przy trafieniu, seria +2 kule.`,
    apply: G => { G.f.grzmot = true; } },
  { id: 'berserk', name: 'Szał Berserkera', icon: '🪓', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'siekiery') >= 6 && lvlOf(G, 'grot'),
    desc: () => `Rzucane Topory + Ostre Krawędzie: <b>dwa razy więcej</b> toporów, większe i szybsze.`,
    apply: G => { G.f.berserk = true; } },
  { id: 'swietosc', name: 'Świętość', icon: '😇', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'aura') >= 6 && lvlOf(G, 'odnowa'),
    desc: () => `Aura + Odnowa: aura <b>+30% większa</b>, leczy cię 1,5 HP/s i odpycha wrogów.`,
    apply: G => { G.f.swietosc = true; } },
  { id: 'burzastrzal', name: 'Burza Strzał', icon: '🌪️', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => wLvl(G, 'salwa') >= 6 && lvlOf(G, 'wielo'),
    desc: () => `Miotacz Strzał + Wielostrzał: każda salwa leci <b>trzy razy</b>, spiralą.`,
    apply: G => { G.f.burzastrzal = true; } },

  // ---- legendy ----
  { id: 'gniew', name: 'Gniew Niebios', icon: '🌩️', kind: 'Legenda', max: 1, minR: 3,
    desc: () => `Co 4 s z nieba bije <b>6 piorunów</b> w losowych wrogów (x6 obrażeń).`,
    apply: G => { G.f.gniew = true; G.gniewT = 1; } },
  { id: 'mistrz', name: 'Mistrz Bitwy', icon: '🏆', kind: 'Legenda', max: 1, minR: 3,
    desc: () => `Atak główny: <b>+2</b> pociski naraz i <b>+50%</b> szybkości.`,
    apply: G => { G.s.multi += 2; G.s.rateMult += 0.5; } },
  { id: 'feniks', name: 'Serce Feniksa', icon: '🔥', kind: 'Legenda', max: 1, minR: 3,
    desc: () => `Gdy polegniesz, <b>odradzasz się raz</b> z 60% HP i spalasz wszystko wokół.`,
    apply: G => { G.f.feniks = true; } },
  { id: 'siodmy', name: 'Siódma Broń', icon: '🎒', kind: 'Legenda', max: 1, minR: 3,
    desc: () => `Możesz nosić <b>o jedną broń więcej</b> (7 zamiast 6).`,
    apply: G => { G.maxW = (G.maxW || BALANCE.maxWeapons) + 1; } },
];

/* ---------------- Błogosławieństwa startowe ---------------- */
const BLESSINGS = [
  { id: 'b_mury', name: 'Żelazne Zdrowie', icon: '❤️', desc: 'Masz <b>+30%</b> maksymalnego HP.',
    apply: G => { G.p.max *= 1.3; G.p.hp = G.p.max; } },
  { id: 'b_buty', name: 'Buty Wędrowca', icon: '👢', desc: '<b>+15%</b> szybkości chodzenia.',
    apply: G => { G.s.moveMult += 0.15; } },
  { id: 'b_topor', name: 'Topór Dziadka', icon: '🪓', desc: 'Zaczynasz z <b>Toporem Bojowym</b>.',
    apply: G => addWeapon(G, 'topor', 0) },
  { id: 'b_arkebuz', name: 'Stary Arkebuz', icon: '🔫', desc: 'Zaczynasz z <b>Arkebuzem</b>.',
    apply: G => addWeapon(G, 'arkebuz', 0) },
  { id: 'b_pily', name: 'Ostrza Kowala', icon: '⚙️', desc: 'Zaczynasz z <b>Wirującymi Ostrzami</b>.',
    apply: G => addWeapon(G, 'pily', 0) },
  { id: 'b_kruk', name: 'Kruk Zwiadowca', icon: '🐦‍⬛', desc: 'Zaczynasz ze <b>Stadem Kruków</b>.',
    apply: G => addWeapon(G, 'kruki', 0) },
  { id: 'b_nauka', name: 'Szybka Nauka', icon: '📜', desc: '<b>+25%</b> doświadczenia przez całą grę.',
    apply: G => { G.s.xpMult += 0.25; } },
  { id: 'b_ostre', name: 'Kowal Wojenny', icon: '⚒️', desc: '<b>+20%</b> obrażeń przez całą grę.',
    apply: G => { G.s.dmgMult += 0.2; } },
  { id: 'b_los', name: 'Łaska Losu', icon: '🎲', desc: '<b>+2</b> przelosowania kart.',
    apply: G => { G.rerolls += 2; } },
];
