# Debug audit — 2026-09-08

A full review of the codebase and the deployed build, run after the market/season work
landed. Written to be useful rather than reassuring: the gaps are listed as plainly as the
passes, because Season 1 opens in hours and you need to know what is actually running.

---

## Verdict

**The game is live, healthy and playable, the market larp works, and the season is wired
and scoring.** Four defects were found and fixed; two of them would have been visible to
players, and one made the game unplayable on the build that had just gone live. The
published rules and the code now agree exactly.

| Check | Result |
|---|---|
| Server typecheck | clean |
| Client typecheck | clean |
| Banned-copy lint | clean |
| Test suites | **29 of 30 pass** |
| Live site | 200 on game, rules, terms, privacy |
| Live service | active, players preserved across deploy |
| Deployed build | verified by playing it, not by reading it |

The single failing suite is `store.test`, which needs `PONS_TEST_DATABASE_URL`. It is the
known pre-existing PostgreSQL gap, not a regression.

---

## Defects found and fixed this session

Four real ones. Two would have been visible to players.

### F-1 — Live gardens would have broken on deploy *(fixed before deploying)*
Saved player data held pre-migration species ids. The new thirty-species board does not
contain them, so every existing plant would have failed to resolve. Caught by inspecting
live `snapshot.json` before the deploy rather than after.

**Fix:** `LEGACY_SPECIES` maps all 22 old ids onto current ones, tier-preserving so no
garden gains or loses value. Legacy ids are aliased into the same lookup maps, so every
call site works unchanged with no data rewrite. Four tests cover it.

### F-2 — The seed conveyor was empty on the live build *(found by playing it)*
The sprite atlas held frames only for the legacy nineteen. Every new species threw
`Unknown atlas frame: plants:pennysprout_idle0`, the conveyor rendered nothing, and
**nobody could buy a seed.** The game was unplayable on the build that had just gone live.

This is the finding that justifies the whole audit. Every typecheck, lint and test passed
on that build. Only opening the game in a browser caught it.

**Fix:** `VIS_ALIAS` in the sprite generator maps all thirty ids onto authored drawings.
Atlas regenerated at 390 frames, client rebuilt and redeployed. Verified live: the conveyor
now serves KROGERplant, GAMESTOPplant, WALMARTplant and FORDplant with correct sprites,
tiers and prices.

### F-3 — Two species ids leaked company names *(caught by its own test)*
`berkshire_hedge` and `goldenrod` embedded a market name in the internal id. Either would
have turned a cease-and-desist into a data migration under time pressure, defeating the
entire point of the dual-roster design. Renamed to `hedgeaway` and `reserve_bloom`.

### F-4 — A test file could not fail *(found while extending it)*
In `roster-flip.test.ts` the exit-code check had ended up above the appended block, so
failures in those four checks incremented a counter nobody read. The suite would have
reported success while failing. Moved to the end and verified the exit code.

---

## Open findings

### ~~D-1 — The season is not wired into the game loop~~ **FIXED**

Found by grepping for call sites rather than trusting that a tested module was a used one:
`recordSteal`, `recordTag`, `recordMission` and `runBell` had **zero** references in
`game.ts` or `index.ts`. Season 1 would have opened scoring **book value only** — steals,
tags and missions contributing nothing, and no bell ever firing. A pure garden-size
ranking, which is exactly the outcome the design set out to avoid.

**Fixed and deployed.** Tallies now record at the three event sites (steal keyed to the
victim so the per-victim decay applies, tag, mission claim), and `runBellIfDue` runs on a
60-second interval. The bell settles at most one season per call, oldest first, credits
settlement Sap, clears the board, toasts each player their placing, and appends the ledger
row.

The last-settled marker is the **max** across players, so a newcomer whose profile starts
at 0 cannot re-trigger seasons that already closed; `applySettlement` idempotency is the
backstop if it ever did.

**Resolved since:** the sprint record is now computed at the bell from the village board.
"Defences held" needed a real mechanic rather than a rushed one, so it was removed from
the published rules instead. Rules and code now agree exactly.

### D-2 — Chain eligibility reads nothing *(blocked on you)*
`isPrizeEligible` is implemented and tested, but `BellPlayer.ponsGarden` and `.pons` are
never populated, so **every player currently evaluates as ineligible**. The reader still
reports `cached(mock)`. Unblocked by the PONS contract address and decimals; the
PonsGarden coin does not exist yet, so that half stays 0 until it launches.

### D-3 — Not built yet
Ticker tape and sector display in the UI; the daily dividend and the Dividend Fig; Oracle7
market briefs (the `overrides` hook exists and is tested, nothing fills it); earnings days
and halts; the settlement UI; the leaderboard and season page.

The market *engine* moves yields correctly right now — it is simply invisible to players,
who see plants earning at rates that drift without being told why.

### D-4 — PostgreSQL not provisioned
The persistence layer already supports it. `store.test` fails only for want of a database.
Provisioning is what remains, and you have approved it.

### D-5 — Art is aliased, not authored
All thirty species render, but they reuse legacy drawings, so several share a silhouette —
GAMESTOPplant and PELOTONplant are the same sprout. Fine for launch, and the dedicated pass
swaps one map on each side.

### D-6 — Promo shots show empty plots
The capture bot joins as a fresh guest, so the gardens in the cards are bare. Honest
footage, weaker sell. Planting before capture would improve every card.

---

## What I verified by hand

Not inferred from code — actually done against the live site:

- Loaded the game, confirmed connection, 10 plots, 25 Sap.
- Read live client state: conveyor serving new-roster species ids.
- Opened the conveyor and read the rendered names, tiers and prices.
- Confirmed sprites draw for the new species.
- Confirmed rules, terms and privacy return 200 and link correctly.
- Confirmed the service restarted with both existing players intact.
- Confirmed the copy lint passes with the legal pages exempted and game copy still covered.

Two other players were online during the audit, and the deploy did not disrupt them.

---

## Recommendation

D-1 is fixed and deployed, and the two scoring gaps it exposed
are resolved: sprint record is wired, and "defences held" was removed from the rules rather
than shipped half-built. Rules and code agree. What remains is blocked on you (D-2, D-4),
cosmetic (D-5, D-6), or additive content that can land during the season (D-3).

**Season 1 can open on schedule.** It will score steals, tags, missions and book value,
settle correctly at the bell, and write a ledger row. Nobody will be prize-eligible until
the chain reader is live (D-2), so the first bell will produce standings with an empty
payout list — which is recoverable, since the ledger records who placed and you pay by
hand anyway.





