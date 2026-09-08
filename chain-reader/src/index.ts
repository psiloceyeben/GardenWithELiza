// Chain reader (bible §6.3). One interface, three implementations:
//   MockReader  — deterministic from the address hash + fixture wallets. Used until D-6 supplies real contracts.
//   RpcReader   — raw JSON-RPC (eth_call / eth_getLogs) against any ERC-20; walks Transfer logs into the stake integral.
//                 Activates when PONS_RPC_URL + PONS_TOKEN are set. Read-only by construction: it can only issue eth_* reads.
//   CachedReader — 5-minute TTL per address in front of either.
// LAW (I-1/I-2): nothing in this module can sign, send, or construct a transaction.
import type { ChainSnapshot, UnstakeEvent } from '../../shared/derive/types';
import { addressHash } from '../../shared/derive';
import { FIXTURES } from '../../shared/derive/fixtures';
import { checkedAddress, topicAddress, quantity, rawAmount, tokenAmount, orderedTransfers, reconstructHistory, TRANSFER_TOPIC, type TransferLog } from './history';
import { readBrokerDecor, type BrokerConfig } from './broker';
import { CheckpointStore, type CheckpointAccess } from './checkpoint-store';
import { readRpcJson } from './rpc-json';
import { WorkerRpcReader } from './worker-reader';

export interface ChainReader { snapshot(address: string): Promise<ChainSnapshot>; readonly kind: string; }

const DAY_MS = 86_400_000;

// ------------------------------------------------------------ mock
export class MockReader implements ChainReader {
  kind = 'mock';
  async snapshot(address: string): Promise<ChainSnapshot> {
    const a = address.toLowerCase();
    const fx = FIXTURES.find((f) => f.snapshot.address === a);
    if (fx) return { ...fx.snapshot, takenAt: Date.now() };
    // stable pseudo-history from the address so demos and share pages are repeatable
    const h = addressHash(a);
    const tierRoll = h % 10;                                  // 0..9
    const stakeTime = tierRoll < 3 ? 0 : tierRoll < 6 ? 800 + (h % 700) : tierRoll < 8 ? 12_000 + (h % 30_000) : 150_000 + (h % 900_000);
    const streak = tierRoll < 3 ? 0 : (h >> 4) % 400;
    const sells = (h >> 8) % 3;
    const unstakeEvents: UnstakeEvent[] = Array.from({ length: sells }, (_, i) => ({ at: Date.now() - (i + 1) * 30 * DAY_MS, fraction: 0.2 + ((h >> (12 + i)) % 50) / 100 }));
    const eco: Record<string, number> = {};
    if ((h >> 16) % 3 === 0) eco.STONKBROKER = 1 + (h % 9);
    if ((h >> 18) % 2 === 0) eco.DERP = 1 + (h % 5);
    const decor = { brokerNfts: (h >> 20) % 2, stockTokenKinds: (h >> 21) % 4, drops: (h >> 23) % 9 };
    return { address: a, takenAt: Date.now(), ponsBalance: stakeTime ? Math.round(stakeTime / Math.max(1, streak || 30)) : 0, stakeTime, holdStreakDays: streak, unstakeEvents, walletAgeDays: streak + 30, ecosystemHoldings: eco, stockDecor: decor };
  }
}

// ------------------------------------------------------------ rpc
export interface RpcConfig {
  rpcUrl: string;               // e.g. Alchemy Robinhood Chain endpoint (kept in env on Box C, never in the repo)
  token: string;                // PONS ERC-20 address
  decimals: number;
  fromBlock: number;            // token deployment block
  ecosystem: Record<string, string>;   // symbol -> MEME token address (allowlist; never stock tokens / broker NFTs)
  chainId: number;
  broker?: BrokerConfig;
  historyDirectory?: string;   // optional private, single-process checkpoint directory
}
type Block = { number: string; hash: string; timestamp: string };
type HistoryCheckpoint = { version: 1; head: Block; logs: TransferLog[]; timestamps: [number, number][]; balance: string };

export class RpcReader implements ChainReader {
  kind = 'rpc';
  private id = 1;
  private checkpoints?: CheckpointAccess;
  constructor(private cfg: RpcConfig, checkpoints?: CheckpointAccess) {
    checkedAddress(cfg.token);
    for (const token of Object.values(cfg.ecosystem)) checkedAddress(token);
    if (cfg.broker) {
      checkedAddress(cfg.broker.collection);
      if (!Number.isSafeInteger(cfg.broker.fromBlock) || cfg.broker.fromBlock < 0) throw new Error('Invalid broker deployment block');
    }
    if (!Number.isSafeInteger(cfg.fromBlock) || cfg.fromBlock < 0 || !Number.isSafeInteger(cfg.chainId) || cfg.chainId <= 0 ||
        !Number.isInteger(cfg.decimals) || cfg.decimals < 0 || cfg.decimals > 255) throw new Error('Invalid RPC configuration');
    let url: URL;
    try { url = new URL(cfg.rpcUrl); }
    catch { throw new Error('Invalid RPC URL'); } // URL parser errors can retain credential-bearing input.
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid RPC protocol');
    this.checkpoints=checkpoints ?? (cfg.historyDirectory!==undefined ? new CheckpointStore(cfg.historyDirectory) : undefined);
  }

  private checkedCheckpoint(value: unknown, wallet: string): HistoryCheckpoint | null {
    try {
      const c = value as HistoryCheckpoint;
      if (!c || c.version !== 1 || !c.head || !Array.isArray(c.logs) || !Array.isArray(c.timestamps)
        || !/^0x[0-9a-f]{64}$/i.test(c.head.hash)) return null;
      const end = quantity(c.head.number), time = quantity(c.head.timestamp) * 1000;
      if (end < this.cfg.fromBlock || !Number.isSafeInteger(time)) return null;
      const timestamps = new Map<number, number>();
      for (const pair of c.timestamps) {
        if (!Array.isArray(pair) || pair.length !== 2 || !Number.isSafeInteger(pair[0]) || !Number.isSafeInteger(pair[1])
          || pair[0] < this.cfg.fromBlock || pair[0] > end || pair[1] < 0 || pair[1] > time || timestamps.has(pair[0])) return null;
        timestamps.set(pair[0], pair[1]);
      }
      const logs = orderedTransfers(c.logs, this.cfg.token, wallet, this.cfg.fromBlock, end);
      reconstructHistory(logs, wallet, this.cfg.decimals, timestamps, time, rawAmount(c.balance));
      return { version: 1, head: c.head, logs, timestamps: [...timestamps], balance: c.balance };
    } catch { return null; }
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    if (!/^eth_(call|getLogs|chainId|getBlockByNumber)$/.test(method)) throw new Error(`read-only reader: ${method} not allowed`);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const id = this.id++;
        const res = await fetch(this.cfg.rpcUrl, { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
        if (!res.ok) { await res.body?.cancel(); throw new Error('RPC HTTP failure'); }
        const j = await readRpcJson(res) as { jsonrpc?: string; id?: number; result?: T; error?: unknown };
        if (j.jsonrpc !== '2.0' || j.id !== id || j.error || j.result === undefined) throw new Error('RPC response failure');
        return j.result;
      } catch {
        // Never expose an endpoint URL, API key, or provider error body to game clients/logs.
        if (attempt === 2) throw new Error(`Chain read failed (${method})`);
        await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    throw new Error('Chain read failed');
  }
  private async balanceOf(token: string, address: string, block: string): Promise<bigint> {
    const data = '0x70a08231' + address.toLowerCase().replace('0x', '').padStart(64, '0');
    const hex = await this.rpc<string>('eth_call', [{ to: token, data }, block]);
    return rawAmount(hex);
  }
  private async block(tag: string): Promise<Block> {
    const block = await this.rpc<Block | null>('eth_getBlockByNumber', [tag, false]);
    if (!block || !/^0x[0-9a-f]{64}$/i.test(block.hash)) throw new Error('Missing chain block');
    quantity(block.number); quantity(block.timestamp);
    if (tag.startsWith('0x') && quantity(block.number) !== quantity(tag)) throw new Error('Wrong chain block');
    return block;
  }

  async snapshot(address: string): Promise<ChainSnapshot> {
    const a = checkedAddress(address);
    if (quantity(await this.rpc<string>('eth_chainId', [])) !== this.cfg.chainId) throw new Error('Wrong RPC chain');
    const head = await this.block('finalized');
    const latest = quantity(head.number); const now = quantity(head.timestamp) * 1000;
    if (latest < this.cfg.fromBlock) throw new Error('Token deployment is beyond finalized head');
    const key = JSON.stringify([1, this.cfg.chainId, checkedAddress(this.cfg.token), this.cfg.fromBlock, this.cfg.decimals, a]);
    const saved = this.checkpoints ? this.checkedCheckpoint(await this.checkpoints.load(key), a) : null;
    let logs: TransferLog[] = [];
    const timestamps = new Map<number, number>();
    let scanFrom = this.cfg.fromBlock;
    if (saved) {
      if (quantity(saved.head.number) > latest) throw new Error('Finalized head regressed');
      const anchor = await this.block(saved.head.number);
      if (anchor.hash.toLowerCase() === saved.head.hash.toLowerCase() && quantity(anchor.timestamp) === quantity(saved.head.timestamp)) {
        logs = saved.logs;
        for (const [number, timestamp] of saved.timestamps) timestamps.set(number, timestamp);
        scanFrom = quantity(saved.head.number) + 1;
      }
      // An invalidated finalized anchor requires a complete fresh scan.
    }
    const step = 2_000;
    for (let from = scanFrom; from <= latest; from += step) {
      const to = Math.min(latest, from + step - 1);
      const range = { address: this.cfg.token, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) };
      const [inn, out] = await Promise.all([
        this.rpc<TransferLog[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, null, topicAddress(a)] }]),
        this.rpc<TransferLog[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, topicAddress(a)] }]),
      ]);
      for (const log of orderedTransfers([...inn, ...out], this.cfg.token, a, from, to)) logs.push(log);
    }
    // Checkpoint logs were normalized/validated on load. New ranges are disjoint,
    // ascending, and individually validated above (including range membership).
    // Concatenation is already canonical; avoid cloning/sorting the full history again.
    const ordered = logs;
    for (const log of ordered) {
      const bn = quantity(log.blockNumber);
      if (timestamps.has(bn)) continue;
      const block = await this.block(log.blockNumber);
      if (block.hash.toLowerCase() !== log.blockHash) throw new Error('Transfer block changed');
      timestamps.set(bn, quantity(block.timestamp) * 1000);
    }
    const tokenDecimals = quantity(await this.rpc<string>('eth_call', [{ to: this.cfg.token, data: '0x313ce567' }, head.number]));
    if (tokenDecimals !== this.cfg.decimals) throw new Error('PONS decimals do not match contract');
    const balance = await this.balanceOf(this.cfg.token, a, head.number);
    const history = reconstructHistory(ordered, a, tokenDecimals, timestamps, now, balance);
    const eco: Record<string, number> = {};
    for (const [sym, addr] of Object.entries(this.cfg.ecosystem)) {
      const decimals = quantity(await this.rpc<string>('eth_call', [{ to: addr, data: '0x313ce567' }, head.number]));
      if (decimals > 255) throw new Error('Invalid ecosystem decimals');
      eco[sym] = tokenAmount(await this.balanceOf(addr, a, head.number), decimals);
    }
    const stockDecor = this.cfg.broker ? await readBrokerDecor(this.rpc.bind(this), this.cfg.broker, a, head.number,
      [this.cfg.token, ...Object.values(this.cfg.ecosystem)]) : { brokerNfts: 0, stockTokenKinds: 0, drops: 0 };
    if ((await this.block(head.number)).hash.toLowerCase() !== head.hash.toLowerCase()) throw new Error('Snapshot block changed');
    await this.checkpoints?.save(key, { version: 1, head, logs: ordered, timestamps: [...timestamps],
      balance: '0x' + balance.toString(16).padStart(64, '0') } satisfies HistoryCheckpoint);
    return { address: a, takenAt: now, ponsBalance: history.ponsBalance, stakeTime: history.stakeTime, holdStreakDays: history.holdStreakDays,
      unstakeEvents: history.unstakeEvents, walletAgeDays: 0, ecosystemHoldings: eco,
      stockDecor };
  }
}

// ------------------------------------------------------------ cache
export class CachedReader implements ChainReader {
  kind: string;
  private cache = new Map<string, { at: number; snap: ChainSnapshot }>();
  private pending = new Map<string, Promise<ChainSnapshot>>();
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private inner: ChainReader, private ttlMs = 5 * 60_000, private capacity = 1000, private concurrency = 2) {
    if (!Number.isInteger(capacity) || capacity < 1 || !Number.isFinite(ttlMs) || ttlMs < 0) throw new Error('Invalid chain cache configuration');
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Invalid chain scan concurrency');
    this.kind = `cached(${inner.kind})`;
  }
  private async read(address: string): Promise<ChainSnapshot> {
    if (this.active >= this.concurrency) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try { return await this.inner.snapshot(address); }
    finally {
      // Hand the occupied slot directly to the next queued request, including on failure.
      const next = this.waiting.shift();
      if (next) next(); else this.active--;
    }
  }
  async snapshot(address: string): Promise<ChainSnapshot> {
    const a = checkedAddress(address); const hit = this.cache.get(a);
    if (hit && Date.now() - hit.at < this.ttlMs) {
      this.cache.delete(a); this.cache.set(a, hit);
      return structuredClone(hit.snap);
    }
    const running = this.pending.get(a);
    if (running) return structuredClone(await running);
    if (this.pending.size >= 16) throw new Error('Chain reader busy; retry shortly');
    const request = Promise.resolve().then(() => this.read(a)).then(snap => {
      const saved = structuredClone(snap);
      this.cache.delete(a); this.cache.set(a, { at: Date.now(), snap: saved });
      while (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value!);
      return saved;
    }).finally(() => this.pending.delete(a));
    this.pending.set(a, request);
    return structuredClone(await request);
  }
}

/** Picks RpcReader when the environment is configured, MockReader otherwise. */
export function readerFromEnv(env: Record<string, string | undefined>): ChainReader {
  if (env.PONS_CHAIN_SCAN_TIMEOUT_MS !== undefined && !env.PONS_RPC_URL) throw new Error('Chain scan timeout requires RPC mode');
  if (env.PONS_HISTORY_DIR !== undefined && !env.PONS_RPC_URL) throw new Error('History checkpoints require RPC mode');
  const brokerConfigured = env.PONS_BROKER_NFT !== undefined || env.PONS_BROKER_FROM_BLOCK !== undefined;
  if (brokerConfigured && (!env.PONS_BROKER_NFT || !env.PONS_BROKER_FROM_BLOCK || !env.PONS_RPC_URL || !env.PONS_TOKEN)) throw new Error('Broker configuration requires NFT, deployment block and RPC mode');
  if (!!env.PONS_RPC_URL !== !!env.PONS_TOKEN) throw new Error('Both PONS_RPC_URL and PONS_TOKEN are required');
  const rpcSettings=['PONS_RPC_URL','PONS_TOKEN','PONS_CHAIN_ID','PONS_FROM_BLOCK','PONS_DECIMALS','PONS_ECOSYSTEM'];
  if(rpcSettings.some(key=>env[key]!==undefined) && (!env.PONS_RPC_URL?.trim() || !env.PONS_TOKEN?.trim()))
    throw new Error('Both PONS_RPC_URL and PONS_TOKEN are required for chain configuration');
  for(const key of ['PONS_CHAIN_ID','PONS_FROM_BLOCK','PONS_DECIMALS','PONS_BROKER_FROM_BLOCK','PONS_CHAIN_SCAN_TIMEOUT_MS']) {
    if(env[key]!==undefined && env[key]!.trim()==='')throw new Error('Empty numeric chain setting: '+key);
  }
  if (env.PONS_RPC_URL && env.PONS_TOKEN) {
    if (!env.PONS_CHAIN_ID || env.PONS_FROM_BLOCK === undefined) throw new Error('PONS_CHAIN_ID and PONS_FROM_BLOCK are required');
    const eco: Record<string, string> = {};
    for (const pair of (env.PONS_ECOSYSTEM ?? '').split(',').filter(Boolean)) {
      const [sym, addr, extra] = pair.trim().split(':');
      if (!sym || !/^[A-Z][A-Z0-9_]*$/.test(sym) || !addr || extra !== undefined || Object.prototype.hasOwnProperty.call(eco, sym)) throw new Error('Invalid ecosystem allowlist');
      eco[sym] = checkedAddress(addr);
    }
    const cfg: RpcConfig = { rpcUrl: env.PONS_RPC_URL, token: env.PONS_TOKEN, decimals: Number(env.PONS_DECIMALS ?? 18), fromBlock: Number(env.PONS_FROM_BLOCK), ecosystem: eco, chainId: Number(env.PONS_CHAIN_ID),
      broker: brokerConfigured ? { collection: env.PONS_BROKER_NFT!, fromBlock: Number(env.PONS_BROKER_FROM_BLOCK) } : undefined,
      historyDirectory: env.PONS_HISTORY_DIR };
    new RpcReader(cfg); // Keep synchronous startup validation before any worker is created.
    return new CachedReader(new WorkerRpcReader(cfg, Number(env.PONS_CHAIN_SCAN_TIMEOUT_MS ?? 300_000)));
  }
  return new CachedReader(new MockReader());
}
