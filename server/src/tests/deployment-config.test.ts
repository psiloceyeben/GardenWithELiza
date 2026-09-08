import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentConfig } from '../deployment-config';
test('deployment configuration report is secret-free and never claims release readiness',()=>{
  const empty=deploymentConfig({});assert.equal(empty.status,'configuration-incomplete');
  const valid={PONS_RPC_URL:'https://rpc.invalid/private-key',PONS_TOKEN:'0x'+'3'.repeat(40),PONS_CHAIN_ID:'1',PONS_FROM_BLOCK:'0',
    PONS_BROKER_NFT:'0x'+'4'.repeat(40),PONS_BROKER_FROM_BLOCK:'0',PONS_DATABASE_URL:'postgresql://user:secret@localhost/garden',
    PONS_DATABASE_SCHEMA_MODE:'runtime',PONS_PUBLIC_BASE:'https://garden.invalid/ponsgarden'};
  const result=deploymentConfig(valid);assert.equal(result.status,'configuration-present-not-verified');assert(result.requiredEvidence.length>0);
  assert(!JSON.stringify(result).includes('private-key'));assert(!JSON.stringify(result).includes('secret@'));
  assert.equal(deploymentConfig({...valid,PONS_DATABASE_URL:undefined,PONS_DATABASE_URL_FILE:'/run/credentials/game/database-url'}).status,'configuration-present-not-verified');
  assert.equal(deploymentConfig({...valid,PONS_DATABASE_URL_FILE:'/run/credentials/game/database-url'}).status,'configuration-incomplete');
  for(const patch of [{PONS_DATABASE_SCHEMA_MODE:'bootstrap'},{PONS_IMPORT_LEGACY:'1'},{PONS_PUBLIC_BASE:'http://garden.invalid'},
    {PONS_RPC_URL:'https://[invalid/private-key'},{PONS_DATABASE_URL:'invalid-secret@'}, {PONS_BROKER_FROM_BLOCK:' '}]){
    const report=deploymentConfig({...valid,...patch});assert.equal(report.status,'configuration-incomplete');
    assert(!JSON.stringify(report).includes('private-key'));assert(!JSON.stringify(report).includes('secret@'));
  }
});
