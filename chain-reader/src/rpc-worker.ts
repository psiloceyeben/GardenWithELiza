import {parentPort,workerData} from 'node:worker_threads';
import {RpcReader} from './index';
import {CHECKPOINT_FILE_BYTES,type CheckpointAccess} from './checkpoint-store';

if(parentPort){
  const port=parentPort;
  let nextId=0;
  const pending=new Map<number,(value:unknown)=>void>();
  port.on('message',message=>{
    if(message?.t!=='checkpoint-result')return;
    const resolve=pending.get(message.id);pending.delete(message.id);resolve?.(message.value);
  });
  const request=(op:'load'|'save',key:string,payload?:string)=>new Promise<unknown>(resolve=>{
    const id=++nextId;pending.set(id,resolve);port.postMessage({t:'checkpoint',id,op,key,payload});
  });
  const checkpoints:CheckpointAccess|undefined=workerData.checkpoints?{
    async load(key){
      const payload=await request('load',key);
      try{return typeof payload==='string'?JSON.parse(payload):null;}catch{return null;}
    },
    async save(key,value){
      const payload=JSON.stringify(value);
      if(payload===undefined || Buffer.byteLength(payload)>CHECKPOINT_FILE_BYTES)return false;
      return await request('save',key,payload)===true;
    },
  }:undefined;
  void (async()=>{
    try{
      const snapshot=await new RpcReader(workerData.cfg,checkpoints).snapshot(workerData.address);
      port.postMessage({ok:true,snapshot});
    }catch{
      // Provider URLs, bodies and worker exception details never cross this boundary.
      port.postMessage({ok:false});
    }
  })();
}
