# Pons Garden — release plan, end to end

From today to a public Season 1 with a live prize. Everything Benjamin must do is
collected in §9 at the bottom; everything else is engineering.

Status as of 2026-09-08: the game is live at `prometheus7.com/ponsgarden`, 3D client,
server-authoritative, hardened non-root service on Box C, 27 of 28 test suites green. The
chain reader is on **mock data**. The market layer, the dividend and the season are
designed (`GAME_DESIGN.md`) and unbuilt.

---

## 1. What has to be true at launch

Nine conditions. Anything unticked is a no-go.

1. Real chain data drives land derivation, verified against wallets whose history we know.
2. The market layer ships: 30 listed companies, tickers, sectors, sector-wide volatility.
3. The daily dividend pays and the streak survives a restart.
4. A full season runs start to finish, unattended, including the closing bell.
5. State lives in PostgreSQL with an off-host backup and a rehearsed restore.
6. The service survives a load test at several times expected peak.
7. Terms, privacy, season rules and published odds are live and linked.
8. The prize can actually be paid, by a named process, from a funded wallet, with a ledger.
9. `PONS_ROSTER=safe` has been flipped end-to-end at least once in staging and the game is
   intact. The larp posture depends on that flip being real.

---

## 2. Phase 1 — The market layer

The reskin, and the largest single body of work.

**1.1 Roster architecture.** Stable internal IDs (`nvda_plant`) decoupled from display
names. Two name sets in one file, selected by `PONS_ROSTER=market|safe`. Art, save records,
share pages and analytics key on ID only, never on name. A test asserts both rosters load,
that IDs are identical across them, and that a saved garden renders correctly after a flip.
*This is the release-blocker condition from the amended I-9 and it is built first, not last.*

**1.2 The thirty.** IDs, tickers, sectors, both name sets, tier assignment, `sapBase`,
silhouette and idle notes for art. Six tiers × five.

**1.3 Sector volatility.** Ten sectors. A server-authoritative move engine walks each
sector on a slow curve; each plant reads its sector's position plus a small per-plant
offset seeded from its ID. Penny and Small Cap band ±60%, Blue Chip and up ±8%. Sector
state is broadcast, not computed client-side, so every player sees the same market. Output
becomes `sapPerSec(plant) × sectorFactor(sector, now)`.

**1.4 Sector events.** Sector rip and sector sell-off on the existing 20-minute event
timer. Earnings day: one company gaps on reveal. Halt: HALT freezes its own plot.

**1.5 Art.** 30 plant characters across growth stages, generated with `tools/sprites/gen.py`
for 2D and billboarded into the 3D client, plus the Dividend Fig and tape furniture. The
largest calendar item and the most parallelisable.

**1.6 Ticker tape and signage.** A tape across the top of the plaza showing live sector
moves. Tickers on fence signs and on the notice board. Cheapest thing in the design,
highest larp return.

**1.7 Oracle7 in the market loop.** The market-brief contract: village state in, sector
moves plus headlines out, clamped to the published bands, logged to the season log, with a
seeded deterministic fallback when the harness is slow, down or returns
`withheld`/`clarification`. Extend the `:8099` corpus with market language. Four laws
enforced in code and tested: bounded, never in the payout path, fully logged and
reproducible, fails safe. See `GAME_DESIGN.md` §4b.

**Exit:** volatility is deterministic and identical server-to-client, the roster flip test
passes, a full sector cycle has been observed live, and the market runs correctly for an
hour with the Oracle harness deliberately stopped.

## 3. Phase 2 — The daily dividend

**2.1** The Dividend Fig in the plaza, with art and an idle.
**2.2** Server-side claim, once per UTC day, keyed to the linked address so guests cannot
farm it by reconnecting.
**2.3** Payout scaled by holding band; seeds respect the player's rarity floor.
**2.4** Streak multiplier building over two weeks, stepping back a few days on a miss
rather than resetting, displayed on the tree and the player's fence sign.

**Exit:** streaks survive a service restart and a day boundary; a guest cannot claim.

## 4. Phase 3 — The season

**3.1** Season module: boundaries, current-season state, persistence, countdown in the HUD.
**3.2** Scoring: book value, steals with per-victim diminishing returns, tags weighted above
steals, defenses held, missions, sprint record at the bell.
**3.3** The closing bell: liquidate every garden at tier value × maturity × volatility
position at that instant. Must be deterministic and reproducible from the season log.
**3.4** Settlement: Carry, Endowment, Vintage. Idempotent — a player who reconnects mid-
settlement cannot settle twice.
**3.5** Endowment as a permanent Sap/sec trickle, rendered as an unstealable evergreen bed.
**3.6** Season vintages, stamped, tier scaling with spend, never regrowable.
**3.7** Live leaderboard, plus a public shareable season page.
**3.8** Prize eligibility: holding checked read-only at the bell. Ineligible players still
rank on the public board; only the payout list is filtered.

**Exit:** a compressed test season (1 hour) runs end to end unattended, twice.

## 5. Phase 4 — Chain go-live

**4.1** Swap the mock reader for the real archive RPC. *Blocked on Benjamin — §9A.*
**4.2** Verify derived land against wallets with known histories; confirm long holders get
20 plots and that `PONS_FROM_BLOCK` is not truncating early history.
**4.3** Delete the StonkBrokers layer: broker and stock-token reads, the exotic flora
outside the fence, `check_broker_views.cjs`, the broker env vars, and the broker sections of
the setup doc. Retire `STONKBROKER_INTEGRATION.md`, `COUNSEL_PACKET_STOCK_REWARDS.md` and
`PROPOSED_S0_AMENDMENT.md` to an `archive/` folder. What remains is the PONS wallet scanner.
**4.4** WalletConnect for mobile wallets. *Blocked on Benjamin — §9A.*

**Exit:** `/health` reports `reader: cached(rpc-worker)` and three known wallets derive
correctly.

## 6. Phase 5 — Production hardening

**5.1 PostgreSQL.** Install on Box C, run the migration, dual-write, verify parity, cut
over, keep the JSON snapshot as a fallback for one season. *Blocked on Benjamin — §9E.*
**5.2 Backups.** Nightly dump to an off-host destination, plus a rehearsed restore into a
scratch database. A backup nobody has restored is not a backup. *Blocked on §9E.*
**5.3 Load test.** Simulated clients at several times expected peak, measuring tick time,
memory and websocket stability. Box C is shared with the Oracle instances, so the ceiling
is a real number we need before launch, not after.
**5.4 Monitoring.** Uptime check on `/health`, alerting on error rate, websocket count,
memory against `MemoryMax`, and season-tick failure. Alerts reach Benjamin.
**5.5 Rollback.** A documented, rehearsed path back to the previous release, extending the
existing backup convention.

## 7. Phase 6 — Launch surface

**6.1 Legal pages.** Terms, privacy, and **Season Rules** — how to enter, that entry is
free, eligibility, scoring, prize amount and split, how and when winners are paid, excluded
jurisdictions, and the operator's identity. Linked from the HUD.
**6.2 Odds page.** Tier odds and mutation odds published in-UI, per I-10.
**6.3 Store page.** A plain description of what holdings do, written against the banned-copy
lint, with no acquisition language.
**6.4 Marketing.** Promo pack reshot on the market build; the ticker tape and a sector rip
are the two shots worth having. Trailer, cards, launch posts.
**6.5 Analytics.** Funnel from landing to first plant to first steal to wallet link, plus
error tracking.
**6.6 Copy pass.** Full banned-copy lint over every new string in the market layer, the
dividend, the season and the legal pages.

## 8. Phase 7 — Season 0, then launch

**Season 0** runs one full week, publicly playable, with **no cash prize** — vintages and
Sap only, clearly labelled as a dry run. It exists to prove the bell fires unattended, the
scoring is not exploitable, and the load holds. Fix whatever it surfaces.

**Season 1** is the public launch with the $100 pot.

Between them: an exploit review of the scoring, because the first time real money hangs on
a leaderboard is the first time anyone seriously attacks it.

---

## 9. What Benjamin has to do

Grouped by whether it blocks work. Nothing in A or E can be worked around.

### A. Values and credentials — blocks Phase 4 and mobile

Five values, down from seven. The StonkBrokers layer is removed, so the broker collection
block is gone and the broker view check no longer runs.

1. **Archive-capable RPC endpoint**, chain ID 4663. Still must be archive — the scanner
   replays PONS balance history to work out how long each wallet held and when it sold, and
   an ordinary node has thrown that away. Goes into the systemd unit only, never into chat,
   a commit or a document.
2. **PONS contract address.**
3. **PONS deployment block.** Set too high and every long holder looks like a newcomer.
4. **PONS decimals** (almost certainly 18).
5. **WalletConnect project id** from `cloud.walletconnect.com`, free — without it, phones
   play as guests only.

*Optional:* a **partner meme-token allowlist** as `SYMBOL:0xaddress`, if you still want
hybrid species. Not required for launch.

Steps and checks are in `BEN_STONKBROKER_SETUP.md` (to be renamed; the broker sections no
longer apply).

### B. Money and process — blocks the prize, not the build

8. **A dedicated prize wallet** holding PONS, separate from the dev supply, funded ahead of
   each season.
9. **Fix how "$100 in PONS" is calculated** and publish it in the Season Rules before the
   season opens — which reference price, from which source, read at which moment. The
   closing bell is the natural moment. Without a stated reference, the prize amount is
   arguable after the fact, and that argument always happens with the winner.
10. **A prize ledger**: season, winners, PONS amounts, the reference price used, transaction
    hashes, date paid. Boring, and essential the first time anyone asks.
11. **Who executes the payout.** I do not move funds — the transfer is a human step by
    design, and it stays that way.

### C. Decisions — blocks content and rules copy

12. **Final roster sign-off.** The 30 names as drafted, or your edits. The dual-roster
    architecture means this is not urgent, but the art depends on the final list.
13. **Prize split.** Currently 60/30/10 to the top three. Widening to ten places, or adding
    a participation prize above an activity threshold, puts coin in more hands from the same
    hundred — worth deciding before the rules page is written.
14. **Season start day and time**, with a timezone. Sunday bell to Sunday bell is assumed.
15. **Eligibility threshold** — what minimum holding qualifies for the prize board.
16. **Excluded jurisdictions**, if any, for the prize competition.

### D. Legal review — blocks Season 1, not Season 0

17. **Terms, privacy and Season Rules reviewed** before real money is on the board. A
    free-entry skill competition is the simplest structure there is, but the rules page is
    the document that proves it and it should not be the one thing nobody read.
18. **Trademark posture: decided.** Recorded in the amended I-9 — ship the larp, reskin on
    a letter. No further action unless one arrives, in which case tell me and it is a
    one-flag flip.
19. **Optional:** counsel's eye on the prize structure. Lower stakes than the earlier
    proposals, but it is the first time value leaves the studio.

### E. Infrastructure approvals — blocks Phase 5

20. **Approve installing PostgreSQL on Box C.** It is a shared host running the Oracle
    instances, so I want your word before an apt install.
21. **Name an off-host backup destination.** Box A, an object store, anywhere not Box C. A
    backup on the same machine as the database is not a backup.

### F. Accounts — small, do whenever

22. Analytics and error-tracking accounts, if you want them; otherwise I ship without.

### G. Go/no-go

23. **Season 0 review**, then the call on Season 1.

---

## 10. Critical path

The long poles are **art** for thirty characters and the **season**, and they are
independent, so they run in parallel. Chain go-live is short but hard-blocked on §9A, so
those seven values are the single most valuable thing Benjamin can produce today —
everything else has a workaround and that does not.

Order of build: roster architecture (proves the flip), then volatility and the season in
parallel with art, then the dividend, then chain, then hardening, then the launch surface,
then Season 0.
