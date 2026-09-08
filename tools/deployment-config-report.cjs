// Box C only; read configuration, never change a service or print secret values.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
assert(process.platform==='linux' && path.resolve(__dirname,'..')==='/opt/pons','Box C only');
try{
  const args=process.argv.slice(2);assert(args.length<=1,'Unexpected arguments');
  const service=args[0]?.replace(/^--service=/,'');
  let env=process.env;
  if(service){
    assert(args[0].startsWith('--service=') && ['pons-server.service','pons-hd2d-preview.service'].includes(service),'Unsupported service');
    const pid=()=>execFileSync('systemctl',['show',service,'--property=MainPID','--value'],{encoding:'utf8',timeout:5000}).trim();
    const selected=pid();assert(/^[1-9][0-9]*$/.test(selected),'Service not running');
    assert(fs.readlinkSync(`/proc/${selected}/cwd`)==='/opt/pons','Unexpected service directory');
    const command=fs.readFileSync(`/proc/${selected}/cmdline`,'utf8').split('\0');
    assert(command.some(a=>a==='/opt/pons/server/dist/server/src/index.js'),'Unexpected service entry');
    env=Object.fromEntries(fs.readFileSync(`/proc/${selected}/environ`,'utf8').split('\0').filter(s=>s.startsWith('PONS_')).map(s=>{
      const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];
    }));
    assert(pid()===selected,'Service changed during inspection');
  }
  const {deploymentConfig}=require('../server/dist/server/src/deployment-config.js');
  const report=deploymentConfig(env);
  console.log(JSON.stringify({scope:service??'current-process-environment',...report},null,2));
  process.exitCode=report.status==='configuration-incomplete'?2:0;
}catch{console.error('Configuration report failed; verify the service, access and compiled tools. No environment values printed.');process.exitCode=1;}
