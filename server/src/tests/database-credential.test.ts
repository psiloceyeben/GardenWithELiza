import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {databaseConnectionFromEnv as read} from '../database-credential';
test('database credentials support private files and reject unsafe or ambiguous sources without leaking values',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pons-credential-test-')),file=path.join(dir,'credential');
  const value='postgresql://user:private-password@localhost/garden';
  fs.writeFileSync(file,value+'\n',{mode:0o600});
  assert.equal(read({}),undefined);assert.equal(read({PONS_DATABASE_URL:value}),value);
  assert.equal(read({PONS_DATABASE_URL_FILE:file}),value);
  const rejected=(env:Record<string,string>)=>assert.throws(()=>read(env),error=>error instanceof Error
    && !error.message.includes('private-password') && !error.message.includes(dir) && !('cause' in error) && !('input' in error));
  rejected({PONS_DATABASE_URL:value,PONS_DATABASE_URL_FILE:file});
  rejected({PONS_DATABASE_URL_FILE:'relative'});rejected({PONS_DATABASE_URL_FILE:dir});
  const link=path.join(dir,'link');fs.symlinkSync(file,link);rejected({PONS_DATABASE_URL_FILE:link});
  fs.chmodSync(file,0o644);rejected({PONS_DATABASE_URL_FILE:file});fs.chmodSync(file,0o600);
  if(process.platform==='linux' && process.geteuid!()===0){
    fs.chmodSync(file,0o400);
    execFileSync('/usr/bin/setfacl',['-m',`u:${process.geteuid!()}:r--`,file]);
    assert.equal(read({PONS_DATABASE_URL_FILE:file}),value);
    execFileSync('/usr/bin/setfacl',['-m','u:12345:r--',file]);rejected({PONS_DATABASE_URL_FILE:file});
    execFileSync('/usr/bin/setfacl',['-b',file]);fs.chmodSync(file,0o600);
  }
  for(const contents of ['', ' ', 'https://[invalid/private-password','x'.repeat(8193)]){
    fs.writeFileSync(file,contents);rejected({PONS_DATABASE_URL_FILE:file});
  }
  rejected({PONS_DATABASE_URL:''});rejected({PONS_DATABASE_URL:'https://[invalid/private-password'});
});
