// Box C: admit only this public game guide into a fresh isolated QA session.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const guide = require('../content/lore/planting-guide.json');
const { parseReply } = require('../server/dist/server/src/oracle.js');
const session = randomBytes(18).toString('hex');
async function post(endpoint, payload, token = session) {
  const response = await fetch('http://127.0.0.1:8099/' + endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-Oracle-Session': token },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(25000),
  });
  assert.equal(response.status, 200); return response.json();
}
(async () => {
  const admitted = await post('ingest', guide); console.log(JSON.stringify({ admitted }));
  assert.equal(admitted.status, 'admitted'); assert.equal(admitted.admitted_sentences, 3);
  for (const text of ['Tell me about Pons Garden planting', 'How do I plant a seed?']) {
    const result = await post('chat', { text });
    console.log(JSON.stringify({ question: text, status: result.status, path: result.path,
      isolatedSession: result.session_key === ('tk_' + session).slice(0, 16), response: result.response, parsed: parseReply(result) }));
    if (text.startsWith('Tell')) {
      const reply = parseReply(result); assert(reply && !reply.withheld);
      assert(reply.text.includes('Bag') && reply.text.includes('empty plot'));
    }
  }
  const control = await post('chat', { text: 'Tell me about Pons Garden planting' }, randomBytes(18).toString('hex'));
  console.log(JSON.stringify({ controlStatus: control.status, controlResponse: control.response }));
  assert(!String(control.response).includes('Pons Garden planting starts by opening Bag'), 'Private guide escaped its session');
})().catch(error => { console.error(error); process.exitCode = 1; });
