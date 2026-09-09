// @pons-garden/eliza-plugin — let an ElizaOS agent play Pons Garden.
//
// The agent gets exactly the affordances a human has and no more: it walks with the same
// server-authoritative input, buys from the same conveyor, and steals under the same caps.
// It declares `agent: true` on connect, which the server records and the closing bell
// honours by making it permanently prize-ineligible. Agents rank on the public board and
// can never take money off it.
//
// Design note: actions are deliberately COARSE ("go and steal the best plant you can
// reach") rather than fine ("press W"). An LLM planning at 100ms resolution is both
// expensive and bad at it; the interesting decisions in this game are which garden to
// raid and when to cash out, not pathfinding.

import type { Action, Provider, Plugin, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { PonsClient, lotGate, type PonsConfig } from './service';

const clients = new Map<string, PonsClient>();

/** One connection per agent, created on first use. */
async function clientFor(runtime: IAgentRuntime): Promise<PonsClient> {
  const key = String(runtime.agentId ?? 'default');
  const existing = clients.get(key);
  if (existing && existing.view.connected) return existing;

  const cfg: PonsConfig = {
    url: (runtime.getSetting?.('PONS_WS_URL') as string) || process.env.PONS_WS_URL || 'wss://ponsgarden.com/ws',
    name: (runtime.getSetting?.('PONS_AGENT_NAME') as string) || runtime.character?.name || 'Agent',
    id: (runtime.getSetting?.('PONS_AGENT_ID') as string) || undefined,
    secret: (runtime.getSetting?.('PONS_AGENT_SECRET') as string) || undefined,
  };
  const client = existing ?? new PonsClient(cfg);
  clients.set(key, client);
  if (!client.view.connected) await client.connect();
  return client;
}

const ok = (text: string, data?: Record<string, unknown>) => ({ success: true, text, data });
const fail = (text: string) => ({ success: false, text });

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const joinGarden: Action = {
  name: 'PONS_JOIN',
  similes: ['JOIN_PONS_GARDEN', 'ENTER_VILLAGE', 'START_PLAYING_PONS'],
  description: 'Join Pons Garden and take a lot in the village. Do this before any other Pons action.',
  validate: async () => true,
  handler: async (runtime: IAgentRuntime, _m: Memory, _s?: State, _o?: Record<string, unknown>, cb?: HandlerCallback) => {
    try {
      const c = await clientFor(runtime);
      const v = c.view;
      const text = `Joined ${v.village?.name ?? 'the village'} with ${v.you?.plotCount ?? 0} plots and ${v.you?.sap ?? 0} Sap.`;
      await cb?.({ text });
      return ok(text, { village: v.village, plots: v.you?.plotCount, sap: v.you?.sap });
    } catch (e) {
      return fail(`Could not join Pons Garden: ${(e as Error).message}`);
    }
  },
};

const buySeed: Action = {
  name: 'PONS_BUY_SEED',
  similes: ['BUY_A_SEED', 'PURCHASE_PLANT', 'GET_SEED_FROM_CONVEYOR'],
  description: 'Buy the best seed currently affordable from the conveyor. Optionally pass {slot} to pick one.',
  validate: async (runtime) => (await clientFor(runtime)).view.connected,
  handler: async (runtime, _m, _s, options, cb) => {
    const c = await clientFor(runtime);
    const slots = c.view.you?.conveyor?.slots ?? [];
    if (!slots.length) return fail('The conveyor is empty right now.');

    let slot = Number(options?.slot ?? NaN);
    if (!Number.isInteger(slot)) {
      // Best affordable: the game's own tier order is the value order.
      const sap = c.view.you?.sap ?? 0;
      const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
      let best = -1, bestRank = -1;
      slots.forEach((s, i) => {
        const rank = order.indexOf(String(s.tier));
        if (!s.sold && s.price <= sap && rank > bestRank) { best = i; bestRank = rank; }
      });
      if (best < 0) return fail(`Nothing on the conveyor is affordable with ${sap} Sap.`);
      slot = best;
    }
    c.send({ t: 'buy', slot });
    const picked = slots[slot];
    const text = `Bought a ${picked?.tier ?? 'seed'} from slot ${slot} for ${picked?.price ?? '?'} Sap.`;
    await cb?.({ text });
    return ok(text, { slot, tier: picked?.tier, price: picked?.price });
  },
};

const plantSeed: Action = {
  name: 'PONS_PLANT',
  similes: ['PLANT_A_SEED', 'SOW_SEED', 'PUT_SEED_IN_GROUND'],
  description: 'Plant a seed from the bag into the first empty plot.',
  validate: async (runtime) => {
    const v = (await clientFor(runtime)).view;
    return !!v.you?.seeds?.length && (v.you?.plots ?? []).some((p) => !p);
  },
  handler: async (runtime, _m, _s, _o, cb) => {
    const c = await clientFor(runtime);
    const seed = c.view.you?.seeds?.[0];
    const plotId = (c.view.you?.plots ?? []).findIndex((p) => !p);
    if (!seed) return fail('No seeds in the bag.');
    if (plotId < 0) return fail('Every plot is already full.');
    c.send({ t: 'plant', seedUid: seed.uid, plotId });
    const text = `Planted a ${seed.tier} seed in plot ${plotId}.`;
    await cb?.({ text });
    return ok(text, { plotId, tier: seed.tier });
  },
};

const tendGarden: Action = {
  name: 'PONS_TEND',
  similes: ['WATER_PLANTS', 'WEED_GARDEN', 'LOOK_AFTER_GARDEN'],
  description: 'Water and weed your own plots. Untended plants halve their output after twenty minutes.',
  validate: async (runtime) => (await clientFor(runtime)).view.connected,
  handler: async (runtime, _m, _s, _o, cb) => {
    const c = await clientFor(runtime);
    const plots = c.view.you?.plots ?? [];
    let n = 0;
    plots.forEach((p, i) => { if (p) { c.send({ t: 'tend', plotId: i }); n++; } });
    const text = n ? `Tended ${n} plot(s).` : 'Nothing planted to tend.';
    await cb?.({ text });
    return ok(text, { tended: n });
  },
};

const raidGarden: Action = {
  name: 'PONS_STEAL',
  similes: ['STEAL_A_PLANT', 'RAID_NEIGHBOUR', 'UPROOT_PLANT'],
  description: 'Walk to another gardener\'s plot and uproot their best unlocked plant, then carry it home.',
  validate: async (runtime) => {
    const v = (await clientFor(runtime)).view;
    return v.connected && !v.carrying && (v.you?.plots ?? []).some((p) => !p);
  },
  handler: async (runtime, _m, _s, options, cb) => {
    const c = await clientFor(runtime);
    if (c.view.carrying) return fail('Already carrying a plant — take it home first.');

    const mine = c.view.you?.id;
    const target = options?.ownerId
      ? c.view.lots.find((l) => l.ownerId === options.ownerId)
      // Richest reachable garden that is not ours and not shielded.
      : c.view.lots
          .filter((l) => l.ownerId !== mine && !l.shielded)
          .sort((a, b) => (b.plots?.length ?? 0) - (a.plots?.length ?? 0))[0];

    if (!target) return fail('No garden worth raiding is open right now.');
    const plant = (target.plots ?? []).find((p) => p.revealed && p.lockedUntil < Date.now());
    if (!plant) return fail(`${target.name ?? 'That garden'} has nothing loose to take.`);

    const gate = lotGate(c, target.lotId);
    if (gate) await c.walkTo(gate.x, gate.y, 40);
    c.send({ t: 'uproot', ownerId: target.ownerId, plotId: plant.i });
    const text = `Moving on ${target.name ?? 'a neighbour'} for their ${plant.speciesId}. Three seconds of digging, then run.`;
    await cb?.({ text });
    return ok(text, { ownerId: target.ownerId, plotId: plant.i });
  },
};

const checkMarket: Action = {
  name: 'PONS_CHECK_MARKET',
  similes: ['READ_THE_TAPE', 'CHECK_SECTORS', 'MARKET_UPDATE'],
  description: 'Read the ticker tape: sector moves, the Oracle7 headline, the season countdown and your standing.',
  validate: async (runtime) => !!(await clientFor(runtime)).view.market,
  handler: async (runtime, _m, _s, _o, cb) => {
    const m = (await clientFor(runtime)).view.market;
    if (!m) return fail('The tape has not come through yet.');
    const movers = Object.entries(m.sectors).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3)
      .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}%`).join(', ');
    const text = `${m.headline} Biggest movers: ${movers}. Season ${m.season.n}${m.standing ? `, currently #${m.standing.rank} of ${m.standing.players} on ${m.standing.score} points` : ''}.`;
    await cb?.({ text });
    return ok(text, m);
  },
};

const talkToKeeper: Action = {
  name: 'PONS_ASK_KEEPER',
  similes: ['TALK_TO_NPC', 'ASK_THE_ORACLE', 'SPEAK_TO_VILLAGER'],
  description: 'Ask one of the five village keepers a question. Pass {npc} (mayor, seedwife, barkeep, oracle, warden) and {text}.',
  validate: async (runtime) => (await clientFor(runtime)).view.connected,
  handler: async (runtime, message, _s, options, cb) => {
    const c = await clientFor(runtime);
    const npc = String(options?.npc ?? 'oracle');
    const text = String(options?.text ?? (message?.content as { text?: string })?.text ?? 'What is happening in the village?');
    c.send({ t: 'ask', npc, text, requestId: Math.random().toString(36).slice(2) });
    const said = `Asked ${npc}: "${text}"`;
    await cb?.({ text: said });
    return ok(said, { npc, question: text });
  },
};

const sayInVillage: Action = {
  name: 'PONS_SAY',
  similes: ['CHAT_IN_GAME', 'TALK_TO_PLAYERS', 'SPEAK_IN_VILLAGE'],
  description: 'Say something in village chat, where the other gardeners can read it.',
  validate: async (runtime) => (await clientFor(runtime)).view.connected,
  handler: async (runtime, message, _s, options, cb) => {
    const c = await clientFor(runtime);
    const text = String(options?.text ?? (message?.content as { text?: string })?.text ?? '').slice(0, 140);
    if (!text.trim()) return fail('Nothing to say.');
    c.send({ t: 'chat', text });
    await cb?.({ text: `Said in the village: "${text}"` });
    return ok(`Said: ${text}`);
  },
};

// ---------------------------------------------------------------------------
// Provider — what the agent perceives, in words it can reason about
// ---------------------------------------------------------------------------

const gardenState: Provider = {
  name: 'PONS_GARDEN_STATE',
  get: async (runtime: IAgentRuntime) => {
    let c: PonsClient;
    try { c = await clientFor(runtime); }
    catch { return { text: 'Not connected to Pons Garden.', data: { connected: false } }; }

    const v = c.view;
    if (!v.connected || !v.you) return { text: 'Not yet joined to a village in Pons Garden.', data: { connected: false } };

    const planted = (v.you.plots ?? []).filter(Boolean).length;
    const empty = (v.you.plots?.length ?? 0) - planted;
    const others = v.lots.filter((l) => l.ownerId !== v.you?.id);
    const raidable = others.filter((l) => !l.shielded && (l.plots ?? []).some((p) => p.revealed && p.lockedUntil < Date.now()));

    const lines = [
      `You are in ${v.village?.name ?? 'a village'} of Pons Garden as an agent player.`,
      `Sap: ${v.you.sap}. Plots: ${planted} planted, ${empty} empty of ${v.you.plots?.length ?? 0}.`,
      `Seeds in bag: ${v.you.seeds?.length ?? 0}. ${v.carrying ? `You are CARRYING a stolen ${v.carrying} — get it home to an empty plot.` : ''}`,
      `${others.length} other garden(s) nearby, ${raidable.length} with something loose worth taking.`,
      v.market ? `Tape: ${v.market.headline}` : '',
      v.market?.standing ? `Season ${v.market.season.n}: #${v.market.standing.rank} of ${v.market.standing.players}, ${v.market.standing.score} points.` : '',
      'You are marked as an automated player: you rank on the public board but are never eligible for the prize pot.',
      v.feed.length ? `Recently: ${v.feed.slice(0, 3).join(' | ')}` : '',
    ].filter(Boolean);

    return {
      text: lines.join('\n'),
      data: { connected: true, sap: v.you.sap, planted, empty, raidable: raidable.length, market: v.market },
      values: { ponsSap: v.you.sap, ponsPlanted: planted, ponsCarrying: v.carrying ?? '' },
    };
  },
};

// ---------------------------------------------------------------------------

export const ponsGardenPlugin: Plugin = {
  name: 'pons-garden',
  description: 'Play Pons Garden: grow companies, raid your neighbours, read the Oracle7 tape. Agents rank publicly but are never prize-eligible.',
  actions: [joinGarden, buySeed, plantSeed, tendGarden, raidGarden, checkMarket, talkToKeeper, sayInVillage],
  providers: [gardenState],
  init: async (_config, _runtime) => { /* connection is lazy: first action opens the socket */ },
};

export default ponsGardenPlugin;
export { PonsClient } from './service';
export type { PonsConfig, WorldView } from './service';
