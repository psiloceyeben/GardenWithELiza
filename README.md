# Pons Garden

Browser multiplayer brainrot garden game. 2D pixel art (Phaser 3). World derived from Robinhood Chain state.

**Doctrine:** conduit, not reservoir. Land is a pure function of public chain state; plants live in server game state and can be stolen. Read [docs/PONS_GARDEN_BIBLE.md](docs/PONS_GARDEN_BIBLE.md) §0 before writing any code. Art rules in [docs/ART_SPEC.md](docs/ART_SPEC.md).

## Layout
```
/client        Phaser 3 + TS client (Vite). 480x270 internal canvas, 32px tiles
/server        authoritative sim (M3)
/chain-reader  Robinhood Chain indexer (M2)
/shared        economy.ts, types.ts, rng.ts, derive/ (M2), banned-copy.json
/content       roster.json, copy.json — ALL user-facing strings
/share         SSR share-page renderer (M2)
/tools         lint-copy.js, sprites/gen.py (pixel-art generator)
```

## Build (all builds run on Box C)
```
npm run sprites      # python3 tools/sprites/gen.py client/public/sprites
npm run lint:copy    # bible I-4 / I-10 enforcement
npm run build        # lint + vite build -> client/dist
```

## Milestones
M1 toy (this build) → M2 derivation → M3 raid → M4 token/platform (parallel) → M5 clip engine.
