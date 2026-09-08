// Box C only. Separate synthetic RPC process; no live provider or game saves.
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {fork}=require('node:child_process');
const {performance,monitorEventLoopDelay}=require('node:perf_hooks');
const {RpcReader,CachedReader}=require('../server/dist/chain-reader/src/index.js');
const {WorkerRpcReader}=require('../server/dist/chain-reader/src/worker-reader.js');
const {TRANSFER_TOPIC,topicAddress}=require('../server/dist/chain-reader/src/history.js');
const token='0x'+'2'.repeat(40),word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const head=20001,batch=5000,total=50000;
if(process.argv.includes('--provider')){
  const server=createServer(async(req,res)=>{
    try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const call=JSON.parse(Buffer.concat(chunks).toString());let result;
      if(call.method==='eth_chainId')result='0x1';
      else if(call.method==='eth_getBlockByNumber'){
        const n=call.params[0]==='finalized'?head:Number(BigInt(call.params[0]));
        result={number:'0x'+n.toString(16),hash:word(n),timestamp:'0x'+n.toString(16)};
      }else if(call.method==='eth_call')result=word(call.params[0].data==='0x313ce567'?0:total);
      else if(call.method==='eth_getLogs'){
        const f=call.params[0],from=Number(BigInt(f.fromBlock));result=[];
        if(f.topics[1]===null && from<head)result=Array.from({length:batch},(_,i)=>({address:token,blockNumber:f.fromBlock,blockHash:word(from),transactionHash:word(from*batch+i),logIndex:'0x'+i.toString(16),topics:[TRANSFER_TOPIC,topicAddress('0x'+'0'.repeat(40)),f.topics[2]],data:word(1)}));
      }else throw new Error('Unexpected RPC method');
      res.end(JSON.stringify({jsonrpc:'2.0',id:call.id,result}));
    }catch{res.writeHead(500).end();}
  });
  server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
  process.on('disconnect',()=>{server.closeAllConnections();server.close();});
}else{
  (async()=>{
    assert(typeof global.gc==='function','Use --expose-gc');
    const provider=fork(__filename,['--provider'],{stdio:['ignore','ignore','inherit','ipc']});
    const exited=new Promise(resolve=>provider.once('exit',resolve));
    const deadline=setTimeout(()=>provider.kill('SIGKILL'),90000);
    try{
      const {port}=await new Promise((resolve,reject)=>{provider.once('message',resolve);provider.once('error',reject);provider.once('exit',()=>reject(new Error('Provider exited before readiness')));});
      const cfg={rpcUrl:`http://127.0.0.1:${port}`,token,decimals:0,fromBlock:1,chainId:1,ecosystem:{}};
      let baseline;
      for(const mode of ['direct','worker']){
        global.gc();
        const reader=new CachedReader(mode==='direct'?new RpcReader(cfg):new WorkerRpcReader(cfg,60000));
        const histogram=monitorEventLoopDelay({resolution:10});histogram.enable();
        await new Promise(resolve=>setTimeout(resolve,30));histogram.reset();
        let sampledRss=0,ticks=0;
        const timer=setInterval(()=>{ticks++;sampledRss=Math.max(sampledRss,process.memoryUsage().rss);},10);
        const start=performance.now();let results;
        try{results=await Promise.all(['1','3'].map(c=>reader.snapshot('0x'+c.repeat(40))));}
        finally{clearInterval(timer);histogram.disable();}
        const expectedStake=batch*2000*55*1000/86400000;
        for(const result of results){assert.equal(result.ponsBalance,total);assert(Math.abs(result.stakeTime-expectedStake)<1e-6);}
        if(baseline)assert.deepEqual(results,baseline);else baseline=results;
        console.log(JSON.stringify({mode,transfersPerWallet:total,wallets:2,elapsedMs:performance.now()-start,eventLoopMaxMs:histogram.max/1e6,eventLoopP99Ms:histogram.percentile(99)/1e6,ticks,sampledRssBytes:sampledRss,verified:true}));
      }
    }finally{clearTimeout(deadline);provider.disconnect();await exited;}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
