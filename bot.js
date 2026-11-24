// Okiya — otak bot (negamax + alpha-beta, iterative deepening dengan batas waktu)
'use strict';
const { legal, winAt, LINES } = require('./game');

const LEVELS = {
  easy:   { depth: 2,  ms: 300,  random: 0.4 },   // sering asal pilih, hanya melihat 2 langkah
  normal: { depth: 4,  ms: 500,  random: 0 },
  hard:   { depth: 16, ms: 1500, random: 0 },     // mendekati sempurna di akhir permainan
};
const W = [0, 1, 6, 30];        // nilai garis/kotak yang berisi 1, 2, 3 karakter sendiri
const TIMEOUT = {};

function evalPos(c, p) {
  const me = 16 + p, op = 17 - p; let s = 0;
  for (const l of LINES) {
    let a = 0, b = 0;
    for (const i of l) { const v = c[i]; if (v === me) a++; else if (v === op) b++; }
    if (a && !b) s += W[a]; else if (b && !a) s -= W[b];
  }
  return s;
}

function choose(cells, last, p, level = 'normal') {
  const cfg = LEVELS[level] || LEVELS.normal;
  const c = cells.slice(), moves = legal(c, last);
  if (!moves.length) return -1;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // langkah yang langsung menang selalu diambil
  for (const m of moves) { const t = c[m]; c[m] = 16 + p; const w = winAt(c, p, m); c[m] = t; if (w) return m; }
  if (Math.random() < cfg.random) return pick(moves);

  const deadline = Date.now() + cfg.ms; let nodes = 0;
  function negamax(last, p, d, al, be) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) throw TIMEOUT;
    if (!c.some(v => v < 16)) return 0;                 // ubin habis tanpa pemenang -> seri
    const ms = legal(c, last);
    if (!ms.length) return -(9000 + d);                 // tidak bisa jalan -> kalah
    if (d === 0) return evalPos(c, p) + ms.length * 0.4;
    let best = -1e9;
    for (const m of ms) {
      const t = c[m]; c[m] = 16 + p;
      const s = winAt(c, p, m) ? 10000 + d : -negamax(t, 1 - p, d - 1, -be, -al);
      c[m] = t;
      if (s > best) best = s; if (s > al) al = s; if (al >= be) break;
    }
    return best;
  }

  let order = moves.slice().sort(() => Math.random() - 0.5), best = order[0];
  for (let d = 1; d <= cfg.depth; d++) {
    const snapshot = c.slice();
    try {
      const scored = [];
      for (const m of order) { const t = c[m]; c[m] = 16 + p; const s = -negamax(t, 1 - p, d - 1, -1e9, 1e9); c[m] = t; scored.push([s, m]); }
      scored.sort((a, b) => b[0] - a[0]);
      best = pick(scored.filter(x => x[0] === scored[0][0]))[1];
      order = scored.map(x => x[1]);
      if (Math.abs(scored[0][0]) >= 8000) break;        // hasil sudah pasti
    } catch (e) {
      if (e !== TIMEOUT) throw e;
      snapshot.forEach((v, i) => { c[i] = v; });
      break;
    }
  }
  return best;
}

module.exports = { choose, LEVELS };
