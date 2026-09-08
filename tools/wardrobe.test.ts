import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wardrobeHtml } from '../client/src/ui/wardrobe';

test('five free hairstyles use selected and candidate 3D preview styles, hidden for old servers and legacy',()=>{
  const you={color:2,hat:1,hats:[0,1],sap:0,skin:2,hair:3};
  const html=wardrobeHtml(you,true);
  assert.equal((html.match(/data-hair=/g)??[]).length,5);
  assert.equal((html.match(/data-outfit=/g)??[]).length,15);
  assert(html.match(/<button data-hair="3"[^>]*disabled/));
  assert(!html.match(/<button data-hair="4"[^>]*disabled/));
  for(let i=0;i<5;i++)assert(html.includes(`data-outfit="2:1:${i}:hair"`));
  assert(!wardrobeHtml(you).includes('data-hair'));
  assert(!wardrobeHtml({...you,hair:undefined},true).includes('data-hair'));
});
test('wardrobe shows ten actual sprite previews and current selections', () => {
  const html = wardrobeHtml({ color: 2, hat: 1, hats: [0, 1], sap: 1000 });
  assert.equal((html.match(/background-image/g) ?? []).length, 10);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert(html.includes('sprites/chars.png'));
});
test('owned hats can be equipped with zero balance while unowned choices are disabled', () => {
  const html = wardrobeHtml({ color: 0, hat: 0, hats: [0, 1], sap: 0 });
  const button = (kind: string, i: number) => html.match(new RegExp(`<button data-${kind}="${i}"[^>]*>`))![0];
  assert(!button('hat', 1).includes('disabled'));
  assert(button('hat', 2).includes('disabled'));
  assert(button('shirt', 1).includes('disabled'));
  assert(button('hat', 0).includes('disabled'));
});
test('3D skin controls are free and hidden for legacy view or older servers',()=>{
  const you={color:0,hat:0,hats:[0],sap:0,skin:2};
  const html=wardrobeHtml(you,true);
  assert.equal((html.match(/data-skin=/g)??[]).length,6);
  assert(html.match(/<button data-skin="2"[^>]*disabled/));
  assert(!html.match(/<button data-skin="5"[^>]*disabled/));
  assert(!wardrobeHtml(you).includes('data-skin'));
  assert(!wardrobeHtml({...you,skin:undefined},true).includes('data-skin'));
});
