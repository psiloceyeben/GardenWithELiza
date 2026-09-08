# Counsel packet: proposed stock-reward mechanic for Pons Garden

**Prepared for:** securities counsel, at Benjamin Horn's request.
**Prepared by:** the engineering side of Prometheus7 Research Institute.
**Date:** 2026-09-08.
**Status:** nothing described here has been built. The shipping game does none of it.

This is a factual packet, not legal advice and not an argument for a conclusion. It sets
out what exists, what is proposed, what we believe the constraints are, and the specific
questions we need answered before any code changes. Where we are uncertain we say so.

---

## 1. The question in one sentence

Benjamin wants players to grow a garden in a video game and, on the strength of that
garden, receive tokenized stock into their wallet. **Can that be structured lawfully,
and if so, how must it be separated?**

## 2. What exists today

**The game.** Pons Garden is a live browser multiplayer game at
`prometheus7.com/ponsgarden`. Players grow fictional plants, and steal them from each
other. The only currency is "Sap", which is internal, has no exit, and buys seeds,
defenses and cosmetics. The game reads public blockchain state read-only and turns one
wallet's history into the permanent shape of that player's garden: plot count, a
decorative tree, and permanent markers for past sells. It never signs, constructs or
relays a transaction, holds no user assets, and emits no token.

**The self-imposed rules.** The project charter (the "bible", §0) contains ten
invariants written specifically because the game sits adjacent to tokenized securities.
The relevant ones:

| # | Rule as written |
|---|---|
| I-1 | Read-only chain access. Never initiates, relays or constructs transactions involving stock tokens or broker NFTs. |
| I-2 | No custody. The app never holds user assets. |
| I-3 | The stock layer is decorative only, with zero effect on yield, progression, plot count, rarity odds or any numeric gameplay variable. |
| I-4 | No inducement copy. No reference to stock yield, dividends, distributions, returns, "activate a broker", or acquiring any StonkBrokers asset. |
| I-5 | No referral wiring. |
| I-6 | No token is ever emitted as a gameplay reward. Sap is not convertible, redeemable, bridgeable or withdrawable. |
| I-10 | No gambling framing. Random reveals are cosmetic-rarity only, with odds published in the interface. |

§0 states that changing any of these requires sign-off from Benjamin **and** securities
counsel, and instructs engineers to stop rather than relax one on request. That
instruction is why this packet exists.

An automated test currently fails the build if stock or broker holdings are ever made to
affect a gameplay number, and a lint fails the build on the banned copy in I-4.

## 3. The counterparty's existing mechanism

Taken from StonkBrokers' own public documentation on 2026-09-08. We have not audited
their contracts beyond reading the verified source of the collection.

- The collection is 4,444 pixel-art "broker" NFTs. Each NFT owns an on-chain wallet
  through the ERC-6551 token-bound account standard, seeded with tokenized stock at mint.
- A mechanism called **Clock In** distributes tokenized stock to holders. A holder
  "activates" a broker by staking it on a distribution payroll, paying an activation fee
  in the platform's own $STONKBROKER token, which is split between burn and treasury.
- Distribution is **tier-weighted**, across four tiers with multipliers described as
  ranging from 100x to 333x. Only activated brokers receive airdrops.
- Holders file an **election** choosing which token they wish to receive; the default is
  ETH. When an accrued pot fills, any wallet may trigger the distribution, and the engine
  tallies elections and swaps in one pass.
- Activation is **permissionless**. Their documentation describes no KYC, accreditation
  check, governance vote or partner approval.
- Their disclaimer states that swapping for stock tokens, **including Clock In**, is
  restricted in the United States, and instructs US residents not to use those features.

**The salient point for us:** a distribution rail already exists, it belongs to
StonkBrokers, and it delivers to broker NFTs rather than to arbitrary player wallets.

## 4. What the assets are

From Robinhood's own chain documentation and public reporting, as of 2026-09-08:

- Stock Tokens are **tokenized debt securities** issued by Robinhood Assets (Jersey)
  Limited as ERC-20 tokens. They give economic exposure to an underlying equity or fund.
  They confer no legal or beneficial interest in the underlying security or its issuer.
- They are **not registered** under US securities law. They may not be offered, sold or
  delivered in the United States, or to or for the account or benefit of US Persons as
  defined in Regulation S, and may be offered only outside the United States to
  non-US-Person transferees. Further restrictions are stated for Canada, the United
  Kingdom and Switzerland.
- They are offered in over 120 countries, with US users excluded.
- The arrangement is under active public challenge. In September 2026 the chief executive
  of AMC Entertainment publicly asserted that tokens referencing his company are not
  registered under US securities laws, and reporting indicates a sought SEC exemption has
  stalled.

## 5. The proposal, and three ways to structure it

Benjamin's stated goal: the garden a player grows determines tokenized stock they receive.

We see three structures. They differ in where the trust boundary sits, which is the
question we think matters most.

### Structure A — Garden as public scoreboard; StonkBrokers alone distributes

The game publishes, per wallet, a deterministic and independently recomputable statement
of garden achievement. It is derived from public chain state and public game state, so
any third party can verify it without trusting us. The game distributes nothing, promises
nothing, and holds nothing.

StonkBrokers, entirely on their own platform and under their own terms, may choose to
read that statement and use it as an input to the **tier** they assign a broker on their
existing payroll. A player experiences: grow a garden, and their broker earns a larger
share on the next Clock In.

- The game remains read-only and non-custodial, so I-1, I-2 and I-6 survive unchanged.
- I-3 and I-4 would still need amendment, because the garden would now influence
  something of financial value and would inevitably be described that way.
- The recipient is a broker NFT the player already chose to buy and activate, inside
  StonkBrokers' existing geographic restriction, not an arbitrary player.

### Structure B — Garden drives election rather than amount

Identical, except the garden influences **which** token a broker elects to receive, not
how much. This is the closest legitimate reading of "the plants are stocks": a plant
grown is a preference expressed. It creates no value and changes no quantity.

### Structure C — The game distributes to players directly

The literal reading: a player grows a plant, and tokenized stock is airdropped to their
wallet as a game reward. This makes the game the front end of a securities distribution.
We are not able to see how this is done lawfully without, at minimum, geographic
exclusion of US persons enforced by the game itself, terms of service, an entity
separation, and a legal opinion that the game is neither an unregistered offering nor
acting as an unregistered intermediary. We flag it as the highest-risk structure and we
have not designed for it.

## 6. Two design problems that are independent of the securities question

**Randomization.** The game's current mechanics assign plants a random rarity and random
mutations. If those rolls determine how much financial value a player receives, the
arrangement has consideration, chance and a prize of value, which we understand to be the
classic test for gambling in many jurisdictions. Our charter already prohibits gambling
framing for this reason. We believe the fix is available and cheap: anything that feeds a
distribution should be **deterministic**, based on time invested and tokens held, with
randomness confined to purely cosmetic outcomes that never affect a payout. We would like
this confirmed or corrected.

**Integrated offering.** We assume technical separation does not by itself defeat the
argument that the game and the distribution are one offering, if the game is promoted as
a way to obtain stock. This shapes marketing more than code, and we would rather be told
the boundary than guess at it.

## 7. Questions we need answered

1. Under Structure A, where the game only publishes a verifiable score and a separate
   party decides distributions, does the game become part of the offering, or an
   intermediary requiring registration?
2. Does the answer change if the game's operator and StonkBrokers are unaffiliated, and
   is a written arm's-length arrangement sufficient, or is affiliation the deciding fact?
3. What geographic gating must the **game** itself implement, as opposed to relying on
   the counterparty's own restriction? Is IP-based exclusion sufficient, or is
   attestation or KYC required at the point a garden becomes score-eligible?
4. Is Structure B, where the garden selects a token preference but creates no value,
   materially safer than Structure A, and is it safe enough to build first?
5. Does deterministic allocation resolve the gaming concern, or does a free-to-enter
   game distributing items of financial value require a sweepstakes structure with
   published odds and jurisdictional exclusions regardless?
6. What may the game's interface and marketing say? Specifically, may it acknowledge the
   existence of the reward programme at all, or must the game stay silent and let the
   counterparty communicate it?
7. Given the live challenge to the registration status of these tokens, is there a
   waiting posture you would recommend over building now?
8. If your answer to 1 is that Structure A is not viable, is there any structure in which
   this product concept can be built, or should it be abandoned?

## 8. What we will not do regardless of the answer

These are engineering commitments, not negotiating positions. Changing them requires the
same §0 sign-off.

- The game will not construct, sign, relay or broadcast a transaction moving any asset.
- The game will not take custody of any user asset or private key.
- The game will not carry referral parameters or a referral integration.
- The game will not name plants after real companies or tickers, or use company-themed
  art. All flora is original.
- Sap will not become convertible, redeemable or withdrawable.

## 9. What changes in the code, by answer

| If counsel says | Engineering work |
|---|---|
| Structure A or B is viable with conditions | Publish a signed, deterministic garden attestation endpoint; add whatever gating counsel specifies; amend I-3 and I-4 narrowly; keep every other invariant. Estimated at days, not weeks, because the derivation and public share pages already exist. |
| Only B is viable | The same, restricted to token election. Smaller. |
| Neither is viable | No code changes. The game ships as designed, and the ecosystem relationship stays at the level already permitted: holding partner meme tokens, which are not securities, unlocks two cosmetic hybrid plant species. |

## 10. What exists today that already touches the relationship, lawfully

For completeness, so counsel sees the current state rather than only the proposal:

- Broker NFT and stock-token holdings are **counted** and drawn as decorative plants
  outside the player's fence. They are never priced, itemized or named, and they change
  no gameplay number. A test enforces this.
- Holding two or more allowlisted **partner meme tokens**, which are not securities and
  explicitly exclude every stock token and the broker NFT, unlocks two additional
  cosmetic plant species with ordinary yields. This is permitted by the current charter.
- Any wallet on the chain has a public garden page, derived from public data, viewable
  without an account. It is a lens on public information, not a service.
