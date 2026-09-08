// Isolated browser QA only: retain the real server, shorten only login shielding.
const path = require('node:path');
if (process.env.PONS_HOST !== '127.0.0.1' || process.env.PONS_PORT !== '0'
  || !path.basename(process.env.PONS_DATA || '').startsWith('pons-wardrobe-browser-')) {
  throw new Error('Raid fixture requires an isolated ephemeral loopback server');
}
const { Game } = require('../server/dist/server/src/game.js');
const join = Game.prototype.join;
Game.prototype.join = function (...args) {
  const live = join.apply(this, args);
  if (live) { live.shieldUntil = 0; this.pushLot(this.players.get(live.id)); }
  return live;
};
require('../server/dist/server/src/index.js');
