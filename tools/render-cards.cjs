// Promo cards for the four launch posts. Composed from the game's own assets: real
// screenshots and the actual sprite atlas, never mock-ups.
//
// Text is kept to one line per card on purpose. The cards are there to stop a scroll; the
// post does the talking.
//
// Run on Box C:  NODE_PATH=/opt/pons-browser-qa/node_modules node tools/render-cards.cjs

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'client', 'public');
const OUT = path.join(ROOT, 'artifacts', 'promo', 'cards');

const dataUri = (p, mime) => `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
const SHOT = (n) => dataUri(path.join(PUB, 'shots', `${n}.png`), 'image/png');
const PLANTS = dataUri(path.join(PUB, 'sprites', 'plants.png'), 'image/png');

// Species rows in the atlas, chosen for silhouette variety rather than tier.
const ROW = [13, 7, 4, 6, 10, 11, 12, 15, 27, 22, 18];

const CARDS = [
  { id: '01-theft', shot: '01-garden', line: 'your land stays yours.<br>your plants do not.',
    sub: 'grow them. lose them. chase whoever took them.' },
  { id: '02-market', sprites: true, line: 'thirty companies.<br>all of them plants.',
    sub: 'penny stocks swing sixty percent. an index barely moves.' },
  { id: '03-bell', shot: '04-village', line: 'sunday.<br>the bell.<br>everything settles.',
    sub: 'every garden liquidates at whatever the market says in that second.' },
  { id: '04-agents', sprites: true, line: 'your agents<br>can play too.',
    sub: 'ELIZA agents raid the same village. they rank, they never take the prize.' },
];

const page = (c, w, h) => {
  const pad = Math.round(w * 0.075);
  const spriteScale = w >= 1080 ? 3 : 2;
  const fw = 32 * spriteScale, fh = 48 * spriteScale;
  const sprites = ROW.map((r) =>
    `<i style="width:${fw}px;height:${fh}px;background-size:${416 * spriteScale}px ${1440 * spriteScale}px;
       background-position:${-5 * fw}px ${-r * fh}px"></i>`).join('');

  return `<!doctype html><meta charset="utf-8"><style>
  @font-face{font-family:x}
  *{box-sizing:border-box;margin:0}
  body{width:${w}px;height:${h}px;overflow:hidden;background:#f4e7cd;
    font-family:ui-monospace,"Cascadia Mono",Menlo,Consolas,monospace;position:relative}
  .shot{position:absolute;inset:0;background:url('${c.shot ? SHOT(c.shot) : ''}') center/cover no-repeat;
    image-rendering:pixelated;filter:saturate(1.05)}
  .veil{position:absolute;inset:0;background:linear-gradient(#1a1410dd 0%, #1a141099 45%, #1a1410dd 100%)}
  .frame{position:absolute;inset:${Math.round(pad * 0.45)}px;border:3px solid ${c.shot ? '#e0c88f66' : '#5e361644'}}
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;
    padding:${pad}px;text-align:center;align-items:center}
  .line{font-size:${Math.round(w * (c.shot ? 0.072 : 0.078))}px;line-height:1.22;letter-spacing:-.5px;
    color:${c.shot ? '#f4e7cd' : '#2f2318'};text-shadow:${c.shot ? '4px 4px 0 #000' : 'none'}}
  .sub{margin-top:${Math.round(h * 0.035)}px;font-size:${Math.round(w * 0.026)}px;line-height:1.7;
    color:${c.shot ? '#d9c9a8' : '#7a6952'};max-width:88%;text-shadow:${c.shot ? '2px 2px 0 #000' : 'none'}}
  .row{display:flex;gap:${Math.round(w * 0.018)}px;justify-content:center;align-items:flex-end;
    margin-top:${Math.round(h * 0.055)}px;flex-wrap:wrap}
  .row i{display:block;background-image:url('${PLANTS}');background-repeat:no-repeat;image-rendering:pixelated}
  .foot{position:absolute;left:${pad}px;right:${pad}px;bottom:${Math.round(h * 0.055)}px;
    display:flex;justify-content:space-between;align-items:flex-end;
    font-size:${Math.round(w * 0.023)}px;color:${c.shot ? '#f0e8d2' : '#7a4a22'};
    text-shadow:${c.shot ? '2px 2px 0 #000' : 'none'}}
  .foot b{color:${c.shot ? '#f0c434' : '#4e8b34'};letter-spacing:1px}
  </style>
  ${c.shot ? `<div class="shot"></div><div class="veil"></div>` : ''}
  <div class="frame"></div>
  <div class="wrap">
    <div class="line">${c.line}</div>
    <div class="sub">${c.sub}</div>
    ${c.sprites ? `<div class="row">${sprites}</div>` : ''}
  </div>
  <div class="foot"><b>GARDEN WITH ELIZA</b><span>gardenwitheliza.com</span></div>`;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const c of CARDS) {
    for (const [w, h] of [[1080, 1080], [1080, 1350]]) {
      const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await p.setContent(page(c, w, h), { waitUntil: 'load' });
      await p.waitForTimeout(400);
      const file = path.join(OUT, `${c.id}-${w}x${h}.png`);
      await p.screenshot({ path: file });
      await p.close();
      console.log(`rendered ${path.basename(file)}`);
    }
  }
  await browser.close();

  // The cards are player-facing copy; hold them to the same standard as the UI.
  const banned = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'banned-copy.json'), 'utf8'))
    .patterns.map((x) => new RegExp(x, 'i'));
  let bad = 0;
  for (const c of CARDS) {
    const text = `${c.line} ${c.sub}`.replace(/<[^>]+>/g, ' ');
    for (const re of banned) if (re.test(text)) { console.error(`COPY: ${c.id} hits /${re.source}/`); bad++; }
  }
  console.log(bad ? `\n${bad} COPY VIOLATION(S)` : '\nCARDS RENDERED, COPY CLEAN');
})().catch((e) => { console.error(e); process.exit(1); });
