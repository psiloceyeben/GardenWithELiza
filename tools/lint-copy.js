#!/usr/bin/env node
// Bible I-4 / I-10 enforcement: scan every user-facing string for banned copy.
// Sources: content/*.json (all string leaves) and client/src (string literals).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const banned = JSON.parse(fs.readFileSync(path.join(root, 'shared/banned-copy.json'), 'utf8')).patterns
  .map((p) => new RegExp(p, 'i'));

// Words a DISCLAIMER must be able to say in order to deny them: "nothing is wagered",
// "not redeemable or withdrawable". Banning these outright makes it impossible to state
// the very rules I-4 exists to enforce. Exempted PER-PATTERN rather than per-page, so the
// inducement patterns that actually matter - yield, dividends, returns, earn, activate a
// broker - stay enforced everywhere, including on the marketing page.
const NEGATABLE = /^(wager|withdraw|redeem|convert|stake)/i;
const hits = [];
function checkString(s, where, opts = {}) {
  for (const re of banned) {
    if (opts.allowNegations && NEGATABLE.test(re.source)) continue;
    if (re.test(s)) hits.push({ where, pattern: re.source, text: s.slice(0, 120) });
  }
}
function walkJson(v, where) {
  if (typeof v === 'string') return checkString(v, where);
  if (Array.isArray(v)) return v.forEach((x, i) => walkJson(x, `${where}[${i}]`));
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      if (k === '_doc') continue; // documentation keys describe the rule; they are not user-facing
      walkJson(v[k], `${where}.${k}`);
    }
  }
}
function walkDir(dir, exts, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walkDir(p, exts, fn); }
    else if (exts.includes(path.extname(e.name))) fn(p);
  }
}

walkDir(path.join(root, 'content'), ['.json'], (p) => walkJson(JSON.parse(fs.readFileSync(p, 'utf8')), path.relative(root, p)));
walkDir(path.join(root, 'content/lore'), ['.md'], (p) => fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => checkString(line, `${path.relative(root, p)}:${i + 1}`)));
walkDir(path.join(root, 'shared'), ['.ts'], (p) => { if (p.endsWith('missions.ts')) (fs.readFileSync(p, 'utf8').match(/'(?:[^'\\]|\\.)*'/g) || []).forEach((l) => checkString(l.slice(1, -1), path.relative(root, p))); });
walkDir(path.join(root, 'client/src'), ['.ts', '.html'], (p) => {
  const src = fs.readFileSync(p, 'utf8');
  const lits = src.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g) || [];
  lits.forEach((l) => checkString(l.slice(1, -1), path.relative(root, p)));
});
// Legal pages are EXEMPT by design. I-4 bans INDUCEMENT copy in player-facing game UI;
// these pages exist to state the negations - "nothing is wagered", "not redeemable",
// "not withdrawable". Banning the words here would make it impossible to disclaim them.
// Game copy, content and lore remain fully covered above.
const DISCLAIMER_PAGES = new Set(['rules.html', 'terms.html', 'privacy.html', 'home.html']);
walkDir(path.join(root, 'client'), ['.html'], (p) =>
  checkString(fs.readFileSync(p, 'utf8'), path.relative(root, p), { allowNegations: DISCLAIMER_PAGES.has(path.basename(p)) }));

if (hits.length) {
  console.error(`BANNED COPY: ${hits.length} hit(s)`);
  for (const h of hits) console.error(`  ${h.where}  /${h.pattern}/  "${h.text}"`);
  process.exit(1);
}
console.log('copy lint: clean');
