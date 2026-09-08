import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

export interface LedgerEntry { id: string; at: number; playerId: string; delta: number; reason: string; }
export interface Snapshot { players: Record<string, unknown>; villages: Record<string, unknown>; }
export interface Persistence {
  readonly kind: string;
  load(): Promise<Snapshot | null>;
  save(snapshot: Snapshot, ledger: LedgerEntry[]): Promise<void>;
  close(): Promise<void>;
}

/** Development fallback: one fsynced file keeps both maps and the ledger consistent. */
export class FilePersistence implements Persistence {
  readonly kind = 'file';
  private ledger: LedgerEntry[] = [];
  constructor(private dir: string) { fs.mkdirSync(dir, { recursive: true }); }
  async load(): Promise<Snapshot | null> {
    const file = path.join(this.dir, 'snapshot.json');
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.version !== 1 || !data.players || !data.villages || !Array.isArray(data.ledger)) throw new Error('Invalid saved snapshot');
    this.ledger = data.ledger;
    return { players: data.players, villages: data.villages };
  }
  async save(snapshot: Snapshot, entries: LedgerEntry[]): Promise<void> {
    const ledger = [...this.ledger, ...entries];
    const file = path.join(this.dir, 'snapshot.json'), temp = file + '.tmp';
    const fd = fs.openSync(temp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify({ version: 1, ...snapshot, ledger })); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
    const directory = fs.openSync(this.dir, 'r');
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    this.ledger = ledger;
  }
  async close(): Promise<void> {}
}

/** One authoritative simulation writer per database. No credentials are logged. */
export class PostgresPersistence implements Persistence {
  readonly kind = 'postgres';
  private client: Client;
  private failure: Error | null = null;
  constructor(connectionString: string, private schemaMode: 'bootstrap'|'runtime' = 'bootstrap') {
    if(schemaMode!=='bootstrap' && schemaMode!=='runtime')throw new Error('Invalid database schema mode');
    this.client = new Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 15000, application_name: 'pons-garden' });
    this.client.on('error', () => { this.failure = new Error('Database connection lost; restart required'); });
  }
  async load(): Promise<Snapshot | null> {
    await this.client.connect();
    // Server-side limits are shorter than the driver's 15-second deadline.
    // Limits are session-local, so migrations/admin connections remain separate.
    await this.client.query(`SET statement_timeout = '10s'; SET lock_timeout = '3s';
      SET idle_in_transaction_session_timeout = '20s'; SET synchronous_commit = on;`);
    const lock = await this.client.query('SELECT pg_try_advisory_lock(706667, 1) AS held');
    if (!lock.rows[0].held) { await this.client.end(); throw new Error('Another Pons Garden writer owns this database'); }
    if(this.schemaMode==='bootstrap')await this.client.query(`
      CREATE SCHEMA IF NOT EXISTS pons;
      CREATE TABLE IF NOT EXISTS pons.meta (id boolean PRIMARY KEY DEFAULT true CHECK(id), version integer NOT NULL);
      CREATE TABLE IF NOT EXISTS pons.players (id text PRIMARY KEY, data jsonb NOT NULL);
      CREATE TABLE IF NOT EXISTS pons.villages (id text PRIMARY KEY, data jsonb NOT NULL);
      CREATE TABLE IF NOT EXISTS pons.ledger (id text PRIMARY KEY, at_ms bigint NOT NULL, player_id text NOT NULL, delta double precision NOT NULL, reason text NOT NULL);
      CREATE INDEX IF NOT EXISTS pons_ledger_player_time ON pons.ledger(player_id, at_ms);
      CREATE OR REPLACE FUNCTION pons.prevent_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Sap ledger is append-only'; END $$;
      DROP TRIGGER IF EXISTS immutable_ledger ON pons.ledger;
      CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE OR TRUNCATE ON pons.ledger
      FOR EACH STATEMENT EXECUTE FUNCTION pons.prevent_ledger_mutation();
    `);
    const guard=await this.client.query(`SELECT count(*)::int AS n FROM pg_trigger t
      JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE t.tgrelid='pons.ledger'::regclass AND t.tgname='immutable_ledger'
      AND t.tgenabled IN ('O','A') AND t.tgtype=58 AND NOT t.tgisinternal
      AND n.nspname='pons' AND p.proname='prevent_ledger_mutation'`);
    if(guard.rows[0].n!==1)throw new Error('Database ledger protection is missing or disabled');
    const meta = await this.client.query('SELECT version FROM pons.meta WHERE id');
    if (!meta.rowCount) {
      const existing = await this.client.query('SELECT (SELECT count(*) FROM pons.players) + (SELECT count(*) FROM pons.villages) + (SELECT count(*) FROM pons.ledger) AS n');
      if (Number(existing.rows[0].n)) throw new Error('Unversioned database contains data; refusing automatic import');
      return null;
    }
    if (meta.rows[0].version !== 1) throw new Error('Unsupported database schema version');
    const players = await this.client.query('SELECT id, data FROM pons.players');
    const villages = await this.client.query('SELECT id, data FROM pons.villages');
    return { players: Object.fromEntries(players.rows.map(r => [r.id, r.data])), villages: Object.fromEntries(villages.rows.map(r => [r.id, r.data])) };
  }
  async save(snapshot: Snapshot, ledger: LedgerEntry[]): Promise<void> {
    if (this.failure) throw this.failure;
    await this.client.query('BEGIN');
    try {
      for (const table of ['players', 'villages'] as const) {
        await this.client.query(`INSERT INTO pons.${table}(id,data)
          SELECT key,value FROM jsonb_each($1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data
          WHERE pons.${table}.data IS DISTINCT FROM EXCLUDED.data`, [JSON.stringify(snapshot[table])]);
        await this.client.query(`DELETE FROM pons.${table} WHERE NOT (id = ANY($1::text[]))`, [Object.keys(snapshot[table])]);
      }
      if (ledger.length) await this.client.query(`INSERT INTO pons.ledger(id,at_ms,player_id,delta,reason)
        SELECT id,at,"playerId",delta,reason FROM jsonb_to_recordset($1::jsonb)
        AS x(id text,at bigint,"playerId" text,delta double precision,reason text)
        ON CONFLICT(id) DO NOTHING`, [JSON.stringify(ledger)]);
      await this.client.query('INSERT INTO pons.meta(id,version) VALUES(true,1) ON CONFLICT(id) DO NOTHING');
      await this.client.query('COMMIT');
    } catch (error) {
      try { await this.client.query('ROLLBACK'); } catch { this.failure = new Error('Database transaction connection lost'); }
      throw error;
    }
  }
  async close(): Promise<void> { await this.client.end(); }
}
