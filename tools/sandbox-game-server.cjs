// Runs inside the isolated QA service, not as a public game entry point.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
assert(process.platform==='linux' && process.cwd()==='/opt/pons');
assert(process.geteuid()>0,'Sandbox must not run as root');
assert(/^\/var\/lib\/pons-sandbox-qa-[a-f0-9]{32}$/.test(process.env.PONS_DATA??''),'Only isolated QA state directories');
const status=fs.readFileSync('/proc/self/status','utf8');
assert(/^CapEff:\s+0+$/m.test(status),'Effective capabilities must be empty');
assert(/^NoNewPrivs:\s+1$/m.test(status),'NoNewPrivileges must be enforced');
const probe=path.join('/opt/pons','.sandbox-write-probe-'+randomUUID());
let created=false,denied=false;
try{fs.writeFileSync(probe,'isolated test probe',{flag:'wx',mode:0o600});created=true;}
catch(error){assert(['EROFS','EACCES','EPERM'].includes(error.code),'Unexpected code-directory probe error');denied=true;}
finally{if(created)fs.unlinkSync(probe);} // Only a file this process created with exclusive open.
assert(denied,'Sandbox can write the code directory');
assert.throws(()=>fs.accessSync('/root',fs.constants.R_OK),error=>['EACCES','EPERM'].includes(error.code));
fs.writeFileSync(path.join(process.env.PONS_DATA,'permissions-'+randomUUID()+'.json'),JSON.stringify({uid:process.geteuid(),codeWriteDenied:true,rootReadDenied:true}),{flag:'wx',mode:0o600});
console.log('PASS sandbox boundary probes: private state writable, code write denied, root read denied, no effective capabilities');
if(process.env.PONS_DATABASE_URL_FILE){
  const stat=fs.lstatSync(process.env.PONS_DATABASE_URL_FILE);
  console.log(JSON.stringify({credentialMetadata:{mode:(stat.mode&0o777).toString(8),uid:stat.uid,gid:stat.gid,size:stat.size,regular:stat.isFile(),symlink:stat.isSymbolicLink()}}));
}
require('../server/dist/server/src/index.js');
