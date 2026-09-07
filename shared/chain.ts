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

export const SIGN_STATEMENT = 'Pons Garden: prove you control this wallet to claim its garden. This signature is free and is not a transaction.';

export function signMessage(address: string, nonce: string, issuedAt: string): string {
  return `${SIGN_STATEMENT}\n\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nIssued: ${issuedAt}`;
}
