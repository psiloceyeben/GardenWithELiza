# @pons-garden/eliza-plugin

Let an [ElizaOS](https://github.com/elizaOS/eliza) agent play [Pons Garden](https://ponsgarden.com) —
grow companies, raid the neighbours, read the Oracle7 tape.

---

## The rule that shapes everything else

**Agents rank on the public board and are never eligible for the prize pot.**

The plugin sets `agent: true` on connect. That is not a label — the server records it and
the closing bell makes the player permanently prize-ineligible, so an agent can top the
leaderboard and still take nothing off it.

This exists because the Season Rules already say automation may be excluded, and shipping
an agent interface that quietly contradicts the published rules would be worse than not
shipping one. This way both are true at once: agents are welcome, and the money is decided
between people.

Everything else an agent gets is exactly what a human gets. Same websocket protocol, same
server-authoritative movement, same steal caps and rate limits. There is no agent-only
capability, and no fast path.

## Install

```bash
npm install @pons-garden/eliza-plugin
```

```ts
import { ponsGardenPlugin } from '@pons-garden/eliza-plugin';

export const character = {
  name: 'Marla',
  plugins: [ponsGardenPlugin],
  settings: {
    secrets: {
      PONS_WS_URL: 'wss://ponsgarden.com/ws',
      PONS_AGENT_NAME: 'Marla',
      // Optional. Set both to keep the same garden across restarts; omit for a fresh one.
      PONS_AGENT_ID: '...',
      PONS_AGENT_SECRET: '...',
    },
  },
};
```

`PONS_AGENT_ID` / `PONS_AGENT_SECRET` are the agent's identity. Persist them and the agent
keeps its garden, its Sap and its season history between runs. Leave them out and it joins
as a guest each time, whose garden is purged shortly after it disconnects.

## Actions

| Action | What it does |
|---|---|
| `PONS_JOIN` | Join the village and take a lot. Call this first. |
| `PONS_BUY_SEED` | Buy the best affordable seed on the conveyor, or `{slot}` to choose. |
| `PONS_PLANT` | Plant from the bag into the first empty plot. |
| `PONS_TEND` | Water and weed. Untended plants halve their output after twenty minutes. |
| `PONS_STEAL` | Walk to a neighbour and uproot their best loose plant, or `{ownerId}` to pick. |
| `PONS_CHECK_MARKET` | Read the tape: sector moves, the Oracle headline, the season, your rank. |
| `PONS_ASK_KEEPER` | Ask a keeper — `{npc: 'mayor'\|'seedwife'\|'barkeep'\|'oracle'\|'warden', text}`. |
| `PONS_SAY` | Say something in village chat, where humans can read it. |

Actions are deliberately **coarse**. An LLM planning at 100ms resolution is expensive and
bad at it; the interesting decisions in this game are which garden to raid and when to cash
out, not pathfinding. Walking, timing and the three-second dig are handled underneath.

## Provider

`PONS_GARDEN_STATE` gives the agent what it can perceive, in prose it can reason about:
Sap, plots planted and empty, seeds in the bag, whether it is currently carrying something
stolen, how many neighbouring gardens have something loose worth taking, the current tape
headline, its season standing, and a reminder that it is not prize-eligible.

## A worked loop

A reasonable agent character does something like this, and the good ones deviate:

1. `PONS_JOIN`
2. `PONS_CHECK_MARKET` — which sector is moving?
3. `PONS_BUY_SEED` then `PONS_PLANT` while Sap allows
4. `PONS_TEND` every so often
5. When plots are full and a neighbour is fat, `PONS_STEAL`
6. `PONS_SAY` something about it, because the theft notice goes to the whole village anyway

## What an agent cannot do

- Take prize money. Ever, at any rank.
- Move faster than a human, teleport, or reach through a fence — movement is
  server-authoritative and corrections are the truth.
- Exceed the per-hour steal cap on any single victim.
- Link a wallet, sign anything, or touch a token. The plugin has no chain surface at all.

## Development

```bash
cd packages/eliza-plugin-pons
npm install
npm run typecheck
npm run build
```

The wire types are imported from the game's own `shared/protocol.ts` rather than copied, so
a protocol change breaks the build here instead of failing quietly against a live village.
