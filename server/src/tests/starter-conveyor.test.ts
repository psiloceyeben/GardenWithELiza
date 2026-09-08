import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rollConveyor, rollStarterConveyor, STARTING_SAP, CONVEYOR_SLOTS } from '../../../shared/economy';
import rosterJson from '../../../content/roster.json';
import type { Species } from '../../../shared/types';
const roster = rosterJson.species as Species[];
test('even an all-mythic random roll leaves the first garden an affordable starter', () => {
  const slots = rollStarterConveyor(() => .9999, roster, 10);
  assert.equal(slots.length, CONVEYOR_SLOTS);
  assert.equal(slots[0].tier, 'common'); assert(slots[0].price <= STARTING_SAP);
  assert(!roster.find(s => s.id === slots[0].speciesId)!.hybrid);
  assert(slots.slice(1).every(s => s.tier === 'mythic'));
});
test('ordinary conveyor generation retains the normal rolls without a starter override', () => {
  assert(rollConveyor(() => .9999, roster, 'common', 10).every(s => s.tier === 'mythic'));
});
