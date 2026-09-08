// Optional acceleration data, never an authority for chain state.
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, lstat, open, writeFile, rename, unlink, rmdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, parse, join } from 'node:path';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const CHECKPOINT_FILE_BYTES = 4 * 1024 * 1024;
export interface CheckpointAccess {
  load(key: string): Promise<unknown | null>;
  save(key: string, value: unknown): Promise<boolean>;
}
export class CheckpointStore {
  private directory: string;
  constructor(directory: string, private maxFileBytes = CHECKPOINT_FILE_BYTES,
    private maxTotalBytes = 64 * 1024 * 1024, private maxEntries = 512) {
    this.directory = resolve(directory);
    if (this.directory === parse(this.directory).root || !directory.trim()) throw new Error('Invalid checkpoint directory');
    for (const limit of [maxFileBytes, maxTotalBytes, maxEntries]) {
      if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid checkpoint limit');
    }
  }
  private file(key: string): string { return join(this.directory, hash(key) + '.json'); }
  async load(key: string): Promise<unknown | null> {
    try { const payload=await this.loadSerialized(key);return payload===null?null:JSON.parse(payload); }
    catch {return null;}
  }
  /** Keep checkpoint payload parsing in the scan worker, not the game loop. */
  async loadSerialized(key: string): Promise<string | null> {
    let handle:Awaited<ReturnType<typeof open>>|undefined;
    try {
      handle=await open(this.file(key),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
      const info = await handle.stat();
      if (!info.isFile() || info.size > this.maxFileBytes) return null;
      // Bound the actual read, not just a pathname stat vulnerable to replacement.
      const buffer=Buffer.alloc(this.maxFileBytes+1);
      let used=0;
      while(used<buffer.length){const {bytesRead}=await handle.read(buffer,used,buffer.length-used,null);if(!bytesRead)break;used+=bytesRead;}
      if(used>this.maxFileBytes)return null;
      const envelope = JSON.parse(buffer.subarray(0,used).toString('utf8'));
      if (envelope.version !== 1 || envelope.key !== hash(key) || typeof envelope.payload !== 'string'
        || envelope.digest !== hash(envelope.payload)) return null;
      return envelope.payload;
    } catch { return null; }
    finally {await handle?.close().catch(()=>undefined);}
  }
  // Serialize admission/write accounting within this instance, across wallets.
  private writes: Promise<unknown> = Promise.resolve();
  save(key: string, value: unknown): Promise<boolean> {
    try {
      const payload=JSON.stringify(value);
      return payload===undefined?Promise.resolve(false):this.saveSerialized(key,payload);
    } catch {return Promise.resolve(false);}
  }
  /** Serialized by the trusted scan worker; still bounded before admission. */
  saveSerialized(key: string, payload: string): Promise<boolean> {
    if(typeof payload!=='string' || Buffer.byteLength(payload)>this.maxFileBytes)return Promise.resolve(false);
    const task = this.writes.then(() => this.write(key, payload));
    this.writes = task.catch(() => undefined); return task;
  }
  private async write(key: string, payload: string): Promise<boolean> {
    let temporary: string | undefined;
    let locked=false;
    const lock=join(this.directory,'.write-lock');
    try {
      const body = JSON.stringify({ version: 1, key: hash(key), payload, digest: hash(payload) });
      const bytes = Buffer.byteLength(body); if (bytes > this.maxFileBytes) return false;
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      // Atomic across processes. Contention skips optional cache writes. Never
      // steal an old lock: a paused writer could otherwise resume past quotas.
      await mkdir(lock,{mode:0o700});locked=true;
      const file = this.file(key), names = (await readdir(this.directory)).filter(n => /^[a-f0-9]{64}\.json$/.test(n));
      let total = 0, current = 0;
      for (const name of names) {
        const info = await lstat(join(this.directory, name));
        if (!info.isFile()) return false;
        total += info.size; if (join(this.directory, name) === file) current = info.size;
      }
      if ((!current && names.length >= this.maxEntries) || total - current + bytes > this.maxTotalBytes) return false;
      temporary = file + '.' + randomBytes(12).toString('hex') + '.tmp';
      await writeFile(temporary, body, { flag: 'wx', mode: 0o600 });
      await rename(temporary, file); temporary = undefined; return true;
    } catch { return false; }
    finally {
      if (temporary) await unlink(temporary).catch(() => undefined);
      if(locked)await rmdir(lock).catch(()=>undefined);
    }
  }
}
