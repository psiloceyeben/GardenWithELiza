import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignupBudget } from '../signup-budget';
test('default burst accommodates 200 new players then replenishes by time only', () => {
  const b = new SignupBudget(200, 30000, 0);
  for (let i = 0; i < 200; i++) assert(b.take(0));
  for (let i = 0; i < 1000; i++) assert(!b.take(0));
  assert(!b.take(29999)); assert(b.take(30000)); assert(!b.take(30000));
});
test('idle credit is capped and backwards/invalid time does not add capacity', () => {
  const b = new SignupBudget(2, 1000, 0);
  assert(b.take(100000)); assert(b.take(100000)); assert(!b.take(100000));
  assert(!b.take(NaN)); assert(!b.take(99999)); assert(!b.take(100000));
  assert(b.take(101000));
});
test('invalid deployment configuration fails closed', () => {
  for (const value of [0, -1, 0.5, NaN, Infinity, 10001]) assert.throws(() => new SignupBudget(value));
  for (const value of [0, -1, NaN, Infinity, 3600001]) assert.throws(() => new SignupBudget(200, value));
});
