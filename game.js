// Okiya — aturan permainan (dijalankan di server, jadi tidak bisa dicurangi dari browser)
'use strict';
const crypto = require('crypto');

const veg = t => t & 3;   // ubin t = 0..15 -> file assets/tNN.webp (NN = t+1)
const sym = t => t >> 2;
const CENTER = [5, 6, 9, 10];

const LINES = [];
for (let r = 0; r < 4; r++) LINES.push([0, 1, 2, 3].map(c => r * 4 + c));
for (let c = 0; c < 4; c++) LINES.push([0, 1, 2, 3].map(r => r * 4 + c));
LINES.push([0, 5, 10, 15], [3, 6, 9, 12]);
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const i = r * 4 + c; LINES.push([i, i + 1, i + 4, i + 5]); }
const BYCELL = Array.from({ length: 16 }, (_, i) => LINES.filter(l => l.includes(i)));
const isSquare = l => l[1] - l[0] === 1 && l[2] - l[0] === 4;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// sel bernilai 0..15 = ubin, 16 = karakter Merah (pemain 0), 17 = karakter Hitam (pemain 1)
function legal(cells, last) {
  const r = [];
  for (let i = 0; i < 16; i++) {
    const t = cells[i];
    if (t > 15) continue;
    if (last < 0) { if (!CENTER.includes(i)) r.push(i); }
    else if (veg(t) === veg(last) || sym(t) === sym(last)) r.push(i);
  }
  return r;
}

function winAt(cells, p, m) {
  const v = 16 + p;
  for (const l of BYCELL[m]) if (cells[l[0]] === v && cells[l[1]] === v && cells[l[2]] === v && cells[l[3]] === v) return l;
  return null;
}

function newGame(starter) {
  return {
    cells: shuffle([...Array(16).keys()]),
    img: Array(16).fill(0),
    pile: [], last: -1, turn: starter, used: [0, 0],
    order: [shuffle([1, 2, 3, 4, 5, 6, 7, 8]), shuffle([1, 2, 3, 4, 5, 6, 7, 8])],
    over: false, winner: -1, line: null, reason: '', pts: 0, lastCell: -1, starter,
  };
}

// Menjalankan langkah pemain g.turn di sel i. Mengembalikan false bila tidak sah.
function play(g, i) {
  if (g.over || !Number.isInteger(i) || i < 0 || i > 15) return false;
  if (!legal(g.cells, g.last).includes(i)) return false;
  const p = g.turn, t = g.cells[i];
  g.pile.push(t); g.last = t; g.cells[i] = 16 + p; g.img[i] = g.order[p][g.used[p]++]; g.lastCell = i;
  const line = winAt(g.cells, p, i);
  if (line) end(g, p, isSquare(line) ? 'square' : 'line', line);
  else if (!g.cells.some(c => c < 16)) end(g, -1, 'tie', null);   // ubin terakhir diambil tanpa pemenang -> seri
  else if (!legal(g.cells, g.last).length) end(g, p, 'block', null);
  else g.turn = 1 - p;
  return true;
}

function end(g, w, reason, line) {
  g.over = true; g.winner = w; g.reason = reason; g.line = line;
  g.pts = g.cells.filter(c => c < 16).length;   // ubin yang masih tersisa di taman
}

module.exports = { legal, play, newGame };
