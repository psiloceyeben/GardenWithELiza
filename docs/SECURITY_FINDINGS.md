# Security findings and verification

This is an ongoing scoped review, not a security certification. Changes below
are in the working tree and Box C build mirror, **not deployed to production**.

## Untrusted legacy browser saves

The new-player path accepted browser-supplied Sap, seeds, plants and progression.
These values have no trustworthy provenance and could bypass the authoritative
game economy or introduce malformed state.

Removed that import path: new players receive server-defined starting state.
Existing server saves are unchanged. Old browser saves remain in local storage;
the client no longer deletes them or submits them. A future migration must be an
explicit owner-reviewed server-side procedure, not a trusted client payload.

Verification: `untrusted-save.test.ts` covers forged progression, malformed
values and persisted restart state (2 tests passed on Box C). Server and client
builds passed. Production remains exposed until an approved release includes this.

## Connection override could disclose identity

The `ws` query parameter previously selected any WebSocket endpoint. Opening a
crafted game link could send the stored game identity secret to another server.

Production now ignores this override. HTTP loopback previews alone can select a
different port on the exact same loopback hostname using `ws:`. Credentials,
fragments, other protocols, remote hosts and malformed overrides are rejected.
The normal connection stays on the page's host and game path.

Verification: both `tools/ws-url.test.ts` tests and the client build passed on
Box C. This protects endpoint selection,
not compromised same-origin scripts or malicious local services. Broader origin,
input validation, rate-limit and deployment reviews remain in the completion plan.

## Hostile message shapes and prototype-backed purchases

Incoming JSON was cast to a TypeScript union without runtime validation. A buy
slot such as `__proto__` could resolve an inherited object instead of a conveyor
slot, introducing non-finite Sap and invalid inventory. Cosmetic price lookup
also accepted inherited properties.

Added runtime validation for all current client message variants at the socket
boundary and Game entry points: scalar types, finite numbers, integer indices,
bounded strings, wallet encodings and explicit enum membership. Malformed socket
messages close with policy code 1008. Buy and cosmetic handlers additionally
reject invalid indices/inherited prices. Authoritative affordability, ownership,
range and progression checks still apply after shape validation.

Box C evidence:

- Server build passed; 56 Node test entries passed, including the derive script's
  26 checks and the persistence script's 14 checks against isolated PostgreSQL.
- Four new validation tests cover every message variant, structured/non-finite
  field substitutions, hostile indices/enums, and unchanged live/persisted state.
- `node tools/share-http.test.cjs` exercised actual WebSocket rejection, repeated
  identity reconnect with unchanged balance, valid ping, and exact purchase cost
  plus inventory gain. Existing share HTTP/PNG and provider-failure checks passed.

The initial aggregate run omitted `PONS_TEST_DATABASE_URL` and failed its explicit
database prerequisite. The rerun supplied the verified isolated socket database
and passed; no production database was used. These checks do not yet establish
200-player abuse resistance, origin restrictions or complete gameplay E2E parity.

## Movement tolerance multiplied by packet frequency

The previous limit granted `speed * elapsed * 1.35 + 6` for every movement
message. Repeated messages at the same time each received six free pixels,
allowing movement beyond intended speed even below the socket message-rate limit.

Movement now uses per-live-session distance credit, replenished by server elapsed
time rather than packet count. Six pixels are a shared jitter reserve; elapsed
credit is capped at half a second. A 1% rate tolerance accommodates the client's
integer-rounded oblique paths. Speed still comes from authoritative training,
carrying and defense state; collision rechecks remain intact. Rejected malformed
values and backwards clock steps cannot mint credit.

Six movement tests pass: floods, ordinary jitter, long rounded oblique paths,
idle/invalid/backwards-time bounds, slower speed credit caps, and live Game input
enforcement. The final aggregate run passed 62 Node test entries with isolated
PostgreSQL configured. Real WebSocket/share checks also passed before the final
1% rounding adjustment. Real-browser latency/correction testing and movement
through defense boundaries remain release checks, not proven by these tests.

## Rejected prediction recovery

Both renderers previously ignored self-snapshot discrepancies of 48 pixels or
less. A blocked or rejected prediction could therefore leave the player looking
close enough to interact while the server still placed them elsewhere.

The server now emits an explicit authoritative position correction whenever an
input's requested position differs from the accepted position. Both renderers
apply it regardless of distance and discard the stale click path/pending action;
keyboard/touch input can continue from the corrected position. Ordinary snapshots
retain their existing prediction tolerance. Release client and server together
to enable this new protocol variant in both views.

Box C verification: server/client builds and copy lint passed; six movement tests
now include correction emission and no correction for accepted movement; the
actual HD-2D message handler passes small/repeated-correction and stale-action
cancellation checks (`tools/correction.test.ts`). The isolated real WebSocket
test receives a correction after a rejected teleport, then successfully purchases
a seed at the exact price; share/provider-failure checks still pass. Phaser's
handler is compiled but not yet exercised in a rendered browser for this change.
High-latency/in-flight-input reconciliation and visual smoothness remain open.

## Connection lifecycle resource limits

The socket server previously had message-rate and payload limits but no login
deadline, heartbeat or total connection ceiling. Idle unauthenticated connections
and half-open clients could persist indefinitely.

Added a 512-connection ceiling (including unauthenticated sockets), a 15-second
valid-login deadline, and protocol pings every 30 seconds with termination at the
next interval if no pong arrives. A single five-second sweep checks lifecycle
state and terminates clients whose send buffer exceeds 1 MiB. These are sampled
checks, not a hard instantaneous memory bound. Browser protocol pong handling is
automatic; idle but responsive authenticated players remain connected. Invalid
identity attempts and gameplay messages before login now close with policy code
1008. Closing a socket uses the existing player leave/persistence path.

Five lifecycle unit tests and the aggregate 67-entry server suite passed on Box C,
including isolated PostgreSQL. The real socket harness also verified idle-login
expiry, rejection of pre-login intents, and a responsive authenticated session
after a protocol heartbeat, alongside the existing purchase/share/failure checks.
Connection limits do not substitute for edge
rate limiting, origin policy, account-creation abuse controls or 200-player load
testing. Production configuration and processes remain unchanged.

## Browser WebSocket origin restrictions

WebSocket upgrades now accept browser origins only when they exactly match the
origin of `PONS_PUBLIC_BASE` or an explicitly configured `PONS_ALLOWED_ORIGINS`
entry. The latter is a comma-separated list of exact HTTP(S) origins, including
nondefault ports; wildcards, paths, credentials and malformed entries fail startup.
The public base defaults to `https://prometheus7.com/ponsgarden`.

Local HTTP origins (`localhost`, `127.0.0.1`, `[::1]`, any port) are additionally
permitted only when the actual TCP peer is loopback, for SSH-forwarded previews.
Forwarded address headers are not trusted for that exception. A deployment with
a same-host reverse proxy must account for its loopback peer identity; origin
checks remain a browser-origin defense, not proof of client identity.

Origin-less native/CLI clients remain supported and still require game identity
authentication. Native clients can forge Origin, so this does not prevent bots
or replace signup throttling. Literal `null`/opaque browser origins are rejected.

Box C: server build and aggregate 70-entry suite passed, including three origin
policy tests and isolated PostgreSQL. Real upgrade checks rejected hostile/null
origins with the library's HTTP 401 response and accepted the canonical game and
loopback preview origins. The first wire test expected 403; it was corrected to
the observed library behavior, without relaxing the rejection requirement.
The complete wire harness then passed login expiry, heartbeat, reconnect,
movement correction, purchase, share and provider-failure checks and shut down
its isolated services cleanly.

Release client/server and explicit staging origins as one reviewed configuration.
No production deployment or origin configuration was changed in this work.

## Persistent garden signup budget

New identities previously allocated saved players/villages without a creation
rate limit. A process-wide token budget now gates only new player creation at the
socket entry point; existing identity authentication/reconnect is exempt.
Exhaustion closes the connection with retryable code 1013 before Game.join can
allocate persistent state. Reconnect does not replenish tokens.

Defaults allow a burst of 200 new gardens and replenish one every 30 seconds.
`PONS_SIGNUP_BURST` (integer 1–10000) and `PONS_SIGNUP_REFILL_MS` (integer
1000–3600000) allow reviewed deployment tuning; invalid values fail startup.
Idle capacity is capped. This is a process-local backstop, reset on server restart,
not an IP/device quota or bot detector. A malicious client can exhaust the shared
budget and delay legitimate signups, so edge-level abuse controls and launch
capacity review remain required. No reverse-proxy headers are trusted or newly
interpreted by this mechanism. Production remains unchanged.

Verification: after transient SSH timeouts, the server build and aggregate
73-entry suite passed on Box C. The real-socket exhausted-budget test passed,
including returning-player reconnect and unchanged player count after rejected
signup. The complete connection/share harness also passed and shut down cleanly.

## Initial 200-client load smoke — incomplete

An isolated, low-priority file-backed server sustained 200 connected protocol
clients for 30 seconds: 11,800 pong samples, p95 RTT 48 ms, p99 RTT 56 ms,
maximum snapshot gap 140 ms, peak measured server RSS 81.7 MiB. No production
process was changed. Server shutdown completed cleanly.

The test FAILED its purchase count assertion: 198 of 200 clients reported a
seed purchase. Investigate whether the two clients had an affordable offered
seed and trace their requests before calling this a gameplay or load pass.
Report: Box C `/tmp/pons-load-smoke-1ZIy2F/load-report.json`. This is not browser,
PostgreSQL, raid, provider-load or long-duration capacity verification.

## Dependency audit and development listener

Box C `npm audit --json` identified two affected package entries: Vite 5.4.21
(high severity, including GHSA-fx2h-pf6j-xcff) and its esbuild dependency
(moderate, GHSA-67mh-4wv8-2f99). `npm audit --omit=dev --json` reported zero
production-dependency advisories. These findings concern development tooling;
the public deployment serves built static files, not a Vite development server.
A clean package audit is not an application security certification.

The client manifest now pins Vite 6.4.3, the audit-suggested patched release
compatible with the observed Box C Node v22.11.0. Its configuration now binds
development HTTP to 127.0.0.1 rather than every interface. Migration reference:
https://v6.vite.dev/guide/migration.html ; advisory:
https://github.com/advisories/GHSA-fx2h-pf6j-xcff .

Installation completed after a slow registry audit response. The generated
lockfile was copied back to the local repo. Vite 6.4.3 client build and copy lint
pass; the full npm audit reports zero advisories. The development-server check
passes loopback binding, hostile Host rejection and absence of a foreign-origin
CORS grant. The Host test uses node:http to preserve the explicit wire header;
the initial fetch-based assertion did not exercise the intended hostile request.
Only dependency pre-scanning is disabled in this header-focused test to avoid
shutdown cancellation noise; actual client builds retain normal optimization.
The graphics recovery/nickname/wardrobe browser regression passes with zero page
exceptions (`/tmp/pons-wardrobe-browser-RtwHDc`). The upgraded-build two-browser
raid rerun also passes, including transfer and reconnect, with zero page errors
(`/tmp/pons-wardrobe-browser-S5g1PM`). No public deployment or production restart occurred.

## Runtime security upgrade remains required

Read-only inspection confirms `/usr/local/bin/node` is v22.11.0 and is the
configured production ExecStart runtime. npm audit does not cover its bundled
HTTP/TLS/runtime dependencies. Node's July 29, 2026 security release includes
22.23.2 and fixes affecting the 22.x line:
https://nodejs.org/en/blog/vulnerability/july-2026-security-releases .
This is evidence that the installed runtime is behind security fixes, not proof
that every listed vulnerability is reachable in Pons Garden.

Next: stage a checksum-verified current patched runtime side by side for this
project, run server/browser/HTTP/persistence checks with it, then include the
project-specific runtime path in a reviewed deployment. Do not overwrite the
shared `/usr/local/bin/node` or change unrelated services. No runtime was replaced.

Staging follow-up: Node 22.23.2 was downloaded and checksum-verified in a fresh
project-local directory. Server/client builds, 80 server tests including isolated
PostgreSQL, real HTTP/WebSocket checks and both browser regressions pass with
that explicit runtime. See RUNTIME_UPGRADE.md for path and evidence. Production
still uses 22.11.0; the global binary and service configuration are unchanged.
