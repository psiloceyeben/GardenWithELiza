import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { renderLot } from '../../../share/render';
import { deriveGarden } from '../../../shared/derive';
import { FIXTURES } from '../../../shared/derive/fixtures';
import { QUIET_GRASS_PATCHES } from '../../../shared/ground-style';

test('share illustrations use the HD-2D quiet green ground in every biome', () => {
  const snapshot = FIXTURES[2].snapshot, spec = deriveGarden(snapshot.address, snapshot);
  for (let biome = 0; biome < 8; biome++) {
    const png = PNG.sync.read(renderLot(resolve('client/public/sprites'), { spec: { ...spec, biome }, plants: [], name: null }, 1));
    for (const patch of QUIET_GRASS_PATCHES) {
      const offset = ((patch.y + 1) * png.width + patch.x + 1) * 4;
      assert.equal(png.data.readUInt32BE(offset), patch.color * 256 + 255);
    }
  }
});
