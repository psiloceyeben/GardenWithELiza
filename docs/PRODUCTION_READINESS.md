# Pons Garden completion tracker

Goal: fully built, verified game with read-only chain/wallet/broker-decoration
connections. Keep the bible invariants and run builds/tests on Box C.
This tracker is not a completion claim.

Production credential-file support: Store now accepts PONS_DATABASE_URL_FILE
directly, with bounded no-follow reads, private-permission checks, exact service
ACL validation for systemd credentials and sanitized errors. Conflicting sources
and unsafe/invalid files fail startup. Aggregate `/tmp/pons-regression-EgUGQ5`
passed 129 server tests and all 23 tool-test files. Non-root PostgreSQL sandbox
`/tmp/pons-hardened-service-UkiXKK` passed credential loading in the actual game,
boundary probes, purchase/restart and exact saved readback; unit stopped. This
removes the QA-only credential bridge, not the need for production provisioning
or authentication verification. See PERSISTENCE.md for ACL dependency and limits.

Sandbox + restricted PostgreSQL integration passed at
`/tmp/pons-hardened-service-AokLaZ`: DynamicUser game accesses only a private
socket bind mount and systemd-delivered connection credential, uses runtime schema
mode, passes boundary probes, purchases a seed and recovers exact state after
graceful restart. Post-stop restricted readback and one-entry ledger checks pass;
no fallback file snapshot exists. Original QA directory permissions and public
service unchanged; temporary unit stopped. Local trust authentication remains a
test-only limitation. See BOX_C_DATABASE_ROLLOUT.md for retained artifacts/gates.

Sandbox enforcement follow-up `/tmp/pons-hardened-service-9zg6Fz` passed actual
in-process code-directory write denial, root-home access denial, private state
write allowance, zero effective capabilities and NoNewPrivileges. These probes
passed before and after service restart, alongside the real purchase and exact
saved-state recovery checks. The isolated unit is stopped; private markers/save
are retained. Public code/service/data were unchanged. See
BOX_C_DATABASE_ROLLOUT.md for the boundary scope and remaining production work.

Non-root service rehearsal: new Box C-only `tools/hardened-service-check.cjs`
starts a bounded, uniquely named transient service with DynamicUser, strict
filesystem protection, no new privileges and a private retained StateDirectory.
Run `/tmp/pons-hardened-service-Urxn2z` verified non-root effective UID, a real
protocol purchase, graceful service restart, exact Sap/seed recovery, private
snapshot permissions and one purchase ledger entry. The QA unit is stopped.
This validates a one-player mock/file configuration, not production PostgreSQL,
RPC workers or final resource limits. See BOX_C_DATABASE_ROLLOUT.md. Public unit
and saved game data were not modified.

Production-host assessment: Box C root disk is 92% used (about 26 GiB available)
and swap is full, with about 2.1 GiB available memory at inspection. Pons occupies
about 1.8 GiB, mostly the 1.2 GiB retained QA cluster; public saved data is only
24 KiB. The public game remains healthy with one online player, but runs with
system-service root defaults and no MemoryMax. No persistent PostgreSQL service
was listed, only the temporary QA process. See BOX_C_DATABASE_ROLLOUT.md for the
evidence, capacity caveats and staged non-root/private-database rollout. No live
service, shared-host resource or retained evidence was changed.

Live configuration audit: new read-only `tools/deployment-config-report.cjs`
inspects only supported game-service processes and prints statuses/field names,
not secret values. Current public service is missing chain/broker configuration,
PostgreSQL and explicit runtime mode; its public HTTPS origin is present and
legacy import is disabled. Nothing was reconfigured or restarted. Report success
means only configuration-present-not-verified, never production-ready. Aggregate
`/tmp/pons-regression-wow6oW` passed 128 server tests and all 23 tool-test files.
See DEPLOYMENT_CONFIG_CHECK.md for invocation, evidence limits and the distinction
between remaining engineering work and actual owner decisions.

Database connection-loss verification: terminated one precisely selected isolated
restricted-role backend, observed the actual connection error, verified the next
Store save fails with retained dirty state, then reopened in runtime mode and
recovered the exact committed snapshot with no failed ledger entry. Writer-lock
reacquisition and a new save passed. Aggregate `/tmp/pons-regression-WRqJFi`
passed 127 server tests and all 23 tool-test files. This tests connection loss
between saves, not commit ambiguity or full database/server failure. Only tests
and documentation changed; production services/connections were untouched.

Database stall safeguards: session-local 10-second statement, 3-second lock and
20-second idle-transaction limits now complement driver deadlines. Real isolated
restricted-role lock contention and injected slow-statement tests verify server
cancellation, rollback without partial player/ledger state and exactly-once
ledger retry. Aggregate `/tmp/pons-regression-zuIDYG` passed 127 server tests and
all 23 tool-test files. See PERSISTENCE.md for timing scope and untested failure
modes. No live service restarted or production settings changed.

Restricted-role browser acceptance: `--runtime-database` now prepares a fresh QA
schema under its owner, then runs the actual game and post-shutdown readback as
a separate restricted login in runtime mode. Plain-URL 3D garden
`/tmp/pons-wardrobe-browser-tcTeYg` passed purchase/plant/water/grow/income/reconnect
and saved one-player/one-plant readback. Two-client raid
`/tmp/pons-wardrobe-browser-Jt0Tbw` passed timed theft/carry/banking, pose release,
remote updates/reload and both-player/one-unique-plant readback. Both had zero
page errors. Only QA roles/databases were created and retained; no public service,
production database or authentication settings changed. See PERSISTENCE.md.

Database privilege separation: `PONS_DATABASE_SCHEMA_MODE=runtime` skips schema
DDL and validates enabled ledger protection before loading. The existing
bootstrap mode remains the compatibility default; production must explicitly
select runtime with a separate, non-owner login after preparation. Real isolated
PostgreSQL tests prove restricted-role load/save/ledger append while schema
changes, ledger rewriting and version updates are denied; disabled protection
fails startup. Aggregate `/tmp/pons-regression-rClefx` passed 127 server tests
and all 23 tool-test files. See PERSISTENCE.md for exact grants and trust limits.
No production role/service was provisioned or changed.

Wallet/reader failure checkpoint: two new signed-link regression tests verify
failed chain refresh preserves the entire existing player record and session,
including a purchased seed and spent Sap; the failure consumes the nonce, emits
no linked/identity success and hides provider details. A fresh signed retry
succeeds without losing inventory. A separately controlled old provider failure
arriving during a newer attempt emits no stale error and does not prevent the
new attempt succeeding. Box C aggregate `/tmp/pons-regression-HWRdA1` passed
127 server tests and all 23 tool-test files, source compilation and copy lint.
These exercise real signature verification/Game handlers/commit outbox with
controlled readers and captured sockets, not real extensions, providers or a
database crash. Production behavior already passed; only tests/docs changed.

Chain configuration hardening: isolated chain ID/from-block/decimals/ecosystem
settings no longer silently select mock mode. Empty numeric values no longer
coerce to zero, while explicit zero remains valid where supported. Malformed
RPC URL errors do not retain credential-bearing parser input. Box C aggregate
`/tmp/pons-regression-Gf8SdC` passed 125 server tests and all 23 tool-test files,
plus source compilation/copy lint. See CHAIN_READER.md for deployment semantics.
Compiled code only: no live environment, service restart or contract enabled.

Plant facial idles: mature Gorbulon now raises its single brow and Plain Gerald
blinks slowly, following roster descriptions without moving bodies or soil.
Reduced-motion changes reset these poses live. Aggregate
`/tmp/pons-regression-QtGXVB` passed 124 server tests and all 23 tool-test files;
browser `/tmp/pons-wardrobe-browser-FMNJal` observed both gestures and live
reduced-motion reset/resumption, zero page errors. The development build is
updated; the public site is not. Most roster gestures still remain; see
WANDER_3D_DIRECTION.md for scope and evidence.

3D carry pose: local and remote Wander avatars now raise both arms and place the
carried plant at their hand-socket midpoint while preserving walking legs and
plant mutation/size. Box C aggregate `/tmp/pons-regression-OqNt95` passed 124
server tests and all 23 tool-test files; build passed with existing warnings.
Two-client raid `/tmp/pons-wardrobe-browser-vuUiLQ` passed hand placement, actual
theft/banking and reload with zero page errors. No gameplay or vendor-source
changes. See WANDER_3D_DIRECTION.md for details and remaining animation limits.
PostgreSQL repeat `/tmp/pons-wardrobe-browser-zHFkGg` passed pose release on both
clients before reload and post-shutdown readback of both players/one unique plant.

Default 3D entry: the rebuilt development client now opens perspective/Wander
characters without special URL flags; startup, renderer and wardrobe share the
selection helper. Explicit orthographic, sprite and Phaser fallbacks remain.
Aggregate `/tmp/pons-regression-pZPFSV` passed 124 server tests and all 22 tool-test
files. Plain-URL browser `/tmp/pons-wardrobe-browser-Q5y1nh` passed model, camera,
wardrobe and touch checks; explicit orthographic `/tmp/pons-wardrobe-browser-6j7x62`
passed the normal regression. Both had zero page errors. See
WANDER_3D_DIRECTION.md for evidence and limitations. Public site unchanged.
Plain-URL Wander full regression `/tmp/pons-wardrobe-browser-wq2mnv` also passed
actual WebGL loss/recovery, nickname persistence, paid/free wardrobe actions and
mobile controls, zero errors. The synthetic banner fixture now suppresses live
event updates during measurement, resolving a test race, not changing runtime CSS.

Backup recovery checkpoint: hardened archive publication and transactional
restore are exercised against retained PostgreSQL gameplay databases on Box C.
`/tmp/pons-backup-drill-6BFzKq` restored 200 players and 400 ledger entries;
`/tmp/pons-backup-drill-gK1YWG` restored the two-player raid and 67 ledger entries.
Exact records, restored Game startup/commit, ledger immutability and unchanged
sources passed. Existing-output/symlink/destination guards passed; the final raid
run also checks relative-path refusal and failed-dump temporary cleanup. Truncated
archives with readable TOCs failed without leaving a partial pons schema.
Archives and isolated databases are retained. See PERSISTENCE.md for the workflow
and limits. No production migration, service restart or off-host backup schedule
was performed; those remain release gates.

Status-layout follow-up: the natural-height status grid now applies at every
viewport width, not only at/below 600px. HUD/feed remain at the two upper corners;
event and toast rows follow the taller content without fixed vertical offsets.
The existing one-entry mobile feed limit and all five desktop entries are retained.
Box C client build passed with existing warnings. Browser run
`/tmp/pons-wardrobe-browser-zllt1H` passed 42 synthetic layout combinations:
widths 320, 390, 600, 601, 960, 1280 and 1920; zero/one/five feed entries; event
visible/hidden; a long notice. All rows were separated and stayed within the
viewport, zero page errors. Inspected desktop/mobile screenshots under
`artifacts/partner-preview/status-layout-{desktop,mobile}.png`.

Normal browser regression `/tmp/pons-wardrobe-browser-MxQEaO` also passed WebGL
loss/recovery, nickname editing/reconnect, wardrobe purchase/re-equip/persistence,
mobile taps, panel sizing and bottom-control reachability, zero page errors.
This resolves the status/feed overlap observed during the PostgreSQL raid check;
it is not physical-device or arbitrary-text/font-scale acceptance. Current
development static assets are rebuilt; public site and backend services unchanged.

PostgreSQL browser gameplay follow-up: isolated actual 3D planting/growth/income
and two-player raid/banking/reconnect flows now pass against PostgreSQL, with
post-shutdown readback of inventories, named plant ownership/appearance, wardrobe
and no lost acknowledged Sap. Runs `/tmp/pons-wardrobe-browser-ZZqznf` and
`/tmp/pons-wardrobe-browser-u9cjGJ`; the latter verifies both players and one unique
plant. Zero page errors; details/fixture limits in PERSISTENCE.md. Screenshot
inspection exposed feed/banner/notice overlap to fix next. No production change.

PostgreSQL load follow-up: the enhanced isolated load harness now exercises
200 purchases plus periodic free wardrobe writes and verifies acknowledged
state/unique purchase ledger entries through a fresh persistence connection after
graceful shutdown. Box C 180-second PostgreSQL run
`/tmp/pons-load-smoke-DVTEfw` passed with 35 wardrobe rounds, 71,600 pongs,
97/128 ms p95/p99 RTT, 216 ms maximum snapshot gap and 113.0 MiB peak sampled
game-server RSS. A 30-second PostgreSQL run and updated file-mode run also pass;
details and scope limits are in PERSISTENCE.md. This closes the missing bounded
PostgreSQL protocol-load check, not long active-game/chain load, physical-browser
performance, production database provisioning or release. No live restart.

Stale-credential recovery follow-up: a rejected stored secret now closes with
4003, stopping automatic retries without modifying browser storage. Both renderers
offer an explicit Sign in again action; only the matching rejected credential is
removed, never a newer login saved by another tab. The UI distinguishes recovering
a wallet-linked garden from creating a separate guest garden. Server saves remain
untouched by that local recovery action; no credentials are bypassed.

Box C `/tmp/pons-regression-7FsE6A` passed compilation, copy lint, 124 server tests
and all 21 tool-test files (nine Net tests). Actual browser recovery passed in
Wander 3D (`/tmp/pons-wardrobe-browser-KNQsP2`) and legacy (`l6TcRp` suffix): a
deliberately rotated fixture secret produces a terminal dialog and one socket,
the explicit action returns to sign-in, and a generated test-wallet signature
recovers the original wallet-owned plant/nickname, 321 Sap, skin and hat through
automatic/manual reload. Both use only eth_requestAccounts, eth_accounts and
personal_sign; zero page errors. This is a simulated provider with real signature
verification, not physical extension/phone acceptance. Inspected the recovery
dialog screenshot `artifacts/partner-preview/identity-recovery-3d.png`.

Shared preview updated with backup `/opt/pons/hd2d-refresh.bplxKU` and candidate
`/tmp/pons-preview-candidate-JXC4Xf`; six players/two plants preserved, active PID
1055119, zero automatic restarts. Public site unchanged. Old clients/backends
require updating for the explicit close signal; guest gardens without a valid
credential or linked wallet are not magically recoverable through this flow.

Duplicate-session follow-up: authenticated replacement now sends an immediate
connection-control notice plus close code 4001. Net stops automatic reconnect
on that signal (including the older server text), while transient failures keep
their retry path. Both renderers clear readiness, cancel wallet work and show a
modal with an explicit reload/takeover button. The original queued error would
be lost when the socket closed before the next persistence commit; only this
connection-control notice bypasses the gameplay outbox.

Box C `/tmp/pons-regression-Q3E30D` passed compilation, copy lint, 124 server tests
and all 21 tool-test files. Actual Chromium two-tab flows passed for Wander 3D
(`/tmp/pons-wardrobe-browser-0E5Pdm`) and legacy (`kBA8B1` suffix), with zero page
errors: old tab disabled/no extra sockets, latest tab remains connected, and
explicit takeover reverses control without an automatic reconnect loop.
Inspected `artifacts/partner-preview/session-replaced-3d.png` for readable modal
layout. Unit checks cover structured/legacy/close-code signals, stale callbacks,
normal backoff, explicit reopen, and invalid credentials not replacing a session.

The shared preview was updated again with the validated refresh script. Retained
backup `/opt/pons/hd2d-refresh.Gni0UY`, candidate `/tmp/pons-preview-candidate-H4vA1H`:
six players and two plants preserved, active PID 1049273, zero automatic restarts.
Refresh already-open clients once to load the new Net implementation. Public
site unchanged. Old-client pairs remain susceptible until updated; recovering
an old device after wallet sign-in rotates its bearer secret needs separate
authentication-recovery verification, not just this same-identity tab test.

Checkpoint interruption follow-up: disk I/O now belongs to the scan supervisor,
not the terminable worker, with at most two outstanding operations. Box C
`/tmp/pons-regression-ZObobO` passes compilation/copy lint, 123 server tests and
all 21 tool-test files. A real worker/HTTP fixture holds the checkpoint write lock
through two worker timeouts, confirms saturated-cache fallback still validates
RPC history, then verifies both writes finish cleanup and cache reuse recovers.
Whole-process crash residue, sustained disk/load testing and release remain open.
No production or shared-preview backend restart.

Broker validation follow-up: exact per-query block range and incoming/outgoing
wallet topic checks now precede global ownership reconciliation. Box C
`/tmp/pons-regression-hXlQGr` passes compilation/copy lint, 121 server tests and all
21 tool-test files, including malformed/filter/range rejection and a valid
multi-range self-transfer fixture. The adapter remains read-only and decorative;
live broker history, drop events and incremental indexing remain outstanding.
No public release or backend restart.

Worker concurrency measurement: Box C `tools/worker-history-profile.cjs` compares
two simultaneous 50k-transfer scans against a separate-process synthetic RPC
provider. Direct and worker snapshots match exactly. Observed event-loop max
delay was 56.89 ms direct versus 14.01 ms workers; sampled RSS was 236,847,104
versus 415,506,432 bytes. Both results and sampling/order limitations are recorded
in CHAIN_READER.md. This provides bounded responsiveness evidence and exposes
the memory tradeoff; sustained gameplay/database/provider load remains unverified.
No production or external-chain state changed.

RPC scans now run in workers by default through readerFromEnv, returning only
completed snapshots to the game process. The existing two-active/16-pending
scheduler waits for worker termination before releasing capacity. V8 heap limits
and a configurable five-minute active scan deadline bound worker lifetime;
these do not certify process RSS or provider capacity. Box C
`/tmp/pons-regression-7D1qbJ` passes compilation/copy lint, 119 server tests and all
21 tool-test files, including a real-worker 2,000-transfer HTTP equivalence test,
deadline termination and sanitized failures. Large concurrent scans and checkpoint
termination-residue recovery remain gates; see CHAIN_READER.md. No public release
or backend restart.

Chain concurrency follow-up: CachedReader retains its 16-wallet pending admission
bound but now starts only two scans at once, queuing the rest. Duplicate wallets
still coalesce; cache hits bypass scanning; failures release slots. Box C
`/tmp/pons-regression-MlBSaQ` passes compilation/copy lint, 117 server tests and
all 21 tool-test files. Browser `/tmp/pons-wardrobe-browser-RpeGwd` passes signed
mock-wallet rejection/retry/link/derived scenery/reconnect/unlink. This reduces
simultaneous history allocation, not single-history CPU/memory or multi-process
load. No public deployment or backend restart.

History processing follow-up: removed redundant whole-history normalization/
copy/sort after separately validated, disjoint ascending block ranges. Saved
checkpoints remain fully validated on load; range/fork/timestamp/balance/finalized
head checks remain. Box C `/tmp/pons-regression-c4BkSS` passes compilation, copy
lint, 115 server tests and all 21 tool-test files, including a new multi-range
HTTP fixture with duplicate self-transfers and out-of-range provider rejection.
This reduces duplicate work but is not yet worker isolation, an aggregate memory
bound or a measured production speedup. No deployment or backend restart.

Long-history baseline now exists: Box C `tools/history-profile.cjs` passes exact
balance/integral/streak checks at 1k/10k/50k synthetic transfers using the compiled
production history functions. The 50k case measured 123,707,096 bytes of additional
heap and 298 ms synchronous validation/reconstruction, excluding RPC/checkpoint
work and concurrency. This is evidence of remaining event-loop/memory risk, not a
passed production load gate. Measurements, exclusions and next engineering focus
are recorded in CHAIN_READER.md. No live provider calls or production changes.

RPC memory-bound follow-up: all RpcReader calls now use a streaming 16 MiB
decoded-body ceiling before JSON parsing; oversize streams cancel and fail with
the existing sanitized/retried read failure rather than publish partial data.
Box C `/tmp/pons-regression-WxPqwI` passes compilation/copy lint, 114 server tests
and all 21 tool-test files. Stream/boundary/malformed-response coverage and limits
are documented in CHAIN_READER.md. Accumulated history/concurrent memory remain
separate unverified limits. No public release or backend restart.

Wallet feedback follow-up: structured cancellation (4001) and internal
account/disconnect changes now have distinct controlled messages in both
renderers, separate from missing-wallet and invalid-signature failures. Silent
account change after signing is classified as a session change. Box C
`/tmp/pons-regression-qiie3u` passed compilation/copy lint, 111 server tests and
all 21 tool-test files (nine wallet-session tests). Build passed with existing
warnings. Browser `/tmp/pons-wardrobe-browser-s13wi7` verifies the cancellation
message plus unchanged guest state and successful retry/derived-land/reconnect/
unlink. No live wallet access, public deployment or backend restart.

Wallet cancellation/discovery checkpoint: browser `--wallet-new --wander
--wallet-reject --wallet-provider=<id>` passes for metamask, phantom, coinbase
and rabby using EIP-6963 announcements only, no legacy flags. A rejected first
signature leaves guest identity, plant, Sap and plot count unchanged; retry
without reload succeeds, followed by mock-derived 3D scenery, reconnect and
unlink checks. Exact RPC method sequence contains only account reads and two
personal_sign requests (one rejected). All four Box C processes exited 0 with
zero page errors. Run directories and limitations are recorded in
STONKBROKER_INTEGRATION.md. Only harness/evidence changed; no release or real
wallet interaction. Installed-extension and phone acceptance remain unverified.

Wallet integration checkpoint: `--wallet-handoff --wander` exposed a real Land
panel bug: wallet click listeners were registered before an innerHTML append
replaced their buttons. Listeners now attach after all panel HTML is complete.
Before the fix, two browser runs timed out without any provider request. After
the fix, Box C `/tmp/pons-regression-XJ17uj` passed compilation, copy lint, 111
server tests and all 21 tool-test files; Vite build passed with existing warnings.
Browser `/tmp/pons-wardrobe-browser-on0KAh` passed with zero errors/exit 0:
actual Land-button click, simulated provider, generated test-key signature,
server verification, guest-to-existing-wallet identity handoff, automatic reload
and manual reload retain saved plant/nickname/Sap/skin/hat. Exactly one signature
was requested and only account-read/sign-in methods were used. No real accounts
or funds were touched. This closes one browser identity-handoff gap, not live
RPC derivation, real extension/phone-wallet acceptance or all recovery cases.
No public deployment or backend restart.

First-time wallet browser path: `--wallet-new --wander` passed on Box C at
`/tmp/pons-wardrobe-browser-KtFHvV`, zero page errors/exit 0. The harness generates
a test key whose deterministic MockReader landscape has expanded plots, a tree
and decoration; it does not replace runtime land state. Actual Land-panel wallet
click, nonce/signature verification and server derivation yield the expected
private land fields/public decor count, 18 plots, epic floor, stage-4 3D tree and
four 3D decoration models. The original crop and 1000 Sap remain intact. Reload
preserves linked state; actual unlink and another reload preserve the crop and
expanded plot count while clearing the address and wallet-decoration models.
Only account-read/message-signing methods occur. Existing-owner handoff rerun
also passed at `/tmp/pons-wardrobe-browser-lyiBTV`. Only harness/evidence changed.
This is signed browser-to-server integration with mock chain data, not live RPC,
actual broker contract data, real extension approval, or physical-device QA.

Latest explicit visual direction: true 3D like Wander Around, with matching
characters/aesthetic, supersedes HD-2D as the final visual target. See
WANDER_3D_DIRECTION.md for discovered source variants and the opt-in perspective
scaffold. Existing HD-2D evidence below remains regression evidence only; it
does not satisfy the new 3D requirement. Final reference selection, volumetric
characters/plants/environment, interactions, camera and device acceptance remain.

| Area | Current evidence | Remaining |
| --- | --- | --- |
| True 3D target | Opt-in perspective/orbit; Wander-family local/remote players and six NPCs; saved wardrobe sync; all 22 base plant models with five growth stages and wild-model projection; roster completeness check; carry size/mutation metadata; material-retention regression fixed | Full environment conversion, plant idle/gag animations, carried poses/effects, per-species gameplay acceptance, final art acceptance, physical-device QA and sustained rendering performance; see WANDER_3D_DIRECTION.md |
| HD-2D | Playable preview; planting/reveal, saved identity, desktop/phone layout and 2D fallback inspected; shared joystick pointer ownership/lifecycle reset with three input tests | Full feature/browser parity, occlusion/effects polish, actual touch-device interaction, load/performance, renderer consolidation |
| Persistence | PostgreSQL adapter and isolated database tests; atomic state/ledger; commit-before-send; carried-plant restart recovery; backup restored into separate test DB | Durable production database/service, migration, scheduled/off-host backups, load/latency and ledger growth |
| Game correctness | Aggregate 92 server tests pass, including 24 raid/shop/bounty tests, bell/gnome behavior, bounty expiry persistence and cross-village defense isolation; two-browser real movement/theft/banking/reconnect checks | Broader automatic-defense combinations, sustained multiplayer/abuse scenarios and full feature acceptance across final 3D art |
| Security | Browser-controlled legacy import and identity-leaking remote WebSocket overrides removed; runtime validation of every client message and prototype purchase guards; real WebSocket rejection/reconnect/purchase checks and aggregate server suite pass on Box C; see SECURITY_FINDINGS.md | Broader origin/rate-limit/dependency review, integrated abuse/load tests and approved production deployment |
| Chain reader | Finalized-block history reconstruction, bigint reconciliation, per-token decimals, bounded retries/cache and fork checks; persistent incremental history checkpoints with anchor verification and corruption/quota fixtures | Real configured contracts/provider history and known-wallet verification; long-history profiling, checkpoint directory lifecycle/multiprocess coordination; see CHAIN_READER.md |
| Broker decoration | Opt-in adapter implements NFT history/ownership reconciliation, collection-backed TBA resolution and supported-stock discovery; seven fixture tests including visual-only invariant | Verified deployment block, live known-wallet scans, incremental indexing and drop-event history; production configuration |
| Wallets | Provider-bound single-use sign-in; eight provider-fixture tests; both-renderer cancellation; five signed server race tests; six reconnect transport tests (stale sockets, timers, close/reopen, backoff) | Phone-wallet support/project config, actual extension/browser flows, end-to-end recovery and identity-handoff persistence validation |
| Oracle | Guide-backed planting/defense replies; live browser Ada planting response; correlated requests, stale/late reply rejection, timeout and rejected-question feedback tests | Broader phrasing/retrieval quality, NPC voice, raw-service session retention/privacy and speech-bubble correlation; see ORACLE_VERIFICATION.md and WANDER_3D_DIRECTION.md |
| Product completeness | Village, town missions, raids, cosmetics and share pages exist; bounded fixed-TTL share cache; isolated HTTP/PNG/provider-failure checks and visual PNG inspection pass | Replay/clip export, seasonal content workflow, roster decision, saved-player share lifecycle checks and HD-2D visual parity |
| Release | Partner preview deployed with preserved saves and recovery artifacts; 200-client file/mock protocol smoke passed (see PARTNER_PREVIEW_RELEASE.md); wardrobe and nickname fixes staged only | Black-screen report awaiting fresh-tab visual confirmation; broader security review, sustained full-game/database load, rollback rehearsal, operations checks and final release decision |

Owner-only inputs/actions: approved PONS deployment and ecosystem list;
account access/configuration when unavailable; wallet transaction confirmations;
funding, binding terms and release decisions. Research and implementation should
continue wherever they do not depend on those inputs.

Runtime/security follow-up: Vite dependency patch and full npm audit pass;
Node 22.23.2 is staged and passes server/client, HTTP, PostgreSQL integration,
browser and three-minute 200-client protocol checks. It is not deployed.
Last inspected production state runs as root without filesystem isolation; see
RUNTIME_UPGRADE.md and SERVICE_HARDENING.md. Isolated least-privilege service
verification passed; applying that configuration and the reviewed runtime switch
to production remain release requirements.

## Aggregate regression checkpoint — 2026-09-08

`tools/regression-check.cjs` now compiles server sources, typechecks the client,
runs copy lint, all compiled server test files and every `tools/*.test.ts` file.
It refuses a database URL outside the isolated Box C `pg-check` socket directory
pattern, strips inherited PONS configuration and retains logs/results on failure.
It does not build/publish browser assets, restart services or contact live wallets.

Box C patched Node v22.23.2 run `/tmp/pons-regression-3s8SKw` passed:

- 92 server tests, zero failures/skips, including real isolated PostgreSQL
  commit/restart/migration checks, read-only chain/broker fixtures and validation.
- All 11 tool test files (camera input/obstruction, correction, garden wardrobe,
  joystick, movement, network lifecycle, plant models, wallet, wardrobe, WS URL).
- Server compile, client typecheck and copy lint.

This is aggregate automated regression evidence for the Box C source mirror,
not live contract/provider verification, a full browser/device sweep, production
security certification or a completed-game claim. The detailed evidence is in
that run's `results.json` and per-check logs. No production release was performed.

Repeated after full base plant roster integration: `/tmp/pons-regression-9cD4Il`
passed the same aggregate gates, including the expanded 22-species/110-growth-model
test. All three saved-plot browser batches passed on that client build; see
WANDER_3D_DIRECTION.md. These remain bounded regression checks, not release approval.

Latest aggregate after buildings, plaza props, trees and perspective label layout:
`/tmp/pons-regression-KcqDst` on Box C Node v22.23.2 passed server/client compilation,
copy lint, 92 server tests (zero failures/skips), and all 15 tool-test files.
The server log explicitly confirms all 14 persistence checks, including real
isolated PostgreSQL commits, rollback/retry, second-writer refusal, ledger mutation
rejection and restart/import preservation. Retained test database:
`pons_storage_test_11a7d47f4e1f4b61bb52930d654e81e8`.
New tool coverage includes building/plaza/tree geometry and label layout. This
run did not rebuild assets, restart services, deploy, or verify live owner wallet
and contract configuration. The preceding perspective browser run is documented
in WANDER_3D_DIRECTION.md; physical devices and sustained performance remain gates.

Checkpoint-store concurrency follow-up: `/tmp/pons-regression-GEcCfZ` passed
94 server tests, all 15 tool-test files, compilation and copy lint. Shared-directory
quota admission now uses a cross-process lock; bounded descriptor reads reject
symlinks. Eight-process quota and simulated abandoned-lock checks passed. See
CHAIN_READER.md for offline lock recovery limitations. No service restart/deploy.

Latest regression `/tmp/pons-regression-8H7LGr`: 94 server tests (zero skips/fails),
19 tool-test files, compilation and copy lint passed after gate/defense models
and server-clock patrol correction. The correction removes Renderer3D's page-time
versus server-epoch gnome-position mismatch. Browser defense purchase/reload and
patrol-phase checks passed; actual gnome tagging/recovery and latency acceptance
remain pending. See WANDER_3D_DIRECTION.md. No production restart/deployment.

Forage hardening: collection now checks the wild plant's expiry against server
time at intent handling, closing the gap between periodic cleanup ticks.
`/tmp/pons-regression-NnIK04` passed 99 server tests (zero failures/skips), all
21 tool-test files, compilation and copy lint. New server cases cover competing
intents/replays awarding one persisted seed, exact-deadline expiry rejection,
range, inventory capacity and village isolation. These are server-level fixture
tests, not two-browser network contention measurements. Real browser forage of
a server-spawned Weeping Wumbus passed at `/tmp/pons-wardrobe-browser-FCEPuY`,
including matching seed, model cleanup and reload, zero page errors. No production
restart or public deployment; staged server changes still require release.

Sprint hardening: active laps now retain the starting socket and village and
cancel if either changes. The last rewarded finish is stored as optional
server-owned `PlayerRec.lastSprintAt`, so restarting no longer clears the reward
cooldown. Existing saves without the field remain valid. Finish time, reward,
leaderboard and cooldown are saved with the existing generation/ledger workflow.
Box C `/tmp/pons-regression-OalaJL` passed 104 server tests, zero failures/skips,
all 21 tool-test files, compilation and copy lint. New fixture tests verify the
fountain checkpoint, exactly-once reward/leaderboard entry, cooldown after store
reopen and cancellation on socket/village change, timeout or carrying a plant.
These tests position fixtures directly; real browser lap traversal and leaderboard
UI acceptance remain pending. No public deployment or service restart.

Sprint browser follow-up passed at `/tmp/pons-wardrobe-browser-pj4R8B`
(`--sprint --wander`). Normal pathfinding reaches the track, triggers the start,
visits the fountain checkpoint and returns in 9490ms. The first-record award is
exactly 70 Sap (1000 to 1070), one leaderboard entry appears in the notice-board
UI, reload preserves it, and an immediate retry is rejected by cooldown with no
extra reward/entry. Inspected `artifacts/partner-preview/sprint-board-3d.png`.
Zero page errors; no positions, speed, time, or server sprint rules overridden.
This closes the single-client real-lap/UI gap, not competitive multi-client,
physical-device or high-latency acceptance. No public deployment or asset rebuild.

Mission reward coverage: `/tmp/pons-regression-AmPR42` passed 106 server tests,
zero failures/skips, all 21 tool-test files, compilation and copy lint. New tests
exercise all ten mission definitions: early/repeated claims do not pay, progress
caps at target, accepting again does not reset progress, and each completion pays
its defined reward once. Daily locks survive reopening the store; next-day
acceptance works. NPC range and the active-mission cap are enforced. No gameplay
change was needed. These tests invoke progression directly, so full browser
accept/activity/return/claim coverage remains separate. No public deployment.

Real mission workflow: `--sprint-mission --wander` passed at
`/tmp/pons-wardrobe-browser-DIdPmI`. The browser walks to Pell, accepts Warm up,
runs the track/fountain lap (9687ms), reloads while ready to claim, verifies the
sprint cooldown, returns to Pell and claims 60 Sap on top of the 70-Sap lap award
(1000 to 1130 total). The completed mission button is disabled, and another
reload preserves completion with no active copy. Inspected
`artifacts/partner-preview/sprint-mission-3d.png`; zero page errors. No forced
positions/progress, timing overrides or synthetic mission completion. This proves
one full mission UI workflow, not all ten activities end to end. No deployment.

3D plot-condition follow-up: the Wander renderer now replaces the flat weeds
sprite with five static green perimeter clumps, anchored to the plot rather than
following feral-plant movement. Existing public `weedy` state controls presence;
no tending rules, network fields, colliders or default-renderer behavior changed.
Box C `/tmp/pons-regression-agwaFG` passed compilation, copy lint, 106 server
tests and all 21 tool-test files. Initial geometry bounds failed; shorter leaves
fixed the below-ground bounds before the passing run. Vite build passed (existing
large-chunk and runtime sprite-path warnings remain).
Browser `--plants --wander --weeds` passed at
`/tmp/pons-wardrobe-browser-pSWAfn`: synthetic public-condition transitions create
ten weed meshes without a sprite duplicate, then remove them and dispose every
tracked geometry/material. This is rendering/lifecycle coverage, not real tending
end to end. Inspected `artifacts/partner-preview/weeds-3d.png`; clumps remain small
at the wide garden camera, so close-camera/mobile readability needs acceptance.
No public deployment or backend restart.

Real tending follow-up: Box C browser `--tend-weeds --wander` passed at
`/tmp/pons-wardrobe-browser-wyyF3L`, zero page errors. The isolated saved plant
starts revealed and last tended 21 minutes ago; no runtime clock or position
override is used. Normal pathfinding and a projected ground mouse click perform
the real tending request. Private lastWeeded advances, public weedy clears,
the 3D weed root detaches, and displayed income recovers from 0.5 to 1 Sap/s.
A repeated click leaves lastWeeded unchanged during cooldown; reload preserves
the tending timestamp and clean public/model state. This does not prove exact
reward accounting, remote-client propagation, server restart, or mobile input.
Earlier run `/tmp/pons-wardrobe-browser-ax9kSK` also passed before income-rate
assertions were added. Its inspected `artifacts/partner-preview/tend-before-3d.png`
has the player occluding the plant, so it is not visual-readability acceptance.
Only the browser harness and this evidence changed; no production release.

Plant/tend server authorization: client pathfinding enforced a 40-pixel plot
interaction radius, but the authoritative handlers previously accepted these
intents from any position or visited village. Both now require a valid owned
plot, the home village, and server position within 40 pixels of its center before
mutating seeds, growth, weeds, rewards or mission progress. No economy values or
chain behavior changed. New tending tests cover distance/village/invalid-index
denial, the inclusive distance boundary, seed replay, one-time watering, exact
30-Sap base-plant tending reward, repeated-request cooldown and store reopen.
Box C `/tmp/pons-regression-WSEaIg` passed compilation, copy lint, 110 server
tests and all 21 tool-test files. Browser runs against the new isolated backend:
`/tmp/pons-wardrobe-browser-NdOMXd` passed real tending, restored income, weed
cleanup and reconnect; `/tmp/pons-wardrobe-browser-h5WDS0` passed starter purchase,
bag selection, normal path, perspective mouse planting/watering, real timed
growth/reveal, income and reconnect. Both had zero page errors. These establish
normal browser compatibility with the new checks, not exhaustive latency/device
coverage. Production and shared-preview backends have not been restarted.

Authored 3D idle: mature Tulip of Low Ambition now performs its roster's
"nods off" gag: seven seconds at rest followed by a smooth five-second nod,
maximum 0.18 radians. Its batched body has a separate transform from stationary
soil; no terrain motion or gameplay changes. Reduced-motion media preference
disables this nod immediately, including preference changes during play. This
does not yet make all existing effects reduced-motion compliant.
Box C `/tmp/pons-regression-65mabJ` passed compilation, copy lint, 110 server
tests and all 21 tool-test files, including body bounds, fixed soil, periodic
reset, nonfinite time and reduced-motion checks. Vite build passed with the
existing asset-path/large-chunk warnings. Browser
`--plants --plant-page=1 --wander --idle` passed at
`/tmp/pons-wardrobe-browser-REUbdU`: actual frames animate, toggling reduced motion
stops the body, clearing that preference resumes it, with unchanged soil
rotations and zero page errors. Inspected `artifacts/partner-preview/tulip-nod-3d.png`;
wide-camera static screenshot alone cannot establish motion readability. Other
species' authored idle gags, close-camera/device acceptance and full animation
polish remain unfinished. No public deployment or backend restart.

3D wardrobe skin tones: six free palette choices now travel through the validated
wardrobe intent, optional saved PlayerRec field, private state and public player
appearance. Existing saves default to the original #f0d4a8. Both local and remote
Wander avatars rebuild with the selected skin material while retaining paid
shirt/hat state. Combined requests remain atomic, including a free skin change
bundled with an unaffordable shirt. Skin controls are enabled for the Wander
perspective selection only when the server supplies the new skin field; older
backends therefore hide them. Legacy sprite rendering remains unchanged.
Box C `/tmp/pons-regression-xCqeCN` passed compilation, copy lint, 111 server
tests and all 21 tool-test files; Vite build passed with existing warnings.
Tests cover free choice, invalid values, default migration, commit-before-broadcast,
restart persistence, atomic denial and free/hidden UI controls. The first test
run checked messages before commit and was corrected to respect the durable outbox.
Two-client browser `--appearance --wander --skin` passed at
`/tmp/pons-wardrobe-browser-optN7O`: six actual wardrobe buttons, tone 5 selection,
local/remote appearance and actual remote material color, reconnect preservation,
and independent avatar materials; zero page errors and process exit 0.
Inspected `artifacts/partner-preview/skin-wardrobe-3d.png`. Shirt/hat thumbnails
are still the old sprite previews and do not reflect the selected skin; a proper
3D outfit preview and physical-phone acceptance remain work. No public deployment
or preview-backend restart; the new controls require the paired server release.

3D outfit thumbnails now render from the same VisualAvatar/wardrobe mapping as
the game, including the saved skin tone, each candidate shirt and each hat.
The shop dynamically loads the preview module only in Wander perspective mode
(explicit r=2d excluded). A bounded 32-image PNG cache stores no live avatars or
GPU contexts; temporary avatar resources, renderer and context are disposed after
each missing-image batch. Stale async imports cannot paint a newer panel/state.
If rendering/import fails, existing sprite fallback leaves the controls usable.
Box C `/tmp/pons-regression-D8NBJj` passed compilation, copy lint, 111 server
tests and all 21 tool-test files; Vite build passed with existing warnings.
Two-client browser `--appearance --wander --skin` passed at
`/tmp/pons-wardrobe-browser-APCJit`, zero errors/exit 0: all ten 128x128 previews
load for selected tone 5, distinct outfit images differ, three shop reopenings
allocate no extra contexts, and only the game's context remains live. Existing
local/remote tone, actual material and reconnect checks also pass. Inspected
`artifacts/partner-preview/outfit-thumbnails-3d.png`: full characters and headwear
fit their cards. This is not physical-phone performance, cache-eviction stress,
forced thumbnail-failure testing or an interactive turntable preview. No public
deployment or backend restart.

Wardrobe preview failure isolation: a failed thumbnail graphics/render attempt
now stops further thumbnail GPU attempts until reload, retaining cached images
and sprite fallbacks. This prevents periodic shop refreshes from repeatedly
retrying an unavailable secondary context. Box C `/tmp/pons-regression-bAKJLE`
passed compilation, copy lint, 111 server tests and all 21 tool-test files; Vite
build passed. Browser `--appearance --wander --skin --preview-failure` passed at
`/tmp/pons-wardrobe-browser-OZrToi`, zero page errors and exit 0. After normal
thumbnail/skin checks and reload, the test denies only secondary canvas contexts:
ten fallback controls remain, a real skin change reaches local/remote avatars,
three reopenings plus periodic refresh cause no additional context attempts,
and keyboard camera movement works with the world context intact. This injected
creation-failure check is not a reproduction of Ben's original black screen or
physical GPU exhaustion. Initial browser attempt failed during screenshot scroll
on a replaced DOM button; synchronous scrolling corrected that harness race.
No public deployment or backend restart.
