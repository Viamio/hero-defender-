'use strict';
/* =====================================================================
   WIEŻA NIESKOŃCZONOŚCI — dane gry
   Wszystkie liczby balansu są tutaj, żeby łatwo je stroić.
   ===================================================================== */

const BALANCE = {
  heroHp: 120,
  heroSpeed: 150,
  magnet: 120,           // zasięg przyciągania kryształów
  maxWeapons: 5,        // ile dodatkowych broni może mieć bohater
  waveLen: 24,          // sekundy jednej fali
  spawnWindow: 19,      // w ciągu ilu sekund fala wypuszcza wrogów
  bossEvery: 5,         // boss co tyle fal
  regenPerWave: 0.05,   // leczenie bohatera na start fali (ułamek max HP)
  rerolls: 2,
  pityLevels: 12,       // po tylu levelach bez rzadkiej karty – gwarancja
  maxEnemies: 260,
  // jak rośnie trudność
  hpMult: w => 1 + 0.16 * (w - 1) + 0.012 * (w - 1) * (w - 1),
  dmgMult: w => 1 + 0.06 * (w - 1),
  xpMult: w => 1 + 0.04 * (w - 1),
  waveCount: w => Math.min(170, Math.round(22 + w * 3.6 + w * w * 0.06)),
  xpNeed: L => Math.round(2 + 1.8 * L + 0.3 * Math.pow(L, 1.9)),
};

// Szanse rzadkości: 84 / 10 / 5 / 1
const RARITY = {
  names: ['POSPOLITA', 'RZADKA', 'EPICKA', 'LEGENDARNA'],
  mult: [1, 1.6, 2.4, 3.5],
  roll(min = 0) {
    if (min >= 1) { // skrzynia bossa / gwarancja
      const x = Math.random() * 100;
      return x < 6 ? 3 : x < 30 ? 2 : 1;
    }
    const x = Math.random() * 100;
    return x < 1 ? 3 : x < 6 ? 2 : x < 16 ? 1 : 0;
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
  return list;
}

/* ---------------- Klasy ---------------- */
const CLASSES = [
  { id: 'archer', name: 'Łucznik', icon: '🏹', desc: 'Szybkie, celne strzały. Umiejętność: Deszcz Strzał.', open: true },
  { id: 'berserker', name: 'Berserker', icon: '🪓', desc: 'Rzuca ciężkimi siekierami. W przygotowaniu.', soon: true },
  { id: 'mage', name: 'Mag', icon: '🔮', desc: 'Kule ognia na hordy. W przygotowaniu.', soon: true },
  { id: 'hunter', name: 'Łowca Demonów', icon: '⚔️', desc: 'Odblokuj: pokonaj łącznie 5 bossów.', locked: true },
  { id: 'necro', name: 'Nekromanta', icon: '💀', desc: 'Odblokuj: zabij łącznie 5000 wrogów.', locked: true },
  { id: 'alch', name: 'Alchemik', icon: '⚗️', desc: 'Odblokuj: przetrwaj 25 fal w jednej grze.', locked: true },
  { id: 'storm', name: 'Kapłan Burzy', icon: '⚡', desc: 'Odblokuj: dojdź do fali 15 każdą klasą startową.', locked: true },
];

/* ---------------- Pomocnicze ---------------- */
const pct = v => Math.round(v * 100) + '%';
const num = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
const lvlOf = (G, id) => G.cards[id] || 0;
const turretOf = (G, type) => G.turrets.find(t => t.type === type);

function addTurret(G, type, r) {
  let t = turretOf(G, type);
  const m = RARITY.mult[r];
  if (t) { t.lvl += r >= 2 ? 2 : 1; t.pow += 0.45 * m; return; }
  if (G.turrets.length >= BALANCE.maxWeapons) return;
  G.turrets.push({ type, lvl: 1, pow: m, cd: 0.5, ang: -Math.PI / 2, fire: 0 });
}
const weaponReq = type => G => turretOf(G, type) || G.turrets.length < BALANCE.maxWeapons;
function turretDesc(G, type, r, base) {
  const t = turretOf(G, type);
  const m = RARITY.mult[r];
  if (!t) return 'Nowa broń: ' + base + ` Siła <b>${pct(m)}</b>.`;
  return `Ulepszenie: poziom <b>${t.lvl} → ${t.lvl + (r >= 2 ? 2 : 1)}</b>, siła <b>+${pct(0.45 * m)}</b>.`;
}

/* ---------------- Karty ----------------
   kind: Statystyka | Modyfikator | Żywioł | Wieżyczka | Towarzysz | Przy zabiciu | Obrona | Klątwa | Synergia | Legenda
   minR/maxR – w jakich rzadkościach karta może wypaść
   r – wylosowana rzadkość (0-3), m – mnożnik rzadkości
----------------------------------------------------------------- */
const CARDS = [
  // ---- statystyki (celowo mniej, żeby nie zaśmiecały) ----
  { id: 'grot', name: 'Ostre Groty', icon: '🗡️', kind: 'Statystyka', max: 8,
    desc: (G, r) => `<b>+${pct(0.15 * RARITY.mult[r])}</b> obrażeń wszystkich ataków.`,
    apply: (G, r) => { G.s.dmgMult += 0.15 * RARITY.mult[r]; } },
  { id: 'cieciwa', name: 'Napięta Cięciwa', icon: '🏹', kind: 'Statystyka', max: 8,
    desc: (G, r) => `<b>+${pct(0.12 * RARITY.mult[r])}</b> szybkości strzelania.`,
    apply: (G, r) => { G.s.rateMult += 0.12 * RARITY.mult[r]; } },

  // ---- modyfikatory ataku ----
  { id: 'przebicie', name: 'Strzała Przebijająca', icon: '➶', kind: 'Modyfikator', max: 4,
    desc: (G, r) => `Strzały przebijają <b>+${1 + (r >= 2 ? 1 : 0) + (r >= 3 ? 1 : 0)}</b> wroga.`,
    apply: (G, r) => { G.s.pierce += 1 + (r >= 2 ? 1 : 0) + (r >= 3 ? 1 : 0); } },
  { id: 'wielo', name: 'Wielostrzał', icon: '🔱', kind: 'Modyfikator', max: 4,
    desc: (G, r) => `Wystrzeliwujesz <b>+${r >= 2 ? 2 : 1}</b> strzałę naraz${r === 1 ? ', <b>+10%</b> obrażeń' : ''}.`,
    apply: (G, r) => { G.s.multi += r >= 2 ? 2 : 1; if (r === 1) G.s.dmgMult += 0.1; } },
  { id: 'rykoszet', name: 'Rykoszet', icon: '↯', kind: 'Modyfikator', max: 3,
    desc: (G, r) => `Strzały odbijają się do <b>+${r >= 2 ? 2 : 1}</b> kolejnego wroga.`,
    apply: (G, r) => { G.s.ricochet += r >= 2 ? 2 : 1; } },
  { id: 'oko', name: 'Celne Oko', icon: '🎯', kind: 'Modyfikator', max: 5,
    desc: (G, r) => `<b>+${pct(0.07 * RARITY.mult[r])}</b> szansy na trafienie krytyczne${r >= 2 ? ', krytyki <b>+50%</b> mocniejsze' : ''}.`,
    apply: (G, r) => { G.s.crit += 0.07 * RARITY.mult[r]; if (r >= 2) G.s.critMult += 0.5; } },
  { id: 'ostatnia', name: 'Ostatnia Strzała', icon: '🌠', kind: 'Modyfikator', max: 3, minR: 1,
    desc: (G, r) => `Co <b>${Math.max(8, 20 - 4 * lvlOf(G, 'ostatnia'))}</b> strzałów wypuszczasz złotą strzałę przez cały ekran (<b>x${num(6 * RARITY.mult[r])}</b> obrażeń).`,
    apply: (G, r) => { G.s.bigEvery = Math.max(8, 20 - 4 * (lvlOf(G, 'ostatnia') - 1)); G.s.bigMult = Math.max(G.s.bigMult, 6 * RARITY.mult[r]); } },

  // ---- żywioły ----
  { id: 'ogien', name: 'Płonące Groty', icon: '🔥', kind: 'Żywioł', max: 5,
    desc: (G, r) => `Trafieni wrogowie płoną: <b>${num(3 * RARITY.mult[r])}</b> obrażeń/s przez 3 s.`,
    apply: (G, r) => { G.s.burn += 3 * RARITY.mult[r]; } },
  { id: 'lod', name: 'Lodowe Groty', icon: '❄️', kind: 'Żywioł', max: 4,
    desc: (G, r) => `Trafieni wrogowie są spowolnieni o <b>${pct(Math.min(0.65, G.s.slow + 0.15 * RARITY.mult[r]) - G.s.slow)}</b>.`,
    apply: (G, r) => { G.s.slow = Math.min(0.65, G.s.slow + 0.15 * RARITY.mult[r]); } },
  { id: 'jad', name: 'Jad', icon: '🧪', kind: 'Żywioł', max: 5,
    desc: (G, r) => `Strzały zatruwają. Każda warstwa: <b>${num(1.2 * RARITY.mult[r])}</b> obr./s, kumuluje się do 8 razy.`,
    apply: (G, r) => { G.s.poison += 1.2 * RARITY.mult[r]; } },
  { id: 'piorun', name: 'Strzała Łańcuchowa', icon: '⚡', kind: 'Żywioł', max: 5,
    desc: (G, r) => `<b>${pct(0.12 * RARITY.mult[r])}</b> szansy, że trafienie wyzwoli piorun skaczący po <b>${r >= 2 ? 4 : 3}</b> wrogach.`,
    apply: (G, r) => { G.s.chain += 0.12 * RARITY.mult[r]; G.s.chainJumps = Math.max(G.s.chainJumps, r >= 2 ? 4 : 3); } },

  // ---- przy zabiciu ----
  { id: 'trupy', name: 'Wybuchowe Trupy', icon: '💥', kind: 'Przy zabiciu', max: 4,
    desc: (G, r) => `<b>${pct(0.12 * RARITY.mult[r])}</b> szansy, że zabity wróg wybuchnie, raniąc pobliskich.`,
    apply: (G, r) => { G.s.explode += 0.12 * RARITY.mult[r]; } },
  { id: 'dusze', name: 'Wysysanie Dusz', icon: '👻', kind: 'Przy zabiciu', max: 4,
    desc: (G, r) => `Każde zabójstwo leczy wieżę o <b>${num(0.4 * RARITY.mult[r])}</b> HP.`,
    apply: (G, r) => { G.s.lifesteal += 0.4 * RARITY.mult[r]; } },
  { id: 'madrosc', name: 'Księga Mądrości', icon: '📜', kind: 'Przy zabiciu', max: 4,
    desc: (G, r) => `<b>+${pct(0.15 * RARITY.mult[r])}</b> zdobywanego doświadczenia.`,
    apply: (G, r) => { G.s.xpMult += 0.15 * RARITY.mult[r]; } },

  // ---- obrona wieży ----
  { id: 'mury', name: 'Żelazne Zdrowie', icon: '❤️', kind: 'Obrona', max: 6,
    desc: (G, r) => `<b>+${pct(0.15 * RARITY.mult[r])}</b> maksymalnego HP bohatera (i tyle leczy).`,
    apply: (G, r) => { const add = G.p.max * 0.15 * RARITY.mult[r]; G.p.max += add; G.p.hp += add; } },
  { id: 'kolce', name: 'Kolczasta Zbroja', icon: '🌵', kind: 'Obrona', max: 4,
    desc: (G, r) => `Wrogowie, którzy cię uderzą, otrzymują <b>${num(8 * RARITY.mult[r])}</b> obrażeń.`,
    apply: (G, r) => { G.s.thorns += 8 * RARITY.mult[r]; } },
  { id: 'odnowa', name: 'Odnowa', icon: '💚', kind: 'Obrona', max: 4,
    desc: (G, r) => `Bohater regeneruje <b>${num(0.4 * RARITY.mult[r])}</b> HP/s.`,
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

  // ---- bronie (działają same, obok łuku) ----
  { id: 'balista', name: 'Ciężka Kusza', icon: '⚔️', kind: 'Broń', max: 6,
    req: weaponReq('balista'),
    desc: (G, r) => turretDesc(G, 'balista', r, 'ciężkie bełty w najsilniejszego wroga, przebijają 3 cele.'),
    apply: (G, r) => addTurret(G, 'balista', r) },
  { id: 'miotacz', name: 'Miotacz Ognia', icon: '♨️', kind: 'Broń', max: 6,
    req: weaponReq('miotacz'),
    desc: (G, r) => turretDesc(G, 'miotacz', r, 'zieje ogniem w pobliskich wrogów i ich podpala.'),
    apply: (G, r) => addTurret(G, 'miotacz', r) },
  { id: 'pily', name: 'Wirujące Ostrza', icon: '⚙️', kind: 'Broń', max: 6,
    req: weaponReq('pily'),
    desc: (G, r) => turretDesc(G, 'pily', r, 'ostrza krążą wokół bohatera i tną podchodzących wrogów.'),
    apply: (G, r) => addTurret(G, 'pily', r) },
  { id: 'kociol', name: 'Garnce Smoły', icon: '⚱️', kind: 'Broń', max: 6,
    req: weaponReq('kociol'),
    desc: (G, r) => turretDesc(G, 'kociol', r, 'rzuca garnce smoły: kałuża spowalnia o 50% i parzy.'),
    apply: (G, r) => addTurret(G, 'kociol', r) },
  { id: 'kruk', name: 'Kruk', icon: '🐦', kind: 'Towarzysz', max: 5,
    desc: (G, r) => `${G.ravens.length ? 'Kolejny kruk' : 'Kruk krąży nad polem i'} dziobie wrogów. Siła <b>${pct(RARITY.mult[r])}</b>.`,
    apply: (G, r) => { G.ravens.push({ x: G.p.x, y: G.p.y - 60, pow: RARITY.mult[r], cd: 0, tgt: null, a: Math.random() * 6 }); } },

  // ---- synergie: pojawiają się tylko przy konkretnych kartach ----
  { id: 'szok', name: 'Szok Termiczny', icon: '💠', kind: 'Synergia', max: 1, syn: true,
    req: G => lvlOf(G, 'ogien') && lvlOf(G, 'lod'),
    desc: () => `Płonący i zamrożeni wrogowie otrzymują <b>+60%</b> obrażeń i pękają z eksplozją przy śmierci.`,
    apply: G => { G.f.szok = true; } },
  { id: 'burza', name: 'Burza Ognia', icon: '🌩️', kind: 'Synergia', max: 1, syn: true,
    req: G => lvlOf(G, 'piorun') && lvlOf(G, 'ogien'),
    desc: () => `Pioruny podpalają, a trafiając płonącego wroga wywołują wybuch. <b>+50%</b> obrażeń piorunów.`,
    apply: G => { G.f.burza = true; } },
  { id: 'grad', name: 'Grad Strzał', icon: '🌧️', kind: 'Synergia', max: 1, syn: true,
    req: G => G.s.multi >= 3 && lvlOf(G, 'rykoszet'),
    desc: () => `Każda strzała ma <b>30%</b> szansy rozszczepić się na 2 przy trafieniu.`,
    apply: G => { G.f.grad = true; } },
  { id: 'krwawy', name: 'Krwawy Pakt', icon: '❣️', kind: 'Synergia', max: 1, syn: true,
    req: G => lvlOf(G, 'ofiara') && lvlOf(G, 'dusze'),
    desc: () => `Leczenie za zabójstwa <b>x2</b> i <b>+15%</b> obrażeń.`,
    apply: G => { G.s.lifesteal *= 2; G.s.dmgMult += 0.15; G.f.krwawy = true; } },
  { id: 'zaraza', name: 'Zaraza', icon: '🦠', kind: 'Synergia', max: 1, syn: true,
    req: G => lvlOf(G, 'jad') >= 2 && lvlOf(G, 'trupy'),
    desc: () => `Zatruci wrogowie po śmierci zarażają jadem wszystkich wokół.`,
    apply: G => { G.f.zaraza = true; } },

  // ---- legendy i ewolucje ----
  { id: 'upiory', name: 'Kusza Upiorów', icon: '👻', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => (turretOf(G, 'balista') || {}).lvl >= 3 && lvlOf(G, 'przebicie'),
    desc: () => `Kusza + Przebicie: wystrzeliwuje <b>3 upiorne bełty</b>, które przenikają wszystkich wrogów.`,
    apply: G => { G.f.upiory = true; } },
  { id: 'smok', name: 'Smocze Gardło', icon: '🐉', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => (turretOf(G, 'miotacz') || {}).lvl >= 2 && lvlOf(G, 'ogien'),
    desc: () => `Miotacz + Ogień: płomień sięga <b>dwa razy dalej</b>, szerszym strumieniem, a podpalenie jest <b>x2</b>.`,
    apply: G => { G.f.smok = true; } },
  { id: 'taniec', name: 'Taniec Ostrzy', icon: '🌀', kind: 'Ewolucja', max: 1, evo: true, minR: 3,
    req: G => (turretOf(G, 'pily') || {}).lvl >= 3 && lvlOf(G, 'oko'),
    desc: () => `Ostrza + Celne Oko: <b>+3 ostrza</b>, szerszy krąg, każde cięcie jest krytyczne.`,
    apply: G => { G.f.taniec = true; } },
  { id: 'gniew', name: 'Gniew Niebios', icon: '🌩️', kind: 'Legenda', max: 1, minR: 3,
    desc: () => `Co 4 s z nieba bije <b>6 piorunów</b> w losowych wrogów (x6 obrażeń).`,
    apply: G => { G.f.gniew = true; G.gniewT = 1; } },
  { id: 'mistrz', name: 'Mistrz Łuku', icon: '🏆', kind: 'Legenda', max: 1, minR: 3,
    desc: () => `<b>+2</b> strzały naraz i <b>+50%</b> szybkości strzelania.`,
    apply: G => { G.s.multi += 2; G.s.rateMult += 0.5; } },
  { id: 'feniks', name: 'Serce Feniksa', icon: '🔆', kind: 'Legenda', max: 1, minR: 3,
    desc: () => `Gdy polegniesz, <b>odradzasz się raz</b> z 60% HP i spalasz wszystko wokół.`,
    apply: G => { G.f.feniks = true; } },
];

/* ---------------- Błogosławieństwa startowe ---------------- */
const BLESSINGS = [
  { id: 'b_mury', name: 'Żelazne Zdrowie', icon: '❤️', desc: 'Masz <b>+30%</b> maksymalnego HP.',
    apply: G => { G.p.max *= 1.3; G.p.hp = G.p.max; } },
  { id: 'b_buty', name: 'Buty Wędrowca', icon: '👢', desc: '<b>+15%</b> szybkości chodzenia.',
    apply: G => { G.s.moveMult += 0.15; } },
  { id: 'b_balista', name: 'Stara Kusza', icon: '⚔️', desc: 'Zaczynasz z <b>Ciężką Kuszą</b>.',
    apply: G => { addTurret(G, 'balista', 0); G.cards.balista = 1; } },
  { id: 'b_kruk', name: 'Kruk Zwiadowca', icon: '🐦', desc: 'Zaczynasz z <b>Krukiem</b>, który atakuje wrogów.',
    apply: G => { CARDS.find(c => c.id === 'kruk').apply(G, 0); G.cards.kruk = 1; } },
  { id: 'b_nauka', name: 'Szybka Nauka', icon: '📜', desc: '<b>+25%</b> doświadczenia przez całą grę.',
    apply: G => { G.s.xpMult += 0.25; } },
  { id: 'b_ostre', name: 'Kowal Grotów', icon: '🗡️', desc: '<b>+20%</b> obrażeń przez całą grę.',
    apply: G => { G.s.dmgMult += 0.2; } },
  { id: 'b_ogien', name: 'Żar w Kołczanie', icon: '🔥', desc: 'Zaczynasz z <b>Płonącymi Grotami</b>.',
    apply: G => { CARDS.find(c => c.id === 'ogien').apply(G, 0); G.cards.ogien = 1; } },
  { id: 'b_los', name: 'Łaska Losu', icon: '🎲', desc: '<b>+2</b> przelosowania kart.',
    apply: G => { G.rerolls += 2; } },
];
