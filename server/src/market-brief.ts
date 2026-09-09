// Oracle7 authors the market (GAME_DESIGN.md s4b). This module turns village state into a
// brief - which sectors move and the headline explaining it - and enforces the four laws
// that make "Powered by Oracle7" safe to put on a loading screen:
//
//   1. BOUNDED    Oracle7 supplies only a position in [-1,1]; the amplitude it multiplies
//                 comes from the tier table and is not under the model's control.
//   2. NOT IN THE PAYOUT PATH  Standing is player actions. This file never touches scoring.
//   3. LOGGED     Every brief is appended to the season log with its inputs, so a bell can
//                 be recomputed and audited long afterwards.
//   4. FAILS SAFE Slow, down, or `withheld` -> no overrides at all, and the deterministic
//                 walk in shared/market.ts carries the market. The game never blocks.

import fs from 'node:fs';
import path from 'node:path';
import { SECTORS, resolveRoster } from '../../shared/roster';
import { sectorMovePct } from '../../shared/market';
import { ask } from './oracle';
import type { Sector } from '../../shared/types';

/** How often a brief is requested. Sector positions interpolate between them. */
export const BRIEF_INTERVAL_MS = Number(process.env.PONS_BRIEF_MS ?? 5 * 60_000);

export interface Brief {
  at: number;
  /** Sector -> position in [-1,1]. Empty means "let the deterministic walk run". */
  overrides: Map<Sector, number>;
  headline: string;
  /** How the headline was produced. Surfaced in the log, never to players. */
  source: 'oracle' | 'fallback';
}

export interface VillageDigest {
  season: number;
  players: number;
  lastSteal?: { thief: string; victim: string; plant: string };
  topSector?: Sector;
  bottomSector?: Sector;
}

/** Neutral headlines when Oracle7 has nothing to say. Deliberately dull, never silent. */
const FALLBACKS = [
  'Markets drift. The village is quiet.',
  'Little movement across the board today.',
  'A slow session. Somebody is watering.',
  'Sectors mixed. No clear story.',
];

const pickFallback = (now: number): string => FALLBACKS[Math.floor(now / BRIEF_INTERVAL_MS) % FALLBACKS.length];

const VERB_UP = ['rips', 'climbs', 'runs', 'gains'];
const VERB_DOWN = ['slips', 'sags', 'sells off', 'fades'];

/** The sector that moved furthest, and the company that leads it. */
export function leadStory(now: number): { sector: Sector; pct: number; company: string } {
  const roster = resolveRoster(process.env.PONS_ROSTER);
  let sector: Sector = SECTORS[0];
  let pct = 0;
  for (const s of SECTORS) {
    const v = sectorMovePct(s, now);
    if (Math.abs(v) > Math.abs(pct)) { pct = v; sector = s; }
  }
  // The strongest name in the moving sector, so the story is about something that matters.
  const inSector = roster.filter((r) => r.sector === sector);
  const company = inSector.length
    ? inSector.reduce((a, b) => (b.sapBase > a.sapBase ? b : a)).name
    : 'the board';
  return { sector, pct, company };
}

/**
 * Ask the Oracle what it is actually built for.
 *
 * The Pons instance is a lore and reference model, not a copywriter: asked to "write a
 * headline" it returns a dictionary definition of the word market. Asked about a thing in
 * its corpus, it answers well. So we ask about the company leading the move and use its
 * sentence as the colour behind a templated sector line.
 */
export function briefQuestion(d: VillageDigest, now: number): string {
  const { company } = leadStory(now);
  return `Tell me about ${company}`;
}

/**
 * Sanitise and RELEVANCE-CHECK a reply. Length alone is not enough: an off-topic answer
 * ("In simple terms: a market is a place where people go to buy or sell things") passes
 * every size check and reads terribly on a ticker. A reply that does not mention its
 * subject is treated exactly like a withheld one.
 */
export function cleanHeadline(
  raw: string | null | undefined,
  now: number,
  subject?: string,
): { text: string; source: 'oracle' | 'fallback' } {
  const t = (raw ?? '').replace(/\s+/g, ' ').replace(/\[\d+\]/g, '').trim();
  if (!t || t.length < 8 || t.length > 200) return { text: pickFallback(now), source: 'fallback' };

  const first = t.split(/(?<=[.!?])\s/)[0].replace(/^["'`]+|["'`]+$/g, '').trim();
  if (first.length < 8 || first.length > 120) return { text: pickFallback(now), source: 'fallback' };

  // Relevance: the answer must be about the thing we asked about.
  if (subject) {
    const head = subject.toLowerCase().replace(/plant$/, '').trim();
    if (head.length >= 3 && !first.toLowerCase().includes(head)) {
      return { text: pickFallback(now), source: 'fallback' };
    }
  }
  // Reference-desk throat-clearing is a tell that it fell back to the encyclopedia.
  if (/^(in simple terms|the dictionary sense|a gathering of people)/i.test(first)) {
    return { text: pickFallback(now), source: 'fallback' };
  }
  return { text: first, source: 'oracle' };
}

/**
 * Request a brief. Never throws and never rejects: a market that can fail is a market that
 * stops, and the game must outlive the model.
 */
export async function requestBrief(d: VillageDigest, now: number): Promise<Brief> {
  const { sector, pct, company } = leadStory(now);
  const verbs = pct >= 0 ? VERB_UP : VERB_DOWN;
  const verb = verbs[Math.floor(Math.abs(now) / BRIEF_INTERVAL_MS) % verbs.length];
  const lead = `${sector.toUpperCase()} ${verb} ${pct >= 0 ? '+' : ''}${pct}%.`;

  let text: string | null = null;
  try {
    const reply = await ask(briefQuestion(d, now));
    if (reply && !reply.withheld) text = reply.text;
  } catch {
    text = null;   // law 4: an unreachable Oracle is a quiet market, never an error
  }

  const { text: colour, source } = cleanHeadline(text, now, company);
  const theft = d.lastSteal ? ` ${d.lastSteal.thief} took a ${d.lastSteal.plant} from ${d.lastSteal.victim}.` : '';
  const headline = source === 'oracle' ? `${lead} ${company}: ${colour}${theft}` : `${lead}${theft || ` ${colour}`}`;

  // Law 1: we take the model's WORDS, not its numbers. Sector positions stay with the
  // deterministic walk until a validated numeric channel exists, so there is currently no
  // path by which a model response can move a player's yield at all.
  return { at: now, overrides: new Map(), headline, source };
}

/** Law 3. One JSON line per brief, alongside the prize ledger. */
export function logBrief(dir: string, b: Brief, d: VillageDigest): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'market-briefs.jsonl'),
      JSON.stringify({
        at: b.at, atIso: new Date(b.at).toISOString(), season: d.season,
        headline: b.headline, source: b.source,
        overrides: Object.fromEntries(b.overrides),
        sectors: Object.fromEntries(SECTORS.map((s) => [s, sectorMovePct(s, b.at)])),
      }) + '\n',
      'utf8',
    );
  } catch { /* logging must never take the game down */ }
}
