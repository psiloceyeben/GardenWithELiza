import assert from 'node:assert/strict';
import { test } from 'node:test';
import { originPolicy } from '../origin-policy';
test('only exact public and explicitly configured origins are allowed remotely', () => {
  const allow = originPolicy('https://prometheus7.com/ponsgarden', 'https://staging.example:8443');
  for (const origin of ['https://prometheus7.com', 'https://staging.example:8443']) assert(allow(origin, '192.0.2.1'));
  for (const origin of ['http://prometheus7.com', 'https://prometheus7.com.attacker.example', 'https://attacker.example', 'https://staging.example', 'null', '', 'https://prometheus7.com/', 'https://prometheus7.com/path', 'https://user@prometheus7.com', 'https://prometheus7.com, https://attacker.example']) assert(!allow(origin, '192.0.2.1'), origin);
});
test('loopback preview exception requires the actual peer to be loopback', () => {
  const allow = originPolicy('https://prometheus7.com/ponsgarden');
  for (const origin of ['http://localhost:8124', 'http://127.0.0.1:8124', 'http://[::1]:8124']) {
    for (const peer of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) assert(allow(origin, peer));
    assert(!allow(origin, '192.0.2.1')); assert(!allow(origin));
  }
  assert(!allow('http://localhost.attacker.example:8124', '127.0.0.1'));
});
test('origin-less native clients remain supported and malformed config fails closed', () => {
  assert(originPolicy('https://prometheus7.com/ponsgarden')(undefined, '192.0.2.1'));
  for (const extra of ['*', 'https://example.com/path', 'null', 'ftp://example.com']) assert.throws(() => originPolicy('https://prometheus7.com', extra));
  assert.throws(() => originPolicy('ftp://example.com'));
});
