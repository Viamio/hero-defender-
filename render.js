'use strict';
/* =====================================================================
   Grafika – wszystko rysowane kodem (canvas 2D), bez plików graficznych.
   ===================================================================== */

const TAU = Math.PI * 2;


function rng(seed) { // deterministyczny los dla tła
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---------------- Ziemia (nieskończona, kafelkowa) ---------------- */
const TILE = 512;
let groundTile = null, groundPattern = null;
const chunkCache = new Map();
let chunkK = 1;

function buildGround(k) {
  chunkK = k; chunkCache.clear(); spriteK = k; spriteCache.clear();
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(TILE * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  const R = rng(1337);
  g.fillStyle = '#1b1416'; g.fillRect(0, 0, TILE, TILE);
  // plamy ziemi (zawijane na krawędziach, żeby kafel był bez szwów)
  const blob = (x, y, rx, ry, rot, col) => {
    for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
      g.fillStyle = col; g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, rot, 0, TAU); g.fill();
    }
  };
  for (let i = 0; i < 26; i++) {
    const r = 40 + R() * 90;
    blob(R() * TILE, R() * TILE, r, r * 0.7, R() * 3, `rgba(${32 + R() * 14 | 0},${24 + R() * 10 | 0},${24 + R() * 8 | 0},${0.25 + R() * 0.2})`);
  }
  for (let i = 0; i < 60; i++) {
    const r = 4 + R() * 14;
    blob(R() * TILE, R() * TILE, r, r * 0.6, R() * 3, `rgba(${14 + R() * 10 | 0},${10 + R() * 6 | 0},${11 + R() * 6 | 0},${0.35 + R() * 0.2})`);
  }
  // drobne kamyki
  for (let i = 0; i < 140; i++) {
    const v = 45 + R() * 30 | 0;
    blob(R() * TILE, R() * TILE, 1 + R() * 2.5, 1 + R() * 1.5, R() * 3, `rgba(${v},${v - 6},${v - 6},.55)`);
  }
  // kępki martwej trawy
  g.strokeStyle = 'rgba(70,55,40,.5)'; g.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) {
    const x = 10 + R() * (TILE - 20), y = 10 + R() * (TILE - 20);
    for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 8, y - 4 - R() * 5); g.stroke(); }
  }
  groundTile = c;
  groundPattern = null;
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// dekoracje kawałka mapy (groby, krzyże, drzewa, lawa) – rysowane raz i zapamiętane
function chunkCanvas(cx, cy) {
  const key = cx + ',' + cy;
  let c = chunkCache.get(key);
  if (c) return c;
  if (chunkCache.size > 40) chunkCache.delete(chunkCache.keys().next().value);
  const k = chunkK, pad = 60;
  c = document.createElement('canvas');
  c.width = c.height = Math.round((TILE + pad * 2) * k);
  const g = c.getContext('2d');
  g.scale(k, k); g.translate(pad, pad);
  const R = rng(hash2(cx, cy));
  // pęknięcie z lawą
  if (R() < 0.45) {
    let x = R() * TILE, y = R() * TILE, ang = R() * TAU;
    const pts = [[x, y]];
    for (let j = 0; j < 7; j++) { ang += (R() - 0.5) * 1.2; x += Math.cos(ang) * (14 + R() * 22); y += Math.sin(ang) * (14 + R() * 22); pts.push([x, y]); }
    g.lineCap = 'round';
    for (const [w, col] of [[16, 'rgba(255,80,10,.07)'], [7, 'rgba(255,110,20,.22)'], [2.2, 'rgba(255,190,90,.9)']]) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      pts.forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
    }
  }
  // brukowany fragment drogi
  if (R() < 0.3) {
    const bx = R() * TILE, by = R() * TILE, rad = 50 + R() * 50;
    for (let i = 0; i < 70; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * rad;
      const v = 30 + R() * 16 | 0;
      g.fillStyle = `rgba(${v},${v - 6},${v - 4},.9)`;
      roundRect(g, bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.7, 14 + R() * 6, 9 + R() * 3, 3); g.fill();
    }
  }
  const n = 2 + (R() * 5 | 0);
  for (let i = 0; i < n; i++) {
    const x = 20 + R() * (TILE - 40), y = 20 + R() * (TILE - 40), kind = R();
    if (kind < 0.4) drawGrave(g, x, y, R);
    else if (kind < 0.65) drawCross(g, x, y, R);
    else if (kind < 0.9) drawDeadTree(g, x, y, R);
    else drawBones(g, x, y, R);
  }
  chunkCache.set(key, c);
  return c;
}
function drawBones(g, x, y, R) {
  g.strokeStyle = '#8a8270'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const a = R() * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 4); g.lineTo(x - Math.cos(a) * 7, y - Math.sin(a) * 4); g.stroke(); }
  g.fillStyle = '#a8a08c'; g.beginPath(); g.arc(x + 9, y - 2, 4.5, 0, TAU); g.fill();
  g.fillStyle = '#1a1214'; g.beginPath(); g.arc(x + 7.5, y - 2.5, 1.2, 0, TAU); g.arc(x + 10.5, y - 2.5, 1.2, 0, TAU); g.fill();
}

function drawGround(g, camX, camY, W, H) {
  if (!groundPattern) groundPattern = g.createPattern(groundTile, 'repeat');
  const s = 1 / chunkK;
  g.save();
  g.translate(-camX, -camY);
  const m = new DOMMatrix([s, 0, 0, s, 0, 0]);
  groundPattern.setTransform(m);
  g.fillStyle = groundPattern;
  g.fillRect(camX, camY, W, H);
  const pad = 60;
  const x0 = Math.floor((camX - pad) / TILE), x1 = Math.floor((camX + W + pad) / TILE);
  const y0 = Math.floor((camY - pad) / TILE), y1 = Math.floor((camY + H + pad) / TILE);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    g.drawImage(chunkCanvas(cx, cy), cx * TILE - pad, cy * TILE - pad, TILE + pad * 2, TILE + pad * 2);
  }
  g.restore();
}

let vigCanvas = null;
function drawVignette(g, W, H) {
  if (!vigCanvas || vigCanvas.h !== H) {
    vigCanvas = document.createElement('canvas'); vigCanvas.width = 270; vigCanvas.height = Math.round(H / 2); vigCanvas.h = H;
    const v = vigCanvas.getContext('2d'); v.scale(0.5, 0.5);
    const vg = v.createRadialGradient(W / 2, H * 0.5, H * 0.28, W / 2, H * 0.5, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
  }
  g.drawImage(vigCanvas, 0, 0, W, H);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function drawGrave(g, x, y, R) {
  const w = 16 + R() * 8, h = 20 + R() * 10;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x, y + h * 0.5, w * 0.7, 5, 0, 0, TAU); g.fill();
  g.fillStyle = '#3d3639'; g.beginPath();
  g.moveTo(x - w / 2, y + h / 2); g.lineTo(x - w / 2, y - h / 2 + w / 2); g.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w / 2, y + h / 2); g.fill();
  g.fillStyle = '#4e4649'; g.fillRect(x - w / 2, y - h / 2 + w / 2, 3, h - w / 2);
  g.strokeStyle = '#2a2427'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 4, y - 2); g.lineTo(x + 4, y - 2); g.moveTo(x, y - 6); g.lineTo(x, y + 4); g.stroke();
}
function drawCross(g, x, y, R) {
  const h = 22 + R() * 12, tilt = (R() - 0.5) * 0.4;
  g.save(); g.translate(x, y); g.rotate(tilt);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(0, h / 2, 9, 3, 0, 0, TAU); g.fill();
  g.fillStyle = '#4a3a30'; g.fillRect(-2.5, -h / 2, 5, h); g.fillRect(-9, -h / 2 + 6, 18, 4.5);
  g.restore();
}
function drawDeadTree(g, x, y, R) {
  g.strokeStyle = '#140d0e'; g.lineCap = 'round';
  const branch = (bx, by, ang, len, w) => {
    if (len < 5) return;
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    branch(ex, ey, ang - 0.45 - R() * 0.3, len * 0.68, w * 0.65);
    branch(ex, ey, ang + 0.4 + R() * 0.3, len * 0.62, w * 0.65);
  };
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(x, y, 16, 5, 0, 0, TAU); g.fill();
  branch(x, y, -Math.PI / 2 + (R() - 0.5) * 0.3, 22 + R() * 10, 6);
}

/* ---------------- Wrogowie ---------------- */
// okres animacji (s) dla każdego typu – z niego liczymy klatki
const ANIM_PERIOD = { skeleton: TAU / 9, spider: TAU / 16, ghoul: TAU / 5, cultist: TAU / 4, bat: TAU / 22,
  butcher: TAU / 5, queen: TAU / 16, priest: TAU / 1.5 };
const FACED = { skeleton: 1, ghoul: 1, butcher: 1 };
const FRAMES = 6;
const spriteCache = new Map();
let spriteK = 2;

function drawEnemyBody(g, e, fl, face) {
  const s = e.boss ? e.r / 20 : 1;
  switch (e.type) {
    case 'skeleton': drawSkeleton(g, e, 0, fl, face); break;
    case 'spider': drawSpider(g, e, 0, fl, 1, '#5a1018', '#8a1a26'); break;
    case 'ghoul': drawGhoul(g, e, 0, fl, face, 1, '#5d6650', '#3f4636'); break;
    case 'cultist': drawCultist(g, e, 0, fl, 1, '#3d2050', '#9cff5a'); break;
    case 'bat': drawBat(g, e, 0, fl); break;
    case 'butcher': drawGhoul(g, e, 0, fl, face, s, '#7a2a2a', '#4a1616', true); break;
    case 'queen': drawSpider(g, e, 0, fl, s * 0.95, '#3a1050', '#7a2aa0', true); break;
    case 'priest': drawCultist(g, e, 0, fl, s, '#1a1a2e', '#ff4a6a', true); break;
  }
}

function enemySprite(e, fl, face) {
  const per = ANIM_PERIOD[e.type] || 1;
  const fr = Math.floor(((e.anim % per) / per) * FRAMES) % FRAMES;
  const r = Math.round(e.r);
  const key = e.type + r + (fl ? 'f' : '') + face + fr;
  let c = spriteCache.get(key);
  if (c) return c;
  const half = Math.ceil(e.boss ? r * 2.2 : r * 2.6 + 16);
  c = document.createElement('canvas');
  c.width = c.height = Math.ceil(half * 2 * spriteK);
  c.half = half;
  const g = c.getContext('2d');
  g.scale(spriteK, spriteK); g.translate(half, half);
  g.fillStyle = 'rgba(0,0,0,.4)';
  g.beginPath(); g.ellipse(0, r * (e.fly ? 1.6 : 0.8), r * 0.9, r * 0.35, 0, 0, TAU); g.fill();
  drawEnemyBody(g, { type: e.type, r, boss: e.boss, fly: e.fly, anim: (fr + 0.5) / FRAMES * per, charge: 0 }, fl, face);
  spriteCache.set(key, c);
  return c;
}

function drawEnemy(g, e, t) {
  const fl = e.flash > 0;
  const face = FACED[e.type] ? (e.vx < 0 ? -1 : 1) : 1;
  if (e.slowT > 0) { g.strokeStyle = 'rgba(120,210,255,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(e.x, e.y + e.r * 0.8, e.r, e.r * 0.38, 0, 0, TAU); g.stroke(); }
  if (e.elite) { g.strokeStyle = 'rgba(255,200,60,.8)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(e.x, e.y + e.r * 0.8, e.r * 1.2, e.r * 0.45, 0, 0, TAU); g.stroke(); }
  const sp = enemySprite(e, fl, face);
  g.drawImage(sp, e.x - sp.half, e.y - sp.half, sp.half * 2, sp.half * 2);
  // ładowanie czaru u kultystów
  if (e.charge > 0.4) {
    const s = e.boss ? e.r / 20 : 1;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = e.type === 'priest' ? 'rgba(255,74,106,.5)' : 'rgba(156,255,90,.45)';
    g.beginPath(); g.arc(e.x + 11 * s, e.y - 21 * s, 4 + e.charge * 7 * s, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  if (!e.boss && (e.bar || e.elite) && e.hp < e.max) {
    const w = e.r * 2.2;
    g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
    g.fillStyle = '#e03a3a'; g.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.max), 4);
  }
}
const C = (fl, c) => fl ? '#ffffff' : c;

function glowEyes(g, pts, col, r = 1.8) {
  g.fillStyle = col;
  for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.globalAlpha = 0.35;
  for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, r * 2.4, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}

function drawSkeleton(g, e, t, fl, face) {
  const step = Math.sin(e.anim * 9);
  g.strokeStyle = C(fl, '#cfc6b0'); g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-3, 4); g.lineTo(-4 - step * 3, 13); g.moveTo(3, 4); g.lineTo(4 + step * 3, 13); g.stroke();
  // tułów/żebra
  g.fillStyle = C(fl, '#2a2224'); g.beginPath(); g.ellipse(0, -1, 7, 8, 0, 0, TAU); g.fill();
  g.strokeStyle = C(fl, '#d9d0bb'); g.lineWidth = 1.6;
  for (let i = -4; i <= 4; i += 3) { g.beginPath(); g.moveTo(-5, i); g.lineTo(5, i); g.stroke(); }
  // ramię z mieczem
  g.save(); g.scale(face, 1);
  g.strokeStyle = C(fl, '#cfc6b0'); g.lineWidth = 2; g.beginPath(); g.moveTo(5, -3); g.lineTo(10, 3 + step); g.stroke();
  g.strokeStyle = C(fl, '#8a7a6a'); g.lineWidth = 2.4; g.beginPath(); g.moveTo(10, 3 + step); g.lineTo(16, -9 + step); g.stroke();
  g.restore();
  // czaszka
  g.fillStyle = C(fl, '#ebe3cf'); g.beginPath(); g.arc(0, -12, 7, 0, TAU); g.fill();
  g.fillStyle = C(fl, '#ebe3cf'); g.fillRect(-4, -8, 8, 4);
  g.fillStyle = '#120a0a'; g.beginPath(); g.arc(-2.6, -12, 2.2, 0, TAU); g.arc(2.6, -12, 2.2, 0, TAU); g.fill();
  if (!fl) glowEyes(g, [[-2.6, -12], [2.6, -12]], '#ff3a2a', 1.1);
}

function drawSpider(g, e, t, fl, s, c1, c2, boss) {
  g.scale(s, s);
  const a = e.anim * 16;
  g.strokeStyle = C(fl, '#1a0a0c'); g.lineWidth = boss ? 2.6 : 2; g.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const base = -0.9 + i * 0.6, wig = Math.sin(a + i * 1.7 + side) * 0.25;
      const ang = side > 0 ? base + wig : Math.PI - base - wig;
      const kx = Math.cos(ang) * 10, ky = Math.sin(ang) * 8 - 4;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(kx, ky); g.lineTo(kx * 1.6, ky * 1.3 + 6); g.stroke();
    }
  }
  g.fillStyle = C(fl, c1); g.beginPath(); g.ellipse(0, 4, 9, 8, 0, 0, TAU); g.fill();
  g.fillStyle = C(fl, c2); g.beginPath(); g.ellipse(0, 4, 4, 5, 0, 0, TAU); g.fill();
  g.fillStyle = C(fl, '#1c0b0e'); g.beginPath(); g.arc(0, -5, 5.5, 0, TAU); g.fill();
  if (!fl) glowEyes(g, [[-2.5, -6], [2.5, -6], [-1, -8], [1, -8]], boss ? '#ff4aff' : '#ff2a3a', 1.1);
  if (boss) { // korona z kolców
    g.fillStyle = C(fl, '#d0a0ff');
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 3 - 1.5, -10); g.lineTo(i * 3, -15 - Math.abs(i) * -1); g.lineTo(i * 3 + 1.5, -10); g.fill(); }
  }
}

function drawGhoul(g, e, t, fl, face, s, c1, c2, boss) {
  g.scale(s, s);
  const sw = Math.sin(e.anim * 5);
  g.save(); g.scale(face, 1);
  g.fillStyle = C(fl, c2); g.beginPath(); g.ellipse(-4, 8, 6, 5, 0, 0, TAU); g.ellipse(6, 8, 6, 5, 0, 0, TAU); g.fill();
  g.fillStyle = C(fl, c1); g.beginPath(); g.ellipse(0, -2, 15, 13, 0.15, 0, TAU); g.fill();
  // kręgosłup
  g.fillStyle = C(fl, c2); for (let i = -8; i <= 4; i += 4) { g.beginPath(); g.arc(-6, i, 2.2, 0, TAU); g.fill(); }
  // ręce z pazurami
  g.strokeStyle = C(fl, c1); g.lineWidth = 4.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(10, -4); g.lineTo(18, 6 + sw * 3); g.stroke();
  g.beginPath(); g.moveTo(-8, -2); g.lineTo(-14, 9 - sw * 3); g.stroke();
  g.strokeStyle = C(fl, '#ddd'); g.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(18, 6 + sw * 3); g.lineTo(22, 8 + sw * 3 + i * 3); g.stroke(); }
  if (boss) { // tasak
    g.fillStyle = C(fl, '#9aa0a8'); g.save(); g.translate(20, 4 + sw * 3); g.rotate(-0.5 + sw * 0.3);
    g.fillRect(-2, -18, 4, 14); g.fillRect(-2, -26, 14, 12); g.fillStyle = C(fl, '#5a2020'); g.fillRect(-2, -16, 4, 8); g.restore();
  }
  // głowa
  g.fillStyle = C(fl, c1); g.beginPath(); g.ellipse(9, -12, 7, 6, 0, 0, TAU); g.fill();
  g.fillStyle = '#100'; g.fillRect(9, -9, 6, 2);
  if (!fl) glowEyes(g, [[8, -14], [12, -13]], boss ? '#ffcc33' : '#ffea6a', 1.3);
  if (boss) { g.fillStyle = C(fl, '#d8cfc0'); g.beginPath(); g.moveTo(4, -16); g.lineTo(1, -26); g.lineTo(7, -17); g.moveTo(12, -17); g.lineTo(16, -27); g.lineTo(15, -16); g.fill(); }
  g.restore();
}

function drawCultist(g, e, t, fl, s, robe, flame, boss) {
  g.scale(s, s);
  const bob = Math.sin(e.anim * 4) * 1.2;
  g.fillStyle = C(fl, robe);
  g.beginPath(); g.moveTo(-10, 12); g.lineTo(-6, -8 + bob); g.lineTo(6, -8 + bob); g.lineTo(10, 12); g.closePath(); g.fill();
  g.fillStyle = C(fl, '#140a18'); g.beginPath(); g.arc(0, -10 + bob, 6.5, 0, TAU); g.fill();
  g.fillStyle = C(fl, robe); g.beginPath(); g.moveTo(-7, -9 + bob); g.lineTo(0, -21 + bob); g.lineTo(7, -9 + bob); g.closePath(); g.fill();
  if (!fl) glowEyes(g, [[-2, -10 + bob], [2, -10 + bob]], flame, 1.1);
  // laska
  g.strokeStyle = C(fl, '#4a3020'); g.lineWidth = 2; g.beginPath(); g.moveTo(9, 12); g.lineTo(11, -18); g.stroke();
  const fx = 11, fy = -21;
  g.globalCompositeOperation = 'lighter';
  const pr = 4 + Math.sin(e.anim * 12) * 1.2 + (e.charge || 0) * 4;
  g.fillStyle = flame; g.globalAlpha = 0.9; g.beginPath(); g.arc(fx, fy, pr * 0.6, 0, TAU); g.fill();
  g.globalAlpha = 0.3; g.beginPath(); g.arc(fx, fy, pr * 1.6, 0, TAU); g.fill();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (boss) {
    g.fillStyle = C(fl, '#ffcf4a');
    g.beginPath(); g.moveTo(-6, -18 + bob); g.lineTo(-5, -25 + bob); g.lineTo(-2, -20 + bob); g.lineTo(0, -27 + bob); g.lineTo(2, -20 + bob); g.lineTo(5, -25 + bob); g.lineTo(6, -18 + bob); g.fill();
    // krążące czaszki
    for (let i = 0; i < 3; i++) {
      const a = e.anim * 1.5 + i * TAU / 3;
      g.fillStyle = C(fl, '#e8e0cc'); g.beginPath(); g.arc(Math.cos(a) * 18, Math.sin(a) * 8 - 4, 3, 0, TAU); g.fill();
    }
  }
}

function drawBat(g, e, t, fl) {
  const f = Math.sin(e.anim * 22);
  g.translate(0, -8);
  g.fillStyle = C(fl, '#4a2a3e');
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(sd * 10, -10 - f * 6, sd * 18, -2 - f * 8);
    g.lineTo(sd * 12, 2); g.lineTo(sd * 8, 0); g.lineTo(sd * 5, 4); g.closePath(); g.fill();
  }
  g.fillStyle = C(fl, '#5a3448'); g.beginPath(); g.ellipse(0, 1, 5, 6, 0, 0, TAU); g.fill();
  if (!fl) glowEyes(g, [[-1.8, -1], [1.8, -1]], '#ff3a3a', 1);
}

/* ---------------- Bohater i wieżyczki ---------------- */
function drawHero(g, x, y, ang, draw, t, walk = 0, hurt = 0) {
  g.save(); g.translate(x, y); g.scale(1.3, 1.3);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(0, 12, 14, 5, 0, 0, TAU); g.fill();
  // nogi
  const st = Math.sin(walk * 12) * (walk ? 4 : 0);
  g.fillStyle = '#2a1c14';
  g.beginPath(); g.ellipse(-5, 9 + st * 0.4, 3.5, 4.5, 0, 0, TAU); g.ellipse(5, 9 - st * 0.4, 3.5, 4.5, 0, 0, TAU); g.fill();
  g.translate(0, -2 + Math.abs(st) * -0.25);
  if (hurt > 0) g.globalAlpha = 0.55 + Math.sin(t * 60) * 0.35;
  g.fillStyle = '#1f3524'; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
  g.fillStyle = '#2d4a33'; g.beginPath(); g.arc(0, -2, 9, 0, TAU); g.fill();
  g.rotate(ang);
  // łuk
  const pull = draw * 6;
  g.strokeStyle = '#7a4a22'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(4, 0, 15, -1.15, 1.15); g.stroke();
  const ex = 4 + Math.cos(1.15) * 15, ey = Math.sin(1.15) * 15;
  g.strokeStyle = '#e8dcc0'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(ex, -ey); g.lineTo(4 - pull, 0); g.lineTo(ex, ey); g.stroke();
  if (draw > 0.1) { g.strokeStyle = '#c8b090'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(4 - pull, 0); g.lineTo(22, 0); g.stroke(); }
  // ręce
  g.fillStyle = '#c9a07a'; g.beginPath(); g.arc(17, 0, 2.6, 0, TAU); g.arc(4 - pull, 0, 2.4, 0, TAU); g.fill();
  g.rotate(-ang);
  // kaptur
  g.fillStyle = '#16261a'; g.beginPath(); g.arc(0, -3, 6.5, 0, TAU); g.fill();
  g.fillStyle = '#ffb347'; g.globalAlpha = 0.9; g.beginPath(); g.arc(Math.cos(ang) * 3 - 1.5, -3 + Math.sin(ang) * 3, 1, 0, TAU); g.arc(Math.cos(ang) * 3 + 1.5, -3 + Math.sin(ang) * 3, 1, 0, TAU); g.fill(); g.globalAlpha = 1;
  g.restore();
}

function drawRaven(g, r, t) {
  const f = Math.sin(t * 18 + r.a);
  g.save(); g.translate(r.x, r.y);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 18, 8, 3, 0, 0, TAU); g.fill();
  g.rotate(r.ang || 0);
  g.fillStyle = '#0c0a10';
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(-2, 0); g.quadraticCurveTo(0, sd * (10 + f * 4), -8, sd * (14 + f * 5)); g.lineTo(-6, sd * 2); g.fill(); }
  g.beginPath(); g.ellipse(0, 0, 8, 4, 0, 0, TAU); g.fill();
  g.fillStyle = '#d0a020'; g.beginPath(); g.moveTo(7, -1.5); g.lineTo(12, 0); g.lineTo(7, 1.5); g.fill();
  g.fillStyle = '#ff3030'; g.beginPath(); g.arc(5, -1.5, 0.9, 0, TAU); g.fill();
  g.restore();
}

/* ---------------- Pociski ---------------- */
function drawArrow(g, a) {
  const ang = Math.atan2(a.vy, a.vx);
  if (a.kind === 'bullet' || a.kind === 'pellet') {
    const L = a.kind === 'bullet' ? 30 : 12;
    g.save(); g.translate(a.x, a.y); g.rotate(ang);
    g.globalCompositeOperation = 'lighter';
    const tr = g.createLinearGradient(-L, 0, 0, 0); tr.addColorStop(0, 'rgba(0,0,0,0)'); tr.addColorStop(1, a.glow);
    g.strokeStyle = tr; g.lineWidth = a.kind === 'bullet' ? 4 : 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, 0); g.stroke();
    g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(0, 0, a.kind === 'bullet' ? 2.6 : 2.2, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.restore(); return;
  }
  if (a.kind === 'knife') {
    g.save(); g.translate(a.x, a.y); g.rotate(ang);
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(200,220,255,.25)'; g.lineWidth = 5; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-6, 0); g.stroke(); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#3a2418'; g.fillRect(-9, -2, 7, 4);
    g.fillStyle = '#8a7a50'; g.fillRect(-3, -3.5, 2, 7);
    g.fillStyle = '#dde2ea'; g.beginPath(); g.moveTo(-1, -2.5); g.lineTo(11, 0); g.lineTo(-1, 2.5); g.closePath(); g.fill();
    g.restore(); return;
  }
  const len = a.big ? 44 : a.bolt ? 30 : 22;
  g.save(); g.translate(a.x, a.y); g.rotate(ang);
  // smuga
  g.globalCompositeOperation = 'lighter';
  const tr = g.createLinearGradient(-len * 3, 0, 0, 0);
  tr.addColorStop(0, 'rgba(0,0,0,0)'); tr.addColorStop(1, a.glow);
  g.strokeStyle = tr; g.lineWidth = a.big ? 10 : a.ghost ? 8 : 3.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-len * 3, 0); g.lineTo(0, 0); g.stroke();
  g.globalCompositeOperation = 'source-over';
  if (a.ghost) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(140,255,220,.8)'; g.beginPath(); g.ellipse(0, 0, 16, 5, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  } else {
    g.strokeStyle = a.big ? '#ffe08a' : a.bolt ? '#4a3a2a' : '#8a6040'; g.lineWidth = a.big ? 3.5 : a.bolt ? 3.4 : 2;
    g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, 0); g.stroke();
    g.fillStyle = a.big ? '#fff2b0' : '#cfd4da';
    const hs = a.big ? 9 : a.bolt ? 7 : 5;
    g.beginPath(); g.moveTo(hs + 2, 0); g.lineTo(-2, -hs * 0.6); g.lineTo(-2, hs * 0.6); g.fill();
    if (!a.bolt) { g.fillStyle = a.big ? '#ffcf4a' : '#c23030'; g.fillRect(-len, -3, 5, 2); g.fillRect(-len, 1, 5, 2); }
  }
  g.restore();
}

/* ---------------- Efekty broni ---------------- */
function drawAxeHead(g, x, y, ang, s, col) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  g.strokeStyle = '#5a3a20'; g.lineWidth = 3.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, 0); g.lineTo(12, 0); g.stroke();
  g.fillStyle = col || '#c8ccd4';
  g.beginPath(); g.moveTo(6, -2); g.quadraticCurveTo(10, -13, 18, -12); g.quadraticCurveTo(15, 0, 18, 12); g.quadraticCurveTo(10, 13, 6, 2); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(16, -10); g.quadraticCurveTo(13.5, 0, 16, 10); g.lineTo(17.5, 10); g.quadraticCurveTo(15, 0, 17.5, -10); g.fill();
  g.restore();
}

function drawWeaponFx(g, t) {
  const P = G.p;
  // aura
  for (const w of G.weapons) if (w.id === 'aura' && w.R) {
    const R = w.R * (1 + Math.sin(t * 4) * 0.03);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(P.x, P.y, R * 0.2, P.x, P.y, R);
    gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(0.75, G.f.swietosc ? 'rgba(255,255,200,.10)' : 'rgba(255,200,90,.07)'); gr.addColorStop(1, G.f.swietosc ? 'rgba(255,255,210,.28)' : 'rgba(255,190,80,.22)');
    g.fillStyle = gr; g.beginPath(); g.arc(P.x, P.y, R, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,220,140,.5)'; g.lineWidth = 2;
    g.setLineDash([10, 12]); g.lineDashOffset = -t * 30;
    g.beginPath(); g.arc(P.x, P.y, R, 0, TAU); g.stroke();
    g.setLineDash([]);
    g.globalCompositeOperation = 'source-over';
  }
  // cięcia toporem / kosą
  for (const s of G.slashes) {
    const pr = Math.min(1, s.t / (s.max * 0.55)), a = 1 - s.t / s.max;
    const full = s.arc >= TAU - 0.01;
    const a0 = full ? s.ang : s.ang - s.arc / 2, a1 = a0 + s.arc * pr;
    const R = s.R, inner = R * (s.kind === 'kosa' ? 0.72 : 0.45);
    g.globalAlpha = a * 0.85;
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(P.x, P.y, inner, P.x, P.y, R);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, s.col); gr.addColorStop(1, 'rgba(255,255,255,.9)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(P.x, P.y, R, a0, a1); g.arc(P.x, P.y, inner, a1, a0, true); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = Math.min(1, a * 1.6);
    if (s.kind === 'topor') drawAxeHead(g, P.x + Math.cos(a1) * R * 0.78, P.y + Math.sin(a1) * R * 0.78, a1 + Math.PI / 2, 1.2);
    else if (s.kind === 'kosa') {
      const x = P.x + Math.cos(a1) * R * 0.86, y = P.y + Math.sin(a1) * R * 0.86;
      g.save(); g.translate(x, y); g.rotate(a1 + Math.PI / 2);
      g.fillStyle = '#d8d0ff'; g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(10, -26, 34, -18); g.quadraticCurveTo(14, -12, 4, 6); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(x, y); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // topory-bumerangi
  for (const b of G.boomers) {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(b.x, b.y + 16, 12 * b.size, 4, 0, 0, TAU); g.fill();
    drawAxeHead(g, b.x, b.y, b.t * 18, b.size, G.f.berserk ? '#ff8a6a' : '#c8ccd4');
  }
  // błysk lufy arkebuza
  for (const w of G.weapons) if (w.id === 'arkebuz' && w.flashT > 0) {
    g.save(); g.translate(P.x, P.y); g.rotate(w.flashA);
    g.fillStyle = '#3a2a1e'; g.fillRect(8, -2.5, 22, 5); g.fillStyle = '#6a6a72'; g.fillRect(26, -2, 8, 4);
    g.restore();
  }
}
