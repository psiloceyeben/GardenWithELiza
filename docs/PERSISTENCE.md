# Persistence and recovery

Production backend: PostgreSQL, enabled by PONS_DATABASE_URL or
PONS_DATABASE_URL_FILE in the server environment. With neither, isolated
development uses snapshot.json in PONS_DATA.
Never put database credentials in the repository or browser.

### Protected database credential files

The actual Store now reads `PONS_DATABASE_URL_FILE` once at startup; a QA wrapper
is no longer needed to copy credentials into the environment. Choose exactly one
of URL and URL_FILE, and use an absolute path to a regular private file. Empty,
invalid or oversized values fail rather than silently selecting file storage.
Reading is capped at 8 KiB through a no-follow, nonblocking descriptor; final
symlinks and non-regular files are rejected. Protect parent directories as part
of deployment. Parser/file errors omit values, paths and nested causes.

Ordinary files must have no group/other permission bits. systemd may expose a
root-owned credential as 0440 using a named service-user ACL, rather than making
it group-readable. For this case only, the loader calls `/usr/bin/getfacl` on the
already-open descriptor and requires the exact read-only ACL for root owner and
current effective user, with no owning-group/other access or extra principals.
Missing ACL tooling, unexpected ACLs and actual group-readable files fail closed.
Install the ACL utility when using this systemd credential representation.
See [systemd service credentials](https://systemd.io/CREDENTIALS/) and the
[upstream ACL compatibility discussion](https://github.com/systemd/systemd/issues/29435).

Configure LoadCredential with a protected source, then set URL_FILE to its
service-specific credential path and schema mode to runtime. Do not also set
PONS_DATABASE_URL. Restart is required to load a rotated credential. This does
not itself provision a login, password policy, encryption at rest or a database.
The deployment report checks credential-path presence/syntax only; it does not
read or prove access to the referenced file.

Box C aggregate `/tmp/pons-regression-EgUGQ5` passed 129 server tests and all 23
tool-test files, including private-file/ACL cases, extra-principal rejection,
symlink/oversize/empty/source-conflict failures and sanitized errors. Sandboxed
PostgreSQL run `/tmp/pons-hardened-service-UkiXKK` passed actual game-side loading
of systemd's 0440 service ACL credential, boundary probes, purchase, restart and
exact restricted-role readback. The unit is stopped; database
`pons_sandbox_9be9d5a1c7a04553a197c45c9ae6de90` and private evidence are retained.
Earlier attempts correctly rejected the unrecognized ACL representation; no
public configuration or service changed. Database auth in this drill remains
local trust, not production SCRAM/password acceptance.

The server awaits storage initialization before listening. A database advisory
lock permits only one authoritative simulation writer per database. This is a
single-writer architecture, not yet a horizontally distributed room server.

Player/village records and pending Sap ledger entries commit in one transaction.
Outgoing game messages are serialized and held until the corresponding commit
finishes. Failed saves retain their batch, pause incoming gameplay and simulation
ticks, and make /health return 503. A lost database connection requires a server
restart; the loaded committed state is authoritative. /health reports storage
and lastSavedAt without credentials.

Shutdown stops incoming work, waits for asynchronous handlers, returns carried
plants, awaits persistence, then closes clients. A forced shutdown also preserves
committed carry records: startup returns them with the existing disconnect
recovery rules. Sap's paid-through timestamp is saved with online earnings to
avoid paying the same interval again after a crash.

PostgreSQL sessions now set `statement_timeout=10s`, `lock_timeout=3s` and
`idle_in_transaction_session_timeout=20s`, alongside synchronous commits, before
schema setup/load. These server-side limits complement the 15-second driver query
timeout and 5-second connection timeout. Normal blocked/slow statements are
canceled by PostgreSQL, then the adapter rolls back the transaction; the Store
retains the failed save batch for retry. Limits apply per statement/lock wait,
not to a whole multi-statement save or a network outage. An idle-transaction
session termination follows the existing connection-loss/restart-required path.
Long maintenance migrations must use a separate owner session with deliberately
chosen limits, not the game session.

Box C aggregate `/tmp/pons-regression-zuIDYG` passed 127 server tests and all 23
tool-test files. Real restricted-role tests hold an exclusive village-table lock
after player writes have begun, observe PostgreSQL SQLSTATE 55P03, and verify
rollback of the earlier player write with no ledger append. An owner-installed
test trigger sleeps 20 seconds; the statement is canceled with SQLSTATE 57014.
After removing the blockers, retry twice produces the intended player value and
exactly one ledger entry. Only isolated QA data is affected. Idle-session timeout,
network partitions and production-size save duration are not verified by these
two fault cases.

Connection-loss checkpoint `/tmp/pons-regression-WRqJFi`: the persistence test
resolves exactly one backend by its fresh QA database, unique restricted role and
game application name, then terminates that backend only. It waits for the
adapter's actual connection-error event. A following Store flush fails with the
sanitized restart-required error and retains failed/dirty status. A fresh runtime
adapter acquires the released advisory lock, reads the exact last committed
player/village snapshot and successfully saves; the uncommitted ledger change is
absent. Full aggregate passed 127 server tests and all 23 tool-test files.
This is idle-connection termination followed by a save, not a PostgreSQL server
crash, network partition, termination during COMMIT, or browser health/restart
acceptance. No production connection or service was terminated.

## Migration

### Separate setup and runtime permissions

`PONS_DATABASE_SCHEMA_MODE=bootstrap` retains the existing development/setup
behavior: create schema/tables and recreate ledger protection. This remains the
default for compatibility with isolated test databases. Production must explicitly
use `PONS_DATABASE_SCHEMA_MODE=runtime` after schema preparation. Runtime performs
no schema DDL; it loads records and validates the enabled statement-level
BEFORE UPDATE/DELETE/TRUNCATE ledger trigger, its expected function identity and
the supported version. Both modes enable synchronous commits. An unknown mode
fails startup; a configured mode without PostgreSQL also fails.

Use a separate schema owner for bootstrap/migrations. The game login must not own
the database, schema, tables or functions, inherit the owner role, or have
superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS powers. Required runtime grants:

- CONNECT on its dedicated database; USAGE on schema pons.
- SELECT, INSERT, UPDATE, DELETE on pons.players and pons.villages.
- SELECT, INSERT on pons.meta and pons.ledger.

Do not grant schema CREATE, ledger UPDATE/DELETE/TRUNCATE, or meta UPDATE/DELETE.
Restrict network/authentication and PUBLIC privileges separately at provisioning;
mode selection alone does not revoke privileges. Runtime validates trigger
identity/enabled events, not the function body against a cryptographic manifest;
the separate owner remains trusted. The game can still append ledger entries
and modify player state by design.

Box C aggregate `/tmp/pons-regression-rClefx` passed 127 server tests and all 23
tool-test files. The real PostgreSQL persistence checks create a separate
restricted login in the isolated test cluster, load and save player state plus a
ledger append, and verify rejection of schema creation/table deletion, disabling
the trigger, ledger UPDATE/DELETE/TRUNCATE and version UPDATE. Disabling the
trigger with the test owner makes runtime load fail; it is re-enabled afterward.
The test role/database are retained. This is not production provisioning or a
real runtime deployment, and does not test production authentication rules.

1. Prepare a dedicated PostgreSQL database and application role. Keep access
   private. Use the separate schema owner in bootstrap mode for schema creation
   and the explicit legacy import, then stop it before using the restricted
   game login in runtime mode.
2. Stop the old game service cleanly and retain a filesystem backup of PONS_DATA.
   Verify that players.json and villages.json are both present and valid.
3. Configure PONS_DATABASE_URL and PONS_IMPORT_LEGACY=1. Keep PONS_DATA pointing
   at the backed-up legacy directory for the first start.
4. Start the new server. Only an empty, unversioned database accepts the import.
   Existing snapshot.json takes precedence over old split JSON files.
   Import commits state and ledger atomically and leaves original files intact.
5. Verify /health shows storage=postgres, inspect record counts, sign into known
   gardens, and test a save/restart. Remove PONS_IMPORT_LEGACY after import.

Do not run the old and new game services concurrently against the same players.
Do not roll back to pre-migration JSON after admitting new PostgreSQL gameplay:
it would lose post-cutover progress. Stop writes and restore the selected
database backup into a separate database before switching connections instead.

## Backups

tools/database_backup.sh uses standard libpq environment variables: PGHOST,
PGPORT, PGDATABASE, PGUSER and PGPASSFILE (or PGPASSWORD). It does not place
credentials in process arguments. Use the same PostgreSQL major-version tools.

```sh
bash tools/database_backup.sh backup /absolute/backup/path/pons.dump
# Point PG* at a separate, empty destination database first:
bash tools/database_backup.sh restore /absolute/backup/path/pons.dump EXACT_DESTINATION_DATABASE
```

Backup requires an absolute path, refuses existing archives or symlinks, writes
a private same-directory temporary file, validates its table of contents, then
publishes with an atomic no-overwrite hard link and prints its checksum. Its exit
trap removes only its own temporary file. The destination filesystem must support
hard links; failure does not replace an existing archive.

Restore verifies the destination's exact name, refuses a database already
containing the pons schema, and uses pg_restore itself to own the single
transaction with exit-on-error. Do not replace this with an SQL-producing pipe
into psql: an archive-reader failure must not allow a valid prefix to commit.
Use only trusted backups; restoring an archive executes its database definitions.
Neither command creates a backup schedule or off-host copy.
Production still needs scheduled backups, retention, off-host storage and a
regular restore drill configured before cutover.

### Verified isolated recovery drill

`tools/backup-restore-drill.cjs --database=<isolated pg-check admin URL>
--source=<retained QA database>` runs on Box C only. It restricts the cluster to
the localhost:15432 pg-check test socket and sources to named browser/load QA
databases. It creates fresh destination databases, never drops them, and retains
private archives, command logs and result.json in `/tmp/pons-backup-drill-*`.

- `/tmp/pons-backup-drill-6BFzKq`: the 200-player load database restored with all
  400 ledger entries and exact player/village/meta records.
- `/tmp/pons-backup-drill-gK1YWG`: the two-player raid database restored with all
  67 ledger entries, including the saved transferred plant. This final run also
  checks relative-output refusal and failed-dump temporary-file cleanup.

Both verify 0600 archive permissions, checksum stability after overwrite refusal,
dangling-symlink refusal, exact destination-name and occupied-schema guards,
exact restored records, actual Game initialization/commit, ledger immutability
and unchanged source records. A truncated archive whose table of contents still
reads successfully fails restoration and leaves no pons schema. This establishes
recovery for these retained gameplay fixtures, not production disaster recovery,
power-loss durability, off-host retrieval, or a tested recovery-time objective.

## Verification (Box C only)

Build server, then run its normal tests and test:persistence with
PONS_TEST_DATABASE_URL pointing at an isolated PostgreSQL administrator
connection. Do not set PONS_DATABASE_URL for this suite. It creates uniquely
named test databases and retains them for inspection.

Tests cover migration, frozen snapshots, writes during in-flight saves, failed
transaction rollback/retry, duplicate-writer refusal, ledger immutability,
restart, carried-plant recovery and commit-before-send behavior.

## PostgreSQL protocol-load checkpoint

`tools/load-smoke.cjs` now accepts an optional `--database=` administrator URL,
restricted to a localhost:15432 `/opt/pons/pg-check.*` test socket and the postgres
administration database. It creates a fresh random `pons_load_*` database and
retains it for inspection. No existing game database is selected or dropped.
All child PONS configuration is cleared before the explicit isolated configuration
is applied; host-memory headroom checks and bounded duration remain in force.

The workload uses 200 protocol clients across 13 villages: initial seed purchases,
stationary input and ping traffic, and free skin/hair changes every five seconds.
It waits for final acknowledgements, gracefully stops the isolated game server,
opens a new persistence connection and verifies each seed UID, exact remaining
Sap, final appearance and exactly one correctly charged purchase ledger entry
per player. This adds persisted readback to both PostgreSQL and file modes.

Box C, Node 22.23.2, PostgreSQL 16 test process (16 MiB shared buffers):

| Run | Duration | Wardrobe rounds | P95 / P99 RTT | Max snapshot gap | Peak sampled game-server RSS |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL `/tmp/pons-load-smoke-hWarHn` | 30 s | 5 | 107 / 153 ms | 195 ms | 108.4 MiB |
| PostgreSQL `/tmp/pons-load-smoke-DVTEfw` | 180 s | 35 | 97 / 128 ms | 216 ms | 113.0 MiB |
| File `/tmp/pons-load-smoke-hdGp40` | 30 s | 5 | 72 / 99 ms | 183 ms | 103.4 MiB |

All runs passed, including 200 purchases, final wardrobe acknowledgements,
200 persisted seeds and unique purchase charges after shutdown. The 180-second
run recorded 71,600 pongs. Detailed metrics/memory samples and logs remain in each
run directory. Its retained database is
`pons_load_2e183453b2274523a5e7d24ab30834f7` in the isolated test cluster.

These are individual bounded protocol runs, not a controlled engine comparison
or a production capacity guarantee. They do not exercise browser rendering,
real RPC workers, active farming/raids, physical clients, database failure,
multi-hour ledger growth, or production durability/backup hardware. RSS samples
cover the game-server process, not the test clients or PostgreSQL. All runs used
cached(mock) chain reads. No live service or public configuration was changed.

## PostgreSQL browser gameplay checkpoint

### Restricted-runtime browser workflow

`tools/wardrobe-browser.cjs --runtime-database --database=<isolated admin URL>`
prepares its newly created QA schema using the owner, then creates a separate
non-owner login with only the runtime grants above. The actual game child uses
that login and explicit runtime schema mode; it imports only the harness's own
temporary gameplay fixture. Post-shutdown readback also uses the restricted login
and runtime mode, not an owner connection that could repair missing schema.
The role and database are retained. No production role or authentication rule is
modified. This test cluster uses local trust authentication, not production auth.

Box C plain-URL 3D garden run `/tmp/pons-wardrobe-browser-tcTeYg` passed normal
starter purchase, keyboard bag selection, projected ground click, planting,
watering, real growth/reveal, income and reconnect, zero page errors. Saved
readback matched one player and one unique plant after shutdown. Database:
`pons_browser_2c29f49c31fd437e96baa8572ef6bae4`.

Restricted-runtime two-player raid `/tmp/pons-wardrobe-browser-Jt0Tbw` also passed
normal pathfinding, timed uproot, owner removal, both-client carry pose/hand
placement, banking with preserved nickname/golden mutation/size, pose release,
remote updates and reconnect, zero page errors. Post-shutdown readback matched
both players and one unique plant. Retained database:
`pons_browser_41b8c1b343ab4016865486a0901c6208`. The raid wrapper only removes
initial login shielding, as in the prior raid checks. These runs do not establish
sustained load, crash recovery, real-chain operation or production deployment.

`tools/wardrobe-browser.cjs --database=<isolated pg-check admin URL>` now creates
a separate random `pons_browser_*` database, explicitly imports only its own
temporary fixture, and checks that the running server reports PostgreSQL storage
and cached(mock) chain reads. After browser assertions, a new persistence
connection compares captured inventories, plot ownership/UIDs, nicknames,
mutations, sizes and wardrobe values, checks that acknowledged Sap was not lost
(passive income may increase it), and rejects duplicate plant UIDs across gardens.
Data and test databases are retained; no production database is touched.

Box C actual software-WebGL Chromium runs:

- `/tmp/pons-wardrobe-browser-ZZqznf`, `--perspective-garden --wander`: starter
  purchase, keyboard bag selection, normal movement/projected ground click,
  planting, watering, real growth/reveal, income and reconnect passed. Post-stop
  PostgreSQL readback matched one player and one unique plant.
- `/tmp/pons-wardrobe-browser-u9cjGJ`, `--perspective-raid --wander`: two clients,
  normal pathfinding/timed uproot, owner removal, carrying, banking the named
  golden size-1.3 plant, remote updates and reload passed. Both players' final
  states matched after shutdown and database reopening, with one unique plant.
  The existing raid wrapper removes only initial login shielding; it does not
  bypass movement or channel timing. Avatar departure cleanup remains checked.

Both runs completed with zero page errors. An earlier focus assertion compared
a locator-resolved old node with the active replacement; it now inspects current
button/focus in one DOM snapshot. The first raid readback captured only the still-
open owner's page; the final run also captures the thief before closing its
context for avatar cleanup and verifies both players after shutdown.

Screenshot `artifacts/partner-preview/postgres-raid-banked-3d.png` shows the banked
plant. It also exposed feed/banner/notice overlap at that viewport, subsequently
fixed and checked by the status-layout follow-up in PRODUCTION_READINESS.md.
The screenshot is not proof of final aesthetic acceptance. These are bounded
one/two-player browser flows, not a farming/raid load test, forced database crash,
real-chain integration or physical-device result. No live restart or release.

## Remaining production work

- Provision the durable production database service and least-privilege runtime
  role; the current PostgreSQL instance is an isolated test process only.
- Measure per-commit save latency and ledger growth under active farming/raids
  and longer mixed chain/game workloads. The bounded 200-player protocol workload
  above passes; state is still serialized per commit, with unchanged PostgreSQL
  rows not rewritten.
- Define retention/partitioning for the full Sap ledger (including tick income).
- Add distributed sessions/room coordination if scaling beyond one writer.
- Production migration/deployment and backup scheduling have not happened.
