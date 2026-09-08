import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SocketLifecycle } from '../socket-lifecycle';
function setup() {
  const socket = { readyState: 1, bufferedAmount: 0, pings: 0, terminated: 0,
    ping() { this.pings++; }, terminate() { this.terminated++; this.readyState = 3; } };
  return { socket, lifecycle: new SocketLifecycle(socket, 0) };
}
test('unauthenticated sockets expire even if they send pong frames', () => {
  const { socket, lifecycle } = setup(); lifecycle.pong(); lifecycle.check(14999);
  assert.equal(socket.terminated, 0); lifecycle.check(15000); assert.equal(socket.terminated, 1);
});
test('authenticated responsive sockets survive repeated heartbeat intervals', () => {
  const { socket, lifecycle } = setup(); lifecycle.authenticate();
  for (let now = 30000; now <= 300000; now += 30000) { lifecycle.check(now); lifecycle.pong(); }
  assert.equal(socket.pings, 10); assert.equal(socket.terminated, 0);
});
test('missing pong terminates a half-open session on the next interval', () => {
  const { socket, lifecycle } = setup(); lifecycle.authenticate();
  lifecycle.check(30000); assert.equal(socket.pings, 1);
  lifecycle.check(59999); assert.equal(socket.terminated, 0);
  lifecycle.check(60000); assert.equal(socket.terminated, 1);
});
test('slow receivers cannot keep an unbounded pending send buffer', () => {
  const { socket, lifecycle } = setup(); lifecycle.authenticate();
  socket.bufferedAmount = 1024 * 1024 + 1; lifecycle.check(100);
  assert.equal(socket.terminated, 1);
});
test('closed sockets are ignored and ping errors are isolated', () => {
  const { socket, lifecycle } = setup(); lifecycle.authenticate();
  socket.ping = () => { throw new Error('closed during ping'); };
  lifecycle.check(30000); assert.equal(socket.terminated, 1);
  lifecycle.check(60000); assert.equal(socket.terminated, 1);
});
