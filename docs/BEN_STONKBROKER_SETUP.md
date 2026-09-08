# Turning on the chain: what you are doing, and why

Plain language. No jargon that is not explained. `STONKBROKER_INTEGRATION.md` is the
technical version if you ever want it.

---

## 1. The whole idea in one paragraph

Pons Garden reads your wallet's public history and **draws it as your land**. It does
not buy, sell, hold, move or touch anything. It reads, the way anyone can read a block
explorer, and turns what it reads into the shape of your garden. A long-time holder
gets a big garden with a grown tree. Somebody who sold heavily gets dead stumps along
their fence that never go away. That is the entire connection.

Right now the game is making all of this up. There is a stand-in reader that invents a
plausible history for any address so we could build and test the feature. Everything
you are about to do replaces that invention with the truth.

## 2. What actually changes in the game

This is the part worth understanding, because it is the reason to bother at all.

| What the chain says about a wallet | What that player sees in the game |
|---|---|
| How long they have held PONS, added up over time | **How many plots they get.** Everyone starts at 10. Long holders grow to 12, 14, 16, 18, and 20 at the top. |
| How long since they last sold any | **Their rarity floor**: the worst seed the shop is allowed to offer them. A 90-day streak means no more Common seeds, ever. |
| Total time held, again | **The conviction tree** in their garden's corner. It grows seedling, sapling, mature, flowering, fruiting. |
| Every past sell of a fifth or more of their holdings | **A dead stump** on their fence line. Permanent. One per sell. Everyone who walks past can see them. |
| Holding two or more of your partner meme coins | **Hybrid seeds** unlock: two extra plant species appear in their shop. |
| StonkBroker NFTs and the stock tokens inside them | **Strange glowing plants outside the fence.** Scenery. They do nothing at all. |
| Their address, hashed | **Which of eight colour palettes** their garden wears. |

Two things to hold onto:

**Land cannot be stolen; plants can.** Your plot count, your tree, your stumps, your
palette are permanently yours. The plants growing in those plots are what neighbours
sneak in and steal. That split is the whole design: your history is fixed, your
afternoon is chaos.

**The stock layer changes no number.** Broker NFTs and stock tokens only ever add
decorative plants outside the fence. They cannot affect plots, odds, yield, or anything
a player competes over. There is an automated test that fails the build if anyone ever
makes them matter. That is deliberate and it is the legal spine of the whole project.

## 3. What you are actually doing

Six values go into one file on the server. That is it. There is no wallet to connect,
no transaction to sign, no money to spend, and nothing you do here can move an asset.

Think of it as giving the game a library card and telling it which shelf to read.

## 4. The steps, and why each one exists

### Step 1 — Get an "archive" RPC endpoint

**What an RPC endpoint is:** a service that answers questions about the blockchain.
"What is this wallet's balance?" "What happened in block 12,345?" The game needs one
because it cannot read the chain by itself.

**Why it must be "archive":** most endpoints only remember the recent past. The game
does not want today's balance; it wants to *replay the whole history* of a wallet to
work out how long they held and when they sold. That means asking about old blocks. An
ordinary endpoint answers "I threw that away." An archive endpoint kept it.

**This has already failed once.** On 8 September the public endpoint was tried and it
returned `metadata is not found`, which is exactly this problem. So: when you set up
the app with your provider, confirm with them that it is archive-capable for Robinhood
Chain. If they only offer standard nodes, tell me before we go further, because the
broker decoration will not work on one.

**What you do:** create an app on Robinhood Chain at your provider, mainnet chain ID
4663, and copy the HTTPS URL. That URL contains your private key, so it goes into one
place only, in step 4. Never into a chat, a document or the code.

### Step 2 — Collect five facts

Each one answers a question the game has to ask.

**The PONS contract address.** *Which coin am I reading?* Without it the game does not
know what to look at. From your launch setup.

**Its deployment block.** *Where do I start reading?* The game replays history forward
from a starting point. Set it to the block where the coin was created. If you set it
too high, everything before that is invisible and long holders look like newcomers with
small gardens. This is the single most common way to get wrong-looking results.

**Its decimals.** *How do I read these numbers?* Token amounts are stored as big
integers; decimals says where the decimal point goes. Nearly always 18. Get it wrong
and every quantity is off by a factor of a trillion.

**The partner meme-coin list.** *Which coins unlock hybrid seeds?* You write it as
`SYMBOL:0xaddress` pairs. Holding two or more of them puts the Melonhound and the
Cactusberry Vicar in that player's shop. **No stock token and no broker NFT may ever
appear in this list**, because this list feeds gameplay and that layer must stay
decorative.

**The chain ID, 4663.** *Am I talking to the right chain?* The game asks the endpoint
what chain it is and refuses to start if the answer disagrees. It is a seatbelt against
pointing at the wrong network and drawing everyone nonsense gardens.

You do not need to look up the StonkBroker collection; we already have it at
`0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0`. You only need its deployment block from
the explorer, for the same reason as the PONS one.

### Step 3 — Two decisions only you can make

**Do broker holdings show up as scenery?** They are harmless decoration, but they do
depict the stock layer. If you would rather wait until counsel has seen the shipping
build, just leave the two broker lines out in step 4. Everything else works without
them.

**If PONS lists on Stonk Launcher, what does it pair against?** ETH or $STONKBROKER,
and nothing else. Never against a tokenised stock. That is a rule in the bible, not a
preference.

### Step 4 — Put the values on the server

One file. Open it:

```bash
ssh root@89.167.7.54 nano /etc/systemd/system/pons-server.service
```

Find the lines that start with `Environment=` and add these below them, with your
values swapped in:

```
Environment=PONS_RPC_URL=https://YOUR-ARCHIVE-ENDPOINT
Environment=PONS_TOKEN=0xYOUR_PONS_CONTRACT
Environment=PONS_FROM_BLOCK=YOUR_DEPLOYMENT_BLOCK
Environment=PONS_DECIMALS=18
Environment=PONS_CHAIN_ID=4663
Environment=PONS_ECOSYSTEM=STONKBROKER:0xADDR1,DERP:0xADDR2
```

And only if you said yes to scenery:

```
Environment=PONS_BROKER_NFT=0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0
Environment=PONS_BROKER_FROM_BLOCK=THAT_CONTRACTS_DEPLOYMENT_BLOCK
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

**Why a file on the server and not the code:** the RPC URL is a secret. Anything in the
code ends up in the repository and in backups. This file sits on one machine, readable
only by root, and the running game reads it at startup.

**Why half-filled is refused:** if you set the URL but forget the token address, the
game will not start. It used to quietly fall back to invented data, which is worse than
being down, because you would think it was real. Now it stops and tells you.

### Step 5 — Restart, and check it switched

```bash
ssh root@89.167.7.54 "systemctl daemon-reload && systemctl restart pons-server && sleep 3 && curl -s http://127.0.0.1:8130/health"
```

Look at the `reader` field in the answer:

- `cached(rpc-worker)` — the real chain is on. **This is what you want.**
- `cached(mock)` — still inventing. A value is missing; recheck step 4.
- nothing comes back — the configuration was rejected. Read the reason with
  `ssh root@89.167.7.54 "journalctl -u pons-server -n 20"`.

*(The word "cached" just means it remembers each wallet for five minutes instead of
re-reading the chain every time somebody walks past. "Worker" means the reading happens
off to the side so the game never stutters while it works.)*

If you turned on the broker lines, also run this, which is the check that failed before:

```bash
ssh root@89.167.7.54 "cd /opt/pons && node tools/check_broker_views.cjs"
```

If it says `metadata is not found` again, your endpoint is not archive-capable. Nothing
else is wrong; go back to step 1.

### Step 6 — Prove it with a wallet whose story you know

Every address on the chain has a garden page, whether or not anyone plays. Pick a wallet
you know the history of:

```bash
curl -s https://prometheus7.com/ponsgarden/garden/0xTHEADDRESS | grep -o 'og:description" content="[^"]*'
```

You get back something like `16 plots · rare floor · flowering conviction tree · 2 wither-marks`.

Now check it against what you know. A wallet that held from the start and never sold
should have lots of plots, a grown tree and no stumps. A wallet that sold twice should
have exactly two stumps. If a long holder shows only 10 plots, your `PONS_FROM_BLOCK` is
too high and the early history is invisible.

Then do it as a player. Open https://prometheus7.com/ponsgarden/, click **land**, pick
your wallet, approve the account request and sign the message. The wallet is asked for
exactly two things ever: your address, and a signature on a plain sentence that says it
is free and is not a transaction. That signature just proves the wallet is yours, so
somebody cannot type a whale's address and farm on their twenty plots. Your garden then
re-tiles into its own palette, grows its tree and shows the same numbers as the page.

### Step 7 — Phones, when you want them

Desktop wallets work today because browser extensions announce themselves to the page.
Phones need WalletConnect, which needs a free project id from
`cloud.walletconnect.com`. Send me the id and it gets wired in. Until then phone
players play as guests, which is the whole game minus the derived land.

---

## 5. Three things never to do

- Never paste the RPC URL or any key into a chat, a commit or a document.
- Never put a stock token or the broker NFT into `PONS_ECOSYSTEM`. That list changes
  gameplay; the stock layer must not.
- Never let anyone add a buy, sell, claim, transfer or referral link to the game. The
  entire design exists to hold that line.

## 6. Where you land afterwards

With steps 1 to 6 done, the chain half of the game is real. What is left is not chain
work: choosing the final 20 plants, counsel reviewing the shipping build, deciding when
to call it a release, and one remaining engineering job on our side, moving the save
data into a proper database.
