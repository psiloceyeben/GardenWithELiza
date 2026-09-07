// NPC free-text replies via the Oracle7 harness (`POST /chat`, body {text}, reply {response, status}).
// Default target is the general Oracle on Box C :8097; point PONS_ORACLE_URL at a Pons-lore instance once compiled
// (content/lore/ is the seed corpus). Replies are capped, filtered against banned copy (I-4), and the Oracle's honest
// "withheld" status becomes the NPC's in-character shrug instead of an invented answer.
import bannedJson from '../../shared/banned-copy.json';
import type { Npc } from '../../shared/missions';

const URL = process.env.PONS_ORACLE_URL ?? 'http://127.0.0.1:8097/chat';
const TIMEOUT_MS = Number(process.env.PONS_ORACLE_TIMEOUT_MS ?? 15_000);
const banned = (bannedJson.patterns as string[]).map((p) => new RegExp(p, 'i'));
let inflight = 0;

export function frame(npc: Npc, village: string, player: string, question: string): string {
  return `${npc.name}, ${npc.role}, in the village ${village} of Pons Garden, a garden game where plants can be stolen. A gardener named ${player} asks: "${question}" Reply as ${npc.name} in at most two short sentences.`;
}

export interface OracleReply { text: string; withheld: boolean; }

export async function ask(prompt: string): Promise<OracleReply | null> {
  if (inflight >= 3) return null;
  inflight += 1;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: prompt }), signal: ctl.signal });
    if (!res.ok) return null;
    const j = await res.json() as { response?: string; status?: string; text?: string };
    const raw = String(j.response ?? j.text ?? '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
    const withheld = j.status === 'withheld' || !raw;
    let text = raw.slice(0, 280);
    if (banned.some((re) => re.test(text))) return { text: '', withheld: true };   // never let generated text breach I-4
    return { text, withheld };
  } catch { return null; }
  finally { clearTimeout(timer); inflight -= 1; }
}
