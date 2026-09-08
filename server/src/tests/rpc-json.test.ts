import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readRpcJson} from '../../../chain-reader/src/rpc-json';
test('bounded RPC JSON accepts exact byte limit and split UTF-8 without trusting Content-Length',async()=>{
  const bytes=new TextEncoder().encode('{"result":"🌱"}');let i=0;
  const response=new Response(new ReadableStream<Uint8Array>({pull(c){if(i<bytes.length)c.enqueue(bytes.slice(i,++i));else c.close();}}),{headers:{'content-length':'1'}});
  assert.deepEqual(await readRpcJson(response,bytes.length),{result:'🌱'});
  assert.equal(response.body!.locked,false);
});
test('oversized chunked RPC body is cancelled before the remaining stream is consumed',async()=>{
  let pulls=0,cancelled=false;
  const response=new Response(new ReadableStream<Uint8Array>({
    pull(c){pulls++;c.enqueue(new Uint8Array(8).fill(32));},cancel(){cancelled=true;}
  }));
  await assert.rejects(readRpcJson(response,16),/too large/);
  assert(cancelled);assert(pulls<=4);assert.equal(response.body!.locked,false);
});
test('malformed JSON, invalid UTF-8 and absent bodies fail without returning partial data',async()=>{
  await assert.rejects(readRpcJson(new Response('{"result":')));
  await assert.rejects(readRpcJson(new Response(new Uint8Array([0xff]))));
  await assert.rejects(readRpcJson(new Response(null)),/Missing/);
});
