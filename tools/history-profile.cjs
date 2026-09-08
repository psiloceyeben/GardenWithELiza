// Box C only. CPU/heap profile of local history processing, not RPC/network load.
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {orderedTransfers,reconstructHistory,topicAddress,TRANSFER_TOPIC}=require('../server/dist/chain-reader/src/history.js');
assert(typeof global.gc==='function','Run with --expose-gc for comparable heap baselines');
const wallet='0x'+'1'.repeat(40),token='0x'+'2'.repeat(40),zero='0x'+'0'.repeat(40);
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const sizes=[1000,10000,50000];
function measure(count){
  global.gc();const baseline=process.memoryUsage(),start=performance.now();
  const logs=[],timestamps=new Map();
  for(let i=1;i<=count;i++){
    logs.push({address:token,blockNumber:'0x'+i.toString(16),blockHash:word(i),transactionHash:word(i),logIndex:'0x0',
      topics:[TRANSFER_TOPIC,topicAddress(zero),topicAddress(wallet)],data:word(1),removed:false});
    timestamps.set(i,i*1000);
  }
  const built=performance.now(),inputMemory=process.memoryUsage();
  const ordered=orderedTransfers(logs,token,wallet,1,count),validated=performance.now(),orderedMemory=process.memoryUsage();
  const result=reconstructHistory(ordered,wallet,0,timestamps,(count+1)*1000,BigInt(count));
  const finished=performance.now(),finalMemory=process.memoryUsage();
  const expectedStake=count*(count+1)*500/86400000;
  assert.equal(result.ponsBalance,count);
  assert(Math.abs(result.stakeTime-expectedStake)<1e-6);
  assert.equal(result.holdStreakDays,count*1000/86400000);
  assert.equal(result.unstakeEvents.length,0);
  return {transfers:count,buildMs:built-start,validateMs:validated-built,reconstructMs:finished-validated,
    inputHeapDelta:inputMemory.heapUsed-baseline.heapUsed,orderedHeapDelta:orderedMemory.heapUsed-baseline.heapUsed,
    finalHeapDelta:finalMemory.heapUsed-baseline.heapUsed,rss:finalMemory.rss,
    processMaxRssKiB:process.resourceUsage().maxRSS,verified:true};
}
for(const size of sizes)console.log(JSON.stringify(measure(size)));
console.log('PASS synthetic transfer balance/integral/streak; timings exclude RPC, checkpoint parsing and concurrent readers');
