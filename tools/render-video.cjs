// Two launch videos, captured by actually playing the live game.
//
//   1. pons-garden-launch     — the world, the village, a plant going in the ground
//   2. pons-garden-market     — the ticker tape and the market, for the Oracle7 post
//
// Playwright records the whole page, so the HUD and tape stay visible - unlike the promo
// cards, where the chrome is hidden. That is deliberate: the tape IS the story in video 2.
//
// Run on Box C:  NODE_PATH=/opt/pons-browser-qa/node_modules node tools/render-video.cjs

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = process.env.PONS_SITE || 'https://prometheus7.com/ponsgarden/';
const OUT = path.join(__dirname, '..', 'artifacts', 'promo', 'video');
const W = 1280, H = 720;

/** A scripted beat: nudge the joystick, wait, maybe run some page code. */
const walk = (x, y, ms) => ({ joy: { x, y }, ms });
const wait = (ms) => ({ joy: { x: 0, y: 0 }, ms });

const SCENES = {
  launch: [
    wait(2500),
    walk(0.6, -0.5, 2200),   // out of the garden, toward the street
    wait(1200),
    walk(0.9, 0, 2600),      // along the town street past the keepers
    wait(1500),
    walk(-0.4, 0.8, 2400),   // back down toward the plots
    wait(2000),
    walk(0, -0.7, 1800),
    wait(2500),
  ],
  market: [
    wait(3000),              // let the tape populate
    walk(0.5, 0, 1800),
    wait(2500),
    walk(0, 0.6, 1600),
    wait(3000),
    walk(-0.7, -0.3, 2000),
    wait(4000),              // hold on the tape
  ],
};

async function record(name, beats, opts = {}) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(SITE + (SITE.includes('?') ? '&' : '?') + 'vid=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#name-input', { timeout: 30000 });
    await page.fill('#name-input', opts.playerName || 'Gardener');
    await page.click('#name-go');
    await page.waitForFunction(() => window.pons && window.pons.ready === true, null, { timeout: 60000 });
    await page.waitForTimeout(3500);

    // Buy and plant one seed so the garden is not bare on camera.
    if (opts.plant) {
      try {
        await page.click('#bar button[data-panel="conveyor"]', { timeout: 5000 });
        await page.waitForTimeout(1200);
        const buy = page.locator('#panel button', { hasText: 'Buy' }).first();
        if (await buy.count()) { await buy.click(); await page.waitForTimeout(900); }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      } catch { /* the shot still works without it */ }
    }

    for (const b of beats) {
      await page.evaluate((j) => { window.pons.joy = j; }, b.joy);
      await page.waitForTimeout(b.ms);
    }
    await page.evaluate(() => { window.pons.joy = { x: 0, y: 0 }; });
    await page.waitForTimeout(800);
  } finally {
    await context.close();   // finalises the video file
    await browser.close();
  }

  const file = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
  if (!file) throw new Error(`${name}: no video produced`);
  const final = path.join(OUT, `${name}.webm`);
  fs.renameSync(path.join(dir, file), final);
  fs.rmSync(dir, { recursive: true, force: true });
  const mb = (fs.statSync(final).size / 1e6).toFixed(1);
  console.log(`rendered ${path.basename(final)}  ${mb} MB  (${errors.length} page error(s))`);
  if (errors.length) console.log('  first error:', errors[0].slice(0, 160));
  return final;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await record('pons-garden-launch', SCENES.launch, { plant: true, playerName: 'Gardener' });
  await record('pons-garden-market', SCENES.market, { plant: true, playerName: 'Trader' });
  console.log('\nVIDEOS RENDERED ->', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
