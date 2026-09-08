// Box C only. Compile current sources and retain aggregate test evidence.
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const root=path.resolve(__dirname,'..');
if(process.platform!=='linux' || root!=='/opt/pons')throw Error('Run only on Box C /opt/pons');
const database=process.argv.find(a=>a.startsWith('--database='))?.slice(11);
if(!database)throw Error('Supply isolated PostgreSQL admin URL with --database=');
const parsed=new URL(database);
if(parsed.hostname!=='localhost' || !parsed.searchParams.get('host')?.startsWith('/opt/pons/pg-check.'))throw Error('Only isolated pg-check socket databases are allowed');
const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('PONS_'))delete env[key];
env.PONS_TEST_DATABASE_URL=database;
const directory=fs.mkdtempSync('/tmp/pons-regression-'),results=[];
async function run(name,args) {
 const start=Date.now();
 await new Promise((resolve,reject)=>execFile(process.execPath,args,{cwd:root,env,maxBuffer:16*1024*1024},(error,stdout,stderr)=>{
   fs.writeFileSync(path.join(directory,name+'.log'),stdout+'\n'+stderr);
   const skipped=Number(stdout.match(/# skipped (\d+)/)?.[1]??0);
   results.push({name,passed:!error && skipped===0,skipped,tests:Number(stdout.match(/# tests (\d+)/)?.[1]??0),ms:Date.now()-start});
   fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(results,null,2));
   console.log(JSON.stringify(results.at(-1)));
   if(error || skipped)reject(Error(name+' failed; see '+path.join(directory,name+'.log')));else resolve();
 }));
}
(async()=>{
 console.log(JSON.stringify({directory,node:process.version}));
 await run('server-compile',['node_modules/typescript/bin/tsc','-p','server/tsconfig.json']);
 await run('client-typecheck',['node_modules/typescript/bin/tsc','--noEmit','-p','client/tsconfig.json']);
 await run('copy-lint',['tools/lint-copy.js']);
 const server=fs.readdirSync(path.join(root,'server/dist/server/src/tests')).filter(n=>n.endsWith('.test.js')).sort().map(n=>'server/dist/server/src/tests/'+n);
 await run('server-suite',['--test',...server]);
 for(const file of fs.readdirSync(path.join(root,'tools')).filter(n=>n.endsWith('.test.ts')).sort()) {
   const name=file.slice(0,-8),bundle=path.join(directory,name+'.cjs');
   await run(name+'-compile',['node_modules/esbuild/bin/esbuild','tools/'+file,'--bundle','--platform=node','--tsconfig=client/tsconfig.json','--outfile='+bundle]);
   await run(name,[bundle]);
 }
 console.log(JSON.stringify({directory,result:'PASS aggregate source compile, copy lint, server and tool tests'}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
