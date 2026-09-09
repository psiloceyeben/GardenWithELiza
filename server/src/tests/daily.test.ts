// The daily claim opens at noon Pacific. The risk here is not the reward table, it is the
// clock: an offset slip moves the claim by an hour twice a year and looks exactly like a bug.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  noonPacificFor, claimPeriod, msUntilClaim, canClaim,
  claimSap, claimSeeds, streakMultiplier, nextStreak, STREAK_CAP, CLAIM_HOUR_PT,
} from '../../../shared/daily';

/** What the Pacific wall clock reads at a given UTC instant, via the IANA database. */
const pacificHour = (at: number): number =>
  Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false,
  }).format(new Date(at)));

test('noon Pacific really is noon in Los Angeles, in both DST and standard time', () => {
  const summer = Date.UTC(2026, 6, 15, 3, 0, 0);   // July, PDT
  const winter = Date.UTC(2026, 11, 15, 3, 0, 0);  // December, PST
  for (const [label, at] of [['summer', summer], ['winter', winter]] as const) {
    const noon = noonPacificFor(at);
    assert.equal(pacificHour(noon), CLAIM_HOUR_PT, `${label}: noonPacificFor landed at ${pacificHour(noon)}:00 PT`);
  }
});

test('it holds across the DST boundaries themselves', () => {
  // Days either side of the 2026 transitions.
  const days = [
    Date.UTC(2026, 2, 7, 20), Date.UTC(2026, 2, 9, 20),    // around 8 March
    Date.UTC(2026, 10, 31, 20), Date.UTC(2026, 11, 2, 20), // around 1 November
  ];
  for (const at of days) {
    assert.equal(pacificHour(noonPacificFor(at)), CLAIM_HOUR_PT, `failed near ${new Date(at).toISOString()}`);
  }
});

test('a period runs noon to noon, so an evening claim does not reopen at midnight', () => {
  const noon = noonPacificFor(Date.UTC(2026, 8, 9, 3));
  const justAfter = noon + 5 * 60_000;
  const thatEvening = noon + 9 * 3_600_000;
  const afterMidnight = noon + 14 * 3_600_000;   // still before the next noon
  const nextDay = noon + 24 * 3_600_000 + 60_000;

  assert.equal(claimPeriod(justAfter), claimPeriod(thatEvening), 'same afternoon');
  assert.equal(claimPeriod(justAfter), claimPeriod(afterMidnight), 'midnight must NOT start a new period');
  assert.notEqual(claimPeriod(justAfter), claimPeriod(nextDay), 'the next noon must');
});

test('claiming once closes the period, and the countdown points at the next noon', () => {
  const noon = noonPacificFor(Date.UTC(2026, 8, 9, 3));
  const at = noon + 60_000;
  const period = claimPeriod(at);

  assert.equal(canClaim(at, undefined), true, 'a new player can claim immediately');
  assert.equal(canClaim(at, period), false, 'claiming twice in a period is refused');
  assert.equal(msUntilClaim(at, undefined), 0, 'available now reads as zero');

  const wait = msUntilClaim(at, period);
  assert.ok(wait > 0 && wait <= 24 * 3_600_000, `countdown out of range: ${wait}`);
  assert.equal(pacificHour(at + wait), CLAIM_HOUR_PT, 'the countdown lands on noon PT');
});

test('the reward scales with plots and never goes backwards', () => {
  let prev = 0;
  for (let plots = 10; plots <= 20; plots++) {
    const sap = claimSap(plots);
    assert.ok(sap >= prev, `sap fell at ${plots} plots`);
    prev = sap;
  }
  assert.ok(claimSap(20) > claimSap(10), 'holding must be worth something');
  assert.equal(claimSeeds(10), 1);
  assert.equal(claimSeeds(20), 3);
});

test('a missed day costs three, not the whole streak', () => {
  const noon = noonPacificFor(Date.UTC(2026, 8, 9, 3));
  const today = claimPeriod(noon + 60_000);
  const yesterday = claimPeriod(noon + 60_000 - 24 * 3_600_000);

  assert.equal(nextStreak(0, undefined, noon + 60_000), 1, 'first ever claim starts at one');
  assert.equal(nextStreak(6, yesterday, noon + 60_000), 7, 'consecutive days build');
  assert.equal(nextStreak(10, '2020-01-01', noon + 60_000), 7, 'a gap steps back three');
  assert.equal(nextStreak(2, '2020-01-01', noon + 60_000), 1, 'and never below one');
  assert.notEqual(today, yesterday);
});

test('the streak multiplier rises and then stops', () => {
  assert.equal(streakMultiplier(0), 1);
  assert.ok(streakMultiplier(7) > streakMultiplier(3));
  assert.equal(streakMultiplier(STREAK_CAP), streakMultiplier(STREAK_CAP + 50), 'capped');
});
