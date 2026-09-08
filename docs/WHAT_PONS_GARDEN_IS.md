# What Pons Garden is

The product as it exists and ships today, and the reasoning behind why it is built this
way. Written to be handed to a partner, an investor, or a new engineer.

---

## The game in three sentences

You grow absurd plants in a fenced garden and they produce a soft currency every second.
Anyone in the village can walk through your gate, spend three seconds uprooting one, and
carry it home to replant in their own garden, and you can chase them down and tag them to
get it back with a bounty. Your land is computed from your wallet's public history and
cannot be stolen; your plants can.

**The sentence that governs every design decision:** your land is forever, your plants
live and die by the raid.

## Why anyone plays it

**The theft loop.** This is the proven engine behind Steal An Egg, with better jokes. It
is immediate, social, and generates stories within the first ten minutes. Somebody stole
your Fraudulent Orchid, which is two ferns in a trench coat, and the notice board told
the whole village. That line is the product.

**A status object that cannot be bought.** Your plot count, your rarity floor, the
conviction tree in your corner and the stumps along your fence are derived from your
wallet's public history by a pure function anyone can rerun. Every large sell you have
ever made leaves a permanent withered stump where every visitor can see it. Conviction
is landscape. You cannot buy it, fake it, or clear it, and I have not seen another game
with anything like it.

**A village, not a menu.** Five keepers stand at their doors on the town street. Mayor
Gorm at the hall, Seedwife Ada at the seed shop, Bram at the tavern, Warden Pell at the
watchtower, and the Oracle in the shrine. They give ten daily jobs, and they answer
questions in character through a dedicated Oracle instance compiled from the game's own
lore, which says plainly when it has not read something rather than inventing an answer.

**Things that happen on a clock.** Wild seeds sprout on the grass every couple of
minutes and anyone can take them. Every twenty minutes an event runs: seed rain across
the plaza, an hour where every plant in the village screams at once, or a golden hour
that gives fresh sprouts a second chance at a mutation. A sprint track around the
fountain keeps a village record.

**Defenses worth buying.** A fence that takes three loud hits to break. A gnome that
patrols and tags thieves. A sprinkler that slows anyone carrying a plant. A mud patch. A
bell that tells you the moment someone steps into your garden. A scarecrow that looks
exactly like a gnome to everybody else and does nothing at all.

## What holding the token actually does

This is the value loop, and it needs no rewards programme, no staking contract, and no
custody of anything.

| The chain says | The player gets |
|---|---|
| Held longer, measured as balance over time | More plots, from ten up to twenty |
| Days since they last sold | A rarity floor that rises until common seeds stop appearing at all |
| Total time held | A conviction tree growing from seedling to fruiting in their corner |
| Each large past sell | A permanent stump on their fence, visible to every visitor |
| Two or more partner tokens held | Hybrid plant species nobody else can grow |
| Broker NFTs and stock tokens held | Exotic flora outside the fence, decorative, affecting no number |

More plots means more plants producing more soft currency, which means more worth
stealing and more worth defending. A higher rarity floor means better plants forever. The
tree and the clean fence line are pure status, and status is the thing people actually
pay for.

**The mechanism is reading, not paying.** The game looks at a public wallet and changes
what that player's garden looks like and how it plays. It never takes custody, never
distributes a token, never signs a transaction. There is no deposit, no lock-up and no
withdrawal, because there is nothing to withdraw.

## Why it is built this way

The game sits next to tokenized securities, so it was built from the first line to depict
that world without ever participating in it.

- **It reads and never writes.** The chain reader can issue read calls only; any other
  method throws. There is no code path that could move an asset.
- **It holds nothing.** No deposits, no in-game wallet, no bridging.
- **The soft currency has no exit.** It buys seeds, defenses, training and decoration,
  and it converts to nothing.
- **Stock holdings change no number.** They draw scenery outside the fence and nothing
  else. A test fails the build if that ever changes.
- **Nothing in the interface tells anyone to acquire anything.** A lint fails the build
  on the banned phrases.
- **All flora is original.** No real company names, tickers or branding, ever.
- **Nothing is decided by paid odds.** Random reveals are cosmetic, and the odds are
  published in the interface.

The result is a game that can be shown to a regulator, a partner, or a journalist without
a caveat, and that keeps working whatever happens to the surrounding token market.

## What the weekly season adds

A season runs one week. Standing is decided by measurable play: steals, tags, defenses
held, missions finished, sprint records. The top three take the honours, and the prize is
funded from the studio's own fees rather than from anything players pay in. Entry is
free. Nothing is wagered, nothing is pooled, and nothing is decided by a dice roll.

That structure is deliberate on two counts. It stays clear of the gaming regime entirely,
because players contribute nothing. And it is the better game, because a season won by
luck is not one anybody enters twice.

## Where the chain fits, precisely

Three touchpoints, all read-only.

1. **Land derivation.** A wallet's public history becomes the permanent shape of a
   garden, through a pure function with unit tests and fixture wallets.
2. **Sign-in.** A player proves they control an address by signing a plain sentence that
   states it is free and is not a transaction. That signature stops somebody typing a
   whale's address and farming on their plots. It is the only thing a wallet is ever
   asked to do beyond reporting its address.
3. **Share pages.** Every address on the chain already has a garden page, viewable by
   anyone, with no account. Whales included. It is a lens on public data and the top of
   the growth funnel.

## What the game is not

It is not a way to earn, and it does not describe itself as one. It does not take
deposits, run a pot, pay a yield, sell odds, or route anybody toward buying anything. The
soft currency is not money and never becomes money.

If it succeeds it will be because stealing a Weeping Wumbus from a neighbour at two in
the morning is funny, and because the stumps on somebody's fence tell a story they cannot
delete.
