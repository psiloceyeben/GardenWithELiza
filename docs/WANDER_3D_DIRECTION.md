# Wander-style true 3D direction — 2026-09-08

## Restrained facial idle checkpoint

Two mature plants now perform their roster-authored facial gestures: Gorbulon
raises its single oversized eyebrow for two seconds of a twelve-second cycle;
Plain Gerald slowly blinks during the last 800 ms of a nine-second cycle. These
are absolute-time bounded poses, with no accumulated motion. Reduced motion
immediately restores the neutral face. Growing stages remain still, and the
body/soil do not animate. The existing Tulip sleep nod remains unchanged.

Animated facial parts sit in nested groups, outside static mesh batching, and
retain the existing owned-material/disposal path. Box C aggregate
`/tmp/pons-regression-QtGXVB` passed 124 server tests and all 23 tool-test files.
Model checks cover neutral/peak/reduced-motion poses, unchanged static bounds,
growing-stage exclusion and nested geometry disposal. Client build passed with
existing warnings. Browser `/tmp/pons-wardrobe-browser-FMNJal`,
`--plants --wander --default-view --face-idle`, observed both real animation
cycles, neutral poses after a live reduced-motion change and resumed eyebrow
motion, zero page errors. Saved ten-species projection and synthetic wild model
cleanup checks also passed. Inspected overview screenshot:
`artifacts/partner-preview/plant-face-idles-3d.png`; the gestures are intentionally
subtle at this camera distance, not evidence of close-up art acceptance.

Only three roster idle behaviors are implemented so far. The remaining authored
gestures, final visual review and physical-device performance remain work. No
server gameplay, chain behavior or public deployment changed.

## Two-hand carrying checkpoint

Wander player avatars now raise both arms while carrying; leg animation remains
owned by the existing walk cycle. The carried plant's base follows the midpoint
of the two hand sockets in world coordinates, including avatar facing and
appearance rebuilds. The plant remains scene-owned for the existing model
cleanup path; it is not reparented into vendor geometry. Dropping/banking restores
the original arm spread and lets the normal animation return the arms to walking
or idle. No server movement, theft timing, ownership or reward rule changed.

`carry-pose.ts` keeps temporary rest-angle references in a WeakMap and reuses its
position vector. Missing/non-humanoid rigs retain the previous placement fallback.
Vendor source is unchanged. Box C aggregate `/tmp/pons-regression-OqNt95` passed
124 server tests and all 23 tool-test files, including pose/facing/release tests.
Client build passed with existing warnings. Actual two-browser plain-URL raid
`/tmp/pons-wardrobe-browser-vuUiLQ` passed normal movement, timed theft, both-client
hand alignment/raised arms, golden size-1.3 metadata, banking and reload, zero
page errors. Inspected `artifacts/partner-preview/carry-pose-3d.png`.
PostgreSQL repeat `/tmp/pons-wardrobe-browser-zHFkGg` also passed, now asserting
both clients restore normal arm spread and remove the carry model after banking,
before any reload. Post-shutdown database readback matched both players and one
unique plant. Retained isolated database:
`pons_browser_833a52ac4eee4363981ea2aaf0029208`.

This is a first holding pose, not per-species gripping or full-body animation
acceptance. Large plants and alternate camera angles still need art review.
Current development assets updated; public deployment unchanged.

## Default 3D entry checkpoint

The current development build now selects perspective + Wander characters from
a plain URL. `client/src/view-mode.ts` is shared by startup, the renderer and the
wardrobe so model selection and customization cannot disagree. Existing explicit
`view=perspective&characters=wander` links still work. For troubleshooting,
`view=orthographic` selects the older HD-2D view, `characters=sprites` selects
billboard characters, and `r=2d` selects the Phaser fallback. A failed Three.js
startup still redirects to the explicit Phaser route. Unknown view values use
the new default rather than silently selecting an older presentation.

Box C aggregate `/tmp/pons-regression-pZPFSV` passed compilation, copy lint,
124 server tests and all 22 tool-test files, including view selection overrides.
Client build passed with existing chunk-size and runtime sprite-reference
warnings. Browser `/tmp/pons-wardrobe-browser-Q5y1nh`, invoked with
`--perspective --wander --default-view`, omitted both visual URL parameters and
passed perspective projection, visible local avatar, wardrobe application,
keyboard/right-mouse orbit and mobile touch orbit/tap/cancel checks, zero errors.
Inspected screenshot: `artifacts/partner-preview/default-3d-desktop.png`.
Explicit orthographic regression `/tmp/pons-wardrobe-browser-6j7x62` passed
graphics loss/recovery, nickname/reload, wardrobe and mobile panel checks.
The same full regression on the plain-URL Wander default passed at
`/tmp/pons-wardrobe-browser-wq2mnv`, zero page errors. Its preceding run
`TcPWv9` failed a synthetic-banner measurement because live seasonal updates
could hide the forced fixture between browser calls. The fixture now pins the
banner updater, matching the dedicated status-layout test; no production CSS
change was needed. The harness's generic final label still says HD-2D, but this
run used `--wander --default-view` and no visual URL parameters.

This changes rebuilt development assets only, not the public deployment.
Physical-device acceptance, final art polish and sustained performance are still
required. Older opt-in descriptions below are historical checkpoints.

## Saved hairstyle customization checkpoint

### Shared development preview refreshed

The existing `pons-hd2d-preview.service` on Box C was gracefully restarted with
the matching current backend after validating its live PID, executable, working
directory, loopback host, port 8132, data path and mock-reader health. The refresh
script now discovers the service PID rather than killing a stale hard-coded one.
Retained artifacts: `/opt/pons/hd2d-refresh.ThJzc6` (`before-stop`, `after-restart`,
and the current compiled `rebuilt-dist`); isolated candidate copy:
`/tmp/pons-preview-candidate-6XbTR3`. The before-stop copy was taken while the old
service was running, not a stopped-data backup; snapshot.json is atomically
replaced. rebuilt-dist is the tested candidate, not the historical running build.

Candidate initialization/commit preserved all six records, balances, plots,
seeds, stats, defenses, cosmetics and wardrobe ownership. Restart comparison
retained identities, wallet associations, locations, appearance and both planted
identities. Health returned six players, file storage, cached(mock), active unit,
new PID 1040897 and zero automatic restarts. Public services were not touched.

Browser inspection found two open preview tabs sharing one garden identity,
which repeatedly displaced each other. The agent-created duplicate was closed;
the user's original tab was navigated to the current perspective/Wander URL.
Skin-tone and five hairstyle controls were visible in the current client after
restart. General duplicate-session reconnect handling remains an engineering
follow-up; closing a duplicate tab is not a software fix for that behavior.

Five free styles (short, long, bun, ponytail, shaved) now use validated server-owned
wardrobe state, public player appearance updates and persisted saves. Older saves
default to short; older servers without the hair field and the legacy view hide
the controls. Invalid choices and unaffordable combined purchases cannot partially
change appearance. No chain or broker mechanics change.

Outfit thumbnails include the selected hairstyle in their cache key. Hair cards
use hat-free rear three-quarter close-ups, explicitly labeled as previews; the
player's actual equipped hat is unchanged. Inspected the screenshot at
`artifacts/partner-preview/hair-wardrobe-3d.png`: all five silhouettes are readable.

Box C aggregate `/tmp/pons-regression-R2mox6` passed server/client compilation,
copy lint, 122 server tests and all 21 tool-test files; the asset build passed with
the existing size/plant-sprite warnings. Browser run
`/tmp/pons-wardrobe-browser-8lu3HX` with
`--appearance --wander --skin --hair --preview-failure` passed, zero page errors:
actual controls for all five choices, five distinct mesh geometries matching the
second client's avatar, unchanged Sap, saved reload, five distinct hair portraits,
cached reopen/context cleanup, and injected secondary-context failure recovery.
The isolated hair fixture omits passive-income plants so cost assertions are exact.

An earlier browser assertion sampled thumbnail readiness and distinctness across
separate shop refreshes; both now run against one DOM snapshot. This is not a
physical-phone performance test or a fix/reproduction of Ben's original black
screen. Public service and shared preview backend were not restarted; the latter
needs the paired server update before these new controls appear.

Ben's latest direction supersedes treating the current HD-2D presentation as the
visual end state: build actual 3D like Wander Around with its aesthetic and
characters. Keep the existing game/security/integration requirements intact.
The automatically replayed goal still says HD-2D; this document records the newer
explicit user requirement rather than silently accepting the older visual target.

## Source located, not yet selected as the definitive release

- `C:/Users/BenHo/Desktop/ClaudeCode/wander-around-game/src/client/playerAvatar.ts`:
  procedural Three.js humanoid, skin/clothes/hair/eyes/height/build and named
  attachment slots. It reads Wander localStorage; do not copy that persistence
  behavior into Pons or let it override authoritative wardrobe ownership.
- `.../src/client/toonAesthetic.ts`: depth-outline rendering with bounded fallback.
  Its comments explicitly say dynamic toon material changes were disabled after
  feedback. Preserve Pons's quiet green floor requirement.
- `.../src/client/main.ts`: perspective camera and pointer-lock controls.
- `.../src/client/generators/npc.ts`: explicitly labeled a minimal placeholder;
  this file alone does not establish the final character roster/art direction.
- `C:/Users/BenHo/Desktop/ClaudeCode/wander-engine-v2`: a separate substrate-engine
  checkout. Its README claims layered engine completion; that is not independently
  verified here and is not evidence that its visual assets are the current release.

Multiple packaged releases and older checkouts exist. Compare the current shipped
reference and character implementation before selecting reusable code/assets.
Do not import the entire Wander server, accounts, economy or training system.

## Implementation sequence

1. Establish the matching visual reference and inventory reusable character,
   environment, animation and material code. Record provenance and dependencies.
2. Add a separate true-3D renderer entry while retaining the working preview for
   comparison and recovery. Perspective camera with mouse look and touch camera
   controls; third-person inspection is useful for outfits, with Wander-like
   first-person exploration available. Camera choice must not change simulation.
3. Replace billboard-only characters with the selected actual 3D character
   geometry, animations and wearable attachments. Map existing saved colors/hats
   deterministically. New choices require validated server-owned persistence,
   authorization and multiplayer replication, not just local customization.
4. Build volumetric plants, garden boundaries, gates, buildings and terrain in
   the same visual language. Keep green low-motion ground, plant identity and
   mutation readability. Reuse proven collision coordinates initially; height
   traversal requires matching server collision, never client-only flight.
5. Rework selection/raycasting, planting, harvesting, carrying, NPC proximity,
   camera collision and labels for perspective play. Adapt movement prediction
   to camera heading without changing authoritative speeds or raid rules.
6. Verify the complete grow/customize/visit/raid/defend loop with multiple players,
   save/reconnect, read-only wallet/chain/broker decoration and share views. Test
   desktop and physical phone rendering, context recovery and performance on Box C.
7. Obtain Ben's visual acceptance, finish production gates and make a paired
   release with backups and rollback evidence. Do not call the project finished
   because the existing HD-2D tests pass.

First visible milestone: one existing saved garden with the selected Wander
character, perspective movement, true-3D plants and working planting interaction.
This is a milestone toward the full game, not a reduced replacement objective.

No Wander source was modified, no assets were copied, and no build or deployment
was performed during this source-discovery pass.

## Packaged-reference comparison

Located `C:/Users/BenHo/Desktop/wanderaroundBETAvFINAL013-win-x64/win-unpacked/resources/frontend-dist`.
Its HTML identifies `wanderaroundBETAvFINAL013` and loads `assets/index-Cu_fURoK.js`.
The accompanying source map embeds the original TypeScript, so this is stronger
evidence of shipped implementation than checkout filenames or README claims.

Compared source-map content to `wander-engine-v2/frontend/src` (line endings
normalized): `world/textures.ts`, `world/renderStyles.ts`, and
`controls/pointerLock.ts` match; `meshes/index.ts` does not match as a whole.
The packaged mesh source includes `buildPlayer`, `buildWizard`, `buildGuard`,
`buildMerchant`, and `buildScholar`. Its player is a capsule/pillar plus a sphere,
not the older `PlayerAvatar` customizable humanoid. Its style system includes
standard, toon, watercolor and other grading presets; "same aesthetic" does not
uniquely identify one preset. Do not substitute the older avatar and claim parity.

Next: establish whether Ben means FINAL013, the older humanoid version, or a newer
live version, then select the actual mesh builders from that reference. The
packaged source map can supply exact builder code where checkout files differ.
No need to ask Ben to locate source now; the remaining question is which visible
version/style he intends, not filesystem access.

## Camera-input foundation

The existing WorldState already rotated keyboard-plus-joystick input by
`inputYaw`. That math now lives in `client/src/game/camera-input.ts`, with a
finite-input guard. It retains the current fixed HD-2D heading and accepts any
future perspective camera yaw without depending on camera pitch. Pathfinding
continues in server coordinates, without an extra camera rotation.

Box C `tools/camera-input.test.ts` passes cardinal/arbitrary headings,
orthogonal basis, inverse rotation, magnitude preservation and nonfinite guards;
client TypeScript compilation passes. This is tested control groundwork, not
a perspective renderer or proof of the requested visual result.

## Opt-in perspective scaffold

`?view=perspective` selects a real Three.js PerspectiveCamera in the existing
renderer. On the tunneled preview use
`http://localhost:8124/?ws=ws://localhost:8132&view=perspective`.
Q/R rotate heading; right-button drag orbits heading/pitch; Zoom changes distance.
Left-click retains ground-plane selection. Normal URLs retain the original view.

Box C client compilation and build passed. The isolated browser mode
`tools/wardrobe-browser.cjs --perspective` passed at
`/tmp/pons-wardrobe-browser-g5bmXR`: perspective camera identity, keyboard orbit,
right-drag yaw change without adding a movement path, nonlost WebGL and a real
wardrobe purchase. Captured `artifacts/partner-preview/perspective-desktop.png`.

This is a control/projection scaffold, not the requested final 3D game: sprites
still billboard, ground is planar, touch camera and camera collision are missing,
and the actual Wander characters/plants are not integrated. Do not label this
Wander visual parity or replace the normal preview default yet.

### Perspective touch controls

Touch drags on the canvas now orbit after an 8px movement threshold; a touch
released below that threshold raycasts a destination. Pointer cancellation or
capture loss never selects ground, and blur/visibility changes clear ownership.
The existing movement joystick and DOM buttons retain their own handlers.

Box C type check, client build and perspective browser mode passed at
`/tmp/pons-wardrobe-browser-1FNSY8`. Chromium touch dispatch verified heading
change without a destination on drag, a ground-selection callback on tap, no
selection on cancellation, and a successful next tap after cancellation.
The tap callback was spied/stubbed for this input test, not counted as a full
planting or walking acceptance test. Physical-phone behavior remains unverified.

### Building obstruction foundation

Perspective camera placement now clips its focus-to-camera segment against
cached world-space building boxes, expanded by 0.25 world units for clearance.
The nearest hit pulls the camera forward; the HD-2D camera and player collision
are unchanged. Bounds rebuild with the visible world. Pure Box C tests cover
nearest blockers, clearance, off-axis/behind-camera boxes, zero-length rays,
focus-inside-solid behavior and unchanged input vectors. Client typecheck passes.
An inside-solid focus collapses to the focus as a conservative fallback; interior
camera design and smooth recovery are still needed. Fences/props/new character
geometry are not yet included. Do not claim complete camera collision coverage.

### Perspective planting acceptance

`tools/wardrobe-browser.cjs --perspective-garden` passed on Box C at
`/tmp/pons-wardrobe-browser-reu4Be` with no page errors. The fixture starts at
25 Sap with no planted plant. Actual Conveyor/Bag clicks purchase and select the
common starter seed. The client pathfinds near the plot, then an actual mouse
click at the projected plot center goes through camera raycasting to plant and
water. Assertions cover seed consumption, the normal 30-second base growth
duration, watering reduction, real-time reveal/modal, positive income rate, and
the identical revealed plant UID after reconnect. No fake clock, patched growth
duration, direct planting call or player-position assignment is used.

This is a one-player common-seed desktop scenario, not all tiers/mutations,
physical-touch planting, or final 3D plant-model acceptance. The perspective
camera still renders the existing sprite art. Screenshot:
`artifacts/partner-preview/perspective-garden.png`.

Seed cards now use native buttons with accessible species names and selection
state instead of click-only divs. The perspective gardening harness selects the
purchased seed using keyboard Enter, then checks selection/panel closure before
performing the same real planting/watering/reveal/reconnect loop. This is a
targeted keyboard improvement, not a complete accessibility audit.

The first keyboard run exposed Enter-to-chat intercepting native button
activation. The shortcut now respects focused controls, prevented events and
IME composition. After that fix, client typecheck/build and the complete
keyboard-seed planting loop passed at `/tmp/pons-wardrobe-browser-QkUSwu` with
zero page errors. The earlier failure was a real input conflict, not waived QA.

Panel refresh now restores focus to the same identifiable button (ID or data
attributes), without scrolling. If it disappeared or became disabled, focus
moves to the panel close button rather than another purchase. A 1.5-second seed
focus pause was added to the planting harness. One run failed the focus check;
the next run, with extra failure diagnostics but no further gameplay change,
passed the full loop at `/tmp/pons-wardrobe-browser-wmb5gy`. Treat focus stability
as still requiring investigation/repeated validation, not conclusively fixed by
that single successful rerun. No production release was made.

Follow-up: `tools/wardrobe-browser.cjs --focus` checks focus both before and after
30 forced HUD refreshes interleaved with actual server updates, then activates
the seed with Enter. Four fresh sessions passed (120 forced refreshes total):
`d6DpEN`, `5ldJkk`, `aBiJoz`, `iPdrWR` under `/tmp/pons-wardrobe-browser-` on Box C.
No page errors. This establishes the restoration path in those sessions but
does not identify the cause of the earlier single failure; retain that caveat.

Focused native UI controls now stop keydown propagation to game shortcuts without
preventing native activation. This avoids Space both selecting a seed and
interacting with a plot behind the UI. Box C typecheck/build and
`--focus --space` passed at `/tmp/pons-wardrobe-browser-02fOvO`, including 30
refreshes, Space selection and zero calls to the spied game interaction handler.
That run's old generic success label says Enter; the executed flag was Space.
The harness now reports the actual key to avoid that ambiguity in future runs.

## Newer Box C character source discovered

Read-only deployment inspection located a newer implementation at
`/opt/wander-engine-v2/src/wag/client/playerAvatar.ts` (38,842 bytes, July 13).
It defines ten presets: wanderer, warden, scholar, forager, nomad, capybara,
goblin, golem, doge, chad. It uses articulated character rigs, wearable generation,
clay material helpers and shader patching. This is materially different from
both models in the earlier A/B reference image; that comparison was incomplete.

Current Box C nginx maps `/multiplayer/` assets to
`/var/www/wander-static/multiplayer/assets/`, separate from `/mp-staging/`.
`/opt/wander-engine-v2/dist-wag` is another built copy and must not be assumed
byte-identical to the served directory. Next inspect the served bundle/source
relationship and render the newer presets in isolation. Do not change Wander
deployment, shared runtime, account state or material modules during this work.

The served `/multiplayer/index.html` identifies Beta 5.1 and references
`assets/index-VJLoN3RN.js`. That exact bundle contains all ten preset names.
This is supporting evidence, not a byte-for-byte source/build attestation.
Newer playerAvatar source SHA256:
`b82e468e9c9da3fe5cca3cc7aa09943e20b18e27f14638de9ab4db92733769c8`.

`tools/render-wander-current.cjs` bundles the newer source in a separate Box C
reference directory using Pons's Three dependency, instantiates all ten models
with `loadSaved:false`, and renders neutral studio views without game services
or accounts. Successful render: `/opt/pons/wander-current-reference-ePRXNO/presets.png`.
Inspected local artifact: `artifacts/partner-preview/wander-newer-presets.png`.
All ten silhouettes and labels are visible. This supersedes the incomplete A/B
image for discussing the newer character family; it is not an in-game screenshot.

### Reuse dependency audit

The isolated reference bundle's non-Three dependency graph contains ten Wander
modules: resolver/substrate, resolver/relational, textureToVector, clayShaderPatch,
materialRegistry, characterRigContract, generators/materials, hitbox,
generators/wearable and playerAvatar. It does not pull in Wander account or
multiplayer entry modules. Metafile evidence:
`/opt/pons/wander-current-reference-zU3OKK/dependencies.json`.
All ten constructors rendered with external HTTP requests blocked; zero attempted
external requests and zero localStorage keys were observed in that scenario.
This is constructor/render evidence, not a whole-module security audit.

Important integration constraint: `loadSaved:false` prevents constructor loading
and equipment writes, but `update()` calls `save()`, which unconditionally writes
Wander's appearance key. Do not call that persistence path from Pons. A visual-only
adapter must accept validated server appearance, rebuild without Wander storage,
drive animation from movement state, and dispose owned resources. Do not change
the shared live Wander implementation to achieve this. Keep Pons cosmetics
server-authoritative and do not import Wander economy/account logic.

### Visual-only adapter implementation

`client/src/three/visual-avatar.ts` now wraps an injected model factory. It passes
`loadSaved:false`, copies incoming appearance, rebuilds without calling the
asset's save/update methods, forwards finite animation inputs, and disposes
unique geometry/material resources once while leaving library-shared textures
alone. The caller must provide validated server appearance; this renderer
adapter neither validates ownership nor authorizes new presets/equipment.

Box C client typecheck and the actual ten-model isolated render passed at
`/opt/pons/wander-current-reference-zKKIM4`. For every preset the harness changed
the shirt color and restored it, animated twenty steps, rendered, and called
dispose twice. The model's save/update methods were replaced with throwing
guards. No guarded calls, page errors, external requests or localStorage keys
occurred. Detachment and cleared children were asserted after disposal.

This adapter is not wired into gameplay yet. Source vendoring/provenance,
wearable ownership mapping, full shared-resource lifecycle verification and
the selected in-game visual reference remain pending. Live Wander was untouched.

### Saved wardrobe mapping

`client/src/three/garden-wardrobe.ts` maps all six saved shirt indices to the
exact RGB palette used by the existing sprite generator and all four saved hat
indices to straw/cap/top/bandana identities. Invalid indices fall back visually
to the starter style; no ownership or economy state is modified. It also defines
original volumetric Pons hat meshes sized for the Wander head attachment slot.

Box C client typecheck and `tools/garden-wardrobe.test.ts` pass all 24 mappings,
invalid-index fallbacks and nonempty 3D bounds for each hat. This does not yet
prove visual fit across all ten character head shapes. Hat attachment, appearance
refresh, carried items and multiplayer display remain integration work; no
character defaults or public deployment changed during this pass.

### Wardrobe attachment integration check

VisualAvatar now maps server-provided color/hat indices, attaches the Pons mesh
to the asset's head slot, removes/disposes the prior hat on replacement, and
reattaches it after an appearance rebuild. Identical requests do not duplicate
geometry. Caller authorization responsibilities are unchanged.

Box C typecheck and all-ten-model harness passed at
`/opt/pons/wander-current-reference-IrUlvP`: each model cycled through four hats,
repeated each request, retained exactly one hat, animated and disposed, with no
external requests or localStorage writes. Inspected artifact:
`artifacts/partner-preview/wander-pons-wardrobe-fit.png`.
Visible silhouettes establish the attachment path; individual head/hair offsets
still need art polish. This remains an isolated reference, not gameplay wiring.

### First gameplay integration (opt-in)

`?view=perspective&characters=wander` now dynamically loads the vendored model
for the local player. Its position, facing, walking animation and shirt/hat use
existing game state; it replaces only that player's billboard. No new character
ownership, economy or Wander persistence paths are enabled. Renderer disposal
also disposes the visual adapter. Default rendering and public deployment remain
unchanged. Remote players, NPCs, plants and carried plants still use sprites.

Box C client typecheck/build and `wardrobe-browser.cjs --perspective --wander`
passed at `/tmp/pons-wardrobe-browser-gOeqQ3`: desktop/touch orbit and taps,
real hat purchase, model position matching game coordinates, absence of the local
player billboard and absence of Wander appearance/equipment storage keys.
No page errors. Inspected `artifacts/partner-preview/wander-gameplay-local.png`.
This is software Chromium evidence, not physical-device or final art acceptance.
The screenshot still shows label overlap; environment depth, remote characters,
3D plants/carry poses and cohesive pixel-art material polish remain next work.

### Multiplayer model integration

The same opt-in now replaces remote player billboards too. Each remote model
uses interpolated network position, facing/movement and the existing public
shirt/hat state. Departed players' models are detached and disposed; renderer
shutdown disposes all remaining remote models. Wanted/speech labels are raised
above the taller models. No network protocol or cosmetic entitlements changed.

Box C typecheck/build passed. The two-client
`wardrobe-browser.cjs --perspective-raid --wander` run at
`/tmp/pons-wardrobe-browser-Sullz4` passed model presence/position and billboard
replacement checks on both clients, real pathfinding/timed theft, named plant
banking, reconnect and detached/cleared model cleanup after disconnection.
No page errors. Inspected `artifacts/partner-preview/wander-multiplayer-banked.png`.
This raid fixture intentionally disables the login shield; it does not prove
production shield behavior. NPCs and plants/carry visuals remain sprites.

Expanded repeat run `/tmp/pons-wardrobe-browser-ZhElWR` also passed an owned
cap equip and orange shirt purchase through the actual shop, with the other
client's 3D model receiving both changes before the same full raid/reconnect/
cleanup sequence. Zero page errors. Physical-device and final visual QA remain.

### Town NPC models

The opt-in now renders all five named town NPCs and the conveyor seller as
Wander-family 3D humanoids. `npc-appearance.ts` preserves their existing sprite
shirt/hat palette, skin and trouser colors. Authored tinted headwear is separate
from player wardrobe entitlements. NPC identities, positions, missions and
dialogue routing remain unchanged. Missing/changed prop roles dispose old models;
shutdown disposes the NPC collection. Distinct role silhouettes and label spacing
still need art refinement; these are not final bespoke NPC assets.

Box C evidence:
- Typecheck and final client build passed (existing chunk-size/runtime sprite
  URL warnings remain).
- `wardrobe-browser.cjs --oracle --wander` passed at
  `/tmp/pons-wardrobe-browser-gndN4h`: six NPC models attached, no matching
  billboards, Ada palette, actual path/dialogue, Oracle planting answer,
  typing persistence, stale response filtering and timeout handling. Harness
  output still calls the route HD-2D, but this run used the perspective/Wander URL.
- Final camera/touch/real hat purchase regression passed at
  `/tmp/pons-wardrobe-browser-vQeQrK` after the role-replacement guard was added.
- Ten-model headwear/rebuild/disposal reference passed at
  `/opt/pons/wander-current-reference-zvpAcR`, zero external requests/storage keys.

Inspected `artifacts/partner-preview/wander-npc-dialogue.png`; its timeout message
is the deliberately unanswered final test question, not the earlier successful
planting response. Physical-device QA, NPC silhouette polish, 3D plants and
environment conversion remain. Public site not deployed in this pass.

### First volumetric plant species

`plant-model.ts` authors Gorbulon Sprig as a volumetric low-poly stem, leaves,
head, smile and eyebrows in its existing sprite palette. Five growth stages
are supported. Plot rendering retains existing feral movement, screaming/lock/
weed overlays, with model-specific golden/holographic colors, colossal scale
and a backwards-facing rotation. Unsupported species still use their original
sprites; this is one of 22 species, not full roster conversion.

The opt-in renderer creates/replaces stage models and disposes removed plants.
Carried sprigs use a 3D model positioned in front of player facing; the current
species-only carry protocol does not expose mutation/size metadata. Hand poses,
carried mutation fidelity, wild sprig conversion, other species, original gag
animation fidelity and physical-device performance remain unfinished.

Box C `tools/plant-model.test.ts` passed five progressively taller volumetric
stages, seven mutation transform paths and idempotent geometry/material cleanup.
Client typecheck/build passed, with existing build warnings unchanged.

Two-client `--perspective-raid --wander` passed on the unchanged final build at
`/tmp/pons-wardrobe-browser-COLcti`: carried model present without a billboard,
old plot model removed, banked model restored at stage 4 after reload, wardrobe
sync and departure cleanup, zero page errors. Inspected carry/banked screenshots
under `artifacts/partner-preview/wander-sprig-*.png`. Carry visibility is weak
from behind the character; attachment/pose polish is still needed.

An earlier run `/tmp/pons-wardrobe-browser-rdIoGQ` completed theft/banking but
failed browser initialization on reload while its served build was replaced.
The unchanged-build repeat passed; this suggests a test/build interference issue,
not proof of a root cause. Do not rebuild shared test assets during browser runs.

### Carried appearance metadata

Optional server-to-client `CarryAppearance` now includes only the carried
plant's public mutation and size, sent in the carry event and player snapshots.
No client command, transaction, entitlement or settlement behavior changed.
Older servers remain supported through neutral visual defaults; old clients
ignore the additional fields. WorldState clears appearance when carry ends and
reads it on welcome/snap as well as carry events.

The sprig renderer now uses the full-grown model while carried, retains its
mutation tint/rotation/scale, and applies public size to both plot and carried
models. The carry offset is raised and shifted sideways for visibility; posed
hands and complete carried feral/screaming effects remain unfinished.

Box C client/server compilation and client build passed; all 24 server raid
regression tests passed. Server changes are staged, not restarted into the shared
preview or public service in this pass; metadata requires the updated backend.

Two-browser golden/size-1.3 sprig test passed at
`/tmp/pons-wardrobe-browser-5gqCD5`: both carrier and observer rendered the golden
material and exact 1.3 model scale, owner plot removal, banked size after reload,
cleared carry metadata, preserved plant name and remote avatar cleanup. Zero page
errors. Inspected `artifacts/partner-preview/wander-golden-carry.png`.

### Avatar color isolation regression

Investigated apparent shirt color differences between screenshots. NewPlayer
randomizes the starter shirt, explaining different raider appearances across
independent fixtures; source inspection found separate per-avatar materials.
No material-sharing bug was reproduced.

Added `wardrobe-browser.cjs --appearance --wander`, a deterministic two-client
fixture checking actual scene material identities and material color values
after a real cap equip/orange shirt purchase. Both clients retain separate
orange/blue player models and the six authored NPC palettes, with no material
objects shared across avatars. Pass: `/tmp/pons-wardrobe-browser-Lc7J15`, zero page
errors. This checks scene materials, not final framebuffer pixel color accuracy.
The initial diagnostic failed its incorrect fixed-blue expectation against a
random starter shirt; the appearance-only fixture now explicitly sets blue.

### Avatar material lifetime repair

The imported shader registry retained disposed material objects. A new reference
assertion reproduced 16 retained entries after the first avatar's outfit cycles
and disposal (`/opt/pons/wander-current-reference-FMAFeX`). Removing disposed
entries exposed a second issue: preset-created but unused materials were never
disposed (four retained entries, `/opt/pons/wander-current-reference-DQIosf`).

The vendor generator now applies two guarded, hash-recorded Pons-only patches
to its private snapshot: unregister materials on disposal and track every
created avatar material, including those not attached to a mesh. VisualAvatar
disposes the owned list along with mesh resources. Live Wander files were not
edited. Patched inputs and provenance are archived in the vendor directory.

Final ten-preset wardrobe/rebuild/animation/disposal reference passed at
`/opt/pons/wander-current-reference-tSsqB7`; the registry returns to its initial
count after every avatar. Client typecheck/build and in-game perspective/touch/
hat-purchase checks passed (`/tmp/pons-wardrobe-browser-65ILi8`). No page errors.
This fixes the measured material-reference retention, not a comprehensive heap
or long-session performance certification. Public service remains unchanged.

### Root-vegetable model expansion

Plain Gerald, Concerned Radish and Unlicensed Carrot now have authored 3D
geometry using their original palette/silhouette references. Gerald has a pointed
bulb and neutral face; Radish has leaves, a white root tip, frown and sweat drop;
Carrot has a tapering root, scored body, mature suit/tie and briefcase. Together
with Gorbulon Sprig this covers four of 22 species, each with five growth stages.
Mature gag details are currently static, not the full sprite animation cycles.

The shared model path supports their plot and carry rendering and restores each
species' own material palette after mutation styling. Remaining 18 species keep
their existing sprites. Box C typecheck/build and 20-model growth/volume/mutation/
color-restoration/disposal tests passed. Reference render passed at
`/opt/pons/plant-reference-2pDT8H`; inspected
`artifacts/partner-preview/four-plant-growth-models.png` (columns: Sprig, Gerald,
Radish, Carrot; rows: stages 0–4).

Actual isolated server/browser saved-state projection passed at
`/tmp/pons-wardrobe-browser-I1k9Sp`: all four revealed species rendered as stage-4
models without duplicate plot billboards, zero page errors. This fixture does
not retest real timed growth/theft for each new species. Public deployment,
physical-device QA and final visual acceptance remain outstanding.

### Cactus species and wild-model projection

Clammy Pete and Cactusberry Vicar now use volumetric cactus bodies, branched
arms and pale spines. Pete preserves the green palette/smile/sweat detail; Vicar
preserves the purple palette/neutral face and mature crown. Six of 22 species
now have authored models, each with five growth stages. Remaining 16 retain
sprites. Completed species also use models in the wild-plant rendering path.

Box C typecheck/build and 30-model geometry/growth/mutation/color-reset/disposal
checks passed. Six-species server/browser plot projection passed at
`/tmp/pons-wardrobe-browser-aDsalS`. Reference render passed at
`/opt/pons/plant-reference-VuCW5i`; inspected
`artifacts/partner-preview/six-plant-growth-models.png`.
This is model/render integration evidence, not final animated art acceptance or
real foraging verification for every species. No public deployment was performed.

Expanded browser repeat `/tmp/pons-wardrobe-browser-qyOkL8` also passed a
synthetic wild cactus projection/removal check: no duplicate billboard, and
model detached/cleared after removing that render fixture. It does not send a
forage command or establish server-side collection behavior. Zero page errors.

### Sir Blombus mushroom model

Sir Blombus now has five growth stages, a volumetric spotted red cap, tan stem,
smile and mature sword detail. Shared mutation/palette restoration and resource
cleanup apply. Seven of 22 species are modeled; 15 remain sprites. Sword and
facial gag animation are still static art details, not final animation parity.

Box C typecheck, client build and 35-model growth/volume/mutation/disposal checks
passed. Render reference `/opt/pons/plant-reference-UJkX32` was inspected as
`artifacts/partner-preview/seven-plant-growth-models.png`. Browser fixture
`/tmp/pons-wardrobe-browser-j7AJvA` passed seven saved-species plot projections
without billboards plus synthetic wild-model cleanup, zero page errors. This
does not certify real timed growth/theft for each species. Public site unchanged.

### Melon and pumpkin family

Weeping Wumbus, Melonhound and Pumpkin Esquire now have volumetric striped
bodies, distinct original palettes, stems and facial expressions. Mature Wumbus
has a tear, Melonhound a sweat detail, and Esquire a monocle/chain. The pumpkin is
wider/flatter than the melons. Ten of 22 species now have five model growth
stages; 12 species and complete gag animation remain unfinished.

Box C typecheck/build and 50 growth-model volume/mutation/palette-reset/disposal
checks passed. Reference `/opt/pons/plant-reference-3Eb8Q5` was inspected as
`artifacts/partner-preview/ten-plant-growth-models.png`. Actual isolated saved-plot
projection for all ten species plus synthetic wild lifecycle passed at
`/tmp/pons-wardrobe-browser-jZ9QaB`, zero page errors. Real growth/theft acceptance
for every species and physical-device/visual polish remain. Public site unchanged.

### Corn and bamboo models

Corn That Knows now has a volumetric cob, kernel pattern, green husks and narrow
eyes. Bamboo Inspector has three jointed stalks, leaves, a face and mature
clipboard. Both retain the sprite palette references. Twelve of 22 species now
have five modeled growth stages; ten remain sprites. Gag animation, dense-scene
draw-call optimization and final physical-device/art acceptance remain open.

Box C typecheck/build and 60 growth-model volume/mutation/palette/disposal checks
passed. Inspected reference `/opt/pons/plant-reference-KuHwWr` as
`artifacts/partner-preview/twelve-plant-growth-models.png`. Browser fixture now
supports `--plant-page=N`, limiting each fixture to ten plots. Page 1 passed the
two new saved species and synthetic wild cleanup at
`/tmp/pons-wardrobe-browser-11QNu0`, zero page errors. This pass did not repeat
the full theft/growth flow for these species. Public site unchanged.

### Duchess Turnip, Lord Eggplant and Yelling Tuber

Added three authored bodies: a white/purple crowned turnip with root tip, a tall
purple eggplant with green cap/highlight, and a mottled tan tuber with a mature
open mouth, teeth and tongue. Fifteen of 22 species now have five modeled growth
stages; seven remain sprites. These are static gag details; Duchess's wave,
eggplant hover and tuber's yelling animation remain to be implemented.

Box C typecheck/build and all 75 growth-model mutation/palette/disposal checks
passed. Page-1 saved-plot projection (five species) plus synthetic wild cleanup
passed at `/tmp/pons-wardrobe-browser-wLkv9i`. Reference close-up from
`/opt/pons/plant-reference-CKU8eX` inspected as
`artifacts/partner-preview/turnip-eggplant-tuber-growth.png`; no page errors.
This does not replace real per-species growth/theft or device acceptance tests.
Public site unchanged.

### Chain-derived scenery models

The opt-in renders wither-mark stumps and the three original broker-flora designs
(crystal fern, glow cap, spiral reed) as solid palette-matched models. Existing
public land counts and positions are unchanged. No colliders, dynamic lights,
rewards, chain calls or progression effects were added; I-3 remains intact.

Box C model footprint/volume/material-disposal tests, client typecheck and asset
build passed. Browser `--decor --wander` passed at
`/tmp/pons-wardrobe-browser-mNkCtt`: synthetic public-land counts create all four
models without duplicate billboards; restoring the prior land removes them and
disposes every tracked geometry/material. Zero page errors. An initial test
incorrectly expected the shared disposer to clear child arrays; the corrected
test observes resource disposal and scene detachment directly.

Inspected `artifacts/partner-preview/chain-decor-3d.png`: colored flora is visible
beside the lot, but close-up silhouette and stump visibility acceptance remain.
This fixture does not verify ownership, wallet linking, or a live broker read.
Default HD-2D and the public deployment are unchanged; existing build warnings
remain. The tool-test inventory now includes `decor-model.test.ts` (16 files).

### Remaining static plaza props

Bench, board, stall, sign, pot and track now join fountain/lamp in the opt-in plaza
model factory. Shapes retain sprite palettes and remain in existing footprints;
solid props use the existing model-derived camera bounds. The track is an
intentionally flat modeled ground marking. Server interactions are untouched.

Box C eight-kind geometry/footprint tests and client typecheck/build passed.
Browser `--plaza --wander` passed at `/tmp/pons-wardrobe-browser-dfiMrB` with real
paths to the board area and fountain, and assertions that all eight prop families
are attached without billboards. Zero page errors. Inspected
`artifacts/partner-preview/full-plaza-3d.png` (earlier first-view run
`/tmp/pons-wardrobe-browser-mH34Bl`) and `artifacts/partner-preview/fountain-3d.png`:
board, striped stall, pots, benches, sign and fountain are visible as models.
This is not a test of board/stall/sign interactions or physical-device camera
acceptance. Personal cosmetic props and defenses still need 3D conversion.
Default HD-2D/public site remain unchanged; existing build warnings remain.

### Purchased lanterns and nameplates

Opt-in personal lantern pairs and nameplates now reuse plaza geometry through
the lifecycle-managed decoration renderer. Lantern scale stays 0.75 and its
night color uses the same non-flickering switch. Default sprite frame selection
and scale remain unchanged. Ownership, prices and server rules are untouched.

Box C client typecheck/build passed. Browser `--cosmetics --wander` passed at
`/tmp/pons-wardrobe-browser-ZzwJ9S`: real shop purchases charge 250 and 150 Sap
(1000 to 600), attach three models without billboards, and survive reload.
Synthetic lot removal verifies every geometry/material disposal and detachment;
restoring the lot recreates the models. Zero page errors. Inspected
`artifacts/partner-preview/cosmetics-3d.png` after walking the player away: gate
decorations render, although the sign partly obscures the right lantern at this
camera angle. Broader gate-side spacing and night/device visual acceptance remain.
This is not a server-side cosmetic removal feature. Defenses still need 3D work;
no public deployment or server restart was performed.

### Gnome and sprinkler models

The opt-in now models the blue-coated, white-bearded gnome, its default red cap
and wizard/crown/propeller purchases, plus a gray sprinkler with static droplets.
Gnome position retains the existing visual patrol path and faces its direction;
leg articulation and reactive attack animation are not added. Hat changes replace
the owned model; no separate hat billboard remains. Public defense redaction and
raid/watering rules are unchanged. Default HD-2D sprites remain available.

Box C bounded-volume tests for five defense variants, client typecheck and build
passed. Browser `--defenses --wander` passed at
`/tmp/pons-wardrobe-browser-IhtdoC`: actual gnome/sprinkler and all three hat shop
purchases, exact Sap charges (3000 fixture Sap to 950), old hat-model detachment,
no duplicate billboards, and reload persistence. Zero page errors. Inspected
`artifacts/partner-preview/defenses-3d.png`; gnome and sprinkler are visible at
garden scale, but close-up all-hat visual acceptance remains. This test does not
prove 3D raid tagging, sprinkler growth timing or scarecrow deception end to end.
Gate damage states and broader defense gameplay/browser checks remain. Existing
build warnings remain; no public deployment. Tool-test inventory is now 17 files.

### Gate damage models

Opt-in purchased gates now select intact, damaged or broken geometry from public
gate HP/max. Damaged gates have split rails; broken gates leave posts and low
debris. Left/right lots rotate the model 90 degrees. The opt-in ground no longer
adds the old raised gate block, while default HD-2D is unchanged. Gameplay
collision remains server/state-controlled; these models add no new blockers.

Box C health-state mapping and both-orientation footprint tests, client typecheck
and build passed. Browser `--gates --wander` passed at
`/tmp/pons-wardrobe-browser-qwtNEU`: actual 300-Sap fence purchase and reload,
synthetic public HP changes to damaged/broken and old-model detachment. Zero page
errors. Inspected `artifacts/partner-preview/gate-broken-3d.png`: a post is visible,
but the player obscures much of the gate, so full visual acceptance remains.
This does not test an actual attacker damaging the gate or a repair round trip.
Those interactions and all-four-side browser coverage remain outstanding. No
public deployment; existing build warnings remain. Tool-test inventory: 18 files.

### Actual gate attack/repair browser cycle

`--gate-raid --wander` passed on Box C at
`/tmp/pons-wardrobe-browser-1A520C`. Two real clients buy a fence (300 Sap), move
the owner away through normal pathfinding, and approach/attack the gate through
three normal break channels. HP reaches 2, 1, then 0; both clients show damaged
and broken models. The owner repairs through the shop for 100 Sap; both clients
show intact geometry, and owner reload preserves HP 3 and Sap 600. No synthetic
HP/position assignment is used in this mode. The isolated fixture disables login
shielding and starts with no income-producing plant; other rules are unchanged.
Zero page errors. This closes the earlier synthetic-only gate interaction gap.

Inspected `artifacts/partner-preview/gate-repaired-3d.png`; attacker still occludes
part of the gate, so unobstructed close-up and all-four-side visual acceptance
remain. The test does not claim physical-device or sustained multiplayer load
coverage. No source asset rebuild, production restart or public deployment was
performed for this test-only follow-up.

### Gnome patrol clock correction

Found a renderer/server mismatch during raid follow-up: Renderer3D used animation
time since page opening, while server tagging uses epoch milliseconds. Gnome
geometry could therefore be far from its actual tagging position. Both now use
`shared/gnome-patrol.ts`; WorldState samples welcome/snapshot server timestamps
and advances them with monotonic elapsed time between arrivals. This applies to
Renderer3D's sprite and modeled gnomes. Server patrol/tag rules are unchanged.
Transit latency still introduces an offset; this is not latency compensation.

Box C `/tmp/pons-regression-8H7LGr` passed 94 server tests, zero failures/skips,
all 19 tool-test files, compilation and copy lint. Clock tests cover timestamp
sampling, monotonic advancement, invalid samples and known patrol phases. Asset
build passed with existing warnings. Browser defense purchases/reload passed at
`/tmp/pons-wardrobe-browser-QvCPYn`, also verifying the model uses a recent server
epoch timestamp and exact shared patrol coordinates. Zero page errors. The
actual gnome-tag/recovery two-client browser scenario remains pending; this fix
was a prerequisite discovered during that work. Legacy Phaser's direct wall-clock
patrol and high-latency device behavior still need clock alignment review.
No public deployment or service restart was performed.

Gnome carry-recovery follow-up passed at `/tmp/pons-wardrobe-browser-9X09gV`
(`--gnome-raid --wander`): real theft, post-theft gnome purchase, normal patrol tag,
single named/golden/size-preserving return, both-client carry-model cleanup and
owner reload. No forced positions/patrol clock; zero page errors. See
RAID_VERIFICATION.md for fixture boundaries. This closes the actual patrol
carry-recovery gap, but not pre-existing-gnome interruption, latency or device
acceptance. No public deployment or source asset rebuild in this test-only pass.

### Tulip and sunflower models

Low Ambition Tulip now has a pink volumetric cup, pointed petal tips, green
stem/leaf and mature sleepy eyes. Sunflower Who Lied has eight yellow petals,
a brown face disk and a green stem/leaf. Seventeen of 22 species now have five
model growth stages; five remain sprites. Snoring/glance animation is not yet
implemented, and these checks are not final art/device acceptance.

Box C typecheck/build and 85 growth-model volume/mutation/palette/disposal checks
passed. Reference `/opt/pons/plant-reference-RaL81U` inspected as
`artifacts/partner-preview/tulip-sunflower-growth.png`. Page-1 saved plot projection
of seven species plus synthetic wild cleanup passed at
`/tmp/pons-wardrobe-browser-swIFr8`, zero page errors. No public deployment.

### Pod, bush and pineapple models

Bogwort now has a tall green pod with three peas and a frown; Bartholomew Bean
has a lobed green bush with berries and a smile; Pineapple Enforcer has a patterned
gold body, pointed foliage and mature folded arms. Twenty of 22 species have
five modeled growth stages. Grabby Bertrand and Fraudulent Orchid remain sprites;
shivering/shaking and other full idle animations are not yet implemented.

Box C typecheck/build and 100 growth-model volume/mutation/palette/disposal checks
passed. Inspected `/opt/pons/plant-reference-ckC8DJ` as
`artifacts/partner-preview/pod-bush-pineapple-growth.png`. Page-1 ten-species saved
plot projection plus synthetic wild cleanup passed at
`/tmp/pons-wardrobe-browser-lADVZ5`, zero page errors. Physical-device performance,
per-species gameplay acceptance and final art polish remain. Public site unchanged.

### Full base roster: final flytrap and orchid

Grabby Bertrand now has volumetric upper/lower jaws, teeth, eyes, stem and leaves.
Fraudulent Orchid preserves the two pointed green forms inside a brown buttoned
coat with lapels. All 22 roster entries now have base models and five growth
stages; `plant-model.test.ts` compares model IDs with `content/roster.json` to
prevent missing/extra species. This is base geometry coverage, not animation
completion: jaw motion, coat slip and the other species' full idle gags remain.

Box C typecheck/build and all 110 growth-model volume/mutation/palette/disposal
checks passed. Inspected reference `/opt/pons/plant-reference-DDrcP5` as
`artifacts/partner-preview/flytrap-orchid-growth.png`. Current-build browser
saved-plot projection and synthetic wild lifecycle passed all three batches:
page 0 `/tmp/pons-wardrobe-browser-M0xtaS` (10), page 1
`/tmp/pons-wardrobe-browser-jgGcLE` (10), page 2
`/tmp/pons-wardrobe-browser-zDDtIH` (2). Zero page errors.

Aggregate checkpoint `/tmp/pons-regression-9cD4Il` also passed 92 server tests
with zero skips, all 11 tool test files, compilation and copy lint. Remaining
work includes world geometry, animations, carry poses/effects, optimization,
real per-species gameplay/device acceptance and live integration/release gates.
No public deployment or service restart was performed.

### Town building geometry

The opt-in now uses authored 3D hall, seed shop, tavern, shrine and tower meshes
instead of their billboards/backing boxes. Sprite roof/wall palettes are retained;
pitched roofs, doors, crossbar windows, signs and tower battlements add volume.
The models stay inside existing 3x2-tile footprints; NPC positions, collision
rules and server interaction logic are unchanged. Camera obstruction bounds now
come from the complete building models. Default HD-2D remains unchanged.

Box C typecheck/build and five-building footprint/volume/camera-ray tests passed.
The footprint test caught protruding sign ornaments, which were moved inward.
The vertical bound test allows a 1e-6 floating-point tolerance at ground level.
Further environment props, material polish and real-device camera acceptance
remain outstanding; these are not new enterable interiors.

Browser `--oracle --wander` passed at `/tmp/pons-wardrobe-browser-D2QV7C`:
five building models/obstruction boxes, no building billboards, actual path to
Ada, successful Oracle planting response and dialogue lifecycle checks. Inspected
`artifacts/partner-preview/town-buildings-3d.png`; its final timeout is the
deliberately unanswered test question. Zero page errors. Public site unchanged.

### Plaza geometry

The opt-in now replaces fountain and lamp billboards with solid models in their
existing footprints. Fountain water is static; lantern color switches at night
without flicker or additional lights. Solid plaza props contribute camera bounds.
Default HD-2D and server interactions remain unchanged.

Box C client typecheck, production asset build and plaza geometry/day-night unit
checks passed. Browser `--oracle --wander` passed at
`/tmp/pons-wardrobe-browser-Nixv2K`, asserting modeled plaza props, no duplicate
billboards and expected camera bounds alongside real path/dialogue checks, with
zero page errors. Inspected `artifacts/partner-preview/plaza-3d.png`: lamps render
in the town view; the fountain is outside this screenshot and still needs visual
acceptance. Final dialogue timeout is deliberately induced by the test. Existing
sprite-path and chunk-size build warnings remain. No public deployment or server
restart was performed. Trees, remaining props, animation, label spacing and
physical-device visual/performance acceptance are still outstanding.

### Tree geometry

Opt-in trees now use five static low-poly stages with original sprite palette:
seedling, growing canopy, pink flowers and gold fruit. Both town scenery and
chain-derived conviction-tree rendering use these models; authoritative stage
derivation, collision rules and default sprite rendering are unchanged. Models
are replaced on stage change and disposed when no longer rendered.

Box C five-stage footprint/height/disposal tests, client typecheck and build
passed. Browser `--oracle --wander` passed at
`/tmp/pons-wardrobe-browser-AFZZMS`, including town-tree model attachment and
absence of duplicate billboards, plus existing town/NPC/dialogue checks. Zero
page errors. Inspected `artifacts/partner-preview/trees-3d.png`; visible tree has
volume, but this is not a close-up acceptance of every stage. Real wallet-driven
stage transitions, full stage visual review, camera occlusion by trees and device
performance remain unverified. Existing build warnings remain; no public deploy.

### Perspective label spacing

World labels now receive a stable screen-space layout pass in perspective mode.
Overlapping rectangles stack upward with a 3px gap; horizontal positions clamp
to viewport edges. Labels that would leave the top or move more than 96px hide
for that frame and are reconsidered on subsequent frames. Default HD-2D is
unchanged. Unit checks cover stacking, input-order stability, edge clamping and
top clipping; Box C client typecheck/build passed with existing warnings.

Browser `--oracle --wander` passed at `/tmp/pons-wardrobe-browser-ZruSC1`, including
actual DOM-rectangle non-overlap for visible labels beside Ada and existing
dialogue checks, with zero page errors. Inspected
`artifacts/partner-preview/labels-3d.png`: player and Ada names are separated.
Dense crowds, sustained layout performance and mobile readability remain testing
gates. This does not avoid overlap with HUD panels or provide label leader lines.
Public site unchanged.

### Actual wild-plant forage

Box C `--forage --wander` passed at `/tmp/pons-wardrobe-browser-yMi7Ct`.
The unmodified server spawned a common Concerned Radish at (400,144); the browser
used normal onTap/pathfinding and forage intent to reach and collect it. Inventory
increased by exactly one seed with matching species/tier. The wild disappeared
from server-fed client state, its 3D model detached/cleared, and reload retained
exactly one copy of the collected seed UID. Zero page errors. No forced positions,
synthetic wild injection, spawn-clock override or server-rule changes were used.
This closes the synthetic-only forage gap for this run; it is not all-species,
concurrent collection race or physical-device acceptance. No public deployment.

### Gate-decoration spacing

Opt-in purchased lantern pairs now follow the gate tangent and sit outside the
fence. Nameplates sit farther along and outward, facing the gate's outward normal.
All four gate sides are handled; the legacy sprite layout is unchanged. Box C
unit checks confirm model bounding boxes do not intersect one another or the
fence center strip for top/bottom/left/right layouts. Client typecheck/build and
real shop/reload/resource-cleanup browser checks passed at
`/tmp/pons-wardrobe-browser-QKHu51`, zero page errors. Inspected
`artifacts/partner-preview/cosmetics-spaced-3d.png`: both lamps and the sign are
separated. All-side in-game camera/device acceptance remains distinct from these
geometry checks. Existing build warnings remain; no public deployment.

### Static plant mesh batching

Before optimization, `--plants --plant-page=1 --wander --benchmark` at
`/tmp/pons-wardrobe-browser-YOgZop` measured 87 corn meshes and 72 pineapple meshes.
`mergeStatic` now bakes direct static pieces sharing a material into one geometry,
preserving material identity for mutation tinting and disposing replaced geometry.
No triangles or authored parts are intentionally removed. Future individually
animated parts must remain outside this static batching path.

After run `/tmp/pons-wardrobe-browser-FFxqLh`: corn and pineapple each use 5 meshes.
Whole-view calls were 382 before and 190 after, but randomized scenery/wild plants
differ, so those totals are not a controlled benchmark. Software Chromium median
frame interval remained about 33.3ms and p95 about 50.1ms: no measured FPS gain is
claimed. Metrics JSON is retained in each run directory. Physical-device FPS,
dense villages, allocation cost and long-session memory remain testing gates.

Box C `/tmp/pons-regression-Vcy7fE` passed 94 server tests and all 20 tool-test files,
including 110 growth models, mutation/disposal tests, and merge bounds/triangle/
material identity checks. Asset build and saved ten-species browser rendering/
synthetic wild cleanup passed, zero page errors. Inspected
`artifacts/partner-preview/merged-plants-3d.png`; plant silhouettes remain visible.
Existing build warnings remain. Public site unchanged.

### Batched plant lifecycle check

Box C `--plants --plant-page=1 --wander --lifecycle` passed at
`/tmp/pons-wardrobe-browser-HEkzjw`: 44 synthetic wild creation/removal cycles,
covering each of the 22 species twice at the renderer's actual wild stage 2.
Every cycle verifies disposal events for all owned geometries/materials, scene
detachment, cleared ownership arrays/children and removal from the renderer map.
The first and last post-removal renderer geometry counts were both 161; per-cycle
counts/events are retained in `plant-lifecycle.json`. Zero page errors.

An initial test timed out because it expected mature stage 4 for wild plants;
inspection confirmed stage 2 is intentional, and only the test was corrected.
This is a bounded renderer lifecycle check, not actual forage gameplay, all-stage
browser lifecycle coverage, heap profiling or a long multiplayer soak. No asset
rebuild or public deployment was performed in this test-only follow-up.

### Legacy patrol-clock parity

The legacy Phaser renderer (`r=2d`) now samples welcome/snapshot timestamps with
the same monotonic server-clock helper and uses the shared gnome patrol formula.
Box C client typecheck and asset build passed. Browser `--legacy-clock` passed at
`/tmp/pons-wardrobe-browser-3C5b3x`, with Date.now deliberately one hour ahead:
the gnome still renders at its sampled server-epoch patrol coordinates. Zero page
errors. This closes the documented legacy gnome clock gap, not all client timer
skew or network latency behavior. Existing build warnings remain; no deployment.
