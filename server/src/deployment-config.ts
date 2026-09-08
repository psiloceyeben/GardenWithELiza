import { readerFromEnv } from '../../chain-reader/src';
import { originPolicy } from './origin-policy';

/** Presence/syntax only. Never return environment values or provider errors. */
export function deploymentConfig(env: Record<string,string|undefined>) {
  const checks: {id:string;status:'present'|'missing'|'invalid';fields:string[]}[]=[];
  const check=(id:string,fields:string[],validate:()=>boolean)=>{
    if(fields.some(key=>!env[key]?.trim())){checks.push({id,status:'missing',fields});return;}
    try{checks.push({id,status:validate()?'present':'invalid',fields});}
    catch{checks.push({id,status:'invalid',fields});}
  };
  check('read-only-chain',['PONS_RPC_URL','PONS_TOKEN','PONS_CHAIN_ID','PONS_FROM_BLOCK'],()=>readerFromEnv(env).kind==='cached(rpc-worker)');
  check('broker-decoration',['PONS_BROKER_NFT','PONS_BROKER_FROM_BLOCK'],()=>readerFromEnv(env).kind==='cached(rpc-worker)');
  if(env.PONS_DATABASE_URL_FILE!==undefined)
    check('database',['PONS_DATABASE_URL_FILE'],()=>env.PONS_DATABASE_URL===undefined && env.PONS_DATABASE_URL_FILE!.startsWith('/'));
  else check('database',['PONS_DATABASE_URL'],()=>['postgres:','postgresql:'].includes(new URL(env.PONS_DATABASE_URL!).protocol));
  check('restricted-schema-mode',['PONS_DATABASE_SCHEMA_MODE'],()=>env.PONS_DATABASE_SCHEMA_MODE==='runtime');
  check('public-origin',['PONS_PUBLIC_BASE'],()=>{
    const base=new URL(env.PONS_PUBLIC_BASE!);originPolicy(env.PONS_PUBLIC_BASE!,env.PONS_ALLOWED_ORIGINS);
    return base.protocol==='https:' && !base.search && !base.hash;
  });
  checks.push({id:'legacy-import-disabled',status:env.PONS_IMPORT_LEGACY==='1'?'invalid':'present',fields:['PONS_IMPORT_LEGACY']});
  return {status:checks.every(c=>c.status==='present')?'configuration-present-not-verified':'configuration-incomplete',checks,
    requiredEvidence:[
      'Verified contract addresses/deployment blocks and known-wallet RPC comparison',
      'Broker drop-history semantics and live decoration-only acceptance',
      'Durable database service, restricted-role authentication, backup schedule and off-host restore',
      'Real wallet extension and physical-device gameplay acceptance',
      'Final art, security/load review and owner release approval',
    ]};
}
