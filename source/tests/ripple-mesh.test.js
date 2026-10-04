import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {extractSourceGeometries} from '../src/mesh-source.js';
import {prepareSurfacePatches} from '../src/surface-patches.js';
import {createRippleState, emitRipple, advanceRipples, deformRipplePoint, RIPPLE_DURATION} from '../src/ripple.js';
import {RippleMesh} from '../src/ripple-mesh.js';

const glb = readFileSync(new URL('../public/models/three-gorges.glb', import.meta.url));
const wire = JSON.parse(readFileSync(new URL('../public/models/sculpture-wireframes.json', import.meta.url)));
const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
const sources = extractSourceGeometries(gltf.scene, wire);
const snapshot = source => {
  const hash = createHash('sha256');
  const arrays = source.stages.flatMap((stage, index) => [stage.positions, stage.normals, stage.triangleIds, source.stageGeometries[index].index.array,
    ...prepareSurfacePatches(source)[index].map(patch => patch.index.array)]);
  for (const array of arrays) hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  return hash.digest('hex');
};
const originalHashes = sources.map(snapshot);
const originalRefs = sources.map(source => source.stages.map((stage, index) => [stage.positions, stage.normals, source.stageGeometries[index].index]));
const makeActive = (serial = 11, origin = [.12, -.1, .07]) => {
  const ripples = createRippleState(); emitRipple(ripples, {serial, origin}); advanceRipples(ripples, 2.4); return ripples;
};
const expectedPositions = (source, stage, blend = 0) => {
  const from = source.stages[stage].positions, to = source.stages[Math.min(stage + 1, source.stages.length - 1)].positions;
  return Float32Array.from(from, (value, at) => value + (to[at] - value) * blend);
};

function assertImmutable() {
  sources.forEach((source, index) => {
    assert.equal(snapshot(source), originalHashes[index]);
    source.stages.forEach((stage, stageIndex) => {
      assert.equal(stage.positions, originalRefs[index][stageIndex][0]);
      assert.equal(stage.normals, originalRefs[index][stageIndex][1]);
      assert.equal(source.stageGeometries[stageIndex].index, originalRefs[index][stageIndex][2]);
    });
  });
}

test('only the target vertices deform; all original source buffers and other instances stay unchanged', () => {
  const source = sources[2], ripples = makeActive(), target = new RippleMesh(source, 11), other = new RippleMesh(source, 12);
  const frame = {stage: 0, blend: .3, committed: false};
  const geometries = target.update(frame, ripples);
  other.update(frame, ripples);
  assert.equal(geometries.length, 3);
  assert.notDeepEqual(target.position.array, expectedPositions(source, 0, .3));
  assert.deepEqual(other.position.array, expectedPositions(source, 0, .3));
  assert.notEqual(target.position.array, other.position.array);
  for (const geometry of geometries) {
    assert.equal(geometry.attributes.position, target.position);
    assert.equal(geometry.attributes.normal, target.normal);
    assert.notEqual(geometry.attributes.position.array, source.stages[0].positions);
    assert.notEqual(geometry.index.array, prepareSurfacePatches(source)[0][geometry.userData.patchIndex].index.array);
    assert.deepEqual(geometry.morphAttributes, {});
  }
  assertImmutable(); target.dispose(); other.dispose(); assertImmutable();
});

test('each point is deformed from the actual current quantized interpolation', () => {
  const source = sources[0], ripples = makeActive(), target = new RippleMesh(source, 11);
  for (const stage of [0, 1, 2, 3, 4, 5]) {
    const blend = .37; target.update({stage, blend}, ripples);
    const from = source.stages[stage].positions, to = source.stages[stage + 1].positions;
    for (const triangle of source.stages[stage].triangleIds) {
      const at = triangle * 9;
      const local = [0, 1, 2].map(axis => from[at + axis] + (to[at + axis] - from[at + axis]) * blend);
      const expected = deformRipplePoint(ripples, 11, local);
      expected.forEach((value, axis) => assert.equal(target.position.array[at + axis], Math.fround(value)));
    }
  }
  assertImmutable(); target.dispose();
});

test('expiry restores the CURRENT processed stage, including if processing continued during the wave', () => {
  const source = sources[2], ripples = makeActive(), target = new RippleMesh(source, 11);
  target.update({stage: 0, blend: .1}, ripples);
  advanceRipples(ripples, RIPPLE_DURATION);
  target.update({stage: 4, blend: .61, committed: false}, ripples);
  assert.deepEqual(target.position.array, expectedPositions(source, 4, .61));
  assert.notDeepEqual(target.position.array, expectedPositions(source, 0, .1));
  assert.equal(target.geometries.reduce((sum, geometry) => sum + geometry.userData.triangleCount, 0), source.stages[4].triangleCount);
  assertImmutable(); target.dispose();
});

test('commits use only genuine survivor indices, and empty final stages never resurrect faces', () => {
  for (const source of sources) {
    const target = new RippleMesh(source, 11), ripples = makeActive();
    for (let stage = 0; stage < source.stages.length - 1; stage++) {
      for (const frame of [{stage, blend: 1}, {stage, blend: .4, committed: true}]) {
        const geometries = target.update(frame, ripples), expected = prepareSurfacePatches(source)[stage + 1];
        geometries.forEach((geometry, patch) => {
          assert.equal(geometry.userData.stage, stage + 1);
          assert.equal(geometry.userData.triangleCount, expected[patch].userData.triangleCount);
          assert.equal(geometry.index.count, expected[patch].index.count);
          assert.equal(geometry.drawRange.count, expected[patch].index.count);
          assert.deepEqual(geometry.index.array.slice(0, geometry.index.count), expected[patch].index.array);
        });
      }
    }
    for (const geometry of target.update({stage: 6, blend: .9, committed: true}, ripples)) {
      assert.equal(geometry.index.count, 0); assert.equal(geometry.drawRange.count, 0); assert.equal(geometry.userData.triangleCount, 0);
    }
    target.dispose();
  }
  assertImmutable();
});

test('all normals remain finite unit vectors and raycast bounds contain every deformed vertex', () => {
  const vertex = new Vector3();
  for (const source of sources) {
    const target = new RippleMesh(source, 11), ripples = makeActive();
    for (const frame of [{stage: 0, blend: .02}, {stage: 2, blend: .7}, {stage: 5, blend: .999999}]) {
      const geometries = target.update(frame, ripples);
      for (let at = 0; at < target.position.array.length; at += 3) {
        vertex.fromArray(target.position.array, at);
        assert.ok(geometries[0].boundingBox.containsPoint(vertex));
        assert.ok(geometries[0].boundingSphere.containsPoint(vertex));
        const n = target.normal.array;
        assert.ok(Math.abs(Math.hypot(n[at], n[at + 1], n[at + 2]) - 1) < 1e-6);
      }
    }
    target.dispose();
  }
});

test('repeated updates allocate no new geometry, position, normal, or index buffers', () => {
  const source = sources[2], target = new RippleMesh(source, 11), ripples = makeActive();
  const geometries = target.geometries, positions = target.position, normals = target.normal;
  const positionBuffer = positions.array.buffer, normalBuffer = normals.array.buffer;
  const indices = geometries.map(geometry => geometry.index), indexBuffers = indices.map(index => index.array.buffer);
  const bytes = positionBuffer.byteLength + normalBuffer.byteLength + indexBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  for (let step = 0; step < 100; step++) {
    assert.equal(target.update({stage: step % 7, blend: (step % 10) / 10}, ripples), geometries);
    assert.equal(target.position, positions); assert.equal(target.normal, normals);
    assert.equal(target.position.array.buffer, positionBuffer); assert.equal(target.normal.array.buffer, normalBuffer);
    geometries.forEach((geometry, patch) => {
      assert.equal(geometry.index, indices[patch]); assert.equal(geometry.index.array.buffer, indexBuffers[patch]);
    });
  }
  assert.ok(bytes < 1_000_000, `${bytes} target-owned bytes`);
  let disposeEvents = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposeEvents++));
  target.dispose(); target.dispose();
  assert.equal(disposeEvents, 3);
  assert.throws(() => target.update({stage: 0}, ripples), /disposed/);
  assertImmutable();
});
