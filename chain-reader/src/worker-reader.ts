import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import {checkedAddress} from './history';
import {CheckpointStore,CHECKPOINT_FILE_BYTES} from './checkpoint-store';
import type {ChainReader,RpcConfig} from './index';
import type {ChainSnapshot} from '../../shared/derive/types';

/** One isolated worker per admitted scan; CachedReader controls admission/concurrency. */
export class WorkerRpcReader implements ChainReader {
  readonly kind='rpc-worker';
  private checkpoints?:CheckpointStore;
  private checkpointOperations=0;
  constructor(private cfg:RpcConfig,private timeoutMs=300_000){
    if(!Number.isSafeInteger(timeoutMs) || timeoutMs<1 || timeoutMs>1_800_000)throw new Error('Invalid chain scan timeout');
    if(cfg.historyDirectory!==undefined)this.checkpoints=new CheckpointStore(cfg.historyDirectory);
  }
  snapshot(address:string):Promise<ChainSnapshot>{
    const wallet=checkedAddress(address);
    return new Promise((resolve,reject)=>{
      const worker=new Worker(join(__dirname,'rpc-worker.js'),{
        // Disk writes belong to this process, so terminating the worker cannot
        // abandon its checkpoint write lock. No directory is sent to the worker.
        workerData:{cfg:{...this.cfg,historyDirectory:undefined},address:wallet,checkpoints:!!this.checkpoints},
        resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32,stackSizeMb:4},
      });
      let settled=false;
      const finish=(snapshot?:ChainSnapshot,error='Chain read worker failed')=>{
        if(settled)return;settled=true;clearTimeout(timer);
        // Do not release the scan slot while its worker is still alive.
        void worker.terminate().then(()=>{if(snapshot)resolve(snapshot);else reject(new Error(error));},()=>reject(new Error('Chain read worker failed')));
      };
      const timer=setTimeout(()=>finish(undefined,'Chain scan timed out'),this.timeoutMs);
      worker.on('message',message=>{
        if(settled)return;
        if(message?.t==='checkpoint'){
          if(!this.checkpoints || !Number.isSafeInteger(message.id) || typeof message.key!=='string' || message.key.length>4096)return finish();
          if(message.op!=='load' && (message.op!=='save' || typeof message.payload!=='string' || Buffer.byteLength(message.payload)>CHECKPOINT_FILE_BYTES))return finish();
          // A slow disk can outlive a scan timeout. Bound retained operations
          // independently of scan slots; cache misses never skip RPC validation.
          if(this.checkpointOperations>=2){worker.postMessage({t:'checkpoint-result',id:message.id,value:message.op==='load'?null:false});return;}
          this.checkpointOperations++;
          const operation:Promise<string|null|boolean>=message.op==='load'
            ?this.checkpoints.loadSerialized(message.key):this.checkpoints.saveSerialized(message.key,message.payload);
          // Complete admitted disk work even after timeout/worker exit. Each
          // operation owns its normal finally/lock cleanup in this process.
          void operation.then(value=>{if(!settled)worker.postMessage({t:'checkpoint-result',id:message.id,value});})
            .catch(()=>{if(!settled)finish();})
            .finally(()=>{this.checkpointOperations--;});
          return;
        }
        if(message?.ok===true && message.snapshot?.address===wallet)finish(message.snapshot);
        else finish();
      });
      worker.once('error',()=>finish());
      worker.once('exit',()=>finish());
    });
  }
}
