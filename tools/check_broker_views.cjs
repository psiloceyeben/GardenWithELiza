// Box C only. Public, read-only smoke check; no credentials, signatures or transactions.
const assert = require('node:assert/strict');
const { viewData } = require('../server/dist/chain-reader/src/broker.js');
const COLLECTION = '0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0';
let id = 0;
async function rpc(method, params) {
  assert(['eth_chainId', 'eth_getBlockByNumber', 'eth_call'].includes(method));
  const requestId = ++id;
  const response = await fetch('https://rpc.mainnet.chain.robinhood.com', {
    method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }),
  });
  assert(response.ok, `HTTP ${response.status}`);
  const body = await response.json();
  assert(!body.error && body.id === requestId && body.result !== undefined, `Invalid RPC response for ${method} (code ${body.error?.code ?? 'none'}): ${String(body.error?.message ?? '').slice(0, 240)}`);
  return body.result;
}
async function main() {
  assert.equal(BigInt(await rpc('eth_chainId', [])), 4663n);
  const head = await rpc('eth_getBlockByNumber', ['finalized', false]);
  console.log(JSON.stringify({ finalizedBlock: head.number, timestamp: head.timestamp }));
  const call = (method, value) => rpc('eth_call', [{ to: COLLECTION, data: viewData(method, value) }, head.number]);
  const owner = '0x' + (await call('ownerOf(uint256)', 1n)).slice(-40);
  const actual = await call('tokenWallet(uint256)', 1n);
  assert.equal(actual, await call('predictWallet(uint256)', 1n));
  assert(BigInt(actual) > 0n);
  const stockCount = Number(BigInt(await call('stockTokenCount()')));
  assert(stockCount > 0 && stockCount <= 256);
  const supported = [];
  for (let i = 0; i < stockCount; i++) {
    const stock = '0x' + (await call('stockTokenAt(uint256)', BigInt(i))).slice(-40);
    assert(BigInt(stock) > 0n); supported.push(stock);
  }
  assert.equal((await rpc('eth_getBlockByNumber', [head.number, false])).hash, head.hash);
  console.log(JSON.stringify({ chainId: 4663, block: Number(BigInt(head.number)), hash: head.hash,
    collection: COLLECTION, sampleTokenId: 1, owner, tokenBoundAccount: '0x' + actual.slice(-40), supportedStockTokens: supported }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
