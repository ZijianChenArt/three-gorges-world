import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LinearFilter, SRGBColorSpace, ClampToEdgeWrapping} from 'three';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GRADIENT_HEIGHT, GRADIENT_KINDS, gradientColor, gradientHeight, makeGradientTextures} from '../src/physical-gradients.js';
import {shadeFacet} from '../src/materials.js';
import {extractSourceGeometries} from '../src/mesh-source.js';
import {prepareSurfacePatches} from '../src/surface-patches.js';
import {RippleMesh} from '../src/ripple-mesh.js';
import {createRippleState, emitRipple, advanceRipples} from '../src/ripple.js';

test('two linearly filtered source color maps use exactly 1 KiB with no mipmaps', () => {
  const maps = makeGradientTextures(THREE);
  assert.equal(maps.length, 2);
  assert.equal(maps.reduce((sum, map) => sum + map.image.data.byteLength, 0), 1024);
  for (const [index, map] of maps.entries()) {
    assert.equal(map.image.width, 1); assert.equal(map.image.height, GRADIENT_HEIGHT);
    assert.equal(map.colorSpace, SRGBColorSpace);
    assert.equal(map.minFilter, LinearFilter); assert.equal(map.magFilter, LinearFilter);
    assert.equal(map.wrapS, ClampToEdgeWrapping); assert.equal(map.wrapT, ClampToEdgeWrapping);
    assert.equal(map.generateMipmaps, false); assert.equal(map.mipmaps.length, 0);
    const data = map.image.data;
    assert.deepEqual([...data.slice(0, 3)], gradientColor(GRADIENT_KINDS[index], 0));
    assert.deepEqual([...data.slice(-4, -1)], gradientColor(GRADIENT_KINDS[index], 1));
    const seen = new Set();
    for (let row = 0; row < GRADIENT_HEIGHT; row++) {
      assert.equal(data[row * 4 + 3], 255);
      seen.add([...data.slice(row * 4, row * 4 + 3)].join(','));
      if (row) for (let c = 0; c < 3; c++) assert.ok(Math.abs(data[row * 4 + c] - data[(row - 1) * 4 + c]) <= 4);
    }
    assert.ok(seen.size > 120);
    map.dispose();
  }
});

test('Canvas gradients sample original source height and never use time, face seeds or world motion', () => {
  const base = {normal:[0, 0, 1], view:[0, 0, 1], sourceBounds:[1, .8, 1]};
  assert.equal(gradientHeight([0, -.8, 0], base.sourceBounds), 0);
  assert.equal(gradientHeight([0, .8, 0], base.sourceBounds), 1);
  for (const material of GRADIENT_KINDS) {
    const bottom = shadeFacet({...base, material, sourceCenter:[0, -.8, 0]});
    const top = shadeFacet({...base, material, sourceCenter:[0, .8, 0]});
    assert.notEqual(top.fill, bottom.fill);
    const a = {...base, material, sourceCenter:[0, .2, 0]};
    assert.deepEqual(shadeFacet({...a, elapsed:0, seed:1, center:[10, 10, 10]}), shadeFacet({...a, elapsed:50, seed:937, center:[-5, -4, -2]}));
    for (const height of [NaN, Infinity, -5, 0, 1, 20]) assert.ok(gradientColor(material, height).every(Number.isFinite));
  }
});

test('actual GLB original UVs stay finite, continuous and shared through every stage, patch and ripple', async () => {
  const glb = readFileSync(new URL('../public/models/three-gorges.glb', import.meta.url));
  const wire = JSON.parse(readFileSync(new URL('../public/models/sculpture-wireframes.json', import.meta.url)));
  const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  const sources = extractSourceGeometries(gltf.scene, wire);
  const ripples = createRippleState(); emitRipple(ripples, {serial:7, origin:[0, 0, 0]}); advanceRipples(ripples, .2);
  for (const source of sources) {
    const uv = source.geometry.attributes.uv, original = uv.array.slice(), positions = source.stages[0].positions;
    assert.equal(uv.itemSize, 2); assert.equal(uv.count, positions.length / 3);
    assert.ok(uv.array.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    const coordinates = new Map();
    for (let vertex = 0; vertex < uv.count; vertex++) {
      const key = [...positions.slice(vertex * 3, vertex * 3 + 3)].join(',');
      const pair = [uv.getX(vertex), uv.getY(vertex)];
      if (coordinates.has(key)) assert.deepEqual(pair, coordinates.get(key));
      else coordinates.set(key, pair);
      assert.ok(Math.abs(pair[1] - gradientHeight(positions.slice(vertex * 3, vertex * 3 + 3), source.bounds)) < 1e-7);
    }
    const target = new RippleMesh(source, 7), patches = prepareSurfacePatches(source);
    for (let stage = 0; stage < source.stages.length; stage++) {
      assert.equal(source.stageGeometries[stage].attributes.uv, uv);
      for (const patch of patches[stage]) assert.equal(patch.attributes.uv, uv);
      for (const geometry of target.update({stage, blend:.31}, ripples)) assert.equal(geometry.attributes.uv, uv);
      assert.deepEqual(uv.array, original);
      assert.equal(uv.version, 0);
    }
    target.dispose();
    for (const stage of patches) for (const patch of stage) patch.dispose();
    for (const geometry of source.stageGeometries) geometry.dispose();
  }
});
