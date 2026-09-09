// Username and password accounts, for players with no wallet (mobile, mostly).
//
// A guest garden is purged shortly after the tab closes. That is right for somebody trying
// the game for four seconds, and wrong for somebody on a phone who wants their garden back
// tomorrow. An account is the cheapest way to give them that without asking for a wallet.
//
// PASSWORDS ARE NEVER STORED. Each account keeps a random salt and an scrypt hash. If this
// file is ever read by the wrong person they get neither the password nor anything reusable
// against the same person's email or exchange, which is what actually happens when a small
// game stores plaintext. Verification is constant-time.
//
// The account is only a lookup: username -> the id/secret pair the game already uses for
// identity. Nothing else about the player lives here.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface Account {
  username: string;        // stored lowercase; the display name is the player's own
  salt: string;
  hash: string;
  playerId: string;
  secret: string;
  kind: 'mobile';          // labelled so these are distinguishable from wallet players
  createdAt: string;
  lastLogin: string | null;
}

export const MIN_USERNAME = 3;
export const MAX_USERNAME = 16;
export const MIN_PASSWORD = 8;

/** Letters, digits, underscore. No spaces, no punctuation to typo on a phone keyboard. */
const USERNAME_RE = /^[a-z0-9_]+$/;

export type AccountError =
  | 'bad-username' | 'bad-password' | 'taken' | 'no-such-account' | 'wrong-password' | 'rate-limited';

export const normaliseUsername = (u: unknown): string => String(u ?? '').trim().toLowerCase();

export function validateUsername(u: string): AccountError | null {
  if (u.length < MIN_USERNAME || u.length > MAX_USERNAME) return 'bad-username';
  if (!USERNAME_RE.test(u)) return 'bad-username';
  return null;
}

export function validatePassword(p: unknown): AccountError | null {
  const s = String(p ?? '');
  // Length only. Composition rules push people toward Password1! and a sticky note.
  return s.length >= MIN_PASSWORD && s.length <= 200 ? null : 'bad-password';
}

const hashWith = (password: string, salt: string): string =>
  crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');

/** Constant-time, so a timing difference cannot leak how much of a hash matched. */
const sameHash = (a: string, b: string): boolean => {
  const ab = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export class AccountStore {
  private accounts = new Map<string, Account>();
  private attempts = new Map<string, { n: number; until: number }>();
  private readonly file: string;

  constructor(dir: string) {
    this.file = path.join(dir, 'accounts.jsonl');
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.file)) return;
    for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const a = JSON.parse(line) as Account;
        if (a.username) this.accounts.set(a.username, a);   // later lines win, so it compacts
      } catch { /* one bad line must not lose every account after it */ }
    }
  }

  /** Append-only. A crash mid-write costs the last line, never the file. */
  private append(a: Account): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(a) + '\n', { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(this.file, 0o600); } catch { /* best effort */ }
  }

  has(username: string): boolean { return this.accounts.has(username); }
  /** Reverse lookup, so the game can mark a joining record as account-owned. */
  usernameFor(playerId: string): string | undefined {
    for (const a of this.accounts.values()) if (a.playerId === playerId) return a.username;
    return undefined;
  }
  get(username: string): Account | undefined { return this.accounts.get(username); }
  get size(): number { return this.accounts.size; }

  /**
   * Five wrong guesses buys a one-minute lockout for that username. Enough to make online
   * brute force pointless, short enough that a person who mistyped is not locked out of
   * their own garden for the evening.
   */
  private rateLimited(username: string, now: number): boolean {
    const a = this.attempts.get(username);
    return !!a && a.n >= 5 && now < a.until;
  }

  private noteFailure(username: string, now: number): void {
    const a = this.attempts.get(username) ?? { n: 0, until: 0 };
    a.n += 1;
    a.until = now + 60_000;
    this.attempts.set(username, a);
  }

  register(rawUsername: unknown, password: unknown, playerId: string, secret: string, now: number):
    { ok: true; account: Account } | { ok: false; error: AccountError } {
    const username = normaliseUsername(rawUsername);
    const uErr = validateUsername(username);
    if (uErr) return { ok: false, error: uErr };
    const pErr = validatePassword(password);
    if (pErr) return { ok: false, error: pErr };
    if (this.accounts.has(username)) return { ok: false, error: 'taken' };

    const salt = crypto.randomBytes(16).toString('hex');
    const account: Account = {
      username, salt, hash: hashWith(String(password), salt),
      playerId, secret, kind: 'mobile',
      createdAt: new Date(now).toISOString(), lastLogin: null,
    };
    this.accounts.set(username, account);
    this.append(account);
    return { ok: true, account };
  }

  login(rawUsername: unknown, password: unknown, now: number):
    { ok: true; account: Account } | { ok: false; error: AccountError } {
    const username = normaliseUsername(rawUsername);
    if (this.rateLimited(username, now)) return { ok: false, error: 'rate-limited' };

    const account = this.accounts.get(username);
    if (!account) {
      // Still cost something, so a fast "no" cannot be used to enumerate usernames.
      hashWith(String(password ?? ''), 'decoy-salt-for-timing');
      this.noteFailure(username, now);
      return { ok: false, error: 'no-such-account' };
    }
    if (!sameHash(account.hash, hashWith(String(password ?? ''), account.salt))) {
      this.noteFailure(username, now);
      return { ok: false, error: 'wrong-password' };
    }

    this.attempts.delete(username);
    account.lastLogin = new Date(now).toISOString();
    this.append(account);
    return { ok: true, account };
  }
}
