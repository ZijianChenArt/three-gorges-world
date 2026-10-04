import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeInstance } from '../src/archive.js';
import { extractSourceGeometries } from '../src/mesh-source.js';
import { PATCH_COUNT, patchIndex, prepareSurfacePatches, phaseInfo } from '../src/surface-patches.js';

const glb = readFileSync(new URL('../public/models/three-gorges.glb', import.meta.url));
const wire = JSON.parse(readFileSync(new URL('../public/models/sculpture-wireframes.json', import.meta.url)));
const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
const sources = extractSourceGeometries(gltf.scene, wire);

test('all actual GLB stages are exact, disjoint source-face unions with no empty surviving patches', () => {
  assert.equal(PATCH_COUNT, 3);
  for (const source of sources) {
    const patches = prepareSurfacePatches(source);
    assert.equal(patches.length, source.stages.length);
    for (const [stageIndex, stage] of source.stages.entries()) {
      const seen = new Set();
      assert.equal(patches[stageIndex].length, PATCH_COUNT);
      for (const [patch, geometry] of patches[stageIndex].entries()) {
        assert.equal(geometry.userData.stage, stageIndex);
        assert.equal(geometry.userData.patchIndex, patch);
        assert.equal(geometry.index.count, geometry.userData.triangleCount * 3);
        assert.equal(geometry.userData.triangleIds.length, geometry.userData.triangleCount);
        if (stage.triangleCount) assert.ok(geometry.index.count > 0, `${source.id}/${stageIndex}/${patch}`);
        else assert.equal(geometry.index.count, 0);
        for (let face = 0; face < geometry.userData.triangleIds.length; face++) {
          const triangle = geometry.userData.triangleIds[face];
          assert.equal(seen.has(triangle), false, `duplicate ${triangle}`);
          seen.add(triangle);
          for (let corner = 0; corner < 3; corner++) assert.equal(geometry.index.getX(face * 3 + corner), triangle * 3 + corner);
        }
      }
      assert.deepEqual([...seen].sort((a, b) => a - b), [...stage.triangleIds]);
    }
  }
});

test('classification uses original spatial centroids and stays fixed through quantization', () => {
  for (const source of sources) {
    const p = source.stages[0].positions;
    const membership = new Map();
    for (const stage of prepareSurfacePatches(source)) for (const [patch, geometry] of stage.entries()) {
      for (const triangle of geometry.userData.triangleIds) {
        const at = triangle * 9;
        const centroid = [0, 1, 2].map(axis => (p[at + axis] + p[at + 3 + axis] + p[at + 6 + axis]) / 3);
        assert.equal(patch, patchIndex(centroid));
        assert.equal(patchIndex(new Vector3(...centroid)), patch);
        if (membership.has(triangle)) assert.equal(membership.get(triangle), patch);
        membership.set(triangle, patch);
      }
    }
    assert.equal(membership.size, source.sourceTriangles);
  }
  assert.equal(patchIndex([-1, 0, -0]), patchIndex([-1, 0, 0]));
  assert.equal(patchIndex([0, 0, -0]), patchIndex([0, 0, 0]));
});

test('patch views reuse every immutable GPU vertex/morph buffer and preparation is cached', () => {
  for (const source of sources) {
    const before = source.stageGeometries.map(base => base.index.array.slice());
    const patches = prepareSurfacePatches(source);
    assert.equal(prepareSurfacePatches(source), patches);
    assert.ok(Object.isFrozen(patches));
    for (const [stage, geometries] of patches.entries()) {
      const base = source.stageGeometries[stage];
      assert.ok(Object.isFrozen(geometries));
      assert.deepEqual(base.index.array, before[stage]);
      for (const geometry of geometries) {
        for (const name of Object.keys(base.attributes)) {
          assert.equal(geometry.attributes[name], base.attributes[name]);
          assert.equal(geometry.attributes[name].version, 0);
        }
        assert.equal(geometry.morphAttributes, base.morphAttributes);
        assert.equal(geometry.morphAttributes.position.length, 1);
        assert.equal(geometry.morphAttributes.normal.length, 1);
        assert.equal(geometry.morphTargetsRelative, false);
        assert.equal(geometry.boundingBox, base.boundingBox);
        assert.equal(geometry.boundingSphere, base.boundingSphere);
        assert.notEqual(geometry.index, base.index);
        assert.equal(geometry.index.array.constructor, base.index.array.constructor);
        assert.equal(geometry.index.version, 0);
      }
    }
  }
  assert.throws(() => prepareSurfacePatches({}), /full source stages/);
});

test('local phases are complementary, deterministic, slowly varying and continuous at joins', () => {
  const alphaNames = ['surfaceAlpha', 'lineAlpha', 'pointAlpha'];
  for (let serial = 1; serial <= 32; serial++) {
    const key = makeInstance(serial, 0).key;
    for (let patch = 0; patch < PATCH_COUNT; patch++) {
      for (let t = 0; t < 100; t += .071) {
        const info = phaseInfo(key, patch, t), next = phaseInfo(key, patch, t + .0001);
        assert.deepEqual(info, phaseInfo(key, patch, t));
        assert.ok(info.period >= 18 && info.period < 26);
        assert.ok(PATCH_COUNT / info.period < .3);
        assert.ok(Math.abs(info.surfaceAlpha + info.lineAlpha + info.pointAlpha - 1) < 1e-12);
        for (const name of [...alphaNames, 'curvature']) {
          assert.ok(info[name] >= -1e-15 && info[name] <= 1 + 1e-15, `${name} at ${t}`);
          assert.ok(Math.abs(info[name] - next[name]) < .00006, `${name} discontinuity at ${t}`);
        }
      }
      const initial = phaseInfo(key, patch, 0);
      for (let boundary = 6; boundary < 15; boundary++) {
        const at = (boundary / PATCH_COUNT - initial.phase) * initial.period;
        const before = phaseInfo(key, patch, at - 1e-5);
        const current = phaseInfo(key, patch, at);
        const after = phaseInfo(key, patch, at + 1e-5);
        for (const name of alphaNames) {
          assert.ok(Math.abs(before[name] - current[name]) < 1e-10, `${name} before join`);
          assert.ok(Math.abs(after[name] - current[name]) < 1e-10, `${name} after join`);
        }
      }
    }
  }
});

test('five originals open surface-led while spatially distinct patches reach lines within five seconds', () => {
  for (let serial = 1; serial <= 5; serial++) {
    const key = makeInstance(serial, 0).key;
    const initial = Array.from({ length: PATCH_COUNT }, (_, patch) => phaseInfo(key, patch, 0));
    assert.ok(initial.every(info => info.surfaceAlpha >= .72 - 1e-12));
    assert.ok(initial.reduce((sum, info) => sum + info.surfaceAlpha, 0) / PATCH_COUNT > .8);
    let lineReached = false;
    for (let time = 0; time <= 5; time += .05) {
      const phases = Array.from({ length: PATCH_COUNT }, (_, patch) => phaseInfo(key, patch, time));
      if (phases.some(info => info.lineAlpha > .65)) lineReached = true;
      assert.ok(phases.reduce((sum, info) => sum + info.surfaceAlpha, 0) >= 1 - 1e-12);
    }
    assert.equal(lineReached, true, `first model ${serial} enters line phase`);
    for (let time = 7; time < 100; time += .37) {
      const phases = Array.from({ length: PATCH_COUNT }, (_, patch) => phaseInfo(key, patch, time));
      for (const name of ['surfaceAlpha', 'lineAlpha', 'pointAlpha']) {
        assert.ok(Math.abs(phases.reduce((sum, info) => sum + info[name], 0) - 1) < 1e-12);
      }
    }
  }
  assert.notEqual(phaseInfo(1, 0, 10).phase, phaseInfo(2, 0, 10).phase);
});

test('reduced motion is static and fully preserves the original surface', () => {
  for (const key of [0, 1, 4294967295]) for (let patch = 0; patch < PATCH_COUNT; patch++) {
    const initial = phaseInfo(key, patch, 0, { reducedMotion: true });
    for (const time of [0, .5, 5, 30, 1000]) assert.deepEqual(phaseInfo(key, patch, time, { reducedMotion: true }), initial);
    assert.equal(initial.surfaceAlpha, 1);
    assert.equal(initial.lineAlpha, 0);
    assert.equal(initial.pointAlpha, 0);
    assert.equal(initial.curvature, 0);
  }
  assert.deepEqual(phaseInfo(2, 0, NaN), phaseInfo(2, 0, 0));
  assert.deepEqual(phaseInfo(2, 0, -2), phaseInfo(2, 0, 0));
});
