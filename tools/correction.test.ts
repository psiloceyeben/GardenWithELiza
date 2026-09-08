import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldState } from '../client/src/game/WorldState';

test('HD-2D applies even small server corrections and cancels stale path actions', () => {
  // Test the actual message handler without constructing browser HUD elements.
  const state = Object.create(WorldState.prototype) as WorldState;
  Object.assign(state, { player: { x: 100, y: 100 }, path: [{ x: 120, y: 100 }], pathAct: () => assert.fail('stale action'), moving: true });
  state.onMsg({ t: 'correction', x: 99, y: 102 });
  assert.deepEqual(state.player, { x: 99, y: 102 });
  assert.deepEqual(state.path, []); assert.equal(state.pathAct, null);
  assert.equal(state.moving, false); assert.equal((state as any).inputDirty, true);
  state.onMsg({ t: 'correction', x: 99, y: 102 });
  assert.deepEqual(state.player, { x: 99, y: 102 });
});
