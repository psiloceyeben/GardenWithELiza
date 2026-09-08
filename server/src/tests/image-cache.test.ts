import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImageCache } from '../image-cache';
test('popular image expires from render time, not most recent access', () => {
  let now = 0; const cache = new ImageCache(100, 100, 10, () => now); const image = Buffer.from('png'); cache.set('a', image);
  now = 50; assert.equal(cache.get('a'), image); now = 99; assert.equal(cache.get('a'), image);
  now = 100; assert.equal(cache.get('a'), undefined);
});
test('byte budget evicts least recently used images', () => {
  const cache = new ImageCache(100, 6, 10, () => 0); cache.set('a', Buffer.alloc(3)); cache.set('b', Buffer.alloc(3));
  cache.get('a'); cache.set('c', Buffer.alloc(3)); assert.equal(cache.get('b'), undefined); assert(cache.get('a')); assert(cache.get('c'));
});
test('entry limit, replacement accounting and oversized images remain bounded', () => {
  const cache = new ImageCache(100, 6, 2, () => 0);
  cache.set('a', Buffer.alloc(3)); cache.set('a', Buffer.alloc(1)); cache.set('b', Buffer.alloc(3));
  assert(cache.get('a')); assert(cache.get('b'));
  cache.set('c', Buffer.alloc(1)); assert.equal(cache.get('a'), undefined);
  cache.set('b', Buffer.alloc(7)); assert.equal(cache.get('b'), undefined); assert(cache.get('c'));
});
