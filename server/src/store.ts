import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { FilePersistence, PostgresPersistence, type Persistence, type LedgerEntry, type Snapshot } from './persistence';
import { databaseConnectionFromEnv } from './database-credential';

export class Store<TPlayers, TVillages> {
  private revision = 0;
  private committed = 0;
  private pending: LedgerEntry[] = [];
  private saving: Promise<void> | null = null;
  private backend: Persistence;
  failed = false;
  lastSavedAt: number | null = null;
  get kind(): string { return this.backend.kind; }
  get dirty(): boolean { return this.revision !== this.committed || this.pending.length > 0; }
  constructor(private dir: string, public players: Map<string,TPlayers>, public villages: Map<string,TVillages>, backend?: Persistence) {
    const mode=process.env.PONS_DATABASE_SCHEMA_MODE ?? 'bootstrap';
    const connection=backend?undefined:databaseConnectionFromEnv(process.env);
    if(mode!=='bootstrap' && mode!=='runtime')throw new Error('Invalid database schema mode');
    if(process.env.PONS_DATABASE_SCHEMA_MODE!==undefined && !connection && !backend)
      throw new Error('Database schema mode requires PostgreSQL');
    this.backend = backend ?? (connection ? new PostgresPersistence(connection,mode) : new FilePersistence(dir));
  }
  async load(): Promise<void> {
    let saved = await this.backend.load();
    if (!saved) {
      const modern = path.join(this.dir, 'snapshot.json');
      const p = path.join(this.dir, 'players.json'), v = path.join(this.dir, 'villages.json'), l = path.join(this.dir, 'ledger.log');
      const legacyExists = [modern,p,v,l].some(f => fs.existsSync(f));
      if (legacyExists && this.kind === 'postgres' && process.env.PONS_IMPORT_LEGACY !== '1') throw new Error('Legacy data found: back it up and set PONS_IMPORT_LEGACY=1 for the first import');
      if (fs.existsSync(modern)) {
        const file = JSON.parse(fs.readFileSync(modern,'utf8'));
        if (file.version !== 1 || !Array.isArray(file.ledger)) throw new Error('Invalid legacy snapshot');
        saved = {players:file.players,villages:file.villages}; this.pending = file.ledger;
      } else {
        if (fs.existsSync(p) !== fs.existsSync(v)) throw new Error('Incomplete legacy save: players and villages must both exist');
        saved = { players:fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{}, villages:fs.existsSync(v)?JSON.parse(fs.readFileSync(v,'utf8')):{} };
        if(fs.existsSync(l)) this.pending=fs.readFileSync(l,'utf8').split('\n').filter(Boolean).map((line,index)=>{
          const [at,playerId,delta,...reason]=line.split('\t');
          if(!at || !playerId || !Number.isFinite(Number(at)) || !Number.isFinite(Number(delta)) || !reason.length) throw new Error('Malformed legacy ledger at line '+(index+1));
          return {id:'legacy-'+createHash('sha256').update(index+':'+line).digest('hex'),at:Number(at),playerId,delta:Number(delta),reason:reason.join('\t')};
        });
      }
      this.validate(saved);
      await this.backend.save(saved, this.pending);
      this.pending=[]; this.lastSavedAt=Date.now();
    }
    this.validate(saved);
    this.players.clear(); this.villages.clear();
    for(const [id,value] of Object.entries(saved.players))this.players.set(id,value as TPlayers);
    for(const [id,value] of Object.entries(saved.villages))this.villages.set(id,value as TVillages);
  }
  private validate(snapshot:Snapshot):void {
    for(const value of [snapshot.players,snapshot.villages])if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Invalid saved state maps');
  }
  touch():void {this.revision++;}
  ledger(playerId:string,delta:number,reason:string):void {
    if(!Number.isFinite(delta))throw new Error('Invalid Sap ledger amount');
    this.pending.push({id:randomUUID(),at:Date.now(),playerId,delta,reason});
    this.touch();
  }
  flush():Promise<void> {
    if(this.saving)return this.saving;
    if(!this.dirty)return Promise.resolve();
    const revision=this.revision, entries=this.pending.slice();
    // Freeze synchronously: simulation may continue while the database awaits I/O.
    const snapshot=JSON.parse(JSON.stringify({players:Object.fromEntries(this.players),villages:Object.fromEntries(this.villages)})) as Snapshot;
    this.saving=this.backend.save(snapshot,entries).then(()=>{
      this.pending.splice(0,entries.length);this.committed=revision;this.failed=false;this.lastSavedAt=Date.now();
    }).catch(error=>{this.failed=true;throw error;}).finally(()=>{this.saving=null;});
    return this.saving;
  }
  async close():Promise<void> {
    try {while(this.dirty || this.saving)await this.flush();}
    finally {await this.backend.close();}
  }
}
