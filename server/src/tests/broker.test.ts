import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownedBrokerIds, readBrokerDecor, viewData, type ReadRpc } from '../../../chain-reader/src/broker';
import { TRANSFER_TOPIC, topicAddress } from '../../../chain-reader/src/history';
import { deriveGarden } from '../../../shared/derive';
import { FIXTURES } from '../../../shared/derive/fixtures';

const address = (n: number) => '0x' + n.toString(16).padStart(40, '0');
const word = (n: number) => '0x' + n.toString(16).padStart(64, '0');
const wallet = address(1), other = address(2), collection = address(3), stock = address(4), tba = address(5), pons = address(6);
const cfg = { collection, fromBlock: 1 };
function nft(id: number, block: number, from = other, to = wallet) {
  return { address: collection, blockNumber: '0x' + block.toString(16), blockHash: word(block), transactionHash: word(block),
    logIndex: '0x0', topics: [TRANSFER_TOPIC, topicAddress(from), topicAddress(to), word(id)], data: '0x' };
}
test('broker ownership handles purchase, sale, duplicates and self-transfer without ERC721Enumerable', () => {
  const self = nft(7, 2, wallet, wallet);
  assert.deepEqual(ownedBrokerIds([nft(7, 1), self, self, nft(9, 3), nft(7, 4, wallet, other)], cfg, wallet, 4), [9n]);
});
test('broker ownership rejects missing and conflicting histories', () => {
  assert.throws(() => ownedBrokerIds([nft(7, 1, wallet, other)], cfg, wallet, 4), /Incomplete/);
  assert.throws(() => ownedBrokerIds([nft(7, 1), nft(8, 1)], cfg, wallet, 4), /Conflicting/);
  assert.throws(() => ownedBrokerIds([{ ...nft(7, 1), removed: true }], cfg, wallet, 4), /Invalid/);
});
test('view encoding only accepts verified read selectors', () => {
  assert.equal(viewData('balanceOf(address)', wallet), '0x70a08231' + topicAddress(wallet).slice(2));
  assert.equal(viewData('ownerOf(uint256)', 7n), '0x6352211e' + word(7).slice(2));
  assert.throws(() => viewData('transfer(address,uint256)' as any), /Unsupported/);
});
function fixture(mode = 'ok'): ReadRpc {
  return async <T>(method: string, params: any[]): Promise<T> => {
    let result: unknown;
    if (method === 'eth_getLogs') result = params[0].topics[1] === null ? [nft(7, 1)] : [];
    else {
      assert.equal(method, 'eth_call'); assert.equal(params[1], '0x4');
      const { to, data } = params[0];
      if (data === viewData('stockTokenCount()')) result = word(1);
      else if (data === viewData('stockTokenAt(uint256)', 0n)) result = topicAddress(stock);
      else if (data === viewData('ownerOf(uint256)', 7n)) result = topicAddress(mode === 'wrong-owner' ? other : wallet);
      else if (data === viewData('tokenWallet(uint256)', 7n)) result = topicAddress(tba);
      else if (data === viewData('predictWallet(uint256)', 7n)) result = topicAddress(mode === 'wrong-tba' ? other : tba);
      else if (to === collection && data === viewData('balanceOf(address)', wallet)) result = word(mode === 'missing-log' ? 2 : 1);
      else if (to === stock && data === viewData('balanceOf(address)', wallet)) result = word(0);
      else if (to === stock && data === viewData('balanceOf(address)', tba)) result = word(10);
      else throw new Error('Unexpected call');
    }
    return result as T;
  };
}
test('broker adapter resolves actual TBA and counts distinct supported stock kinds at pinned block', async () => {
  assert.deepEqual(await readBrokerDecor(fixture(), cfg, wallet, '0x4', [pons]), { brokerNfts: 1, stockTokenKinds: 1, drops: 0 });
});
test('broker adapter rejects wrong owners, missing NFTs, and incorrect TBA resolution', async () => {
  await assert.rejects(readBrokerDecor(fixture('wrong-owner'), cfg, wallet, '0x4', [pons]), /owner/);
  await assert.rejects(readBrokerDecor(fixture('missing-log'), cfg, wallet, '0x4', [pons]), /balance/);
  await assert.rejects(readBrokerDecor(fixture('wrong-tba'), cfg, wallet, '0x4', [pons]), /account mismatch/);
});
test('stock and broker contracts cannot enter PONS/ecosystem gameplay configuration', async () => {
  await assert.rejects(readBrokerDecor(fixture(), cfg, wallet, '0x4', [stock]), /forbidden/);
  await assert.rejects(readBrokerDecor(fixture(), cfg, wallet, '0x4', [collection]), /forbidden/);
});
test('adapter output changes only decorative flora in derived game state', async () => {
  const snapshot = structuredClone(FIXTURES[1].snapshot);
  snapshot.stockDecor = { brokerNfts: 0, stockTokenKinds: 0, drops: 0 };
  const before = deriveGarden(snapshot.address, snapshot);
  snapshot.stockDecor = await readBrokerDecor(fixture(), cfg, wallet, '0x4', [pons]);
  const after = deriveGarden(snapshot.address, snapshot);
  const { decorFlora: first, ...gameplayBefore } = before;
  const { decorFlora: second, ...gameplayAfter } = after;
  assert.deepEqual(gameplayAfter, gameplayBefore); assert(second > first);
});

test('broker queries validate each range/filter before ownership reconstruction',async()=>{
  for(const mode of ['future-range','wrong-direction','not-array']){
    let queries=0;const base=fixture();
    const rpc:ReadRpc=async<T>(method:string,params:any[]):Promise<T>=>{
      if(method!=='eth_getLogs')return base<T>(method,[params[0],'0x4']);
      queries++;
      if(params[0].topics[1]!==null)return [] as T;
      return (mode==='not-array'?{}:[mode==='future-range'?nft(7,2001):nft(7,1,wallet,other)]) as T;
    };
    await assert.rejects(readBrokerDecor(rpc,cfg,wallet,'0xfa1',[pons]),/broker log response|requested range or wallet filter/);
    assert.equal(queries,2,'Do not continue scanning after an invalid response');
  }
});

test('broker multi-range ownership accepts correctly filtered duplicate self-transfers',async()=>{
  const base=fixture(),ranges:number[]=[];
  const events=[nft(7,1),nft(7,2001,wallet,wallet)];
  const rpc:ReadRpc=async<T>(method:string,params:any[]):Promise<T>=>{
    if(method!=='eth_getLogs')return base<T>(method,[params[0],'0x4']);
    const f=params[0],from=Number(BigInt(f.fromBlock)),to=Number(BigInt(f.toBlock));ranges.push(from);
    return events.filter(e=>{
      const n=Number(BigInt(e.blockNumber));
      return n>=from && n<=to && e.topics[f.topics[1]===null?2:1]===topicAddress(wallet);
    }) as T;
  };
  assert.deepEqual(await readBrokerDecor(rpc,cfg,wallet,'0xfa1',[pons]),{brokerNfts:1,stockTokenKinds:1,drops:0});
  assert.deepEqual(ranges,[1,1,2001,2001,4001,4001]);
});
