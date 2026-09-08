import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function privatePermissions(fd:number,stat:fs.Stats):boolean {
  if((stat.mode&0o077)===0)return true;
  // systemd may use a named service-user ACL; its mask appears as group bits.
  if(process.platform!=='linux' || (stat.mode&0o077)!==0o040 || stat.uid!==0)return false;
  const acl=execFileSync('/usr/bin/getfacl',['--numeric','--omit-header','--access',`/proc/${process.pid}/fd/${fd}`],
    {encoding:'utf8',timeout:1000,maxBuffer:8192,stdio:['ignore','pipe','pipe']});
  const entries=acl.split('\n').map(s=>s.trim()).filter(Boolean);
  const required=['user::r--',`user:${process.geteuid!()}:r--`,'group::---','mask::r--','other::---'];
  return entries.length===required.length && required.every(line=>entries.includes(line));
}

/** Read once at startup. Never propagate file paths, URL values or parser causes. */
export function databaseConnectionFromEnv(env:Record<string,string|undefined>):string|undefined {
  const direct=env.PONS_DATABASE_URL,file=env.PONS_DATABASE_URL_FILE;
  if(direct===undefined && file===undefined)return undefined;
  if(direct!==undefined && file!==undefined)throw new Error('Choose one database credential source');
  let value=direct;
  if(file!==undefined){
    let fd:number|undefined;
    try{
      if(!path.isAbsolute(file))throw Error();
      fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
      const stat=fs.fstatSync(fd);
      if(!stat.isFile() || !privatePermissions(fd,stat) || stat.size>8192)throw Error();
      const bytes=Buffer.alloc(8193),length=fs.readSync(fd,bytes,0,bytes.length,0);
      if(length>8192)throw Error();
      value=bytes.subarray(0,length).toString('utf8').trim();
    }catch{throw new Error('Database credential file unavailable or unsafe');}
    finally{if(fd!==undefined)fs.closeSync(fd);}
  }
  try{
    if(!value?.trim() || value.length>8192)throw Error();
    const url=new URL(value);
    if(!['postgres:','postgresql:'].includes(url.protocol))throw Error();
    return value;
  }catch{throw new Error('Invalid database connection configuration');}
}
