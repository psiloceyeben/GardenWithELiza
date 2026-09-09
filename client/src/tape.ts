// The ticker tape: sector moves, the Oracle headline, the season countdown and your
// standing. The cheapest thing in the design and the one that makes the market visible -
// without it, yields drift and nobody is told why.

export interface MarketView {
  sectors: Record<string, number>;
  headline: string;
  season: { n: number; endsAt: number };
  standing?: { score: number; rank: number; players: number; eligible: boolean };
}

const SECTOR_LABEL: Record<string, string> = {
  shells: 'SHELL', growth: 'GRWTH', retail: 'RETL', staples: 'STPL', financials: 'FIN',
  energy: 'ENRG', semis: 'SEMI', biotech: 'BIO', adtech: 'ADTC', funds: 'FUND',
};

/** "6d 04:12" — coarse at distance, precise near the bell, which is when it matters. */
export function countdown(msLeft: number): string {
  if (msLeft <= 0) return 'closing';
  const s = Math.floor(msLeft / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

let last: MarketView | null = null;
let clockStarted = false;

export function renderTape(mv: MarketView): void {
  last = mv;
  if (!clockStarted) { clockStarted = true; startTapeClock(); }
  const tape = document.getElementById('tape');
  if (!tape) return;
  tape.hidden = false;
  // Publish the tape's real height so the HUD and feed sit below it at every width,
  // rather than below a number somebody guessed once.
  publishHeight(tape);

  const moves = Object.entries(mv.sectors)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const cls = v > 0.5 ? 'up' : v < -0.5 ? 'down' : 'flat';
      const sign = v > 0 ? '+' : '';
      return `<span class="tk ${cls}">${SECTOR_LABEL[k] ?? k.toUpperCase()} ${sign}${v.toFixed(1)}%</span>`;
    })
    .join('');

  const head = document.getElementById('tape-head');
  if (head) head.textContent = mv.headline;

  const row = document.getElementById('tape-row');
  if (row) row.innerHTML = moves + moves;   // duplicated so the marquee loops seamlessly

  const season = document.getElementById('tape-season');
  if (season) {
    const left = mv.season.endsAt - Date.now();
    const label = mv.season.n > 0 ? `SEASON ${mv.season.n}` : 'SEASON 1 OPENS';
    const stand = mv.standing
      ? ` · #${mv.standing.rank}/${mv.standing.players} · ${mv.standing.score.toLocaleString()} pts`
      : '';
    season.textContent = `${label} · ${countdown(left)}${stand}`;
  }
}

/** Keep the countdown ticking between server messages. */
export function startTapeClock(): void {
  setInterval(() => { if (last) renderTape(last); }, 1000);
}

/**
 * Publish the tape's real height so the HUD and feed clear it.
 *
 * Measured rather than assumed, and re-measured on resize: the tape grows a row when the
 * headline wraps, and a HUD pinned to a number somebody guessed once ends up tucked under
 * the ticker. getBoundingClientRect is used over offsetHeight because it is fractional -
 * offsetHeight rounds down, which is exactly enough to clip the top of the Sap box.
 */
let observed: Element | null = null;
function publishHeight(tape: HTMLElement): void {
  const set = () => {
    const h = Math.ceil(tape.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--tape-h', `${h}px`);
  };
  set();
  if (observed !== tape && typeof ResizeObserver !== 'undefined') {
    observed = tape;
    new ResizeObserver(set).observe(tape);
  }
}
