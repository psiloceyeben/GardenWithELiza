// NPC free-text replies via the Oracle7 harness (`POST /chat`, body {text}, reply {response, status}).
// Default target is the dedicated Pons Oracle on Box C :8099; :8097 is the optional general instance
// (content/lore/ is the seed corpus). Replies are capped, filtered against banned copy (I-4), and the Oracle's honest
// "withheld" status becomes the NPC's in-character shrug instead of an invented answer.
import bannedJson from '../../shared/banned-copy.json';
import type { Npc } from '../../shared/missions';
import { randomBytes } from 'node:crypto';
import plantingGuide from '../../content/lore/planting-guide.json';

export const PLANTING_QUERY = 'Tell me about Pons Garden planting';

const sessions = new WeakMap<object, string>();
/** A reconnect starts fresh; never derive external session keys from identity secrets. */
export function sessionFor(connection: object): string {
  let session = sessions.get(connection);
  if (!session) { session = randomBytes(18).toString('hex'); sessions.set(connection, session); }
  return session;
}

const URL = process.env.PONS_ORACLE_URL ?? 'http://127.0.0.1:8099/chat';
const PERSONA = process.env.PONS_ORACLE_PERSONA === '1';   // the general Oracle (:8097) tolerates a persona wrapper; the lore instance parses plain questions best
const TIMEOUT_MS = Number(process.env.PONS_ORACLE_TIMEOUT_MS ?? 20_000);
const banned = (bannedJson.patterns as string[]).map((p) => new RegExp(p, 'i'));

export function frame(npc: Npc, village: string, player: string, question: string): string {
  if (!PERSONA) return routeQuestion(question);
  return `${npc.name}, ${npc.role}, in the village ${village} of Pons Garden, a garden game where plants can be stolen. A gardener named ${player} asks: "${question}" Reply as ${npc.name} in at most two short sentences.`;
}

/** Narrow paraphrases verified against the dedicated harness. Unknown questions
 * remain untouched rather than being forced onto an unrelated encyclopedia head. */
export function routeQuestion(question: string): string {
  const normalized = question.toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (['how do i plant a seed', 'how do i plant seeds', 'how do i plant my seeds',
    'how can i plant a seed', 'how do i start planting'].includes(normalized)) return PLANTING_QUERY;
  if (['how do i protect plants from thieves', 'how do i protect my plants', 'how can i protect my garden',
    'how do i defend my garden', 'how do defenses work'].includes(normalized)) return 'What are defenses?';
  return question;
}

export interface OracleReply { text: string; withheld: boolean; }

export function parseReply(value: unknown): OracleReply | null {
  if (!value || typeof value !== 'object') return null;
  const j = value as { response?: unknown; text?: unknown; status?: unknown };
  const response = j.response ?? j.text;
  if (typeof response !== 'string') return null;
  let raw = response.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
  raw = raw.replace(/(^|[.!?] )According to [^,:]{1,40}, /g, '$1')
    .replace(/(^|[.!?] )The page for [^:]{1,50} records: /g, '$1')
    .replace(/(^|[.!?] )[A-Z][\w' ]{1,30} (notes|records) that /g, '$1');
  if (j.status === 'withheld' || j.status === 'clarification' || !raw || banned.some(re => re.test(raw))) return { text: '', withheld: true };
  const limit = raw.slice(0, 280);
  const sentence = Math.max(limit.lastIndexOf('. '), limit.lastIndexOf('! '), limit.lastIndexOf('? '));
  const text = raw.length <= 280 ? raw : sentence >= 40 ? limit.slice(0, sentence + 1) : limit.slice(0, Math.max(1, limit.lastIndexOf(' '))) + '…';
  return { text, withheld: false };
}

export function createOracleClient(url: string, timeoutMs = TIMEOUT_MS) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) throw new Error('Invalid Oracle timeout');
  let inflight = 0;
  const ready = new Map<string, number>(), preparing = new Map<string, Promise<boolean>>();
  async function prepare(session: string, signal: AbortSignal): Promise<boolean> {
    if ((ready.get(session) ?? 0) > Date.now()) return true;
    ready.delete(session);
    const pending = preparing.get(session); if (pending) return pending;
    const task = (async () => {
      try {
        const response = await fetch(new globalThis.URL('ingest', url), {
          method: 'POST', headers: { 'content-type': 'application/json', 'X-Oracle-Session': session },
          body: JSON.stringify(plantingGuide), signal,
        });
        if (!response.ok) { await response.body?.cancel(); return false; }
        const result = await response.json() as { status?: unknown; admitted_sentences?: unknown };
        if (result.status !== 'admitted' || result.admitted_sentences !== 3) return false;
        if (ready.size >= 512) ready.delete(ready.keys().next().value!);
        ready.set(session, Date.now() + 300_000); return true;
      } catch { return false; }
      finally { preparing.delete(session); }
    })();
    preparing.set(session, task); return task;
  }
  return async (prompt: string, session = randomBytes(18).toString('hex')): Promise<OracleReply | null> => {
    if (inflight >= 3) return null;
    inflight += 1;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    // One total deadline and concurrency budget covers admission and answering.
    if (prompt === PLANTING_QUERY && !await prepare(session, ctl.signal)) return null;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Oracle-Session': session }, body: JSON.stringify({ text: prompt }), signal: ctl.signal });
    if (!res.ok) { await res.body?.cancel(); return null; }
    return parseReply(await res.json());
  } catch { return null; }
  finally { clearTimeout(timer); inflight -= 1; }
  };
}
export const ask = createOracleClient(URL);
