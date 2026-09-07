// Town NPCs and their missions. Original characters (I-9). Rewards are Sap only (I-6).
// NPC free-text replies come from the Oracle (server/src/oracle.ts) framed by these personas.
export interface Npc { id: string; name: string; role: string; lines: string[]; unsure: string[]; }
export type MissionKind = 'forage' | 'plant' | 'reveal' | 'sprint' | 'tag' | 'steal' | 'tend' | 'visit' | 'ask' | 'buy';
export interface MissionDef { id: string; npc: string; kind: MissionKind; target: number; reward: number; title: string; text: string; done: string; }
export type MissionStatus = 'available' | 'active' | 'ready' | 'done';
export interface MissionView extends MissionDef { progress: number; status: MissionStatus; }

export const NPCS: Npc[] = [
  { id: 'mayor', name: 'Mayor Gorm', role: 'the mayor of the village, proud, slightly damp, fond of speeches',
    lines: ['Welcome, gardener. Tend your plots and mind your gate.', 'A tidy village is a village nobody robs. Well. Robs less.', 'The notice board knows everything. I know slightly more.'],
    unsure: ['Gorm clears his throat and looks at the fountain.', 'That is a matter for the board, I think.'] },
  { id: 'seedwife', name: 'Seedwife Ada', role: 'the seed seller, warm, blunt, knows every plant by its first leaf',
    lines: ['Wild seeds sprout on the grounds every few minutes. Free, if you are quick.', 'Water a sprout once and it grows faster. Water it twice and you are just being sweet.', 'Weeds halve the Sap. Pull them.'],
    unsure: ['Ada squints at a seed and says nothing useful.', 'Plant it and find out, love.'] },
  { id: 'barkeep', name: 'Bram the Barkeep', role: 'the tavern keeper, gossip, keeps a tally of every theft in the village',
    lines: ['Heard someone lost a Fraudulent Orchid last night. Coat slipped and everything.', 'A thief who gets tagged buys the next round. House rule.', 'Bounties are posted on the board. I only collect the stories.'],
    unsure: ['Bram polishes a glass that was already clean.', 'Ask me after the next raid.'] },
  { id: 'oracle', name: 'The Oracle', role: 'a hooded voice in the shrine that answers from what it has read and admits what it has not',
    lines: ['Ask, and I will answer from what I have read.', 'I do not guess. If I have not read it, I will say so.', 'Every garden is a portrait. Yours is still being painted.'],
    unsure: ['The Oracle is silent. It has not read that.', 'The hood tilts. "That is not yet written."'] },
  { id: 'warden', name: 'Warden Pell', role: 'the gate warden, brisk, runs the sprint track, respects speed and fences',
    lines: ['The track is there. Touch the fountain, come back, do not embarrass yourself.', 'A closed gate takes three hits. Three loud hits.', 'Tag a thief and the Sap is yours. That is the law.'],
    unsure: ['Pell shrugs and checks the gate.', 'Run first, ask later.'] },
];

export const MISSIONS: MissionDef[] = [
  { id: 'forage3', npc: 'seedwife', kind: 'forage', target: 3, reward: 80, title: 'Wild things', text: 'Bring me three wild seeds from the grounds.', done: 'Three, and all still damp. Good.' },
  { id: 'plant2', npc: 'seedwife', kind: 'plant', target: 2, reward: 60, title: 'Get your hands dirty', text: 'Plant two seeds in your plots.', done: 'Now the waiting. Waiting is most of gardening.' },
  { id: 'reveal1', npc: 'seedwife', kind: 'reveal', target: 1, reward: 100, title: 'First sprout', text: 'Grow a plant until it reveals itself.', done: 'Look at it. Look at its little face.' },
  { id: 'tend3', npc: 'mayor', kind: 'tend', target: 3, reward: 70, title: 'Civic pride', text: 'Water or weed three plants.', done: 'The village thanks you. I thank you louder.' },
  { id: 'visit1', npc: 'mayor', kind: 'visit', target: 1, reward: 120, title: 'Diplomacy', text: 'Visit another village through the signpost.', done: 'And how do their fences compare? Worse, I assume.' },
  { id: 'buy2', npc: 'mayor', kind: 'buy', target: 2, reward: 50, title: 'Support local business', text: 'Buy two seeds from the conveyor.', done: 'Commerce. Beautiful.' },
  { id: 'sprint1', npc: 'warden', kind: 'sprint', target: 1, reward: 60, title: 'Warm up', text: 'Run one lap on the track.', done: 'Slow. But finished. Again tomorrow.' },
  { id: 'tag1', npc: 'warden', kind: 'tag', target: 1, reward: 200, title: 'Gate duty', text: 'Tag a thief carrying a plant.', done: 'That is how it is done. Sap is yours.' },
  { id: 'steal1', npc: 'barkeep', kind: 'steal', target: 1, reward: 150, title: 'A story for the bar', text: 'Steal one plant and get it home.', done: 'Oh, that is going in the book.' },
  { id: 'ask1', npc: 'oracle', kind: 'ask', target: 1, reward: 50, title: 'Consult the Oracle', text: 'Ask the Oracle a question.', done: 'You asked. That is the whole of it.' },
];

export const MISSION_MAX_ACTIVE = 3;
export const npcById = (id: string): Npc | undefined => NPCS.find((n) => n.id === id);
