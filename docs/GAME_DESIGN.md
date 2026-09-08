# Pons Garden — the game, and how it works

The complete description. What a player does, what every system does, and how the
season, the market reskin and the weekly pot fit together.

Supersedes `WHAT_PONS_GARDEN_IS.md` as the product description. `PONS_GARDEN_BIBLE.md`
remains the charter.

---

## 1. The pitch

You run a garden where the plants are companies. They sprout as little characters — a
smug bean sprout, a melon that cries, a carrot in a suit with a briefcase that will not
open — and each one pays you Sap every second it is alive. Stronger companies are rarer,
grow slower and pay more.

Your neighbours can walk through your gate and rip one out of the ground. It takes them
three seconds and they have to carry it home past your fence, your gnome, your sprinkler
and you.

At the end of the week the bell rings, every garden liquidates, and the three players who
built the most valuable book split a hundred-dollar pot.

**One sentence:** your land is forever, your portfolio lives and dies by the raid.

---

## 2. The core loop, minute by minute

1. **Buy a seed.** Six slots on the conveyor at the seed shop, refreshing every five
   minutes. Each slot shows a species, its tier and its price. Prices scale with how many
   plots you own so a big garden does not trivially out-buy a small one.
2. **Plant it.** Drop it in an empty plot. It grows in the dark.
3. **Sprout Reveal.** After its growth timer it pops with a size roll and a mutation roll.
   This is the moment of the game — a Penny seed can reveal Screaming and out-earn a Blue
   Chip. The odds are printed in the interface.
4. **It pays.** Sap per second, continuously, online and off, capped at eight hours away.
5. **Tend it.** Water to shorten remaining growth by 10%. Weed it, which pays out thirty
   seconds of that plant's output on a five-minute cooldown. Leave a plant untended for
   twenty minutes and weeds halve its output until you come back.
6. **Spend the Sap.** Better seeds, defenses, speed upgrades, cosmetics, decorations.
7. **Somebody steals one.** Now you are in a different game.

## 3. The raid

**Stealing.** Walk into an open garden, stand on a revealed plant, hold for three seconds.
The plant uproots and you are now carrying it — visibly, slowly, with a trail. Get it back
to one of your own empty plots and it is yours, mutation and size intact. The whole village
sees the notice: *"Nix stole a Screaming Bogwort from Marla."*

**Defending.** You get a notification the instant a stranger enters your fence if you own
a bell. You can chase and **tag** the carrier. A tag returns the plant to its owner
instantly and pays you a bounty in Sap. Tagging is the highest-skill action in the game
and the season scores it accordingly.

**The defenses, all Sap-priced:**

| Defense | What it does |
|---|---|
| Fence | Three loud hits to break. The noise is the point — it buys you time to log in. |
| Gnome | Patrols your lot on a route and tags thieves it catches. |
| Sprinkler | Slows anyone carrying a plant across your ground. |
| Mud patch | Slows everyone, including you. Placement is the skill. |
| Bell | Instant notification the moment somebody crosses your line. |
| Scarecrow | Looks exactly like a gnome to every other player. Does nothing whatsoever. |

**Why it stays fair.** Movement is server-authoritative with client prediction and a
distance-credit budget, so you cannot teleport, speed-hack or reach through a fence. Your
land, your plot count and your history cannot be stolen. Only plants can.

## 4. The market reskin — plants as companies

The rarity ladder becomes a **company-strength ladder**. Six tiers, already in the
economy, renamed and given market flavour.

| Tier | Market name | Sap/sec | Grows in | Seed price | Draw odds |
|---|---|---|---|---|---|
| common | **Penny** | 1 | 30 s | 15 | 55% |
| uncommon | **Small Cap** | 3 | 1 min | 90 | 25% |
| rare | **Mid Cap** | 9 | 2 min | 400 | 12% |
| epic | **Blue Chip** | 27 | 4 min | 1,800 | 5.5% |
| legendary | **Megacap** | 81 | 8 min | 8,000 | 2% |
| mythic | **Index** | 243 | 15 min | 30,000 | 0.5% |

Read the ladder as a market and it explains itself. Penny stocks are cheap, sprout in
thirty seconds and pay almost nothing. An Index takes a quarter of an hour and pays 243 a
second. That is the whole risk curve in one table, and it was already the game's curve —
the reskin only names it honestly.

**Volatility, the new mechanic.** Each plant takes a volatility value from its tier, and
its Sap output walks up and down a band around its base rate on a slow internal curve.

- Penny and Small Cap swing hard: ±60%, and they spike. A Penny in a spike briefly
  out-earns a sleeping Mid Cap, which is exactly why anyone plants them.
- Blue Chip, Megacap and Index barely move: ±8%. They are boring and they are correct.
- The band is drawn on the plant. A spiking plant visibly glows and the whole village can
  see it from across the plaza. **Spikes are theft bait**, and that is deliberate.

Volatility is internal and seeded per plant. It tracks no real price, no real feed and no
real company. It is a curve in the game's own memory.

**Mutations survive unchanged** and stack on top: Golden ×4, Holographic ×6, Colossal ×3,
Feral ×5, Backwards ×2, Screaming ×8. Odds published in the interface.

**The characters.** Nineteen exist. The keepers stay — Gorbulon Sprig, Weeping Wumbus,
Plain Gerald, The Unlicensed Carrot, Pumpkin Esquire, The Corn That Knows. Some get edited
toward the market read, and roughly twenty more get added across the tiers so every tier
has a full stable. The new ones are market archetypes as characters, not companies:

- **Penny.** *Shellcorn*, an ear of corn that is completely hollow. *Rugweed*, a vine that
  pulls its own roots up while you watch. *Bagholly*, clutching a sack, refusing eye
  contact.
- **Small Cap.** *The Fernance Bro*, slicked leaves, will explain something to you.
  *Ticker Tulip*, whose petals scroll.
- **Mid Cap.** *Divvy Fig*, drips one bead of syrup on a schedule and is very proud of it.
  *Beargonia*, a begonia with a grumpy bear's face, permanently disappointed.
- **Blue Chip.** *Blue Chip Oak*, with actual chips for leaves. *Custodian Cypress*, tiny
  visor, holds everyone else's things.
- **Megacap.** *Trillion Thistle*, too big for its pot and unbothered. *Circuit Sequoia*.
- **Index.** *The Index*, a hedge made entirely of smaller hedges, all of them nodding at
  slightly different times.

**The roster is a data file**, `content/roster.json`, with a schema and a lint. Names, art
and flavour swap without touching a line of game code. See §10 for the one open decision
about what may go in it.

## 5. The village

**Sixteen lots** around a plaza, deterministically generated from a seed so the server,
the client and the public share pages all draw the identical world. 120 by 80 tiles, eight
colour palettes.

**The town street** runs along the north with five buildings and five keepers standing at
their doors:

- **Mayor Gorm** at the hall — village business, the notice board, the season standings.
- **Seedwife Ada** at the seed shop — the conveyor, and opinions about your purchases.
- **Bram** at the tavern — gossip, who stole what from whom, the bounty board.
- **Warden Pell** at the watchtower — defense missions, and the sprint record.
- **The Oracle** at the shrine — answers questions in character, from a dedicated Oracle
  instance compiled from the game's own lore. It says plainly when it has not read
  something instead of inventing an answer, which is rarer than it should be.

**Ten daily missions** across the keepers: steal from three different gardens, hold a
defense, reveal a Mid Cap or better, run the sprint under a time, finish a trade at the
tavern.

**Things on a clock.** Wild seeds sprout on the open grass every couple of minutes and
belong to whoever reaches them. Every twenty minutes a village event fires:

- **Seed rain** across the plaza.
- **Scream hour** — every plant in the village screams at once, for an hour, with no
  mechanical effect at all.
- **Golden hour** — fresh sprouts get a second mutation roll.
- **Opening bell** *(new)* — every Penny and Small Cap in the village spikes together for
  ten minutes. The plaza glows. Everybody raids.

**The sprint track** loops the fountain and keeps a village record with the holder's name
on a board.

## 6. What holding the token does

Read-only. The game looks at a public wallet and never touches it.

| The chain says | The garden gets |
|---|---|
| Balance held over time | **Plots**, from 10 up to 20 |
| Days since the last sell | **A rarity floor** — the worst tier the conveyor may offer, rising until Penny stops appearing entirely |
| Total time held | **A conviction tree** in your corner, seedling through fruiting |
| Each large past sell | **A permanent stump** on your fence, one per sell, visible to every visitor |
| Two or more partner tokens | **Hybrid species** in your shop that nobody else can grow |
| Broker NFTs and stock tokens | **Exotic flora outside the fence.** Scenery. Affects no number. |
| Address hash | Which of eight **palettes** your land wears |

A wallet that held from the start and never sold has twenty plots, a fruiting tree, a clean
fence and a conveyor that has forgotten Penny stocks exist. A wallet that panic-sold four
times has ten plots and four dead stumps that every visitor walks past. **Conviction is
landscape.** You cannot buy it, fake it or clear it.

**Season eligibility.** Holding is what puts you on the prize board. Anyone can play,
anyone appears on the public leaderboard, and the wallet read decides who is eligible for
the pot. Checked at the closing bell against the same public data as everything else.

## 7. The season

**One week.** Sunday bell to Sunday bell, published in the interface with a countdown.

**Scoring** is measurable play, not dice:

| Action | Weight |
|---|---|
| Book value at the closing bell | The base — see below |
| Successful steals | Points each, with diminishing returns per victim so you cannot farm one person |
| Tags | Worth more than steals. Defense is harder. |
| Defenses held — a raid that entered and left with nothing | Points |
| Missions completed | Points |
| Sprint record held at the bell | A flat bonus |

**The closing bell.** At the end of the season every garden **liquidates**. Every plant
sells for Sap at tier value × maturity × its volatility position at the exact moment the
bell rings. Blue chips settle near their number. Penny stocks settle wherever their curve
happened to be, which is the joke and the tension.

This creates the endgame the whole week builds toward. Do you hold your Megacap through the
final night knowing it is the biggest target in the village, or plant a bed of fast Penny
stocks in the last hour and pray for a spike at the bell? The closing hours of a season are
the most dangerous in the game, because everything on the board is worth stealing and there
is no time left to regrow it.

**The pot.** One hundred dollars a week, funded from studio fees. Entry is free — nobody
pays in, nothing is pooled, nothing is wagered. Split among the top three: sixty, thirty,
ten.

**Everybody else's payout is in the game.** Your liquidated book converts to Sap, which
carries into the next season, plus a **vintage** — a cosmetic plant stamped with the season
number that can never be grown again. Season one vintages will exist for exactly one week
and then never again, and in a year they will be the only thing anybody wants.

**What resets and what does not.** Plants clear. Sap, plots, defenses, cosmetics, vintages,
your tree, your stumps and your sprint record all carry. A season resets the board, not
your life.

## 8. Sessions and accounts

Play as a guest instantly with no wallet, no email and no account — you get ten plots and
the whole game. Guest gardens are ephemeral: leave, and after a three-minute grace window
in case you were reloading, the garden is purged and the lot returns to the village.

Link a wallet and the garden persists, the land derives from your history, and you become
eligible for the pot. Linking asks the wallet for exactly two things, ever: your address,
and a signature on a plain sentence stating that it is free and is not a transaction. That
signature stops somebody typing a whale's address and farming on their twenty plots.

Every address on the chain already has a **public garden page**, viewable by anyone with no
account at all. It is a lens on public data and the top of the funnel.

## 9. How it is built

Three-dimensional client by default, with the original pixel renderer still served at
`?r=2d`. Server-authoritative simulation over websockets. Deterministic world generation
shared by server, client and share renderer from one module. Non-root hardened service.
Twenty-seven of twenty-eight test suites green.

The chain layer is read-only by construction: the reader can issue read calls and any other
method throws. There is no code path in the repository that could move an asset.

## 10. The two open decisions

Everything above is buildable now except two points, both worth deciding deliberately
rather than by default.

**The roster contents.** The mechanism in §4 works identically whether the roster holds
original characters or real tickers, because the roster is data. Shipping original
characters is the recommendation, on plain trademark grounds rather than securities ones:
company names, tickers and logos are registered marks, and putting them on game items that
players trade and that settle into a prize competition is the fact pattern that draws
letters. It also loses nothing — *Beargonia* is funnier than a ticker, and it is ours. If
real names are wanted, the roster file is where that decision lands, after review.

**Universal cash-out.** The season already sends real value out of the game: a hundred
dollars a week to the top three, which is a tournament prize and is how tournaments have
always worked. Making *every* player's liquidated book convertible to coin is a different
thing — it turns Sap itself into money, which is the one change that makes the whole game
an earning scheme rather than a game with a prize in it. The recommendation is the split in
§7: coin to the winners, game value to everyone else, vintages as the thing people actually
chase.

Both are recorded in `PROPOSED_S0_AMENDMENT.md` for the review pass.

---

## 11. Why anybody plays it

Because somebody stole your Screaming Bogwort at two in the morning and the whole village
watched it happen. Because your neighbour's fence has six stumps on it and everyone knows
what that means. Because a Penny stock spiked at the bell and won you the week. And because
on Sunday it all clears and starts again, and this time you have a gnome.
