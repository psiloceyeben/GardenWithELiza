import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Net, discardRejectedIdentity, type NetRuntime } from '../client/src/net';
class Socket {
  readyState = 0; sent: string[] = [];
  onopen?: () => void; onclose?: (event?: {code:number}) => void; onmessage?: (event: { data: string }) => void; onerror?: () => void;
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; }
  drop() { this.close(); this.onclose?.(); }
  send(message: string) { this.sent.push(message); }
}
function setup() {
  const sockets: Socket[] = []; const timers = new Map<number, { callback: () => void; delay: number }>(); let id = 0;
  const runtime: NetRuntime = {
    socket: () => { const socket = new Socket(); sockets.push(socket); return socket as unknown as WebSocket; },
    schedule: (callback, delay) => { timers.set(++id, { callback, delay }); return id as unknown as ReturnType<typeof setTimeout>; },
    cancel: timer => { timers.delete(timer as unknown as number); },
  };
  const net = new Net('ws://test', runtime);
  const runTimer = () => { assert.equal(timers.size, 1); const [key, value] = [...timers][0]; timers.delete(key); value.callback(); };
  return { net, sockets, timers, runTimer };
}

test('rejected sign-in stops retries without silently changing saved credentials',()=>{
  const {net,sockets,timers}=setup();const reasons:unknown[]=[];net.onClose=reason=>reasons.push(reason);
  net.connect();sockets[0].open();sockets[0].onclose?.({code:4003});
  assert(!net.connected);assert.equal(timers.size,0);assert.deepEqual(reasons,['identity-rejected']);
});

test('explicit stale-identity recovery removes only the rejected login and preserves newer cross-tab credentials',()=>{
  const identity={id:'old-id',secret:'old-secret',name:'Garden'};let value:string|null=JSON.stringify(identity),removals=0;
  const storage={getItem:()=>value,removeItem:()=>{removals++;value=null;}};
  assert(discardRejectedIdentity(identity,storage));assert.equal(removals,1);assert.equal(value,null);
  value=JSON.stringify({...identity,secret:'new-secret'});
  assert(discardRejectedIdentity(identity,storage));assert.equal(removals,1);assert(value.includes('new-secret'));
  assert(!discardRejectedIdentity(identity,{getItem:()=>{throw Error('storage blocked');},removeItem:()=>{throw Error('unexpected');}}));
});
test('duplicate connects never create competing sockets', () => {
  const { net, sockets } = setup(); net.connect(); net.connect(); assert.equal(sockets.length, 1);
  sockets[0].open(); net.connect(); assert.equal(sockets.length, 1); assert(net.connected);
});

test('superseded sessions stop reconnecting for structured, legacy and close-code signals; explicit reopen works',()=>{
  for(const signal of ['structured','legacy','close']){
    const {net,sockets,timers}=setup();const reasons:unknown[]=[];net.onClose=reason=>reasons.push(reason);
    net.connect();sockets[0].open();
    if(signal==='close')sockets[0].onclose?.({code:4001});
    else sockets[0].onmessage?.({data:JSON.stringify({t:'error',text:signal==='legacy'?'signed in elsewhere':'translated message',...(signal==='structured'?{code:'session-replaced'}:{})})});
    assert.equal(net.connected,false);assert.equal(timers.size,0);assert.deepEqual(reasons,['session-replaced']);
    sockets[0].onclose?.();assert.equal(timers.size,0);assert.equal(reasons.length,1);
    net.connect();sockets[1].open();assert(net.connected);
    sockets[0].onclose?.({code:4001});assert(net.connected);
  }
});
test('intentional close clears queued reconnect and cannot be resurrected by a stale callback', () => {
  const { net, sockets, timers } = setup(); net.connect(); sockets[0].open(); sockets[0].drop();
  const callback = [...timers.values()][0].callback; net.close(); assert.equal(timers.size, 0);
  callback(); assert.equal(sockets.length, 1); assert(!net.connected);
});
test('old socket messages/open/close events cannot alter replacement state', () => {
  const { net, sockets, timers, runTimer } = setup(); let messages = 0, closes = 0;
  net.onMsg = () => messages++; net.onClose = () => closes++;
  net.connect(); const old = sockets[0]; old.open(); old.drop(); runTimer(); sockets[1].open();
  old.onopen?.(); old.onmessage?.({ data: '{"t":"identity"}' }); old.onclose?.();
  assert(net.connected); assert.equal(messages, 0); assert.equal(closes, 1); assert.equal(timers.size, 0);
  sockets[1].onmessage?.({ data: '{"t":"toast","text":"ok"}' }); assert.equal(messages, 1);
});
test('onClose can stop reconnect or immediately establish its own replacement', () => {
  const stopped = setup(); stopped.net.onClose = () => stopped.net.close(); stopped.net.connect(); stopped.sockets[0].drop();
  assert.equal(stopped.timers.size, 0);
  const replaced = setup(); replaced.net.onClose = () => replaced.net.connect(); replaced.net.connect(); replaced.sockets[0].drop();
  assert.equal(replaced.sockets.length, 2); assert.equal(replaced.timers.size, 0);
});
test('backoff increases on failed connects and resets after successful open', () => {
  const { net, sockets, timers, runTimer } = setup(); net.connect(); sockets[0].drop();
  assert.equal([...timers.values()][0].delay, 1000); runTimer(); sockets[1].drop();
  assert.equal([...timers.values()][0].delay, 1700); runTimer(); sockets[2].open(); sockets[2].drop();
  assert.equal([...timers.values()][0].delay, 1000);
});
test('close immediately stops sends and only notifies once; explicit reopen works', () => {
  const { net, sockets } = setup(); let closes = 0; net.onClose = () => closes++;
  net.connect(); net.send({ t: 'unlink' }); assert.equal(sockets[0].sent.length, 0);
  sockets[0].open(); net.send({ t: 'unlink' }); assert.equal(sockets[0].sent.length, 1);
  net.close(); net.send({ t: 'unlink' }); sockets[0].onclose?.(); net.close();
  assert.equal(closes, 1); assert.equal(sockets[0].sent.length, 1); assert(!net.connected);
  net.connect(); sockets[1].open(); assert(net.connected);
});
