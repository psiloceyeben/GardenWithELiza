import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MovementBudget } from '../movement-budget';
import { Game } from '../game';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('packet floods cannot multiply the movement tolerance', () => {
  const b = new MovementBudget(1000); let moved = 0;
  for (let i = 0; i < 1000; i++) if (b.take(1, 90, 1000)) moved++;
  assert.equal(moved, 6);
  for (let i = 1; i <= 1000; i++) if (b.take(1, 90, 1000 + i)) moved++;
  assert.equal(moved, 96);
});
test('rounded normal-speed movement remains accepted through packet jitter', () => {
  const b = new MovementBudget(0); let at = 0, position = 0;
  for (let i = 0; i < 1000; i++) {
    at += [60, 140, 100, 80, 120][i % 5];
    const next = Math.round(at * 90 / 1000);
    assert(b.take(next - position, 90, at)); position = next;
  }
});
test('idle credit is capped and invalid/backwards time cannot mint credit', () => {
  const b = new MovementBudget(1000);
  assert(!b.take(1000, 90, 100000)); assert(b.take(51, 90, 100000));
  assert(!b.take(1, 90, 99000)); assert(!b.take(1, 90, 100000));
  assert(!b.take(NaN, 90, 100100)); assert(!b.take(-1, 90, 100100));
  assert(b.take(9, 90, 100100));
});
test('long rounded oblique paths do not exhaust the jitter allowance', () => {
  for (const angle of [0.1, 0.3, 0.7, 1.2]) {
    const b = new MovementBudget(0); let at = 0, x = 0, y = 0;
    for (let i = 0; i < 10000; i++) {
      at += [60, 140, 100, 80, 120][i % 5];
      const nx = Math.round(at * 0.09 * Math.cos(angle)), ny = Math.round(at * 0.09 * Math.sin(angle));
      assert(b.take(Math.hypot(nx - x, ny - y), 90, at)); x = nx; y = ny;
    }
  }
});
test('slower defense/carry speed limits replenishment and banked credit', () => {
  const b = new MovementBudget(0);
  assert(!b.take(1000, 90, 500)); assert(!b.take(51, 45, 500));
  assert(b.take(28.5, 45, 500)); assert(b.take(4.5, 45, 600));
  assert(!b.take(1, 45, 600));
});
test('live game enforces a shared movement budget across rapid valid intents', async () => {
  const game = new Game(mkdtempSync(join(tmpdir(), 'pons-movement-'))); await game.initialize();
  try {
    const messages: any[] = [];
    const l = game.join({ OPEN: 1, readyState: 1, send(raw: string) { messages.push(JSON.parse(raw)); }, close() {} } as any,
      { t: 'hello', id: 'movement123', secret: 'movementsecret', name: 'Walker' })!;
    const rec = game.players.get(l.id)!, now = l.lastInputAt; let traveled = 0;
    for (let i = 0; i < 60; i++) {
      const x = l.x, y = l.y;
      game.onInput(l, rec, { t: 'input', dx: 1, dy: 0, x: x + (i % 2 ? -1 : 1), y, d: 'side', f: false, m: true }, now);
      traveled += Math.hypot(l.x - x, l.y - y);
    }
    assert(traveled > 0); assert(traveled <= 6);
    await game.commit();
    const corrections = messages.filter(m => m.t === 'correction');
    assert(corrections.length > 0);
    assert.equal(corrections.at(-1).x, l.x); assert.equal(corrections.at(-1).y, l.y);
    messages.length = 0;
    const x = l.x;
    game.onInput(l, rec, { t: 'input', dx: 1, dy: 0, x: x + 9, y: l.y, d: 'side', f: false, m: true }, now + 100);
    assert.equal(l.x, x + 9);
    await game.commit(); assert(!messages.some(m => m.t === 'correction'), 'Valid movement needs no correction');
  } finally { await game.store.close(); }
});
