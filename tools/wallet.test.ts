import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { WalletSession, walletFailureKey } from '../client/src/wallet-session';
const A = '0x' + '1'.repeat(40), B = '0x' + '2'.repeat(40), signature = '0x' + '3'.repeat(130);
class Provider extends EventEmitter {
  account: unknown = [A]; methods: string[] = []; result: unknown = signature;
  signing?: () => Promise<unknown>;
  async request({ method }: { method: string }): Promise<unknown> {
    this.methods.push(method);
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return this.account;
    if (method === 'personal_sign') return this.signing ? this.signing() : this.result;
    throw new Error('Unexpected wallet method');
  }
}
test('one provider/account signs once, without network configuration or transactions', async () => {
  const p = new Provider(), s = new WalletSession();
  assert.equal(await s.connect(p), A); assert.equal(await s.sign(A, 'nonce'), signature);
  assert.deepEqual(p.methods, ['eth_requestAccounts', 'eth_accounts', 'personal_sign', 'eth_accounts']);
  assert.equal(p.listenerCount('accountsChanged'), 0); await assert.rejects(s.sign(A, 'nonce'), /wallet-changed/);
});
test('account change or disconnect before signing cancels the session', async () => {
  for (const event of ['accountsChanged', 'disconnect']) {
    const p = new Provider(), s = new WalletSession(); await s.connect(p); p.emit(event, [B]);
    await assert.rejects(s.sign(A, 'nonce'), /wallet-changed/); assert(!p.methods.includes('personal_sign'));
  }
});
test('silent account switch is detected even when provider omits events', async () => {
  const p = new Provider(), s = new WalletSession(); await s.connect(p); p.account = [B];
  await assert.rejects(s.sign(A, 'nonce'), /wallet-changed/); assert(!p.methods.includes('personal_sign'));
});
test('account switch while signature prompt is open discards the returned signature', async () => {
  const p = new Provider(), s = new WalletSession(); await s.connect(p);
  p.signing = async () => { p.account = [B]; p.emit('accountsChanged', [B]); return signature; };
  await assert.rejects(s.sign(A, 'nonce'), /wallet-changed/);
});
test('silent account switch during signing and malformed signatures are rejected', async () => {
  const p = new Provider(), s = new WalletSession(); await s.connect(p);
  p.signing = async () => { p.account = [B]; return signature; };
  await assert.rejects(s.sign(A, 'nonce'), /wallet-changed/);
  p.signing = undefined; p.account = [A]; p.result = 'bad'; await s.connect(p);
  await assert.rejects(s.sign(A, 'nonce'), /invalid-wallet-signature/);
});
test('cancellation while account permission is pending cannot resurrect a session', async () => {
  let complete!: (v: unknown) => void;
  const s = new WalletSession();
  const connecting = s.connect({ request: () => new Promise(resolve => { complete = resolve; }) });
  s.cancel(); complete([A]); await assert.rejects(connecting, /wallet-changed/);
});
test('rejected signature cleans up and permits a fresh attempt', async () => {
  const p = new Provider(), s = new WalletSession(); await s.connect(p);
  p.signing = async () => { throw new Error('User rejected'); };
  await assert.rejects(s.sign(A, 'nonce'), /rejected/); assert.equal(p.listenerCount('disconnect'), 0);
  p.signing = undefined; await s.connect(p); assert.equal(await s.sign(A, 'new nonce'), signature);
});
test('malformed account responses are rejected', async () => {
  for (const value of [null, [], [123], ['not-an-address']]) {
    const p = new Provider(), s = new WalletSession(); p.account = value;
    await assert.rejects(s.connect(p), /no-account/);
  }
});
test('wallet feedback distinguishes structured cancellation and session changes without exposing provider text',()=>{
  assert.equal(walletFailureKey({code:4001,message:'arbitrary provider text'}),'walletCancelled');
  assert.equal(walletFailureKey(new Error('wallet-changed')),'walletChanged');
  for(const error of [null,undefined,'rejected',{code:4900},{code:'4001'},new Error('invalid-wallet-signature')])assert.equal(walletFailureKey(error),null);
});
