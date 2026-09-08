/** A sign-in attempt is bound to one provider and one account, not rediscovery. */
export interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}
/** Map only structured rejection codes and our own session error, never raw provider copy. */
export function walletFailureKey(error:unknown):'walletCancelled'|'walletChanged'|null {
  if(error && typeof error==='object' && 'code' in error && error.code===4001)return 'walletCancelled';
  if(error instanceof Error && error.message==='wallet-changed')return 'walletChanged';
  return null;
}
function firstAccount(value: unknown): string {
  const address = Array.isArray(value) && typeof value[0] === 'string' ? value[0].toLowerCase() : '';
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('no-account');
  return address;
}
export class WalletSession {
  private provider: WalletProvider | null = null;
  private address: string | null = null;
  private generation = 0;
  private changed = () => this.cancel();
  cancel(): void {
    this.generation++;
    this.provider?.removeListener?.('accountsChanged', this.changed);
    this.provider?.removeListener?.('disconnect', this.changed);
    this.provider = null; this.address = null;
  }
  async connect(provider: WalletProvider): Promise<string> {
    this.cancel(); this.provider = provider; const generation = this.generation;
    try {
      const address = firstAccount(await provider.request({ method: 'eth_requestAccounts' }));
      if (this.generation !== generation) throw new Error('wallet-changed');
      this.address = address;
      provider.on?.('accountsChanged', this.changed);
      provider.on?.('disconnect', this.changed);
      // Chain switching is unnecessary for message signing; chain reads are server-side.
      return address;
    } catch (error) { if (this.generation === generation) this.cancel(); throw error; }
  }
  async sign(address: string, message: string): Promise<string> {
    const provider = this.provider; const generation = this.generation;
    if (!provider || address.toLowerCase() !== this.address) throw new Error('wallet-changed');
    const current = () => {
      if (this.generation !== generation) throw new Error('wallet-changed');
    };
    try {
      const before = firstAccount(await provider.request({ method: 'eth_accounts' })); current();
      if (before !== this.address) throw new Error('wallet-changed');
      const signature = await provider.request({ method: 'personal_sign', params: [message, this.address] }); current();
      const after = firstAccount(await provider.request({ method: 'eth_accounts' })); current();
      if (after !== this.address) throw new Error('wallet-changed');
      if (typeof signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(signature)) throw new Error('invalid-wallet-signature');
      return signature;
    } finally { if (this.generation === generation) this.cancel(); }
  }
}
