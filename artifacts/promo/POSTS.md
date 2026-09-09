# Pons Garden — launch posts

Four posts. Each has a short form (X / Bluesky) and a long form (Discord, Reddit,
newsletter). **Post 3 is the Oracle7 one.**

All copy passes the banned-copy lint. Nothing here promises earnings, references a real
security or price feed, or tells anyone to acquire anything.

**Cards:** `01-your-land`, `02-grow-guard`, `03-the-village`, `04-the-board`,
`05-the-oracle`, `06-the-bell` — each at 1080×1080 and 1080×1350, shot from the live game.

**Link:** ponsgarden.com — free, no account, plays in the browser.

---

## Post 1 — Launch
**Card: 01-your-land (1080×1350)**

### Short

Your land stays yours. Your plants do not.

Pons Garden is live. Grow absurd plants, watch them pay out every second, and try to stop
your neighbours walking through the gate and uprooting the good one.

No account. No download. Plays in a browser.

ponsgarden.com

### Long

**Pons Garden is live, and it is a game about theft.**

You get a plot of land and grow things on it. Each plant pays a soft currency every second
it is alive. Better plants pay more and take longer to grow, which makes them worth more and
also makes them a target.

Because anyone in the village can walk into your garden, stand on your best plant for three
seconds, and carry it home to replant in their own.

You can chase them. Tagging a thief mid-carry returns the plant instantly and pays you a
bounty, and it is the hardest and best thing in the game. You can also buy a fence that
takes three loud hits to break, a gnome that patrols and tags people for you, a sprinkler
that slows anyone carrying a plant across your ground, and a scarecrow that looks exactly
like a gnome to everybody else and does absolutely nothing.

Free, no account, no download. Playing as a guest takes about four seconds.

→ ponsgarden.com

---

## Post 2 — The board
**Card: 04-the-board (1080×1080)**

### Short

Thirty companies. All of them plants. All of them stealable.

Penny stocks sprout in thirty seconds, pay almost nothing, and swing ±60%. An index takes
fifteen minutes, pays 243 a second, and barely moves at all.

That is the whole risk curve, growing in a field.

ponsgarden.com

### Long

**Every plant in Pons Garden is a listed company.**

The rarity ladder is a company-strength ladder: penny and meme names at the bottom, megacaps
near the top, index funds above them. It maps onto the game's existing economy so exactly
that we barely had to change a number.

- **Penny** — 30 seconds to grow, 1/sec, swings ±60%
- **Small Cap** — 1 minute, 3/sec, swings ±60%
- **Mid Cap** — 2 minutes, 9/sec
- **Blue Chip** — 4 minutes, 27/sec, barely moves
- **Megacap** — 8 minutes, 81/sec
- **Index** — 15 minutes, 243/sec, immovable

The interesting part is that volatility moves **by sector**. When semiconductors rip, every
semi plant in the village spikes at once and the whole plaza runs at the two gardens holding
them. A spiking plant visibly glows, which makes it theft bait, which is exactly the point.

A penny stock in a spike briefly out-earns a sleeping mid cap. That is why anyone plants the
cheap ones at all.

Every company, sector and movement is invented. Nothing tracks a real security or a real
price feed. It is a market that exists entirely inside a game about stealing plants.

→ ponsgarden.com

---

## Post 3 — Oracle7
**Card: 05-the-oracle (1080×1080)**

### Short

The market in Pons Garden isn't random. It's written.

Oracle7 — our own model, not a chat window — reads the village every minute and decides
which sectors move and why. The ticker tape prints its reasoning:

*"Rugg Capital halted after pulling its own roots up for the third time this week."*

Powered by Oracle7. Literally.

ponsgarden.com

### Long

**Most game economies are a random number generator with a nice font. This one has an
author.**

Pons Garden runs on Oracle7, the alternate-architecture model we have been building at
Prometheus7. It is not a chatbot bolted onto a game. It runs the economy.

Every market tick, Oracle7 receives the actual state of the village — which sectors are
where, what happened recently, who stole what from whom, what is planted — and returns a
brief: which sectors move, in which direction, how far, and **the headline explaining it.**

The tape reads like a wire:

> *Semis rip as Circuit Sequoia reports a hum of unprecedented volume.*
> *Financials slip. Beargonia declined to comment, at length.*
> *Rugg Capital halted after pulling its own roots up for the third time this week.*

The headline about a theft is about a theft that actually happened. That is the difference
between a market and a dice roll: real markets feel like stories, and a story needs somebody
writing it.

**Four rules keep it honest, and all four are enforced in code:**

1. **Bounded.** Oracle7 supplies only a position between −1 and 1. What that gets multiplied
   by comes from a published table it cannot touch. Players are never exposed to an
   unbounded model.
2. **Never in the payout path.** Season standing is decided by what players do — steals,
   tags, missions finished. Oracle7 moves the market everyone trades in
   equally. It does not decide who wins, so an outage can never become a prize dispute.
3. **Fully logged.** Every brief is written to the season log with its inputs, so any result
   can be recomputed and audited months later. Authored is not the same as unaccountable.
4. **Fails safe.** If the model is slow or down, the market falls back to a deterministic
   walk inside the same bands. The game never blocks on it. The news just gets boring.

Why this matters beyond the game: it is the most legible public demonstration of the Oracle
line we have. A model that is not a text box, running a live economy, in front of players who
never see a prompt.

"Powered by Oracle7" is a claim the season log can substantiate.

→ ponsgarden.com

---

## Post 4 — The season
**Card: 06-the-bell (1080×1350)**

### Short

Sunday. The bell. Everything settles.

Seven days, then every garden in Pons Garden liquidates at whatever the market says in that
exact second. Top three split the pot.

Free to enter. Nothing staked, nothing pooled, nothing wagered. Decided by steals, tags and
missions — not by dice.

Season 1 opens 9 September, midnight Pacific.

### Long

**Seasons run a week and end with a bell.**

At the bell, every garden in the village liquidates. Each plant sells for whatever it was
earning at that exact instant — its size, its mutation, whether you kept it weeded, and
wherever its sector happened to be sitting.

Which creates the decision the whole week builds toward. Do you hold your megacap through the
final night knowing it is the biggest target in the village? Or plant a bed of fast penny
stocks in the last hour and hope for a spike at the bell?

The closing hours of a season are the most dangerous in the game. Everything on the board is
worth stealing and there is no time left to regrow it.

**How standing works:** book value at the bell, plus steals, tags, missions
finished, and the sprint record. Repeat steals from the same player are worth less each time,
so raiding widely beats farming one neighbour. Every weight is published in the rules.

**The prize:** top three split the pot, 50/30/20, funded by the studio. **Entry is free** —
nobody pays in, nothing is pooled, nothing is wagered, and nothing is decided by a dice roll.
A season won by luck is not one anybody enters twice.

**Everyone else settles too,** and it is a real choice made once: **carry** the book as liquid
currency into next season for maximum tempo, **endow** it into a permanent trickle that never
stops and compounds across seasons, or burn it on a **vintage** — a cosmetic plant stamped
with the season number that can never be grown again.

Season 1 vintages will exist for one week and then never again.

**Season 1 opens 9 September at midnight Pacific.**

→ ponsgarden.com

---

## Notes for posting

- Lead with **Post 1**. Posts 2 and 4 can follow the same day. **Post 3 deserves its own
  day** — it reaches a different audience than the game posts do.
- Post 3 is the one to send anywhere ML-adjacent. It is the strongest public artifact the
  Oracle line has.
- The line that lands hardest is the plain one: **"your land stays yours, your plants do
  not."** Lead with it when in doubt.
- Every card carries the URL, so they stay accurate if reposted.
- The rules, terms and privacy pages are live and linkable if anyone asks:
  ponsgarden.com/rules.html
