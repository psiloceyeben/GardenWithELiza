// Box C only. Check the configured development listener and browser boundaries.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { get } from 'node:http';
const server = await createServer({ root: resolve('client'), configFile: resolve('client/vite.config.ts'),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { port: 0, strictPort: true, open: false } });
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.equal(address.address, '127.0.0.1', 'Development must not bind a public interface');
  const url = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(url)).status, 200);
  // node:http preserves the explicit Host header on the wire.
  const hostileStatus = await new Promise((resolve, reject) => {
    get(url, { headers: { host: 'untrusted.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(hostileStatus, 403);
  const foreign = await fetch(url, { headers: { origin: 'https://untrusted.example' } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  console.log('PASS configured loopback dev server, valid local request, hostile Host rejection and no foreign-origin CORS grant');
} finally { await server.close(); }
