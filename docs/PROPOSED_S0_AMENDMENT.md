# Proposed amendment to §0 of the Pons Garden bible

**Proposed by:** Benjamin Horn, 2026-09-08.
**Status:** DRAFT. Not adopted. Not implemented. No code has been written toward it.
**Adoption requires, per §0 as it stands today:** Benjamin's sign-off **and** securities
counsel's sign-off. This document exists so counsel can review a concrete redline rather
than a description.

Read this together with `COUNSEL_PACKET_STOCK_REWARDS.md`, which sets out the facts, the
counterparty's existing mechanism, and the questions.

---

## 1. What Benjamin wants to build

In his own framing, two parts.

**Part one, the seasonal pot.** A season lasts one week. To enter, a player stakes an
amount of value, with a floor of roughly five dollars equivalent and a cap of roughly
twenty to thirty dollars. Staking more improves the rarity of that player's drops. A set
percentage of each stake is taken and added to a prize pot. At the end of the week the
three highest scores split the pot. The remainder of each stake is returned to the
player's wallet. Operationally this needs a ledger and a wallet holding staked assets.

**Part two, staking into stock.** A player stakes the project's token and receives token
rewards, paid over time from a development supply wallet, in the region of one hundred to
one thousand units per distribution depending on price. The player is then directed to
StonkBrokers to buy tokenized stock with those rewards. Stock held in the player's
connected wallet is displayed in their garden and **produces Sap per second**, alongside
ordinary plants.

Benjamin's position is that the odds change is small, that limits bound the exposure, and
that operationally this reduces to a ledger and two wallets, one for the development
supply and the pot, one for staked tokens.

## 2. The invariants this would replace

Adopting the above requires amending or deleting the following, all of which are current:

| # | Current text, abbreviated | Status under the proposal |
|---|---|---|
| I-1 | Read-only chain access; never initiates, relays or constructs transactions in stock tokens or broker NFTs | **Deleted or heavily narrowed** if the operator buys or transfers stock, or moves staked assets |
| I-2 | No custody; the app never holds user assets | **Deleted.** Part one requires holding staked assets |
| I-3 | Stock layer decorative only; zero effect on any numeric gameplay variable | **Deleted.** Stock would produce Sap per second |
| I-4 | No inducement copy, including acquiring any StonkBrokers asset | **Deleted.** Part two directs players to buy |
| I-6 | No token emitted as a gameplay reward; Sap not convertible | **Deleted.** Rewards are paid from the dev supply |
| I-7 | PONS derive-only; not accepted as payment, not staked in-app | **Deleted.** Part two stakes it in-app |
| I-10 | No gambling framing; random reveals cosmetic only, odds published | **Deleted or narrowed.** Paid odds decide a cash prize |

Seven of the ten invariants. I-5, I-8 and I-9 would survive as written.

## 3. Proposed replacement text for §0

If counsel clears the design, §0 would read approximately as follows. Counsel should
treat this as a starting draft to be corrected, not as a proposal to approve as written.

> **§0 — OPERATING CONSTRAINTS (amended [date])**
>
> Pons Garden operates a seasonal prize competition and a token staking programme
> alongside a video game. The following constraints apply.
>
> - **A-1. Licensed activities are performed only where licensed.** The seasonal pot,
>   the custody of staked assets, any conversion between assets, and the token reward
>   programme are each conducted only in jurisdictions where the operator holds the
>   required authorisation, and players in other jurisdictions are excluded by
>   enforced geographic gating rather than by notice alone.
> - **A-2. Segregation.** Staked player assets are held separately from the development
>   supply and from the prize pot, with a ledger reconciled to on-chain balances.
> - **A-3. Return of principal.** The portion of a stake not taken into the pot is
>   returned to the originating wallet at season end.
> - **A-4. Published odds and rake.** The effect of stake size on drop rarity, and the
>   percentage taken into the pot, are published in the interface before entry.
> - **A-5. No stock custody by the operator.** The operator does not acquire, hold or
>   transfer tokenized stock. Players acquire it themselves from StonkBrokers, and the
>   game reads their wallet.
> - **A-6. Original IP retained.** All flora remain original. No real company names,
>   tickers or branding appear on any plant. (Formerly I-9.)
> - **A-7. No referral wiring.** (Formerly I-5.)
> - **A-8. Liquidity pairs.** (Formerly I-8.)
> - Changes to this section require sign-off from Benjamin and securities counsel.

Note that A-5 is a deliberate retention. Even under the amended design, the engineering
recommendation is that the operator never touches tokenized stock, because operator
acquisition and transfer is the highest-exposure variant discussed and it is avoidable
without losing the player experience.

## 4. The seven elements, mapped to the regimes counsel must clear

Presented so each can be answered separately. If any single one fails, the design fails
in that part only, and the rest may still proceed.

| # | Element | Regime engaged |
|---|---|---|
| 1 | Stake raises drop rarity; floor and cap applied | Gaming and betting. Note that limits are characteristic of licensed betting rather than a defence against it. |
| 2 | Percentage of stakes pooled and paid to the top three | Pooled betting; the retained percentage is a rake |
| 3 | Operator wallet holds staked assets | Custody; money transmission or virtual asset service provision |
| 4 | SOL or BTC converted on entry | Exchange activity |
| 5 | Staking the project token for rewards from the dev supply | Securities: investment contract analysis |
| 6 | Players directed to StonkBrokers to acquire tokenized stock | Securities promotion or solicitation; Reg S restrictions on offers to US persons |
| 7 | Stock held produces Sap per second | Couples gameplay progression to holding a security; strengthens the argument in 6 that the game is an inducement |

## 5. Questions specific to this amendment

These are in addition to the eight in the counsel packet.

1. Does the seasonal pot as described constitute gambling in the jurisdictions where we
   would accept players, and if so, which licences are required and over what timescale?
2. Do the floor and cap, or the modest size of the odds advantage, affect that answer at
   all?
3. Would restructuring so that no player pays in, with the pot funded from the treasury
   and entry free, avoid the gaming regime while preserving the weekly prize? Is a
   published sweepstakes structure with excluded jurisdictions sufficient?
4. Does holding staked player assets require money transmitter or VASP registration, and
   does routing custody through a third-party staking provider remove that exposure from
   the operator?
5. Is the staking-for-rewards programme an offering of securities in the project token
   itself, and does that change if rewards are fixed and published in advance rather than
   discretionary?
6. May the game direct players to acquire tokenized stock at all, given Regulation S?
7. Element 7 is the engineering team's principal concern. Does making a security produce
   in-game yield materially increase the risk that the game is characterised as an
   inducement to acquire unregistered securities? If so, is a purely visual display of
   the same holdings, producing no Sap, acceptable? That version is already built and
   shipping today.

## 6. Engineering position, recorded for the file

The engineering side has declined to implement any part of this design pending counsel's
answer, on the basis of §0 as it currently stands, which requires both signatures and
instructs engineers to stop rather than relax an invariant on request. That is a process
position, not a legal opinion, and it reverses the moment counsel signs.

Two recommendations are offered regardless of the outcome:

1. **Do not have the operator buy and transfer tokenized stock.** Let the player acquire
   it from StonkBrokers themselves. This removes the operator from the securities chain
   at no cost to the player experience.
2. **Do not let randomness decide money.** If a prize has real value, decide it by
   measurable achievement rather than by a rarity roll. This is both the lower-risk
   design and the better game.
