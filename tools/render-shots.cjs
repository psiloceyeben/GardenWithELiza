// Homepage screenshots, taken by playing the live game rather than mocking it up.
//
// Four framings: a garden close up with plants actually in the ground, the plot rows, the
// town street with the keepers at their doors, and the whole village zoomed out.
//
// Seeds are bought and planted first. An empty garden photographs badly and undersells the
// game, which is what the first promo pass got wrong.
//
// Run on Box C:  NODE_PATH=/opt/pons-browser-qa/node_modules node tools/render-shots.cjs

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = process.env.PONS_SITE || 'https://ponsgarden.com/play/';
const OUT = path.join(__dirname, '..', 'client', 'public', 'shots');
const W = 1600, H = 900;

const HUD = ['status-stack', 'hud', 'feed', 'banner', 'toast', 'bar', 'chat', 'chatlog',
  'panel', 'joy', 'act', 'modal', 'name-modal', 'tape'];

const hideChrome = (page, hidden) => page.evaluate(([ids, h]) => {
  for (const id of ids) { const el = document.getElementById(id); if (el) el.style.visibility = h ? 'hidden' : ''; }
}, [HUD, hidden]);

const walk = (page, x, y, ms) => page.evaluate(([j, d]) => new Promise((r) => {
  window.pons.joy = j; setTimeout(() => { window.pons.joy = { x: 0, y: 0 }; r(); }, d);
}), [{ x, y }, ms]);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const shot = async (name) => {
    await hideChrome(page, true);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    await hideChrome(page, false);
    console.log(`shot ${name}.png`);
  };

  try {
    await page.goto(SITE + (SITE.includes('?') ? '&' : '?') + 'shots=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#name-input', { timeout: 30000 });
    await page.fill('#name-input', 'Gardener');
    await page.click('#name-go');
    await page.waitForFunction(() => window.pons && window.pons.ready === true, null, { timeout: 60000 });
    await page.waitForTimeout(4000);

    // Fill the garden. An empty plot row is the least persuasive thing we could photograph.
    //
    // Planting requires standing within 40px of the plot, and raw directional input cannot
    // get through a gate - it slides along the fence. So walk the gate COLUMN: aim at the
    // gate tile, step through it into the lot, then approach each plot from inside.
    await page.evaluate(async () => {
      const p = window.pons, TILE = 32;
      const v = p.village || p.view?.state?.village;
      const lot = v.lots[p.you.lotId];
      const px = (t) => (t + 0.5) * TILE;

      const go = async (x, y, near, ms = 14000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          const dx = x - p.player.x, dy = y - p.player.y, d = Math.hypot(dx, dy);
          if (d < near) break;
          p.joy = { x: dx / d, y: dy / d };
          await new Promise((r) => setTimeout(r, 80));
        }
        p.joy = { x: 0, y: 0 };
        await new Promise((r) => setTimeout(r, 300));
      };

      // Line up on the gate from outside, pass through, then come to rest inside.
      const gx = px(lot.gate.tx), gy = px(lot.gate.ty);
      const inward = lot.gateSide === 'top' ? [0, 1] : lot.gateSide === 'bottom' ? [0, -1]
        : lot.gateSide === 'left' ? [1, 0] : [-1, 0];
      await go(gx - inward[0] * TILE, gy - inward[1] * TILE, 12);   // just outside
      await go(gx + inward[0] * TILE * 2, gy + inward[1] * TILE * 2, 14);  // through and in

      for (let round = 0; round < 5; round++) {
        (p.you.conveyor?.slots || []).forEach((s, i) => {
          if (!s.sold && s.price <= p.you.sap) p.net.send({ t: 'buy', slot: i });
        });
        await new Promise((r) => setTimeout(r, 1100));
        for (const seed of [...(p.you.seeds || [])]) {
          const plot = (p.you.plots || []).findIndex((x) => !x);
          if (plot < 0) break;
          const s = lot.plots[plot];
          await go(px(s.tx), px(s.ty), 18, 9000);
          p.net.send({ t: 'plant', seedUid: seed.uid, plotId: plot });
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    });
    // Let the fast tiers reveal so the beds are not all bare soil.
    await page.waitForTimeout(40000);

    await shot('01-garden');            // where you start, plants in the ground
    await walk(page, 0, 0.7, 1400);
    await page.waitForTimeout(900);
    await shot('02-plots');             // down over the plot rows

    await walk(page, 0.35, -1, 4200);   // north to the town street
    await page.waitForTimeout(1400);
    await shot('03-town');              // the keepers at their doors

    // Zoom out twice for the whole village.
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('#bar button')].find((x) => /zoom/i.test(x.textContent || ''));
        b?.click();
      });
      await page.waitForTimeout(1400);
    }
    await shot('04-village');           // the map, all of it

  } finally {
    await browser.close();
  }
  console.log(`\nSHOTS RENDERED -> ${OUT}  (${errors.length} page error(s))`);
  if (errors.length) console.log('  first:', errors[0].slice(0, 200));
})().catch((e) => { console.error(e); process.exit(1); });
