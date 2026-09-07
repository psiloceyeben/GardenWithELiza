// DOM HUD. All strings come from content/copy.json (bible §6.1). No numbers about anything but Sap.
import type { Plant, Species } from '@shared/types';
import * as E from '@shared/economy';
import { COPY, TIER_NAME, MUTATION_NAME, MUTATION_FLAVOR, speciesById } from '../content';
import type { GardenScene } from '../scenes/GardenScene';

type PanelId = 'conveyor' | 'seeds' | 'shop' | 'odds';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export class Hud {
  private open_: PanelId | null = null;
  private toastTimer = 0;
  private revealQueue: { plant: Plant; species: Species }[] = [];

  constructor(private scene: GardenScene) {
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#bar button'))) {
      b.addEventListener('click', () => { const id = b.dataset.panel as PanelId; this.open_ === id ? this.close() : this.open(id); });
    }
    $('panel-close').addEventListener('click', () => this.close());
    $("btn-conveyor").textContent = COPY.conveyorShort;
    $("btn-seeds").textContent = COPY.bag;
    $('btn-shop').textContent = COPY.shop;
    $('btn-odds').textContent = COPY.odds;
  }

  fmtTime(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }
  fmtNum(n: number): string { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : Math.floor(n).toString(); }

  private iconStyle(speciesId: string, frame = 'idle0'): string {
    const r = this.scene.frameRect(`${speciesId}_${frame}`);
    return `background-position:-${r.x}px -${r.y}px`;
  }

  refresh(): void {
    const st = this.scene.state;
    let sps = 0;
    for (const p of st.plots) if (p.plant) sps += E.sapPerSec(p.plant, speciesById(p.plant.speciesId));
    $('sap').textContent = this.fmtNum(st.sap);
    $('sps').textContent = (Math.round(sps * 100) / 100).toString();
    $('plots').textContent = `${st.plots.filter((p) => p.plant).length}/${st.plots.length}`;
    if (this.open_) this.render(this.open_);
  }

  open(id: PanelId): void { this.open_ = id; $('panel').hidden = false; this.render(id); }
  close(): void { this.open_ = null; $('panel').hidden = true; }

  toast(msg: string, ms = 2500): void {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('on'), ms);
  }

  private render(id: PanelId): void {
    const st = this.scene.state; const body = $('panel-body'); const title = $('panel-title');
    if (id === 'conveyor') {
      title.textContent = `${COPY.conveyor} · ${COPY.conveyorRefresh} ${this.fmtTime(st.conveyor.refreshAt - Date.now())}`;
      body.innerHTML = `<div class="slots">${st.conveyor.slots.map((s, i) => {
        const sp = speciesById(s.speciesId); const can = st.sap >= s.price && !s.sold;
        return `<div class="slot ${s.sold ? 'sold' : ''}"><div class="icon" style="${this.iconStyle(sp.id)}"></div><div><div class="name">${sp.name}</div><div class="tier t-${sp.tier}">${TIER_NAME[sp.tier]}</div></div>
          <div class="buy"><span class="price">${s.price} ${COPY.sap}</span><button data-buy="${i}" ${can ? '' : 'disabled'}>${s.sold ? COPY.soldOut : COPY.buy}</button></div></div>`;
      }).join('')}</div>`;
      body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => this.scene.buySeed(Number(b.dataset.buy))));
    } else if (id === 'seeds') {
      title.textContent = COPY.seeds;
      if (!st.seeds.length) { body.innerHTML = `<div class="note">${COPY.emptySeeds}</div>`; return; }
      body.innerHTML = `<div class="note">${COPY.plantPrompt}</div><div class="seeds">${st.seeds.map((s) => {
        const sp = speciesById(s.speciesId);
        return `<div class="seed ${this.scene.selectedSeed === s.uid ? 'sel' : ''}" data-seed="${s.uid}"><div class="icon" style="${this.iconStyle(sp.id, 'grow2')}"></div><div>${sp.name}</div><div class="t-${sp.tier}">${TIER_NAME[sp.tier]}</div></div>`;
      }).join('')}</div>`;
      body.querySelectorAll<HTMLElement>('[data-seed]').forEach((el) => el.addEventListener('click', () => this.scene.selectSeed(el.dataset.seed!)));
    } else if (id === 'shop') {
      title.textContent = COPY.trainSprint;
      const lvl = st.speedLevel; const max = lvl >= E.SPEED_MAX_LEVEL; const cost = E.speedCost(lvl);
      body.innerHTML = `<div class="note">${COPY.trainDesc}</div><div class="row"><span>Level ${lvl} / ${E.SPEED_MAX_LEVEL}</span><span>x${E.speedMult(lvl).toFixed(2)}</span></div>
        <div class="row"><span class="price">${max ? COPY.trainMax : `${cost} ${COPY.sap}`}</span><button id="train" ${max || st.sap < cost ? 'disabled' : ''}>${COPY.buy}</button></div>`;
      body.querySelector('#train')?.addEventListener('click', () => this.scene.trainSpeed());
    } else {
      title.textContent = COPY.oddsTitle;
      body.innerHTML = `<div class="note">${COPY.oddsTiers}</div>${E.TIERS.map((t) => `<div class="row"><span class="t-${t}">${TIER_NAME[t]}</span><span>${(E.TIER_ODDS[t] * 100).toFixed(1)}%</span></div>`).join('')}
        <div class="note">${COPY.oddsMutations}</div>${E.MUTATIONS.map((m) => `<div class="row"><span class="m-${m.id}">${MUTATION_NAME[m.id]}${m.id !== 'none' ? ` x${m.mult}` : ''}</span><span>${(m.odds * 100).toFixed(1)}%</span></div>`).join('')}
        <div class="note">${COPY.oddsNote}</div>`;
    }
  }

  reveal(plant: Plant, species: Species): void {
    this.revealQueue.push({ plant, species });
    if (this.revealQueue.length === 1) this.showReveal();
  }

  private showReveal(): void {
    const item = this.revealQueue[0];
    if (!item) { $('modal').hidden = true; return; }
    const { plant, species } = item;
    const sps = Math.round(E.sapPerSec(plant, species) * 100) / 100;
    $('modal-card').innerHTML = `<p class="t-${plant.tier}">${COPY.revealTitle}</p><div class="icon" style="${this.iconStyle(species.id)}"></div>
      <h3>${species.name}</h3><p class="t-${plant.tier}">${TIER_NAME[plant.tier]}</p>
      <p>${COPY.revealSize} ${plant.size.toFixed(2)}</p>
      <p class="m-${plant.mutation}">${plant.mutation === 'none' ? COPY.revealNone : `${COPY.revealMutation}: ${MUTATION_NAME[plant.mutation]} x${E.mutationMult(plant.mutation)}`}</p>
      <p>${plant.mutation === 'none' ? species.flavor : MUTATION_FLAVOR[plant.mutation]}</p>
      <p class="price">${sps} ${COPY.sapPerSec}</p><button id="modal-ok">${COPY.revealClose}</button>`;
    $('modal').hidden = false;
    $('modal-ok').addEventListener('click', () => { this.revealQueue.shift(); this.showReveal(); });
  }
}
