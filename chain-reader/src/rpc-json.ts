/** Bound decoded HTTP body bytes before JSON parsing, including chunked responses.
 * This is a per-response bound, not a cap on accumulated wallet history. */
export const RPC_RESPONSE_BYTES=16*1024*1024;
export async function readRpcJson(response:Response,limit=RPC_RESPONSE_BYTES):Promise<unknown>{
  if(!Number.isSafeInteger(limit) || limit<=0)throw new Error('Invalid RPC response limit');
  if(!response.body)throw new Error('Missing RPC response body');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let bytes=0,text='';
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;
      if(bytes>limit)throw new Error('RPC response too large');
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    return JSON.parse(text);
  }catch(error){
    try{await reader.cancel();}catch{/* Preserve the original failure. */}
    throw error;
  }finally{reader.releaseLock();}
}
