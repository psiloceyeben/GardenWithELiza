# Box C database rollout assessment

## Isolated non-root service rehearsal

PostgreSQL sandbox integration `/tmp/pons-hardened-service-AokLaZ` passed with
`tools/hardened-service-check.cjs --database=<isolated pg-check admin URL>`.
The harness prepares a fresh schema under its owner and grants only runtime
permissions to a new restricted login. The sandbox receives its connection
string through systemd LoadCredential, read by the QA wrapper before game startup;
no connection string is placed in the game command arguments or report.

Only the QA PostgreSQL Unix socket is bind-mounted read-only into a private
RuntimeDirectory. The original pg-check directory remains mode 0700 owned by
nobody; it was not opened to the dynamic game user. Existing filesystem/root-home
denial probes and zero-capability checks passed before and after restart.
Health explicitly reported PostgreSQL. A real purchase survived graceful restart
with exact inventory/Sap, restricted-role post-stop readback matched, and the
ledger contained one purchase. No fallback snapshot.json was created.

The QA unit is stopped; database `pons_sandbox_a81b1da20df94f44927ad94efd50e4b6`,
role, private credential source, logs and state markers are retained. This proves
the socket/credential/sandbox integration using local trust authentication, not
production password/SCRAM rules, credential rotation, durable PostgreSQL service
management, TLS/network access or real RPC workers. Public service unchanged.

Boundary enforcement follow-up `/tmp/pons-hardened-service-9zg6Fz` passed inside
the sandboxed process itself, before the normal game entry point. The new
`tools/sandbox-game-server.cjs` QA wrapper verifies non-root effective UID,
empty effective capabilities and NoNewPrivileges, attempts an exclusive write
to a unique code-directory probe (denied), checks root-home read access (denied),
and writes a private marker in its approved StateDirectory (allowed). It does
not list or read root-home contents. If a code probe unexpectedly succeeds,
only that exclusively created probe is removed and the test fails.

The probes passed on both initial startup and restart. Real protocol purchase,
exact saved recovery and private snapshot checks also passed; the unit is stopped.
Retained private QA state:
`/var/lib/private/pons-sandbox-qa-cf06376db147420c9ce0f0f490c96341`.
This strengthens the earlier property inspection with actual access checks, not
a claim of comprehensive sandbox escape resistance or production acceptance.

`tools/hardened-service-check.cjs` now starts one uniquely named transient QA
service with a fresh systemd-managed StateDirectory. It requires Box C and at
least 1,500 MiB available memory, binds a random loopback port and uses only mock
chain/file storage. No public unit/config/save is selected. Service environment
is explicitly cleared before the test settings are supplied.

Box C run `/tmp/pons-hardened-service-Urxn2z` passed. Effective UID was 64292,
not root. The unit used DynamicUser, ProtectSystem=strict, ProtectHome,
NoNewPrivileges, private temporary/device namespaces, kernel/control-group
protections, empty capability bounding set and restricted address families.
Temporary limits were MemoryMax=256M, TasksMax=32 and RuntimeMaxSec=120. These
bound this mock one-player rehearsal; they are not validated production limits
for two RPC workers, browser workloads or sustained load.

A real WebSocket client purchased a seed, the unit restarted gracefully, and
the same identity recovered exact Sap/inventory. After stopping the unit, its
0600 snapshot matched the acknowledged values and contained one purchase ledger
entry. Logs/result remain in the run directory. The stopped unit's private
save remains at
`/var/lib/private/pons-sandbox-qa-5bf0e2e366fd4761a7c3a264af7f5186`.
No service remains running from this test. Production still needs its own
identity, permissions, private PostgreSQL authentication/socket access, real
chain/network checks and measured resource limits before rollout.

## Current-state inspection

Read-only inspection during the production-readiness work found:

- Root filesystem: 301 GiB total, 263 GiB used, about 26 GiB available, 92% used.
- Memory: about 2,125 MiB available; configured 16,383 MiB swap fully used.
- Pons workspace: about 1.8 GiB, including 1.2 GiB retained PostgreSQL QA cluster,
  246 MiB node_modules and 48 MiB extracted PostgreSQL test runtime.
- Public saved game data: 24 KiB. Retained database-drill archives total 48 KiB.
- Only the isolated PostgreSQL test process was running; no PostgreSQL systemd
  service was listed. Its executable reports PostgreSQL 16.15. This is an
  observed version, not an assertion that its package is current or approved.
- Public `pons-server.service` was active, PID 732719, zero automatic restarts.
  Health was OK: six players, one online, one village, file storage, cached(mock).
- Public service User and Group are unset (system-service root defaults), with
  no MemoryMax. Its sampled cgroup memory was roughly 17 MiB.

These are point-in-time readings, not a sustained capacity profile. The Pons
workspace and tiny public save do not account for most of the host's occupied
space. No unrelated services/files were inspected for deletion, and nothing was
deleted, resized, stopped, migrated or restarted.

## Rollout decisions

Do not treat the retained trust-authenticated QA cluster as production storage.
Host storage/memory pressure and the root game service need explicit engineering
attention before a production database cutover. A small empty database could fit
in the current free space; the concern is shared-host headroom, growth, backup
retention and recovery, not a claim that initialization is physically impossible.

1. Establish shared-host resource ownership and a capacity/cleanup plan. Do not
   delete other projects' data or discard retained QA evidence without an agreed
   retention policy. Deleting the 48 KiB restore archives would not help capacity.
2. Provision a maintained PostgreSQL installation as a dedicated non-root service,
   with private connectivity, explicit storage/WAL/backup capacity and monitoring.
   Do not reuse the temporary extracted test-runtime path for unattended service.
3. Create a separate schema owner and restricted game login. Prepare the schema,
   grants and authentication; set explicit runtime schema mode for the game.
4. Run the game under a dedicated OS identity with narrowly scoped data access.
   Rehearse service hardening and resource limits against a copy before applying
   them to the live service. Review limits against measured workload, not just
   this idle memory sample.
5. Rehearse migration, browser gameplay, save/restart, backup, off-host retrieval
   and restore using the intended production service/authentication setup.
6. Present the verified cutover and rollback plan for Ben's release decision.
   The current live player must not be interrupted by an unannounced migration.

The restricted-role browser checks and recovery drills in PERSISTENCE.md remain
valid isolated evidence; they do not satisfy these host/provisioning requirements.
Capacity work and provisioning remain engineering tasks, not automatically
owner-only blockers. Broader cleanup, spending or changes to unrelated services
need the appropriate authorization.
