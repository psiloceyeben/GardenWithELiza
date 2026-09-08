# Deployment configuration report

Run on Box C from `/opt/pons` after compiling the current server:

```sh
node tools/deployment-config-report.cjs --service=pons-server.service
```

Use the approved patched Node runtime, not an older system binary. The alternate
supported service is `pons-hd2d-preview.service`; omitting the option examines the
report process's environment. Do not put secrets in command arguments.

The service path reads its current MainPID, validates the process working
directory and compiled game entry point, reads only PONS environment settings,
and rechecks the PID. It never changes configuration, starts workers, contacts
providers/databases, signs messages or restarts services. Reports contain check
IDs, statuses and required field names, never environment values or parser errors.
The field list names the whole requirement group; `missing` means at least one
required field is absent/blank, not necessarily every listed field.

Exit 2 means incomplete/invalid configuration. Exit 1 means inspection failed.
Exit 0 means only `configuration-present-not-verified`, never release approval.
The report always lists evidence still needed outside syntax/presence checks.

## Latest live inspection

The read-only inspection of `pons-server.service` found:

- Read-only RPC/token/chain/deployment configuration: missing.
- Broker NFT/deployment configuration: missing.
- PostgreSQL connection: missing.
- Explicit runtime schema mode: missing.
- HTTPS public-origin configuration: present.
- One-time legacy import: not enabled.

No public environment, service or account was changed. Box C aggregate
`/tmp/pons-regression-wow6oW` passed 128 server tests and all 23 tool-test files,
including checks that malformed/secret-bearing values cannot appear in reports
and a fully populated fixture is still not labeled production-ready.

## Remaining evidence and setup

Engineering work remains: durable production PostgreSQL and restricted login,
authentication/network hardening, migration/cutover rehearsal, scheduled off-host
backups and retrieval/restore, broker drop-history semantics, broader mixed load,
remaining art/animation work and release packaging. Do not classify these all as
owner-only work.

Ben must supply or approve the intended PONS contract/deployment details and
ecosystem allowlist, provide an authorized provider/account configuration where
needed, perform real wallet/device approvals, review the visual result and decide
when to release. Known-wallet/provider comparisons and browser end-to-end checks
must then verify those exact settings. No stock/broker transaction or referral
flow is permitted; that layer remains decoration-only.
