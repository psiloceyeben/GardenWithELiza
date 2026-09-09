// Username/password accounts. The properties that matter are that a password is never
// recoverable from the file, and that the file cannot be used to guess one.

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccountStore, validateUsername, validatePassword, normaliseUsername, MIN_PASSWORD } from '../accounts';

const NOW = Date.UTC(2026, 8, 9, 12, 0, 0);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pons-acct-'));

test('the stored file contains no password, anywhere', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  s.register('marla', 'correct horse battery', 'p1', 'sec1', NOW);
  const raw = fs.readFileSync(path.join(dir, 'accounts.jsonl'), 'utf8');

  assert.ok(!raw.includes('correct horse battery'), 'THE PASSWORD IS IN THE FILE');
  assert.ok(!raw.includes('battery'), 'a fragment of the password is in the file');
  const row = JSON.parse(raw.trim());
  assert.ok(row.salt && row.hash, 'salt and hash are stored instead');
  assert.equal(row.kind, 'mobile', 'accounts are labelled');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('two accounts with the same password get different hashes', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  s.register('alice', 'the same password', 'p1', 's1', NOW);
  s.register('bob', 'the same password', 'p2', 's2', NOW);
  const a = s.get('alice')!, b = s.get('bob')!;
  assert.notEqual(a.salt, b.salt, 'salts must differ');
  assert.notEqual(a.hash, b.hash, 'so identical passwords do not look identical');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('login returns the identity, and the wrong password does not', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  s.register('marla', 'a good long password', 'player-1', 'secret-1', NOW);

  const good = s.login('marla', 'a good long password', NOW);
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.account.playerId, 'player-1');
    assert.equal(good.account.secret, 'secret-1');
  }

  const bad = s.login('marla', 'a good long passwora', NOW);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, 'wrong-password');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('usernames are case-insensitive and cannot be taken twice', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  assert.equal(s.register('Marla', 'a good long password', 'p1', 's1', NOW).ok, true);
  const dup = s.register('MARLA', 'another good password', 'p2', 's2', NOW);
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.error, 'taken');
  assert.equal(s.login('mArLa', 'a good long password', NOW).ok, true, 'any casing logs in');
  assert.equal(normaliseUsername('  MaRlA  '), 'marla');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('accounts survive a restart', () => {
  const dir = tmp();
  new AccountStore(dir).register('marla', 'a good long password', 'p1', 's1', NOW);
  const reopened = new AccountStore(dir);
  assert.equal(reopened.size, 1);
  assert.equal(reopened.login('marla', 'a good long password', NOW).ok, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('one corrupt line does not lose the accounts after it', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  s.register('alice', 'a good long password', 'p1', 's1', NOW);
  fs.appendFileSync(path.join(dir, 'accounts.jsonl'), '{ this is not json\n');
  s.register('bob', 'a good long password', 'p2', 's2', NOW);

  const reopened = new AccountStore(dir);
  assert.equal(reopened.size, 2, 'both accounts should still load');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a later line wins, so the file compacts rather than duplicating', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  s.register('marla', 'a good long password', 'p1', 's1', NOW);
  s.login('marla', 'a good long password', NOW);          // appends an updated row
  const reopened = new AccountStore(dir);
  assert.equal(reopened.size, 1, 'still one account');
  assert.ok(reopened.get('marla')!.lastLogin, 'and it is the newer row');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('repeated wrong guesses are rate limited', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  s.register('marla', 'a good long password', 'p1', 's1', NOW);
  for (let i = 0; i < 5; i++) s.login('marla', 'wrong password here', NOW);
  const blocked = s.login('marla', 'a good long password', NOW);
  assert.equal(blocked.ok, false, 'even the RIGHT password is refused while locked out');
  if (!blocked.ok) assert.equal(blocked.error, 'rate-limited');

  const later = s.login('marla', 'a good long password', NOW + 61_000);
  assert.equal(later.ok, true, 'and it clears after a minute');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an unknown username is refused without revealing that it is unknown', () => {
  const dir = tmp();
  const s = new AccountStore(dir);
  const r = s.login('nobody', 'a good long password', NOW);
  assert.equal(r.ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('username and password rules', () => {
  assert.equal(validateUsername('ab'), 'bad-username', 'too short');
  assert.equal(validateUsername('a'.repeat(17)), 'bad-username', 'too long');
  assert.equal(validateUsername('has space'), 'bad-username');
  assert.equal(validateUsername('has-dash'), 'bad-username');
  assert.equal(validateUsername('good_name99'), null);
  assert.equal(validatePassword('a'.repeat(MIN_PASSWORD - 1)), 'bad-password');
  assert.equal(validatePassword('a'.repeat(MIN_PASSWORD)), null);
  assert.equal(validatePassword(undefined), 'bad-password');
});

test('account ids satisfy the hello validator', () => {
  // The hello rule is /^[a-z0-9]{8,32}$/i. An id with an underscore is rejected there and
  // the socket closes with nothing the player can act on, which is how mobile login failed
  // silently the first time: register worked, login worked, and the game never joined.
  const HELLO_ID = /^[a-z0-9]{8,32}$/i;
  const dir = tmp();
  const s = new AccountStore(dir);
  for (let i = 0; i < 20; i++) {
    const id = 'm' + `${i}`.padStart(2, '0') + 'abcdef01234567'.slice(0, 13);
    const r = s.register(`user${i}`, 'a good long password', id, 'secret-' + i, NOW);
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(HELLO_ID.test(r.account.playerId), `id ${r.account.playerId} would be rejected by hello`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
