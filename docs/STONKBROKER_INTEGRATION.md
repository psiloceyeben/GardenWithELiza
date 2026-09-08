# Connecting Pons Garden to StonkBrokers and Robinhood Chain

What the connection is, what it is not, what you have to supply, where each value goes, and how to prove it works.
Written against the code as of 2026-09-08. Bible references are to `PONS_GARDEN_BIBLE.md`.

Implementation update: see `CHAIN_READER.md` for the current finalized-block reader
and configuration. Broker ownership/TBA/stock-kind reads are now implemented;
drop-history reads and live end-to-end verification remain incomplete. Do not
deploy from this document without the production-readiness review.

---

## 1. The shape of the connection in one paragraph

The game never talks to StonkBrokers as a service. It reads public state from Robinhood Chain through an RPC endpoint
and turns one wallet's history into that wallet's land. Two contracts matter for gameplay-adjacent land: the PONS
token (plots, rarity floor, conviction tree, wither-marks) and an allowlist of partner meme tokens (hybrid seeds).
Two more matter for decoration only: the StonkBrokers broker NFT and the token-bound accounts that hold stock tokens.
Nothing flows back. The game constructs no transactions, holds no assets, and links to no referral system. That is
invariants I-1 through I-7, and the code is built so it cannot do otherwise: the chain reader can only issue
`eth_call`, `eth_getLogs`, `eth_chainId` and `eth_getBlockByNumber`, and any other method throws.

## 2. How it works, step by step

**Player side.**
1. A player opens the Land panel or the sign-in screen and picks one of four wallets: MetaMask, Phantom, Coinbase Wallet or Rabby.
2. The wallet is asked for an address (`eth_requestAccounts`). No network switch
   is requested: chain reads happen on the server. The sign-in attempt retains
   that exact provider and checks `eth_accounts` before and after signing.
3. The server issues a one-time nonce. The wallet signs a plain-text message containing it (`personal_sign`). This is free and is not a transaction.
4. The server recovers the signer from the signature (EIP-191, `server/src/sig.ts`) and only then links the address to the player. If the address already owns a garden, this device becomes that player: wallet sign-in.

Account-change/disconnect events cancel the client attempt; a changed account or
malformed signature cannot complete it. The attempt is single-use, and socket
disconnect/unlink cancels it in both renderers. Missing nonce responses time out
after 30 seconds. This uses [EIP-1193 provider events](https://eips.ethereum.org/EIPS/eip-1193).
Eight simulated-provider tests in `tools/wallet.test.ts` pass on Box C; they are
not a substitute for real extension and phone-wallet tests. Five signed server
tests (`npm --workspace server run test:wallet`, after building on Box C) now
cover unlink during a read, same-ID reconnect, a superseding nonce, simultaneous
claims, and nonce replay/invalid signatures. Async completion requires the exact
live connection and sign-in revision; ownership is rechecked after the read.
An isolated browser identity-handoff check now passes: a simulated MetaMask
provider signs with a generated test key through the real nonce/signature path,
and the guest browser reloads into an existing wallet-owned garden with its
plant, nickname, Sap and wardrobe preserved across a further reload. This exposed
and fixed Land-panel wallet handlers being lost when plant HTML was appended.
Box C evidence: `/tmp/pons-wardrobe-browser-on0KAh`. Only eth_requestAccounts,
eth_accounts and personal_sign were invoked. This is not real-extension,
phone-wallet or live-chain verification; the existing-owner path does not prove
a new wallet's RPC-derived landscape.

First-time linking now also has a signed browser integration check using the
deterministic MockReader: `/tmp/pons-wardrobe-browser-KtFHvV` verifies derived
private/public land, expanded plots, 3D tree/decor models, crop preservation,
reload, unlink and another reload. This confirms the application wiring; it
does not validate deployed contracts, provider history or real wallet extensions.

Rejection/retry and EIP-6963 discovery browser coverage now passes for all four
supported provider identifiers. No legacy window flags are present in these
fixtures. The first personal_sign rejects; guest identity, crop, 1000 Sap and ten
plots remain unchanged. A second button click without reload obtains a signature,
derives mock land, updates the 3D tree/decor, reconnects and unlinks successfully.
Box C runs: MetaMask `/tmp/pons-wardrobe-browser-zKrIOD`, Phantom
`/tmp/pons-wardrobe-browser-NOjm1j`, Coinbase `/tmp/pons-wardrobe-browser-ZKxMAc`,
Rabby `/tmp/pons-wardrobe-browser-SevyNa`; all zero page errors and exit 0.
These simulate announced providers with generated test keys. They do not test
installed extensions, extension approval windows or physical phone wallets.
Cancellation feedback follow-up: both renderers now map structured provider code
4001 to "Wallet sign-in cancelled. Your garden is unchanged." Internal session
account/disconnect changes receive a separate restart-sign-in message; malformed
signatures retain the controlled failure text. Raw provider messages are never
displayed. Box C `/tmp/pons-regression-qiie3u` passes (111 server tests, all 21
tool-test files including nine wallet-session tests, compilation/copy lint).
Browser `/tmp/pons-wardrobe-browser-s13wi7` confirms the exact cancellation toast,
unchanged guest state, retry and new-wallet linking/reload/unlink. This browser
check exercises signature rejection in Wander mode, not every renderer/provider
permission-denial variant. No production deployment.

**Server side.**
5. The chain reader (`chain-reader/src/index.ts`) builds a `ChainSnapshot` for the address: PONS balance, stake time as the balance-times-days integral over Transfer logs, hold streak since the last balance decrease, unstake events of 20% or more, wallet age, allowlisted meme-token balances, and decoration counts.
6. `deriveGarden` (`shared/derive/index.ts`) turns the snapshot into a `GardenSpec`: plot count on the ladder 10, 12, 14, 16, 18, 20; rarity floor from the hold streak; biome from a hash of the address; conviction tree stage from stake time; one wither-mark per qualifying unstake; hybrids unlocked when two or more allowlisted tokens are held; decorative flora count from the broker and stock decoration counts.
7. The lot re-tiles in the wallet's biome, grows the tree, plants the stumps, and the conveyor rerolls with the new floor. Plots never shrink under planted crops. Snapshots are cached per address for five minutes.
8. The share page at `/ponsgarden/garden/<address>` renders any address on the chain, linked or not, from the same function. Anyone could rebuild every garden from public data. Document that as a feature.

**What the stock layer does.** Broker NFTs and stock tokens are counted, never priced or itemised, and the count draws
exotic flora outside the fence. The unit test `I-3: stock decor changes no gameplay value` proves that changing those
counts changes nothing but the flora count. Keep that test green forever.

## 3. What you need to supply (decision D-6)

| Item | Where it comes from | Where it goes |
|---|---|---|
| RPC endpoint with your Alchemy key | Alchemy dashboard, app on Robinhood Chain testnet 46630 now, mainnet later | `PONS_RPC_URL` in the service unit on Box C. Never in the repo, never in chat. |
| PONS token contract address | Your launch config (Stonk Launcher), or a testnet mock | `PONS_TOKEN` |
| PONS deployment block | Explorer, first block of the contract | `PONS_FROM_BLOCK` (log scan starts here; lower is slower, wrong-high misses history) |
| PONS decimals | Contract, usually 18 | `PONS_DECIMALS` |
| Partner meme-token allowlist | Your ecosystem list, symbol and address pairs. Must contain no stock tokens and no broker NFTs (I-3, §2.1). | `PONS_ECOSYSTEM=STONKBROKER:0x…,DERP:0x…` |
| Chain ID | Official chain docs | `PONS_CHAIN_ID`; checked against RPC. Transfer times now use actual block timestamps, not `PONS_BLOCK_TIME`. |
| StonkBrokers broker NFT contract | StonkBrokers docs and verified collection ABI | `PONS_BROKER_NFT` and `PONS_BROKER_FROM_BLOCK`; see §6 |
| ERC-6551 account resolution | Verified collection's `tokenWallet` and `predictWallet` views | Read directly; separate registry/implementation configuration is not needed |
| Chain parameters for the wallet prompt | Official Robinhood Chain docs | `shared/chain.ts` `CHAIN.rpcUrls` and `CHAIN.explorer`, then rebuild the client |

## 4. Exactly what to do, in order

1. Create the Alchemy app and copy the HTTPS URL.
2. Collect the addresses in the table above.
3. Edit the service unit on Box C:

```bash
ssh root@89.167.7.54 nano /etc/systemd/system/pons-server.service
```

Add under the existing `Environment=` lines:

```
Environment=PONS_RPC_URL=https://…alchemy.com/v2/YOURKEY
Environment=PONS_TOKEN=0xYOUR_PONS_CONTRACT
Environment=PONS_FROM_BLOCK=123456
Environment=PONS_DECIMALS=18
Environment=PONS_CHAIN_ID=YOUR_VERIFIED_CHAIN_ID
Environment=PONS_ECOSYSTEM=STONKBROKER:0xADDR1,DERP:0xADDR2
```

4. Restart and confirm the reader switched from mock to rpc:

```bash
ssh root@89.167.7.54 "systemctl daemon-reload && systemctl restart pons-server && sleep 2 && curl -s http://127.0.0.1:8130/health"
```

The health line must read `"reader":"cached(rpc-worker)"`. Partial RPC configuration now
fails startup. This label alone does not prove a successful on-chain snapshot.

5. Prove it with a wallet you know:

```bash
curl -s https://prometheus7.com/ponsgarden/garden/0xTHEADDRESS | grep -o 'og:description" content="[^"]*'
```

The plot count and tree stage should match what that wallet's history deserves.

6. Sign in with that wallet in the game and confirm the lot re-tiles and the Land panel shows the same numbers.

## 5. What the connection must never become

- No approve, transfer, buy, sell, wrap, claim, deposit or bridge flow, for any asset, ever, in v1 (I-1, I-2, I-7).
- No Sap-to-token path and no token emitted as a reward (I-6).
- No referral parameters on any link (I-5). The only outbound links in the client are the four wallet install pages.
- No stock token, broker NFT, or company theme affecting plots, odds, yield, matchmaking or any number (I-3, I-9).
- No copy that references stock yield, dividends, activating a broker, or acquiring any StonkBrokers asset (I-4). The lint in `tools/lint-copy.js` fails the build on it and also scans the lore corpus and NPC lines.
- If PONS launches on Stonk Launcher, pair against ETH or $STONKBROKER only (I-8).

Changing any of these needs your sign-off and securities counsel's, per §0.

## 6. What is still a stub, and what finishing it takes

- **Broker NFT and stock decoration read.** Implemented in `chain-reader/src/broker.ts`,
  opt-in through `PONS_BROKER_NFT` and `PONS_BROKER_FROM_BLOCK`. It reconstructs
  direct ownership from Transfer logs (the collection is not ERC721Enumerable),
  reconciles balanceOf/ownerOf, compares tokenWallet with predictWallet, discovers
  the collection's stockTokenCount/stockTokenAt list, and counts distinct positive
  balances in the user's wallet and owned TBAs. It rejects those contracts in
  the PONS/ecosystem configuration. All calls use the snapshot's pinned block.
  Vault-held collateral/delegation is not represented as direct NFT ownership.
  No tickers, prices, account addresses or token IDs enter the game snapshot.
  Drop counts remain unavailable (zero), not inferred from arbitrary transfers.
- **Contract evidence.** The [published mainnet collection](https://www.stonkbrokers.io/docs)
  is `0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0` on chain 4663.
  The read ABI and `predictWallet` implementation were inspected through the
  [explorer's verified source endpoint](https://robinhoodchain.blockscout.com/api/v2/smart-contracts/0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0).
  No contract address is enabled in production. Deployment-block discovery,
  full known-wallet scans and received-drop semantics still need verification.
- **Public endpoint smoke check (Box C, 2026-09-08).**
  `node tools/check_broker_views.cjs` verified chain ID 4663 and obtained finalized
  head `0x36acd3a`, but its contract read failed with provider code `-32000`,
  `metadata is not found, 57331005`. This is evidence of an unsuccessful
  historical-state read, not a verified integration or a contract defect.
  An archive-capable provider must pass this check and full history verification
  before rollout. The reader deliberately does not fall back to unpinned latest.
- **WalletConnect.** Phone wallets need a WalletConnect project id. Everything else is in place.
- **Mainnet parameters.** Chain id, RPC and explorer in `shared/chain.ts` are testnet placeholders until the official docs are confirmed.

## 7. Where to look in the code

- `shared/derive/` derivation, constants, fixtures, and the tests that lock the invariants.
- `chain-reader/src/index.ts` mock, RPC and cached readers, and the read-only method guard.
- `server/src/sig.ts` signature recovery; `server/src/game.ts` `onNonce`, `onLink`, `applyGarden`.
- `client/src/wallet.ts` the four-wallet picker and the two wallet calls the client is allowed to make.
- `share/render.ts` and the `/garden/` route in `server/src/index.ts` for share pages.
