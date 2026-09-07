#!/usr/bin/env node
// Scripted players for end-to-end raid tests against a running server. Runs on Box C after `server` is built.
//   node tools/bot.js ws://127.0.0.1:8130
// Scenario: Alice plants + reveals; Bob walks over, uproots, carries home, scores. Then Bob tries again while
// Alice stands guard and gets tagged. Prints every feed/toast line each bot receives.
const WebSocket = require('ws');
const W = require('../server/dist/shared/world.js');
const P = require('../server/dist/shared/protocol.js');

const URL = process.argv[2] || 'ws://127.0.0.1:8130';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

class Bot {
  constructor(name) { this.name = name; this.id = hex(16); this.secret = hex(32); this.x = 0; this.y = 0; this.you = null; this.lots = new Map(); this.village = null; this.carry = null; this.channel = null; this.log = []; }
  connect() {
    return new Promise((res) => {
      this.ws = new WebSocket(URL);
      this.ws.on('open', () => this.send({ t: 'hello', id: this.id, secret: this.secret, name: this.name }));
      this.ws.on('message', (raw) => { const m = JSON.parse(raw); this.on(m); if (m.t === 'welcome') res(); });
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  on(m) {
    if (m.t === 'welcome') { this.you = m.you; this.village = W.buildVillage(m.village.seed); for (const l of m.lots) this.lots.set(l.ownerId, l); const me = m.players.find((p) => p.id === this.id); this.x = me.x; this.y = me.y; this.say(`welcome lot=${m.you.lotId} village=${m.village.name} sap=${m.you.sap}`); }
    else if (m.t === 'state') Object.assign(this.you, m.you);
    else if (m.t === 'lot') this.lots.set(m.lot.ownerId, m.lot);
    else if (m.t === 'feed') this.say(`FEED ${m.e.kind}: ${m.e.text}`);
    else if (m.t === 'toast') this.say(`toast: ${m.text}`);
    else if (m.t === 'carry') { this.carry = m.speciesId; this.say(`carry=${m.speciesId}`); }
    else if (m.t === 'channel') { this.channel = m.kind; this.say(`channel=${m.kind}`); }
    else if (m.t === 'reveal') this.say(`REVEAL ${m.plant.speciesId} size=${m.plant.size} mut=${m.plant.mutation}`);
    else if (m.t === 'error') this.say(`ERROR ${m.text}`);
    else if (m.t === 'snap') { const me = m.p.find((p) => p.id === this.id); if (me && Math.hypot(me.x - this.x, me.y - this.y) > 48) { this.say(`server corrected me to ${me.x},${me.y}`); this.x = me.x; this.y = me.y; } }
  }
  say(s) { const line = `[${this.name}] ${s}`; this.log.push(line); console.log(line); }
  gateClosed = (tx, ty) => { for (const l of this.lots.values()) { const g = this.village.lots[l.lotId].gate; if (g.tx === tx && g.ty === ty) return l.defenses.gateHp > 0; } return false; };
  async walkTo(target) {
    const path = W.findPath(this.village, { x: this.x, y: this.y }, target, this.gateClosed);
    if (!path) { this.say(`no path to ${target.x},${target.y}`); return false; }
    for (const wp of path) {
      for (let i = 0; i < 400; i++) {
        const dx = wp.x - this.x; const dy = wp.y - this.y; const d = Math.hypot(dx, dy);
        if (d < 3) break;
        const sp = P.BASE_SPEED * (this.carry ? P.CARRY_SPEED : 1) * 0.1 * 0.9;
        const step = Math.min(d, sp);
        const r = W.moveActor(this.village, this.x, this.y, (dx / d) * step, (dy / d) * step, this.gateClosed);
        this.x = r.x; this.y = r.y;
        this.send({ t: 'input', dx: dx / d, dy: dy / d, x: Math.round(this.x), y: Math.round(this.y), d: 'down', f: false, m: true });
        await sleep(100);
      }
    }
    this.send({ t: 'input', dx: 0, dy: 0, x: Math.round(this.x), y: Math.round(this.y), d: 'down', f: false, m: false });
    return true;
  }
  plotPx(ownerId, i) { const l = this.lots.get(ownerId); const p = this.village.lots[l.lotId].plots[i]; return { x: p.tx * W.TILE + 16, y: p.ty * W.TILE + 16 }; }
  lotInside(ownerId) { const l = this.lots.get(ownerId); const c = this.village.lots[l.lotId].center; return { x: c.x, y: c.y + 40 }; }
}

(async () => {
  const alice = new Bot('Alice'); const bob = new Bot('Bob');
  await alice.connect(); await bob.connect();
  const fails = [];
  const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'}: ${what}`); if (!cond) fails.push(what); };

  // Alice: buy cheapest slot, plant at plot 0, wait for reveal
  const slot = alice.you.conveyor.slots.findIndex((s) => s.tier === 'common');
  alice.send({ t: 'buy', slot }); await sleep(300);
  check(alice.you.seeds.length === 1, 'Alice bought a seed');
  const a0 = alice.plotPx(alice.id, 0); await alice.walkTo({ x: a0.x, y: a0.y + 20 });
  alice.send({ t: 'plant', seedUid: alice.you.seeds[0].uid, plotId: 0 }); await sleep(300);
  check(!!alice.you.plots[0], 'Alice planted');
  console.log('waiting for reveal (30 s)...'); await sleep(31500);
  check(alice.you.plots[0] && alice.you.plots[0].revealed, 'Alice plant revealed');

  // Bob walks to Alice's plot and uproots while Alice is (shield-free) far away
  await alice.walkTo(alice.lotInside(alice.id)); // Alice inside own lot but > TAG_RADIUS from plot 0? move her to the far corner instead
  const al = alice.village.lots[alice.lots.get(alice.id).lotId]; await alice.walkTo({ x: (al.x + 2) * 32 + 16, y: (al.y + 9) * 32 + 16 });
  const ok = await bob.walkTo({ x: a0.x, y: a0.y + 20 });
  check(ok, 'Bob pathed into Alice lot');
  bob.send({ t: 'uproot', ownerId: alice.id, plotId: 0 }); await sleep(3600);
  check(bob.carry !== null, 'Bob uprooted and is carrying');
  const home = bob.lotInside(bob.id); await bob.walkTo(home); await sleep(400);
  check(bob.carry === null && bob.you.plots.some((p) => p), 'Bob scored the stolen plant at home');
  check(alice.you.plots[0] === null, 'Alice lost plot 0');

  // Round 2: Alice stands on her plot 1 area; Bob steals back? Bob plants nothing; instead Alice raids Bob and Bob tags.
  const b0 = bob.plotPx(bob.id, bob.you.plots.findIndex((p) => p));
  await bob.walkTo({ x: b0.x, y: b0.y + 20 });
  await alice.walkTo({ x: b0.x, y: b0.y + 20 });
  alice.send({ t: 'uproot', ownerId: bob.id, plotId: bob.you.plots.findIndex((p) => p) }); await sleep(1200);
  check(alice.channel === null && alice.carry === null, 'Alice uproot interrupted by Bob standing there (tag)');

  // shop: Bob buys a fence, Alice must break it
  bob.send({ t: 'shop', item: 'fence' }); await sleep(300);
  check(bob.you.defenses.gateMax === 3 || bob.you.sap < P.SHOP_PRICES.fence, `fence purchase (sap=${bob.you.sap})`);

  // wallet link (M2): Alice proves a throwaway key, land derives from the (mock) chain reader
  const SIG = require('../server/dist/server/src/sig.js');
  const priv = 'b'.repeat(63) + '1';
  let nonceMsg = null; const origOn = alice.on.bind(alice);
  alice.on = (m) => { if (m.t === 'nonce') nonceMsg = m; if (m.t === 'linked') alice.linked = m; origOn(m); };
  const { address } = SIG.signForTest('probe', priv);
  alice.send({ t: 'nonce', address }); await sleep(400);
  check(!!nonceMsg && nonceMsg.address === address, 'server issued a nonce message for the address');
  const { signature } = SIG.signForTest(nonceMsg.message, priv);
  alice.send({ t: 'link', address, signature }); await sleep(800);
  check(!!alice.linked && alice.linked.address === address, 'link accepted with a valid signature');
  check(alice.linked && alice.linked.plotCount >= 4 && alice.you.land.address === address, `land applied (plots=${alice.linked && alice.linked.plotCount}, floor=${alice.linked && alice.linked.rarityFloor}, tree=${alice.you.land.treeStage}, stumps=${alice.you.land.witherMarks})`);
  alice.send({ t: 'nonce', address }); await sleep(300);
  alice.send({ t: 'link', address, signature: '0x' + '11'.repeat(65) }); await sleep(400);
  check(alice.you.land.address === address, 'bad signature does not change the link');
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  alice.ws.close(); bob.ws.close(); process.exit(fails.length ? 1 : 0);
})();
