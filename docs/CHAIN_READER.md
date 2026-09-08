# Read-only chain reader

## Configuration

RPC mode requires all of `PONS_RPC_URL`, `PONS_TOKEN`, `PONS_CHAIN_ID`, and
`PONS_FROM_BLOCK` (the token deployment block). `PONS_DECIMALS` defaults to 18
and must match the contract's `decimals()` response. Partial RPC configuration
fails startup instead of silently showing mock holdings. The deterministic demo
reader is selected only when all chain settings are absent. Setting only chain
ID, deployment block, decimals or ecosystem allowlist is also a configuration
error; empty URL/token placeholders count as configured, not as opting into demo.
For demo deployments, unset chain variables rather than assigning empty strings.
Numeric settings reject empty/whitespace-only values instead of converting them
to zero. Explicit `0` remains valid for deployment blocks and token decimals.

Startup hardening checkpoint: Box C aggregate `/tmp/pons-regression-Gf8SdC`
passed compilation, copy lint, 125 server tests and all 23 tool-test files.
Tests cover isolated partial settings, blank numerics, explicit zero, unchanged
unconfigured mock selection and configured worker selection. Malformed RPC URLs
now produce a sanitized error without the URL parser's credential-bearing input
or cause. This verifies configuration handling, not a real provider/contract
connection. No live environment or service was changed.

`PONS_ECOSYSTEM` is an owner-approved comma-separated `SYMBOL:address` list of
meme tokens only. Every token uses its own on-chain decimals. Do not put stocks
or broker NFTs in this list: they must use the separate decoration adapter.
Keep authenticated RPC URLs in server environment configuration, not source or
client bundles. No production contracts have been enabled by this change.

## Snapshot guarantees

- Check the endpoint chain ID. Pin to the finalized head; providers must support
  finalized blocks and historical state/log queries. There is no silent latest fallback.
- Scan Transfer logs in 2,000-block windows, validate/sort by block and log index,
  deduplicate incoming/outgoing query overlap, and reject mixed forks.
- Integrate raw bigint balances using actual block timestamps. Self/zero
  transfers do not affect holding streaks; empty-wallet periods are excluded.
- Reconcile history exactly with balanceOf at the pinned block. Missing logs,
  unsupported rebasing behavior, or wrong deployment configuration must not
  silently grant land. Validate every event block hash and recheck the head hash.
- Only four JSON-RPC methods are allowed: eth_chainId, eth_call, eth_getLogs,
  eth_getBlockByNumber. Network requests have a 15-second timeout and three
  attempts; error messages exclude provider bodies and endpoint credentials.
- Cache results for five minutes, coalesce concurrent requests for one wallet,
  cap cache at 1,000 entries and active distinct-wallet reads at 16, and return
  isolated copies. Failed snapshots are never cached.

These use the standard [Ethereum JSON-RPC block and log semantics](https://ethereum.org/developers/docs/apis/json-rpc/).

## Verification and remaining work

Signed-link failure integration is now covered in `wallet-race.test.ts`:
an existing linked record with a purchased seed remains unchanged through a
provider exception and commit; its live socket remains active, provider details
are not sent, the nonce cannot be reused, and a fresh signed retry succeeds.
A rejected old read cannot send an error into a newer signed attempt. Box C
aggregate `/tmp/pons-regression-HWRdA1` passes 127 server tests and all 23 tool-test
files. These controlled reader failures cover the Game integration boundary,
not real-provider availability or real wallet-extension behavior.

On Box C: `npm --workspace server run build`,
`npm --workspace server run test:chain`, `npm --workspace server test`.
The chain suite uses a local HTTP RPC fixture plus pure history tests. It checks
duplicate/self/zero transfers, same-block ordering, sell-out/reacquisition,
bigint precision, malformed/missing/forked data, configuration guards, cache
isolation/eviction/retry, pinned reads, separate decimals, HTTP retry, wrong
network rejection, and head-change rejection. It does not prove a real provider
or deployment works.

Still required: persistent incremental history indexing (full scans can be slow
and costly), provider-specific log limits, real known-wallet verification,
first-transaction indexing for walletAgeDays, and broker drop-history reads plus
live verification. walletAgeDays currently reports 0/unavailable rather than
mislabeling the first PONS transfer as the wallet's first transaction. It is not
currently consumed by the garden derivation. The optional broker NFT/TBA and
stock-kind adapter is implemented and fixture-tested; configure
`PONS_BROKER_NFT` and `PONS_BROKER_FROM_BLOCK` together in RPC mode. Details and
verified ABI provenance are in `STONKBROKER_INTEGRATION.md`. The chain test
command also runs seven broker tests, including decoration-only derivation.

The production service and existing preview processes are not restarted by
building/testing this code.

## Optional incremental PONS-history checkpoints

### RPC worker isolation

Concurrent benchmark follow-up: Box C `node --expose-gc
tools/worker-history-profile.cjs` runs a loopback synthetic RPC provider in a
separate child process, then compares two concurrent 50,000-transfer scans through
direct versus worker-backed CachedReader. Ten 5,000-event responses per wallet
fit the response ceiling; only ten distinct event blocks are used per wallet.
Both modes verify exact balance/integral and produce identical complete snapshots.
Observed single-run measurements on Node v22.23.2:

| Mode | Elapsed ms | Event-loop max ms | Event-loop p99 ms | Sampled process RSS bytes |
| --- | --- | --- | --- | --- |
| Direct | 1,090.31 | 56.89 | 56.89 | 236,847,104 |
| Workers | 1,026.15 | 14.01 | 13.04 | 415,506,432 |

Workers reduced measured parent-loop stalls in this run, but process memory rose:
RSS includes the worker threads, excludes the separate provider process, and is
sampled every 10 ms rather than a precise peak. Modes execute sequentially,
direct first, with parent GC before each; allocator retention/order effects remain.
This is not a sustained game-client/PG workload, live-provider test, checkpoint
stress or many-distinct-block scan. It does not establish general speedup or a
safe production capacity. Worker/provider cleanup completed and process exited 0.

The environment factory now selects `cached(rpc-worker)` for configured RPC mode.
Mock mode is unchanged. Each admitted scan starts a worker running RpcReader:
fetching, RPC JSON parsing, checkpoint payload validation, history reconstruction
and broker reads happen there. Finished ChainSnapshots and bounded serialized
checkpoint requests return to the parent; checkpoint disk I/O is supervised as
described below. The
two-scan cache scheduler waits for worker termination before releasing its slot.
Workers use V8 limits of 256 MiB old generation, 32 MiB young generation and a
4 MiB stack. These are not a process RSS or external-buffer memory guarantee.

`PONS_CHAIN_SCAN_TIMEOUT_MS` sets active scan duration, default 300000 (five
minutes), permitted integer range 1..1800000. It requires RPC configuration.
Expiration terminates the worker and fails the scan without caching partial
results. The deadline starts when admitted work begins, not while queued.
Provider/worker details remain sanitized; startup configuration still validates
synchronously. The full compiled chain-reader directory, including rpc-worker.js,
must be part of a release. Direct RpcReader remains available to tests/tools but
does not itself provide worker isolation.

Box C `/tmp/pons-regression-7D1qbJ` passes compilation/copy lint, 119 server tests
and all 21 tool-test files. A real worker matches the direct reader on 2,000
incoming transfers from a loopback HTTP fixture, including exact balance/integral;
tests also cover deadline termination, sanitized worker failure and invalid
timeout settings. Earlier empty-history run `/tmp/pons-regression-s3oWhu` passed.
Heap-limit fault injection and sustained RSS remain verification gates. The
later supervised-checkpoint change below prevents worker termination from
abandoning disk writes; whole-process crash residue still needs recovery.
No production configuration or service restart occurred.

### Checkpoint I/O survives scan-worker termination

WorkerRpcReader now owns CheckpointStore in the supervising process. The worker
receives no history directory and exchanges load/save requests through its
private message port. It serializes and parses checkpoint payloads; the parent
handles bounded envelope encoding/decoding, digest checking and filesystem I/O.
Payloads are capped at 4 MiB before transport; the existing final envelope/file,
total-byte and entry limits still apply. No chain validation is delegated to the
cache or skipped after a cache miss.

At most two checkpoint operations per WorkerRpcReader may remain outstanding,
independently of scan admission. When disk work is saturated, loads miss and
saves skip, allowing verified RPC reads to proceed without an unbounded disk
queue. Already admitted disk operations finish their normal finally cleanup even
when their requesting worker exits. A fully validated history checkpoint may
finish committing after that scan times out; no partial ChainSnapshot is cached.

Box C `/tmp/pons-regression-ZObobO` passed compilation/copy lint, 123 server tests
and all 21 tool-test files. The real 2,000-transfer HTTP/worker fixture verifies
reopened checkpoint reuse without old-log RPC queries, then pauses the actual
parent-side rename while holding the cache lock. Two real worker deadlines expire;
a third scan bypasses the saturated cache and matches the direct RPC snapshot.
Releasing disk I/O commits exactly the two admitted writes, removes their locks
and temporary files, and a new worker successfully uses the cache again.
Serialized transport tests cover bounds, round trips and malformed payloads.

This does not steal old locks, clean existing crash residue or protect against
termination of the entire supervising process. It does not prove physical-disk
failure recovery, sustained-load latency or an OS RSS bound. No backend restart
or public deployment was performed.

CachedReader now admits at most 16 distinct pending wallets as before, but runs
only two underlying scans concurrently by default. Remaining admitted wallets
wait FIFO, without allocating their raw history yet. Same-wallet requests share
the pending result and receive independent clones. Cache hits bypass the scan
queue; failure releases a slot and permits retry. The constructor's optional
fourth argument accepts concurrency 1..16 for controlled tests/embedding; the
production factory uses two. This is per CachedReader instance, not a global
cross-process limit. Long individual scans still need total-duration/cancellation
and history-memory work. Direct readers without WorkerRpcReader are not isolated.
Box C `/tmp/pons-regression-MlBSaQ` passes compilation/copy lint, 117 server
tests and all 21 tool-test files. Controlled scan tests verify peak concurrency,
16-wallet admission, queued duplicate coalescing, independent results and
failure-slot recovery. Signed mock-wallet browser retry/link/3D-land/reload/unlink
also passes at `/tmp/pons-wardrobe-browser-RpeGwd`. No production restart.

### RPC response resource boundary

Broker range validation follow-up: each incoming/outgoing log response must be
an array whose events lie in that exact requested block interval and match the
requested wallet topic/direction. The previous global ownership reconstruction
checked only the full scan bounds, allowing a response from a different interval
to be accepted if it happened to reconcile later. Invalid responses now abort
before scanning further ranges. Complete log validity, fork/duplicate checks,
NFT balance/owner reconciliation and TBA agreement still run afterward.
Box C `/tmp/pons-regression-hXlQGr` passes compilation/copy lint, 121 server tests
and all 21 tool-test files. New fixtures reject a future-range event, wrong
direction and non-array result, and accept a three-range history with duplicated
self-transfers. Initial compile caught missing parameter types in the new test
callbacks; corrected before the passing run. This is fixture evidence, not live
broker history verification. Drop-event history and incremental broker scans
remain incomplete; no production restart/deployment.

RpcReader now reads response bodies through `rpc-json.ts`, counting actual
decoded stream bytes before JSON parsing, with a 16 MiB per-response ceiling.
It does not trust Content-Length. Oversized streams are cancelled; invalid UTF-8,
malformed JSON and missing bodies fail closed. The existing three-attempt bounded
retry and sanitized error handling remain. Responses are never silently truncated
into an accepted chain snapshot. A legitimate response above the ceiling will
fail the read and requires smaller log ranges/provider investigation; raising
limits blindly is not a recovery plan.

Box C `/tmp/pons-regression-WxPqwI` passes compilation, copy lint, 114 server
tests and all 21 tool-test files. New streamed Response tests cover exact byte
boundary, split multibyte text, misleading length header, cancellation before
an endless body is consumed, lock cleanup, invalid UTF-8/JSON and absent bodies.
Existing RPC/history fixtures also pass. This bounds an individual parsed HTTP
body, not the total accumulated history, concurrent-reader memory or JSON object
overhead; long-history profiling and aggregate scan limits remain work.
No live provider or production configuration changed.

`chain-reader/src/checkpoint-store.ts` supplies optional storage for RpcReader.
Set `PONS_HISTORY_DIR` to a private directory owned by the game service in RPC
mode; configuring it without RPC mode fails startup. It writes private (0600) digest-checked, versioned envelopes
under hashed scope keys with temporary-file rename. Corrupt/missing/oversized
entries return cache misses. Two Box C tests pass for reopen persistence, key
separation, corruption rejection, private file permissions, same-instance
concurrent admission limits, and preserving a valid record after rejected writes.

Defaults bound each file to 4 MiB, steady-state records to 64 MiB and 512 entries;
atomic replacement temporarily also holds the new file. Quota accounting is
serialized within an instance and guarded across processes by atomic creation of
`.write-lock`. Contention skips an optional cache write without waiting. Processes
sharing a directory must use identical quota configuration. Failed/capacity-limited
writes must not become failed chain reads. Reads use a bounded file-descriptor
read and reject symlinks/non-regular files.

A killed supervising process (or direct RpcReader process) can leave `.write-lock`
and a temporary file. A scan-worker timeout no longer interrupts these writes.
Locks are never
automatically stolen based on age, which could race a paused writer. Reads of
previous checkpoints remain available, but further writes skip until recovery.
For recovery, stop every reader using the directory, verify no writer remains,
inspect the exact configured directory and remove only its empty `.write-lock`
and identified checkpoint `.tmp` residue, then restart. Do not remove game saves
or arbitrary directories. Automatic crash-residue recovery remains outstanding.

History checkpoints are keyed by chain/token/deployment/decimals/wallet. The
reader checks structure, log validity, timestamp order and the saved balance
reconstruction, then rechecks the finalized anchor hash and timestamp over RPC.
A matching anchor permits fetching only subsequent 2,000-block ranges; unchanged
heads need no Transfer queries. A changed anchor forces a full rescan; finalized
head regression fails closed. Each fetched range is validated independently.
The reader still reconciles against the new pinned balance and checks the final
head hash before publishing a checkpoint. Other ecosystem balances and broker
decorations are still freshly read; broker history is not accelerated here.

All 86 server-test entries pass on patched Node with the isolated PostgreSQL
database. RPC fixtures verify reopening a reader against saved checkpoints,
only-new-range requests, unchanged-head request elimination, exact integral/
balance/streak values, anchor invalidation/full rescan, malformed checkpoint
fallback, deployment-config key separation and retention of the last valid
checkpoint after a failed final hash check. These fixtures do not prove a real
provider or deployed contract works. Oversized/full/unwritable cache storage
degrades to full scans; caches are optional acceleration, not game saves.

A digest is corruption detection, not cryptographic authorization. Checkpoint
files must remain trusted service-owned data. Each instance recomputes the
integral over saved logs locally; only provider history requests are incremental.
Long-history CPU/memory profiling, automated cache-directory lifecycle recovery and
live known-wallet validation remain required. No production configuration changed.

### Local history-processing baseline on Box C

Subsequent optimization: snapshot no longer re-normalizes, clones and sorts the
entire accumulated history after validating each range. A valid checkpoint
already contains canonical logs; new ranges begin strictly after its head and
are fetched in disjoint ascending order. Each range still rejects out-of-range
events, malformed data, duplicates that conflict and mixed block hashes before
concatenation. Final timestamp, balance and finalized-head checks remain.
Checkpoint arrays are reused within this private snapshot rather than copied.
Box C `/tmp/pons-regression-c4BkSS` passes compilation/copy lint, 115 server tests
and all 21 tool-test files. A new real-HTTP fixture spans three ranges, checks
incoming/outgoing/self-transfer integration and rejects a provider returning an
old event in a later requested range; existing checkpoint/fork cases also pass.
This removes one full-history validation/copy pass, but does not yet bound total
history, move processing off the game loop or establish measured end-to-end
speedup. The baseline below measures one normalization/reconstruction pass,
not a before/after full snapshot comparison. No production restart.

`node --expose-gc tools/history-profile.cjs` on patched Node v22.23.2 now exercises
1,000, 10,000 and 50,000 synthetic incoming transfers through the actual
orderedTransfers/reconstructHistory functions. Each uses a distinct block,
verifies exact final balance, holding-time integral and streak, and forces GC
before allocating the next case. The run passed with these observed results:

| Transfers | Validation ms | Reconstruction ms | Final heap delta bytes | RSS bytes |
| --- | --- | --- | --- | --- |
| 1,000 | 10.70 | 2.25 | 3,431,600 | 57,667,584 |
| 10,000 | 67.46 | 5.60 | 29,983,432 | 97,042,432 |
| 50,000 | 258.55 | 39.49 | 123,707,096 | 207,687,680 |

This single-run baseline is not a capacity or performance acceptance claim. Raw
logs remain alive during normalization, as they do in snapshot; heap samples are
not peak heap measurements, and process max RSS is cumulative. RPC fetching,
response JSON parsing, checkpoint serialization/revalidation, outgoing/duplicate
events and concurrent readers are excluded. At 50,000 transfers the synchronous
validation/reconstruction alone takes about 298 ms, potentially blocking game
updates. Next engineering work should reduce retained raw/normalized history and
isolate or partition heavy processing before sustained live-chain/concurrent-game
testing. A per-response size limit does not solve this aggregate problem.

Cross-process follow-up passed at `/tmp/pons-regression-GEcCfZ` on Box C:
94 server tests, zero failures/skips, all 15 tool test files, compilation and copy
lint. Eight real independent Node processes competing for a one-entry directory
produced exactly one accepted write. Additional checks simulate an abandoned
lock (not a killed-process fault injection), verify prior reads still work and
reject symlink records. This does not establish power-loss durability or live RPC
compatibility; checkpoint data remains disposable acceleration only.
