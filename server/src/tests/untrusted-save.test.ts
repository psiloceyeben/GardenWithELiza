import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Game } from '../game';
import { STARTING_SAP } from '../../../shared/economy';
test('forged browser save cannot grant currency, inventory, plants or progression', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pons-untrusted-save-'));
  const game = new Game(directory); await game.initialize();
  try {
    const forged = { sap: 50000, seeds: [{ uid: 'fake', speciesId: 'invalid', tier: 'mythic' }],
      plots: [{ plant: { uid: 'fakeplant', speciesId: 'invalid', size: 1e100 } }], speedLevel: 999,
      stats: { seedsBought: 100000, reveals: 100000 } };
    const rec = game.newPlayer('forgedtest01', 'testsecret', 'Tester', forged as any, Date.now());
    assert.equal(rec.sap, STARTING_SAP); assert.deepEqual(rec.seeds, []); assert(rec.plots.every(p => p === null));
    assert.equal(rec.speedLevel, 0); assert.equal(rec.stats.reveals, 0); assert.equal(rec.stats.seedsBought, 0);
    await game.commit();
  } finally { await game.store.close(); }
  const restart = new Game(directory); await restart.initialize();
  try { assert.equal(restart.players.get('forgedtest01')!.sap, STARTING_SAP); }
  finally { await restart.store.close(); }
});
test('malformed legacy fields cannot crash creation or poison numeric state', async () => {
  const game = new Game(mkdtempSync(join(tmpdir(), 'pons-malformed-save-'))); await game.initialize();
  try {
    for (const [index, save] of [{ sap: NaN, seeds: {} }, { sap: Infinity, plots: 'bad' }, { sap: -10, speedLevel: -Infinity }].entries()) {
      const rec = game.newPlayer(`malformed${index}`, 'testsecret', 'Tester', save as any, Date.now());
      assert.equal(rec.sap, STARTING_SAP); assert.equal(rec.speedLevel, 0); assert(rec.plots.every(p => p === null));
    }
  } finally { await game.store.close(); }
});
