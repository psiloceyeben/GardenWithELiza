// File-backed store for M3 dev. Interface is the seam where Postgres/Redis (bible §6.2) slot in.
// Sap changes are appended to ledger.log so dupes are auditable.
import fs from 'node:fs';
import path from 'node:path';

export class Store<TPlayers, TVillages> {
  private dirty = false;
  constructor(private dir: string, public players: Map<string, TPlayers>, public villages: Map<string, TVillages>) {
    fs.mkdirSync(dir, { recursive: true });
  }

  load(): void {
    const p = path.join(this.dir, 'players.json'); const v = path.join(this.dir, 'villages.json');
    if (fs.existsSync(p)) for (const [k, val] of Object.entries(JSON.parse(fs.readFileSync(p, 'utf8')))) this.players.set(k, val as TPlayers);
    if (fs.existsSync(v)) for (const [k, val] of Object.entries(JSON.parse(fs.readFileSync(v, 'utf8')))) this.villages.set(k, val as TVillages);
  }

  touch(): void { this.dirty = true; }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.writeAtomic('players.json', Object.fromEntries(this.players));
    this.writeAtomic('villages.json', Object.fromEntries(this.villages));
  }

  ledger(playerId: string, delta: number, reason: string): void {
    fs.appendFile(path.join(this.dir, 'ledger.log'), `${Date.now()}\t${playerId}\t${delta}\t${reason}\n`, () => undefined);
  }

  private writeAtomic(name: string, data: unknown): void {
    const f = path.join(this.dir, name); const tmp = `${f}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, f);
  }
}
