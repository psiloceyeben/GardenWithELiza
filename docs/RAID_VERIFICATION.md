# Raid completion checks

The server now rechecks protection at channel completion, not just initiation.
Uprooting records the original plant UID and rejects a replaced plant, newly
locked plot, shielded owner, full receiving garden, exhausted theft cap,
ineligible mythic owner location, moved/disconnected thief or wrong village.
Gate breaking also rechecks shield, distance and connection. Completion before
the timer deadline is ignored; repeated completion after clearing is harmless.

Box C build and `node --test server/dist/server/src/tests/raid.test.js` passed
four tests: lock purchased during uprooting (exact single charge), successful
timed transfer into persistent carry, replacement/shield rejection, and exact
fence/duplicate/repair/insufficient-funds changes. The five wallet race tests
and copy lint also passed afterward.

The expanded suite now passes 12 tests. Added cases cover moving away, a newly
full receiving garden, reaching the theft cap mid-channel, either player going
offline, a mythic owner leaving home, three timed gate hits, shielding during a
gate hit, single-charge defense purchases, and hidden bell/decoy information.
These are direct server-state tests, not browser or WebSocket simulation.
Complete defense behavior (movement modifiers and automatic gnome tags), bounty
settlement, and real multiplayer play remain required. Production was not restarted.

Bounty follow-up: posting additional Sap previously removed the prior bounty
before reading its amount. Accumulation is now preserved. Active posted bounties
can now be claimed by nearby gardeners in the carrier's current village, not
only the original owner/gnome. Owner tag/interruption also checks village identity.
The suite now passes 15 tests, including exact combined bounty payout, one-time
recovery/payment, returned plant identity, and positive/negative public hunter
cases through the tick loop. Cross-village tag behavior and expiry/restart
settlement still need dedicated integration tests.

The suite now passes 19 tests on Box C. Added exact mud/carry/sprinkler speed
checks, same-village automatic gnome recovery versus identical coordinates in a
different village, and bounty expiry persisted across an actual Game restart.
Gnome checks now require the owner's home village; expiry marks storage dirty.

Customization follow-up: 21 raid tests now pass on Box C. Two additional tests
route nickname messages through the authenticated Game.handle boundary, verify
that a supplied foreign owner ID cannot rename another garden's plant, check
sanitization/14-character truncation/clearing and public-lot visibility, then
carry a named plant through completed uprooting, theft settlement, theft-feed
text, new-owner renaming and persisted Game restart. The former owner's empty
plot cannot rename the carried plant. This is direct server integration, not a
two-browser raid simulation; the separate wardrobe browser test covers actual
nickname typing and reconnect. The complete server suite passed 80 test entries
with the isolated PostgreSQL test database enabled. Production was not restarted.

## Two-browser HD-2D raid harness

`node tools/wardrobe-browser.cjs --raid` runs on Box C with two independent
browser identities and isolated loopback servers/saves. Its dedicated
`raid-browser-server.cjs` wrapper removes only login shielding for these test
players; it refuses non-loopback, fixed-port or non-fixture data configurations.
It otherwise runs the real server entry point. Client pathfinding initiates
ordinary network movement and uprooting; no position assignment or direct raid
settlement is used. The scenario checks remote names, timed uprooting, removal
from the owner's state, return to the raider's own garden, public name updates
and reload persistence. It is controller-driven browser integration, not a
mouse-coordinate usability test, and it does not verify the ten-minute shield.

Initial runs proved uprooting and settlement but exposed two harness errors:
using village-return instead of walking home, and accessing state too early on
reload. Both are corrected. Failure screenshots and non-secret state diagnostics
are retained so a harness failure is not represented as a game regression.

The corrected full scenario passed with zero page exceptions. Evidence on Box C:
`/tmp/pons-wardrobe-browser-brgIqb`, including `raid-carry.png`, `raid-banked.png`
and the isolated server log. The banked screenshot was inspected after reconnect.

## Purchased automatic defense coverage

The raid test file now passes 24 server test entries on Box C. Added scenarios
purchase a bell and verify absent-owner-only notification, one notification per
entry, notification on re-entry, silence while the owner is home, and no bell
disclosure in public defenses. Purchased gnome/scarecrow comparisons verify that
a real gnome interrupts uprooting while a scarecrow is visual deception only.
Patrol proximity is fixed in that test to isolate behavior; it is not a patrol
animation or browser acceptance test. The prior tests cover real patrol recovery
and cross-village isolation. No gameplay code changed in this coverage pass.

## Two-browser perspective raid

`tools/wardrobe-browser.cjs --perspective-raid` passed on Box C at
`/tmp/pons-wardrobe-browser-svQjLs` with zero page errors. Both independent clients
assert a PerspectiveCamera and complete the same controller-driven pathfinding,
timed theft, owner removal, named-plant banking, public update and reconnect
scenario. Login shields are removed only by the isolated raid wrapper as above.
This is not mouse/touch raycast usability coverage or Wander character parity.
Captured post-reconnect image: `artifacts/partner-preview/perspective-raid-banked.png`.

## Wander 3D gnome recovery

`tools/wardrobe-browser.cjs --gnome-raid --wander` passed on Box C at
`/tmp/pons-wardrobe-browser-9X09gV`, zero page errors. Uses real independent browser
clients and normal controller paths: owner walks away; thief uproots the named
golden size-1.3 plant; owner buys a gnome; thief walks into its normal patrol path.
An actual server patrol tag restores exactly one plant to the owner, increments
tag stats once, and clears carried metadata/models on both clients. The owner's
plot model returns and reload preserves the single recovered plant and tag count.
No player/gnome position or patrol-time override is used. Login shielding alone
is shortened by the existing isolated fixture. The test buys the defense after
theft to specifically exercise carry recovery, not pre-existing-gnome uproot
interruption. This remains software Chromium QA, not physical-device, high-latency
or sustained multiplayer-load acceptance. No deployment or service restart.
