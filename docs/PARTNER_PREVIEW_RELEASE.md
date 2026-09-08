# Partner preview release — 2026-09-08 UTC

Ben explicitly authorized publishing the current game for sharing with a business
partner. This is a development preview, not completion of the production goal.

URL: https://prometheus7.com/ponsgarden/

Server and matching HD-2D client deployed. Visible development-preview label.
Server health reports file storage and cached(mock) chain reader; no real chain
configuration, transactions, broker accounts or wallet approvals were added.
Existing six player records were preserved. An isolated migration check confirmed
balances, identities and plot counts before restart. Server/client builds, copy
lint and the 75-entry aggregate server suite passed on Box C before deployment.

## Recovery artifacts

- Box C: `/opt/pons/partner-release-backup-20260908-01/live-data.tgz`, captured
  with the service stopped; service unit and pre-rebuild compiled server archive
  are beside it. The compiled archive is the preceding working-tree build, not
  necessarily the historical code previously held in the running process.
- Box A: `/var/www/pons.before-partner-20260908-01`, the previous static site.
- New static bundle: `/opt/pons/partner-release-backup-20260908-01/client-release.tgz`.

Do not restore old data over new player progress casually. Stop the service,
preserve current data first, and validate the selected server build against a
copy before a rollback. Old fingerprinted client assets were retained in the
new site so already-open pages can still fetch their chunks.

## Remaining scope

The 200-client smoke found two unaffordable starting conveyors, not lost purchase
requests. Both saved records had 25 Sap and minimum seed prices of 144. New-player
first conveyors now have a common first-slot starter (24 Sap at ten plots), with
the exception disclosed in the odds panel. Regular refresh rolls are unchanged.
Two regression tests pass. A subsequent isolated 200-client, 30-second rerun
passed: 200 seed purchases, 11,800 pongs, p95 RTT 51 ms, p99 RTT 57 ms, maximum
snapshot gap 131 ms and peak sampled server RSS 93.3 MiB. Report on Box C:
`/tmp/pons-load-smoke-sUpuHW/load-report.json`. This proves only the file-backed,
mock-reader protocol baseline, not browser, raid, PostgreSQL or sustained load.

Aesthetic/customization priorities added by Ben: farmer skins, plant appearances,
palettes, world styling and names. Clarify whether “planets” means separate worlds
or plants before expanding that scope. Keep appearance customization separate
from gameplay effects, preserve original IP, and do not portray planned true-3D
work as shipped. Promotional cards and captions now exist in `artifacts/promo`:
three designs in square and portrait formats, six PNGs plus editable standalone
HTML sources and POSTS.md. Existing original sprites are arranged as labeled
promotional artwork, not fabricated gameplay captures. Copy checks and layout
checks passed on Box C; all six formats were visually inspected. Publication
remains Ben's decision; no external posts were sent.

## Next customization iteration (not deployed)

The shop label is now “Shop & Style” in the working tree. Its wardrobe replaces
tiny color buttons/text-only hats with ten previews from the actual farmer atlas.
The server now exposes owned hats privately on welcome and wardrobe updates so
the UI can distinguish free re-equipping from a new purchase. Equipped choices
and unaffordable purchases are disabled; buttons expose accessible selection
state. Two HTML regression tests pass on Box C. Three additional server tests
verify atomic combined purchases, exact single charging, free hat re-equipping,
private ownership updates and restart persistence. They exposed and fixed a
partial-purchase bug: an unaffordable combined outfit previously could charge for
the shirt before rejecting the hat. The full 78-entry server suite passes.
`tools/wardrobe-browser.cjs` now runs an actual headless Chromium HD-2D client
against isolated servers/saves on Box C. It passed purchase, owned-hat re-equip,
reload ownership, a 390px-width touch tap, no horizontal panel overflow and zero
page exceptions. Screenshot inspection found that refreshing private state could
reset shop scrolling; Hud.refresh now preserves scrollTop and the rerun verifies
that it survives a periodic update. Screenshots and server log are retained at
`/tmp/pons-wardrobe-browser-w9CBIT`; local copies are under
`artifacts/partner-preview/wardrobe-{desktop,mobile}.png`.

This is emulated touch and software-rendered Chromium, not a physical-phone or
GPU performance result. The dark rectangle was traced to Chromium compositing
over the scaled WebGL canvas; panel opacity 0.999 removes it without changing
scene geometry or atlas assets. Normal browser QA and screenshot inspection
confirm its absence at desktop and mobile widths (RENDER_COMPOSITING_DIAGNOSIS.md).
The wardrobe iteration remains undeployed.

## Plant-name input regression and black-screen report

The real browser test reproduced an interrupted name: typing “Captain Sprout”
across periodic private-state updates stopped at “Capt”. The HUD now preserves
the focused nickname input while its original plant remains in that plot;
replacement/removal resumes authoritative rendering, and stale input changes
are guarded against renaming a replacement plant. Enter finishes editing without
a duplicate send, and IME composition is not submitted prematurely.

Box C client build/copy lint and the normal isolated browser regression passed.
The test waits for the authoritative nickname before reloading and verifies it
after reconnect, followed by wardrobe purchase/re-equip/mobile layout checks.
Evidence: `/tmp/pons-wardrobe-browser-RhYTmU` (zero page exceptions).
This update is in the local preview build, not the public deployment.

Ben reported buttons over a black world in an already-open local preview tab.
That tab had the older title and “Sprints” label. A fresh in-app tab loaded the
current development-preview title, “Shop & Style”, existing garden state and
world labels. This is not visual proof that the black-screen problem is fixed;
Ben's confirmation remains pending. `tools/preview-diagnose.cjs` separately
verified fresh local/public startup without page or console errors and with a
non-lost WebGL context, but deliberately did not sign in or create players.

The HD-2D renderer now handles runtime WebGL context loss explicitly. A blocking
DOM alert explains the interruption and that the shared world continues running;
it offers a reload button. Movement keys, joystick and queued path/action are
cleared and animation stops until Three/browser resource restoration. The alert
is removed after a successful resumed render, with elapsed-frame time reset.
Disposal removes both listeners and the alert. No saves are cleared, and this
does not automatically replace HD-2D with the legacy renderer.

Box C build/copy lint passed. The actual browser regression uses
`WEBGL_lose_context.loseContext()` and `restoreContext()`, asserts context state
and alert appearance/removal, then passes the existing naming, wardrobe and
desktop/mobile checks with zero page exceptions. Evidence directory:
`/tmp/pons-wardrobe-browser-G9sj5r`. This establishes recovery for that specific
failure mode, not the cause or resolution of Ben's original black-screen report.
The recovery change is in the local preview only, not the public deployment.
