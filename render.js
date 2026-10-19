'use strict';
/* =====================================================================
   Grafika – wszystko rysowane kodem (canvas 2D), bez plików graficznych.
   ===================================================================== */

const TOWER_R = 96;                                   // promień murów (kolizja)
const SLOT_ANG = [-160, -125, -55, -20, 160, 20].map(d => d * Math.PI / 180);
const SLOT_R = 84;
const TAU = Math.PI * 2;

let bgCanvas = null, towerCanvas = null;

function rng(seed) { // deterministyczny los dla tła
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---------------- Tło ---------------- */
function buildBackground(W, H, k) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  const R = rng(1337);

  // ziemia
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#120c0e'); grd.addColorStop(0.5, '#1c1416'); grd.addColorStop(1, '#231a1a');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);

  // plamy ziemi
  for (let i = 0; i < 260; i++) {
    const x = R() * W, y = R() * H, r = 6 + R() * 40;
    g.fillStyle = `rgba(${40 + R() * 30 | 0},${28 + R() * 18 | 0},${28 + R() * 14 | 0},${0.12 + R() * 0.15})`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.6, R() * 3, 0, TAU); g.fill();
  }

  // brukowana droga do wieży (od góry)
  const tx = W / 2, ty = H - 200;
  for (let y = -20; y < ty + 40; y += 15) {
    const t = y / ty;
    const half = 70 + t * 70;
    for (let x = tx - half; x < tx + half; x += 19 + R() * 6) {
      const ox = (R() - 0.5) * 4, oy = (R() - 0.5) * 4;
      const w = 15 + R() * 6, h = 10 + R() * 3;
      const v = 30 + R() * 16 | 0;
      g.fillStyle = `rgb(${v},${v - 6},${v - 4})`;
      roundRect(g, x + ox, y + oy, w, h, 3); g.fill();
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(x + ox, y + oy + h - 2, w, 2);
    }
  }
  // przyciemnienie krawędzi drogi
  const roadFade = g.createLinearGradient(0, 0, W, 0);
  roadFade.addColorStop(0, 'rgba(18,12,14,1)'); roadFade.addColorStop(0.3, 'rgba(18,12,14,0)');
  roadFade.addColorStop(0.7, 'rgba(18,12,14,0)'); roadFade.addColorStop(1, 'rgba(18,12,14,1)');
  g.fillStyle = roadFade; g.fillRect(0, 0, W, H);

  // pęknięcia z lawą przy krawędziach
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const left = i % 2 === 0;
    let x = left ? R() * 50 : W - R() * 50, y = R() * H;
    const pts = [[x, y]];
    for (let j = 0; j < 6; j++) { x += (left ? 1 : -1) * (8 + R() * 24); y += (R() - 0.5) * 50; pts.push([x, y]); }
    for (const [w, col] of [[12, 'rgba(255,80,10,.08)'], [6, 'rgba(255,110,20,.25)'], [2.2, 'rgba(255,190,90,.9)']]) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      pts.forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
    }
  }
  // poświata lawy z boków
  for (const side of [0, 1]) {
    const lg = g.createLinearGradient(side ? W : 0, 0, side ? W - 120 : 120, 0);
    lg.addColorStop(0, 'rgba(255,90,20,.22)'); lg.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
  }

  // groby, krzyże, martwe drzewa (poza drogą)
  for (let i = 0; i < 26; i++) {
    const left = R() < 0.5;
    const x = left ? 20 + R() * 110 : W - 20 - R() * 110;
    const y = 40 + R() * (H - 120);
    if (Math.abs(x - tx) < 140 && y > ty - 140) continue;
    const kind = R();
    if (kind < 0.45) drawGrave(g, x, y, R);
    else if (kind < 0.7) drawCross(g, x, y, R);
    else drawDeadTree(g, x, y, R);
  }

  // mgła u góry
  const fog = g.createLinearGradient(0, 0, 0, H * 0.35);
  fog.addColorStop(0, 'rgba(70,30,40,.45)'); fog.addColorStop(1, 'rgba(70,30,40,0)');
  g.fillStyle = fog; g.fillRect(0, 0, W, H * 0.35);

  // winieta
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return c;
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

/* ---------------- Wieża (prerender) ---------------- */
function buildTower(k) {
  const S = 280;
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(S * k);
  const g = c.getContext('2d');
  g.scale(k, k); g.translate(S / 2, S / 2);
  const oct = (r, dy = 0) => {
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + TAU / 16; const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.92 + dy; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath();
  };
  // cień
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.ellipse(0, 26, 118, 70, 0, 0, TAU); g.fill();
  // ściana zewnętrzna (front) + wierzch
  g.fillStyle = '#2b2426'; oct(100, 16); g.fill();
  g.fillStyle = '#5d5456'; oct(100); g.fill();
  g.strokeStyle = '#1b1517'; g.lineWidth = 3; oct(100); g.stroke();
  // dziedziniec
  g.fillStyle = '#2a2123'; oct(76); g.fill();
  const R = rng(77);
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, r = R() * 66;
    g.fillStyle = `rgba(${70 + R() * 30 | 0},${60 + R() * 20 | 0},${60 + R() * 20 | 0},.5)`;
    roundRect(g, Math.cos(a) * r - 5, Math.sin(a) * r * 0.9 - 3, 10, 6, 2); g.fill();
  }
  // blanki
  for (let i = 0; i < 24; i++) {
    const a = i * TAU / 24;
    const px = Math.cos(a) * 92, py = Math.sin(a) * 92 * 0.92;
    g.save(); g.translate(px, py); g.rotate(a);
    g.fillStyle = '#2b2426'; g.fillRect(-5, -6, 10, 14);
    g.fillStyle = '#7a7072'; g.fillRect(-5, -8, 10, 12);
    g.restore();
  }
  // bastiony na sloty wieżyczek
  for (const a of SLOT_ANG) {
    const px = Math.cos(a) * SLOT_R, py = Math.sin(a) * SLOT_R * 0.92;
    g.fillStyle = '#251f21'; g.beginPath(); g.ellipse(px, py + 8, 21, 17, 0, 0, TAU); g.fill();
    g.fillStyle = '#6b6264'; g.beginPath(); g.ellipse(px, py, 21, 17, 0, 0, TAU); g.fill();
    g.fillStyle = '#3b3335'; g.beginPath(); g.ellipse(px, py, 14, 11, 0, 0, TAU); g.fill();
  }
  // brama na dole
  g.fillStyle = '#1a1214'; g.beginPath(); g.moveTo(-22, 108); g.lineTo(-22, 92); g.arc(0, 92, 22, Math.PI, 0); g.lineTo(22, 108); g.fill();
  g.strokeStyle = '#4a3a2c'; g.lineWidth = 2;
  for (let x = -16; x <= 16; x += 8) { g.beginPath(); g.moveTo(x, 78); g.lineTo(x, 108); g.stroke(); }
  // donżon (centralna wieża)
  g.fillStyle = '#231c1e'; roundRect(g, -40, -48, 80, 90, 8); g.fill();
  g.fillStyle = '#6a6062'; roundRect(g, -40, -60, 80, 80, 8); g.fill();
  g.fillStyle = '#3a3133'; roundRect(g, -30, -50, 60, 60, 5); g.fill();
  for (let i = -36; i <= 28; i += 13) {
    g.fillStyle = '#857b7d'; g.fillRect(i, -64, 8, 8); g.fillRect(i, 14, 8, 8);
  }
  // runy na platformie
  g.strokeStyle = 'rgba(255,120,40,.35)'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, -20, 20, 0, TAU); g.stroke();
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(Math.cos(a) * 14, -20 + Math.sin(a) * 14); g.lineTo(Math.cos(a) * 24, -20 + Math.sin(a) * 24); g.stroke(); }
  return c;
}

/* ---------------- Wrogowie ---------------- */
function drawEnemy(g, e, t) {
  const fl = e.flash > 0;
  const face = e.vx < 0 ? -1 : 1;
  g.save(); g.translate(e.x, e.y);
  // cień
  g.fillStyle = 'rgba(0,0,0,.4)';
  g.beginPath(); g.ellipse(0, e.r * (e.fly ? 1.6 : 0.8), e.r * 0.9, e.r * 0.35, 0, 0, TAU); g.fill();
  // statusy pod spodem
  if (e.slowT > 0) { g.strokeStyle = 'rgba(120,210,255,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, e.r * 0.8, e.r, e.r * 0.38, 0, 0, TAU); g.stroke(); }
  if (e.elite) { g.strokeStyle = 'rgba(255,200,60,.8)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, e.r * 0.8, e.r * 1.2, e.r * 0.45, 0, 0, TAU); g.stroke(); }
  const s = e.boss ? e.r / 20 : 1;
  switch (e.type) {
    case 'skeleton': drawSkeleton(g, e, t, fl, face); break;
    case 'spider': drawSpider(g, e, t, fl, 1, '#5a1018', '#8a1a26'); break;
    case 'ghoul': drawGhoul(g, e, t, fl, face, 1, '#5d6650', '#3f4636'); break;
    case 'cultist': drawCultist(g, e, t, fl, 1, '#3d2050', '#9cff5a'); break;
    case 'bat': drawBat(g, e, t, fl); break;
    case 'butcher': drawGhoul(g, e, t, fl, face, s, '#7a2a2a', '#4a1616', true); break;
    case 'queen': drawSpider(g, e, t, fl, s * 0.95, '#3a1050', '#7a2aa0', true); break;
    case 'priest': drawCultist(g, e, t, fl, s, '#1a1a2e', '#ff4a6a', true); break;
  }
  g.restore();
  // pasek HP
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
  g.fillStyle = C(fl, '#24141c');
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(sd * 10, -10 - f * 6, sd * 18, -2 - f * 8);
    g.lineTo(sd * 12, 2); g.lineTo(sd * 8, 0); g.lineTo(sd * 5, 4); g.closePath(); g.fill();
  }
  g.fillStyle = C(fl, '#3a2030'); g.beginPath(); g.ellipse(0, 1, 5, 6, 0, 0, TAU); g.fill();
  if (!fl) glowEyes(g, [[-1.8, -1], [1.8, -1]], '#ff3a3a', 1);
}

/* ---------------- Bohater i wieżyczki ---------------- */
function drawHero(g, x, y, ang, draw, t) {
  g.save(); g.translate(x, y);
  // płaszcz
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(0, 8, 13, 5, 0, 0, TAU); g.fill();
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

function drawTurret(g, tu, x, y, t) {
  g.save(); g.translate(x, y);
  switch (tu.type) {
    case 'balista': {
      g.rotate(tu.ang);
      g.fillStyle = '#5a3a20'; g.fillRect(-8, -5, 22, 10);
      const k = Math.max(0, tu.fire) * 6;
      g.strokeStyle = '#3a2614'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(6, -16 + k * 0.3); g.quadraticCurveTo(12, 0, 6, 16 - k * 0.3); g.stroke();
      g.strokeStyle = '#ddd'; g.lineWidth = 1; g.beginPath(); g.moveTo(6, -16); g.lineTo(-4 + k, 0); g.lineTo(6, 16); g.stroke();
      if (tu.cd > 0.25) { g.fillStyle = '#9aa0a8'; g.fillRect(-4 + k, -1.5, 24, 3); }
      break;
    }
    case 'miotacz': {
      g.rotate(tu.ang);
      g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill();
      g.fillStyle = '#4a4a55'; g.fillRect(0, -5, 20, 10);
      g.fillStyle = '#7a3a10'; g.fillRect(16, -6, 6, 12);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(255,140,40,${0.4 + Math.sin(t * 20) * 0.2})`; g.beginPath(); g.arc(22, 0, 5, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'pily': {
      g.rotate(t * 6);
      g.fillStyle = '#5a5a62';
      for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.fillRect(6, -2.5, 7, 5); }
      g.fillStyle = '#8a8a95'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
      g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
      break;
    }
    case 'kociol': {
      g.fillStyle = '#16141a'; g.beginPath(); g.ellipse(0, 2, 13, 10, 0, 0, TAU); g.fill();
      g.fillStyle = '#2c2830'; g.beginPath(); g.ellipse(0, -1, 12, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#0a0806'; g.beginPath(); g.ellipse(0, -1, 9, 5, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,90,20,.35)'; g.beginPath(); g.ellipse(0, 10, 11, 3, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      break;
    }
  }
  g.restore();
  // poziom
  g.fillStyle = '#ffb347';
  for (let i = 0; i < Math.min(tu.lvl, 6); i++) { g.beginPath(); g.arc(x - (Math.min(tu.lvl, 6) - 1) * 3 + i * 6, y + 16, 1.8, 0, TAU); g.fill(); }
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
