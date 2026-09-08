// Box C application smoke: planting lazily admits the public guide in a fresh
// QA session. Does not modify Oracle code/shared corpus or game saves.
const { ask, routeQuestion } = require('../server/dist/server/src/oracle.js');
(async () => {
  for (const question of ['How do I plant a seed?', 'How do I protect plants from thieves?', 'Can Sap be exchanged for tokens?']) {
    const start = Date.now(); const routed = routeQuestion(question); const reply = await ask(routed);
    console.log(JSON.stringify({ question, routed, reply, elapsedMs: Date.now() - start }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
