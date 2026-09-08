# Service hardening: measured baseline and next verification

Read-only inspection of `pons-server.service` on Box C, 2026-09-08:

- Empty User/Group properties: the system service uses root by default.
- `NoNewPrivileges=no`, `ProtectSystem=no`, `ProtectHome=no`, `PrivateTmp=no`.
- `MemoryMax=infinity`, `TasksMax=18634`, `LimitNOFILE=524288`.
- `/var/lib/pons` is root-owned mode 0755.
- Runtime is shared `/usr/local/bin/node` v22.11.0.

These are deployment risks to address, not evidence of compromise. Do not change
data ownership or the live unit without a reviewed release and save preservation.

Next isolated verification should run the real server under an unprivileged
identity using the staged patched runtime, a fresh dedicated StateDirectory,
loopback host and ephemeral port, with NoNewPrivileges, ProtectSystem=strict,
ProtectHome and PrivateTmp. Verify startup, guest persistence/reconnect,
share-sprite reads, provider error handling and graceful shutdown; assert that
the service cannot write outside its own state area. Do not use live saves.

The staged runtime currently resides under a mktemp-created directory; check
traversal permissions before using an unprivileged service. Only official
runtime archives/binaries belong there—do not relax unrelated directory modes.
Choose memory/task/file-descriptor limits from representative workload evidence,
not merely the current stationary-client smoke. Preserve supported outbound
HTTPS and DNS needed by the read-only chain/Oracle adapters.

For production, use a project-specific runtime path and dedicated least-privilege
identity. A dynamic-user StateDirectory or dedicated static account must be
chosen and tested with the actual persistence/backup model before migration.
Any ownership migration needs a stopped service and a fresh verified backup.
Keep build artifacts readable but not writable by the game service, and keep
provider configuration out of public assets and diagnostic output.

## Isolated verification passed

`tools/check_service_hardening.sh` created a distinct transient systemd service
with DynamicUser, StateDirectory mode 0700, ProtectSystem=strict, ProtectHome,
PrivateTmp, NoNewPrivileges, empty capability bounding set, RestrictSUIDSGID and
AF_UNIX/AF_INET/AF_INET6 address families. Its lifetime was bounded to 120 seconds
and it used an ephemeral loopback port and the patched Node 22.23.2 runtime.
The runtime's staging parent was made traversable (0755); it contains only the
official runtime archive and extracted binaries, not saves or credentials.

The service-side bootstrap asserted a nonzero UID (observed 63171), successful
writes to its dedicated state directory, denied writes into `/opt/pons` and
denied reads of `/root`. It then loaded the real game server entry point.
A separate WebSocket client verified guest signup and a seed purchase. After
an actual systemd restart, the same identity authenticated with exactly one
saved seed. Health and real PNG rendering passed before and after restart.
Both stops were logged as successfully deactivated.

Evidence: `/opt/pons/hardening-evidence.KBNaOC/service.log`.
Retained test saves: `/var/lib/pons-hardening-qa-KBNaOC` (dedicated private
StateDirectory, not `/var/lib/pons`). The test unit is stopped. The first check
briefly probed the old ephemeral port during restart; journal lookup is now
scoped to the current InvocationID to avoid that stale-port probe on future runs.
The corrected harness passed again with UID 62708 and no stale-port probe:
`/opt/pons/hardening-evidence.rqAYbS/service.log`; retained state is
`/var/lib/pons-hardening-qa-rqAYbS`. That test unit also stopped cleanly.

Limits: mock chain reader and file storage; this does not prove live provider
connectivity, production PostgreSQL authentication/backup access, migration of
the existing root-owned saves, survival of a dynamic UID change or a full
filesystem policy audit. A reviewed production release remains necessary.
