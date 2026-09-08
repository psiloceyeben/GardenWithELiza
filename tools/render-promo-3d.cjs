#!/usr/bin/env node
// Promotional cards from the ACTUAL live 3D game. Box C only.
//   node tools/render-promo-3d.cjs [--url https://prometheus7.com/ponsgarden/]
// Signs in as a throwaway guest, hides the HUD, captures real in-game framings,
// then composes square and portrait cards around them. Copy is checked against
// shared/banned-copy.json. Nothing is published; no gameplay is faked.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/pons-browser-qa/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'artifacts/promo');
const shotDir = path.join(outDir, 'shots');
const URL_ARG = (process.argv.find((a) => a.startsWith('--url=')) || '').slice(6);
const SITE = URL_ARG || 'https://prometheus7.com/ponsgarden/';
const banned = JSON.parse(fs.readFileSync(path.join(root, 'shared/banned-copy.json'))).patterns.map((p) => new RegExp(p, 'i'));

// Each shot: where to walk from spawn, and how long, before the camera settles.
const SHOTS = [
  { name: 'garden', walk: null, hold: 2500 },
  { name: 'town', walk: { x: 0.15, y: -1 }, ms: 7000, hold: 2000 },
  { name: 'street', walk: { x: 1, y: -0.25 }, ms: 3000, hold: 2000 },
];

const CARDS = [
  { id: '01-your-land', shot: 'garden',
    headline: 'Your land stays yours.<br>Your plants are another story.',
    sub: 'Grow strange plants. Build defenses. Watch the neighbours.' },
  { id: '02-grow-guard', shot: 'town',
    headline: 'Grow. Guard.<br>Sneak back.',
    sub: 'A quiet afternoon in the garden, until someone notices your best plant.' },
  { id: '03-the-village', shot: 'street',
    headline: 'Five keepers.<br>Ten missions.<br>One very loud potato.',
    sub: 'Meet the village, take a job, run a lap, lose a turnip.' },
];

const card = (c, w, h, dataUri) => `<!doctype html><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${w}px;height:${h}px;background:#181220;font-family:'Press Start 2P',monospace;color:#f0e8d2;overflow:hidden;position:relative}
  .shot{position:absolute;inset:0;background:url('${dataUri}') center/cover no-repeat}
  .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,18,32,.86) 0%,rgba(24,18,32,.18) 34%,rgba(24,18,32,.20) 58%,rgba(24,18,32,.92) 100%)}
  .frame{position:absolute;inset:22px;border:5px solid #bc8c5a;pointer-events:none}
  .top{position:absolute;top:${Math.round(h * 0.085)}px;left:64px;right:64px}
  .headline{font-size:${w >= 1080 && h > 1200 ? 46 : 42}px;line-height:1.62;text-shadow:4px 4px 0 #000}
  .sub{margin-top:26px;font-size:19px;line-height:2.05;color:#d9c9a8;text-shadow:3px 3px 0 #000}
  .bottom{position:absolute;bottom:${Math.round(h * 0.075)}px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
  .name{font-size:26px;color:#f0c434;text-shadow:3px 3px 0 #000}
  .name small{display:block;margin-top:14px;font-size:14px;color:#a898b8}
  .url{font-size:16px;color:#f0e8d2;text-align:right;line-height:1.9;text-shadow:2px 2px 0 #000}
</style>
<div class="shot"></div><div class="veil"></div><div class="frame"></div>
<div class="top"><div class="headline">${c.headline}</div><div class="sub">${c.sub}</div></div>
<div class="bottom"><div class="name">PONS GARDEN<small>development preview</small></div>
<div class="url">play as a guest<br>prometheus7.com/ponsgarden</div></div>`;

(async () => {
  fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1280 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto(SITE + (SITE.includes('?') ? '&' : '?') + 'promo=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
    // sign in as a throwaway guest
    await page.waitForSelector('#name-input', { timeout: 30000 });
    await page.fill('#name-input', 'Gardener');
    await page.click('#name-go');
    await page.waitForFunction(() => window.pons && window.pons.ready === true, null, { timeout: 60000 });
    await page.waitForTimeout(4000);

    for (const s of SHOTS) {
      if (s.walk) {
        await page.evaluate((w) => { window.pons.joy = w; }, s.walk);
        await page.waitForTimeout(s.ms);
        await page.evaluate(() => { window.pons.joy = { x: 0, y: 0 }; });
      }
      await page.waitForTimeout(s.hold);
      // hide every DOM overlay so only the world is captured
      await page.evaluate(() => {
        for (const id of ['status-stack', 'hud', 'feed', 'banner', 'toast', 'bar', 'chat', 'chatlog', 'panel', 'joy', 'act', 'modal', 'name-modal']) {
          const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
        }
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(shotDir, s.name + '.png') });
      await page.evaluate(() => {
        for (const id of ['status-stack', 'hud', 'feed', 'banner', 'toast', 'bar', 'chat', 'chatlog', 'panel', 'joy', 'act']) {
          const el = document.getElementById(id); if (el) el.style.visibility = '';
        }
      });
      console.log('captured', s.name);
    }
    if (errors.length) console.log('page errors during capture:', errors.slice(0, 3));

    // compose the cards
    const shots = {};
    for (const s of SHOTS) shots[s.name] = 'data:image/png;base64,' + fs.readFileSync(path.join(shotDir, s.name + '.png')).toString('base64');
    let bad = 0;
    for (const c of CARDS) {
      const text = (c.headline + ' ' + c.sub).replace(/<[^>]+>/g, ' ');
      for (const re of banned) if (re.test(text)) { console.log(`BANNED COPY in ${c.id}: /${re.source}/`); bad++; }
      for (const [w, h] of [[1080, 1080], [1080, 1350]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.setContent(card(c, w, h, shots[c.shot]), { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        const file = path.join(outDir, `${c.id}-${w}x${h}.png`);
        await page.screenshot({ path: file });
        console.log('rendered', path.basename(file));
      }
    }
    console.log(bad ? `\n${bad} COPY VIOLATION(S)` : '\nALL CARDS RENDERED, COPY CLEAN');
    process.exitCode = bad ? 1 : 0;
  } catch (e) {
    console.error('FAILED:', e.message); process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
