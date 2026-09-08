// Box C only: validate current production saves on a retained isolated copy.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { Game } = require('../server/dist/server/src/game.js');
(async () => {
  const source = '/var/lib/pons';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pons-live-migration-'));
  fs.cpSync(source, directory, { recursive: true });
  const original = JSON.parse(fs.readFileSync(path.join(directory, 'players.json'), 'utf8'));
  const game = new Game(directory); await game.initialize();
  try {
    assert.equal(game.players.size, Object.keys(original).length);
    for (const [id, rec] of Object.entries(original)) {
      const loaded = game.players.get(id); assert(loaded);
      assert.equal(loaded.sap, rec.sap); assert.equal(loaded.secret, rec.secret);
      assert.equal(loaded.plots.length, rec.plots.length);
    }
    await game.commit(); console.log(JSON.stringify({ directory, players: game.players.size, storage: game.store.kind, result: 'migration preserves balances, identities and plot counts' }));
  } finally { await game.store.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
