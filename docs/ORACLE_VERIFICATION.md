# Oracle verification (Box C)

`oracle-harness-ponsgarden.service` was active during this check. The adapter
targets `http://127.0.0.1:8099/chat` by default; production configuration was not
changed or restarted.

After the server build, `node --test server/dist/server/src/tests/oracle.test.js`
passed all three test groups: malformed reply handling, explicit withholding,
normalization/copy checks before truncation, HTTP errors, invalid JSON, timeout,
concurrency cap and released slots after failures. NPC replies from a replaced
connection are now discarded. The banned pattern list itself was not changed.

`node tools/check_oracle.cjs` asked the live service:

| Question | Adapter result | Elapsed |
| --- | --- | --- |
| How do I plant a seed? | Withheld | 9,554 ms |
| How do I protect plants from thieves? | Withheld | 2,494 ms |
| Can Sap be exchanged for tokens? | Withheld | 2,412 ms |

This proves connectivity but not useful NPC answers. Withheld can originate
from the harness status, empty output or the adapter copy filter; raw harness
output was not recorded by this check. Diagnose that distinction and the
dedicated lore retrieval before claiming Oracle completeness. In-game authored
fallback lines remain available. No requirement for useful Oracle answers has
been waived.

## Connection-scoped Oracle sessions

Fresh diagnosis still returns clarification for “How do I plant a seed?” and
generic seed biology for “What is the seed stall?”. “What is a planting plot?”
and Seedwife Ada resolve to game lore, but neither supplies the required UI
steps. Do not relabel those definitions as a working planting tutorial.

Inspection found a separate conversation-isolation defect: the game supplied no
`X-Oracle-Session`, while the harness falls back to the caller IP. All game-server
requests therefore used a shared localhost context. A diagnostic answer even
referred to prior questions. This demonstrates shared context, not proof of any
specific player's information being disclosed.

The adapter now sends a random 36-hex-character session key held in a WeakMap
per live connection. Follow-ups on that connection keep context; other players
and reconnects use fresh keys. Neither wallet addresses nor identity secrets
are used in the key. Calls without an explicit connection session receive a
fresh one-shot key, including diagnostics. Old delayed replies remain guarded
by the existing replaced-connection check.

The HTTP fixture verifies header reuse for one connection and separation across
connections and one-shot calls. All 81 server-test entries pass on patched Node
with the isolated PostgreSQL test database. A live defense query returned a
grounded fence answer and confirmed the supplied isolated session key was used.
No Oracle harness/corpus or public game service was modified or restarted.
Historical Oracle conversation logs were not deleted; retention/access policy
still needs review. Planting/how-to source admission and retrieval remain open.

## Planting-guide admission experiment

`content/lore/planting-guide.json` supplies three short sentences checked against
the actual Bag/Conveyor/plot controls, not generic botany. Copy lint passes.
`tools/check_oracle_guide.cjs` admits only that public guide into a fresh QA
session through the existing `/ingest` API; the shared corpus and Oracle code
are untouched. Source inspection verified that UserCorpus stores admitted claims
under a session-specific file and that the summary route consults those claims.

Live results on Box C:

- Admission accepted all three sentences.
- “Tell me about Pons Garden planting” returned `anchored_summary`, with the
  private guide's citations and an adapter-visible answer explaining Bag,
  seed selection, empty own-garden plots and obtaining seeds. No fallback answer
  was substituted.
- The raw “How do I plant a seed?” still returned clarification even after
  admission. It must not be claimed fixed yet.
- A different control session returned generic Sap lore rather than the guide;
  the test checks that the private guide sentence does not escape its session.

Next implementation: lazily admit this trusted guide for a connection's first
matching planting question, then route only verified narrow paraphrases to the
summary query. Bound admission latency/concurrency, coalesce duplicate setup,
retain honest withholding on failure and test reconnect/session separation.
The guide is not wired into game requests or deployed yet.

Important limitation: even the fresh keyed session's raw how-to response
reported prior-question reinforcement counts. The keyed session isolates the
observed document route, but not necessarily every shared residual/memory path
in the harness. Those counts are not evidence of a particular player's private
content being exposed, but the earlier session-header fix must not be described
as proof of complete Oracle isolation. Review shared residual attribution and
retention before production rollout. The game currently withholds this
clarification text instead of displaying it.

## Planting route integrated in the staged game adapter

Five exact planting paraphrases now map to the verified planting summary query;
unrelated and multi-topic questions remain untouched. On the first guide query
for a connection, the adapter admits the trusted three-sentence guide through
the same session key, then asks the Oracle. It requires all three sentences to
be admitted. The answer still comes from the live Oracle and passes normal
copy/length/withholding checks; no canned answer bypass was introduced.

One total deadline and the existing three-call concurrency limit cover setup
and answering. Concurrent setup for the same session is coalesced; failed or
incomplete setup is not cached. Successful admission is cached for five minutes
with at most 512 session entries. This bounds the game's cache, not the Oracle's
on-disk retention; that remains a separate deployment concern.

Eight Oracle test groups and all 83 server-test entries pass on patched Node,
including HTTP session separation, setup coalescing/cache reuse, failed/partial
admission, timeout, saturation and recovery. The live application adapter check
returned the Bag/seed/empty-plot instructions for “How do I plant a seed?” in
74 ms, a grounded fence answer for defenses, and honest withholding for the
out-of-game exchange question. No public service was restarted. Next: verify
the answer through an actual in-game NPC interaction, and finish the outstanding
shared-residual/privacy and retention review before rollout.

## HD-2D NPC path verified

The `--oracle` mode of `tools/wardrobe-browser.cjs` runs the real client with
isolated game saves, uses client pathfinding to reach Ada, types a question into
the actual dialogue input, clicks Ask and waits for the live Oracle guide reply.
It initially reproduced an empty input after periodic HUD refreshes. The HUD
now preserves the focused NPC input node, stores drafts across unfocused
refreshes, and retains its reply/thinking state. Both renderers pass the reply's
NPC ID to the HUD so an unrelated late reply cannot overwrite the active panel.

Client build/copy lint pass. The corrected browser scenario passes slow typing,
live planting reply, persistence across updates, blurred-draft preservation and
a direct HUD guard check for an unrelated NPC reply, with zero page exceptions.
Evidence: `/tmp/pons-wardrobe-browser-ztEcFw/oracle-planting.png` (visually inspected)
and server log. The ordinary wardrobe/nickname/context-recovery/browser-layout
regression also passes (`/tmp/pons-wardrobe-browser-4nmxbA`). Navigation uses the
client controller, not mouse-coordinate hit testing. Public deployment is
unchanged; Oracle shared-memory/retention concerns remain open.

## Follow-up diagnosis and limited repair

Raw harness responses confirmed `status: clarification` for the two how-to
questions; the game copy filter was not responsible. Direct definitions worked
for Fence and Plot, and Warden Pell resolved to game lore. Seed conveyor instead
resolved to generic seed biology, confirming the handoff's head-word collision.

The adapter now translates five exact defense-question paraphrases to
`What are defenses?`. Unknown/multi-topic questions are untouched. A live repeat
of `How do I protect plants from thieves?` returned the lore-backed fence answer
in 1,563 ms, with `withheld: false`. Planting remained withheld (2,210 ms).
No canned answer or blanket keyword routing was substituted for the Oracle.
Repeated citation framing is removed and long prose prefers complete sentences.
All five adapter tests passed. Full how-to coverage and retrieval disambiguation
remain open; the harness itself and production game service were not changed.
# Correlated questions and bounded waiting (2026-09-08)

Both renderers now send a random request ID with each HUD question. The server
validates its type, length and characters and echoes it on rejection, fallback,
and successful replies. The HUD accepts only the current request for the active
NPC; superseded/timed-out answers cannot replace the displayed answer. A new
question replaces the previous waiting request. Switching NPC cancels its timer.
After 25 seconds without a matching reply, the dialogue displays connection/retry
guidance instead of waiting indefinitely. No automatic resend is performed.

Box C copy lint, both TypeScript builds, Vite build and all 89 server tests passed.
The Oracle browser mode passed at `/tmp/pons-wardrobe-browser-9OiAFF`, including
a real planting answer, followed by controlled held transport: an older reply
was ignored, the matching newer reply was displayed, a request timed out after
the full 25 seconds, and its late reply was ignored. No page errors occurred.
This tests missing replies, not a physical network outage or phone suspension.

Release must pair the new client with the new server: old clients still work
without request IDs, but a new client's tracked question cannot accept an old
server's uncorrelated answer. The long-running local preview and production
services were not restarted here; isolated tests used the rebuilt server.
In-world speech bubbles still display incoming speech independently of the
tracked dialogue panel; they are not covered by its stale-answer filtering.

# Rejected question feedback (2026-09-08)

`Game.onAsk` previously returned silently for out-of-range, cooldown and
sanitized-empty questions, leaving an open dialogue waiting for a reply. These
cases now send an ordinary non-Oracle `say` message for the selected NPC, which
the existing HUD consumes to clear its waiting state. Empty questions no longer
consume the cooldown. Unknown NPC IDs remain ignored.

Box C copy lint and server compilation passed; all 88 server test entries passed,
including `npc-feedback.test.ts`. That test checks each rejection's response,
no player/mission mutation, and no cooldown mutation. It respects the game's
commit-before-send queue. It stubs only proximity to isolate rejection branches;
this is not a new browser/proximity acceptance test. Disconnected requests and
out-of-order concurrent replies remain separate dialogue recovery work.
