// Chain reader (bible §6.3). One interface, three implementations:
//   MockReader  — deterministic from the address hash + fixture wallets. Used until D-6 supplies real contracts.
//   RpcReader   — raw JSON-RPC (eth_call / eth_getLogs) against any ERC-20; walks Transfer logs into the stake integral.
//                 Activates when PONS_RPC_URL + PONS_TOKEN are set. Read-only by construction: it can only issue eth_* reads.
//   CachedReader — 5-minute TTL per address in front of either.
// LAW (I-1/I-2): nothing in this module can sign, send, or construct a transaction.
import type { ChainSnapshot, UnstakeEvent } from '../../shared/derive/types';
import { addressHash } from '../../shared/derive';
import { FIXTURES } from '../../shared/derive/fixtures';

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
  blockTimeSec: number;
}
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export class RpcReader implements ChainReader {
  kind = 'rpc';
  private id = 1;
  constructor(private cfg: RpcConfig) {}

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    if (!/^eth_(call|getLogs|blockNumber|getBlockByNumber|getTransactionCount)$/.test(method)) throw new Error(`read-only reader: ${method} not allowed`);
    const res = await fetch(this.cfg.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: this.id++, method, params }) });
    const j = await res.json() as { result?: T; error?: { message: string } };
    if (j.error) throw new Error(j.error.message);
    return j.result as T;
  }
  private async balanceOf(token: string, address: string): Promise<number> {
    const data = '0x70a08231' + address.toLowerCase().replace('0x', '').padStart(64, '0');
    const hex = await this.rpc<string>('eth_call', [{ to: token, data }, 'latest']);
    return Number(BigInt(hex || '0x0')) / 10 ** this.cfg.decimals;
  }
  private topicAddr(a: string): string { return '0x' + a.toLowerCase().replace('0x', '').padStart(64, '0'); }

  async snapshot(address: string): Promise<ChainSnapshot> {
    const a = address.toLowerCase(); const now = Date.now();
    const latest = Number(BigInt(await this.rpc<string>('eth_blockNumber', [])));
    type Log = { blockNumber: string; topics: string[]; data: string };
    const logs: Log[] = [];
    const step = 50_000;
    for (let from = this.cfg.fromBlock; from <= latest; from += step) {
      const to = Math.min(latest, from + step - 1);
      const range = { address: this.cfg.token, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) };
      const [inn, out] = await Promise.all([
        this.rpc<Log[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, null, this.topicAddr(a)] }]),
        this.rpc<Log[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, this.topicAddr(a)] }]),
      ]);
      logs.push(...inn, ...out);
    }
    logs.sort((x, y) => Number(BigInt(x.blockNumber)) - Number(BigInt(y.blockNumber)));
    // integrate balance × time; block time approximated from config
    const blockMs = (bn: number) => now - (latest - bn) * this.cfg.blockTimeSec * 1000;
    let bal = 0; let stakeTime = 0; let lastT = 0; let firstT = 0; let lastDecreaseT = 0;
    const unstakeEvents: UnstakeEvent[] = [];
    for (const l of logs) {
      const bn = Number(BigInt(l.blockNumber)); const t = blockMs(bn);
      const amt = Number(BigInt(l.data)) / 10 ** this.cfg.decimals;
      if (lastT) stakeTime += bal * ((t - lastT) / DAY_MS); else firstT = t;
      const incoming = l.topics[2] === this.topicAddr(a);
      if (!incoming && bal > 0) { const frac = amt / bal; if (frac >= 0.2) unstakeEvents.push({ at: t, fraction: Math.min(1, frac) }); lastDecreaseT = t; }
      bal += incoming ? amt : -amt; lastT = t;
    }
    if (lastT) stakeTime += bal * ((now - lastT) / DAY_MS);
    const eco: Record<string, number> = {};
    for (const [sym, addr] of Object.entries(this.cfg.ecosystem)) { try { eco[sym] = await this.balanceOf(addr, a); } catch { eco[sym] = 0; } }
    return { address: a, takenAt: now, ponsBalance: await this.balanceOf(this.cfg.token, a), stakeTime, holdStreakDays: bal > 0 ? (now - (lastDecreaseT || firstT)) / DAY_MS : 0,
      unstakeEvents, walletAgeDays: firstT ? (now - firstT) / DAY_MS : 0, ecosystemHoldings: eco,
      // broker NFT / TBA decoration reads land here once D-6 supplies the contracts; counts only, visuals only (I-3)
      stockDecor: { brokerNfts: 0, stockTokenKinds: 0, drops: 0 } };
  }
}

// ------------------------------------------------------------ cache
export class CachedReader implements ChainReader {
  kind: string;
  private cache = new Map<string, { at: number; snap: ChainSnapshot }>();
  constructor(private inner: ChainReader, private ttlMs = 5 * 60_000) { this.kind = `cached(${inner.kind})`; }
  async snapshot(address: string): Promise<ChainSnapshot> {
    const a = address.toLowerCase(); const hit = this.cache.get(a);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.snap;
    const snap = await this.inner.snapshot(a); this.cache.set(a, { at: Date.now(), snap }); return snap;
  }
}

/** Picks RpcReader when the environment is configured, MockReader otherwise. */
export function readerFromEnv(env: Record<string, string | undefined>): ChainReader {
  if (env.PONS_RPC_URL && env.PONS_TOKEN) {
    const eco: Record<string, string> = {};
    for (const pair of (env.PONS_ECOSYSTEM ?? '').split(',').filter(Boolean)) { const [sym, addr] = pair.split(':'); if (sym && addr) eco[sym] = addr; }
    return new CachedReader(new RpcReader({ rpcUrl: env.PONS_RPC_URL, token: env.PONS_TOKEN, decimals: Number(env.PONS_DECIMALS ?? 18), fromBlock: Number(env.PONS_FROM_BLOCK ?? 0), ecosystem: eco, blockTimeSec: Number(env.PONS_BLOCK_TIME ?? 2) }));
  }
  return new CachedReader(new MockReader());
}
