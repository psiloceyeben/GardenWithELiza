# Security, end-to-end completion, and true-3D proposal

Status: plan for Ben's review. Security/E2E work is authorized as part of the
active completion goal. The new true-3D version is a proposal, not authorization
to replace the current renderer or expand gameplay physics.

## 1. Finish and verify the current game

1. Security inventory: trace browser intents through authentication, server
   validation, persistence and external reads. Review identity takeover/replay,
   concurrent sessions, hostile message shapes/indices, movement/raid cheating,
   legacy-save import, rate limiting, WebSocket origins, share-route abuse,
   dependency exposure, secrets, HTML injection, and generated NPC copy.
2. Fix findings and give each a regression test. Test failed storage, interrupted
   commits, reconnects, nonce reuse, competing actions and provider outages.
   Do not call unit-test success a full security certification.
3. Run an isolated full-stack staging session using current client/server and
   PostgreSQL. Cover new guest, save/reload, wallet identity adoption, planting,
   reveals, Sap, tending, all defenses, raids/returns, public bounties, cosmetics,
   missions, village travel, NPCs, share pages and both renderers. Check mobile
   controls and browser errors. Use test identities/assets only.
4. Run realistic concurrency/load checks up to the 200-player target, measure
   tick delay, latency, memory, database growth, and slow-provider behavior.
   Use isolated services; protect production workloads on Box C.
5. Verify backup restore, migration and rollback in staging; prepare production
   service hardening, scheduled/off-host backups and operational checks. Rollout
   waits for Ben's release decision.
6. Deliver an evidence matrix: passed, failed, incomplete, or owner-gated for
   each feature. Include reproducible commands, current build revision, known
   issues and exact configuration steps. No claim that all software is perfectly
   secure; require no unresolved critical/high findings in the reviewed scope.

Owner-gated steps: approved PONS deployment/network and ecosystem allowlist;
unavailable provider/project credentials; account login/2FA or binding approvals;
wallet signing/transactions; funding; final roster/release decisions. We still
implement and fixture-test the affected connections, but mark live verification
as unproved until those inputs/actions are available. Never request private keys.

## 2. Evidence of reusable Wander Around components

Inspected local candidates under `C:/Users/BenHo/Desktop/ClaudeCode`:

| Candidate | Potential reuse | Required check/adaptation |
| --- | --- | --- |
| `wander-engine-v2/frontend/src/meshes/index.ts` | Procedural buildings, trees, props, character bases and palette | Remove engine assumptions; adapt silhouettes to original Pons species; inspect rights/provenance |
| `wander-engine-v2/frontend/src/world/textures.ts` and `buildingSpecs.ts` | Texture/material and building recipes | Pons palette, texture density, scale and draw budget |
| `wander-engine-v2/frontend/src/world/terrain.ts` | Terrain construction patterns | Keep Pons lot boundaries and authoritative collision |
| `wander-around-game/src/client/instancedMeshPool.ts` | Batching repeated meshes | Depends on Wander entity registry/geometry cache; extract the useful pattern rather than copying blindly |
| `wander-engine-v2/frontend/src/world/renderStyles.ts` | Existing material/style machinery | Toon/CSS grading is not itself pixel-art rendering; use only compatible pieces |

These files exist and were sampled, not exhaustively audited or tested for Pons.
Multiple Wander copies are present; Ben should identify the canonical version
before imports. Nothing has been copied into Pons from Wander by this plan.

## 3. Proposed true-3D pixel-art direction

Real mesh geometry for characters, plants, buildings, trees, fences and props;
not flat sprite billboards masquerading as complete 3D. Preserve the original
Pons silhouettes, palette and readable low-resolution texture detail. Grass
stays green with quiet broad variation. No animated ground texture shimmer.

Use a controllable third-person/orbit camera with tilt and zoom, camera collision,
clear interaction targeting, and occlusion handling. Render at a stable internal
resolution with pixel-aware upscaling; use nearest sampling for sprite-like model
textures while managing ground minification separately to prevent crawling.
Lighting should be simple and readable, not glossy or photorealistic.

Recommended initial scope: true 3D presentation over the existing authoritative
ground-plane gameplay. An orbiting camera does not require new game physics.
Jumping/climbing, interiors with gameplay, stacked plots or freeform terrain
would require an explicit follow-up design and server collision/network change.

## 4. Build stages after review

1. Canonical asset/code inventory: reusable files, dependency adapters, ownership,
   licensing and missing Pons-specific geometry. Produce an import manifest.
2. One-lot vertical slice: one farmer, one original plant with grow/reveal states,
   a fence/gate, tree, building and green ground; orbit camera; desktop/touch input.
   Show it for art-direction approval before converting the roster.
3. Renderer adapter: consume WorldState and the existing protocol. Preserve all
   server gameplay, persistence, wallet and read-only chain boundaries. Keep the
   current HD-2D/2D views available during validation.
4. Full content parity: every species, mutation, cosmetic, defense, NPC, carried
   plant, interaction effect and village feature gets a mesh/animation mapping.
   Missing content is tracked, never silently represented by a generic cube.
5. Performance and UX: instancing, geometry/material reuse, visibility culling,
   modest shadows, camera obstruction, hit targets and device-specific quality.
   Proposed targets: stable 60 fps on an agreed desktop and 30 fps on an agreed
   midrange phone; record actual devices and test scenes before claiming success.
6. End-to-end replay of the same feature matrix, plus rotated-camera targeting,
   touch, crowded villages, model animation and context loss/recovery. Match share
   images and replay/clip exports to the approved visual presentation.
7. Release gate: full security/E2E evidence, rollback, no gameplay advantage from
   the selected renderer, and Ben's approval.

## Review choices

- Confirm canonical Wander project/assets.
- Approve orbiting third-person camera and true-3D visuals with current ground-plane
  gameplay, or explicitly request vertical gameplay for a larger design phase.
- Approve the one-lot visual slice before a full roster conversion.

No schedule estimate until the asset inventory and first slice establish the
conversion effort. Existing completion requirements remain in
`PRODUCTION_READINESS.md`; this proposal does not erase them.
