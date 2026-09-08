# Project-local Node security upgrade

Production remains on `/usr/local/bin/node` v22.11.0. Do not overwrite this
shared binary or restart unrelated services. This document is staging evidence,
not deployment authorization or a claim of comprehensive security.

On 2026-09-08 the official latest-v22.x checksum list resolved the Linux x64
archive to Node v22.23.2. `tools/stage_node_runtime.sh` downloaded it over HTTPS,
verified SHA-256 before extraction and created a fresh project-local directory.

- Staged executable: `/opt/pons/runtime-check.GjYzpp/node-v22.23.2-linux-x64/bin/node`
- Archive SHA-256: `d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307`
- Official list: https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
- Security release: https://nodejs.org/en/blog/vulnerability/july-2026-security-releases

Verification performed on Box C using the explicit staged executable:

- Server TypeScript build and all 80 server-test entries passed, with the isolated
  PostgreSQL test database enabled.
- Copy lint, client TypeScript check and Vite production build passed. Existing
  large-chunk and runtime sprite-path warnings remain.
- `tools/share-http.test.cjs` passed real signup-budget, Origin, malformed-message,
  movement-correction, reconnect, idle-login, heartbeat and share HTTP/PNG checks.
  Provider failure stayed bounded and both isolated servers shut down cleanly.
  PNG artifact: `/tmp/pons-share-render-bFNtwC/garden.png`.
- Both browser regression modes passed with zero page exceptions: context
  loss/recovery, nickname typing/reconnect and wardrobe/mobile checks at
  `/tmp/pons-wardrobe-browser-nLcRj8`; two-client raid/transfer/reconnect at
  `/tmp/pons-wardrobe-browser-SsGilQ`. Their child servers use `process.execPath`,
  so the game server also ran with the staged executable.

- The bounded 180-second, 200-client file/mock protocol load check passed on
  v22.23.2: 200 purchases, 71,600 pongs, p95 RTT 51 ms, p99 RTT 57 ms,
  maximum snapshot gap 151 ms, peak sampled RSS 96.77 MiB. All 200 clients
  remained online and the isolated server shut down cleanly. Report and 180 RSS
  samples: `/tmp/pons-load-smoke-tJL0Y0/load-report.json`. This is a three-minute
  stationary-input protocol baseline, not a long soak, full gameplay/browser
  capacity result, PostgreSQL load test or proof of no memory leaks.

Remaining before switching production: representative workload/longer soak
coverage and reviewed service/deployment configuration. Use a
project-specific ExecStart path in that release. Preserve the current service
configuration and saves before any switch; never roll back by overwriting new
player progress. No service configuration or global PATH has been changed.

Isolated least-privilege follow-up passes: the real entry point runs under a
temporary DynamicUser service with restricted filesystem access; seed purchase,
restart persistence and share PNG checks succeed. See SERVICE_HARDENING.md.
No production service configuration was changed; only separate bounded test units
were created and stopped.
