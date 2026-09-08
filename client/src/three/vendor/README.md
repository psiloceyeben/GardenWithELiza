# Wander character renderer snapshot

Generated `WanderAvatar.js` exports only PlayerAvatar, its preset table and default
appearance. It imports Pons's `three`; it does not bundle a second Three runtime.
Use it through VisualAvatar, never its persistence or editor APIs.

Origin: Ben's Wander source on Box C, `/opt/wander-engine-v2/src/wag/client`.
Ten dependency files and their SHA256 hashes are recorded in `manifest.json`.
`source-snapshot.tgz` preserves those sources plus the tiny entry module so future
builds do not depend on the live checkout. No live Wander files were modified.

Generated on Box C by `tools/vendor-wander-avatar.cjs`. That tool captures a new
snapshot from the explicitly reviewed source; it is not an automatic updater.
For exact reproduction, extract the archived snapshot to a fresh Box C temporary
directory, bundle `source/entry.ts` with the recorded esbuild version using
browser platform, ESM format, `three` external, and the banner in the generator.
Compare output SHA256 to the manifest before accepting a replacement. Never
regenerate on the local Windows machine (project build policy).

Packaged output: 41,006 bytes. SHA256:
`42285a454e84a0c3ba17b5991ff550ba92b2b4648c98d1f09f8b8592a39b44d5`.
Snapshot build directory: `/opt/pons/avatar-vendor-NmG3MJ`. Generated esbuild
source-label comments contain this directory name; exact byte reproduction also
requires matching source labels and the original `/opt/pons` working directory.
The manifest records upstream hashes and two Pons-only lifecycle patches:
disposed materials leave the shader registry, and every created avatar material
is tracked for cleanup even if a preset never attaches it to a mesh. The archive
contains patched build inputs. Live Wander source is unchanged.
Box C ten-model wardrobe/animation/disposal reference passed using this file at
`/opt/pons/wander-current-reference-tSsqB7`, including return to the original
shader-registry count after each avatar's disposal, without importing live Wander
source, external requests or localStorage writes in that scenario.
The reference harness still reads a served bundle only for provenance reporting.

Wired into opt-in gameplay for players and NPCs. Visual acceptance and head fitting
remain pending. This snapshot does not include account or economy authority.
