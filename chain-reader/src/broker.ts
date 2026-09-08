import { keccak_256 } from '@noble/hashes/sha3';
import { checkedAddress, quantity, rawAmount, topicAddress, TRANSFER_TOPIC } from './history';
import type { ChainSnapshot } from '../../shared/derive/types';

export interface BrokerConfig { collection: string; fromBlock: number }
export type ReadRpc = <T>(method: string, params: unknown[]) => Promise<T>;
// Only the verified collection's view ABI is represented here; no transaction methods.
const VIEWS = ['balanceOf(address)', 'ownerOf(uint256)', 'tokenWallet(uint256)', 'predictWallet(uint256)', 'stockTokenCount()', 'stockTokenAt(uint256)'] as const;
export type BrokerView = typeof VIEWS[number];
export function viewData(method: BrokerView, value?: string | bigint): string {
  if (!VIEWS.includes(method)) throw new Error('Unsupported broker view');
  const selector = Buffer.from(keccak_256(new TextEncoder().encode(method))).toString('hex').slice(0, 8);
  return '0x' + selector + (value === undefined ? '' : typeof value === 'bigint' ? value.toString(16).padStart(64, '0') : topicAddress(value).slice(2));
}
function addressResult(result: string): string {
  rawAmount(result);
  if (!/^0x0{24}/i.test(result)) throw new Error('Invalid ABI address');
  const address = checkedAddress('0x' + result.slice(26));
  if (BigInt(address) === 0n) throw new Error('Missing broker account or token');
  return address;
}
type NftLog = { address: string; blockNumber: string; blockHash: string; transactionHash: string; logIndex: string; topics: string[]; data: string; removed?: boolean };

/** Reconstruct direct ownership only, not vault collateral or delegated control. */
export function ownedBrokerIds(logs: NftLog[], cfg: BrokerConfig, wallet: string, head: number): bigint[] {
  const owner = topicAddress(wallet); const collection = checkedAddress(cfg.collection);
  const events = new Map<string, NftLog>(); const hashes = new Map<number, string>();
  for (const log of logs) {
    const block = quantity(log.blockNumber); const index = quantity(log.logIndex);
    if (log.removed || block < cfg.fromBlock || block > head || checkedAddress(log.address) !== collection || log.topics.length !== 4 ||
        log.topics[0].toLowerCase() !== TRANSFER_TOPIC || log.data !== '0x' ||
        !/^0x[0-9a-f]{64}$/i.test(log.blockHash) || !/^0x[0-9a-f]{64}$/i.test(log.transactionHash) ||
        !log.topics.slice(1, 3).every(t => /^0x0{24}[0-9a-f]{40}$/i.test(t)) ||
        !log.topics.slice(1, 3).some(t => t.toLowerCase() === owner)) throw new Error('Invalid broker Transfer history');
    rawAmount(log.topics[3]);
    const hash = log.blockHash.toLowerCase();
    if (hashes.has(block) && hashes.get(block) !== hash) throw new Error('Mixed broker forks');
    hashes.set(block, hash);
    const normalized = { ...log, address: collection, blockHash: hash, transactionHash: log.transactionHash.toLowerCase(), topics: log.topics.map(t => t.toLowerCase()), removed: false };
    const key = `${block}:${index}`; const previous = events.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(normalized)) throw new Error('Conflicting broker transfers');
    events.set(key, normalized);
  }
  const owned = new Set<bigint>();
  for (const log of [...events.values()].sort((a, b) => quantity(a.blockNumber) - quantity(b.blockNumber) || quantity(a.logIndex) - quantity(b.logIndex))) {
    const id = rawAmount(log.topics[3]); const incoming = log.topics[2] === owner; const outgoing = log.topics[1] === owner;
    if (outgoing && !owned.has(id)) throw new Error('Incomplete broker ownership history');
    if (incoming && !outgoing && owned.has(id)) throw new Error('Duplicate broker ownership');
    if (incoming) owned.add(id); else owned.delete(id);
  }
  return [...owned].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

export async function readBrokerDecor(rpc: ReadRpc, cfg: BrokerConfig, wallet: string, block: string, gameplayTokens: string[]): Promise<ChainSnapshot['stockDecor']> {
  checkedAddress(wallet); const collection = checkedAddress(cfg.collection); const head = quantity(block);
  if (!Number.isSafeInteger(cfg.fromBlock) || cfg.fromBlock < 0 || cfg.fromBlock > head) throw new Error('Invalid broker deployment block');
  const call = (to: string, method: BrokerView, value?: string | bigint) => rpc<string>('eth_call', [{ to, data: viewData(method, value) }, block]);
  const count = quantity(await call(collection, 'stockTokenCount()'));
  if (count > 256) throw new Error('Broker stock registry exceeds supported size');
  const stocks = new Set<string>();
  for (let i = 0; i < count; i++) stocks.add(addressResult(await call(collection, 'stockTokenAt(uint256)', BigInt(i))));
  if (gameplayTokens.some(t => checkedAddress(t) === collection || stocks.has(checkedAddress(t)))) throw new Error('Decoration contract is forbidden in gameplay token configuration');

  const logs: NftLog[] = [];
  for (let from = cfg.fromBlock; from <= head; from += 2000) {
    const range = { address: collection, fromBlock: '0x' + from.toString(16), toBlock: '0x' + Math.min(head, from + 1999).toString(16) };
    const [incoming, outgoing] = await Promise.all([
      rpc<NftLog[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, null, topicAddress(wallet)] }]),
      rpc<NftLog[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, topicAddress(wallet)] }]),
    ]);
    for (const [batch, topic] of [[incoming, 2], [outgoing, 1]] as const) {
      if (!Array.isArray(batch)) throw new Error('Invalid broker log response');
      for (const log of batch) {
        const number = quantity(log.blockNumber);
        if (number < from || number > Math.min(head, from + 1999) ||
            typeof log.topics?.[topic] !== 'string' || log.topics[topic].toLowerCase() !== topicAddress(wallet))
          throw new Error('Broker log does not match requested range or wallet filter');
        logs.push(log);
      }
    }
  }
  const ids = ownedBrokerIds(logs, cfg, wallet, head);
  if (BigInt(ids.length) !== rawAmount(await call(collection, 'balanceOf(address)', wallet))) throw new Error('Broker history does not match balance');
  const accounts = new Set<string>([checkedAddress(wallet)]);
  for (const id of ids) {
    if (addressResult(await call(collection, 'ownerOf(uint256)', id)) !== checkedAddress(wallet)) throw new Error('Broker owner does not match history');
    const account = addressResult(await call(collection, 'tokenWallet(uint256)', id));
    if (account !== addressResult(await call(collection, 'predictWallet(uint256)', id))) throw new Error('Broker token-bound account mismatch');
    if (accounts.has(account)) throw new Error('Duplicate broker token-bound account');
    accounts.add(account);
  }
  let stockTokenKinds = 0;
  for (const stock of stocks) {
    for (const account of accounts) {
      if (rawAmount(await call(stock, 'balanceOf(address)', account)) > 0n) { stockTokenKinds++; break; }
    }
  }
  // Drop-event semantics are not inferred from arbitrary transfers. Remains unavailable
  // until the distribution contract's verified event history adapter is implemented.
  return { brokerNfts: ids.length, stockTokenKinds, drops: 0 };
}
