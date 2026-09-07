import type { ClientMsg, ServerMsg } from '@shared/protocol';

export interface Identity { id: string; secret: string; name: string; }
const ID_KEY = 'pons.identity.v1';

function hex(n: number): string { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); }

export function loadIdentity(): Identity | null {
  try { const raw = localStorage.getItem(ID_KEY); return raw ? JSON.parse(raw) as Identity : null; } catch { return null; }
}
export function saveIdentity(id: Identity): void { try { localStorage.setItem(ID_KEY, JSON.stringify(id)); } catch { /* ignore */ } }
export function newIdentity(name: string): Identity { const id = { id: hex(8), secret: hex(16), name }; saveIdentity(id); return id; }

export function wsUrl(): string {
  const q = new URLSearchParams(location.search).get('ws');
  if (q) return q;
  const base = location.pathname.replace(/[^/]*$/, '');
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${base}ws`;
}

export class Net {
  private ws: WebSocket | null = null;
  private backoff = 1000;
  private closedByUs = false;
  connected = false;
  onMsg: (m: ServerMsg) => void = () => undefined;
  onOpen: () => void = () => undefined;
  onClose: () => void = () => undefined;

  constructor(private url: string) {}

  connect(): void {
    this.closedByUs = false;
    const ws = new WebSocket(this.url); this.ws = ws;
    ws.onopen = () => { this.connected = true; this.backoff = 1000; this.onOpen(); };
    ws.onmessage = (ev) => { try { this.onMsg(JSON.parse(ev.data as string) as ServerMsg); } catch (e) { console.error('msg', e); } };
    ws.onclose = () => {
      this.connected = false; this.onClose();
      if (!this.closedByUs) { setTimeout(() => this.connect(), this.backoff); this.backoff = Math.min(10000, this.backoff * 1.7); }
    };
    ws.onerror = () => undefined;
  }

  send(m: ClientMsg): void { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  close(): void { this.closedByUs = true; this.ws?.close(); }
}
