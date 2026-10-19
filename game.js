'use strict';
/* =====================================================================
   OSTATNIA WIEŻA – logika gry
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
  const k = Math.min(SCALE * DPR, 3);
  bgCanvas = buildBackground(W, H, k);
  towerCanvas = buildTower(k);
  if (G) { G.tower.y = H - 200; G.hero.y = G.tower.y - 22; }
}
window.addEventListener('resize', resize);

/* ---------------- Sterowanie ---------------- */
const input = { down: false, x: 0, y: 0, id: null };
function toGame(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
cv.addEventListener('pointerdown', e => {
  SFX.init();
  if (input.id !== null) return;
  input.id = e.pointerId; input.down = true;
  const p = toGame(e); input.x = p.x; input.y = p.y;
  if (G && !G.touched) { G.touched = true; $('hint').classList.add('hidden'); }
});
window.addEventListener('pointermove', e => {
  if (e.pointerId !== input.id) return;
  const p = toGame(e); input.x = p.x; input.y = p.y;
});
const release = e => { if (e.pointerId === input.id) { input.id = null; input.down = false; } };
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && !G.modal) openPause(); });

function vib(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

/* =====================================================================
   NOWA GRA
   ===================================================================== */
function newGame(cls) {
  G = {
    cls, t: 0, wave: 0, waveT: 0, clearT: 0, spawnQ: [], spawnMult: 1,
    enemies: [], arrows: [], eShots: [], parts: [], nums: [], orbs: [], pools: [], lobs: [], bolts: [], rains: [],
    tower: { x: W / 2, y: H - 200, hp: BALANCE.towerHp, max: BALANCE.towerHp },
    hero: { x: W / 2, y: H - 222, ang: -Math.PI / 2, cd: 0, draw: 0 },
    s: { dmg: 10, rate: 2.6, speed: 950, pierce: 0, multi: 1, ricochet: 0, crit: 0.05, critMult: 2,
         burn: 0, slow: 0, poison: 0, chain: 0, chainJumps: 3, explode: 0, lifesteal: 0, xpMult: 1,
         thorns: 0, armor: 0, hpRegen: 0, dmgMult: 1, rateMult: 1, bigEvery: 0, bigMult: 0 },
    f: {}, cards: {}, cardRar: {}, turrets: [], ravens: [], freeSlots: [0, 3, 1, 2, 5, 4],
    level: 1, xp: 0, xpNeed: BALANCE.xpNeed(1), pending: 0, sinceRare: 0,
    kills: 0, bossKills: 0, rerolls: BALANCE.rerolls, shots: 0,
    skill: { cd: 3, max: 14 }, shake: 0, hurt: 0, banner: null, boss: null, bossIdx: 0,
    modal: null, over: false, overT: 0, touched: false, gniewT: 0, slow: 1,
  };
  input.down = false; input.id = null;
  showHud(true);
  $('hint').classList.remove('hidden');
  updateHud();
  // błogosławieństwo na start
  const pool = [...BLESSINGS].sort(() => Math.random() - 0.5).slice(0, 3);
  openCards('blessing', pool.map(b => ({ bless: b, r: 0 })));
}

/* =====================================================================
   FALE
   ===================================================================== */
function nextWave() {
  G.wave++; G.waveT = 0; G.clearT = 0;
  const w = G.wave;
  if (w > 1) healTower(G.tower.max * BALANCE.regenPerWave, true);
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
      const side = pickSide();
      for (let i = 0; i < g; i++) G.spawnQ.push({ t: t + i * 0.08, type, side });
      made += g;
    } else { G.spawnQ.push({ t, type }); made++; }
  }
  // elita co 3 fale od 4
  if (w >= 4 && w % 3 === 1) G.spawnQ.push({ t: 8, type: w >= 8 ? 'ghoul' : 'skeleton', elite: true });
  G.spawnQ.sort((a, b) => a.t - b.t);
  const isBoss = w % BALANCE.bossEvery === 0;
  if (isBoss) {
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
function pickSide() {
  const x = Math.random();
  return x < 0.6 ? 'top' : x < 0.8 ? 'left' : 'right';
}
function spawnPos(side) {
  if (side === 'top') return { x: rand(30, W - 30), y: rand(-50, -20) };
  if (side === 'left') return { x: rand(-50, -20), y: rand(60, H * 0.5) };
  return { x: W + rand(20, 50), y: rand(60, H * 0.5) };
}
function spawnEnemy(type, opts = {}) {
  const w = G.wave;
  let D, isBoss = false;
  if (type === 'boss') { D = opts.boss; isBoss = true; type = D.id; }
  else D = ENEMIES[type];
  const p = opts.x !== undefined ? { x: opts.x, y: opts.y } : isBoss ? { x: W / 2, y: -60 } : spawnPos(opts.side || pickSide());
  let hp = D.hp * BALANCE.hpMult(w);
  if (isBoss) hp *= 1 + G.bossIdx * 0.25;
  const e = {
    type, x: p.x, y: p.y, vx: 0, vy: 0, r: D.r, hp, max: hp, spd: D.spd * rand(0.9, 1.1),
    dmg: D.dmg * BALANCE.dmgMult(w), rate: D.rate, atk: rand(0.2, 0.8), xp: D.xp * BALANCE.xpMult(w),
    range: D.range || 0, fly: !!D.fly, bar: !!D.bar, anim: Math.random() * 10, flash: 0,
    burnT: 0, burnDps: 0, poisonS: 0, poisonT: 0, slowT: 0, slowAmt: 0, dotT: 0, acc: 0, accT: 0,
    boss: isBoss, special: D.special || 0, specT: (D.special || 0) * 0.6, name: D.name,
  };
  if (opts.elite) {
    e.elite = true; e.hp = e.max = hp * 6; e.r *= 1.35; e.dmg *= 1.6; e.xp *= 8; e.bar = true;
  }
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
  if (o.quiet) { e.acc += amt; }
  else {
    floatNum(e.x + rand(-6, 6), e.y - e.r - 6, amt, crit ? '#ffe14a' : (o.col || '#ffffff'), crit ? 1.45 : (o.size || 1));
    if (crit) SFX.crit(); else SFX.hit();
  }
  if (e.hp <= 0) killEnemy(e, o);
  return crit;
}

function killEnemy(e, o = {}) {
  if (e.dead) return;
  e.dead = true; G.kills++;
  const n = e.boss ? 40 : e.elite ? 20 : 8;
  const col = e.type === 'skeleton' ? '#e8e0cc' : e.type === 'spider' || e.type === 'queen' ? '#7a1020' : e.type === 'cultist' || e.type === 'priest' ? '#6a2a8a' : '#5a6a4a';
  for (let i = 0; i < n; i++) part(e.x, e.y, rand(-160, 160), rand(-200, 40), rand(0.3, 0.7), rand(2, 4.5), col, false, 400);
  for (let i = 0; i < n / 2; i++) part(e.x, e.y, rand(-60, 60), rand(-90, -20), rand(0.4, 0.9), rand(3, 7), 'rgba(255,90,40,.6)', true);
  SFX.kill();
  // doświadczenie
  const orbs = e.boss ? 12 : e.elite ? 6 : 1;
  for (let i = 0; i < orbs; i++) G.orbs.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), vx: rand(-60, 60), vy: rand(-80, -20), t: 0, val: e.xp / orbs, big: e.xp >= 3 });
  // efekty przy zabiciu
  if (G.s.lifesteal) healTower(G.s.lifesteal);
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
  } else if (e.elite) {
    G.chest = (G.chest || 0) + 1; SFX.legend();
  }
}

function applyOnHit(e, a) {
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

function damageTower(amt, src) {
  if (G.over) return;
  amt *= 1 - G.s.armor;
  G.tower.hp -= amt;
  G.hurt = Math.min(1, G.hurt + 0.25);
  G.shake = Math.max(G.shake, 3 + Math.min(8, amt / 6));
  floatNum(G.tower.x + rand(-60, 60), G.tower.y - 70, amt, '#ff4a4a', 1);
  SFX.tower(); vib(25);
  if (src && G.s.thorns) hurt(src, G.s.thorns, { col: '#9be36a' });
  if (G.tower.hp <= 0) {
    if (G.f.feniks && !G.f.feniksUsed) {
      G.f.feniksUsed = true; G.tower.hp = G.tower.max * 0.6;
      banner('SERCE FENIKSA', 'Wieża powstaje z popiołów!', '#ffc83a', 2.2);
      explode(G.tower.x, G.tower.y, 260, baseDmg() * 12, '#ffb020');
      G.shake = 20; SFX.legend(); vib([200, 80, 200]);
    } else gameOver();
  }
}
function healTower(v, show) {
  const before = G.tower.hp;
  G.tower.hp = Math.min(G.tower.max, G.tower.hp + v);
  if (show && G.tower.hp - before >= 1) floatNum(G.tower.x, G.tower.y - 90, G.tower.hp - before, '#6aff8a', 1.2, '+');
}

/* ---------------- Strzelanie bohatera ---------------- */
function nearestEnemy(x, y, maxD = Infinity) {
  let best = null, bd = maxD * maxD;
  for (const e of G.enemies) {
    if (e.dead || e.y < -10 || e.x < -10 || e.x > W + 10) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function updateHero(dt) {
  const h = G.hero, s = G.s;
  h.cd -= dt; h.draw = Math.max(0, h.draw - dt * 4);
  let ang = null;
  if (input.down && G.touched) ang = Math.atan2(input.y - h.y, input.x - h.x);
  else {
    const e = nearestEnemy(h.x, h.y);
    if (e) {
      // lekkie wyprzedzenie celu
      const d = Math.hypot(e.x - h.x, e.y - h.y), tt = d / s.speed;
      ang = Math.atan2(e.y + e.vy * tt - h.y, e.x + e.vx * tt - h.x);
    }
  }
  if (ang === null) return;
  h.ang = ang;
  const rate = s.rate * s.rateMult * (input.down ? 1 : 0.75);
  if (h.cd <= 0) {
    h.cd = 1 / rate; h.draw = 1;
    const n = s.multi, spread = 0.13;
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * spread;
      fireArrow(h.x + Math.cos(ang) * 16, h.y + Math.sin(ang) * 16, a, baseDmg(), s.pierce, s.ricochet);
    }
    G.shots++;
    if (s.bigEvery && G.shots % s.bigEvery === 0) {
      const a = fireArrow(h.x, h.y, ang, baseDmg() * s.bigMult, 999, 0);
      a.big = true; a.r = 18; a.glow = 'rgba(255,210,90,.95)'; a.vx *= 1.2; a.vy *= 1.2;
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
  const a = { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg, pierce, ric, hit: new Set(), r: 7, glow: arrowGlow(), hero: true, life: 2 };
  G.arrows.push(a);
  return a;
}

function updateArrows(dt) {
  for (const a of G.arrows) {
    a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
    if (a.x < -60 || a.x > W + 60 || a.y < -60 || a.y > H + 60 || a.life <= 0) { a.dead = true; continue; }
    for (const e of G.enemies) {
      if (e.dead || a.hit.has(e)) continue;
      const rr = e.r + a.r;
      if ((e.x - a.x) ** 2 + (e.y - a.y) ** 2 > rr * rr) continue;
      a.hit.add(e);
      hurt(e, a.dmg, { canCrit: true, forceCrit: a.forceCrit });
      if (a.hero) applyOnHit(e, a);
      for (let i = 0; i < 3; i++) part(a.x, a.y, rand(-80, 80) - a.vx * 0.05, rand(-80, 80) - a.vy * 0.05, 0.2, 2.5, a.glow, true);
      // grad strzał
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
          const ang = Math.atan2(best.y - a.y, best.x - a.x), sp = Math.hypot(a.vx, a.vy);
          a.vx = Math.cos(ang) * sp; a.vy = Math.sin(ang) * sp; a.life = 1; continue;
        }
      }
      a.dead = true; break;
    }
  }
  G.arrows = G.arrows.filter(a => !a.dead);
}

/* ---------------- Wieżyczki i towarzysze ---------------- */
function slotPos(i) {
  return { x: G.tower.x + Math.cos(SLOT_ANG[i]) * SLOT_R, y: G.tower.y + Math.sin(SLOT_ANG[i]) * SLOT_R * 0.92 };
}
function updateTurrets(dt) {
  for (const tu of G.turrets) {
    const p = slotPos(tu.slot);
    const power = baseDmg() * tu.pow;
    tu.cd -= dt; tu.fire = Math.max(0, tu.fire - dt * 4);
    if (tu.type === 'balista') {
      if (tu.cd > 0) continue;
      // najsilniejszy wróg w zasięgu
      let best = null, bh = -1;
      for (const e of G.enemies) { if (e.dead || e.y < 0) continue; if (dist2(e, p) < 640 * 640 && e.hp > bh) { bh = e.hp; best = e; } }
      if (!best) continue;
      const ang = Math.atan2(best.y - p.y, best.x - p.x); tu.ang = ang; tu.fire = 1;
      tu.cd = 1.7 / (1 + 0.12 * (tu.lvl - 1));
      const shots = G.f.upiory ? [-0.15, 0, 0.15] : [0];
      for (const d of shots) {
        const a = fireArrow(p.x, p.y, ang + d, power * 3 * (G.f.upiory ? 1.5 : 1), G.f.upiory ? 999 : 3, 0);
        a.hero = false; a.bolt = true; a.r = 10; a.vx *= 1.15; a.vy *= 1.15;
        if (G.f.upiory) { a.ghost = true; a.glow = 'rgba(120,255,210,.9)'; } else a.glow = 'rgba(255,240,220,.4)';
      }
    } else if (tu.type === 'miotacz') {
      const range = G.f.smok ? 330 : 210, cone = G.f.smok ? 0.55 : 0.35;
      const tgt = nearestEnemy(p.x, p.y, range);
      if (!tgt) continue;
      tu.ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      for (let i = 0; i < 2; i++) {
        const a = tu.ang + rand(-cone, cone), sp = rand(range * 1.4, range * 1.9);
        part(p.x + Math.cos(tu.ang) * 20, p.y + Math.sin(tu.ang) * 20, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.35, 0.55), rand(5, 10), Math.random() < 0.5 ? '#ff7a1a' : '#ffcf4a', true, 0, false, true);
      }
      SFX.flame();
      if (tu.cd > 0) continue;
      tu.cd = 0.1;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > range + e.r) continue;
        let da = Math.atan2(dy, dx) - tu.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > cone + 0.1) continue;
        hurt(e, power * 0.28, { quiet: true });
        e.burnT = 2.5; e.burnDps = Math.max(e.burnDps, power * 0.5 * (G.f.smok ? 2 : 1));
      }
    } else if (tu.type === 'pily') {
      const n = 1 + tu.lvl + (G.f.taniec ? 3 : 0);
      const R = G.f.taniec ? 150 : 128;
      tu.blades = [];
      for (let i = 0; i < n; i++) {
        const a = G.t * 2.6 + i * TAU / n;
        const bx = G.tower.x + Math.cos(a) * R, by = G.tower.y + Math.sin(a) * R * 0.92;
        tu.blades.push([bx, by]);
        for (const e of G.enemies) {
          if (e.dead || e.fly) continue;
          if ((e.x - bx) ** 2 + (e.y - by) ** 2 > (e.r + 16) ** 2) continue;
          if ((e.bladeCd || 0) > G.t) continue;
          e.bladeCd = G.t + 0.35;
          hurt(e, power * 1.0, { canCrit: true, forceCrit: G.f.taniec, col: '#d0d6e0' });
          part(bx, by, rand(-120, 120), rand(-120, 120), 0.2, 2.5, '#ffe0a0', true);
        }
      }
    } else if (tu.type === 'kociol') {
      if (tu.cd > 0) continue;
      const tgt = densest(260, 700);
      if (!tgt) continue;
      tu.cd = 4 / (1 + 0.1 * (tu.lvl - 1));
      G.lobs.push({ x0: p.x, y0: p.y, x1: tgt.x, y1: tgt.y, t: 0, dur: 0.7, pow: power });
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
      G.pools.push({ x: l.x1, y: l.y1, r: 72, t: 5, tick: 0, pow: l.pow, max: 5 });
      for (let i = 0; i < 12; i++) part(l.x1, l.y1, rand(-140, 140), rand(-140, 60), 0.4, rand(3, 6), '#1a1210', false, 300);
    }
  }
  G.lobs = G.lobs.filter(l => !l.done);
  // kruki
  for (const r of G.ravens) {
    if (!r.tgt || r.tgt.dead) r.tgt = nearestEnemy(G.tower.x, G.tower.y - 40);
    let tx, ty;
    if (r.tgt) { tx = r.tgt.x; ty = r.tgt.y - 6; }
    else { r.a += dt; tx = G.tower.x + Math.cos(r.a) * 120; ty = G.tower.y - 160 + Math.sin(r.a) * 50; }
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy) || 1;
    const sp = 320;
    r.vx = (r.vx || 0) * 0.9 + dx / d * sp * 0.1; r.vy = (r.vy || 0) * 0.9 + dy / d * sp * 0.1;
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
      const alive = G.enemies.filter(e => !e.dead && e.y > 0 && e.x > 0 && e.x < W);
      for (let i = 0; i < 6 && alive.length; i++) {
        const e = alive.splice(Math.random() * alive.length | 0, 1)[0];
        G.bolts.push({ pts: jag([[e.x + rand(-40, 40), -20], [e.x, e.y]]), t: 0.3, col: '#d8f0ff', w: 4 });
        explode(e.x, e.y, 40, baseDmg() * 6, '#bfe6ff', true);
      }
      G.shake = Math.max(G.shake, 6); SFX.zap(); SFX.boom();
    }
  }
}

function densest(r, maxD) {
  let best = null, bc = 0;
  const cand = G.enemies.filter(e => !e.dead && e.y > 0 && dist2(e, G.tower) < maxD * maxD);
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
  const tgt = (input.down && G.touched) ? { x: input.x, y: input.y } : densest(220, 900);
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
  const T = G.tower;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.anim += dt; e.flash -= dt;
    // statusy (tick co 0,5 s)
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

    // ruch
    const dx = T.x - e.x, dy = (T.y - 10) - e.y, d = Math.hypot(dx, dy) || 1;
    const reach = TOWER_R + e.r * 0.6;
    let speed = e.spd * (1 - e.slowAmt) * (e.tarT > 0 ? 0.5 : 1);
    // wejście na planszę: szybko wyjdź spod górnego paska
    if (e.y < (e.boss ? 210 : 110)) speed = Math.max(speed, e.boss ? 120 : e.spd * 1.8);
    if (e.tarT > 0) e.tarT -= dt;
    let stop = false;
    if (e.range && d < e.range + TOWER_R * 0.5) stop = true;
    if (d <= reach) stop = true;
    if (!stop) {
      let mx = dx / d, my = dy / d;
      if (e.fly) { const wob = Math.sin(e.anim * 3) * 0.6; mx += -my * wob; my += mx * wob * 0.3; }
      e.vx = mx * speed; e.vy = my * speed;
      e.x += e.vx * dt; e.y += e.vy * dt;
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    // atak
    e.atk -= dt;
    if (e.range) {
      if (stop && e.atk <= 0 && e.y > 0) {
        e.atk = e.rate;
        if (e.type === 'priest') {
          for (const s of [-0.25, 0, 0.25]) enemyShot(e, s, e.dmg);
        } else enemyShot(e, 0, e.dmg);
      }
      e.charge = stop ? clamp(1 - e.atk / e.rate, 0, 1) : 0;
    } else if (d <= reach + 2 && e.atk <= 0) {
      e.atk = e.rate;
      damageTower(e.dmg, e);
      for (let i = 0; i < 4; i++) part(e.x + dx / d * e.r, e.y + dy / d * e.r, rand(-80, 80), rand(-80, 20), 0.3, 3, '#8a7a70', false, 300);
    }

    // zdolności bossów
    if (e.special) {
      e.specT -= dt;
      if (e.specT <= 0 && e.y > 20) {
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
  // rozpychanie (żeby się nie nakładali)
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
    // nie wchodź w mury
    const dx = a.x - T.x, dy = a.y - (T.y - 10), d = Math.hypot(dx, dy);
    const minD = TOWER_R + a.r * 0.5;
    if (!a.fly && d < minD && d > 0) { a.x = T.x + dx / d * minD; a.y = T.y - 10 + dy / d * minD; }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

function enemyShot(e, spread, dmg) {
  const T = G.tower;
  const ang = Math.atan2(T.y - 20 - e.y, T.x - e.x) + spread;
  G.eShots.push({ x: e.x + 10, y: e.y - 20, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, dmg, col: e.type === 'priest' ? '#ff4a6a' : '#9cff5a', src: e });
}
function updateEShots(dt) {
  const T = G.tower;
  for (const s of G.eShots) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (Math.random() < 0.5) part(s.x, s.y, rand(-20, 20), rand(-20, 20), 0.3, 4, s.col, true);
    if ((s.x - T.x) ** 2 + (s.y - T.y + 20) ** 2 < (TOWER_R - 20) ** 2) { s.dead = true; damageTower(s.dmg, null); explodeFx(s.x, s.y, s.col); }
    if (s.y > H + 40 || s.x < -40 || s.x > W + 40) s.dead = true;
  }
  G.eShots = G.eShots.filter(s => !s.dead);
}
function explodeFx(x, y, col) { for (let i = 0; i < 8; i++) part(x, y, rand(-120, 120), rand(-120, 120), 0.3, 4, col, true); }

/* ---------------- Doświadczenie ---------------- */
function updateOrbs(dt) {
  const T = G.tower;
  for (const o of G.orbs) {
    o.t += dt;
    if (o.t < 0.35) { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 0.92; o.vy *= 0.92; continue; }
    const tx = T.x, ty = T.y - 30, dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
    const sp = 200 + o.t * 900;
    if (d < 20) { o.dead = true; gainXp(o.val); continue; }
    o.x += dx / d * sp * dt; o.y += dy / d * sp * dt;
  }
  G.orbs = G.orbs.filter(o => !o.dead);
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
  const txt = prefix + (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
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

  if (G.over) {
    G.overT += dt;
    updateParts(dt);
    return;
  }

  // fale
  if (G.wave === 0) nextWave();
  G.waveT += dt;
  while (G.spawnQ.length && G.spawnQ[0].t <= G.waveT) {
    if (G.enemies.length >= BALANCE.maxEnemies && G.spawnQ[0].type !== 'boss') { G.spawnQ[0].t += 0.5; G.spawnQ.sort((a, b) => a.t - b.t); break; }
    const s = G.spawnQ.shift();
    spawnEnemy(s.type, s);
  }
  const bossAlive = !!G.boss;
  if (!G.spawnQ.length && G.enemies.length === 0) G.clearT += dt;
  if (G.waveT >= BALANCE.waveLen && !bossAlive) nextWave();
  else if (G.clearT > 1.5) nextWave();

  G.skill.cd = Math.max(0, G.skill.cd - dt);
  if (G.s.hpRegen) healTower(G.s.hpRegen * dt);

  updateHero(dt);
  updateTurrets(dt);
  updateRains(dt);
  updateArrows(dt);
  updateEnemies(dt);
  updateEShots(dt);
  updateOrbs(dt);
  for (const b of G.bolts) b.t -= dt;
  G.bolts = G.bolts.filter(b => b.t > 0);
  updateParts(dt);

  if (!G.touched && G.t > 9) { G.touched = true; $('hint').classList.add('hidden'); }

  // karty do wyboru
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
  ctx.clearRect(0, 0, W, H);
  if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);
  if (!G) { drawMenuScene(); return; }
  const t = G.t;
  const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
  ctx.save(); ctx.translate(sx, sy);

  // ambientowe żarzące się iskry
  if (Math.random() < 0.3) part(Math.random() < 0.5 ? rand(0, 60) : rand(W - 60, W), rand(0, H), rand(-10, 10), rand(-50, -20), rand(1.5, 3), rand(1.5, 3), '#ff8a2a', true);

  // kałuże smoły
  for (const p of G.pools) {
    const a = Math.min(1, p.t / 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#0c0807'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,90,20,.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.75, p.r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // wrogowie (sortowanie po y dla głębi)
  const ground = G.enemies.filter(e => !e.fly).sort((a, b) => a.y - b.y);
  const T = G.tower;
  for (const e of ground) if (e.y < T.y - 40) drawEnemy(ctx, e, t);

  // wieża
  ctx.drawImage(towerCanvas, T.x - 140, T.y - 140, 280, 280);
  // pochodnie
  for (const [ox, oy] of [[-30, -58], [30, -58]]) {
    const f = 0.7 + Math.sin(t * 13 + ox) * 0.15 + Math.random() * 0.1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,130,30,${0.18 * f})`; ctx.beginPath(); ctx.arc(T.x + ox, T.y + oy, 26 * f, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,200,90,${0.9 * f})`; ctx.beginPath(); ctx.arc(T.x + ox, T.y + oy, 3.5 * f, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // ogień na wieży, gdy mało HP
  const hpR = T.hp / T.max;
  if (hpR < 0.4 && Math.random() < (0.4 - hpR) * 2) part(T.x + rand(-70, 70), T.y + rand(-50, 40), rand(-10, 10), rand(-70, -30), rand(0.4, 0.8), rand(5, 10), Math.random() < 0.5 ? '#ff5a1a' : '#ffb347', true);

  for (const tu of G.turrets) { const p = slotPos(tu.slot); drawTurret(ctx, tu, p.x, p.y - 4, t); }
  drawHero(ctx, G.hero.x, G.hero.y, G.hero.ang, G.hero.draw, t);

  for (const e of ground) if (e.y >= T.y - 40) drawEnemy(ctx, e, t);

  // ostrza
  for (const tu of G.turrets) if (tu.blades) for (const [bx, by] of tu.blades) {
    ctx.save(); ctx.translate(bx, by); ctx.rotate(t * 14);
    ctx.fillStyle = G.f.taniec ? '#bfe8ff' : '#c8ccd4';
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -3); ctx.lineTo(10, 4); ctx.fill(); }
    ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // latające
  for (const e of G.enemies) if (e.fly) drawEnemy(ctx, e, t);
  for (const r of G.ravens) drawRaven(ctx, r, t);

  // pociski
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
  // deszcz strzał
  for (const r of G.rains) {
    for (const d of r.drops) {
      if (d.done) continue;
      const k2 = d.t / 0.22, y = d.y - 260 * (1 - k2);
      ctx.strokeStyle = 'rgba(255,220,150,.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(d.x - 6 * (1 - k2), y - 26); ctx.lineTo(d.x, y); ctx.stroke();
    }
    if (r.t < 1.4) { ctx.strokeStyle = `rgba(255,170,80,${0.5 * (1 - r.t / 1.4)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x, r.y, 110, 85, 0, 0, TAU); ctx.stroke(); }
  }
  // pioruny
  for (const b of G.bolts) {
    ctx.strokeStyle = b.col; ctx.globalAlpha = Math.min(1, b.t * 6);
    for (const [w, a] of [[(b.w || 2.5) * 3, 0.25], [b.w || 2.5, 1]]) {
      ctx.lineWidth = w; ctx.globalAlpha = a * Math.min(1, b.t * 6);
      ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // cząsteczki
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
  ctx.globalAlpha = 1;
  // kule doświadczenia
  for (const o of G.orbs) {
    ctx.fillStyle = o.big ? 'rgba(120,200,255,.35)' : 'rgba(80,160,255,.3)';
    ctx.beginPath(); ctx.arc(o.x, o.y, o.big ? 9 : 6, 0, TAU); ctx.fill();
    ctx.fillStyle = o.big ? '#c8ecff' : '#7ac0ff'; ctx.beginPath(); ctx.arc(o.x, o.y, o.big ? 4 : 2.6, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // pasek HP wieży
  const bw = 170, bx = T.x - bw / 2, by = T.y + 116;
  ctx.fillStyle = 'rgba(0,0,0,.7)'; roundRect(ctx, bx - 3, by - 3, bw + 6, 16, 6); ctx.fill();
  const hpw = bw * Math.max(0, T.hp / T.max);
  const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  hg.addColorStop(0, hpR < 0.3 ? '#8a0f1c' : '#2f8a3a'); hg.addColorStop(1, hpR < 0.3 ? '#ff3b3b' : '#7ae07a');
  ctx.fillStyle = hg; roundRect(ctx, bx, by, Math.max(2, hpw), 10, 4); ctx.fill();
  ctx.font = "700 13px 'Cinzel', serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; ctx.fillText(`${Math.ceil(Math.max(0, T.hp))} / ${Math.round(T.max)}`, T.x + 1, by + 24);
  ctx.fillStyle = '#efe3d0'; ctx.fillText(`${Math.ceil(Math.max(0, T.hp))} / ${Math.round(T.max)}`, T.x, by + 23);

  // celownik pod palcem
  if (input.down && G.touched && !G.modal) {
    ctx.strokeStyle = 'rgba(255,180,90,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(input.x, input.y, 16, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(input.x - 24, input.y); ctx.lineTo(input.x - 10, input.y); ctx.moveTo(input.x + 10, input.y); ctx.lineTo(input.x + 24, input.y);
    ctx.moveTo(input.x, input.y - 24); ctx.lineTo(input.x, input.y - 10); ctx.moveTo(input.x, input.y + 10); ctx.lineTo(input.x, input.y + 24); ctx.stroke();
  }

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

  // czerwony błysk przy obrażeniach
  if (G.hurt > 0) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(160,0,0,0)'); vg.addColorStop(1, `rgba(180,0,10,${G.hurt * 0.55})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  // baner
  if (G.banner) {
    const b = G.banner, a = b.t < 0.25 ? b.t / 0.25 : b.t > b.dur - 0.4 ? (b.dur - b.t) / 0.4 : 1;
    const sc = b.t < 0.25 ? 1.4 - b.t / 0.25 * 0.4 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(W / 2, H * 0.32); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-W, -46, W * 2, b.sub ? 92 : 70);
    ctx.font = "900 46px 'Cinzel', serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(b.text, 0, -12);
    ctx.fillStyle = b.col; ctx.fillText(b.text, 0, -12);
    if (b.sub) { ctx.font = "700 19px 'Cinzel', serif"; ctx.fillStyle = '#efe3d0'; ctx.fillText(b.sub, 0, 26); }
    ctx.restore();
  }
  if (G.over) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, G.overT * 0.5)})`; ctx.fillRect(0, 0, W, H);
  }
}

function drawMenuScene() {
  const T = { x: W / 2, y: H - 200 };
  ctx.drawImage(towerCanvas, T.x - 140, T.y - 140, 280, 280);
  const t = performance.now() / 1000;
  drawHero(ctx, T.x, T.y - 22, -Math.PI / 2 + Math.sin(t) * 0.4, 0, t);
  ctx.globalCompositeOperation = 'lighter';
  for (const [ox, oy] of [[-30, -58], [30, -58]]) {
    const f = 0.7 + Math.sin(t * 13 + ox) * 0.15;
    ctx.fillStyle = `rgba(255,130,30,${0.2 * f})`; ctx.beginPath(); ctx.arc(T.x + ox, T.y + oy, 26 * f, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

let lastT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  if (G && !G.modal) update(dt);
  else if (G && G.over) update(dt);
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
  const s = G.skill, ring = $('skillRing');
  ring.style.strokeDashoffset = (289 * (s.cd / s.max)).toFixed(1);
  $('skillCd').textContent = s.cd > 0 ? Math.ceil(s.cd) : '';
  $('skillBtn').classList.toggle('cooling', s.cd > 0);
  if (G.boss) $('bossHpFill').style.width = Math.max(0, G.boss.hp / G.boss.max * 100) + '%';
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
  // synergie i ewolucje wstrzykiwane, gdy są dostępne
  const syn = CARDS.filter(c => c.syn && !used.has(c.id) && cardAvailable(c));
  const evo = CARDS.filter(c => c.evo && !used.has(c.id) && cardAvailable(c));
  if (evo.length && (chest || Math.random() < 0.25)) { offer[offer.length - 1] = { card: evo[Math.random() * evo.length | 0], r: 3 }; gotRare = true; }
  else if (syn.length && (chest || Math.random() < 0.35)) { offer[offer.length - 1] = { card: syn[Math.random() * syn.length | 0], r: 2 }; gotRare = true; }
  G.sinceRare = gotRare ? 0 : G.sinceRare + 1;
  return offer;
}

function openLevelUp(chest) {
  SFX.level(); vib(40);
  openCards(chest ? 'chest' : 'level', rollOffer(chest));
}

function openCards(mode, offer) {
  G.modal = mode;
  input.down = false; input.id = null;
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
  G.over = true; G.tower.hp = 0;
  G.boss = null; $('bossBar').classList.add('hidden');
  input.down = false;
  SFX.die(); vib([200, 100, 300]);
  for (let i = 0; i < 60; i++) part(G.tower.x + rand(-80, 80), G.tower.y + rand(-60, 60), rand(-200, 200), rand(-300, 0), rand(0.6, 1.4), rand(4, 10), Math.random() < 0.5 ? '#ff5a1a' : '#5a5052', Math.random() < 0.5, 400);
  G.shake = 22;
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
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { resize(); });
requestAnimationFrame(loop);

// tryb testowy: ?test=1 zaczyna od razu (do automatycznych testów)
if (/[?&]test=/.test(location.search)) {
  window.__G = () => G;
  window.__start = () => { hideScreens(); newGame('archer'); };
  window.__pick = i => { if (G && G.currentOffer && G.modal) pickCard(G.currentOffer[i] || G.currentOffer[0]); };
}
