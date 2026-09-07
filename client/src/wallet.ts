// Read-only wallet connect (bible I-1/I-2). The wallet is asked for exactly two things: an address and a
// personal_sign of our nonce message. No transaction, approve, transfer, or claim flow exists in this client.
import { CHAIN } from '@shared/chain';

interface Eip1193 { request(args: { method: string; params?: unknown[] }): Promise<unknown>; }
const provider = (): Eip1193 | null => (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;

export const hasWallet = (): boolean => !!provider();

export async function connectAddress(): Promise<string> {
  const p = provider(); if (!p) throw new Error('no-wallet');
  const accounts = await p.request({ method: 'eth_requestAccounts' }) as string[];
  const address = (accounts?.[0] ?? '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('no-account');
  // best effort: put the wallet on Robinhood Chain so its view matches ours. Never blocks; derivation is server-side by address.
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hexId }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code === 4902 && CHAIN.rpcUrls.length) {
      try { await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN.hexId, chainName: CHAIN.name, rpcUrls: CHAIN.rpcUrls, nativeCurrency: CHAIN.nativeCurrency, blockExplorerUrls: CHAIN.explorer ? [CHAIN.explorer] : [] }] }); } catch { /* user declined; fine */ }
    }
  }
  return address;
}

export async function signMessageWith(address: string, message: string): Promise<string> {
  const p = provider(); if (!p) throw new Error('no-wallet');
  return await p.request({ method: 'personal_sign', params: [message, address] }) as string;
}

export const shortAddr = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;
