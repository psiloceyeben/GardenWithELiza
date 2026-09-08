import type { ClientMsg, ServerMsg } from '@shared/protocol';
import { SESSION_REPLACED_CLOSE, IDENTITY_REJECTED_CLOSE } from '@shared/protocol';
export type DisconnectReason = 'session-replaced' | 'identity-rejected';

export interface Identity { id: string; secret: string; name: string; }
const ID_KEY = 'pons.identity.v1';

function hex(n: number): string { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); }

export function loadIdentity(): Identity | null {
  try { const raw = localStorage.getItem(ID_KEY); return raw ? JSON.parse(raw) as Identity : null; } catch { return null; }
}
export function saveIdentity(id: Identity): void { try { localStorage.setItem(ID_KEY, JSON.stringify(id)); } catch { /* ignore */ } }
/** Explicit recovery action only; never erase a newer login saved by another tab. */
export function discardRejectedIdentity(expected:Identity,storage?:Pick<Storage,'getItem'|'removeItem'>):boolean {
  try {
    const target=storage??localStorage;
    const raw=target.getItem(ID_KEY),current=raw?JSON.parse(raw):null;
    if(current?.id===expected.id && current?.secret===expected.secret)target.removeItem(ID_KEY);
    return true;
  } catch {return false;}
}
export function newIdentity(name: string): Identity { const id = { id: hex(8), secret: hex(16), name }; saveIdentity(id); return id; }

export function wsUrl(page: Pick<Location, 'search' | 'pathname' | 'protocol' | 'host' | 'hostname'> = location): string {
  const base = page.pathname.replace(/[^/]*$/, '');
  const fallback = `${page.protocol === 'https:' ? 'wss' : 'ws'}://${page.host}${base}ws`;
  // A URL parameter must never redirect a production player's bearer identity.
  // Keep the separate-port local preview, restricted to the same loopback host.
  if (page.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname)) {
    try {
      const q = new URLSearchParams(page.search).get('ws');
      if (q) {
        const target = new URL(q);
        if (target.protocol === 'ws:' && target.hostname === page.hostname && !target.username && !target.password && !target.hash) return target.href;
      }
    } catch { /* Invalid overrides fall back to the trusted endpoint. */ }
  }
  return fallback;
}

export interface NetRuntime {
  socket(url: string): WebSocket;
  schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  cancel(timer: ReturnType<typeof setTimeout>): void;
}
export class Net {
  private ws: WebSocket | null = null;
  private backoff = 1000;
  private closedByUs = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  connected = false;
  onMsg: (m: ServerMsg) => void = () => undefined;
  onOpen: () => void = () => undefined;
  onClose: (reason?: DisconnectReason) => void = () => undefined;

  constructor(private url: string, private runtime: NetRuntime = {
    socket: url => new WebSocket(url), schedule: (callback, delay) => setTimeout(callback, delay), cancel: timer => clearTimeout(timer),
  }) {}

  private clearReconnect(): void {
    if (this.reconnectTimer !== undefined) this.runtime.cancel(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }

  connect(): void {
    this.clearReconnect();
    // Repeated connect calls must not create competing live sockets.
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.closedByUs = false;
    const ws = this.runtime.socket(this.url); this.ws = ws;
    const current = () => this.ws === ws && !this.closedByUs;
    ws.onopen = () => { if (!current()) return; this.connected = true; this.backoff = 1000; this.onOpen(); };
    ws.onmessage = (ev) => { if (!current()) return; try {
      const message=JSON.parse(ev.data as string) as ServerMsg;
      // The legacy text supports older servers during paired rolling updates.
      if(message.t==='error' && (message.code==='session-replaced' || message.text==='signed in elsewhere'))this.close('session-replaced');
      else if(message.t==='error' && message.code==='identity-rejected')this.close('identity-rejected');
      else this.onMsg(message);
    } catch (e) { console.error('msg', e); } };
    ws.onclose = (ev) => {
      if (!current()) return;
      this.ws = null; this.connected = false;
      if(ev?.code===SESSION_REPLACED_CLOSE){this.closedByUs=true;this.onClose('session-replaced');return;}
      if(ev?.code===IDENTITY_REJECTED_CLOSE){this.closedByUs=true;this.onClose('identity-rejected');return;}
      this.onClose();
      // onClose may deliberately stop or replace the connection.
      if (!this.closedByUs && !this.ws) {
        this.reconnectTimer = this.runtime.schedule(() => {
          this.reconnectTimer = undefined;
          if (!this.closedByUs && !this.ws) this.connect();
        }, this.backoff);
        this.backoff = Math.min(10000, this.backoff * 1.7);
      }
    };
    ws.onerror = () => undefined;
  }

  send(m: ClientMsg): void { if (this.connected && this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }
  close(reason?: DisconnectReason): void {
    this.closedByUs = true; this.clearReconnect();
    const ws = this.ws; this.ws = null;
    const wasActive = this.connected || !!ws; this.connected = false;
    ws?.close();
    if (wasActive) this.onClose(reason);
  }
}
