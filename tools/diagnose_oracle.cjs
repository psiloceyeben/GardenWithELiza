// Box C: inspect responses to public game questions, never user conversations.
const { parseReply } = require('../server/dist/server/src/oracle.js');
(async () => {
  const questions = process.argv.slice(2);
  if (questions.length > 6) throw new Error('At most six diagnostic questions per run');
  for (const text of questions.length ? questions : ['What is a plot?', 'What are defenses?', 'What is a seed conveyor?']) {
    const session = require('node:crypto').randomBytes(18).toString('hex');
    const response = await fetch('http://127.0.0.1:8099/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Oracle-Session': session },
      body: JSON.stringify({ text }), signal: AbortSignal.timeout(25000) });
    const body = await response.json();
    console.log(JSON.stringify({ question: text, http: response.status, isolatedSession: body.session_key === ('tk_' + session).slice(0, 16), status: body.status, response: body.response, text: body.text, parsed: parseReply(body) }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
