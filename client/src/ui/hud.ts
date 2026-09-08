// DOM HUD. All strings come from content/copy.json (bible §6.1).
import type { Plant, Species } from '@shared/types';
import * as E from '@shared/economy';
import * as P from '@shared/protocol';
import { COPY, TIER_NAME, MUTATION_NAME, MUTATION_FLAVOR, speciesById } from '../content';
import type { WorldScene } from '../scenes/WorldScene';
import { sfx } from '../audio';
import { detectWallets } from '../wallet';
import { MISSIONS, npcById, type MissionView } from '@shared/missions';

type PanelId = 'conveyor' | 'seeds' | 'shop' | 'odds' | 'feed' | 'emotes' | 'land' | 'villages' | 'talk';
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export class Hud {
  private open_: PanelId | null = null;
  private toastTimer = 0;
  private revealQueue: { plant: Plant; species: Species }[] = [];
  private touch = matchMedia('(pointer: coarse)').matches;

  constructor(private scene: WorldScene) {
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#bar button[data-panel]'))) {
      b.addEventListener('click', () => { const id = b.dataset.panel as PanelId; this.open_ === id ? this.close() : this.open(id); });
    }
    $('panel-close').addEventListener('click', () => this.close());
    $('btn-conveyor').textContent = COPY.conveyorShort; $('btn-seeds').textContent = COPY.bag; $('btn-shop').textContent = COPY.shop;
    $('btn-feed').textContent = COPY.feed.split(' ')[1] ?? COPY.feed; $('btn-emotes').textContent = COPY.emotes; $('btn-odds').textContent = COPY.odds; $('btn-land').textContent = COPY.landTitle.split(' ')[1] ?? COPY.landTitle;
    $('btn-zoom').addEventListener('click', () => this.scene.toggleZoom()); $('btn-zoom').textContent = COPY.zoom;
    const mute = $('btn-mute'); const paintMute = () => { mute.textContent = sfx.muted ? '♪ ' + COPY.off : '♪ ' + COPY.on; }; paintMute();
    mute.addEventListener('click', () => { sfx.unlock(); sfx.setMuted(!sfx.muted); paintMute(); });
    const chat = $<HTMLInputElement>('chat'); chat.placeholder = COPY.chatPlaceholder;
    chat.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const t = chat.value.trim(); if (t) this.scene.chat(t); chat.value = ''; chat.blur(); } if (e.key === 'Escape') chat.blur(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && document.activeElement !== chat && $('modal').hidden && $('name-modal').hidden) { chat.focus(); e.preventDefault(); } });
    if (this.touch) { $('joy').hidden = false; $('act').hidden = false; this.joystick(); $('act').addEventListener('pointerdown', (e) => { e.preventDefault(); this.scene.interactNearest(); }); }
  }

  // ------------------------------------------------------------ identity
  askName(cb: (name: string, walletId: string | null) => void): void {
    const m = $('name-modal'); m.hidden = false;
    $('name-title').textContent = COPY.signIn; $('name-go').textContent = COPY.guestEnter; $('name-or').textContent = COPY.orGuest; $('name-hint').textContent = COPY.walletHint;
    $('wallets').innerHTML = this.walletButtons();
    const inp = $<HTMLInputElement>('name-input'); inp.placeholder = COPY.namePrompt;
    const nameOf = () => inp.value.replace(/[^\w \-'.]/g, '').trim().slice(0, 16);
    const go = () => { const n = nameOf(); if (n.length < 2) { inp.focus(); return; } m.hidden = true; cb(n, null); };
    $('name-go').addEventListener('click', go); inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.keyCode === 13) go(); });
    $('wallets').querySelectorAll<HTMLButtonElement>('[data-wallet]').forEach((b) => b.addEventListener('click', () => { const n = nameOf() || `Gardener ${Math.floor(Math.random() * 900 + 100)}`; m.hidden = true; cb(n, b.dataset.wallet!); }));
  }

  /** The four wallet options; missing ones show an install link instead of a button. */
  walletButtons(): string {
    return `<div class="wallets">${detectWallets().map(({ def, installed }) => installed
      ? `<button data-wallet="${def.id}">${def.name}</button>`
      : `<span class="wallet-missing">${def.name} · ${COPY.notInstalled} <a href="${def.url}" target="_blank" rel="noopener">${COPY.install}</a></span>`).join('')}</div>`;
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
    $('village').textContent = `${this.scene.villageName}${you.visiting ? ` (${COPY.visit.toLowerCase()})` : ''} · ${this.scene.onlineCount()} ${COPY.here}`;
    const c = $('carry'); if (this.scene.carrying) { c.hidden = false; c.textContent = `${COPY.carrying} ${speciesById(this.scene.carrying).name}. ${COPY.runHome}`; } else c.hidden = true;
    if (this.open_) this.render(this.open_);
  }

  open(id: PanelId): void { this.open_ = id; $('panel').hidden = false; if (id === 'villages') this.scene.refreshVillages(); this.render(id); }
  close(): void { this.open_ = null; $('panel').hidden = true; }
  toast(msg: string, ms = 2500): void { const t = $('toast'); t.textContent = msg; t.classList.add('on'); window.clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => t.classList.remove('on'), ms); }

  /** Event banner + sprint timer; called once a second by the scene. */
  banner(now: number): void {
    const b = $('banner'); const ev = this.scene.event; const sp = this.scene.sprintStartedAt;
    const parts: string[] = [];
    if (ev) { const txt = ev.kind === 'seed_rain' ? COPY.evSeedRain : ev.kind === 'screaming_hour' ? COPY.evScreaming : COPY.evGolden; parts.push(`${txt} ${COPY.evEnds} ${this.fmtTime(ev.endsAt - now)}`); }
    if (sp) parts.push(`${COPY.sprintDone} ${((now - sp) / 1000).toFixed(1)} s`);
    b.hidden = !parts.length; b.textContent = parts.join('  ·  ');
  }

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
        + row(COPY.defLock, COPY.defLockDesc, `${P.SHOP_PRICES.lock} ${COPY.sap}`, COPY.buy, 'lock', you.sap < P.SHOP_PRICES.lock || !you.plots.some((p) => p))
        + row(COPY.defScarecrow, COPY.defScarecrowDesc, d.scarecrow ? COPY.owned : `${P.SHOP_PRICES.scarecrow} ${COPY.sap}`, d.scarecrow ? COPY.owned : COPY.buy, 'scarecrow', !!d.scarecrow || d.gnome || you.sap < P.SHOP_PRICES.scarecrow)
        + row(COPY.defMud, COPY.defMudDesc, d.mud ? COPY.owned : `${P.SHOP_PRICES.mud} ${COPY.sap}`, d.mud ? COPY.owned : COPY.buy, 'mud', !!d.mud || you.sap < P.SHOP_PRICES.mud)
        + row(COPY.defBell, COPY.defBellDesc, d.bell ? COPY.owned : `${P.SHOP_PRICES.bell} ${COPY.sap}`, d.bell ? COPY.owned : COPY.buy, 'bell', !!d.bell || you.sap < P.SHOP_PRICES.bell);
      // cosmetics (pure Sap sinks) + wardrobe
      const c = you.cosmetics; const cosRow = (label: string, item: P.CosmeticItem, owned: boolean, dis = false) => `<div class="row"><span>${label}</span><span><span class="price">${owned ? COPY.owned : `${P.COSMETIC_PRICES[item]} ${COPY.sap}`}</span> <button data-cos="${item}" ${owned || dis || you.sap < P.COSMETIC_PRICES[item] ? 'disabled' : ''}>${COPY.buy}</button></span></div>`;
      const hasGnome = d.gnome || !!d.scarecrow;
      body.innerHTML += `<div class="note">${COPY.cosmetics}</div>` + cosRow(COPY.cosFenceWood, 'fence_wood', c.fence === 'wood') + cosRow(COPY.cosFenceStone, 'fence_stone', c.fence === 'stone') + cosRow(COPY.cosFenceHedge, 'fence_hedge', c.fence === 'hedge')
        + cosRow(COPY.cosLantern, 'lantern', c.lantern) + cosRow(COPY.cosNameplate, 'nameplate', c.nameplate) + cosRow(COPY.cosPath, 'path', c.path)
        + cosRow(COPY.cosGhat0, 'ghat0', c.gnomeHat === 0, !hasGnome) + cosRow(COPY.cosGhat1, 'ghat1', c.gnomeHat === 1, !hasGnome) + cosRow(COPY.cosGhat2, 'ghat2', c.gnomeHat === 2, !hasGnome);
      const hats = COPY.hatNames.split('|'); const shirtCols = ['#3c78dc', '#d03434', '#469640', '#9646b4', '#e88228', '#3caaa0'];
      body.innerHTML += `<div class="note">${COPY.wardrobe}</div><div class="row"><span>${COPY.shirt} (${P.SHIRT_PRICE} ${COPY.sap})</span><span>${shirtCols.map((col, i) => `<button data-shirt="${i}" style="background:${col};width:22px;padding:6px 0" ${i === you.color ? 'disabled' : ''}> </button>`).join(' ')}</span></div>`
        + hats.map((h, i) => `<div class="row"><span>${h}</span><span><span class="price">${i === you.hat ? COPY.worn : P.HAT_PRICES[i] ? `${P.HAT_PRICES[i]} ${COPY.sap}` : ''}</span> <button data-hat="${i}" ${i === you.hat ? 'disabled' : ''}>${COPY.wear}</button></span></div>`).join('');
      body.querySelectorAll<HTMLButtonElement>('[data-cos]').forEach((b) => b.addEventListener('click', () => this.scene.cosmetic(b.dataset.cos as P.CosmeticItem)));
      body.querySelectorAll<HTMLButtonElement>('[data-shirt]').forEach((b) => b.addEventListener('click', () => this.scene.wardrobe(Number(b.dataset.shirt), undefined)));
      body.querySelectorAll<HTMLButtonElement>('[data-hat]').forEach((b) => b.addEventListener('click', () => this.scene.wardrobe(undefined, Number(b.dataset.hat))));
      body.querySelectorAll<HTMLButtonElement>('[data-shop]').forEach((b) => b.addEventListener('click', () => this.scene.shop(b.dataset.shop as P.ShopItem)));
    } else if (id === 'feed') {
      title.textContent = COPY.board;
      const board = this.scene.board.length ? this.scene.board.map((e, i) => `<div class="row"><span>${i + 1}. ${esc(e.name)}</span><span>${(e.ms / 1000).toFixed(2)} s</span></div>`).join('') : `<div class="note">${COPY.sprintHint}</div>`;
      const bounties = this.scene.bounties.length ? this.scene.bounties.map((b) => `<div class="row"><span class="m-screaming">${COPY.wanted}: ${esc(b.thiefName)}</span><span class="price">${b.amount} ${COPY.sap}</span></div>`).join('') : '';
      const thieves = you.stolenBy.length ? you.stolenBy.map((t) => `<div class="row"><span>${esc(t.name)}</span><button data-bounty="${t.id}" ${you.sap < 100 ? 'disabled' : ''}>${COPY.postBounty} 100</button></div>`).join('') : `<div class="note">${COPY.noThieves}</div>`;
      const tr = this.scene.trophies; const list = (xs: { name: string; n: number }[]) => xs.length ? xs.map((x) => `${esc(x.name)} ${x.n}`).join(', ') : '—';
      const trophies = tr ? `<div class="row"><span>${COPY.trophySteals}</span><span>${list(tr.steals)}</span></div><div class="row"><span>${COPY.trophyTags}</span><span>${list(tr.tags)}</span></div><div class="row"><span>${COPY.trophyHeist}</span><span>${tr.heists.length ? tr.heists.map((h) => `${esc(h.name)}: <span class="t-${h.tier}">${esc(h.species)}</span>`).join(', ') : '—'}</span></div>` : '';
      const active = Object.entries(you.missions?.active ?? {}).map(([id, p]) => { const m = MISSIONS.find((x) => x.id === id); return m ? `<div class="row"><span>${esc(m.title)} <span class="note">(${esc(npcById(m.npc)?.name ?? '')})</span></span><span>${Math.min(p, m.target)}/${m.target}</span></div>` : ''; }).join('');
      body.innerHTML = `<div class="note">${COPY.activeMissions}</div>${active || `<div class="note">${COPY.noMissions}</div>`}<div class="note">${COPY.trophies}</div>${trophies}<div class="note">${COPY.sprintBoard}</div>${board}<div class="note">${COPY.bounties}</div>${bounties}<div class="note">${COPY.recentThieves}</div>${thieves}<div class="note">${COPY.feed}</div>` + (this.scene.feed.length ? this.scene.feed.map((e) => `<div class="fe fe-${e.kind}">${esc(e.text)}</div>`).join('') : `<div class="note">…</div>`);
      body.querySelectorAll<HTMLButtonElement>('[data-bounty]').forEach((b) => b.addEventListener('click', () => this.scene.postBounty(b.dataset.bounty!, 100)));
    } else if (id === 'talk') { this.renderTalk();
    } else if (id === 'villages') {
      title.textContent = COPY.villages;
      const here = this.scene.villageId;
      body.innerHTML = (you.visiting ? `<div class="note">${COPY.youAreVisiting} ${esc(this.scene.villageName)}.</div><div class="buy" style="margin-bottom:8px"><button id="btn-home">${COPY.goHome}</button></div>` : '')
        + this.scene.villages.map((v) => `<div class="row"><span>${esc(v.name)}${v.id === you.villageId ? ' ★' : ''}</span><span>${v.online} ${COPY.here} · ${v.free} free <button data-visit="${v.id}" ${v.id === here ? 'disabled' : ''}>${v.id === you.villageId ? COPY.goHome : COPY.visit}</button></span></div>`).join('');
      body.querySelector('#btn-home')?.addEventListener('click', () => this.scene.goHome());
      body.querySelectorAll<HTMLButtonElement>('[data-visit]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.visit === you.villageId) this.scene.goHome(); else this.scene.visit(b.dataset.visit!); }));
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
        + (addr ? `<button id="btn-share">${COPY.share}</button><button id="btn-unlink">${COPY.disconnect}</button>` : this.walletButtons()) + `</div>`;
      body.querySelectorAll<HTMLButtonElement>('[data-wallet]').forEach((b) => b.addEventListener('click', () => void this.scene.connectWallet(b.dataset.wallet!)));
      const plants = you.plots.map((p, i) => p ? `<div class="row"><span>${esc(speciesById(p.speciesId).name)}</span><span><input data-nick="${i}" maxlength="14" value="${esc(p.nick ?? '')}" placeholder="${COPY.nickPrompt}" style="width:130px;padding:4px 6px;font-size:8px"></span></div>` : '').join('');
      body.innerHTML += `<div class="note">${COPY.myPlants}. ${COPY.nickHint}</div>${plants}`;
      body.querySelectorAll<HTMLInputElement>('[data-nick]').forEach((inp) => { inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { this.scene.nick(Number(inp.dataset.nick), inp.value); inp.blur(); this.toast(COPY.nickSet); } }); inp.addEventListener('change', () => this.scene.nick(Number(inp.dataset.nick), inp.value)); });
      body.querySelector('#btn-unlink')?.addEventListener('click', () => this.scene.unlinkWallet());
      body.querySelector('#btn-share')?.addEventListener('click', () => { if (share) { navigator.clipboard?.writeText(share).catch(() => undefined); this.toast(`${COPY.shareCopied}: ${share}`, 5000); } });
    } else {
      title.textContent = COPY.oddsTitle;
      body.innerHTML = `<div class="note">${COPY.oddsTiers}</div>${E.TIERS.map((t) => `<div class="row"><span class="t-${t}">${TIER_NAME[t]}</span><span>${(E.TIER_ODDS[t] * 100).toFixed(1)}%</span></div>`).join('')}
        <div class="note">${COPY.oddsMutations}</div>${E.MUTATIONS.map((m) => `<div class="row"><span class="m-${m.id}">${MUTATION_NAME[m.id]}${m.id !== 'none' ? ` x${m.mult}` : ''}</span><span>${(m.odds * 100).toFixed(1)}%</span></div>`).join('')}
        <div class="note">${COPY.oddsNote}</div>`;
    }
  }

  // ------------------------------------------------------------ town: NPC dialogue + missions
  private talkNpc: { npc: string; name: string; line: string; missions: MissionView[] } | null = null;
  talk(npc: string, name: string, line: string, missions: MissionView[]): void {
    const keepLine = this.talkNpc?.npc === npc && !line ? this.talkNpc.line : line;
    this.talkNpc = { npc, name, line: keepLine, missions }; this.open('talk');
  }
  say(name: string, text: string): void {
    const box = document.getElementById('npc-say'); if (box) { box.innerHTML = `<b>${esc(name)}</b> ${esc(text)}`; box.classList.remove('thinking'); }
  }
  private renderTalk(): void {
    const t = this.talkNpc; if (!t) return; const body = $('panel-body'); $('panel-title').textContent = t.name;
    const label = (s: string) => s === 'available' ? COPY.accept : s === 'ready' ? COPY.claim : s === 'active' ? '' : COPY.missionTomorrow;
    body.innerHTML = `<div class="fe">${esc(t.line)}</div><div class="note">${COPY.missions}</div>`
      + (t.missions.length ? t.missions.map((m) => `<div class="item"><div><div class="name">${esc(m.title)} <span class="price">+${m.reward} ${COPY.sap}</span></div><div class="note">${esc(m.text)}</div></div><div class="buy"><span>${m.status === 'done' ? COPY.missionDone : `${m.progress}/${m.target}`}</span>${label(m.status) ? `<button data-mission="${m.id}" data-action="${m.status === 'ready' ? 'claim' : 'accept'}" ${m.status === 'done' ? 'disabled' : ''}>${label(m.status)}</button>` : ''}</div></div>`).join('') : `<div class="note">${COPY.noMissions}</div>`)
      + `<div class="note">${COPY.ask}</div><div class="buy"><input id="npc-ask" maxlength="160" placeholder="${COPY.askPlaceholder}" style="flex:1"><button id="npc-ask-go">${COPY.ask}</button></div><div id="npc-say" class="note" style="min-height:24px"></div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach((b) => b.addEventListener('click', () => this.scene.mission(b.dataset.mission!, b.dataset.action as 'accept' | 'claim')));
    const inp = body.querySelector<HTMLInputElement>('#npc-ask')!; const go = () => { const q = inp.value.trim(); if (!q) return; inp.value = ''; const box = $('npc-say'); box.textContent = COPY.thinking; this.scene.ask(t.npc, q); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }); body.querySelector('#npc-ask-go')!.addEventListener('click', go);
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
