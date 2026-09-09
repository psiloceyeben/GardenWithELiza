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

## 4a. The board — thirty listed companies

Every plant is a listed company with a **ticker** and a **sector**. The ticker is what sells
the larp: four letters on a fence sign, on the notice board, on the ticker tape running
across the top of the plaza. Nobody needs a real company's name to feel like they are
trading, they need a symbol that moves.

### Penny — the junk drawer

| Ticker | Company | Sector | The character |
|---|---|---|---|
| HUSK | Husk Holdings | Shells | An ear of corn, completely hollow. Rattles when the wind blows. |
| RUGG | Rugg Capital | Shells | A vine that pulls its own roots up while you watch it. |
| BAGZ | Bagholly & Co. | Shells | A holly bush clutching a sack, refusing eye contact. |
| MOON | Moonwort Ventures | Growth | Always about to. Has been about to for some time. |
| PNNY | Pennysprout | Shells | A wide-eyed seedling holding a cardboard sign. |

### Small Cap — the pitch deck

| Ticker | Company | Sector | The character |
|---|---|---|---|
| FRNC | Fernance Brothers | Financials | Slicked leaves. Will explain something to you. |
| TCKR | Ticker Tulip | Growth | Its petals scroll. You can read them if you stand still. |
| SEED | Series Seedling | Growth | Perpetually raising. Never closes. |
| KALE | Kalefornia Dynamics | Energy | Sunny, enormous claims, thin roots. |
| SPRT | Sprout & Sons | Staples | Family business. The sons are not involved. |

### Mid Cap — the workhorses

| Ticker | Company | Sector | The character |
|---|---|---|---|
| DIVI | Divvy Fig | Staples | Drips one bead of syrup on a schedule and is very proud of it. |
| BEAR | Beargonia | Financials | A begonia with a grumpy bear's face. Permanently disappointed. |
| BULL | Bullrush | Financials | Charges its own fence. Every time. |
| MIDL | Middling Mills | Staples | Wheat. Unremarkable. Has never missed a quarter. |
| HZEL | Aunt Hazel's Preserves | Staples | Jam. Only jam. Since forever. |

### Blue Chip — the establishment

| Ticker | Company | Sector | The character |
|---|---|---|---|
| OAKX | Blue Chip Oak | Financials | Actual blue chips for leaves. They clink. |
| CSTD | Custodian Cypress | Financials | Tiny visor. Holds everyone else's things. |
| BORD | Mahogany Board | Financials | A tree shaped like a boardroom table. Seats nine. |
| CNRS | Cornerstone Cactus | Financials | Has not moved since it was planted. Will not. |
| EVBL | Everbloom Pharma | Biotech | One flower. Cures one thing. Charges accordingly. |

### Megacap — the giants

| Ticker | Company | Sector | The character |
|---|---|---|---|
| TRIL | Trillion Thistle | Semis | Too big for its pot. Unbothered by this. |
| CRCT | Circuit Sequoia | Semis | Hums. The hum gets louder before it spikes. |
| VOLT | Voltvine | Energy | Electric tendrils. Arcs to the fence in a storm. |
| PRME | Orchard Prime | Retail | Delivers its own fruit to your other plots. Uninvited. |
| PNPT | Panopticus Palm | Adtech | Many eyes. Watches the whole village. Knows who took what. |

### Index — the untouchables

| Ticker | Company | Sector | The character |
|---|---|---|---|
| NDEX | The Index | Funds | A hedge made of smaller hedges, all nodding slightly out of sync. |
| TRST | Steady Eddy Trust | Funds | Ancient, boring, enormous. Outlives everything around it. |
| SQZE | The Short Squeeze | Funds | A coiled vine. Snaps once, spectacularly, then is spent. |
| HALT | Halted Hydrangea | Funds | Freezes its own plot. Nothing enters or leaves while it sits. |
| DLST | The Delisted | Funds | A ghost stump that somehow still pays. Nobody asks. |

**Sectors are the mechanic, not decoration.** Ten sectors, and volatility moves *by sector*.
When Semis rip, TRIL and CRCT spike together for ten minutes and the whole village runs at
those two gardens at once. When Financials sell off, five plants dim at the same moment and
the raid pressure moves elsewhere. Sector-wide moves are what makes it read as a market
instead of as a slot machine, and they create coordinated village-scale events for free.

**The ticker tape** runs across the top of the plaza showing every sector's move in real
time. It is the single cheapest thing in the entire design and it will do more for the larp
than any name ever could.

**Also on the board:** earnings days, where one company reports and gaps up or down on
reveal. Halts, where HALT does what it does. And the keepers stay — Gorbulon Sprig, Weeping
Wumbus, Plain Gerald, The Unlicensed Carrot, Pumpkin Esquire and The Corn That Knows remain
as unlisted heirloom species, off the board, no ticker, pure brainrot. The market is one
half of the garden and the nonsense is the other.

**The roster is a data file**, `content/roster.json`, with a schema and a lint. Names, art
and flavour swap without touching a line of game code. See §10 for the naming decision.

## 4b. Powered by Oracle7 — the market is authored, not rolled

The market does not move at random. Every move is decided and explained by **Oracle7**, the
alternate-architecture model running on its own instance beside the game, and that is what
makes the tagline a statement of fact rather than a badge.

**The market brief.** On each market tick Oracle7 receives the village state — sector
positions, recent events, what has been stolen from whom, what is planted — and returns a
brief: which sectors move, in which direction, in which magnitude band, and **the headline
that explains it**. The tape then reads:

> *Semis rip as Circuit Sequoia reports a hum of unprecedented volume.*
> *Financials slip. Beargonia declined to comment, at length.*
> *Rugg Capital halted after pulling its own roots up for the third time this week.*

This is the difference between a market and a random number generator. Real markets feel
like stories, and a story needs an author. Oracle7 is the author, and it is reading the
actual village — the headline about a theft is about a theft that happened.

**What Oracle7 drives:**

- Sector moves and their direction and magnitude, within published bands.
- The tape headlines and the notice board's market column.
- Earnings-day copy, per company.
- Which of the scheduled events fires, and its framing.
- Keeper dialogue at the five doors, as it already does.
- Mission text, generated against live village state.

**What Oracle7 never touches**, and these are laws:

1. **It cannot exceed the published bands.** Every brief is clamped to the odds table in
   §4. Oracle7 chooses within the envelope; it cannot invent a move outside it. Players are
   never subject to an unbounded model.
2. **It is never in the payout path.** Season standing is player score — steals, tags,
   defenses, missions, book value. Oracle7 influences the market everyone trades in
   equally; it does not decide who wins. An outage must never become a prize dispute.
3. **Every brief is logged.** Briefs are written to the season log with their inputs, so the
   closing bell is reproducible after the fact and any settlement can be recomputed and
   audited. Authored is not the same as unaccountable.
4. **It fails safe.** If the harness is slow, down, or returns `withheld`/`clarification`,
   the server falls back to a seeded deterministic walk within the same bands and the tape
   runs neutral headlines. The game never blocks on the model. Players cannot tell that
   anything is wrong, except that the news gets boring.

**The instance.** Pons Garden already runs its own Oracle7 harness on `:8099`, compiled
from the game's own lore. For the market layer that corpus extends to market language, so
the model can write a plausible wire headline about a fictional semiconductor company
without ever referencing a real price, a real feed or a real security.

**Why it matters beyond the game.** This is the most legible public demonstration the
Oracle line has: a model that is not a chat window, running a live economy in front of
players who never see a prompt box, authoring events that thousands of people react to.
"Powered by Oracle7" on the loading screen is a claim the season log can substantiate.

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

## 6a. The daily dividend

Holding pays every day, in the game, at a tree in the plaza.

**The Dividend Fig** stands in the middle of the village. Once a day it has a bead of syrup
ready for you and you walk over and take it. No popup, no modal, no login-reward screen —
you go to the tree, the tree does its one proud little animation, and the village sees you
collect. It is the same character as the Mid Cap *Divvy Fig*, grown enormous, and it is the
natural meeting point for everyone logging in around the same time.

**What it pays**, scaled by the same holding ladder that sets your plot count:

| Holding band | Plots | Daily dividend |
|---|---|---|
| Guest / not held | 10 | Sap only, at the base rate |
| Held, entry band | 12 | Base Sap + one seed at your rarity floor |
| 14 | 14 | More Sap + one seed, floor +1 tier |
| 16 | 16 | More Sap + two seeds |
| 18 | 18 | More Sap + two seeds + a weekly cosmetic roll |
| 20 (top band) | 20 | Top Sap + three seeds + the cosmetic roll, and first pick of the day's wild spawns |

**The streak** is what actually brings people back. Consecutive days collected multiply the
dividend up to a cap over two weeks. Miss a day and it does not reset to zero — it steps
back a few days, which is the version people forgive. A visible streak counter sits on the
tree and on your fence sign, so streaks become a village status object like the conviction
tree.

**Why it works.** It is paid in the things that make your garden better rather than in
anything convertible, so it needs no rate, no treasury and no obligation. It gives a holder
a reason to open the game on a day they were not going to. And it lands at a fixed place in
the world, which turns a retention mechanic into a crowd — and a crowd next to sixteen
unlocked gardens is the best thing that can happen to a raid game.

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

**Settlement — the choice everybody makes at the bell.** Your liquidated book does not just
land in your wallet as Sap. You choose how to take it, once, and the choice is real:

- **Carry.** Take the whole book as liquid Sap into next season. The best opening you can
  buy: you start Monday able to plant Blue Chips while everyone else is buying Penny seeds.
  Maximum tempo, nothing permanent.
- **Endowment.** Convert the book into a permanent Sap-per-second trickle that never stops
  and never resets, at a deliberately worse rate — it takes several seasons to pay back.
  Endowments stack across seasons and are visible in your garden as a widening bed of
  evergreen plants that cannot be stolen. This is the veteran's path and it compounds.
- **Vintage.** Spend the book on a **season vintage** — a cosmetic plant stamped with the
  season number, whose tier scales with how much book you burned on it. It can never be
  grown again. Season one vintages will exist for exactly one week and then never, and in a
  year they will be the only thing anybody wants.

Three options, no dominant one: tempo now, compounding forever, or the flex. That decision
at the closing bell is the second-best moment in the game after the Sprout Reveal, and it
gives the whole week somewhere to point.

**Why settlement is a sink and not an exit.** A currency needs somewhere to go, not a way
out. All three options consume the book and pay in game — none of them creates a rate at
which Sap becomes anything else. That distinction is the whole reason this works; see §10.

**What resets and what does not.** Plants clear. Sap, plots, defenses, cosmetics, vintages,
endowments, your tree, your stumps and your sprint record all carry. A season resets the
board, not your life.

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

**The roster contents.** The mechanism in §4 and the board in §4a work identically whatever
names sit in the roster, because the roster is data. The recommendation is the fictional
board as written, and the reasoning is trademark, not securities.

Three points, since a modified-name approach has been proposed:

1. **Copyright is not the relevant regime.** Copyright does not protect names or short
   phrases at all. Trademark does, and it turns on **likelihood of confusion**. Separately,
   famous marks get **dilution by blurring** under Lanham Act §43(c), which requires no
   confusion, no competition and no damages to be actionable.
2. **A real mark plus a suffix is the weakest available form.** "Nvidiaplant" contains the
   mark whole and appends a descriptive word. That is the standard confusingly-similar
   construction, not a parody, and it is a stronger case against us than using the bare mark
   would be in an obviously satirical context.
3. **The parody shelter has narrowed.** *Jack Daniel's Properties v. VIP Products* (2023)
   held that where a mark is used **as a source identifier for the defendant's own goods**,
   the Rogers test does not apply and ordinary infringement and dilution analysis governs.
   A plant whose product name is a real company's mark, bought with in-game currency and
   settling into a cash prize competition, sits squarely inside that holding.

The realistic outcome is not litigation, it is a cease-and-desist and a forced reskin after
launch, at the moment when the names are load-bearing for the community.

**And the design goal survives intact without any of it.** The market feeling comes from
tickers, sectors, sector-wide moves and the ticker tape — mechanics, not nouns. Fictional
tickers deliver the whole larp and are ours to keep. *Panopticus Palm* is funnier than the
company it evokes, and it can go on merchandise.

**Trading settled Sap for coin.** The season already sends real value out: a hundred
dollars a week to the top three. That is a tournament prize, decided by rank, and
tournaments have always worked that way.

A **trade-in is a different object**, and the difference is one word: **rate**. A prize has
no rate. Rank decides it, the amount is fixed in advance, and once it is paid the studio
owes nobody anything. A trade-in has a published rate at which Sap becomes coin, and a rate
is a standing promise to convert on demand. That makes every unit of Sap ever minted a
claim against the treasury, it makes Sap money rather than points, and it makes the studio
the counterparty to all of it — which is the operator posture the entire project was built
to avoid. It is also the change that reframes the whole game from *a game with a prize* to
*an earning scheme*, which is the framing that attracts scrutiny to everything else.

**The goal behind the ask is broader distribution, and that is reachable without a rate.**
If the aim is that more than three people see coin, widen the prize structure rather than
opening a conversion window: pay the top ten out of the same hundred, or add a flat
participation prize to every eligible player who finishes the season above a published
activity threshold. Both are still rank-and-rule prizes with fixed amounts and no standing
obligation, and both put coin in far more hands than a trade-in most players would never
clear the minimum for anyway.

The recommendation therefore stands: coin to the winners, with the placings widened as far
as the pot allows, and the three settlement options in §7 as the sink for everybody's book.

Both are recorded in `PROPOSED_S0_AMENDMENT.md` for the review pass.

---

## 11. Why anybody plays it

Because somebody stole your Screaming Bogwort at two in the morning and the whole village
watched it happen. Because your neighbour's fence has six stumps on it and everyone knows
what that means. Because a Penny stock spiked at the bell and won you the week. And because
on Sunday it all clears and starts again, and this time you have a gnome.
