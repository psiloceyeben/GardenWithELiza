# PONS GARDEN — Design Bible & Build Packet v0.1

**Project:** Pons Garden — a browser-based multiplayer brainrot garden game whose world is derived from Robinhood Chain state.
**Studio:** Prometheus7 Research Institute
**Consumers of this document:** the Fable/Codex shared coding harness, counsel, and the Special Projects pitch.
**Genre reference:** "Steal An Egg" (Roblox) — steal → hatch → collect → earn → upgrade → defend loop.
**Doctrine:** conduit, not reservoir. The garden is a pure function of public chain state plus server-side game state. Nothing visual is stored that cannot be re-derived.

---

## §0 — INVARIANTS (legal-by-design; read before writing any code)

These are engineering constraints, not guidelines. They exist because the game runs adjacent to tokenized securities (Robinhood Stock Tokens, Reg S restricted; StonkBroker NFTs). The game's legal survivability depends on **depicting** that layer while never **inducing, gating on, transacting in, or profiting from** it.

**Changes to this section require explicit sign-off from Benjamin AND securities counsel. No agent may relax an invariant to satisfy a feature request, including a request from Benjamin mid-build — flag and stop instead.**

- **I-1. Read-only chain access.** The app reads Robinhood Chain state. It never initiates, relays, or constructs transactions involving stock tokens or broker NFTs. No transfer, approve, buy, sell, wrap, or claim flows for any asset other than (later, if ever approved) PONS itself.
- **I-2. No custody.** The app never holds user assets. No deposits, no in-game wallets holding tokens, no bridging.
- **I-3. Stock layer is decorative only.** Broker NFTs, stock tokens, and drop history may render as flora/scenery. They must have **zero** effect on yield, progression, plot count, rarity odds, matchmaking, or any numeric gameplay variable.
- **I-4. No inducement copy.** UI text, tooltips, quests, achievements, and marketing copy must never reference stock yield, dividends, distributions, returns, "activate a broker," or acquiring any StonkBrokers asset. Banned strings belong in a lint list (`/shared/banned-copy.json`) enforced in CI against all user-facing strings.
- **I-5. No referral wiring.** No integration with the StonkBrokers referral system. No outbound links that carry referral parameters. Plain informational links to public pages are acceptable only in an "About the chain" credits page.
- **I-6. PONS is never emitted as a gameplay reward.** Plants yield soft currency (Sap) only. Sap is not convertible, redeemable, bridgeable, or withdrawable to PONS or any token, ever. No marketplace where Sap-priced goods are resold for tokens.
- **I-7. PONS v1 touch policy: derive-only.** The game reads PONS balances/history to derive land (see §2). The game does not accept PONS as payment, does not burn it, does not stake it in-app. (A cosmetic PONS sink is a v2 question for counsel, not a v1 feature.)
- **I-8. Liquidity pairs.** If/when PONS launches on Stonk Launcher: pair against ETH or $STONKBROKER only. Never create or seed a pool pairing PONS against any tokenized stock.
- **I-9. Original IP only.** All plant characters, names, and designs are original. No Italian-brainrot IP, no existing meme characters, no real-company logos on flora. (Company-themed *biome palettes* are out too — see §2.4.) Same roster discipline as the WanderAround character set.
  - **AMENDED 2026-09-08 by Benjamin, as to plant display names only.** Plant display names may be portmanteaus derived from real listed-company names (e.g. "NVIDIAplant"), as a deliberate larp. Benjamin's decision, taken with the analysis in `GAME_DESIGN.md` §10 in front of him: the regime is trademark not copyright; a mark plus a descriptive suffix is the weakest form rather than a workaround; and *Jack Daniel's v. VIP Products* (2023) removes the parody shelter where the mark names the product. His accepted posture is **ship now, reskin on demand**.
  - **Unamended and still binding:** no real logos, no brand art, no company colourways, no company-themed biomes, no claim of affiliation or endorsement, and nothing implying the game tracks or represents a real security. Plant behaviour and volatility stay internal and reference no real price or feed.
  - **Revert trigger.** On any cease-and-desist, platform or store complaint, payment-processor query, or Benjamin's word, `PONS_ROSTER` flips to `safe` and the fictional board in `GAME_DESIGN.md` §4a ships instead. Engineering must keep that flip a one-file, no-migration operation permanently; if it ever stops being one, that is a release blocker.
- **I-10. Age posture.** No gambling framing ("bet," "jackpot," "cash out"). Gacha reveals are cosmetic-rarity reveals purchased with earnable soft currency; publish odds in-UI.

---

## §1 — THE TWO-LAYER ONTOLOGY

Everything in the game belongs to exactly one layer. The layers have opposite physics.

### Layer C — Chain-derived (permanent, unfakeable, unstealable)
Derived deterministically from a wallet address + public chain state. Recomputable by anyone; stored nowhere authoritative.
Contents: **land** (plot count, arrangement), **biome** (visual palette/weather), **rarity floor** (minimum seed tier the conveyor offers you), **conviction flora** (special plants encoding hold history, including wither-marks from past unstakes), **decorative stock flora** (renders broker/stock holdings as scenery per I-3), **hybrid unlocks** (from holding partner-ecosystem meme tokens — never stock tokens).

> Layer C cannot be stolen, traded, or lost in-game. Your land is a portrait of your wallet's history. It can only be changed by changing the wallet's reality.

### Layer G — Game state (server-authoritative, chaotic, stealable)
Lives in the game database. This is where the brainrot happens.
Contents: **Sap** (soft currency), **seeds**, **planted plants** (with rarity/size/mutation rolls), **defenses** (fences, gnome sentries, sprinklers, plot locks), **player stats** (speed training), **cosmetics**.

> Everything in Layer G can be earned, spent, and — for planted plants — stolen.

**The sentence that governs all design:** *Your land is forever; your plants live and die by the raid.*

---

## §2 — LAYER C DERIVATION SPEC

Implemented as a pure function in `/shared/derive/`:

```
deriveGarden(address, chainSnapshot) -> GardenSpec
```

Deterministic, unit-tested against fixture snapshots, and identical on server and share-page renderer. All constants below are **[TUNABLE]** and live in `/shared/derive/constants.ts`.

### 2.1 Inputs (via chain-reader service, §6.3)
- `ponsBalance(address)` — current ERC-20 balance.
- `stakeTime(address)` — Σ(balance × time) integral approximated from Transfer event history; unit: token-days.
- `holdStreak(address)` — days since last balance *decrease*.
- `unstakeEvents(address)` — list of past balance decreases ≥ 20% of then-holdings (for wither-marks).
- `walletAgeOnChain(address)` — first tx timestamp on Robinhood Chain.
- `ecosystemHoldings(address)` — balances of an allowlisted set of partner **meme** tokens (e.g. $STONKBROKER, $DERP, $UP…). **Allowlist explicitly excludes all stock tokens and broker NFTs** (those feed only §2.5 decoration).
- `stockDecor(address)` — broker NFT ids + TBA stock-token contents + received-drop log. *Feeds visuals only.*

### 2.2 Plot count [TUNABLE]
| stakeTime (token-days) | plots |
|---|---|
| 0 (no wallet / zero) | 4 (guest garden) |
| > 0 | 6 |
| ≥ 1,000 | 9 |
| ≥ 10,000 | 12 |
| ≥ 100,000 | 16 |
| ≥ 1,000,000 | 20 (cap) |

Guests (no wallet) get a full game on 4 plots — wallet connection is an upgrade, never a wall.

### 2.3 Rarity floor [TUNABLE]
`holdStreak` sets the minimum tier the seed conveyor offers: 0–6 d → Common; 7–29 d → Uncommon floor; 30–89 d → Rare floor; 90–364 d → Epic floor; 365 d+ → Legendary floor. Floors raise the *minimum*, never the odds of the top tier (top-tier odds stay equal for everyone — whales get consistency, not lottery advantage).

### 2.4 Biome
`biomeId = hash(address) mod N`. Biomes are palette + weather + ambient audio; purely cosmetic; N ≥ 8 at launch. Biomes are abstract ("Molten Meadow," "Static Bog") — per I-9, no company-themed biomes.

### 2.5 Conviction & decorative flora
- **Conviction tree:** one centerpiece per garden; growth stage = f(stakeTime): seedling → sapling → mature → flowering → fruiting. Cannot be stolen or removed.
- **Wither-marks:** each `unstakeEvent` renders a permanent withered stump on the land border. History is landscape.
- **Stock decor (I-3):** if the wallet holds broker NFTs / stock tokens, render as exotic *background* flora outside the playable plots — visible in share images, no hitbox, no numbers, no tooltip beyond flavor text from an approved-copy list.
- **Hybrids:** holding ≥2 allowlisted ecosystem meme tokens unlocks hybrid seed species on the conveyor (cosmetic species, standard yields).

---

## §3 — LAYER G: CORE LOOP (Steal An Egg verb map)

| Steal An Egg | Pons Garden |
|---|---|
| Egg shop / spawns | **Seed Conveyor** — rotating stock, refreshes every 5 min [TUNABLE], rarity-rolled within your floor |
| Hatch egg → random pet | **Sprout Reveal** — plant matures on a timer, reveal rolls species + size + mutation |
| Pets earn money | **Plants tick Sap** per second |
| Upgrade base | **Garden upgrades** — defenses, decor, plot cosmetics |
| Treadmill speed training | **Wheelbarrow Sprints** — movement-speed stat, trained in a mini-area, Sap-priced |
| Steal eggs from players | **The Raid** — uproot, carry, escape |
| Rarer eggs / sizes / mutations | Rarity tiers × size rolls × mutations |

### 3.1 Sap generation
`sapPerSec(plant) = base(rarity) × sizeMult × mutMult` [TUNABLE starting values: base Common 1 / Uncommon 3 / Rare 9 / Epic 27 / Legendary 81 / Mythic 243; size 0.8–1.5; mutations ×2–×10]. Offline accrual capped at 8 h per session gap [TUNABLE].

### 3.2 The Raid (the whole game)
- Enter any online player's garden from the plaza.
- **Uproot:** channel 3 s [TUNABLE] on an unprotected plant; interrupted by owner tag.
- **Carry:** movement −30% while carrying; dropped on tag; despawns back to owner if the thief is tagged or disconnects.
- **Score:** cross your own garden threshold → plant is replanted in your plot (must have a free plot).
- **Tagging:** owner (or their gnome sentry) touching the thief recovers the plant instantly and awards the owner a Sap bounty.
- **Offline shield [DECISION D-1, recommended v1]:** fully shielded while offline + 10 min re-entry grace. Raids are mischief between present players, not overnight griefing. Revisit post-launch.
- **Steal caps:** max 3 successful steals per victim per hour; Mythic plants uprootable only when the owner is in-garden [TUNABLE — anti-tears valves].

### 3.3 Defenses (Sap sinks)
- **Fence** (perimeter HP; thieves must break a gate segment, loud + slow),
- **Gnome Sentry** (auto-tag radius, 1 per 4 plots),
- **Sprinkler Turret** (slows carriers),
- **Plot Lock** (single plot immune for 24 h, consumable).

### 3.4 Mutations [screenshot fuel]
Golden (×4, gleam), Holographic (×6, shader), Colossal (×3, big), Feral (×5, plant wanders your plots), Backwards (×2, grows downward), Screaming (×8, audible across map — the raid-magnet flex). Odds published in-UI (I-10).

---

## §4 — FLORA ROSTER BRIEF (original IP, I-9)

**Naming law:** every plant must pass the *"someone stole my ___"* test — the sentence must be funny said aloud. Formula: [absurd modifier] + [organism] + optional [honorific/suffix].

Target: 20 species at launch across 6 tiers. Exemplars to set tone (harness may generate candidates; Benjamin curates final roster via the WanderAround roster process):

1. **Gorbulon Sprig** (Common) — a smug bean sprout with one enormous eyebrow. Idle: raises it.
2. **Weeping Wumbus** (Uncommon) — melon that cries Sap tears into its own pot. Idle: sniffles.
3. **The Unlicensed Carrot** (Rare) — carrot in a tiny suit holding a briefcase that won't open. Idle: checks watch.
4. **Sir Blombus of the Damp** (Epic) — knighted mushroom, visibly moist, tiny sword. Idle: knights nearby Commons.
5. **Fraudulent Orchid** (Legendary) — obviously two ferns in a trench coat. Idle: coat slips.
6. **YELLING TUBER** (Mythic) — potato. It yells. That's it. Audible garden-wide. Idle: inhales.

Deliverable per species: name, tier, silhouette gag, idle-animation gag, 1-line flavor text (approved-copy list), sapPerSec base. Content lives in `/content/roster.json`.

---

## §5 — ECONOMY

- **Sources:** plant ticks; tag bounties; daily tending chores (water/weed micro-interactions, small); first-steal-of-day bonus.
- **Sinks:** seeds (primary), defenses, speed training, plot cosmetics, biome-agnostic decor, shield extensions.
- **No faucet ever pays tokens (I-6). No sink ever accepts tokens in v1 (I-7).**
- **Tuning targets [TUNABLE]:** first successful steal ≤ 10 min from spawn; median session 8–15 min; a fresh guest can afford an Uncommon seed by minute 6; conveyor FOMO (rotation timer visible) is the retention lever.
- **Anti-inflation:** defenses and cosmetics are consumable/upgradeable ladders; seed prices scale with the buyer's plot count.

---

## §6 — TECHNICAL ARCHITECTURE

### 6.1 Repo layout (shared harness)
```
/client        Phaser 3 + TypeScript 2D pixel-art client (480x270 internal, 32px tiles), mobile-first controls
/server        authoritative sim: rooms, raids, economy (Node; port WanderAround netcode)
/chain-reader  Robinhood Chain indexer + cache (RPC via Alchemy), derivation inputs
/shared        derive/ (pure fn + constants), types, banned-copy.json, roster schema
/content       roster.json, biomes, copy tables (all user-facing strings live here)
/share         SSR snapshot renderer for /garden/0x… link unfurls
```

### 6.2 Server authority (a stealing game is an anti-cheat problem)
- Client renders and requests; server owns ALL Layer G state. No client-reported positions accepted beyond bounded inputs; server validates speed against trained stat; uproot channels, carries, tags, and scoring resolve server-side.
- Rooms: plaza + N garden instances; raid presence = joining the victim's room.
- Persistence: Postgres (players, plants, inventory, econ ledger — append-only ledger for Sap so dupes are auditable). Redis for sessions/rooms.

### 6.3 Chain reader
- Networks: Robinhood Chain testnet (chainId 46630) for M2 dev; mainnet params confirmed from official chain docs at implementation time.
- Reads: PONS ERC-20 Transfer logs (stakeTime integral), balances; ERC-721 broker ownership + ERC-6551 TBA contents (decor only); allowlisted meme-token balances.
- Cache derivation inputs per address (TTL 5 min); `deriveGarden` runs on demand; share pages render from the same pure function (conduit-not-reservoir: any third party could rebuild every garden from public data — document this in the README as a feature).

### 6.4 Share pages
`/garden/<address>`: static snapshot render + OG image. Any wallet on the chain is viewable as a garden — including whales — with no game account. This is the lens artifact and the growth loop's top of funnel.

---

## §7 — MILESTONES & ACCEPTANCE CRITERIA

**M0 — Bible ratified.** This doc reviewed by Benjamin; D-decisions logged; banned-copy.json seeded. *Done when: §0 signed off.*

**M1 — The Toy (single-player).** One scene: 6-plot garden, conveyor, buy/plant/reveal, Sap ticking, mutations, seed tiers. No wallet, no multiplayer, no backend beyond local state. *Done when: a stranger plays 10 unprompted minutes and buys a third seed.*

**M2 — Derivation.** Wallet connect (read-only), testnet reads, `deriveGarden` with fixtures + unit tests, land/biome/floor/conviction-tree live, `/garden/<address>` share pages. *Done when: two known test wallets produce visibly different, deterministic gardens, and a URL unfurls with the garden image.*

**M3 — The Raid.** Rooms, presence, uproot/carry/tag/score, defenses, offline shield, steal caps, server-side validation, load test 200 concurrent per region. *Done when: two agents (or Benjamin + partner) can rob each other and both laugh.*

**M4 — Token & platform (parallel, never blocks M1–M3).** Launcher dry-run on testnet; launch config paired ETH or $STONKBROKER (I-8); Special Projects pitch packet (this doc §0–§4 + M1 build link); fee-splitter percentages obtained in writing; counsel review of §0 against final build. *Done when: counsel has seen the shipping build and the launch config.*

**M5 — Clip engine.** Kill-feed style raid log ("X stole Y's Fraudulent Orchid"), one-tap clip export of raids, seasonal seed drop pipeline, whale-garden leaderboard page. *Done when: the first stranger-made theft clip exists.*

---

## §8 — DECISION LOG (Benjamin)

- **D-1** Offline raid policy — recommended: full shield v1. ☐
- **D-2** Soft currency name — placeholder "Sap." ☐
- **D-3** Launch pair — ETH vs $STONKBROKER (I-8 constrains to these two). ☐
- **D-4** Special Projects (curated, paired liquidity, their ToS) vs plain permissionless launch. ☐
- **D-5** Roster final 20 — curate from harness candidates. ☐
- **D-6** Mainnet chain params + Alchemy config — confirm from official docs at M2. ☐

## §9 — EXPLICITLY OUT OF SCOPE (do not build, even if requested casually)

Stock-token or broker transfers/claims in-app · broker marketplace integration · referral wiring · PONS gameplay emissions · Sap↔token conversion of any kind · plant NFT minting (v1 stays derived + server-state; revisit only as a deliberate v2 decision) · company-branded biomes/flora · any relaxation of §0 without the sign-off protocol.

---
*v0.1 — drafted for the Prometheus7 harness. The land is forever; the plants live and die by the raid.*
