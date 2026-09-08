# HD-2D playable preview — 2026-09-08

This is the first visual review milestone from HANDOFF_2026_09_08.md section 9.
The production client and production game service have not been deployed or restarted.

## Open the preview

- HD-2D: http://localhost:8124/?ws=ws://localhost:8132
- Existing 2D view: http://localhost:8124/?ws=ws://localhost:8132&r=2d
- Click/tap a destination or plot; WASD/arrows move relative to the camera.
- E/Space interacts; Z or the Zoom button cycles close, wider, whole village.
- The same local identity works in both views.

These URLs require the SSH tunnel to Box C. The current tunnel forwards local
8124 to remote 8123 (the existing static preview server) and local 8132 to
remote 8132 (an isolated game process). The test save directory is
/opt/pons/data_hd2d.BLm4JG. It does not use /var/lib/pons production data.
The preview will stop working if its tunnel or test processes stop.

## Paired preview refresh — 2026-09-08 05:56 UTC

The isolated preview backend was gracefully stopped and updated to match the
current client, including correlated NPC questions. It now runs as the transient
`pons-hd2d-preview.service`, using Node 22.23.2 from the verified project-local
runtime. Port 8132 binds only to 127.0.0.1 and remains reachable through the SSH
tunnel. The same save directory and existing preview-only fast spawn, short
shield and two-lot settings were preserved. This is not production tuning.

Recovery directory: `/opt/pons/hd2d-refresh.YRfeQs`, containing `before-stop`,
`stopped-data`, and `rebuilt-dist`. The code copy is the new build, not the old
process's loaded code. Do not restore stopped saves over subsequent progress
without a fresh backup and stopped writer. `tools/refresh-hd2d-preview.sh` records
the one-time operation with the old PID explicitly guarded; do not blindly rerun.

The new atomic snapshot loaded all six player records. A read-only preservation
check (`tools/check-preview-preservation.cjs`) passed for identity credentials,
wallet associations, plot capacities, garden locations and two planted plant IDs.
The new snapshot contains 84 ledger entries. Credentials/records were not printed.
This check is migration-specific: later legitimate gameplay may change its results.

Health and systemd state confirmed the new service active, one reconnected player,
file persistence and mock chain data. The public `pons-server.service` remains PID
732719, started at 03:51:51 UTC; it was not restarted by this preview refresh.
Transient preview service/tunnel reboot durability remains outside this test setup.
Ben's reported black-world rendering issue still needs device-side confirmation.

## Implementation

- Three.js 0.180.0, loaded separately from the Phaser fallback.
- Original PNG/JSON atlases, nearest-neighbor sampling, tilted orthographic
  camera, camera-facing sprites and a flat collision plane.
- Ground atlas combined at runtime into one tile draw; raised boundaries use
  instancing. Buildings have simple solid depth behind the existing artwork.
- Full village layout and public lot state, plant growth and mutations, NPCs,
  wild seeds, defenses, cosmetic scenery, carried plants, chat/name labels,
  interaction marker, channel indicator and restrained day/night lighting.
- WorldState owns the new client's protocol handling, actions and prediction.
  Hud accepts a narrow controller interface instead of importing WorldScene.
  Both views share the movement helper and authoritative collision map.
- The legacy Phaser scene retains its original message/rendering implementation
  during visual review. Finishing that consolidation and removing Phaser is
  deferred until the new view is accepted.
- No changes to the server protocol, production persistence, chain integration,
  economy, original atlases, or share-image renderer.

## Verification on Box C

- Baseline server build and all 26 existing derivation/signature checks passed.
- Copy lint, client TypeScript and Vite production build passed.
- Added 10 movement checks: diagonal speed, carrying, hostile sprinkler/mud,
  owner immunity, background frame clamping, idle movement and hedge collision.
- Existing multiplayer bot completed with ALL PASS against the isolated server.
  Its output skips the bounty case when funds are insufficient and some
  cosmetic checks are permissive when purchases lack funds; this is not proof
  of exhaustive defense/cosmetic coverage. Oracle used its fallback response.
- Browser: guest sign-in, purchase, click-to-walk planting, growth/reveal, Sap
  production, reload persistence, and switching to the 2D fallback succeeded.
- Desktop 1280x720 and phone-sized 390x844 layouts inspected. Actual touch
  hardware and performance with 200 players have not been tested.

Run the new movement checks on Box C from /opt/pons:

```sh
npx esbuild tools/movement.test.ts --tsconfig=client/tsconfig.json --bundle --platform=node --outfile=/tmp/pons-movement-test.cjs
node /tmp/pons-movement-test.cjs
```

## Review and remaining work

Owner-directed terrain revision: all HD-2D villages now use natural green
ground instead of biome-colored grass. Broad, low-contrast grass patches replace
pixel speckles; padded atlas cells and mipmapped linear ground filtering reduce
camera-motion shimmer. Character and plant sampling remains nearest-neighbor.

Review camera angle/zoom, pixel clarity and readability during planting and
raids before production rollout. Lighting is intentionally simple; lamps change
frames but do not yet cast individual lights or shadows. Fine effects and
building occlusion still need an art polish pass. Public unrevealed plant growth
is estimated from observation time, as in the existing view.

StonkBroker remains a separate integration milestone. No live broker connection
has been activated. Next: correct/test chain history reconstruction, verify the
broker ownership/account/token discovery model, and configure real contract
addresses plus a server-held RPC endpoint. Broker/stock holdings remain
decoration only under the existing project invariants.
# Touch-input hardening

The shared HUD joystick now tracks one pointer ID, ignores secondary-finger
movement/release, resets on pointer cancellation/capture loss/window blur/hidden
document, and disables browser touch gestures within its movement zone. Its
dead zone and normalized movement are unchanged. Three pure input tests in
`tools/joystick.test.ts` passed on Box C; this does not establish actual phone
or DOM pointer-capture behavior. A real-device interaction pass remains needed.
