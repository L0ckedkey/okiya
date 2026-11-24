// Thread terpisah untuk bot, supaya server tetap lancar saat bot sedang berpikir.
'use strict';
const { parentPort } = require('worker_threads');
const { choose } = require('./bot');

parentPort.on('message', ({ id, cells, last, p, level }) => {
  let move = -1;
  try { move = choose(cells, last, p, level); } catch (e) { console.error('[bot]', e); }
  parentPort.postMessage({ id, move });
});
