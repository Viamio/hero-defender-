'use strict';
/* Proste dźwięki syntezowane w przeglądarce – bez plików audio. */
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null;
  let on = true;
  const last = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function ok(name, gap) {
    if (!on || !ac) return false;
    const t = performance.now();
    if (last[name] && t - last[name] < gap) return false;
    last[name] = t; return true;
  }
  function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, ftype, freq, q = 1, delay = 0) {
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }

  return {
    init,
    get on() { return on; },
    set on(v) { on = v; },
    shoot() { if (ok('shoot', 55)) { noise(0.06, 0.12, 'highpass', 2500, 0.7); tone(900, 0.05, 'triangle', 0.04, 0.5); } },
    hit() { if (ok('hit', 45)) tone(260 + Math.random() * 80, 0.05, 'square', 0.025, 0.6); },
    kill() { if (ok('kill', 60)) noise(0.12, 0.12, 'lowpass', 900, 0.8); },
    crit() { if (ok('crit', 90)) tone(1300, 0.08, 'triangle', 0.06, 0.6); },
    tower() { if (ok('tower', 120)) { tone(90, 0.25, 'sine', 0.35, 0.5); noise(0.15, 0.15, 'lowpass', 400); } },
    boom() { if (ok('boom', 70)) { noise(0.35, 0.3, 'lowpass', 600, 0.7); tone(70, 0.3, 'sine', 0.3, 0.4); } },
    zap() { if (ok('zap', 80)) { noise(0.12, 0.12, 'bandpass', 3200, 2); tone(1800, 0.08, 'sawtooth', 0.03, 0.3); } },
    flame() { if (ok('flame', 160)) noise(0.18, 0.05, 'bandpass', 900, 0.6); },
    level() { if (!ok('level', 300)) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, 1, i * 0.07)); },
    pick(r) { if (!ok('pick', 100)) return; tone(660, 0.15, 'triangle', 0.12); tone(990, 0.25, 'triangle', 0.1, 1, 0.08);
      if (r >= 3) [1318, 1568, 2093].forEach((f, i) => tone(f, 0.4, 'sine', 0.08, 1, 0.15 + i * 0.08)); },
    legend() { if (!ok('legend', 400)) return; [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.6, 'sine', 0.09, 1, i * 0.09)); },
    boss() {
      if (!ok('boss', 1000)) return;
      for (let i = 0; i < 3; i++) { tone(55, 0.6, 'sine', 0.5, 0.6, i * 0.45); noise(0.3, 0.2, 'lowpass', 200, 1, i * 0.45); }
      tone(220, 2.2, 'sine', 0.12, 0.98, 0.1); tone(330, 2.0, 'sine', 0.06, 0.98, 0.1);
    },
    wave() { if (ok('wave', 500)) { tone(196, 0.5, 'sine', 0.12, 1); tone(294, 0.6, 'sine', 0.08, 1, 0.12); } },
    rain() { if (ok('rain', 300)) for (let i = 0; i < 6; i++) noise(0.08, 0.08, 'highpass', 3000, 0.7, i * 0.08); },
    die() { if (!ok('die', 1000)) return; tone(110, 1.6, 'sawtooth', 0.15, 0.3); noise(1.2, 0.3, 'lowpass', 500); },
  };
})();
