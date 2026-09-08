import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {readerFromEnv,RpcReader} from '../../../chain-reader/src';
import {WorkerRpcReader} from '../../../chain-reader/src/worker-reader';
import {TRANSFER_TOPIC,topicAddress} from '../../../chain-reader/src/history';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const disk=require('node:fs/promises') as typeof import('node:fs/promises');
const token='0x'+'2'.repeat(40),wallet='0x'+'1'.repeat(40),word=(n:number)=>'0x'+n.toString(16).padStart(64,'0');
test('RPC workers match direct snapshots, reuse checkpoints and finish disk writes after worker timeout',async(t)=>{
  const methods:string[]=[];
  const logs=Array.from({length:2000},(_,i)=>({address:token,blockNumber:'0x1',blockHash:word(1),transactionHash:word(i+1),logIndex:'0x'+i.toString(16),topics:[TRANSFER_TOPIC,topicAddress('0x'+'0'.repeat(40)),topicAddress(wallet)],data:word(1)}));
  const server=createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const request=JSON.parse(Buffer.concat(chunks).toString());methods.push(request.method);
    let result:unknown;
    if(request.method==='eth_chainId')result='0x1';
    else if(request.method==='eth_getLogs')result=request.params[0].topics[1]===null?logs:[];
    else if(request.method==='eth_getBlockByNumber'){
      const n=request.params[0]==='finalized'?2:Number(BigInt(request.params[0]));
      result={number:'0x'+n.toString(16),hash:word(n),timestamp:'0x'+n.toString(16)};
    }
    else if(request.method==='eth_call')result=word(request.params[0].data==='0x313ce567'?0:2000);
    else throw new Error('Unexpected method');
    res.end(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert(address && typeof address!=='string');
  const rpcUrl=`http://127.0.0.1:${address.port}`;
  try{
    const direct=await new RpcReader({rpcUrl,token,decimals:0,fromBlock:1,chainId:1,ecosystem:{}}).snapshot(wallet);
    const reader=readerFromEnv({PONS_RPC_URL:rpcUrl,PONS_TOKEN:token,PONS_DECIMALS:'0',PONS_FROM_BLOCK:'1',PONS_CHAIN_ID:'1'});
    assert.equal(reader.kind,'cached(rpc-worker)');
    assert.deepEqual(await reader.snapshot(wallet),direct);
    assert.equal(direct.ponsBalance,2000);assert.equal(direct.stakeTime,2000*1000/86400000);
    const historyDirectory=await disk.mkdtemp(join(tmpdir(),'pons-worker-checkpoint-'));
    const cfg={rpcUrl,token,decimals:0,fromBlock:1,chainId:1,ecosystem:{},historyDirectory};
    assert.deepEqual(await new WorkerRpcReader(cfg).snapshot(wallet),direct);
    const before=methods.filter(m=>m==='eth_getLogs').length;
    assert.deepEqual(await new WorkerRpcReader(cfg).snapshot(wallet),direct);
    assert.equal(methods.filter(m=>m==='eth_getLogs').length,before,'Reopened worker uses validated checkpoint instead of rescanning old logs');

    // Pause the actual parent-side atomic rename while its write lock is held.
    // Let the real worker deadline terminate the scan, then let disk work finish.
    let entered!:()=>void,release!:()=>void;
    const atRename=new Promise<void>(resolve=>{entered=resolve;});
    const held=new Promise<void>(resolve=>{release=resolve;});
    const original=disk.rename;
    let renamed=0;
    const replacement=t.mock.method(disk,'rename',async(...args:Parameters<typeof disk.rename>)=>{
      entered();await held;await original(...args);renamed++;
    });
    try {
      const interruptedReader=new WorkerRpcReader(cfg,3000);
      const failed=assert.rejects(interruptedReader.snapshot(wallet),/^Error: Chain scan timed out$/);
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {await Promise.race([atRename,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Writer never reached rename')),5000);})]);}
      finally {clearTimeout(timer);}
      assert((await disk.readdir(historyDirectory)).includes('.write-lock'));
      await failed;
      assert((await disk.readdir(historyDirectory)).includes('.write-lock'),'The surviving parent still owns the paused write');
      await assert.rejects(interruptedReader.snapshot(wallet),/^Error: Chain scan timed out$/);
      const logReads=methods.filter(m=>m==='eth_getLogs').length;
      assert.deepEqual(await interruptedReader.snapshot(wallet),direct,'Saturated disk admission falls back to verified RPC rather than queuing more writes');
      assert(methods.filter(m=>m==='eth_getLogs').length>logReads);
      release();
      const until=Date.now()+5000;
      while(renamed<2 || (await disk.readdir(historyDirectory)).some(n=>!n.endsWith('.json'))){
        assert(Date.now()<until,'Parent must finish temporary-file and lock cleanup');
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.equal(renamed,2,'At most two checkpoint operations were retained');
    } finally {release();replacement.mock.restore();}
    assert.deepEqual(await new WorkerRpcReader(cfg).snapshot(wallet),direct,'A fresh worker still reads and writes checkpoints after interruption');
    assert((await disk.readdir(historyDirectory)).every(n=>n.endsWith('.json')));
    assert(methods.every(m=>['eth_chainId','eth_call','eth_getLogs','eth_getBlockByNumber'].includes(m)));
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('worker timeout terminates a scan and provider/config errors stay sanitized',async()=>{
  const cfg={rpcUrl:'http://127.0.0.1:1/private-provider-secret',token,decimals:0,fromBlock:1,chainId:1,ecosystem:{}};
  await assert.rejects(new WorkerRpcReader(cfg,1).snapshot(wallet),/^Error: Chain scan timed out$/);
  await assert.rejects(new WorkerRpcReader({...cfg,decimals:-1}).snapshot(wallet),/^Error: Chain read worker failed$/);
  for(const timeout of [0,NaN,1.5,1800001])assert.throws(()=>new WorkerRpcReader(cfg,timeout),/timeout/);
  assert.throws(()=>readerFromEnv({PONS_CHAIN_SCAN_TIMEOUT_MS:'1'}),/requires RPC/);
});
