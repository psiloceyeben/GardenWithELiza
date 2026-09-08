import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CheckpointStore } from '../../../chain-reader/src/checkpoint-store';
import { CachedReader, MockReader, readerFromEnv, RpcReader } from '../../../chain-reader/src';
import { orderedTransfers, reconstructHistory, topicAddress, TRANSFER_TOPIC, type TransferLog } from '../../../chain-reader/src/history';

const wallet = '0x' + '1'.repeat(40); const other = '0x' + '2'.repeat(40);
const token = '0x' + '3'.repeat(40); const ecosystem = '0x' + '4'.repeat(40);
const word = (n: number | bigint) => '0x' + BigInt(n).toString(16).padStart(64, '0');
const DAY = 86_400_000;
function log(block: number, index: number, amount: number | bigint, from = other, to = wallet): TransferLog {
  return { address: token, blockNumber: '0x' + block.toString(16), blockHash: word(block), transactionHash: word(block * 100 + index),
    logIndex: '0x' + index.toString(16), topics: [TRANSFER_TOPIC, topicAddress(from), topicAddress(to)], data: word(amount) };
}
const timestamps = new Map([[1, DAY], [2, DAY * 2], [3, DAY * 3], [4, DAY * 4]]);
function history(logs: TransferLog[], expected: bigint, end = DAY * 5, decimals = 0) {
  return reconstructHistory(orderedTransfers(logs, token, wallet, 1, 4), wallet, decimals, timestamps, end, expected);
}
test('self-transfers, duplicate query results and zero transfers never inflate balance or reset streak', () => {
  const self = log(2, 0, 60, wallet, wallet);
  const result = history([log(1, 0, 100), self, self, log(3, 0, 0, wallet, other)], 100n);
  assert.equal(result.stakeTime, 400); assert.equal(result.holdStreakDays, 4); assert.deepEqual(result.unstakeEvents, []);
});
test('same-block logs use logIndex, decreases use exact raw threshold, and timestamps are actual', () => {
  const result = history([log(2, 1, 20, wallet, other), log(1, 0, 100), log(2, 0, 10, wallet, other)], 70n);
  assert.equal(result.stakeTime, 310); assert.equal(result.holdStreakDays, 3);
  assert.deepEqual(result.unstakeEvents, [{ at: DAY * 2, fraction: 20 / 90 }]);
});
test('empty wallet and sell-out have zero streak; reacquisition starts a new streak', () => {
  assert.equal(history([], 0n).stakeTime, 0);
  const logs = [log(1, 0, 100), log(2, 0, 100, wallet, other)];
  assert.equal(history(logs, 0n).holdStreakDays, 0);
  const result = history([...logs, log(4, 0, 25)], 25n);
  assert.equal(result.holdStreakDays, 1); assert.equal(result.stakeTime, 125);
});
test('bigint reconstruction preserves sub-token raw precision', () => {
  const raw = 10n ** 24n + 1n;
  assert.equal(history([log(1, 0, raw), log(2, 0, raw - 1n, wallet, other)], 1n, DAY * 5, 18).ponsBalance, 1e-18);
});
test('missing, conflicting, removed, malformed and mixed-fork history is rejected', () => {
  assert.throws(() => history([log(1, 0, 1, wallet, other)], 0n), /Incomplete/);
  assert.throws(() => history([log(1, 0, 100)], 101n), /does not match/);
  assert.throws(() => history([log(1, 0, 100), log(1, 0, 99)], 100n), /Conflicting/);
  assert.throws(() => history([{ ...log(1, 0, 100), removed: true }], 100n), /Invalid/);
  assert.throws(() => history([{ ...log(1, 0, 100), data: '0x' }], 100n), /Invalid/);
  assert.throws(() => history([log(1, 0, 100), { ...log(1, 1, 1), blockHash: word(999) }], 101n), /fork/);
});
test('partial RPC config never silently enables mock; chain/deployment and allowlist are validated', () => {
  assert.throws(() => readerFromEnv({ PONS_RPC_URL: 'https://example.com' }), /Both/);
  assert.throws(() => readerFromEnv({ PONS_HISTORY_DIR: '/tmp/pons-history' }), /require RPC/);
  assert.throws(() => readerFromEnv({ PONS_RPC_URL: 'https://example.com', PONS_TOKEN: token }), /PONS_CHAIN_ID/);
  assert.throws(() => readerFromEnv({ PONS_RPC_URL: 'https://example.com', PONS_TOKEN: token, PONS_CHAIN_ID: '1', PONS_FROM_BLOCK: '0', PONS_ECOSYSTEM: 'BAD' }), /allowlist/);
});

test('every partial chain setting fails closed and blank numeric settings never become zero', () => {
  assert.equal(readerFromEnv({}).kind,'cached(mock)');
  assert.equal(readerFromEnv({PONS_PORT:'8132'}).kind,'cached(mock)');
  for(const key of ['PONS_RPC_URL','PONS_TOKEN','PONS_CHAIN_ID','PONS_FROM_BLOCK','PONS_DECIMALS','PONS_ECOSYSTEM']) {
    for(const value of ['', ' ', '1'])assert.throws(()=>readerFromEnv({[key]:value}),/Both/);
  }
  const valid={PONS_RPC_URL:'https://example.com/private-key',PONS_TOKEN:token,PONS_CHAIN_ID:'1',PONS_FROM_BLOCK:'0'};
  assert.equal(readerFromEnv(valid).kind,'cached(rpc-worker)');
  assert.equal(readerFromEnv({...valid,PONS_DECIMALS:'0'}).kind,'cached(rpc-worker)');
  assert.throws(()=>readerFromEnv({...valid,PONS_RPC_URL:'https://[invalid/private-secret'}),error=>
    error instanceof Error && error.message==='Invalid RPC URL' && !('input' in error) && !('cause' in error)
      && !error.stack?.includes('private-secret'));
  for(const key of ['PONS_CHAIN_ID','PONS_FROM_BLOCK','PONS_DECIMALS','PONS_CHAIN_SCAN_TIMEOUT_MS']) {
    for(const value of ['', ' \t'])assert.throws(()=>readerFromEnv({...valid,[key]:value}),error=>
      error instanceof Error && error.message==='Empty numeric chain setting: '+key);
  }
  assert.throws(()=>readerFromEnv({...valid,PONS_BROKER_NFT:ecosystem,PONS_BROKER_FROM_BLOCK:' '}),/Empty numeric chain setting: PONS_BROKER_FROM_BLOCK/);
});
test('cache coalesces, deep-isolates callers and evicts least recently used entries', async () => {
  let calls = 0; const mock = new MockReader();
  const cache = new CachedReader({ kind: 'test', async snapshot(a) { calls++; return mock.snapshot(a); } }, 60_000, 1);
  const [a, b] = await Promise.all([cache.snapshot(wallet), cache.snapshot(wallet)]);
  assert.equal(calls, 1); a.stockDecor.drops = 999; assert.notEqual(b.stockDecor.drops, 999);
  assert.notEqual((await cache.snapshot(wallet)).stockDecor.drops, 999);
  await cache.snapshot(other); await cache.snapshot(wallet); assert.equal(calls, 3);
});

test('cache limits active scans, bounds queued wallets and coalesces queued duplicates',async()=>{
  const mock=new MockReader(),ready:(()=>void)[]=[];let active=0,peak=0,calls=0;
  const reader=new CachedReader({kind:'controlled',async snapshot(address){
    calls++;active++;peak=Math.max(peak,active);
    await new Promise<void>(resolve=>ready.push(resolve));active--;
    return mock.snapshot(address);
  }});
  const addresses=Array.from({length:17},(_,i)=>'0x'+(i+100).toString(16).padStart(40,'0'));
  const requests=addresses.slice(0,16).map(a=>reader.snapshot(a));
  const duplicate=reader.snapshot(addresses[15]);
  await assert.rejects(reader.snapshot(addresses[16]),/busy/);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);
  for(let i=0;i<16;i++){
    assert(ready.length>0);ready.shift()!();await new Promise(resolve=>setImmediate(resolve));
  }
  const results=await Promise.all(requests),same=await duplicate;
  assert.equal(calls,16);assert.equal(peak,2);assert.deepEqual(same,results[15]);assert.notEqual(same,results[15]);
});

test('a failed active scan releases its slot and can be retried',async()=>{
  const mock=new MockReader();let release!:()=>void,first=true;
  const reader=new CachedReader({kind:'failure',async snapshot(address){
    if(first){first=false;await new Promise<void>(resolve=>{release=resolve;});throw new Error('fixture failure');}
    return mock.snapshot(address);
  }},60000,1000,1);
  const failed=assert.rejects(reader.snapshot(wallet),/fixture failure/);
  const queued=reader.snapshot(other);
  await new Promise(resolve=>setImmediate(resolve));release();await failed;
  assert.equal((await queued).address,other);assert.equal((await reader.snapshot(wallet)).address,wallet);
  for(const concurrency of [0,17,1.5,NaN])assert.throws(()=>new CachedReader(mock,1,1,concurrency),/concurrency/);
});
test('failed snapshots are not cached and pending slots are released', async () => {
  let calls = 0; const mock = new MockReader();
  const cache = new CachedReader({ kind: 'test', async snapshot(a) { if (++calls === 1) throw new Error('offline'); return mock.snapshot(a); } });
  await assert.rejects(cache.snapshot(wallet), /offline/); await cache.snapshot(wallet); assert.equal(calls, 2);
});
test('RPC integration pins finalized state, reads per-token decimals, rejects reorgs and wrong networks', async () => {
  const seen: { method: string; params: any[] }[] = [];
  let mode = 'ok'; let headReads = 0; let transient = true;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const call = JSON.parse(Buffer.concat(chunks).toString()); seen.push(call);
    if (transient) { transient = false; res.writeHead(503).end(); return; }
    let result: unknown;
    if (call.method === 'eth_chainId') result = mode === 'wrong-chain' ? '0x2' : '0x1';
    else if (call.method === 'eth_getBlockByNumber') {
      const n = call.params[0] === 'finalized' ? 4 : Number(BigInt(call.params[0]));
      if (n === 4) headReads++;
      result = { number: '0x' + n.toString(16), hash: word(mode === 'reorg' && n === 4 && headReads > 1 ? 999 : n), timestamp: '0x' + (n * 86400).toString(16) };
    } else if (call.method === 'eth_getLogs') result = call.params[0].topics[1] === null ? [log(1, 0, 100)] : [];
    else if (call.method === 'eth_call') {
      assert.equal(call.params[1], '0x4');
      const { to, data } = call.params[0];
      result = data === '0x313ce567' ? word(to === token ? 0 : 6) : word(to === token ? 100 : 2_500_000);
    } else { res.writeHead(400).end(); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  try {
    const reader = new RpcReader({ rpcUrl: `http://127.0.0.1:${address.port}`, token, decimals: 0, fromBlock: 1, chainId: 1, ecosystem: { ECO: ecosystem } });
    const snapshot = await reader.snapshot(wallet);
    assert.equal(snapshot.stakeTime, 300); assert.equal(snapshot.ecosystemHoldings.ECO, 2.5);
    assert.equal(snapshot.takenAt, DAY * 4); assert.equal(snapshot.walletAgeDays, 0);
    assert(seen.every(c => ['eth_chainId', 'eth_call', 'eth_getLogs', 'eth_getBlockByNumber'].includes(c.method)));
    mode = 'reorg'; headReads = 0; await assert.rejects(reader.snapshot(wallet), /Snapshot block changed/);
    mode = 'wrong-chain'; await assert.rejects(reader.snapshot(wallet), /Wrong RPC chain/);
  } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
});

test('persistent history resumes after restart, validates anchors, and never publishes failed snapshots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pons-rpc-history-'));
  let head = 4, fork = 0, failEnd = false, reads = 0;
  const ranges: number[] = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const call = JSON.parse(Buffer.concat(chunks).toString()); let result: unknown;
    if (call.method === 'eth_chainId') result = '0x1';
    else if (call.method === 'eth_getBlockByNumber') {
      const n = call.params[0] === 'finalized' ? head : Number(BigInt(call.params[0]));
      if (n === head) reads++;
      result = { number: '0x' + n.toString(16), hash: word(n + fork + (failEnd && n === head && reads > 1 ? 999 : 0)), timestamp: '0x' + (n * 86400).toString(16) };
    } else if (call.method === 'eth_getLogs') {
      const filter = call.params[0], from = Number(BigInt(filter.fromBlock)), to = Number(BigInt(filter.toBlock)); ranges.push(from);
      const events = [log(1, 0, 100), ...(head >= 5 ? [log(5, 0, 20, wallet, other)] : [])];
      result = events.filter(e => Number(BigInt(e.blockNumber)) >= from && Number(BigInt(e.blockNumber)) <= to
        && (filter.topics[1] === null ? e.topics[2] === topicAddress(wallet) : e.topics[1] === topicAddress(wallet)))
        .map(e => ({ ...e, blockHash: word(Number(BigInt(e.blockNumber)) + fork) }));
    } else if (call.method === 'eth_call') result = call.params[0].data === '0x313ce567' ? word(0) : word(head >= 5 ? 80 : 100);
    else throw new Error('Unexpected RPC method');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const cfg = { rpcUrl: `http://127.0.0.1:${address.port}`, token, decimals: 0, fromBlock: 1, chainId: 1, ecosystem: {}, historyDirectory: directory };
  const key = JSON.stringify([1, 1, token, 1, 0, wallet]);
  try {
    assert.equal((await new RpcReader(cfg).snapshot(wallet)).stakeTime, 300); assert.deepEqual(ranges, [1, 1]);
    head = 6; reads = 0; failEnd = true; ranges.length = 0;
    await assert.rejects(new RpcReader(cfg).snapshot(wallet), /Snapshot block changed/);
    assert.deepEqual(ranges, [5, 5]);
    assert.equal((await new CheckpointStore(directory).load(key) as any).head.number, '0x4');
    reads = 0; failEnd = false; ranges.length = 0;
    const resumed = await new RpcReader(cfg).snapshot(wallet);
    assert.equal(resumed.stakeTime, 480); assert.equal(resumed.ponsBalance, 80); assert.equal(resumed.holdStreakDays, 1);
    assert.deepEqual(ranges, [5, 5]);
    ranges.length = 0; await new RpcReader(cfg).snapshot(wallet); assert.deepEqual(ranges, []);
    fork = 100; ranges.length = 0;
    assert.equal((await new RpcReader(cfg).snapshot(wallet)).stakeTime, 480); assert.deepEqual(ranges, [1, 1]);
    await new CheckpointStore(directory).save(key, { version: 1 }); ranges.length = 0;
    await new RpcReader(cfg).snapshot(wallet); assert.deepEqual(ranges, [1, 1]);
    ranges.length = 0; await new RpcReader({ ...cfg, fromBlock: 0 }).snapshot(wallet); assert.deepEqual(ranges, [0, 0]);
    head = 4; await assert.rejects(new RpcReader(cfg).snapshot(wallet), /Finalized head regressed/);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('disjoint RPC ranges concatenate canonically and reject provider events outside the requested range',async()=>{
  let outside=false;
  const self=log(2000,0,100,wallet,wallet);
  const events=[log(1,0,100),self,log(2001,0,20,wallet,other)];
  const server=createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const call=JSON.parse(Buffer.concat(chunks).toString());let result:unknown;
    if(call.method==='eth_chainId')result='0x1';
    else if(call.method==='eth_getBlockByNumber'){
      const n=call.params[0]==='finalized'?4001:Number(BigInt(call.params[0]));
      result={number:'0x'+n.toString(16),hash:word(n),timestamp:'0x'+(n*86400).toString(16)};
    }else if(call.method==='eth_getLogs'){
      const f=call.params[0],from=Number(BigInt(f.fromBlock)),to=Number(BigInt(f.toBlock));
      result=outside && from===2001 ? [events[0]] : events.filter(e=>{
        const block=Number(BigInt(e.blockNumber));
        return block>=from && block<=to && (f.topics[1]===null?e.topics[2]===topicAddress(wallet):e.topics[1]===topicAddress(wallet));
      }).reverse();
    }else if(call.method==='eth_call')result=call.params[0].data==='0x313ce567'?word(0):word(80);
    else throw new Error('Unexpected method');
    res.end(JSON.stringify({jsonrpc:'2.0',id:call.id,result}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert(address && typeof address!=='string');
  const reader=new RpcReader({rpcUrl:`http://127.0.0.1:${address.port}`,token,decimals:0,fromBlock:1,chainId:1,ecosystem:{}});
  try{
    const result=await reader.snapshot(wallet);
    assert.equal(result.ponsBalance,80);assert.equal(result.stakeTime,360000);assert.equal(result.holdStreakDays,2000);
    assert.equal(result.unstakeEvents.length,1);
    outside=true;await assert.rejects(reader.snapshot(wallet),/Invalid Transfer history/);
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
