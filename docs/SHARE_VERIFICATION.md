# Share-page verification

The share PNG cache previously refreshed its age on every access, so popular
images could remain stale indefinitely. It now expires five minutes after
rendering, independently of access, and evicts least-recently-used entries at
32 MiB of compressed PNG data or 128 entries. Three cache tests passed on Box C
after the server build (`node --test server/dist/server/src/tests/image-cache.test.js`).

Share data now uses the saved player's actual plot count, including preserved
expanded land, rather than a smaller current derived count. The default public
URL now uses `/ponsgarden`. Sprite cache keys include the resolved sprite
directory so rendering multiple asset sets does not reuse the wrong atlas.

Remaining: cache invalidation expectations during play and full visual parity
with HD-2D. HTTP route, PNG inspection, and repeat-request checks are recorded below.
The existing PNG renderer is still a top-down compositor, not an HD-2D screenshot.
Production was not restarted or changed by these source/build checks.

## Isolated HTTP and render check

`node tools/share-http.test.cjs` passed on Box C after the server build. It
starts fresh servers on ephemeral loopback ports with isolated temporary data
and strips inherited PONS configuration. Checks cover fixture-derived HTML,
canonical addresses/URLs, PNG decoding/dimensions (1088 x 960), visible plot and
fence pixels, opaque composition, repeated image response equality, 404 paths,
HEAD, rejected POST, provider failure, responsive health, and clean shutdown.
The server now supports PONS_HOST for explicit bind configuration; its existing
default remains unchanged. HTTP responses include nosniff.

The PNG was visually inspected: 20 empty plots, perimeter fence, open gate and
conviction tree were visible. Its 16-color palette is valid, so an initial
arbitrary >20-color assertion was replaced by scene-region checks. The image
still uses orange biome ground and the top-down compositor, unlike the current
green HD-2D game. That visual mismatch is open work, not a passed parity claim.
Local inspection artifact: `C:/Users/BenHo/Desktop/PonsGarden-share-check.png`.

## Quiet-green ground verification (2026-09-08)

The orange-ground mismatch above is now resolved in the working build. Both
the HD-2D atlas and share compositor use `shared/ground-style.ts` for the same
three broad, low-contrast green patches. Share tiles use the same base tile atlas
as HD-2D. A regression test checks exact grass pixels across all eight biomes.

Box C server compilation and all 87 server tests passed; the client type check,
copy lint and Vite build passed. The isolated HTTP suite passed again, including
PNG decoding, repeat responses, HEAD, method guards, provider failure and clean
shutdown. Output: `/tmp/pons-share-render-jDMLVD/garden.png` (1088 x 960).
Visually inspected local copy:
`artifacts/partner-preview/share-quiet-green.png`: green ground, twenty plots,
fence, open gate and tree are visible. This remains a top-down illustration,
not an HD-2D camera capture or proof of full plant/cosmetic parity.

The current client also passed the standard isolated browser test at
`/tmp/pons-wardrobe-browser-XvOGiS`, including actual WebGL loss/restoration,
wardrobe purchase/reload, naming, and emulated mobile interaction, with no page
errors. This uses Chromium software rendering on Box C; it does not establish
that Ben's reported black world in the desktop app is resolved. Production was
not deployed or restarted by these checks.
