import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Game } from '../game';
import copy from '../../../content/copy.json';
import { isClientMsg } from '../validate-message';

test('NPC correlation IDs are optional, bounded and string-only', () => {
  const ask = { t:'ask', npc:'seedwife', text:'Hello' };
  assert(isClientMsg(ask)); assert(isClientMsg({ ...ask, requestId:'abc-123' }));
  for (const requestId of ['', 'x'.repeat(65), {}, 123, '<script>']) assert(!isClientMsg({ ...ask, requestId }));
});

test('rejected NPC questions provide dialogue feedback without progress or cooldown mutation', async () => {
  const game = new Game(mkdtempSync(join(tmpdir(), 'pons-npc-feedback-')));
  await game.initialize(); const messages: any[] = [];
  try {
    const live = game.join({ OPEN:1, readyState:1, send(raw:string) { messages.push(JSON.parse(raw)); }, close() {} } as any,
      { t:'hello', id:'npcfeedback123', secret:'npcfeedbacksecret', name:'Dialogue QA' })!;
    const rec = game.players.get(live.id)!;
    const before = JSON.stringify(rec), now = Date.now();
    game.npcNear = () => false;
    await game.onAsk(live, rec, 'seedwife', 'How do I plant?', now, 'request-1');
    await game.commit();
    assert.equal(messages.at(-1).text, copy.ui.askTooFar);
    assert.equal(messages.at(-1).requestId, 'request-1');
    game.npcNear = () => true; live.lastAskAt = now;
    await game.onAsk(live, rec, 'seedwife', 'How do I plant?', now + 1);
    await game.commit();
    assert.equal(messages.at(-1).text, copy.ui.askCooldown);
    await game.onAsk(live, rec, 'seedwife', '<> ', now + 4000);
    await game.commit();
    assert.deepEqual(messages.at(-1), { t:'say', npc:'seedwife', name:'Seedwife Ada', text:copy.ui.askEmpty, oracle:false });
    assert.equal(live.lastAskAt, now);
    assert.equal(JSON.stringify(rec), before);
  } finally { await game.store.close(); }
});
