# Ben's setup guide: switching Pons Garden onto the real chain

This is the owner's checklist. Every step is something only you can do, in the order
to do it. Engineering is finished on this side; the code is waiting for these values.
`STONKBROKER_INTEGRATION.md` is the technical companion if you want the reasoning.

**Time:** about an hour, most of it waiting on an RPC provider.
**Risk:** low. Everything here is read-only. Nothing you do can move a token.

---

## What you are actually turning on

Right now the game invents each wallet's garden from a fake chain reader, so every
address gets a plausible but made-up history. Turning on the real chain makes the
game read Robinhood Chain and draw each wallet's true history as land: plots from how
long PONS was held, the rarity floor from the current hold streak, the conviction tree
from total time held, a withered stump for every big past sell, and decorative flora
from StonkBroker NFTs and the stock tokens in their token-bound accounts.

The game never signs a transaction. It asks a wallet for its address and one free
message signature, and that is the entire extent of what it can do. There is no code
path that could transfer, approve, buy or claim anything, and the stock layer cannot
touch a single gameplay number. A test enforces that on every build.

---

## Step 1 — Get an archive-capable RPC endpoint

This is the one thing that has already failed once, so do it carefully.

The game reads history at a **pinned past block**, not at "latest". An ordinary RPC
node throws away old state and answers `metadata is not found` — which is exactly what
happened when this was tried on 2026-09-08 against the public endpoint. You need a
provider that keeps archive state for Robinhood Chain.

1. Open your provider (Alchemy, or whoever serves Robinhood Chain).
2. Create an app on **Robinhood Chain**. Use the testnet first if one is offered;
   mainnet is chain ID **4663**.
3. Confirm with them, in writing if you can, that the endpoint is **archive** or
   supports historical `eth_call`. If they only offer "full" nodes, the broker
   decoration will not work and you should say so before we enable it.
4. Copy the HTTPS URL. It contains your key. Do not paste it into chat, a document,
   or the repository. It goes in one place: the service file in step 4.

## Step 2 — Collect five values

Write these down somewhere private. You need all of them before step 4.

| Value | Where to find it |
|---|---|
| **PONS token contract address** | Your launch configuration. If PONS is not deployed yet, deploy a test token or skip to the "testnet first" note below. |
| **PONS deployment block** | The block explorer, on the contract's page: the block of the contract-creation transaction. |
| **PONS decimals** | The contract. Almost always `18`. |
| **Partner meme-token allowlist** | Your own list of ecosystem tokens, as `SYMBOL:0xaddress` pairs. **This list must not contain a single stock token or the broker NFT.** Holding two or more of these unlocks hybrid seeds. |
| **Chain ID** | `4663` for Robinhood Chain mainnet. The game checks this against the RPC and refuses to start if they disagree. |

The StonkBroker collection is already known and does not need looking up:
`0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0`. You only need its **deployment block**
from the explorer, the same way as the PONS one.

**Testnet first.** If you would rather rehearse, do all of this against the testnet
with any ERC-20 you control standing in for PONS. The switch to mainnet later is the
same six lines with different values.

## Step 3 — Decide two policy questions

Neither is technical, both are yours.

1. **Do broker holdings show as scenery?** They are decoration only, outside the fence,
   with no effect on any number. If you would rather not depict the stock layer at all
   until counsel has reviewed the shipping build, simply leave the two broker lines out
   in step 4 and everything else still works.
2. **Which chain do you launch on?** If PONS lists on Stonk Launcher, it must pair
   against ETH or $STONKBROKER and nothing else. That is invariant I-8 and it is not
   a preference.

## Step 4 — Put the values on the server

One file, six to eight lines. Run this on your machine:

```bash
ssh root@89.167.7.54 nano /etc/systemd/system/pons-server.service
```

Find the block of lines that begin with `Environment=` and add these underneath,
substituting your values:

```
Environment=PONS_RPC_URL=https://YOUR-ARCHIVE-ENDPOINT
Environment=PONS_TOKEN=0xYOUR_PONS_CONTRACT
Environment=PONS_FROM_BLOCK=YOUR_DEPLOYMENT_BLOCK
Environment=PONS_DECIMALS=18
Environment=PONS_CHAIN_ID=4663
Environment=PONS_ECOSYSTEM=STONKBROKER:0xADDR1,DERP:0xADDR2
```

Then, only if you said yes to broker scenery in step 3:

```
Environment=PONS_BROKER_NFT=0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0
Environment=PONS_BROKER_FROM_BLOCK=THAT_CONTRACTS_DEPLOYMENT_BLOCK
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

A half-filled configuration is refused on purpose: the server will not start rather
than quietly fall back to invented data. If it will not come up, a value is missing
or malformed.

## Step 5 — Restart and check the reader switched

```bash
ssh root@89.167.7.54 "systemctl daemon-reload && systemctl restart pons-server && sleep 3 && curl -s http://127.0.0.1:8130/health"
```

Look at the `reader` field in the reply.

- `cached(rpc-worker)` — the real chain is on. Continue.
- `cached(mock)` — a value is missing. Recheck step 4.
- No reply at all — the configuration was rejected. Run
  `ssh root@89.167.7.54 "journalctl -u pons-server -n 20"` and read the last lines.

Then confirm the configuration report agrees:

```bash
ssh root@89.167.7.54 "cd /opt/pons && node tools/deployment-config-report.cjs --service=pons-server.service"
```

Every group should say present. The report never prints your key.

If you enabled the broker lines, also run:

```bash
ssh root@89.167.7.54 "cd /opt/pons && node tools/check_broker_views.cjs"
```

This is the check that failed on the public endpoint. If it fails again with
`metadata is not found`, your endpoint is not archive-capable: go back to step 1.
Nothing else is wrong.

## Step 6 — Prove it with a wallet you know

Pick a wallet whose PONS history you can vouch for, and open its garden as a page.
No sign-in needed; every address on the chain has one.

```bash
curl -s https://prometheus7.com/ponsgarden/garden/0xTHEADDRESS | grep -o 'og:description" content="[^"]*'
```

You will get a line like `16 plots · rare floor · flowering conviction tree · 2 wither-marks`.
Check it against what you know: a long holder should have many plots and a grown tree,
and someone who sold heavily should have stumps.

Then do it as a player: open https://prometheus7.com/ponsgarden/, click **land**,
choose your wallet, approve the account request and sign the message. Your garden
should re-tile into its own palette, grow its tree, and show the same numbers.

**If the numbers look wrong**, the most common cause is `PONS_FROM_BLOCK` being too
high, which silently hides history before that block. Set it to the real deployment
block and restart.

## Step 7 — Phone wallets, when you want them

Phantom and the rest work on a desktop browser today because the extension announces
itself to the page. Phones need WalletConnect, which needs a free project id from
`https://cloud.walletconnect.com`. Send that id when you have it and it gets wired in;
until then, phone players use the game as guests, which is the full game minus the
derived land.

---

## What you should not do, ever

- Do not paste the RPC URL, or any key, into a chat, a commit, or a document.
- Do not put a stock token or the broker NFT into `PONS_ECOSYSTEM`. That list feeds
  gameplay; the stock layer must stay decoration.
- Do not let anyone add a buy, sell, claim, transfer or referral link to the game.
  That is the line the whole design is built to hold.

## Where you are afterwards

With steps 1 to 6 done, the chain half of the bible's M2 is finished and real, and the
only outstanding items are the roster cut, counsel's review of the shipping build, and
the release decisions. Nothing else in the game is waiting on you.
