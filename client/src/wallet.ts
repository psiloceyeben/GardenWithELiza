// Read-only wallet connect (bible I-1/I-2). The wallet is asked for exactly two things: an address and a
// personal_sign of our nonce message. No transaction, approve, transfer, or claim flow exists in this client.
// Four wallets are offered (MetaMask, Phantom, Coinbase Wallet, Rabby), discovered via EIP-6963 with legacy flags as fallback.
import { WALLETS, type WalletDef } from '@shared/chain';
import { WalletSession, type WalletProvider } from './wallet-session';
export {walletFailureKey} from './wallet-session';

export interface Eip1193 extends WalletProvider {}
interface Announce { info: { rdns: string; name: string }; provider: Eip1193; }

const discovered = new Map<string, Eip1193>();   // rdns -> provider
let listening = false;
function listen(): void {
  if (listening) return; listening = true;
  window.addEventListener('eip6963:announceProvider', (e) => { const d = (e as CustomEvent<Announce>).detail; if (d?.info?.rdns && d.provider) discovered.set(d.info.rdns, d.provider); });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

function legacy(def: WalletDef): Eip1193 | null {
  const w = window as unknown as Record<string, unknown>;
  if (def.id === 'phantom') { const ph = w.phantom as { ethereum?: Eip1193 } | undefined; if (ph?.ethereum) return ph.ethereum; }
  if (def.id === 'coinbase' && w.coinbaseWalletExtension) return w.coinbaseWalletExtension as Eip1193;
  const eth = w.ethereum as (Eip1193 & { providers?: (Eip1193 & Record<string, unknown>)[] } & Record<string, unknown>) | undefined;
  if (!eth) return null;
  const list = eth.providers?.length ? eth.providers : [eth];
  return list.find((p) => p[def.flag] === true) ?? null;
}

export function providerFor(id: string): Eip1193 | null {
  listen();
  const def = WALLETS.find((w) => w.id === id); if (!def) return null;
  for (const r of def.rdns) { const p = discovered.get(r); if (p) return p; }
  return legacy(def);
}

/** Which of the four wallets are present in this browser. */
export function detectWallets(): { def: WalletDef; installed: boolean }[] {
  listen();
  return WALLETS.map((def) => ({ def, installed: !!providerFor(def.id) }));
}
export const hasWallet = (): boolean => detectWallets().some((w) => w.installed);

const session = new WalletSession();
let sessionWallet: string | null = null;
export function cancelWallet(): void { session.cancel(); sessionWallet = null; }
export async function connectAddress(walletId: string): Promise<string> {
  const p = providerFor(walletId); if (!p) throw new Error('no-wallet');
  sessionWallet = walletId;
  return session.connect(p);
}

export async function signMessageWith(walletId: string, address: string, message: string): Promise<string> {
  if (walletId !== sessionWallet) throw new Error('wallet-changed');
  return session.sign(address, message);
}

export const shortAddr = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;
