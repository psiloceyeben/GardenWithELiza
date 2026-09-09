// Oracle7 market briefs. The properties that matter are the four laws, especially that a
// bad or absent model degrades to something boring rather than something wrong.

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leadStory, briefQuestion, cleanHeadline, requestBrief, logBrief, composeHeadline } from '../market-brief';
import { MARKET_DISPLAY_PCT, sectorMovePct, TIER_VOLATILITY } from '../../../shared/market';
import { SECTORS } from '../../../shared/roster';

const NOW = Date.UTC(2026, 8, 9, 12, 0, 0);

test('the tape shows a plausible market, not the raw position', () => {
  for (const s of SECTORS) {
    const v = sectorMovePct(s, NOW);
    assert.ok(Math.abs(v) <= MARKET_DISPLAY_PCT + 0.05, `${s} displayed ${v}% — outside the display band`);
  }
  // Display scale must not be confused for the yield band; they are different numbers.
  assert.notEqual(MARKET_DISPLAY_PCT / 100, TIER_VOLATILITY.common);
});

test('the lead story picks the biggest mover and a company that leads it', () => {
  const { sector, pct, company } = leadStory(NOW);
  assert.ok(SECTORS.includes(sector));
  assert.equal(Math.abs(pct), Math.max(...SECTORS.map((s) => Math.abs(sectorMovePct(s, NOW)))));
  assert.ok(company.length > 2);
  assert.ok(briefQuestion({ season: 1, players: 1 }, NOW).includes(company));
});

test('off-topic replies are rejected exactly like withheld ones', () => {
  const subject = 'NVIDIAplant';
  const bad = [
    'In simple terms: A market is a place where people go to buy or sell things.',
    'The dictionary sense: A gathering of people for the purchase and sale of merchandise.',
    'Bananas are a fruit that grows in bunches.',
    '', '   ', 'ok',
  ];
  for (const b of bad) {
    assert.equal(cleanHeadline(b, NOW, subject).source, 'fallback', `should have rejected: ${b}`);
  }
});

test('a relevant reply is used, trimmed to one sentence, citations stripped', () => {
  const r = cleanHeadline('NVIDIAplant hums louder before it spikes. [1] Everyone has learned this.', NOW, 'NVIDIAplant');
  assert.equal(r.source, 'oracle');
  assert.ok(r.text.startsWith('NVIDIAplant hums louder'));
  assert.ok(!r.text.includes('[1]'), 'citation markers must not reach the tape');
  assert.ok(!r.text.includes('Everyone has learned'), 'only the first sentence belongs on a ticker');
});

test('a null or missing model still produces a usable headline', async () => {
  // ask() returns null when the harness is unreachable; requestBrief must not throw.
  const b = await requestBrief({ season: 1, players: 0 }, NOW);
  assert.ok(b.headline.length > 8, 'a headline is always produced');
  assert.ok(['oracle', 'fallback'].includes(b.source));
  assert.equal(b.overrides.size, 0, 'law 1: no numeric channel from the model exists yet');
});

test('the brief never carries overrides, so the model cannot move a yield', async () => {
  const b = await requestBrief({ season: 1, players: 3, lastSteal: { thief: 'Nix', victim: 'Marla', plant: 'GAMESTOPplant' } }, NOW);
  assert.equal(b.overrides.size, 0);
  assert.ok(b.headline.includes('Nix'), 'a real theft should reach the tape');
});

test('briefs are logged with their inputs so a bell can be audited', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pons-brief-'));
  const digest = { season: 1, players: 2 };
  logBrief(dir, { at: NOW, overrides: new Map(), colour: 'Circuit Sequoia hums.', headline: 'SEMIS rips +6.2%.', source: 'oracle' }, digest);
  const lines = fs.readFileSync(path.join(dir, 'market-briefs.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0]);
  assert.equal(row.season, 1);
  assert.equal(row.source, 'oracle');
  assert.equal(Object.keys(row.sectors).length, SECTORS.length, 'every sector position is recorded');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('logging failures never propagate', () => {
  // A path that cannot be created must not take the game down.
  assert.doesNotThrow(() => logBrief('\0invalid', { at: NOW, overrides: new Map(), colour: 'x'.repeat(20), headline: 'x'.repeat(20), source: 'fallback' }, { season: 1, players: 0 }));
});

test('the headline figure always matches the ticker beneath it', () => {
  // A brief is up to five minutes old. The sector lead must be recomposed at broadcast
  // time, or the tape reads "SHELLS gains +8%" directly above "SHELL -5.8%".
  const brief = { at: NOW - 5 * 60_000, overrides: new Map(), colour: 'Quiet out there.', headline: 'stale', source: 'fallback' as const };
  const later = NOW + 3 * 60_000;
  const line = composeHeadline(brief, later);
  const { sector, pct } = leadStory(later);
  assert.ok(line.startsWith(sector.toUpperCase()), `headline led with the wrong sector: ${line}`);
  assert.ok(line.includes(`${pct >= 0 ? '+' : ''}${pct}%`), `headline figure disagrees with the tape: ${line}`);
  assert.ok(line.includes('Quiet out there.'), 'the Oracle sentence should survive recomposition');
  // And it must actually change as the market moves.
  assert.notEqual(composeHeadline(brief, later), composeHeadline(brief, later + 30 * 60_000));
});
