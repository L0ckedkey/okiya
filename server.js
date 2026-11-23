// Okiya Online — server sederhana: menyajikan halaman game + WebSocket untuk room (Game ID).
// Jalankan:  npm install  lalu  npm start   (default port 3000, ubah dengan env PORT)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const Game = require('./game');

const PORT = Number(process.env.PORT) || 3000;
const PUB = path.join(__dirname, 'public');
const MAX_ROOMS = 2000;
const IDLE_MS = 2 * 60 * 60 * 1000;   // room tanpa koneksi dihapus setelah 2 jam

/* ---------------- HTTP: file statis ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === '/' || p.startsWith('/g/')) p = '/index.html';
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok ' + rooms.size + ' rooms'); }
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Tidak ditemukan'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
});

/* ---------------- Room ---------------- */
const rooms = new Map();
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // tanpa I, L, O, 0, 1 supaya tidak tertukar
const newId = () => { let id; do { id = Array.from({ length: 5 }, () => ALPH[crypto.randomInt(ALPH.length)]).join(''); } while (rooms.has(id)); return id; };
const newToken = () => crypto.randomBytes(16).toString('hex');
const cleanName = (s, fallback) => (String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20)) || fallback;
const goal = r => r.mode === 'single' ? 1 : r.mode === 'sets' ? 3 : r.target;

function startGame(r, first) {
  r.game = Game.newGame(r.match.nextStarter);
  r.note = { kind: first ? 'draw' : r.match.lastTie ? 'tie' : 'loser', p: r.match.nextStarter };
}

function stateOf(r) {
  const g = r.game, m = r.match, waiting = !r.seats[1];
  return {
    t: 'state', id: r.id, mode: r.mode, target: r.target, waiting,
    players: r.seats.map(s => s ? { name: s.name, online: s.socks.size > 0 } : null),
    spectators: r.spect.size,
    score: m.score, games: m.games, matchOver: m.over, nextStarter: m.nextStarter,
    note: r.note,
    g: {
      cells: g.cells, img: g.img, pile: g.pile, last: g.last, turn: g.turn, used: g.used, order: g.order,
      over: g.over, winner: g.winner, line: g.line, reason: g.reason, pts: g.pts, lastCell: g.lastCell,
    },
    legal: (!g.over && !waiting) ? Game.legal(g.cells, g.last) : [],
  };
}
function broadcast(r) {
  r.touched = Date.now();
  const msg = JSON.stringify(stateOf(r));
  for (const s of r.seats) if (s) for (const ws of s.socks) send(ws, msg);
  for (const ws of r.spect) send(ws, msg);
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
function err(ws, msg, fatal = false) { send(ws, { t: 'error', msg, fatal }); }

function attach(ws, r, seat, token) {
  ws.room = r; ws.seat = seat;
  if (seat >= 0) r.seats[seat].socks.add(ws); else r.spect.add(ws);
  send(ws, { t: 'joined', id: r.id, seat, token: token || null });
  broadcast(r);
}
function leave(ws) {
  const r = ws.room; if (!r) return;
  if (ws.seat >= 0 && r.seats[ws.seat]) r.seats[ws.seat].socks.delete(ws); else r.spect.delete(ws);
  ws.room = null; ws.seat = -1;
  broadcast(r);
}

/* ---------------- WebSocket ---------------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });

wss.on('connection', ws => {
  ws.alive = true; ws.room = null; ws.seat = -1;
  ws.bucket = 20; ws.lastRefill = Date.now();
  ws.on('pong', () => { ws.alive = true; });
  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
  ws.on('message', raw => {
    // batas sederhana: ±10 pesan/detik per koneksi
    const now = Date.now();
    ws.bucket = Math.min(20, ws.bucket + (now - ws.lastRefill) / 100); ws.lastRefill = now;
    if (ws.bucket < 1) return; ws.bucket--;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    try { handle(ws, m); } catch (e) { console.error(e); }
  });
});

function handle(ws, m) {
  switch (m.t) {
    case 'create': {
      if (rooms.size >= MAX_ROOMS) return err(ws, 'Server sedang penuh, coba lagi nanti.');
      leave(ws);
      const mode = ['single', 'sets', 'points'].includes(m.mode) ? m.mode : 'single';
      const target = [10, 15, 20].includes(Number(m.target)) ? Number(m.target) : 10;
      const token = newToken();
      const r = {
        id: newId(), mode, target, spect: new Set(), touched: Date.now(),
        seats: [{ token, name: cleanName(m.name, 'Pemain Merah'), socks: new Set() }, null],
        match: { score: [0, 0], games: 0, nextStarter: crypto.randomInt(2), over: false },
      };
      startGame(r, true);
      rooms.set(r.id, r);
      console.log(`[room ${r.id}] dibuat (${mode}${mode === 'points' ? ' ' + target : ''})`);
      return attach(ws, r, 0, token);
    }
    case 'join': {
      const id = String(m.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const r = rooms.get(id);
      if (!r) return err(ws, `Game ID "${id}" tidak ditemukan atau sudah kedaluwarsa.`, true);
      leave(ws);
      const tok = typeof m.token === 'string' ? m.token : '';
      const mine = tok ? r.seats.findIndex(s => s && s.token === tok) : -1;
      if (mine >= 0) {                                      // kembali ke kursi sendiri
        if (m.name) r.seats[mine].name = cleanName(m.name, r.seats[mine].name);
        return attach(ws, r, mine, tok);
      }
      if (!r.seats[1]) {                                    // jadi lawan
        const token = newToken();
        r.seats[1] = { token, name: cleanName(m.name, 'Pemain Hitam'), socks: new Set() };
        console.log(`[room ${r.id}] lawan bergabung`);
        return attach(ws, r, 1, token);
      }
      return attach(ws, r, -1, null);                       // penonton
    }
    case 'leave': return leave(ws);
    case 'move': {
      const r = ws.room; if (!r || ws.seat < 0) return;
      if (!r.seats[1]) return err(ws, 'Tunggu lawan bergabung dulu.');
      const g = r.game;
      if (g.over || g.turn !== ws.seat) return;
      if (!Game.play(g, Number(m.i))) return;
      r.note = null;
      if (g.over) {
        const mt = r.match;
        mt.games++;
        if (g.winner < 0) { mt.lastTie = true; mt.nextStarter = 1 - g.starter; }     // seri: gantian yang mulai
        else {
          mt.lastTie = false;
          mt.score[g.winner] += r.mode === 'points' ? g.pts : 1;
          mt.nextStarter = 1 - g.winner;
          mt.over = mt.score[g.winner] >= goal(r);
        }
      }
      return broadcast(r);
    }
    case 'next': {                 // ronde berikutnya (yang kalah jalan duluan)
      const r = ws.room; if (!r || ws.seat < 0) return;
      if (!r.game.over || r.match.over) return;
      startGame(r, false); return broadcast(r);
    }
    case 'rematch': {              // pertandingan baru di room yang sama
      const r = ws.room; if (!r || ws.seat < 0) return;
      if (!r.match.over) return;
      if (['single', 'sets', 'points'].includes(m.mode)) r.mode = m.mode;
      if ([10, 15, 20].includes(Number(m.target))) r.target = Number(m.target);
      r.match = { score: [0, 0], games: 0, nextStarter: crypto.randomInt(2), over: false };
      startGame(r, true); return broadcast(r);
    }
  }
}

/* ---------------- perawatan ---------------- */
setInterval(() => {                       // ping supaya koneksi tidak diputus Cloudflare saat diam
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 30000);
setInterval(() => {                       // hapus room yang sudah lama kosong
  const now = Date.now();
  for (const [id, r] of rooms) {
    const conns = r.spect.size + r.seats.reduce((n, s) => n + (s ? s.socks.size : 0), 0);
    if (!conns && now - r.touched > IDLE_MS) { rooms.delete(id); console.log(`[room ${id}] dihapus (kosong)`); }
  }
}, 5 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Okiya Online berjalan di http://localhost:${PORT}`);
  console.log(`Buka ke internet:  cloudflared tunnel --url http://localhost:${PORT}`);
});
