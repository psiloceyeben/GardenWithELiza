# Panel / canvas compositing diagnosis

Isolated Box C Chromium captures show a dark rectangle above the open shop.
This is not yet evidence that all browsers/devices exhibit the same defect.

Evidence from `tools/wardrobe-browser.cjs`:

- At an affected point (500,150 at 1280x900), DOM hit-testing finds only the game
  canvas and its transparent container, not an opaque HTML overlay.
- A scene raycast at that point intersects ordinary ground, not a billboard.
- An immediate renderer draw and PNG readback of the WebGL drawing buffer has
  clean ground and no dark rectangle.
- Closing the panel removes the rectangle from the composited screenshot.

Together this points to browser compositing/occlusion of the open panel over the
half-resolution CSS-scaled WebGL canvas, rather than corrupt atlas or map data.
Do not change game geometry or add filler sprites to cover it.

Clean bitmap and closed-panel evidence: Box C
`/tmp/pons-wardrobe-browser-c8yb7o/{webgl-bitmap,panel-closed}.png`, copied into
local `artifacts/partner-preview/`. Testing equivalent transform-free panel
centering was tested and did not resolve it. Live site has not been changed by
this diagnosis.

## Controlled workaround comparison

Box C `/tmp/pons-wardrobe-browser-2Znz1r` compared canvas opacity, panel opacity,
canvas transform and panel layer hints. Only panel opacity 0.999 removed the
rectangle: the affected pixel became ground RGB (76,105,61) rather than scene
background RGB (24,18,32). Original canvas readback remained clean throughout.

The working client now uses panel opacity 0.999 to keep the panel composited as a
blended layer. Geometry, atlas assets and canvas resolution are unchanged. The
ordinary browser test no longer injects trial styles; it checks a 100x40 region
above the panel for recurrence of the dark rectangle. Detailed diagnostic/trial
captures remain opt-in via `--diagnose` and must not be used as release QA because
that diagnostic branch deliberately injects experimental styles.

Normal build and browser run passed without injected styles. Final screenshots
at `/tmp/pons-wardrobe-browser-oaXry0` were inspected: the rectangle is absent
at both desktop and mobile widths. This establishes the workaround in the tested
Chromium/software-rendering environment; physical GPU/mobile coverage remains.

## Narrow-screen status overlap (2026-09-08)

The latest mobile capture exposed overlapping status, event and toast text.
At widths up to 600px these elements now use a natural-height grid rather than
independent fixed top offsets. Only the newest passive feed item is shown there;
the Feed panel retains the complete available feed. Desktop positions are unchanged.

Box C build and standard browser regression passed at
`/tmp/pons-wardrobe-browser-r2INfT`, with additional geometry assertions at 320,
390 and 600px: the banner starts below both status columns, toast below banner,
and each stays inside the viewport. The 390px capture was visually inspected at
`artifacts/partner-preview/status-stack-mobile.png`; upper text no longer overlaps.
This does not resolve or diagnose the user's device-specific black-world report.

The following bottom-control pass separates a three-column, three-row navigation
grid from chat and the open panel on narrow screens. Buttons have 44px rows;
joystick/action controls move above this reserved area. Desktop layout is unchanged.
Box C build and browser test passed at `/tmp/pons-wardrobe-browser-1JmDnU`.
At 320, 390 and 600px all nine navigation buttons fit their labels, have at least
44px dimensions, and pass center-point DOM hit testing with the shop open.
Panel, chat and navigation bounds do not overlap. The 390px screenshot was
visually inspected: `artifacts/partner-preview/mobile-controls.png`.
Real phone keyboards, landscape/short viewport behavior, and physical touch
coverage remain unverified; this is not a complete mobile acceptance claim.
