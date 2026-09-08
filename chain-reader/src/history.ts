import type { UnstakeEvent } from '../../shared/derive/types';

export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export interface TransferLog {
  address: string; blockNumber: string; blockHash: string; transactionHash: string;
  logIndex: string; topics: string[]; data: string; removed?: boolean;
}
export function checkedAddress(value: string): string {
  if (!/^0x[0-9a-f]{40}$/i.test(value)) throw new Error('Invalid chain address');
  return value.toLowerCase();
}
export function topicAddress(value: string): string { return '0x' + checkedAddress(value).slice(2).padStart(64, '0'); }
export function quantity(value: string): number {
  if (!/^0x[0-9a-f]+$/i.test(value)) throw new Error('Invalid chain quantity');
  const result = Number(BigInt(value));
  if (!Number.isSafeInteger(result)) throw new Error('Chain quantity exceeds safe integer range');
  return result;
}
export function rawAmount(value: string): bigint {
  if (!/^0x[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid uint256 response');
  return BigInt(value);
}
export function tokenAmount(raw: bigint, decimals: number): number {
  const result = Number(raw) / 10 ** decimals;
  if (!Number.isFinite(result) || result < 0) throw new Error('Invalid token amount');
  return result;
}

/** Reject mixed forks, malformed events and conflicting duplicates before integration. */
export function orderedTransfers(logs: TransferLog[], token: string, wallet: string, from: number, to: number): TransferLog[] {
  const unique = new Map<string, TransferLog>();
  const blocks = new Map<number, string>();
  const owner = topicAddress(wallet); const contract = checkedAddress(token);
  for (const log of logs) {
    const bn = quantity(log.blockNumber); quantity(log.logIndex);
    if (log.removed || checkedAddress(log.address) !== contract || bn < from || bn > to ||
        !/^0x[0-9a-f]{64}$/i.test(log.blockHash) || !/^0x[0-9a-f]{64}$/i.test(log.transactionHash) ||
        log.topics.length !== 3 || log.topics[0].toLowerCase() !== TRANSFER_TOPIC ||
        !log.topics.slice(1).every(t => /^0x0{24}[0-9a-f]{40}$/i.test(t)) ||
        !log.topics.slice(1).some(t => t.toLowerCase() === owner)) throw new Error('Invalid Transfer history');
    rawAmount(log.data);
    const normalized = { ...log, address: contract, blockHash: log.blockHash.toLowerCase(),
      transactionHash: log.transactionHash.toLowerCase(), topics: log.topics.map(t => t.toLowerCase()),
      data: log.data.toLowerCase(), blockNumber: '0x' + bn.toString(16), logIndex: '0x' + quantity(log.logIndex).toString(16), removed: false };
    if (blocks.has(bn) && blocks.get(bn) !== normalized.blockHash) throw new Error('Mixed chain forks');
    blocks.set(bn, normalized.blockHash);
    const key = `${bn}:${normalized.logIndex}`;
    const previous = unique.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(normalized)) throw new Error('Conflicting Transfer logs');
    unique.set(key, normalized);
  }
  return [...unique.values()].sort((a, b) => quantity(a.blockNumber) - quantity(b.blockNumber) || quantity(a.logIndex) - quantity(b.logIndex));
}

/** Raw balances stay bigint; convert only derived display/game inputs to numbers. */
export function reconstructHistory(logs: TransferLog[], wallet: string, decimals: number, timestamps: Map<number, number>, endMs: number, expectedBalance: bigint) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255 || !Number.isSafeInteger(endMs)) throw new Error('Invalid history configuration');
  const owner = topicAddress(wallet);
  let balance = 0n; let integral = 0n; let previousMs = 0;
  let firstMs: number | undefined; let streakMs: number | undefined;
  const unstakeEvents: UnstakeEvent[] = [];
  for (const log of logs) {
    const time = timestamps.get(quantity(log.blockNumber));
    if (time === undefined || !Number.isSafeInteger(time) || time < previousMs || time > endMs) throw new Error('Invalid history timestamp');
    integral += balance * BigInt(time - previousMs);
    previousMs = time;
    const amount = rawAmount(log.data);
    const incoming = log.topics[2] === owner; const outgoing = log.topics[1] === owner;
    if (amount === 0n || incoming === outgoing) continue; // self-transfers are a net zero, not a new holding or sale
    if (firstMs === undefined) firstMs = time;
    if (incoming) {
      if (balance === 0n) streakMs = time;
      balance += amount;
    } else {
      if (amount > balance) throw new Error('Incomplete Transfer history');
      if (amount * 5n >= balance) unstakeEvents.push({ at: time, fraction: Number(amount) / Number(balance) });
      balance -= amount; streakMs = time;
    }
  }
  if (balance !== expectedBalance) throw new Error('Transfer history does not match pinned balance');
  integral += balance * BigInt(endMs - previousMs);
  const stakeTime = tokenAmount(integral, decimals) / 86_400_000;
  return { ponsBalance: tokenAmount(balance, decimals), stakeTime,
    holdStreakDays: balance > 0n && streakMs !== undefined ? (endMs - streakMs) / 86_400_000 : 0,
    unstakeEvents, firstTransferAt: firstMs };
}
