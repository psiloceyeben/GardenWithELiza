// Chain parameters shown to wallets. D-6: confirm every value from the official Robinhood Chain docs before mainnet.
// The client only ever asks a wallet for an address and a message signature; it never sends a transaction (I-1).
export const CHAIN = {
  id: 46630,                       // Robinhood Chain testnet (bible §6.3)
  hexId: '0xb626',
  name: 'Robinhood Chain Testnet',
  rpcUrls: [] as string[],         // [D-6] public RPC for wallet_addEthereumChain; empty = skip the add-chain prompt
  explorer: '',                    // [D-6]
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
};

/** The four wallets offered at sign-in. Discovered via EIP-6963 (rdns) with legacy window flags as fallback. */
export interface WalletDef { id: string; name: string; rdns: string[]; flag: string; url: string; }
export const WALLETS: WalletDef[] = [
  { id: 'metamask', name: 'MetaMask', rdns: ['io.metamask'], flag: 'isMetaMask', url: 'https://metamask.io/' },
  { id: 'phantom', name: 'Phantom', rdns: ['app.phantom'], flag: 'isPhantom', url: 'https://phantom.app/' },
  { id: 'coinbase', name: 'Coinbase Wallet', rdns: ['com.coinbase.wallet'], flag: 'isCoinbaseWallet', url: 'https://www.coinbase.com/wallet' },
  { id: 'rabby', name: 'Rabby', rdns: ['io.rabby'], flag: 'isRabby', url: 'https://rabby.io/' },
];

export const SIGN_STATEMENT = 'Pons Garden: prove you control this wallet to claim its garden. This signature is free and is not a transaction.';

export function signMessage(address: string, nonce: string, issuedAt: string): string {
  return `${SIGN_STATEMENT}\n\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nIssued: ${issuedAt}`;
}
