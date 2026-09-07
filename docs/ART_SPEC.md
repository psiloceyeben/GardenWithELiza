# Pons Garden — Art Spec v0.1

- **Internal canvas:** 480 × 270, integer zoom to fit, nearest-neighbour. No sub-pixel positions (roundPixels on).
- **Tile:** 32 × 32. Plant cell: 32 wide × 48 tall, anchored bottom-centre at (16, 44); rows 44–47 are the soil mound.
- **Palette:** one 32-colour master palette in `tools/sprites/gen.py` (`PAL`). Every sprite indexes it. Biomes are palette swaps of the ground tile set, never new tiles.
- **Outline:** 1 px `K` (near-black) around every character/plant body, added automatically by the generator after the body is drawn, before the face.
- **Plant sheet per species (13 frames):** `grow0..grow4` (seed mound → sprout → 50% → 75% → full), `idle0..idle5` (full body + the species' idle gag, 6 fps loop), `wither0..wither1` (desaturated to soil tones, drooped 2 px).
- **Mutations are never new art.** Golden = tint + sparkle; Holographic = hue-cycling tint; Colossal = ×1.5 scale; Backwards = flipY; Feral = position wander; Screaming = shake + floating text + audio.
- **Authoring:** sprites are text grids / parametric drawers in `gen.py`, rendered to PNG + Phaser atlas JSON by `npm run sprites` (runs on Box C). Any sheet can be opened in Aseprite and overpainted later; keep frame positions.
- **Atlases:** `plants` (20 × 13 frames), `tiles` (8 × 32²), `chars` (farmer 9 frames, gnome 3), `props` (fence×3, gate, sprinkler×2, lock, conveyor×2, tree×5, stump, mound), `ui` (panel9, sap, seed, sparkle).
