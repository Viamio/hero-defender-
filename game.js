'use strict';
/* =====================================================================
   WIEŻA NIESKOŃCZONOŚCI – logika gry
   Bohater chodzi po nieskończonej mapie i sam atakuje najbliższe potwory.
   ===================================================================== */

const W = 540;
let H = 960, SCALE = 1, DPR = 1;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

let G = null;              // stan rozgrywki (null = menu)
let SAVE = loadSave();
SFX.on = SAVE.sound !== false;
const cam = { x: -W / 2, y: -480 };

/* ---------------- Zapis ---------------- */
function loadSave() {
  try { return JSON.parse(localStorage.getItem('ow_save')) || {}; } catch (e) { return {}; }
}
function storeSave() { try { localStorage.setItem('ow_save', JSON.stringify(SAVE)); } catch (e) {} }

/* ---------------- Rozmiar ekranu ---------------- */
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  H = clamp(Math.round(W * vh / vw), 860, 1170);
  SCALE = Math.min(vw / W, vh / H);
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const gw = Math.round(W * SCALE), gh = Math.round(H * SCALE);
  const box = $('game');
  box.style.width = gw + 'px'; box.style.height = gh + 'px';
  cv.width = Math.round(gw * DPR); cv.height = Math.round(gh * DPR);
  buildGround(Math.min(SCALE * DPR, 2));
}
window.addEventListener('resize', resize);

/* ---------------- Sterowanie: joystick pod palcem ---------------- */
const JOY_R = 58;
const input = { down: false, id: null, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0 };
function toScreen(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
cv.addEventListener('pointerdown', e => {
  SFX.init();
  if (input.id !== null) return;
  const p = toScreen(e);
  input.id = e.pointerId; input.down = true;
  input.bx = input.x = p.x; input.by = input.y = p.y; input.dx = input.dy = 0;
  if (G && !G.touched) { G.touched = true; $('hint').classList.add('hidden'); }
});
window.addEventListener('pointermove', e => {
  if (e.pointerId !== input.id) return;
  const p = toScreen(e);
  let dx = p.x - input.bx, dy = p.y - input.by;
  const d = Math.hypot(dx, dy);
  // podążająca baza: gdy palec ucieknie daleko, joystick idzie za nim
  if (d > JOY_R) { input.bx += dx / d * (d - JOY_R); input.by += dy / d * (d - JOY_R); dx = p.x - input.bx; dy = p.y - input.by; }
  input.x = p.x; input.y = p.y;
  const dd = Math.hypot(dx, dy);
  const k = dd < 6 ? 0 : Math.min(1, dd / (JOY_R * 0.75));
  input.dx = dd ? dx / dd * k : 0; input.dy = dd ? dy / dd * k : 0;
});
const release = e => { if (e.pointerId === input.id) { input.id = null; input.down = false; input.dx = input.dy = 0; } };
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
// klawiatura (do grania na komputerze)
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === ' ') useSkill(); if (e.key === 'Escape') openPause(); });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && !G.modal) openPause(); });

function vib(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

/* =====================================================================
   NOWA GRA
   ===================================================================== */
function newGame(cls) {
  G = {
    cls, t: 0, wave: 0, waveT: 0, clearT: 0, spawnQ: [], spawnMult: 1,
    enemies: [], arrows: [], eShots: [], parts: [], nums: [], orbs: [], pickups: [], pools: [], lobs: [], bolts: [], rains: [],
    p: { x: 0, y: 0, vx: 0, vy: 0, r: 16, hp: BALANCE.heroHp, max: BALANCE.heroHp, ang: -Math.PI / 2, cd: 0, draw: 0, walk: 0, iT: 0, hurtT: 0 },
    s: { dmg: 10, rate: 2.4, speed: 900, range: 340, pierce: 0, multi: 1, ricochet: 0, crit: 0.05, critMult: 2,
         burn: 0, slow: 0, poison: 0, chain: 0, chainJumps: 3, explode: 0, lifesteal: 0, xpMult: 1,
         thorns: 0, armor: 0, hpRegen: 0, dmgMult: 1, rateMult: 1, bigEvery: 0, bigMult: 0,
         moveMult: 1, magnet: BALANCE.magnet },
    f: {}, cards: {}, cardRar: {}, turrets: [], ravens: [],
    level: 1, xp: 0, xpNeed: BALANCE.xpNeed(1), pending: 0, sinceRare: 0,
    kills: 0, bossKills: 0, rerolls: BALANCE.rerolls, shots: 0,
    skill: { cd: 3, max: 14 }, shake: 0, hurt: 0, banner: null, boss: null, bossIdx: 0,
    modal: null, over: false, overT: 0, touched: false, gniewT: 0,
  };
  cam.x = -W / 2; cam.y = -H * 0.5;
  input.down = false; input.id = null; input.dx = input.dy = 0;
  showHud(true);
  $('hint').classList.remove('hidden');
  updateHud();
  const pool = [...BLESSINGS].sort(() => Math.random() - 0.5).slice(0, 3);
  openCards('blessing', pool.map(b => ({ bless: b, r: 0 })));
}

/* =====================================================================
   FALE
   ===================================================================== */
function nextWave() {
  G.wave++; G.waveT = 0; G.clearT = 0;
  const w = G.wave;
  if (w > 1) healHero(G.p.max * BALANCE.regenPerWave, true);
  const n = Math.round(BALANCE.waveCount(w) * G.spawnMult);
  const weights = waveWeights(w);
  const total = weights.reduce((s, x) => s + x[1], 0);
  let made = 0;
  while (made < n) {
    let x = Math.random() * total, type = 'skeleton';
    for (const [k, v] of weights) { if ((x -= v) <= 0) { type = k; break; } }
    const t = BALANCE.spawnWindow * Math.pow(made / n, 0.9) + rand(0, 0.6);
    if (type === 'spider') {
      const g = 3 + Math.floor(w / 5) + (Math.random() * 2 | 0);
      const ang = rand(0, TAU);
      for (let i = 0; i < g; i++) G.spawnQ.push({ t: t + i * 0.08, type, ang: ang + rand(-0.15, 0.15) });
      made += g;
    } else { G.spawnQ.push({ t, type }); made++; }
  }
  // co kilka fal: okrążenie (pierścień wrogów dookoła bohatera)
  if (w >= 6 && w % 4 === 2) {
    const ringN = 18 + w;
    for (let i = 0; i < ringN; i++) G.spawnQ.push({ t: 10, type: 'skeleton', ang: i * TAU / ringN, ring: true });
  }
  if (w >= 4 && w % 3 === 1) G.spawnQ.push({ t: 8, type: w >= 8 ? 'ghoul' : 'skeleton', elite: true });
  G.spawnQ.sort((a, b) => a.t - b.t);
  if (w % BALANCE.bossEvery === 0) {
    const B = BOSSES[G.bossIdx % BOSSES.length];
    G.spawnQ.unshift({ t: 2.6, type: 'boss', boss: B });
    banner('⚠ BOSS ⚠', B.name, '#ff4040', 2.6);
    SFX.boss(); vib([80, 60, 80, 60, 200]);
    G.hurt = Math.max(G.hurt, 0.5);
  } else {
    banner('FALA ' + w, w === 1 ? 'Nadchodzą...' : '', '#ffb347', 1.6);
    SFX.wave();
  }
  updateHud();
}

// pozycja tuż za krawędzią ekranu, w kierunku ang od bohatera
function edgePos(ang, extra = 40) {
  const P = G.p;
  const hw = W / 2 + extra, hh = H / 2 + extra;
  const cx = Math.cos(ang), cy = Math.sin(ang);
  const t = Math.min(hw / Math.abs(cx || 1e-6), hh / Math.abs(cy || 1e-6));
  return { x: P.x + cx * t, y: P.y + cy * t };
}
function spawnAng() {
  // lekko częściej z przodu (w kierunku ruchu), żeby nie dało się uciekać w nieskończoność
  const P = G.p;
  if ((P.vx || P.vy) && Math.random() < 0.45) return Math.atan2(P.vy, P.vx) + rand(-0.9, 0.9);
  return rand(0, TAU);
}
function spawnEnemy(type, opts = {}) {
  const w = G.wave;
  let D, isBoss = false;
  if (type === 'boss') { D = opts.boss; isBoss = true; type = D.id; }
  else D = ENEMIES[type];
  let p;
  if (opts.x !== undefined) p = { x: opts.x, y: opts.y };
  else if (opts.ring) p = { x: G.p.x + Math.cos(opts.ang) * 460, y: G.p.y + Math.sin(opts.ang) * 460 };
  else p = edgePos(opts.ang !== undefined ? opts.ang : spawnAng(), isBoss ? 60 : 40);
  let hp = D.hp * BALANCE.hpMult(w);
  if (isBoss) hp *= 1 + G.bossIdx * 0.25;
  const e = {
    type, x: p.x, y: p.y, vx: 0, vy: 0, r: D.r, hp, max: hp, spd: D.spd * rand(0.9, 1.1),
    dmg: D.dmg * BALANCE.dmgMult(w), rate: D.rate, atk: 0, xp: D.xp * BALANCE.xpMult(w),
    range: D.range || 0, fly: !!D.fly, bar: !!D.bar, anim: Math.random() * 10, flash: 0,
    burnT: 0, burnDps: 0, poisonS: 0, poisonT: 0, slowT: 0, slowAmt: 0, dotT: 0, acc: 0, accT: 0,
    boss: isBoss, special: D.special || 0, specT: (D.special || 0) * 0.6, name: D.name,
  };
  if (opts.elite) { e.elite = true; e.hp = e.max = hp * 6; e.r *= 1.35; e.dmg *= 1.6; e.xp *= 8; e.bar = true; }
  if (isBoss) {
    G.boss = e; G.bossIdx++;
    $('bossName').textContent = D.name.toUpperCase();
    $('bossBar').classList.remove('hidden');
  }
  G.enemies.push(e);
  return e;
}

/* =====================================================================
   WALKA
   ===================================================================== */
function baseDmg() { return G.s.dmg * G.s.dmgMult; }

function hurt(e, amt, o = {}) {
  if (e.dead) return;
  if (G.f.szok && e.burnT > 0 && e.slowT > 0) amt *= 1.6;
  let crit = false;
  if (o.canCrit && (Math.random() < G.s.crit || o.forceCrit)) { amt *= G.s.critMult; crit = true; }
  e.hp -= amt; if (e.flash < -0.1 || !e.boss) e.flash = e.boss ? 0.05 : 0.09;
  if (o.knock && !e.boss) { e.kx = (e.kx || 0) + o.knock.x; e.ky = (e.ky || 0) + o.knock.y; }
  if (o.quiet) e.acc += amt;
  else {
    floatNum(e.x + rand(-6, 6), e.y - e.r - 6, amt, crit ? '#ffe14a' : (o.col || '#ffffff'), crit ? 1.45 : (o.size || 1));
    if (crit) SFX.crit(); else SFX.hit();
  }
  if (e.hp <= 0) killEnemy(e);
  return crit;
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; G.kills++;
  const n = e.boss ? 40 : e.elite ? 20 : 8;
  const col = e.type === 'skeleton' ? '#e8e0cc' : e.type === 'spider' || e.type === 'queen' ? '#7a1020' : e.type === 'cultist' || e.type === 'priest' ? '#6a2a8a' : '#5a6a4a';
  for (let i = 0; i < n; i++) part(e.x, e.y, rand(-160, 160), rand(-200, 40), rand(0.3, 0.7), rand(2, 4.5), col, false, 400);
  for (let i = 0; i < n / 2; i++) part(e.x, e.y, rand(-60, 60), rand(-90, -20), rand(0.4, 0.9), rand(3, 7), 'rgba(255,90,40,.6)', true);
  SFX.kill();
  // kryształy doświadczenia
  const orbs = e.boss ? 14 : e.elite ? 6 : 1;
  for (let i = 0; i < orbs; i++) dropOrb(e.x + rand(-12, 12), e.y + rand(-12, 12), e.xp / orbs);
  // znajdźki
  if (e.boss || e.elite) { G.pickups.push({ x: e.x + 20, y: e.y, type: 'heart' }); G.pickups.push({ x: e.x - 20, y: e.y, type: 'magnet' }); }
  else if (Math.random() < 0.012) G.pickups.push({ x: e.x, y: e.y, type: 'heart' });
  else if (Math.random() < 0.004) G.pickups.push({ x: e.x, y: e.y, type: 'magnet' });
  // efekty przy zabiciu
  if (G.s.lifesteal) healHero(G.s.lifesteal * 0.4);
  if (G.s.explode && Math.random() < G.s.explode) explode(e.x, e.y, 70, baseDmg() * 1.5, '#ff8a2a');
  if (G.f.szok && e.burnT > 0 && e.slowT > 0) explode(e.x, e.y, 60, baseDmg() * 1.2, '#7ae0ff');
  if (G.f.zaraza && e.poisonS > 0) {
    for (const o2 of G.enemies) if (!o2.dead && dist2(o2, e) < 90 * 90) { o2.poisonS = Math.min(8, o2.poisonS + Math.ceil(e.poisonS / 2)); o2.poisonT = 4; }
    part(e.x, e.y, 0, 0, 0.5, 40, 'rgba(120,255,80,.25)', true, 0, true);
  }
  if (e.boss) {
    G.boss = null; G.bossKills++; $('bossBar').classList.add('hidden');
    banner('BOSS POKONANY', 'Skrzynia skarbów!', '#ffc83a', 2);
    G.shake = 16; vib([100, 50, 150]); SFX.legend();
    G.chest = (G.chest || 0) + 1;
  } else if (e.elite) { G.chest = (G.chest || 0) + 1; SFX.legend(); }
}

function dropOrb(x, y, val) {
  // przy bardzo wielu kryształach łączymy je, żeby gra nie zwalniała
  if (G.orbs.length > 220) {
    const o = G.orbs[Math.random() * G.orbs.length | 0];
    o.val += val; o.big = o.val >= 3; return;
  }
  G.orbs.push({ x, y, val, big: val >= 3, t: 0, pull: false, bob: Math.random() * 6 });
}

function applyOnHit(e) {
  const s = G.s;
  if (s.burn) { e.burnT = 3; e.burnDps = Math.max(e.burnDps, s.burn * (G.f.smok ? 1.5 : 1)); }
  if (s.slow) { e.slowT = 2; e.slowAmt = Math.max(e.slowAmt, s.slow); }
  if (s.poison) { e.poisonS = Math.min(8, e.poisonS + 1); e.poisonT = 4; }
  if (s.chain && Math.random() < s.chain) chainLightning(e, s.chainJumps, baseDmg() * 0.8 * (G.f.burza ? 1.5 : 1));
}

function chainLightning(e0, jumps, dmg) {
  const hit = new Set([e0]);
  let cur = e0;
  const pts = [[e0.x, e0.y]];
  for (let j = 0; j < jumps; j++) {
    let best = null, bd = 170 * 170;
    for (const o of G.enemies) { if (o.dead || hit.has(o)) continue; const d = dist2(o, cur); if (d < bd) { bd = d; best = o; } }
    if (!best) break;
    hit.add(best); pts.push([best.x, best.y]);
    if (G.f.burza) {
      if (best.burnT > 0) explode(best.x, best.y, 45, dmg * 0.6, '#ff9a3a', true);
      best.burnT = 3; best.burnDps = Math.max(best.burnDps, G.s.burn || 4);
    }
    hurt(best, dmg, { col: '#9ad8ff' });
    cur = best;
  }
  if (pts.length > 1) { G.bolts.push({ pts: jag(pts), t: 0.22, col: '#a8e0ff' }); SFX.zap(); }
}
function jag(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    for (let k = 0; k < 5; k++) { const t = k / 5; out.push([x1 + (x2 - x1) * t + (k ? rand(-8, 8) : 0), y1 + (y2 - y1) * t + (k ? rand(-8, 8) : 0)]); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function explode(x, y, r, dmg, col, small) {
  for (const e of G.enemies) if (!e.dead && dist2(e, { x, y }) < (r + e.r) ** 2) hurt(e, dmg, { col: '#ffb347' });
  const n = small ? 10 : 22;
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(60, 260); part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.25, 0.55), rand(4, 9), col, true); }
  part(x, y, 0, 0, 0.25, r, col, true, 0, true);
  if (!small) { G.shake = Math.max(G.shake, 5); SFX.boom(); }
}

function damageHero(amt, src) {
  if (G.over || G.p.iT > 0) return;
  amt *= 1 - G.s.armor;
  const P = G.p;
  P.hp -= amt; P.iT = 0.3; P.hurtT = 0.3;
  G.hurt = Math.min(1, G.hurt + 0.3);
  G.shake = Math.max(G.shake, 3 + Math.min(8, amt / 3));
  floatNum(P.x + rand(-10, 10), P.y - 30, amt, '#ff4a4a', 1.1);
  SFX.tower(); vib(30);
  if (src && G.s.thorns) hurt(src, G.s.thorns, { col: '#9be36a' });
  if (P.hp <= 0) {
    if (G.f.feniks && !G.f.feniksUsed) {
      G.f.feniksUsed = true; P.hp = P.max * 0.6; P.iT = 2;
      banner('SERCE FENIKSA', 'Powstajesz z popiołów!', '#ffc83a', 2.2);
      explode(P.x, P.y, 280, baseDmg() * 12, '#ffb020');
      G.shake = 20; SFX.legend(); vib([200, 80, 200]);
    } else gameOver();
  }
}
function healHero(v, show) {
  const P = G.p, before = P.hp;
  P.hp = Math.min(P.max, P.hp + v);
  if (show && P.hp - before >= 1) floatNum(P.x, P.y - 40, P.hp - before, '#6aff8a', 1.2, '+');
}

/* ---------------- Bohater: ruch i atak ---------------- */
function nearestEnemy(x, y, maxD = Infinity) {
  let best = null, bd = maxD * maxD;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function updateHero(dt) {
  const P = G.p, s = G.s;
  // ruch
  let mx = input.dx, my = input.dy;
  if (keys['w'] || keys['arrowup']) my = -1;
  if (keys['s'] || keys['arrowdown']) my = 1;
  if (keys['a'] || keys['arrowleft']) mx = -1;
  if (keys['d'] || keys['arrowright']) mx = 1;
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const sp = BALANCE.heroSpeed * s.moveMult;
  P.vx = mx * sp; P.vy = my * sp;
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (ml > 0.05) P.walk += dt * Math.min(1, ml) ; else P.walk = 0;
  P.iT -= dt; P.hurtT -= dt;
  // atak: najbliższy wróg w zasięgu
  P.cd -= dt; P.draw = Math.max(0, P.draw - dt * 4);
  const e = nearestEnemy(P.x, P.y, s.range);
  if (!e) { if (ml > 0.05) P.ang = Math.atan2(my, mx); return; }
  const d = Math.hypot(e.x - P.x, e.y - P.y), tt = d / s.speed;
  const ang = Math.atan2(e.y + e.vy * tt - P.y, e.x + e.vx * tt - P.x);
  P.ang = ang;
  if (P.cd <= 0) {
    P.cd = 1 / (s.rate * s.rateMult); P.draw = 1;
    const n = s.multi, spread = 0.13;
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * spread;
      fireArrow(P.x + Math.cos(ang) * 16, P.y + Math.sin(ang) * 16, a, baseDmg(), s.pierce, s.ricochet);
    }
    G.shots++;
    if (s.bigEvery && G.shots % s.bigEvery === 0) {
      const a = fireArrow(P.x, P.y, ang, baseDmg() * s.bigMult, 999, 0);
      a.big = true; a.r = 18; a.glow = 'rgba(255,210,90,.95)'; a.vx *= 1.2; a.vy *= 1.2; a.life = 1.4;
      G.shake = Math.max(G.shake, 3);
    }
    SFX.shoot();
  }
}
function arrowGlow() {
  const s = G.s;
  if (s.burn && s.slow) return 'rgba(200,170,255,.9)';
  if (s.burn) return 'rgba(255,130,40,.9)';
  if (s.slow) return 'rgba(120,210,255,.9)';
  if (s.poison) return 'rgba(140,255,90,.85)';
  if (s.chain) return 'rgba(160,220,255,.9)';
  return 'rgba(255,230,190,.55)';
}
function fireArrow(x, y, ang, dmg, pierce, ric) {
  const sp = G.s.speed;
  const a = { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg, pierce, ric, hit: new Set(), r: 7, glow: arrowGlow(), hero: true, life: 0.75 };
  G.arrows.push(a);
  return a;
}

function updateArrows(dt) {
  for (const a of G.arrows) {
    a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
    if (a.life <= 0) { a.dead = true; continue; }
    for (const e of G.enemies) {
      if (e.dead || a.hit.has(e)) continue;
      const rr = e.r + a.r;
      if ((e.x - a.x) ** 2 + (e.y - a.y) ** 2 > rr * rr) continue;
      a.hit.add(e);
      const sp = Math.hypot(a.vx, a.vy) || 1;
      hurt(e, a.dmg, { canCrit: true, forceCrit: a.forceCrit, knock: { x: a.vx / sp * 60, y: a.vy / sp * 60 } });
      if (a.hero) applyOnHit(e);
      for (let i = 0; i < 3; i++) part(a.x, a.y, rand(-80, 80) - a.vx * 0.05, rand(-80, 80) - a.vy * 0.05, 0.2, 2.5, a.glow, true);
      if (G.f.grad && a.hero && !a.child && Math.random() < 0.3) {
        const ang = Math.atan2(a.vy, a.vx);
        for (const d of [-0.45, 0.45]) { const c = fireArrow(a.x, a.y, ang + d, a.dmg * 0.6, 0, 0); c.child = true; c.hit = new Set(a.hit); }
      }
      if (a.pierce > 0) { a.pierce--; continue; }
      if (a.ric > 0) {
        a.ric--;
        let best = null, bd = 260 * 260;
        for (const o of G.enemies) { if (o.dead || a.hit.has(o)) continue; const d = dist2(o, a); if (d < bd) { bd = d; best = o; } }
        if (best) {
          const ang = Math.atan2(best.y - a.y, best.x - a.x);
          a.vx = Math.cos(ang) * sp; a.vy = Math.sin(ang) * sp; a.life = 0.6; continue;
        }
      }
      a.dead = true; break;
    }
  }
  G.arrows = G.arrows.filter(a => !a.dead);
}

/* ---------------- Bronie i towarzysze ---------------- */
function updateWeapons(dt) {
  const P = G.p;
  for (const tu of G.turrets) {
    const power = baseDmg() * tu.pow;
    tu.cd -= dt;
    if (tu.type === 'balista') {
      if (tu.cd > 0) continue;
      let best = null, bh = -1;
      for (const e of G.enemies) { if (e.dead) continue; if (dist2(e, P) < 520 * 520 && e.hp > bh) { bh = e.hp; best = e; } }
      if (!best) continue;
      const ang = Math.atan2(best.y - P.y, best.x - P.x);
      tu.cd = 1.7 / (1 + 0.12 * (tu.lvl - 1));
      const shots = G.f.upiory ? [-0.15, 0, 0.15] : [0];
      for (const d of shots) {
        const a = fireArrow(P.x, P.y, ang + d, power * 3 * (G.f.upiory ? 1.5 : 1), G.f.upiory ? 999 : 3, 0);
        a.hero = false; a.bolt = true; a.r = 10; a.vx *= 1.15; a.vy *= 1.15; a.life = 0.9;
        if (G.f.upiory) { a.ghost = true; a.glow = 'rgba(120,255,210,.9)'; } else a.glow = 'rgba(255,240,220,.4)';
      }
    } else if (tu.type === 'miotacz') {
      const range = G.f.smok ? 300 : 190, cone = G.f.smok ? 0.55 : 0.38;
      const tgt = nearestEnemy(P.x, P.y, range);
      if (!tgt) continue;
      tu.ang = Math.atan2(tgt.y - P.y, tgt.x - P.x);
      for (let i = 0; i < 2; i++) {
        const a = tu.ang + rand(-cone, cone), sp = rand(range * 1.4, range * 1.9);
        part(P.x + Math.cos(tu.ang) * 16, P.y + Math.sin(tu.ang) * 16, Math.cos(a) * sp + P.vx, Math.sin(a) * sp + P.vy, rand(0.35, 0.55), rand(5, 10), Math.random() < 0.5 ? '#ff7a1a' : '#ffcf4a', true, 0, false, true);
      }
      SFX.flame();
      if (tu.cd > 0) continue;
      tu.cd = 0.1;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
        if (d > range + e.r) continue;
        let da = Math.atan2(dy, dx) - tu.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > cone + 0.1) continue;
        hurt(e, power * 0.28, { quiet: true });
        e.burnT = 2.5; e.burnDps = Math.max(e.burnDps, power * 0.5 * (G.f.smok ? 2 : 1));
      }
    } else if (tu.type === 'pily') {
      const n = 1 + tu.lvl + (G.f.taniec ? 3 : 0);
      const R = G.f.taniec ? 115 : 88;
      tu.blades = [];
      for (let i = 0; i < n; i++) {
        const a = G.t * 3 + i * TAU / n;
        const bx = P.x + Math.cos(a) * R, by = P.y + Math.sin(a) * R;
        tu.blades.push([bx, by]);
        for (const e of G.enemies) {
          if (e.dead) continue;
          if ((e.x - bx) ** 2 + (e.y - by) ** 2 > (e.r + 16) ** 2) continue;
          if ((e.bladeCd || 0) > G.t) continue;
          e.bladeCd = G.t + 0.35;
          const kx = e.x - P.x, ky = e.y - P.y, kd = Math.hypot(kx, ky) || 1;
          hurt(e, power, { canCrit: true, forceCrit: G.f.taniec, col: '#d0d6e0', knock: { x: kx / kd * 120, y: ky / kd * 120 } });
          part(bx, by, rand(-120, 120), rand(-120, 120), 0.2, 2.5, '#ffe0a0', true);
        }
      }
    } else if (tu.type === 'kociol') {
      if (tu.cd > 0) continue;
      const tgt = densest(260, 420);
      if (!tgt) continue;
      tu.cd = 4 / (1 + 0.1 * (tu.lvl - 1));
      G.lobs.push({ x0: P.x, y0: P.y, x1: tgt.x, y1: tgt.y, t: 0, dur: 0.7, pow: power });
    }
  }
  // kałuże smoły
  for (const pl of G.pools) {
    pl.t -= dt; pl.tick -= dt;
    const tick = pl.tick <= 0; if (tick) pl.tick = 0.5;
    for (const e of G.enemies) {
      if (e.dead || e.fly) continue;
      if (dist2(e, pl) < (pl.r + e.r * 0.5) ** 2) { e.tarT = 0.15; if (tick) hurt(e, pl.pow * 0.45, { quiet: true }); }
    }
  }
  G.pools = G.pools.filter(p => p.t > 0);
  for (const l of G.lobs) {
    l.t += dt;
    if (l.t >= l.dur) {
      l.done = true;
      G.pools.push({ x: l.x1, y: l.y1, r: 72, t: 5, tick: 0, pow: l.pow });
      for (let i = 0; i < 12; i++) part(l.x1, l.y1, rand(-140, 140), rand(-140, 60), 0.4, rand(3, 6), '#1a1210', false, 300);
    }
  }
  G.lobs = G.lobs.filter(l => !l.done);
  // kruki
  for (const r of G.ravens) {
    if (!r.tgt || r.tgt.dead || dist2(r.tgt, P) > 500 * 500) r.tgt = nearestEnemy(P.x, P.y, 420);
    let tx, ty;
    if (r.tgt) { tx = r.tgt.x; ty = r.tgt.y - 6; }
    else { r.a += dt * 1.5; tx = P.x + Math.cos(r.a) * 70; ty = P.y - 40 + Math.sin(r.a) * 30; }
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy) || 1;
    r.vx = (r.vx || 0) * 0.9 + dx / d * 340 * 0.1; r.vy = (r.vy || 0) * 0.9 + dy / d * 340 * 0.1;
    r.x += r.vx * dt; r.y += r.vy * dt; r.ang = Math.atan2(r.vy, r.vx);
    r.cd -= dt;
    if (r.tgt && d < r.tgt.r + 12 && r.cd <= 0) {
      r.cd = 0.5; hurt(r.tgt, baseDmg() * 0.7 * r.pow, { canCrit: true });
      r.vx = -r.vx * 0.8 + rand(-150, 150); r.vy = -r.vy * 0.8 - 120;
    }
  }
  // gniew niebios
  if (G.f.gniew) {
    G.gniewT -= dt;
    if (G.gniewT <= 0) {
      G.gniewT = 4;
      const alive = G.enemies.filter(e => !e.dead && onScreen(e, 0));
      for (let i = 0; i < 6 && alive.length; i++) {
        const e = alive.splice(Math.random() * alive.length | 0, 1)[0];
        G.bolts.push({ pts: jag([[e.x + rand(-40, 40), cam.y - 20], [e.x, e.y]]), t: 0.3, col: '#d8f0ff', w: 4 });
        explode(e.x, e.y, 40, baseDmg() * 6, '#bfe6ff', true);
      }
      G.shake = Math.max(G.shake, 6); SFX.zap(); SFX.boom();
    }
  }
}
function onScreen(o, m = 30) { return o.x > cam.x - m && o.x < cam.x + W + m && o.y > cam.y - m && o.y < cam.y + H + m; }

function densest(r, maxD) {
  let best = null, bc = 0;
  const cand = G.enemies.filter(e => !e.dead && dist2(e, G.p) < maxD * maxD);
  for (let i = 0; i < cand.length; i += Math.max(1, cand.length / 40 | 0)) {
    const e = cand[i]; let c = 0;
    for (const o of cand) if (dist2(o, e) < r * r / 4) c++;
    if (c > bc) { bc = c; best = e; }
  }
  return best;
}

/* ---------------- Umiejętność: Deszcz Strzał ---------------- */
function useSkill() {
  if (!G || G.modal || G.over || G.skill.cd > 0) return;
  SFX.init();
  const tgt = densest(220, 480);
  if (!tgt) return;
  G.skill.cd = G.skill.max;
  G.rains.push({ x: tgt.x, y: tgt.y, t: 0, n: 30, made: 0, drops: [] });
  SFX.rain(); vib(30);
}
$('skillBtn').addEventListener('pointerdown', e => { e.stopPropagation(); useSkill(); });

function updateRains(dt) {
  for (const r of G.rains) {
    r.t += dt;
    const want = Math.min(r.n, Math.floor(r.t / 1.1 * r.n));
    while (r.made < want) {
      r.made++;
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 105;
      r.drops.push({ x: r.x + Math.cos(a) * d, y: r.y + Math.sin(a) * d * 0.8, t: 0 });
    }
    for (const d of r.drops) {
      if (d.done) continue;
      d.t += dt;
      if (d.t >= 0.22) {
        d.done = true;
        for (const e of G.enemies) if (!e.dead && dist2(e, d) < (30 + e.r) ** 2) { hurt(e, baseDmg() * 2.2, { canCrit: true }); applyOnHit(e); }
        for (let i = 0; i < 4; i++) part(d.x, d.y, rand(-90, 90), rand(-90, 30), 0.3, 2.5, '#ffd08a', true);
      }
    }
    if (r.made >= r.n && r.drops.every(d => d.done)) r.dead = true;
  }
  G.rains = G.rains.filter(r => !r.dead);
}

/* ---------------- Wrogowie ---------------- */
function updateEnemies(dt) {
  const P = G.p;
  const far = Math.hypot(W, H) * 0.85;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.anim += dt; e.flash -= dt;
    e.dotT += dt;
    if (e.slowT > 0) e.slowT -= dt; else e.slowAmt = 0;
    if (e.dotT >= 0.5) {
      e.dotT = 0;
      let d = 0;
      if (e.burnT > 0) { d += e.burnDps * 0.5; e.burnT -= 0.5; if (Math.random() < 0.7) part(e.x + rand(-6, 6), e.y - 6, rand(-10, 10), rand(-60, -30), 0.5, rand(3, 6), '#ff7a1a', true); }
      if (e.poisonT > 0) { d += e.poisonS * G.s.poison * 0.5; e.poisonT -= 0.5; part(e.x + rand(-6, 6), e.y - 4, 0, -30, 0.6, 3, 'rgba(140,255,90,.8)', true); }
      else e.poisonS = 0;
      if (d > 0) hurt(e, d, { col: e.poisonS && !e.burnT ? '#9cff5a' : '#ff9a3a', size: 0.8 });
      if (e.dead) continue;
    }
    if (e.acc > 0) { e.accT += dt; if (e.accT > 0.4) { floatNum(e.x, e.y - e.r - 6, e.acc, '#ffb060', 0.85); e.acc = 0; e.accT = 0; } }

    // zbyt daleko? przenieś przed bohatera (żeby horda zawsze była blisko)
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > far) {
      const p = edgePos(spawnAng(), 40); e.x = p.x; e.y = p.y; continue;
    }

    // ruch w stronę bohatera
    let speed = e.spd * (1 - e.slowAmt) * (e.tarT > 0 ? 0.5 : 1);
    if (e.tarT > 0) e.tarT -= dt;
    const reach = P.r + e.r * 0.8;
    let stop = false;
    if (e.range && d < e.range && onScreen(e, -20)) stop = true;
    if (!stop) {
      let mx = dx / d, my = dy / d;
      if (e.fly) { const wob = Math.sin(e.anim * 3) * 0.6; const ox = -my * wob, oy = mx * wob; mx += ox; my += oy; }
      e.vx = mx * speed; e.vy = my * speed;
      if (d > reach) { e.x += e.vx * dt; e.y += e.vy * dt; }
    } else { e.vx *= 0.8; e.vy *= 0.8; }
    // odrzut po trafieniu
    if (e.kx || e.ky) { e.x += e.kx * dt * 6; e.y += e.ky * dt * 6; e.kx *= 0.8; e.ky *= 0.8; if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0; }

    // atak
    e.atk -= dt;
    if (e.range) {
      if (stop && e.atk <= 0) {
        e.atk = e.rate;
        if (e.type === 'priest') for (const s of [-0.25, 0, 0.25]) enemyShot(e, s, e.dmg);
        else enemyShot(e, 0, e.dmg);
      }
      e.charge = stop ? clamp(1 - e.atk / e.rate, 0, 1) : 0;
    }
    if (d <= reach + 3 && e.atk <= 0) {
      e.atk = e.rate;
      damageHero(e.dmg, e);
    }

    // zdolności bossów
    if (e.special) {
      e.specT -= dt;
      if (e.specT <= 0 && onScreen(e, 0)) {
        e.specT = e.special;
        if (e.type === 'butcher') {
          for (let i = 0; i < 4; i++) { const a = i * TAU / 4; spawnEnemy('skeleton', { x: e.x + Math.cos(a) * 50, y: e.y + Math.sin(a) * 40 }); }
          part(e.x, e.y, 0, 0, 0.4, 70, 'rgba(200,40,40,.4)', true, 0, true);
        } else if (e.type === 'queen') {
          for (let i = 0; i < 6 + G.bossIdx; i++) spawnEnemy('spider', { x: e.x + rand(-40, 40), y: e.y + rand(-20, 30) });
        } else if (e.type === 'priest') {
          for (let i = 0; i < 2; i++) spawnEnemy('cultist', { x: e.x + (i ? 60 : -60), y: e.y });
        }
      }
    }
  }
  // rozpychanie wrogów
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (b.dead || a.fly !== b.fly) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = (a.r + b.r) * 0.85;
      if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (rr - d) / d * 0.5;
        const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1;
        a.x -= dx * push * wa; a.y -= dy * push * wa; b.x += dx * push * wb; b.y += dy * push * wb;
      }
    }
    // wrogowie nie wchodzą w bohatera
    const dx = a.x - P.x, dy = a.y - P.y, d = Math.hypot(dx, dy), minD = P.r + a.r * 0.7;
    if (!a.fly && d < minD && d > 0) { a.x = P.x + dx / d * minD; a.y = P.y + dy / d * minD; }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

function enemyShot(e, spread, dmg) {
  const P = G.p;
  const ang = Math.atan2(P.y - e.y + 10, P.x - e.x) + spread;
  G.eShots.push({ x: e.x + 8, y: e.y - 14, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230, dmg, col: e.type === 'priest' ? '#ff4a6a' : '#9cff5a', src: e, life: 3 });
}
function updateEShots(dt) {
  const P = G.p;
  for (const s of G.eShots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (Math.random() < 0.5) part(s.x, s.y, rand(-20, 20), rand(-20, 20), 0.3, 4, s.col, true);
    if ((s.x - P.x) ** 2 + (s.y - P.y) ** 2 < (P.r + 5) ** 2) { s.dead = true; damageHero(s.dmg, null); explodeFx(s.x, s.y, s.col); }
    if (s.life <= 0) s.dead = true;
  }
  G.eShots = G.eShots.filter(s => !s.dead);
}
function explodeFx(x, y, col) { for (let i = 0; i < 8; i++) part(x, y, rand(-120, 120), rand(-120, 120), 0.3, 4, col, true); }

/* ---------------- Kryształy i znajdźki ---------------- */
function updateOrbs(dt) {
  const P = G.p, mag = G.s.magnet;
  for (const o of G.orbs) {
    o.t += dt;
    const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy);
    if (!o.pull && d < mag) o.pull = true;
    if (!o.pull) continue;
    const sp = 260 + o.t * 40 + (o.pullT = (o.pullT || 0) + dt) * 900;
    if (d < 16) { o.dead = true; gainXp(o.val); SFX.hit(); continue; }
    o.x += dx / d * sp * dt; o.y += dy / d * sp * dt;
  }
  G.orbs = G.orbs.filter(o => !o.dead);
  for (const k of G.pickups) {
    if (dist2(k, P) < 26 * 26) {
      k.dead = true;
      if (k.type === 'heart') { healHero(P.max * 0.3, true); SFX.pick(1); }
      else { for (const o of G.orbs) o.pull = true; SFX.legend(); banner('MAGNES', 'Przyciągasz wszystkie kryształy', '#7ac0ff', 1.2); }
    } else if (dist2(k, P) > 1600 * 1600) k.dead = true;
  }
  G.pickups = G.pickups.filter(k => !k.dead);
}
function gainXp(v) {
  G.xp += v * G.s.xpMult;
  while (G.xp >= G.xpNeed) {
    G.xp -= G.xpNeed; G.level++; G.pending++;
    G.xpNeed = BALANCE.xpNeed(G.level);
  }
  updateHud();
}

/* ---------------- Efekty ---------------- */
function part(x, y, vx, vy, life, size, col, add, grav = 0, ring = false, shrink = false) {
  if (G.parts.length > 700) G.parts.shift();
  G.parts.push({ x, y, vx, vy, life, max: life, size, col, add, grav, ring, shrink });
}
function floatNum(x, y, v, col, size = 1, prefix = '') {
  if (G.nums.length > 90) G.nums.shift();
  const txt = prefix + (v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10).toString().replace('.', ','));
  G.nums.push({ x, y, txt, col, size, t: 0, vx: rand(-20, 20) });
}
function banner(text, sub, col, dur) { G.banner = { text, sub, col, t: 0, dur }; }

/* =====================================================================
   PĘTLA GRY
   ===================================================================== */
function update(dt) {
  G.t += dt;
  G.shake = Math.max(0, G.shake - dt * 30);
  G.hurt = Math.max(0, G.hurt - dt * 1.5);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.over) { G.overT += dt; updateParts(dt); return; }

  if (G.wave === 0) nextWave();
  G.waveT += dt;
  while (G.spawnQ.length && G.spawnQ[0].t <= G.waveT) {
    if (G.enemies.length >= BALANCE.maxEnemies && G.spawnQ[0].type !== 'boss') { G.spawnQ[0].t += 0.5; G.spawnQ.sort((a, b) => a.t - b.t); break; }
    const s = G.spawnQ.shift();
    spawnEnemy(s.type, s);
  }
  if (!G.spawnQ.length && G.enemies.length === 0) G.clearT += dt;
  if (G.waveT >= BALANCE.waveLen && !G.boss) nextWave();
  else if (G.clearT > 1.5) nextWave();

  G.skill.cd = Math.max(0, G.skill.cd - dt);
  if (G.s.hpRegen) healHero(G.s.hpRegen * dt);

  updateHero(dt);
  updateWeapons(dt);
  updateRains(dt);
  updateArrows(dt);
  updateEnemies(dt);
  updateEShots(dt);
  updateOrbs(dt);
  for (const b of G.bolts) b.t -= dt;
  G.bolts = G.bolts.filter(b => b.t > 0);
  updateParts(dt);

  // kamera
  const tx = G.p.x - W / 2 + G.p.vx * 0.25, ty = G.p.y - H * 0.5 + G.p.vy * 0.25;
  const k = 1 - Math.pow(0.001, dt);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;

  if (!G.touched && G.t > 9) { G.touched = true; $('hint').classList.add('hidden'); }

  if (!G.modal && !G.over) {
    if (G.chest) { G.chest--; openLevelUp(true); }
    else if (G.pending > 0) { G.pending--; openLevelUp(false); }
  }
}
function updateParts(dt) {
  for (const p of G.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
    if (!p.ring) { p.vx *= 0.96; p.vy *= 0.96; }
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const n of G.nums) { n.t += dt; n.y -= (60 - n.t * 60) * dt; n.x += n.vx * dt; }
  G.nums = G.nums.filter(n => n.t < 0.9);
}

/* ---------------- Rysowanie ---------------- */
function render() {
  const k = SCALE * DPR;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (!G) {
    const t = performance.now() / 1000;
    cam.x = -W / 2 + Math.sin(t * 0.1) * 40; cam.y = -H * 0.62;
    drawGround(ctx, cam.x, cam.y, W, H);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    drawHero(ctx, 0, 0, -Math.PI / 2 + Math.sin(t) * 0.5, 0, t, 0);
    ctx.globalCompositeOperation = 'lighter';
    const f = 0.8 + Math.sin(t * 9) * 0.1;
    ctx.fillStyle = `rgba(255,120,30,${0.12 * f})`; ctx.beginPath(); ctx.arc(0, 0, 120 * f, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    drawVignette(ctx, W, H);
    return;
  }
  const t = G.t, P = G.p;
  const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
  const cx = cam.x - sx, cy = cam.y - sy;
  drawGround(ctx, cx, cy, W, H);
  ctx.save(); ctx.translate(-cx, -cy);

  // ambientowe iskry
  if (Math.random() < 0.25) part(cam.x + rand(0, W), cam.y + H + 10, rand(-10, 10), rand(-60, -30), rand(2, 4), rand(1.5, 3), '#ff8a2a', true);

  for (const p of G.pools) {
    const a = Math.min(1, p.t / 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#0c0807'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,90,20,.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.75, p.r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // kryształy i znajdźki (na ziemi)
  for (const o of G.orbs) {
    if (!onScreen(o)) continue;
    const by = o.pull ? 0 : Math.sin(t * 4 + o.bob) * 2;
    const r = o.big ? 7 : 5;
    ctx.fillStyle = o.big ? 'rgba(120,200,255,.3)' : 'rgba(80,160,255,.25)';
    ctx.beginPath(); ctx.arc(o.x, o.y + by, r * 1.9, 0, TAU); ctx.fill();
    ctx.fillStyle = o.big ? '#bfe6ff' : '#5aa8ff';
    ctx.beginPath(); ctx.moveTo(o.x, o.y + by - r); ctx.lineTo(o.x + r * 0.7, o.y + by); ctx.lineTo(o.x, o.y + by + r); ctx.lineTo(o.x - r * 0.7, o.y + by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(o.x - 1, o.y + by - r * 0.5, 2, 2);
  }
  for (const k2 of G.pickups) {
    if (!onScreen(k2)) continue;
    const by = Math.sin(t * 3 + k2.x) * 3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = k2.type === 'heart' ? 'rgba(255,60,60,.25)' : 'rgba(90,170,255,.25)';
    ctx.beginPath(); ctx.arc(k2.x, k2.y + by, 18, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k2.type === 'heart' ? '❤️' : '🧲', k2.x, k2.y + by);
  }

  // wrogowie i bohater posortowani po y
  const list = G.enemies.filter(e => !e.fly && onScreen(e, 60));
  list.push(P);
  list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e === P) drawHero(ctx, P.x, P.y, P.ang, P.draw, t, P.walk, P.hurtT);
    else drawEnemy(ctx, e, t);
  }

  // ostrza
  for (const tu of G.turrets) if (tu.blades) for (const [bx, by] of tu.blades) {
    ctx.save(); ctx.translate(bx, by); ctx.rotate(t * 14);
    ctx.fillStyle = G.f.taniec ? '#bfe8ff' : '#c8ccd4';
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -3); ctx.lineTo(10, 4); ctx.fill(); }
    ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  for (const e of G.enemies) if (e.fly && onScreen(e, 60)) drawEnemy(ctx, e, t);
  for (const r of G.ravens) drawRaven(ctx, r, t);

  for (const a of G.arrows) drawArrow(ctx, a);
  for (const l of G.lobs) {
    const k2 = l.t / l.dur, x = l.x0 + (l.x1 - l.x0) * k2, y = l.y0 + (l.y1 - l.y0) * k2 - Math.sin(k2 * Math.PI) * 120;
    ctx.fillStyle = '#1a1412'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(x, y - 4, 2.5, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of G.eShots) {
    ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(s.x, s.y, 11, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  for (const r of G.rains) {
    for (const d of r.drops) {
      if (d.done) continue;
      const k2 = d.t / 0.22, y = d.y - 260 * (1 - k2);
      ctx.strokeStyle = 'rgba(255,220,150,.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(d.x - 6 * (1 - k2), y - 26); ctx.lineTo(d.x, y); ctx.stroke();
    }
    if (r.t < 1.4) { ctx.strokeStyle = `rgba(255,170,80,${0.5 * (1 - r.t / 1.4)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x, r.y, 110, 85, 0, 0, TAU); ctx.stroke(); }
  }
  for (const b of G.bolts) {
    ctx.strokeStyle = b.col;
    for (const [w, a] of [[(b.w || 2.5) * 3, 0.25], [b.w || 2.5, 1]]) {
      ctx.lineWidth = w; ctx.globalAlpha = a * Math.min(1, b.t * 6);
      ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (const p of G.parts) {
    const a = p.life / p.max;
    if (p.ring) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.col; ctx.globalAlpha = a; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 - a * 0.5), 0, TAU); ctx.stroke();
      continue;
    }
    ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    ctx.globalAlpha = p.add ? a : Math.min(1, a * 2);
    ctx.fillStyle = p.col;
    const s = p.shrink ? p.size * (0.4 + (1 - a) * 1.4) : p.size * (p.add ? a : 1);
    ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // pasek HP bohatera
  const hpR = Math.max(0, P.hp / P.max);
  const bw = 46, bx = P.x - bw / 2, by = P.y + 26;
  ctx.fillStyle = 'rgba(0,0,0,.75)'; roundRect(ctx, bx - 2, by - 2, bw + 4, 8, 3); ctx.fill();
  ctx.fillStyle = hpR < 0.3 ? '#ff3b3b' : '#5fd36a'; roundRect(ctx, bx, by, Math.max(1, bw * hpR), 4, 2); ctx.fill();

  // liczby obrażeń
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of G.nums) {
    const a = n.t < 0.7 ? 1 : 1 - (n.t - 0.7) / 0.2;
    const pop = n.t < 0.08 ? 1 + (0.08 - n.t) * 6 : 1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `900 ${Math.round(15 * n.size * pop)}px 'Cinzel', serif`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(n.txt, n.x, n.y);
    ctx.fillStyle = n.col; ctx.fillText(n.txt, n.x, n.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawVignette(ctx, W, H);

  // strzałka do bossa poza ekranem
  if (G.boss && !onScreen(G.boss, -20)) {
    const b = G.boss, a = Math.atan2(b.y - P.y, b.x - P.x);
    const ex = clamp(W / 2 + Math.cos(a) * W, 30, W - 30), ey = clamp(H / 2 + Math.sin(a) * H, 130, H - 40);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = `rgba(255,60,60,${0.7 + Math.sin(t * 8) * 0.3})`;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-5, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // joystick
  if (input.down && !G.modal) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,200,140,.7)'; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(30,18,14,.35)';
    ctx.beginPath(); ctx.arc(input.bx, input.by, JOY_R, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.85;
    const kx = input.bx + input.dx * JOY_R * 0.75, ky = input.by + input.dy * JOY_R * 0.75;
    const kg = ctx.createRadialGradient(kx - 6, ky - 6, 2, kx, ky, 26);
    kg.addColorStop(0, '#ffcf8a'); kg.addColorStop(1, '#a8501a');
    ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, 24, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // czerwona poświata przy obrażeniach i niskim HP
  const low = hpR < 0.3 ? (0.3 - hpR) * 1.6 * (0.6 + Math.sin(t * 6) * 0.4) : 0;
  const hurtA = Math.max(G.hurt * 0.55, low);
  if (hurtA > 0.01) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(160,0,0,0)'); vg.addColorStop(1, `rgba(180,0,10,${hurtA})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (G.banner) {
    const b = G.banner, a = b.t < 0.25 ? b.t / 0.25 : b.t > b.dur - 0.4 ? (b.dur - b.t) / 0.4 : 1;
    const sc = b.t < 0.25 ? 1.4 - b.t / 0.25 * 0.4 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(W / 2, H * 0.3); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-W, -46, W * 2, b.sub ? 92 : 70);
    ctx.font = "900 44px 'Cinzel', serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(b.text, 0, -12);
    ctx.fillStyle = b.col; ctx.fillText(b.text, 0, -12);
    if (b.sub) { ctx.font = "700 19px 'Cinzel', serif"; ctx.fillStyle = '#efe3d0'; ctx.fillText(b.sub, 0, 26); }
    ctx.restore();
  }
  if (G.over) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, G.overT * 0.5)})`; ctx.fillRect(0, 0, W, H); }
}

let lastT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  if (G && (!G.modal || G.over)) update(dt);
  render();
  if (G) updateHudFast();
  requestAnimationFrame(loop);
}

/* =====================================================================
   UI: HUD i ekrany
   ===================================================================== */
function showHud(v) { $('hud').classList.toggle('hidden', !v); }
function updateHud() {
  if (!G) return;
  $('waveNum').textContent = G.wave || 1;
  $('xpFill').style.width = (G.xp / G.xpNeed * 100).toFixed(1) + '%';
  $('lvlTxt').textContent = 'Poziom ' + G.level;
}
function updateHudFast() {
  const s = G.skill;
  $('skillRing').style.strokeDashoffset = (289 * (s.cd / s.max)).toFixed(1);
  $('skillCd').textContent = s.cd > 0 ? Math.ceil(s.cd) : '';
  $('skillBtn').classList.toggle('cooling', s.cd > 0);
  if (G.boss) $('bossHpFill').style.width = Math.max(0, G.boss.hp / G.boss.max * 100) + '%';
  const P = G.p;
  $('hpFill').style.width = Math.max(0, P.hp / P.max * 100).toFixed(1) + '%';
  $('hpTxt').textContent = Math.ceil(Math.max(0, P.hp)) + ' / ' + Math.round(P.max);
}

function hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); }
function showScreen(id) { hideScreens(); $(id).classList.remove('hidden'); }

/* ---------------- Karty ---------------- */
function cardAvailable(c) {
  if (lvlOf(G, c.id) >= c.max) return false;
  if (c.req && !c.req(G)) return false;
  return true;
}
function rollOffer(chest) {
  const offer = [];
  const used = new Set();
  let gotRare = false;
  for (let i = 0; i < 3; i++) {
    let r = RARITY.roll(chest ? 1 : 0);
    if (!chest && i === 2 && !gotRare && G.sinceRare >= BALANCE.pityLevels) r = RARITY.roll(1);
    let pick = null;
    while (r >= 0 && !pick) {
      const cand = CARDS.filter(c => !used.has(c.id) && !c.syn && !c.evo && cardAvailable(c) && (c.minR || 0) <= r && (c.maxR ?? 3) >= r && !(r === 3 && !c.minR && Math.random() < 0.5));
      if (cand.length) pick = cand[Math.random() * cand.length | 0];
      else r--;
    }
    if (!pick) continue;
    used.add(pick.id);
    if (r >= 1) gotRare = true;
    offer.push({ card: pick, r });
  }
  const syn = CARDS.filter(c => c.syn && !used.has(c.id) && cardAvailable(c));
  const evo = CARDS.filter(c => c.evo && !used.has(c.id) && cardAvailable(c));
  if (evo.length && (chest || Math.random() < 0.25)) { offer[offer.length - 1] = { card: evo[Math.random() * evo.length | 0], r: 3 }; gotRare = true; }
  else if (syn.length && (chest || Math.random() < 0.35)) { offer[offer.length - 1] = { card: syn[Math.random() * syn.length | 0], r: 2 }; gotRare = true; }
  G.sinceRare = gotRare ? 0 : G.sinceRare + 1;
  return offer;
}
function openLevelUp(chest) { SFX.level(); vib(40); openCards(chest ? 'chest' : 'level', rollOffer(chest)); }

function openCards(mode, offer) {
  G.modal = mode;
  input.down = false; input.id = null; input.dx = input.dy = 0;
  G.currentOffer = offer;
  $('cardTitle').textContent = mode === 'blessing' ? 'Błogosławieństwo' : mode === 'chest' ? 'Skrzynia skarbów!' : 'Nowy poziom!';
  $('cardSub').textContent = mode === 'blessing' ? 'Wybierz dar na początek nocy' : mode === 'chest' ? 'Co najmniej rzadka karta' : `Poziom ${G.level - G.pending}`;
  $('rerollBtn').classList.toggle('hidden', mode === 'blessing');
  $('rerollN').textContent = G.rerolls;
  $('rerollBtn').disabled = G.rerolls <= 0;
  const box = $('cards'); box.innerHTML = '';
  let best = 0;
  for (const o of offer) {
    const el = document.createElement('div');
    if (o.bless) {
      el.className = 'card';
      el.innerHTML = `<div class="ico">${o.bless.icon}</div><div class="body"><div class="top"><span class="name">${o.bless.name}</span></div><div class="desc">${o.bless.desc}</div><div class="kind">Błogosławieństwo</div></div>`;
    } else {
      const c = o.card, lv = lvlOf(G, c.id);
      best = Math.max(best, o.r);
      el.className = 'card r' + o.r;
      const lvTxt = c.max > 1 ? ` · <span class="lv">poz. ${lv + 1}/${c.max}</span>` : '';
      el.innerHTML = `<div class="ico">${c.icon}</div><div class="body"><div class="top"><span class="name">${c.name}</span><span class="rar">${RARITY.names[o.r]}</span></div><div class="desc">${c.desc(G, o.r)}</div><div class="kind">${c.kind}${lvTxt}</div></div>`;
    }
    el.addEventListener('click', () => pickCard(o));
    box.appendChild(el);
  }
  if (best >= 3) setTimeout(() => SFX.legend(), 150);
  showScreen('cardScreen');
}
function pickCard(o) {
  if (!G || !G.modal) return;
  if (o.bless) { o.bless.apply(G); G.blessing = o.bless; }
  else {
    o.card.apply(G, o.r);
    G.cards[o.card.id] = lvlOf(G, o.card.id) + 1;
    G.cardRar[o.card.id] = Math.max(G.cardRar[o.card.id] || 0, o.r);
    if (o.r >= 3) { banner(o.card.name.toUpperCase(), 'Legenda!', '#ffc83a', 1.8); G.shake = 8; }
  }
  SFX.pick(o.r || 0);
  G.modal = null;
  hideScreens();
  updateHud();
}
$('rerollBtn').addEventListener('click', () => {
  if (!G || G.rerolls <= 0 || !G.modal || G.modal === 'blessing') return;
  G.rerolls--;
  openCards(G.modal, rollOffer(G.modal === 'chest'));
});

/* ---------------- Pauza ---------------- */
function openPause() {
  if (!G || G.modal || G.over) return;
  G.modal = 'pause';
  input.down = false; input.id = null; input.dx = input.dy = 0;
  const list = $('buildList'); list.innerHTML = '';
  if (G.blessing) list.innerHTML += `<span class="chip">${G.blessing.icon} ${G.blessing.name}</span>`;
  for (const id in G.cards) {
    const c = CARDS.find(x => x.id === id); if (!c) continue;
    list.innerHTML += `<span class="chip r${G.cardRar[id] || 0}">${c.icon} ${c.name}${G.cards[id] > 1 ? ' ×' + G.cards[id] : ''}</span>`;
  }
  $('soundBtn').textContent = 'Dźwięk: ' + (SFX.on ? 'wł.' : 'wył.');
  showScreen('pauseScreen');
}
$('pauseBtn').addEventListener('click', openPause);
$('resumeBtn').addEventListener('click', () => { if (G) { G.modal = null; hideScreens(); } });
$('soundBtn').addEventListener('click', () => {
  SFX.on = !SFX.on; SAVE.sound = SFX.on; storeSave();
  $('soundBtn').textContent = 'Dźwięk: ' + (SFX.on ? 'wł.' : 'wył.');
});
$('quitBtn').addEventListener('click', () => { if (G) { G.modal = null; hideScreens(); gameOver(true); } });

/* ---------------- Koniec gry ---------------- */
function gameOver(quit) {
  if (G.over) return;
  G.over = true; G.p.hp = 0;
  G.boss = null; $('bossBar').classList.add('hidden');
  input.down = false; input.dx = input.dy = 0;
  SFX.die(); vib([200, 100, 300]);
  for (let i = 0; i < 50; i++) part(G.p.x + rand(-20, 20), G.p.y + rand(-20, 20), rand(-220, 220), rand(-300, 50), rand(0.6, 1.4), rand(3, 8), Math.random() < 0.5 ? '#ff5a1a' : '#8a1a1a', Math.random() < 0.5, 400);
  G.shake = 18;
  const souls = Math.floor(G.kills / 8 + G.wave * 3 + G.bossKills * 10);
  const best = SAVE.best || { wave: 0, kills: 0, level: 0 };
  const rec = G.wave > best.wave;
  SAVE.best = { wave: Math.max(best.wave, G.wave), kills: Math.max(best.kills, G.kills), level: Math.max(best.level || 0, G.level) };
  SAVE.souls = (SAVE.souls || 0) + souls;
  SAVE.totalKills = (SAVE.totalKills || 0) + G.kills;
  SAVE.totalBosses = (SAVE.totalBosses || 0) + G.bossKills;
  SAVE.games = (SAVE.games || 0) + 1;
  storeSave();
  const mins = Math.floor(G.t / 60), secs = Math.floor(G.t % 60);
  $('overStats').innerHTML = `
    ${rec ? '<div class="ostat wide newRec">★ NOWY REKORD ★</div>' : ''}
    <div class="ostat"><div class="v">${G.wave}</div><div class="k">Fala</div></div>
    <div class="ostat"><div class="v">${G.kills}</div><div class="k">Zabitych</div></div>
    <div class="ostat"><div class="v">${G.level}</div><div class="k">Poziom</div></div>
    <div class="ostat"><div class="v">${mins}:${String(secs).padStart(2, '0')}</div><div class="k">Czas</div></div>
    <div class="ostat wide"><div class="v">+${souls} 👻</div><div class="k">Zebrane dusze (razem: ${SAVE.souls})</div></div>`;
  setTimeout(() => { if (G && G.over) { showHud(false); showScreen('overScreen'); } }, quit ? 300 : 1600);
}
$('againBtn').addEventListener('click', () => { hideScreens(); newGame('archer'); });
$('menuBtn').addEventListener('click', toMenu);

/* ---------------- Menu ---------------- */
function toMenu() {
  G = null; showHud(false);
  const b = SAVE.best;
  $('menuStats').innerHTML = b ? `Rekord: <b>fala ${b.wave}</b> · ${b.kills} zabitych<br>Dusze: <b>${SAVE.souls || 0} 👻</b>` : 'Pierwsza noc przed Tobą…';
  showScreen('menu');
}
$('playBtn').addEventListener('click', () => {
  SFX.init();
  const list = $('classList'); list.innerHTML = '';
  for (const c of CLASSES) {
    const el = document.createElement('div');
    el.className = 'classCard' + (c.open ? '' : ' locked');
    el.innerHTML = `<div class="cIco">${c.icon}</div><div><div class="cName">${c.name}</div><div class="cDesc">${c.desc}</div></div>`;
    if (c.open) el.addEventListener('click', () => { hideScreens(); newGame(c.id); });
    list.appendChild(el);
  }
  showScreen('classScreen');
});
$('classBack').addEventListener('click', toMenu);

/* ---------------- Start ---------------- */
resize();
toMenu();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => resize());
requestAnimationFrame(loop);

// tryb testowy: ?test=1
if (/[?&]test=/.test(location.search)) {
  window.__G = () => G;
  window.__start = () => { hideScreens(); newGame('archer'); };
  window.__pick = i => { if (G && G.currentOffer && G.modal) pickCard(G.currentOffer[i] || G.currentOffer[0]); };
  window.__input = input;
}
