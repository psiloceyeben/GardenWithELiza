// node server/dist/server/src/tests/derive.test.js
import assert from 'node:assert/strict';
import { deriveGarden, guestGarden, addressHash, BIOME_COUNT } from '../../../shared/derive';
import { FIXTURES } from '../../../shared/derive/fixtures';
import { MockReader, CachedReader } from '../../../chain-reader/src';
import { signForTest, verifySignature, recoverAddress } from '../sig';
import { signMessage } from '../../../shared/chain';

let n = 0;
const ok = (c: boolean, what: string) => { n++; if (!c) { console.error(`FAIL: ${what}`); process.exitCode = 1; } else console.log(`ok: ${what}`); };

// derive: fixtures
for (const f of FIXTURES) {
  const g = deriveGarden(f.snapshot.address, f.snapshot);
  const { biome, address, ...rest } = g;
  ok(JSON.stringify(rest) === JSON.stringify(f.expect), `derive ${f.name}`);
  ok(address === f.snapshot.address && biome >= 0 && biome < BIOME_COUNT, `derive ${f.name}: address + biome range`);
  const again = deriveGarden(f.snapshot.address.toUpperCase(), f.snapshot);
  ok(JSON.stringify(again) === JSON.stringify(g), `derive ${f.name}: deterministic + case-insensitive`);
}
ok(guestGarden().plotCount === 10, 'guest garden has 10 plots');
ok(addressHash('0xabc') === addressHash('0xABC'), 'addressHash case-insensitive');
// stock decor never touches gameplay (I-3)
{
  const a = FIXTURES[1].snapshot; const b = { ...a, stockDecor: { brokerNfts: 9, stockTokenKinds: 9, drops: 99 } };
  const ga = deriveGarden(a.address, a); const gb = deriveGarden(a.address, b);
  ok(ga.plotCount === gb.plotCount && ga.rarityFloor === gb.rarityFloor && ga.treeStage === gb.treeStage && ga.hybridsUnlocked === gb.hybridsUnlocked, 'I-3: stock decor changes no gameplay value');
  ok(gb.decorFlora > ga.decorFlora, 'stock decor changes only decorFlora');
}

// mock reader: stable + fixture passthrough + cache
(async () => {
  const r = new CachedReader(new MockReader(), 60_000);
  const s1 = await r.snapshot('0x1234567890abcdef1234567890abcdef12345678'); const s2 = await r.snapshot('0x1234567890ABCDEF1234567890ABCDEF12345678');
  ok(s1 !== s2 && JSON.stringify(s1) === JSON.stringify(s2), 'cached reader returns isolated equal snapshots within TTL');
  const fx = await r.snapshot(FIXTURES[2].snapshot.address);
  ok(fx.stakeTime === FIXTURES[2].snapshot.stakeTime, 'mock reader serves fixture wallets');

  // signature: sign with a throwaway key, verify, reject tampering
  const priv = '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
  const msg = signMessage('0x0000000000000000000000000000000000000000', 'nonce123', '2026-09-07T00:00:00Z');
  const { address, signature } = signForTest(msg, priv);
  ok(address === '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23', `signForTest derives the known address (${address})`);
  ok(verifySignature(msg, signature, address), 'valid signature verifies');
  ok(!verifySignature(msg + '!', signature, address), 'tampered message rejected');
  ok(!verifySignature(msg, signature, '0x0000000000000000000000000000000000000001'), 'wrong address rejected');
  ok(recoverAddress(msg, '0x1234') === null, 'malformed signature -> null');
  console.log(process.exitCode ? `\n${n} checks, FAILURES above` : `\nALL ${n} PASS`);
})();
