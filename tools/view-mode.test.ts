import assert from 'node:assert/strict';
import { viewMode } from '../client/src/view-mode';
for (const search of ['', '?ws=ws://localhost:8132', '?view=perspective&characters=wander', '?view=unknown&characters=unknown']) {
  assert.deepEqual(viewMode(search), { legacy: false, perspective: true, wander: true });
}
assert.deepEqual(viewMode('?view=orthographic'), { legacy: false, perspective: false, wander: false });
assert.deepEqual(viewMode('?characters=sprites'), { legacy: false, perspective: true, wander: false });
assert.deepEqual(viewMode('?r=2d&view=perspective&characters=wander'), { legacy: true, perspective: false, wander: false });
console.log('PASS default Wander perspective and explicit orthographic/sprite/legacy overrides');
