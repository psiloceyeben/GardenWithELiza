// Box C only. Code-native promotional layouts using existing original sprites.
// No invented gameplay screenshots; no publishing or third-party account access.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/pons-browser-qa/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const sheets = {};
for (const name of ['plants', 'chars', 'props']) sheets[name] = {
  atlas: JSON.parse(fs.readFileSync(path.join(root, `client/public/sprites/${name}.json`))),
  uri: 'data:image/png;base64,' + fs.readFileSync(path.join(root, `client/public/sprites/${name}.png`)).toString('base64'),
};
function sprite(sheet, name, scale, css = '') {
  const s = sheets[sheet], f = s.atlas.frames[name]?.frame; assert(f, name);
  return `<span class="sprite" style="width:${f.w * scale}px;height:${f.h * scale}px;background-image:url('${s.uri}');background-size:${s.atlas.meta.size.w * scale}px ${s.atlas.meta.size.h * scale}px;background-position:-${f.x * scale}px -${f.y * scale}px;${css}"></span>`;
}
const cards = [
  { id: '01-your-land', tone: 'green', eyebrow: 'A GARDEN WORTH DEFENDING', title: 'YOUR LAND<br>STAYS YOURS.', accent: 'Your plants are another story.', description: 'Grow strange plants. Build your defenses.<br>Meet the neighbors.',
    scene: `<div class="garden-bed"><div class="plantline">${sprite('plants', 'concerned_radish_idle0', 5)}${sprite('plants', 'gorbulon_sprig_idle0', 7)}${sprite('plants', 'corn_that_knows_idle0', 5)}</div><span class="soil-label">STRANGE PLANTS. FAMILIAR NEIGHBORS.</span></div>` },
  { id: '02-grow-guard', tone: 'purple', eyebrow: 'COZY GARDEN. COMPETITIVE STREAK.', title: 'GROW. GUARD.<br>SNEAK BACK.', accent: 'Peaceful? That depends on the neighbors.', description: 'Plant something strange.<br>Give it a reason to stay.',
    scene: `<div class="triptych"><div class="tile"><span class="number">01</span>${sprite('plants', 'pumpkin_esquire_idle0', 5)}<b>GROW</b></div><div class="tile"><span class="number">02</span>${sprite('chars', 'gnome0', 5)}<b>GUARD</b></div><div class="tile"><span class="number">03</span>${sprite('chars', 'farmer21_carry0', 5)}<b>SNEAK BACK</b></div></div>` },
  { id: '03-your-style', tone: 'rust', eyebrow: 'MAKE YOURSELF AT HOME', title: 'WHAT KIND OF<br>GARDENER<br>ARE YOU?', accent: 'Careful grower. Suspiciously friendly neighbor.', description: 'A little personality goes a long way.<br>Especially over the garden fence.',
    scene: `<div class="lineup">${sprite('chars', 'farmer00_down0', 6)}${sprite('chars', 'farmer32_down0', 6)}${sprite('chars', 'farmer53_down0', 6)}</div><div class="choices"><span>THE GROWER</span><span>THE STYLIST</span><span>THE NEIGHBOR</span></div>` },
];
const banned = JSON.parse(fs.readFileSync(path.join(root, 'shared/banned-copy.json'))).patterns;
function html(card, height) {
  const copy = [card.eyebrow, card.title, card.accent, card.description, 'Pons Garden', 'Development Preview', 'Play as guest', 'prometheus7.com/ponsgarden'].join(' ').replace(/<[^>]+>/g, ' ');
  for (const pattern of banned) assert(!new RegExp(pattern, 'i').test(copy), 'Banned promotional copy: ' + pattern);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Pons Garden / ${card.id}</title><style>
*{box-sizing:border-box}body{margin:0;width:1080px;height:${height}px;background:#13291e;color:#fff1cf;font-family:Arial,sans-serif}
.card{height:100%;padding:60px 64px 40px;display:flex;flex-direction:column;position:relative;overflow:hidden;background:radial-gradient(ellipse at 90% 50%,#335c36 0,transparent 65%),#13291e}
.purple{background:radial-gradient(ellipse at 90% 70%,#594370 0,transparent 70%),#211a32}.rust{background:radial-gradient(ellipse at 90% 70%,#62423c 0,transparent 70%),#312222}
.card:after{content:'';position:absolute;inset:22px;border:2px solid #fff1cf30;pointer-events:none}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:48px}.brand{font-size:28px;font-weight:900;letter-spacing:2px}.badge{font-family:monospace;font-size:16px;letter-spacing:1px;border:1px solid #fff1cf66;padding:10px 14px}.eyebrow{font-family:monospace;font-size:19px;letter-spacing:2px;color:#d6da87;margin-bottom:20px}
h1{font-size:${height === 1080 ? 77 : 89}px;line-height:.98;letter-spacing:-3px;margin:0;font-weight:900}.accent{font-size:29px;line-height:1.3;margin:24px 0 0;color:#e9cf88}.desc{font-size:23px;line-height:1.5;margin:18px 0 0;color:#d4d1bd}.art{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:240px;margin:20px 0}.sprite{display:inline-block;background-repeat:no-repeat;image-rendering:pixelated;flex-shrink:0;filter:drop-shadow(8px 12px 0 #0003)}
.garden-bed{border-bottom:20px solid #7a5439;background:linear-gradient(transparent 55%,#497747 55%);padding:0 35px 10px}.plantline{display:flex;align-items:flex-end;justify-content:space-around}.soil-label{display:block;text-align:center;font:15px monospace;letter-spacing:3px;margin-top:14px}.triptych{display:flex;gap:20px}.tile{position:relative;background:#fff1cf0a;border:2px solid #fff1cf30;flex:1;display:flex;flex-direction:column;align-items:center;padding:30px 10px 20px}.number{position:absolute;top:14px;left:14px;font:16px monospace;color:#d6da87}.tile b{font:700 19px monospace;letter-spacing:1px;margin-top:20px}.lineup{display:flex;justify-content:space-evenly;align-items:flex-end;border-bottom:12px solid #be9160}.choices{display:flex;justify-content:space-around;font:16px monospace;letter-spacing:1px;margin-top:18px}
.tile{justify-content:flex-end}.footer{border-top:1px solid #fff1cf40;padding-top:24px;display:flex;justify-content:space-between;align-items:center;gap:12px}.cta{background:#e7d58b;color:#212519;padding:15px 22px;font-size:21px;font-weight:bold}.url{font:18px monospace}.note{margin-top:18px;font:13px monospace;color:#d4d1bd;letter-spacing:1px}
</style></head><body><main class="card ${card.tone}"><header class="top"><div class="brand">PONS / GARDEN</div><span class="badge">DEVELOPMENT PREVIEW</span></header><section><div class="eyebrow">${card.eyebrow}</div><h1>${card.title}</h1><p class="accent">${card.accent}</p><p class="desc">${card.description}</p></section><div class="art">${card.scene}</div><footer class="footer"><span class="cta">PLAY AS GUEST ↗</span><span class="url">prometheus7.com/ponsgarden</span></footer><div class="note">ORIGINAL GAME SPRITES · PROMOTIONAL ARTWORK</div></main></body></html>`;
}
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pons-promo-'));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    for (const card of cards) for (const height of [1350, 1080]) {
      const name = `${card.id}-${1080}x${height}`, markup = html(card, height);
      fs.writeFileSync(path.join(directory, name + '.html'), markup);
      await page.setViewportSize({ width: 1080, height }); await page.setContent(markup, { waitUntil: 'load' });
      assert(await page.locator('.footer').evaluate(e => e.getBoundingClientRect().bottom < innerHeight - 30), name + ' footer clipped');
      assert(await page.locator('h1').evaluate(e => e.scrollWidth <= e.clientWidth), name + ' headline clipped');
      await page.screenshot({ path: path.join(directory, name + '.png') });
    }
    console.log(JSON.stringify({ directory, cards: 3, pngs: 6, sizes: ['1080x1350', '1080x1080'], copyCheck: 'PASS' }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
