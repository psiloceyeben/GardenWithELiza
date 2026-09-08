# Wallet and reconnect verification

Run all commands on Box C in `/opt/pons` after copying current source.

```sh
node_modules/.bin/esbuild tools/wallet.test.ts --bundle --platform=node --outfile=/tmp/pons-wallet-test.cjs
node --test /tmp/pons-wallet-test.cjs
node_modules/.bin/esbuild tools/net.test.ts --bundle --platform=node --outfile=/tmp/pons-net-test.cjs
node --test /tmp/pons-net-test.cjs
npm --workspace server run build
npm --workspace server run test:wallet
npm run build
```

Verified: eight simulated provider checks, six simulated socket/timer checks,
five signed server race checks. These cover account changes before/during
signing, session cancellation/retry, malformed provider results, stale socket
events, duplicate connects, stopped reconnect timers, backoff, unlink/new nonce
during a read, replaced connections, concurrent wallet claims, nonce replay and
invalid signatures. No transactions are constructed or submitted.

Not yet proved: actual extension prompts, phone wallets, browser network-loss
recovery, persistence through identity handoff and crash, and production RPC
availability. Do not treat fixture test success as live-wallet verification.

The client transport now keeps only one current socket, cancels scheduled
reconnect on intentional close, ignores replaced-socket events, and immediately
marks intentional close disconnected. This applies to both renderers.
