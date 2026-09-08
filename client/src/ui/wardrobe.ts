import atlas from '../../public/sprites/chars.json';
import { COPY } from '../content';
import { HAT_PRICES, SHIRT_PRICE, HAIR_STYLES, SKIN_TONES, type PrivateState } from '@shared/protocol';
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function preview(color: number, hat: number, hair=0, portrait=false): string {
  const frame = (atlas.frames as Record<string, { frame: { x: number; y: number } }>)[`farmer${color}${hat}_down0`]?.frame;
  if (!frame) return '';
  return `<span data-outfit="${color}:${hat}:${hair}${portrait?':hair':''}" aria-hidden="true" style="display:block;width:64px;height:64px;margin:0 auto;background-image:url('sprites/chars.png');background-size:${atlas.meta.size.w * 2}px ${atlas.meta.size.h * 2}px;background-position:-${frame.x * 2}px -${frame.y * 2}px;image-rendering:pixelated"></span>`;
}
export function wardrobeHtml(you: Pick<PrivateState, 'color' | 'hat' | 'hats' | 'sap' | 'skin' | 'hair'>, threeD=false): string {
  const hats = COPY.hatNames.split('|'), owned = you.hats ?? [0, you.hat];
  const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin:8px 0';
  const card = 'display:block;min-height:110px;text-align:center;line-height:1.7;padding:8px';
  const shirt = Array.from({ length: 6 }, (_, i) => {
    const equipped = i === you.color;
    return `<button data-shirt="${i}" aria-label="${escape(COPY.shirt)} ${i + 1}" aria-pressed="${equipped}" style="${card}" ${equipped || you.sap < SHIRT_PRICE ? 'disabled' : ''}>${preview(i, you.hat, you.hair)}${escape(COPY.shirt)} ${i + 1}<br>${equipped ? escape(COPY.worn) : `${SHIRT_PRICE} ${escape(COPY.sap)}`}</button>`;
  }).join('');
  const choices = hats.map((name, i) => {
    const equipped = i === you.hat, unlocked = owned.includes(i), price = unlocked ? 0 : HAT_PRICES[i];
    return `<button data-hat="${i}" aria-pressed="${equipped}" style="${card}" ${equipped || you.sap < price ? 'disabled' : ''}>${preview(you.color, i, you.hair)}${escape(name)}<br>${equipped ? escape(COPY.worn) : unlocked ? escape(COPY.wear) : `${price} ${escape(COPY.sap)}`}</button>`;
  }).join('');
  const tones=threeD && you.skin!==undefined ? `<div class="note">${escape(COPY.skinTone)}</div><div style="${grid}">${SKIN_TONES.map((tone,i)=>`<button data-skin="${i}" aria-label="${escape(COPY.skinTone)} ${i+1}" aria-pressed="${i===you.skin}" ${i===you.skin?'disabled':''} style="min-height:64px"><span aria-hidden="true" style="display:inline-block;width:32px;height:32px;background:${tone}"></span><br>${i===you.skin?escape(COPY.worn):escape(COPY.wear)}</button>`).join('')}</div>` : '';
  const hairNames=COPY.hairNames.split('|');
  const hair=threeD && you.hair!==undefined ? `<div class="note">${escape(COPY.hairstyle)} — ${escape(COPY.hairPreviewNote)}</div><div style="${grid}">${HAIR_STYLES.map((_,i)=>`<button data-hair="${i}" aria-pressed="${i===you.hair}" style="${card}" ${i===you.hair?'disabled':''}>${preview(you.color,you.hat,i,true)}${escape(hairNames[i])}<br>${i===you.hair?escape(COPY.worn):escape(COPY.wear)}</button>`).join('')}</div>` : '';
  return `<div class="note">${escape(COPY.wardrobe)}</div><div style="${grid}">${shirt}</div><div style="${grid}">${choices}</div>${tones}${hair}`;
}
