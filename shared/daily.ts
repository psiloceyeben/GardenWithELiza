// The daily claim. Opens at noon Pacific, every day.
//
// Noon rather than midnight is deliberate: a midnight reset rewards whoever is awake in one
// timezone, and quietly punishes everybody else. Noon Pacific lands in the afternoon for the
// US, the evening for Europe, and the morning after for Asia, which is the least bad single
// moment available.
//
// Pacific shifts between UTC-7 (PDT) and UTC-8 (PST), so the offset is derived from the date
// rather than hardcoded. Getting this wrong once a year would move the claim by an hour and
// look, correctly, like a bug.

export const CLAIM_HOUR_PT = 12;

/** US DST: second Sunday in March to first Sunday in November, both at 2am local. */
function pacificOffsetHours(at: number): number {
  const d = new Date(at);
  const y = d.getUTCFullYear();
  const secondSundayMarch = (() => {
    const first = new Date(Date.UTC(y, 2, 1));
    const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
    return Date.UTC(y, 2, firstSunday + 7, 10);   // 2am PST = 10:00 UTC
  })();
  const firstSundayNovember = (() => {
    const first = new Date(Date.UTC(y, 10, 1));
    const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
    return Date.UTC(y, 10, firstSunday, 9);       // 2am PDT = 09:00 UTC
  })();
  return at >= secondSundayMarch && at < firstSundayNovember ? 7 : 8;
}

/** UTC instant of noon Pacific on the Pacific calendar day containing `at`. */
export function noonPacificFor(at: number): number {
  const off = pacificOffsetHours(at);
  // Shift into Pacific wall time, read the calendar day, then place noon back in UTC.
  const shifted = new Date(at - off * 3_600_000);
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth(), day = shifted.getUTCDate();
  return Date.UTC(y, m, day, CLAIM_HOUR_PT + off, 0, 0);
}

/**
 * The claim period key. A period runs from one noon Pacific to the next, so a player who
 * claims at 12:05 cannot claim again at 00:05 the same night.
 */
export function claimPeriod(at: number): string {
  let noon = noonPacificFor(at);
  if (at < noon) noon -= 24 * 3_600_000;            // before today's noon: still yesterday's period
  const d = new Date(noon - pacificOffsetHours(noon) * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Milliseconds until the next claim opens. Zero when a claim is available now. */
export function msUntilClaim(at: number, lastPeriod: string | undefined): number {
  if (claimPeriod(at) !== lastPeriod) return 0;
  let noon = noonPacificFor(at);
  if (at >= noon) noon += 24 * 3_600_000;
  return noon - at;
}

export const canClaim = (at: number, lastPeriod: string | undefined): boolean =>
  claimPeriod(at) !== lastPeriod;

// ---------------------------------------------------------------------------
// What a claim pays
// ---------------------------------------------------------------------------

/**
 * Sap by plot count. Plots derive from holding, so this tracks the wallet without needing
 * the chain reader to be live: a guest on ten plots still gets something, and a long holder
 * on twenty gets meaningfully more.
 */
export const claimSap = (plotCount: number): number => 40 + Math.max(0, plotCount - 10) * 22;

/** Seeds per claim, also by plots. Everyone gets at least one. */
export const claimSeeds = (plotCount: number): number =>
  plotCount >= 18 ? 3 : plotCount >= 14 ? 2 : 1;

/**
 * Consecutive-day multiplier, capped at fourteen days. A missed day steps back three rather
 * than resetting to zero: losing a fortnight's streak to one bad night is the kind of thing
 * that makes people stop opening a game entirely.
 */
export const STREAK_CAP = 14;
export const streakMultiplier = (streak: number): number =>
  Math.round((1 + 0.05 * Math.min(STREAK_CAP, Math.max(0, streak))) * 100) / 100;

export const nextStreak = (previous: number, lastPeriod: string | undefined, at: number): number => {
  if (!lastPeriod) return 1;
  const yesterday = claimPeriod(at - 24 * 3_600_000);
  return lastPeriod === yesterday ? previous + 1 : Math.max(1, previous - 3);
};
