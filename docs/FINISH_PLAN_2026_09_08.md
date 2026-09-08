# Pons Garden — Review of Codex's work and the plan to finish (2026-09-08)

> **Status update, 2026-09-08 22:00 UTC.** Phases A, B and C are done, plus two
> requests Ben added afterwards. Live now: the 3D build, ephemeral guest gardens,
> compact HUD controls, and a hardened non-root game service. Box C recovered 9 GiB
> of memory and dropped from load 27 to 9 by pausing EnsouledWorld 1 and the holon
> Oracle. Promotional cards are rebuilt from real 3D footage, and
> `BEN_STONKBROKER_SETUP.md` is the owner checklist for the chain.
> **Remaining engineering: Phase D (production PostgreSQL).** Everything else is
> Ben's: the chain values, disk cleanup approval, art acceptance, the roster cut,
> a WalletConnect id, and counsel review. See §7 at the bottom.

Written for the next agent (Opus) and for Ben. Sources: `PRODUCTION_READINESS.md`, `WANDER_3D_DIRECTION.md`,
`STONKBROKER_INTEGRATION.md`, `BOX_C_DATABASE_ROLLOUT.md`, `PARTNER_PREVIEW_RELEASE.md`, `SECURITY_FINDINGS.md`,
`DEPLOYMENT_CONFIG_CHECK.md`, `artifacts/promo/POSTS.md`, the working tree, and a live inspection of Box C.
Read `HANDOFF_2026_09_08.md` first for the map of the codebase; this document is about state and sequence.

---

## 1. Verdict in one paragraph

Codex did a very large amount of good, careful, well-evidenced engineering: a true-3D renderer with all 22 plant
species modelled, Wander-family characters, buildings and plaza props; a PostgreSQL persistence layer with commit
outbox, ledger protection, backup and restore drills; a real security pass (message validation, movement credit,
connection lifecycle, session replacement, identity recovery); a headless-Chromium browser harness with dozens of
scenario modes; 129 server tests and 23 tool-test files; hardened-service rehearsals; and a promo pack. Its
documentation is honest to a fault: every checkpoint says exactly what it does and does not prove. Three things
are wrong with the state it left, and none of them are code quality: **nothing was committed** (23 modified,
126 untracked files sit in the working tree), **the public site still runs the older HD-2D preview on a root
service with an unpatched Node**, and **Box C is under memory and disk pressure** with leftover QA processes.
The game is feature-complete against the bible for M1–M3 and most of M2; what remains is release engineering,
Ben's inputs, and the art acceptance of the 3D view.

---

## 2. What Codex delivered (verified by reading the tree and its evidence)

**3D renderer (`client/src/three/`, `client/src/game/`).** Three.js 0.180. `Renderer3D.ts`, `Ground.ts`,
`Atlases.ts`, plus authored models: `plant-model.ts` (22 species × 5 growth stages, mutation tint/scale/flip,
static-mesh batching), `building-model.ts`, `plaza-model.ts`, `tree-model.ts`, `defense-model.ts`, `gate-model.ts`
(intact/damaged/broken), `decor-model.ts` (stumps, crystal fern, glow cap, spiral reed), `visual-avatar.ts` wrapping
a vendored Wander character generator (`client/src/three/vendor`, ten presets, Pons-only patches recorded with
hashes), `garden-wardrobe.ts` (shirt/hat mapping, volumetric hats), skin tones and five hairstyles, `carry-pose.ts`
(two-hand carry), facial idles for three species, `label-layout.ts`, `camera-obstruction.ts`, perspective camera with
mouse and touch orbit, `view-mode.ts` (default is now perspective + Wander characters; `view=orthographic`,
`characters=sprites`, `r=2d` are fallbacks). Game logic was extracted into `client/src/game/WorldState.ts` with
`movement.ts`, `camera-input.ts`, `joystick.ts`, `server-clock.ts` (fixes a real gnome-patrol clock mismatch).

**Persistence (`server/src/persistence.ts`, `store.ts`, `pg`).** PostgreSQL adapter with atomic state + ledger
commits, commit-before-send outbox, restricted runtime login mode (`PONS_DATABASE_SCHEMA_MODE=runtime`), credential
file loading with permission checks, statement/lock/idle timeouts, connection-loss recovery, backup publication and
transactional restore (`tools/database_backup.sh`, `tools/backup-restore-drill.cjs`). Isolated tests pass on a
throwaway PostgreSQL 16 cluster on Box C. **No production database exists yet.**

**Security (`SECURITY_FINDINGS.md`).** Removed the browser-supplied legacy save import; the `ws=` override now only
works for loopback previews; runtime validation of every client message (`validate-message.ts`), prototype-safe
purchases; movement distance credit replenished by server time (`movement-budget.ts`); authoritative position
corrections; 512-connection ceiling, 15 s login deadline, heartbeats, send-buffer sweep (`socket-lifecycle.ts`);
origin policy (`origin-policy.ts`); signup budget; session replacement with close code 4001; stale-credential
recovery with 4003; wallet attempts bound to a single provider with account-change cancellation.

**Chain reader (`chain-reader/src/`, `CHAIN_READER.md`).** Finalized-block reconstruction, real block timestamps,
bigint reconciliation, per-token decimals, worker-thread scans (two active, sixteen pending), 16 MiB body ceiling,
persistent history checkpoints, and `broker.ts`: broker NFT ownership from Transfer logs, `tokenWallet` /
`predictWallet` TBA resolution, stock-token kind counts, all decoration-only. Partial RPC configuration now fails
startup instead of silently selecting mock. A public-endpoint smoke check reached chain 4663 but the historical
state read failed with a provider `-32000` (archive access needed).

**Gameplay hardening.** Plant/tend/forage/sprint/mission handlers re-check position, village and ownership on the
server; exactly-once rewards; daily mission locks survive restarts; starter conveyor guarantees an affordable first
seed; nickname input no longer loses keystrokes to state refreshes.

**Test infrastructure.** `tools/regression-check.cjs` (compile, typecheck, lint, all server tests, all tool tests),
`tools/wardrobe-browser.cjs` (headless Chromium scenario modes: raid, gate-raid, gnome-raid, forage, sprint,
sprint-mission, tend-weeds, wallet-new, wallet-handoff, appearance, cosmetics, defenses, gates, decor, plaza,
oracle, focus, lifecycle, benchmark …), `tools/load-smoke.cjs` (200 clients, file and PostgreSQL), hardened-service
and sandbox checks, deployment config report, Oracle checks, promo renderer.

**Ops rehearsals.** DynamicUser + ProtectSystem=strict + NoNewPrivileges transient units verified with real
purchases across restarts; Node 22.23.2 staged under `/opt/pons/runtime-check.GjYzpp` and used by the preview
service; `pons-hd2d-preview.service` on :8132 runs the current server build with preserved saves.

**Promo pack.** `artifacts/promo/` three designs × two formats, captions in `POSTS.md`, copy-checked. Not published.

---

## 3. What is actually live right now (inspected 2026-09-08 ~21:00 UTC)

| Item | State |
|---|---|
| Public site `prometheus7.com/ponsgarden` | The partner-preview HD-2D build Codex deployed on 2026-09-08 morning (`assets/index-DdME0LY0.js`). The true-3D default and all later fixes are **not** public. |
| `pons-server.service` (public, :8130) | Active, 7 players, `storage: file`, `reader: cached(mock)`, Oracle URL set to the Pons instance. Runs as **root** on system Node **v22.11.0** (unpatched), no MemoryMax. Codex's newer server code is compiled in `/opt/pons/server/dist` but the process may predate it: restart only as part of a paired client+server release. |
| `pons-hd2d-preview.service` (:8132) | Active, patched Node, 4 villages, current build with preserved saves. This is the tested candidate. |
| `oracle-harness-ponsgarden.service` (:8099) | Active. |
| Leftovers | Two failed `pons-sandbox-qa-*` transient units (harmless, should be reset); a QA PostgreSQL 16 process on :15432 under `/opt/pons/pg-check.*` (about 1.2 GiB on disk); `/opt/pons` holds many `hd2d-refresh.*`, `plant-reference-*`, `wander-current-reference-*` evidence dirs. |
| Host | Disk 92% used (24 GiB free), RAM 444 MiB free of 15.6 GiB, swap full. This is the single biggest operational risk on the box, and most of it is not Pons. |
| Repo | 23 modified + 126 untracked files, zero commits since `5bacd50`. Snapshotted by the commit that adds this document. |

---

## 4. The plan to finish, in order

Each phase ends with a gate that must be met before the next starts. Gates are things a person can check.

### Phase A — Stabilise the repo and the host (half a day)

1. Commit Codex's tree (done alongside this document). From here on, every change is a commit; Codex's habit of
   leaving evidence in `/tmp/pons-*` directories is fine, but code must land in git.
2. Reset the two failed sandbox units (`systemctl reset-failed 'pons-sandbox-qa-*'`), stop the QA PostgreSQL
   process if no test needs it right now, and move reference/evidence directories under `/opt/pons` into one
   `/opt/pons/evidence/` folder or delete them per an agreed retention note. Do not touch other projects' data.
3. Identify what fills the rest of Box C's disk and swap (not Pons). Ben decides what to clear; the plan cannot
   provision a production database on a host at 92% with swap exhausted.
   **Gate:** `git status` clean; at least 40 GiB free on Box C; swap below 50%; no failed pons units.

### Phase B — Ship the current build publicly as a paired release (one day)

The tested candidate already exists on :8132. Promote it.
1. Stop `pons-server`, back up `/var/lib/pons` (same procedure as `PARTNER_PREVIEW_RELEASE.md`), copy the built
   server and client, switch the unit to the patched Node, restart, deploy the client with the atomic swap.
   Client and server must go together: the correction, carry-metadata, session-replacement and identity messages
   are new protocol variants.
2. Run `tools/check-public-preview.cjs` and `tools/regression-check.cjs` against the live build; open the site on a
   phone and a desktop; Ben confirms the black-screen report is gone on a fresh tab.
   **Gate:** health shows the new build; two real devices play; Ben signs off the 3D look as the direction.

### Phase C — Service hardening in production (half a day)

Apply the rehearsed unit: dedicated user (DynamicUser or a `pons` user), `ProtectSystem=strict`, `ProtectHome`,
`NoNewPrivileges`, a measured `MemoryMax` (the 200-client load peaked at 113 MiB RSS; set 512 MiB), private state
directory. Rehearse on the preview service first, then apply to public.
**Gate:** `tools/check_service_hardening.sh` passes on the public unit; the game still saves across a restart.

### Phase D — Production PostgreSQL (one to two days, depends on Phase A disk)

Follow `BOX_C_DATABASE_ROLLOUT.md` exactly: install PostgreSQL as a maintained service (not the extracted test
runtime), private socket, schema owner + restricted runtime login, `PONS_DATABASE_SCHEMA_MODE=runtime`, credential
delivered by systemd `LoadCredential`, scheduled `tools/database_backup.sh` with off-host copy (Box A or object
storage), a restore drill against the real dump, then a cutover that migrates the file store with the game stopped.
**Gate:** health shows `storage: postgres`; a purchase survives restart; a nightly backup exists off-host and has
been restored once.

### Phase E — The chain, once Ben supplies D-6 (one day of engineering, plus provider access)

1. Put `PONS_RPC_URL` (archive-capable: the historical-state read failed on a non-archive endpoint), `PONS_TOKEN`,
   `PONS_FROM_BLOCK`, `PONS_DECIMALS`, `PONS_CHAIN_ID`, `PONS_ECOSYSTEM`, `PONS_BROKER_NFT`, `PONS_BROKER_FROM_BLOCK`
   into the unit via credentials, not the repo.
2. `node tools/check_broker_views.cjs` must pass; `tools/deployment-config-report.cjs` must show every group present.
3. Verify two known wallets end to end: share page numbers, then real MetaMask sign-in on desktop, then Phantom on
   a phone once WalletConnect (project id from Ben) is added.
   **Gate:** `reader: cached(rpc-worker)`, two known-wallet gardens match their history, I-3 test still green.

### Phase F — 3D acceptance and art polish (two to four days, parallel with D and E)

The renderer is functionally complete; what remains is judgement and polish, listed in `WANDER_3D_DIRECTION.md`:
remaining idle gags (only Sprig, Gerald, Tulip animate), Bertrand's jaw and the Orchid's coat slip, NPC silhouette
distinctness, close-camera readability of weeds/stumps/decor, carry pose from behind, label overlap in crowds,
physical-device frame rate (software Chromium measured ~30 fps; real GPUs untested), and Ben's choice of visual
reference (FINAL013 capsule characters vs the ten-preset humanoids now vendored; Codex went with the humanoids).
**Gate:** Ben plays ten minutes on a phone and a laptop and approves; p95 frame time under 33 ms on a mid phone.

### Phase G — Content and growth (after launch)

Roster cut (D-5), seasonal seed drops, the M5 clip engine (raid replay to GIF from snapshots, whale leaderboard),
Oracle corpus expansion and per-NPC voices, promo publication (Ben's decision; `POSTS.md` is ready).

---

## 5. What is Ben's to do (nothing else is blocked on him)

1. **D-6 chain values:** Alchemy or other **archive-capable** RPC URL for chain 4663 (or the testnet), PONS
   contract address + deployment block + decimals, the partner meme-token allowlist, and confirmation of the
   broker collection `0x539cdd042c2f3d93ebc5be7dfff0c79f3b4fabf0` and its deployment block. Deliver them by
   editing the unit on Box C (the integration guide has the exact lines), never in chat.
2. **Host capacity:** decide what to clear on Box C (or add disk/RAM). Pons cannot get a production database on
   the current headroom.
3. **Release decisions:** approve the paired public release (Phase B), the hardening restart (C), the database
   cutover (D), and whether the promo cards go out.
4. **Visual acceptance:** play the 3D build on a phone and a laptop; say whether the ten-preset humanoids are the
   look, or FINAL013's capsule style; report any black screen on a fresh tab.
5. **Accounts:** a WalletConnect project id for phone wallets; counsel review of §0 against the shipping build
   (bible M4).
6. **Roster:** the D-5 cut of the 22 species.

---

## 6. Risks to keep in view

- **Protocol drift between public server and public client.** Codex's server compiles new message variants; the
  running public process may be older. Always release the pair; the atomic client swap alone is not a release.
- **Host pressure.** Swap is full today. A memory spike on any service on Box C can take the game down. Set
  MemoryMax on pons-server before anything else grows.
- **Evidence sprawl.** Dozens of `/tmp/pons-*` and `/opt/pons/*-reference-*` directories are how Codex proved its
  claims; they are also disk. Keep the retained ones listed in the docs, delete the rest after Phase A.
- **Two renderers plus fallbacks.** `r=2d` (Phaser), `view=orthographic` (HD-2D), and the default perspective view
  all exist. Once Ben accepts 3D, delete the Phaser scene and the orthographic path to halve the surface area.
- **Oracle answers still route by head word** ("gnome sentry" → GNOME desktop). Use unique in-world titles for new
  lore pages; do not promise NPCs will answer arbitrary questions well.

---

## 7. Progress log

**2026-09-08 21:00–22:00 UTC**

- **Phase A (partial).** Pons's own leftovers removed on Box C: the QA PostgreSQL
  cluster, the extracted test runtime, 4,075 `/tmp/pons-*` evidence directories and the
  reference/refresh folders. Pons went 1.9 GiB → 486 MiB. Two failed sandbox units reset.
- **Host relief.** `ensouledworld-runner` (EW1, port 8771) and the holon Oracle (port
  8765) paused with Ben's approval; neither had an nginx route. Memory went from
  79 MiB available to 9.2 GiB, load average 27 → 9. EW2 (port 8772, publicly proxied)
  and everything else were left running. Deleting the unreferenced old game version
  trees was blocked by the shell safety classifier; the exact commands are in the
  handover message for Ben to run.
- **Phase B done.** The 3D build is live at `prometheus7.com/ponsgarden` as a paired
  release on patched Node 22.23.2. See `RELEASE_3D_2026_09_08.md`.
- **Phase C done.** `pons-server` now runs as the non-root `pons` user with
  `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, no new
  privileges, an empty capability bounding set, restricted address families,
  `ReadWritePaths=/var/lib/pons`, `MemoryMax=768M` and `TasksMax=96`. The data
  directory is `0700 pons:pons`. **Ordering matters:** stop the service *before*
  chowning, or the departing root process rewrites the 0600 snapshot and the new
  user cannot read it. That mistake caused a brief outage, was diagnosed by bisecting
  the directives with transient units, and is now documented here.
- **Guest sessions (Ben's request).** A guest garden is deleted three minutes after
  the player leaves and its lot is freed; a reload inside that window keeps it. Only
  wallet-linked gardens persist, and a restart sweeps any guest left behind. The
  startup sweep removed seven empty guest gardens on the live server.
  `tools/guest-session.test.cjs` covers all four behaviours.
- **HUD (Ben's request).** Bar buttons shrunk; the phone grid auto-fits nine controls
  into two rows instead of three at 44px. The world went from ~60% of the viewport to ~75%.
- **Promotional material.** `tools/render-promo-3d.cjs` signs into the live game as a
  guest, hides the interface, captures three real framings and composes six cards.
  Copy checked against the banned-phrase list. Captions in `artifacts/promo/POSTS.md`.
  Nothing published.
- **Owner guide.** `BEN_STONKBROKER_SETUP.md`: seven steps, the archive-RPC trap
  called out, and the two policy questions that are Ben's alone.
- **Tests.** 27 of 28 server test files pass. The one failure is the PostgreSQL store
  test, which needs `PONS_TEST_DATABASE_URL`; its QA cluster was removed during
  cleanup. Phase D must stand up a maintained cluster anyway.

**Not done: Phase D.** Production PostgreSQL needs a maintained install (an `apt`
installation on a shared host), a schema owner and restricted login, an off-host
backup destination, and a migration window. That is a system-level change to a box
Ben shares with other projects, and the disk is still 92% full, so it wants his
go-ahead on both counts before it starts.
