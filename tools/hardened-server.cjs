// Entry point only for the isolated systemd hardening check.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const state = process.env.STATE_DIRECTORY;
assert(state && /^\/var\/lib\/pons-hardening-qa-[a-zA-Z0-9]+$/.test(state));
assert.notEqual(process.getuid(), 0);
assert.equal(process.env.PONS_HOST, '127.0.0.1');
assert.equal(process.env.PONS_PORT, '0');
fs.writeFileSync(path.join(state, 'sandbox-probe.txt'), 'isolated QA');
assert.throws(() => fs.writeFileSync(`/opt/pons/${path.basename(state)}-forbidden.txt`, 'QA', { flag: 'wx' }),
  e => ['EROFS', 'EACCES', 'EPERM'].includes(e.code));
assert.throws(() => fs.readdirSync('/root'), e => ['EACCES', 'EPERM'].includes(e.code));
process.env.PONS_DATA = state;
console.log(`SANDBOX_PROBE_PASS uid=${process.getuid()} state=${path.basename(state)}`);
require('../server/dist/server/src/index.js');
