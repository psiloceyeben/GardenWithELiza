import test from 'node:test';
import assert from 'node:assert/strict';
import { wsUrl } from '../client/src/net';

test('production query cannot redirect the identity-bearing connection', () => {
  for (const origin of ['https://prometheus7.com', 'http://prometheus7.com']) {
    for (const target of ['wss://attacker.example/ws', 'ws://localhost:8132', 'wss://prometheus7.com:9999/ws']) {
      const page = new URL(`${origin}/ponsgarden/?ws=${encodeURIComponent(target)}`);
      assert.equal(wsUrl(page), `${page.protocol === 'https:' ? 'wss' : 'ws'}://prometheus7.com/ponsgarden/ws`);
    }
  }
});

test('local preview permits only an explicit same-host loopback WebSocket', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const page = new URL(`http://${host}:8124/?ws=${encodeURIComponent(`ws://${host}:8132`)}`);
    assert.equal(wsUrl(page), `ws://${host}:8132/`);
  }
  for (const target of ['ws://attacker.example', 'ws://localhost.attacker.example', 'ws://127.0.0.1:8132', 'https://localhost:8132', 'ws://user:pass@localhost:8132', 'ws://localhost:8132/#fragment', 'not a URL']) {
    assert.equal(wsUrl(new URL(`http://localhost:8124/?ws=${encodeURIComponent(target)}`)), 'ws://localhost:8124/ws');
  }
});
