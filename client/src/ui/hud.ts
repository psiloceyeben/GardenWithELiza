// DOM HUD. All strings come from content/copy.json (bible §6.1).
import type { Plant, Species } from '@shared/types';
import * as E from '@shared/economy';
import * as P from '@shared/protocol';
import { COPY, TIER_NAME, MUTATION_NAME, MUTATION_FLAVOR, speciesById } from '../content';
import type { WorldScene } from '../scenes/WorldScene';

type PanelId = 'conveyor' | 'seeds' | 'shop' | 'odds' | 'feed' | 'emotes' | 'land';
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export class Hud {
  private open_: PanelId | null = null;
  private toastTimer = 0;
  private revealQueue: { plant: Plant; species: Species }[] = [];
  private touch = matchMedia('(pointer: coarse)').matches;

  constructor(private scene: WorldScene) {
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#bar button'))) {
      b.addEventListener('click', () => { const id = b.dataset.panel as PanelId; this.open_ === id ? this.close() : this.open(id); });
    }
    $('panel-close').addEventListener('click', () => this.close());
    $('btn-conveyor').textContent = COPY.conveyorShort; $('btn-seeds').textContent = COPY.bag; $('btn-shop').textContent = COPY.shop;
    $('btn-feed').textContent = COPY.feed.split(' ')[1] ?? COPY.feed; $('btn-emotes').textContent = COPY.emotes; $('btn-odds').textContent = COPY.odds; $('btn-land').textContent = COPY.landTitle.split(' ')[1] ?? COPY.landTitle;
    const chat = $<HTMLInputElement>('chat'); chat.placeholder = COPY.chatPlaceholder;
    chat.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const t = chat.value.trim(); if (t) this.scene.chat(t); chat.value = ''; chat.blur(); } if (e.key === 'Escape') chat.blur(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && document.activeElement !== chat && $('modal').hidden && $('name-modal').hidden) { chat.focus(); e.preventDefault(); } });
    if (this.touch) { $('joy').hidden = false; $('act').hidden = false; this.joystick(); $('act').addEventListener('pointerdown', (e) => { e.preventDefault(); this.scene.interactNearest(); }); }
  }

  // ------------------------------------------------------------ identity
  askName(cb: (name: string) => void): void {
    const m = $('name-modal'); m.hidden = false;
    $('name-title').textContent = COPY.namePrompt; $('name-go').textContent = COPY.enter;
    const inp = $<HTMLInputElement>('name-input'); inp.focus();
    const go = () => { const n = inp.value.replace(/[^\w \-'.]/g, '').trim().slice(0, 16); if (n.length < 2) { inp.focus(); return; } m.hidden = true; cb(n); };
    $('name-go').addEventListener('click', go); inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.keyCode === 13) go(); });
  }

  // ------------------------------------------------------------ joystick (touch)
  private joystick(): void {
    const zone = $('joy'); const knob = $('joy-knob'); let active = false; let ox = 0; let oy = 0;
    const setv = (dx: number, dy: number) => { const len = Math.hypot(dx, dy); const r = 34; const c = Math.min(1, len / r); const nx = len ? dx / len : 0; const ny = len ? dy / len : 0; this.scene.joy = { x: nx * (c > 0.25 ? 1 : 0), y: ny * (c > 0.25 ? 1 : 0) }; knob.style.transform = `translate(${nx * c * r}px, ${ny * c * r}px)`; };
    zone.addEventListener('pointerdown', (e) => { active = true; ox = e.clientX; oy = e.clientY; zone.setPointerCapture(e.pointerId); e.preventDefault(); });
    zone.addEventListener('pointermove', (e) => { if (active) setv(e.clientX - ox, e.clientY - oy); });
    const end = () => { active = false; setv(0, 0); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }

  // ------------------------------------------------------------ basics
  fmtTime(ms: number): string { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }
  fmtNum(n: number): string { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : Math.floor(n).toString(); }
  private iconStyle(speciesId: string, frame = 'idle0'): string { const r = this.scene.frameRect(`${speciesId}_${frame}`); return `background-position:-${r.x}px -${r.y}px`; }

  refresh(): void {
    const you = this.scene.you; if (!you) return;
    let sps = 0; for (const p of you.plots) if (p) sps += E.sapPerSec(p, speciesById(p.speciesId));
    $('sap').textContent = this.fmtNum(you.sap); $('sps').textContent = (Math.round(sps * 100) / 100).toString();
    $('plots').textContent = `${you.plots.filter((p) => p).length}/${you.plotCount}`;
    $('village').textContent = `${this.scene.villageName} · ${this.scene.onlineCount()} ${COPY.here}`;
    const c = $('carry'); if (this.scene.carrying) { c.hidden = false; c.textContent = `${COPY.carrying} ${speciesById(this.scene.carrying).name}. ${COPY.runHome}`; } else c.hidden = true;
    if (this.open_) this.render(this.open_);
  }

  open(id: PanelId): void { this.open_ = id; $('panel').hidden = false; this.render(id); }
  close(): void { this.open_ = null; $('panel').hidden = true; }
  toast(msg: string, ms = 2500): void { const t = $('toast'); t.textContent = msg; t.classList.add('on'); window.clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => t.classList.remove('on'), ms); }

  feedRender(): void {
    const f = $('feed'); const items = this.scene.feed.slice(0, 4);
    f.innerHTML = items.map((e) => `<div class="fe fe-${e.kind}">${esc(e.text)}</div>`).join('');
    if (this.open_ === 'feed') this.render('feed');
  }
  chatLine(name: string, text: string): void {
    const c = $('chatlog'); const d = document.createElement('div'); d.innerHTML = `<b>${esc(name)}</b> ${esc(text)}`; c.appendChild(d);
    while (c.children.length > 5) c.removeChild(c.firstChild!);
    d.classList.add('on'); setTimeout(() => d.remove(), 12000);
  }

  // ------------------------------------------------------------ panels
  private render(id: PanelId): void {
    const you = this.scene.you; if (!you) return; const body = $('panel-body'); const title = $('panel-title');
    if (id === 'conveyor') {
      title.textContent = `${COPY.conveyor} · ${COPY.conveyorRefresh} ${this.fmtTime(you.conveyor.refreshAt - Date.now())}`;
      body.innerHTML = `<div class="slots">${you.conveyor.slots.map((s, i) => {
        const sp = speciesById(s.speciesId); const can = you.sap >= s.price && !s.sold;
        return `<div class="slot ${s.sold ? 'sold' : ''}"><div class="icon" style="${this.iconStyle(sp.id)}"></div><div><div class="name">${sp.name}</div><div class="tier t-${sp.tier}">${TIER_NAME[sp.tier]}</div></div>
          <div class="buy"><span class="price">${s.price} ${COPY.sap}</span><button data-buy="${i}" ${can ? '' : 'disabled'}>${s.sold ? COPY.soldOut : COPY.buy}</button></div></div>`;
      }).join('')}</div>`;
      body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => this.scene.buySeed(Number(b.dataset.buy))));
    } else if (id === 'seeds') {
      title.textContent = COPY.seeds;
      if (!you.seeds.length) { body.innerHTML = `<div class="note">${COPY.emptySeeds}</div>`; return; }
      body.innerHTML = `<div class="note">${COPY.plantPrompt}</div><div class="seeds">${you.seeds.map((s) => { const sp = speciesById(s.speciesId);
        return `<div class="seed ${this.scene.selectedSeed === s.uid ? 'sel' : ''}" data-seed="${s.uid}"><div class="icon" style="${this.iconStyle(sp.id, 'grow2')}"></div><div>${sp.name}</div><div class="t-${sp.tier}">${TIER_NAME[sp.tier]}</div></div>`; }).join('')}</div>`;
      body.querySelectorAll<HTMLElement>('[data-seed]').forEach((el) => el.addEventListener('click', () => this.scene.selectSeed(el.dataset.seed!)));
    } else if (id === 'shop') {
      title.textContent = COPY.shop;
      const lvl = you.speedLevel; const max = lvl >= E.SPEED_MAX_LEVEL; const cost = E.speedCost(lvl); const d = you.defenses;
      const row = (name: string, desc: string, price: string, btn: string, item: string, dis: boolean) => `<div class="item"><div><div class="name">${name}</div><div class="note">${desc}</div></div><div class="buy"><span class="price">${price}</span><button data-shop="${item}" ${dis ? 'disabled' : ''}>${btn}</button></div></div>`;
      body.innerHTML = row(`${COPY.trainSprint} ${lvl}/${E.SPEED_MAX_LEVEL}`, `${COPY.trainDesc} x${E.speedMult(lvl).toFixed(2)}`, max ? COPY.trainMax : `${cost} ${COPY.sap}`, COPY.buy, 'train', max || you.sap < cost)
        + row(COPY.defFence, COPY.defFenceDesc, d.gateMax ? `${COPY.gateHp} ${d.gateHp}/${d.gateMax}` : `${P.SHOP_PRICES.fence} ${COPY.sap}`, d.gateMax ? COPY.owned : COPY.buy, 'fence', !!d.gateMax || you.sap < P.SHOP_PRICES.fence)
        + (d.gateMax && d.gateHp < d.gateMax ? row(COPY.defRepair, '', `${P.SHOP_PRICES.repair} ${COPY.sap}`, COPY.buy, 'repair', you.sap < P.SHOP_PRICES.repair) : '')
        + row(COPY.defGnome, COPY.defGnomeDesc, d.gnome ? COPY.owned : `${P.SHOP_PRICES.gnome} ${COPY.sap}`, d.gnome ? COPY.owned : COPY.buy, 'gnome', d.gnome || you.sap < P.SHOP_PRICES.gnome)
        + row(COPY.defSprinkler, COPY.defSprinklerDesc, d.sprinkler ? COPY.owned : `${P.SHOP_PRICES.sprinkler} ${COPY.sap}`, d.sprinkler ? COPY.owned : COPY.buy, 'sprinkler', d.sprinkler || you.sap < P.SHOP_PRICES.sprinkler)
        + row(COPY.defLock, COPY.defLockDesc, `${P.SHOP_PRICES.lock} ${COPY.sap}`, COPY.buy, 'lock', you.sap < P.SHOP_PRICES.lock || !you.plots.some((p) => p));
      body.querySelectorAll<HTMLButtonElement>('[data-shop]').forEach((b) => b.addEventListener('click', () => this.scene.shop(b.dataset.shop as 'train')));
    } else if (id === 'feed') {
      title.textContent = COPY.feed;
      body.innerHTML = this.scene.feed.length ? this.scene.feed.map((e) => `<div class="fe fe-${e.kind}">${esc(e.text)}</div>`).join('') : `<div class="note">…</div>`;
    } else if (id === 'emotes') {
      title.textContent = COPY.emotes;
      body.innerHTML = `<div class="emotes">${P.EMOTES.map((e, i) => `<button data-emote="${i}">${e}</button>`).join('')}</div>`;
      body.querySelectorAll<HTMLButtonElement>('[data-emote]').forEach((b) => b.addEventListener('click', () => { this.scene.emote(Number(b.dataset.emote)); this.close(); }));
    } else if (id === 'land') {
      title.textContent = COPY.landTitle;
      const land = you.land; const stages = COPY.treeStages.split('|');
      const addr = land.address ? `${land.address.slice(0, 6)}…${land.address.slice(-4)}` : null;
      const share = land.address ? `${location.origin}${location.pathname.replace(/[^/]*$/, '')}garden/${land.address}` : null;
      body.innerHTML = (addr ? `<div class="row"><span>${COPY.connected}</span><span>${addr}</span></div>` : `<div class="note">${COPY.landGuest}</div>`)
        + `<div class="row"><span>${COPY.landPlots}</span><span>${you.plotCount}</span></div>`
        + `<div class="row"><span>${COPY.landFloor}</span><span class="t-${you.rarityFloor}">${TIER_NAME[you.rarityFloor]}</span></div>`
        + (addr ? `<div class="row"><span>${COPY.landTree}</span><span>${stages[land.treeStage]}</span></div><div class="row"><span>${COPY.landStumps}</span><span>${land.witherMarks}</span></div><div class="row"><span>${COPY.landHybrids}</span><span>${land.hybrids ? '✓' : '—'}</span></div>` : '')
        + `<div class="note">${COPY.connectHint}</div><div class="buy" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">`
        + (addr ? `<button id="btn-share">${COPY.share}</button><button id="btn-unlink">${COPY.disconnect}</button>` : `<button id="btn-connect">${COPY.connect}</button>`) + `</div>`;
      body.querySelector('#btn-connect')?.addEventListener('click', () => void this.scene.connectWallet());
      body.querySelector('#btn-unlink')?.addEventListener('click', () => this.scene.unlinkWallet());
      body.querySelector('#btn-share')?.addEventListener('click', () => { if (share) { navigator.clipboard?.writeText(share).catch(() => undefined); this.toast(`${COPY.shareCopied}: ${share}`, 5000); } });
    } else {
      title.textContent = COPY.oddsTitle;
      body.innerHTML = `<div class="note">${COPY.oddsTiers}</div>${E.TIERS.map((t) => `<div class="row"><span class="t-${t}">${TIER_NAME[t]}</span><span>${(E.TIER_ODDS[t] * 100).toFixed(1)}%</span></div>`).join('')}
        <div class="note">${COPY.oddsMutations}</div>${E.MUTATIONS.map((m) => `<div class="row"><span class="m-${m.id}">${MUTATION_NAME[m.id]}${m.id !== 'none' ? ` x${m.mult}` : ''}</span><span>${(m.odds * 100).toFixed(1)}%</span></div>`).join('')}
        <div class="note">${COPY.oddsNote}</div>`;
    }
  }

  reveal(plant: Plant, species: Species): void { this.revealQueue.push({ plant, species }); if (this.revealQueue.length === 1) this.showReveal(); }
  private showReveal(): void {
    const item = this.revealQueue[0]; if (!item) { $('modal').hidden = true; return; }
    const { plant, species } = item; const sps = Math.round(E.sapPerSec(plant, species) * 100) / 100;
    $('modal-card').innerHTML = `<p class="t-${plant.tier}">${COPY.revealTitle}</p><div class="icon" style="${this.iconStyle(species.id)}"></div>
      <h3>${species.name}</h3><p class="t-${plant.tier}">${TIER_NAME[plant.tier]}</p><p>${COPY.revealSize} ${plant.size.toFixed(2)}</p>
      <p class="m-${plant.mutation}">${plant.mutation === 'none' ? COPY.revealNone : `${COPY.revealMutation}: ${MUTATION_NAME[plant.mutation]} x${E.mutationMult(plant.mutation)}`}</p>
      <p>${plant.mutation === 'none' ? species.flavor : MUTATION_FLAVOR[plant.mutation]}</p><p class="price">${sps} ${COPY.sapPerSec}</p><button id="modal-ok">${COPY.revealClose}</button>`;
    $('modal').hidden = false; $('modal-ok').addEventListener('click', () => { this.revealQueue.shift(); this.showReveal(); });
  }
}
