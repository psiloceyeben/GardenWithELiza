// The release-blocker test from the amended I-9 (bible, 2026-09-08).
//
// The market roster ships real listed-company names as a larp, on the accepted posture
// "ship now, reskin on a letter". That posture is only sound while the reskin stays a
// one-file flip. This test is what keeps it one.
//
// If this fails, DO NOT relax it - fix the roster. A failure here means a cease-and-desist
// would land us in a data migration under time pressure, which is the one scenario the
// whole design exists to avoid.

import { resolveRoster, assertFlipSafe, SPECIES_IDS, SECTORS, ROSTER_MODES } from '../../../shared/roster';
import { TIERS, SAP_BASE } from '../../../shared/economy';
import type { Tier } from '../../../shared/types';

let failures = 0;
const check = (name: string, fn: () => void): void => {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (e) { failures++; console.error(`  FAIL ${name}: ${(e as Error).message}`); }
};
const assert = (cond: boolean, msg: string): void => { if (!cond) throw new Error(msg); };

console.log('roster-flip');

check('a flip is display-only (ids, tiers, sectors, sapBase all identical)', () => {
  assertFlipSafe();
});

check('both modes resolve to the same 30 species', () => {
  for (const mode of ROSTER_MODES) {
    const r = resolveRoster(mode);
    assert(r.length === 30, `${mode}: expected 30 species, got ${r.length}`);
  }
  assert(SPECIES_IDS.length === 30, `expected 30 ids, got ${SPECIES_IDS.length}`);
});

check('unknown or missing mode falls back to market rather than throwing', () => {
  for (const bad of [undefined, null, '', 'nonsense', 42]) {
    const r = resolveRoster(bad);
    assert(r.length === 30, `mode ${String(bad)} did not fall back cleanly`);
  }
  assert(resolveRoster(undefined)[0].name === resolveRoster('market')[0].name, 'default is not market');
});

check('five species per tier, six tiers', () => {
  const r = resolveRoster('market');
  for (const t of TIERS) {
    const n = r.filter((s) => s.tier === t).length;
    assert(n === 5, `tier ${t} has ${n} species, expected 5`);
  }
});

check('sapBase matches the published tier table', () => {
  for (const mode of ROSTER_MODES) {
    for (const s of resolveRoster(mode)) {
      const want = SAP_BASE[s.tier as Tier];
      assert(s.sapBase === want, `${mode}/${s.id}: sapBase ${s.sapBase}, tier table says ${want}`);
    }
  }
});

check('every species has a known sector and a ticker', () => {
  for (const mode of ROSTER_MODES) {
    for (const s of resolveRoster(mode)) {
      assert(SECTORS.includes(s.sector), `${mode}/${s.id}: unknown sector ${s.sector}`);
      assert(!!s.ticker && s.ticker.length <= 5, `${mode}/${s.id}: bad ticker ${s.ticker}`);
    }
  }
});

check('tickers are unique within a mode', () => {
  for (const mode of ROSTER_MODES) {
    const seen = new Set<string>();
    for (const s of resolveRoster(mode)) {
      assert(!seen.has(s.ticker), `${mode}: duplicate ticker ${s.ticker}`);
      seen.add(s.ticker);
    }
  }
});

check('the safe roster carries no market names (a real reskin, not a copy)', () => {
  const market = new Set(resolveRoster('market').map((s) => s.name.toLowerCase()));
  for (const s of resolveRoster('safe')) {
    assert(!market.has(s.name.toLowerCase()), `safe roster reuses market name ${s.name}`);
    assert(!/plant$/i.test(s.name), `safe name "${s.name}" still uses the STOCKNAMEplant form`);
  }
});

check('ids leak nothing: no id contains a market name or ticker', () => {
  for (const s of resolveRoster('market')) {
    const id = s.id.toLowerCase();
    const bare = s.name.toLowerCase().replace(/plant$/, '');
    assert(!(bare.length >= 3 && id.includes(bare)), `id ${s.id} embeds market name ${s.name}`);
    assert(!id.includes(s.ticker.toLowerCase()) || s.ticker.length < 3, `id ${s.id} embeds ticker ${s.ticker}`);
  }
});

if (failures) { console.error(`roster-flip: ${failures} failure(s)`); process.exit(1); }
console.log('roster-flip: all passed');
