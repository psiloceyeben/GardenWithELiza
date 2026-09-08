import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Joystick } from '../client/src/game/joystick';
test('dead zone prevents drift; diagonal movement is normalized and knob is clamped', () => {
  const stick = new Joystick(); stick.start(1, 100, 100); stick.move(1, 103, 102);
  assert.deepEqual(stick.value, { x: 0, y: 0 }); stick.move(1, 200, 200);
  assert(Math.abs(Math.hypot(stick.value.x, stick.value.y) - 1) < 1e-12);
  assert(Math.abs(Math.hypot(stick.knob.x, stick.knob.y) - 34) < 1e-12);
});
test('second finger cannot steal, move or release movement control', () => {
  const stick = new Joystick(); assert(stick.start(1, 0, 0)); stick.move(1, 34, 0);
  assert(!stick.start(2, 200, 200)); stick.move(2, 0, 34); stick.end(2);
  assert.equal(stick.pointer, 1); assert.deepEqual(stick.value, { x: 1, y: 0 });
});
test('release and lifecycle reset stop movement and permit a new touch', () => {
  const stick = new Joystick(); stick.start(1, 0, 0); stick.move(1, 34, 0); stick.end(1);
  assert.deepEqual(stick.value, { x: 0, y: 0 }); assert.equal(stick.pointer, null);
  stick.start(2, 0, 0); stick.move(2, 0, 34); stick.reset(); stick.move(2, 10, 10);
  assert.deepEqual(stick.knob, { x: 0, y: 0 }); assert(stick.start(3, 0, 0));
});
