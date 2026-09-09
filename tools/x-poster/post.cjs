#!/usr/bin/env node
// Scheduled poster for the GardenWithEliza X account.
//
// Two rules shape this thing:
//
//   1. NOTHING POSTS THAT A HUMAN HAS NOT APPROVED. Entries need "approved": true. An
//      account that posts unattended is one bad generation away from something you cannot
//      unsend, and the queue is a cheap place to keep a person in the loop.
//   2. NOTHING POSTS TWICE. Each entry gets an id; posted ids are appended to a log and
//      checked before every send, so a duplicate cron fire, a retry or a restart is safe.
//
// Credentials come from the environment only. They must never be written to the repo, the
// queue, or the log.
//
//   node post.cjs --dry-run     show what would post, contact nothing
//   node post.cjs --once        post at most one due entry
//   node post.cjs --status      queue summary

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = __dirname;
const QUEUE = path.join(DIR, 'queue.json');
const LOG = path.join(DIR, 'posted.jsonl');
const API = 'https://api.x.com/2/tweets';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const DRY = has('--dry-run');

// --- OAuth 1.0a, user context ------------------------------------------------------------
// X still accepts OAuth 1.0a for posting, and unlike OAuth2 user tokens these do not expire,
// which is what you want for something running on a timer with nobody watching.

const pct = (s) => encodeURIComponent(s).replace(/[!*()']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function authHeader(method, url, creds) {
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  // The body is JSON, so only oauth_* params are signed. Query strings would join them here.
  const base = [method.toUpperCase(), pct(url), pct(
    Object.keys(oauth).sort().map((k) => `${pct(k)}=${pct(oauth[k])}`).join('&'),
  )].join('&');
  const key = `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${pct(k)}="${pct(oauth[k])}"`).join(', ');
}

function credentials() {
  const c = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  };
  const missing = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    throw new Error(`missing credentials: ${missing.join(', ')}. See docs/X_AUTOPOST_SETUP.md`);
  }
  return c;
}

// --- queue --------------------------------------------------------------------------------

const readQueue = () => (fs.existsSync(QUEUE) ? JSON.parse(fs.readFileSync(QUEUE, 'utf8')) : { posts: [] });
const postedIds = () => new Set(
  (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : [])
    .map((l) => { try { return JSON.parse(l).id; } catch { return null; } }).filter(Boolean),
);

/** Entries that are approved, not yet posted, and whose scheduled time has arrived. */
function due(now = Date.now()) {
  const done = postedIds();
  return readQueue().posts.filter((p) =>
    p.approved === true && !done.has(p.id) && (!p.notBefore || Date.parse(p.notBefore) <= now));
}

function record(entry, result) {
  fs.appendFileSync(LOG, JSON.stringify({
    id: entry.id, at: new Date().toISOString(), ok: result.ok,
    tweetId: result.tweetId ?? null, error: result.error ?? null,
    text: entry.text.slice(0, 120),
  }) + '\n', 'utf8');
}

async function send(text) {
  const creds = credentials();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader('POST', API, creds) },
    body: JSON.stringify({ text }),
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, error: `${res.status} ${body.slice(0, 300)}` };
  let tweetId = null;
  try { tweetId = JSON.parse(body).data?.id ?? null; } catch { /* posted, id unreadable */ }
  return { ok: true, tweetId };
}

// --- main ----------------------------------------------------------------------------------

(async () => {
  const q = readQueue();
  const done = postedIds();
  const ready = due();

  if (has('--status') || !q.posts.length) {
    const approved = q.posts.filter((p) => p.approved === true).length;
    console.log(`queue: ${q.posts.length} entr(ies), ${approved} approved, ${done.size} already posted, ${ready.length} due now`);
    for (const p of q.posts) {
      const readyIds = new Set(ready.map((r) => r.id));
      const state = done.has(p.id) ? "posted" : p.approved !== true ? "NOT APPROVED" : readyIds.has(p.id) ? "due" : "scheduled";
      console.log(`  [${state}] ${p.id}  ${p.notBefore ?? 'anytime'}  ${p.text.split('\n')[0].slice(0, 60)}`);
    }
    return;
  }

  if (!ready.length) { console.log('nothing due'); return; }
  const batch = has('--once') ? ready.slice(0, 1) : ready;

  for (const entry of batch) {
    if (entry.text.length > 280) {
      console.error(`SKIP ${entry.id}: ${entry.text.length} chars, over the limit`);
      continue;
    }
    if (DRY) { console.log(`[dry-run] would post ${entry.id}:\n${entry.text}\n`); continue; }
    const result = await send(entry.text);
    record(entry, result);
    console.log(result.ok ? `posted ${entry.id} -> ${result.tweetId}` : `FAILED ${entry.id}: ${result.error}`);
    if (!result.ok) process.exitCode = 1;
    await new Promise((r) => setTimeout(r, 2000));   // be polite between posts
  }
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
