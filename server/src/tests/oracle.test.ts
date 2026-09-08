import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { parseReply, createOracleClient, routeQuestion, sessionFor, PLANTING_QUERY } from '../oracle';

test('Oracle HTTP conversations isolate connections and default one-shot calls', async () => {
  const headers: string[] = [];
  const server = createServer((req, res) => {
    req.resume(); headers.push(String(req.headers['x-oracle-session']));
    res.end(JSON.stringify({ response: 'A garden plot.' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const ask = createOracleClient(`http://127.0.0.1:${address.port}`, 1000);
  try {
    const first = {}, second = {};
    await ask('one', sessionFor(first)); await ask('two', sessionFor(first));
    await ask('three', sessionFor(second)); await ask('four'); await ask('five');
    assert.equal(headers[0], headers[1]);
    assert.equal(new Set([headers[0], ...headers.slice(2)]).size, 4);
    for (const header of headers) assert.match(header, /^[a-f0-9]{36}$/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('Oracle parsing rejects malformed bodies and preserves honest withholding', () => {
  for (const response of [null, [], { response: {} }, { text: 3 }]) assert.equal(parseReply(response), null);
  assert.deepEqual(parseReply({ response: 'Uncertain.', status: 'withheld' }), { text: '', withheld: true });
  assert.deepEqual(parseReply({ response: 'Which plot?', status: 'clarification' }), { text: '', withheld: true });
  assert.deepEqual(parseReply({ response: ' Plant a seed. [1] ' }), { text: 'Plant a seed.', withheld: false });
  assert(parseReply({ response: 'a'.repeat(400) })!.text.length <= 280);
});
test('only narrow verified guide paraphrases are routed; unrelated and multi-topic questions stay unchanged', () => {
  assert.equal(routeQuestion('How do I protect plants from thieves?'), 'What are defenses?');
  assert.equal(routeQuestion('How do I plant a seed?'), PLANTING_QUERY);
  for (const question of ['How do I plant a seed and steal a plant?', 'How do I protect my plants and trade tokens?', 'Who is Warden Pell?']) assert.equal(routeQuestion(question), question);
});

test('planting admission coalesces per session, retries failure and never answers without complete admission', async () => {
  let mode = 'ok', admissions = 0, chats = 0;
  const server = createServer((req, res) => {
    req.resume();
    if (req.url === '/ingest') {
      admissions++;
      setTimeout(() => res.end(JSON.stringify({ status: mode === 'ok' ? 'admitted' : 'withheld', admitted_sentences: 3 })), 20);
    } else { chats++; res.end(JSON.stringify({ response: 'Open Bag and select a seed.' })); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const ask = createOracleClient(`http://127.0.0.1:${address.port}/chat`, 1000);
  try {
    const key = sessionFor({});
    const replies = await Promise.all([ask(PLANTING_QUERY, key), ask(PLANTING_QUERY, key)]);
    assert(replies.every(r => r && !r.withheld)); assert.equal(admissions, 1); assert.equal(chats, 2);
    await ask(PLANTING_QUERY, key); assert.equal(admissions, 1);
    const other = sessionFor({}); mode = 'fail';
    assert.equal(await ask(PLANTING_QUERY, other), null); assert.equal(chats, 3);
    mode = 'ok'; assert(await ask(PLANTING_QUERY, other)); assert.equal(admissions, 3);
    await ask('Who is Ada?', sessionFor({})); assert.equal(admissions, 3);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('NPC text removes repeated citation framing and ends on a complete sentence when possible', () => {
  const response = 'According to Warden Pell, Pell guards the gate and keeps the sprint track safe. The page for Warden Pell records: A closed gate takes three hits. ' + 'More lore follows here. '.repeat(20);
  const reply = parseReply({ response })!;
  assert(!reply.text.includes('According to')); assert(!reply.text.includes('records:')); assert(reply.text.endsWith('.'));
});

test('incomplete or stalled guide admission withholds the answer and releases capacity', async () => {
  let mode = 'partial', chats = 0;
  const server = createServer((req, res) => {
    req.resume();
    if (req.url === '/ingest') {
      if (mode === 'hang') return;
      res.end(JSON.stringify({ status: 'admitted', admitted_sentences: mode === 'partial' ? 2 : 3 }));
    } else { chats++; res.end(JSON.stringify({ response: 'Open Bag and select a seed.' })); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const ask = createOracleClient(`http://127.0.0.1:${address.port}/chat`, 150), key = sessionFor({});
  try {
    assert.equal(await ask(PLANTING_QUERY, key), null); assert.equal(chats, 0);
    mode = 'hang';
    const pending = [ask(PLANTING_QUERY, key), ask(PLANTING_QUERY, key), ask(PLANTING_QUERY, key)];
    assert.equal(await ask(PLANTING_QUERY, key), null);
    assert.deepEqual(await Promise.all(pending), [null, null, null]); assert.equal(chats, 0);
    mode = 'ok'; assert(await ask(PLANTING_QUERY, key)); assert.equal(chats, 1);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('Oracle copy filtering covers normalized Unicode and text beyond display truncation', () => {
  for (const response of ['dividends', 'divi\u200bdends', 'ｄｉｖｉｄｅｎｄｓ', 'a'.repeat(300) + ' stock tokens']) {
    assert.deepEqual(parseReply({ response }), { text: '', withheld: true });
  }
});
test('Oracle HTTP failures, timeout and saturation recover without leaking slots', async () => {
  let mode = 'hang';
  const server = createServer((req, res) => {
    req.resume();
    if (mode === 'hang') return;
    if (mode === 'http-error') { res.writeHead(503).end(); return; }
    if (mode === 'bad-json') { res.end('{'); return; }
    res.end(JSON.stringify({ response: 'Plant a seed.' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = server.address(); assert(endpoint && typeof endpoint !== 'string');
  const ask = createOracleClient(`http://127.0.0.1:${endpoint.port}`, 150);
  try {
    const busy = [ask('a'), ask('b'), ask('c')]; assert.equal(await ask('d'), null);
    assert.deepEqual(await Promise.all(busy), [null, null, null]);
    mode = 'http-error'; assert.equal(await ask('a'), null);
    mode = 'bad-json'; assert.equal(await ask('a'), null);
    mode = 'ok'; assert.deepEqual(await ask('a'), { text: 'Plant a seed.', withheld: false });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
