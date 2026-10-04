import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STEPS, prepareArchive, quantize } from '../src/archive.js';
import { extractSourceGeometries, applyMeshStage, compactTriangleIds } from '../src/mesh-source.js';

const glbURL = new URL('../public/models/three-gorges.glb', import.meta.url);
const glb = readFileSync(glbURL);
const wire = JSON.parse(readFileSync(new URL('../public/models/sculpture-wireframes.json', import.meta.url)));
const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
const originalAttributes = [];
gltf.scene.traverse(object => {
  if (object.isMesh) originalAttributes.push({
    object, position: object.geometry.attributes.position.array.slice(),
    normal: object.geometry.attributes.normal.array.slice(), index: object.geometry.index.array.slice(),
  });
});
const sources = extractSourceGeometries(gltf.scene, wire);
const archive = prepareArchive(wire.groups);
const counts = [4564, 4236, 11952, 3780, 3852];
const parts = [7, 5, 6, 5, 6];
const expectedStageCounts = [
  [4564, 1231, 565, 217, 109, 22, 0],
  [4236, 573, 290, 159, 35, 12, 0],
  [11952, 1140, 484, 96, 32, 5, 0],
  [3780, 596, 327, 81, 27, 4, 0],
  [3852, 978, 472, 206, 88, 16, 0],
];

function originalPositions(groupIndex) {
  const group = wire.groups[groupIndex], model = archive[groupIndex], output = [];
  gltf.scene.getObjectByName(group.sourceGroup).traverse(object => {
    if (!object.isMesh) return;
    const attributes = object.geometry.attributes.position, index = object.geometry.index;
    const e = object.matrixWorld.elements;
    for (let n = 0; n < index.count; n++) {
      const at = index.getX(n), x = attributes.getX(at), y = attributes.getY(at), z = attributes.getZ(at);
      const world = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
      const local = world.map((value, axis) => (value - wire.sceneOriginOriginal[axis]) * wire.sceneScale - group.center[axis]);
      output.push(local[0] / model.unit, (local[1] - model.halfY) / model.unit, local[2] / model.unit);
    }
  });
  return output;
}

test('full GLB retains all 28,384 original faces across its five sources and 29 parts', () => {
  assert.equal(sources.length, 5);
  assert.equal(sources.reduce((sum, source) => sum + source.sourceTriangles, 0), 28384);
  assert.equal(sources.reduce((sum, source) => sum + source.sourceMeshes, 0), 29);
  sources.forEach((source, index) => {
    assert.equal(source.id, wire.groups[index].id);
    assert.equal(source.sourceTriangles, counts[index]);
    assert.equal(source.sourceMeshes, parts[index]);
    assert.equal(source.geometry, source.stageGeometries[0]);
    assert.equal(source.geometry.index.count, counts[index] * 3);
    assert.equal(source.stages.length, STEPS.length + 1);
    assert.equal(source.parts.reduce((sum, part) => sum + part.triangleCount, 0), counts[index]);
  });
});

test('every initial face is the transformed original triangle, without hulls, filled holes or sampling', () => {
  sources.forEach((source, groupIndex) => {
    const expected = originalPositions(groupIndex);
    assert.equal(source.stages[0].positions.length, expected.length);
    for (let n = 0; n < expected.length; n++) assert.equal(source.stages[0].positions[n], Math.fround(expected[n]));
    for (let n = 0; n < source.geometry.index.count; n++) assert.equal(source.geometry.index.getX(n), n);
  });
});

test('normalization matches prepareArchive scale, centered height, group bounds and world placement', () => {
  sources.forEach((source, index) => {
    const model = archive[index];
    assert.equal(source.unit, model.unit);
    assert.equal(source.halfY, model.halfY);
    assert.deepEqual(source.bounds, model.bounds);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const positions = source.stages[0].positions;
    for (let n = 0; n < positions.length; n++) {
      const axis = n % 3;
      min[axis] = Math.min(min[axis], positions[n]);
      max[axis] = Math.max(max[axis], positions[n]);
    }
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(min[axis] + model.bounds[axis]) < 3e-6, `${source.id} minimum ${axis}`);
      assert.ok(Math.abs(max[axis] - model.bounds[axis]) < 3e-6, `${source.id} maximum ${axis}`);
    }
  });
});

test('six grids always quantize the previous double-precision stage, without Float32 half-grid drift', () => {
  sources.forEach((source, groupIndex) => {
    let previous = originalPositions(groupIndex);
    for (let stage = 1; stage < source.stages.length; stage++) {
      const next = [];
      for (let at = 0; at < previous.length; at += 3) next.push(...quantize(previous.slice(at, at + 3), STEPS[stage - 1]));
      const actual = source.stages[stage].positions;
      for (let n = 0; n < next.length; n++) assert.equal(actual[n], Math.fround(next[n]));
      previous = next;
    }
  });
});

test('surviving triangle indices decline monotonically, match actual draw counts and never resurrect', () => {
  sources.forEach((source, index) => {
    assert.deepEqual(source.triangleCounts, expectedStageCounts[index]);
    let last = new Set(source.stages[0].triangleIds);
    for (let stage = 0; stage < source.stages.length; stage++) {
      const current = source.stages[stage], geometry = source.stageGeometries[stage];
      assert.equal(current.triangleCount, current.triangleIds.length);
      assert.equal(geometry.index.count / 3, current.triangleCount);
      assert.equal(geometry.userData.triangleCount, current.triangleCount);
      for (const triangle of current.triangleIds) assert.ok(last.has(triangle));
      if (stage > 0) assert.deepEqual(compactTriangleIds(current.positions, source.stages[stage - 1].triangleIds), current.triangleIds);
      last = new Set(current.triangleIds);
    }
    assert.equal(source.stageGeometries.at(-1).index.count, 0);
    assert.equal(source.triangleCounts.at(-1), 0);
    assert.ok(source.stages.at(-1).positions.every(value => value === 0));
  });
});

test('compaction removes collinear, repeated-vertex and duplicate faces in either winding', () => {
  const positions = new Float32Array([
    0,0,0, 1,0,0, 0,1,0,
    0,0,0, 0,1,0, 1,0,0,
    0,0,0, 1,0,0, 2,0,0,
    0,0,0, 0,0,0, 0,1,0,
    0,0,1, 1,0,1, 0,1,1,
  ]);
  assert.deepEqual([...compactTriangleIds(positions, [0,1,2,3,4])], [0,4]);
  assert.deepEqual([...compactTriangleIds(positions, [4])], [4]);
});

test('every uploaded position and normal is finite, with unit normals including the empty stage', () => {
  for (const source of sources) for (const stage of source.stages) {
    assert.ok(stage.positions.every(Number.isFinite));
    assert.ok(stage.normals.every(Number.isFinite));
    for (let at = 0; at < stage.normals.length; at += 3) {
      assert.ok(Math.abs(Math.hypot(stage.normals[at], stage.normals[at + 1], stage.normals[at + 2]) - 1) < 1e-6);
    }
  }
});

test('snapped surviving faces have correctly recomputed surface normals', () => {
  for (const source of sources) for (const stage of source.stages.slice(1)) for (const triangle of stage.triangleIds) {
    const at = triangle * 9, p = stage.positions;
    const a = new Vector3().fromArray(p, at), b = new Vector3().fromArray(p, at + 3), c = new Vector3().fromArray(p, at + 6);
    const normal = b.sub(a).cross(c.sub(a)).normalize();
    assert.ok(normal.dot(new Vector3().fromArray(stage.normals, at)) > .999999);
  }
});

test('each transition shares stage buffers and has exactly one absolute next target', () => {
  for (const source of sources) source.stageGeometries.forEach((geometry, index) => {
    const next = Math.min(index + 1, source.stages.length - 1);
    assert.equal(geometry.attributes.position.array, source.stages[index].positions);
    assert.equal(geometry.attributes.normal.array, source.stages[index].normals);
    assert.equal(geometry.morphAttributes.position.length, 1);
    assert.equal(geometry.morphAttributes.normal.length, 1);
    assert.equal(geometry.morphTargetsRelative, false);
    assert.equal(geometry.morphAttributes.position[0], source.stageGeometries[next].attributes.position);
    assert.equal(geometry.morphAttributes.normal[0], source.stageGeometries[next].attributes.normal);
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
  });
});

test('instances share immutable GPU assets but keep independent morph stages and influences', () => {
  const source = sources[0], material = new MeshStandardMaterial();
  const a = new Mesh(source.geometry, material), b = new Mesh(source.geometry, material);
  const influenceA = a.morphTargetInfluences, influenceB = b.morphTargetInfluences;
  assert.notEqual(influenceA, influenceB);
  assert.equal(applyMeshStage(a, source, 0, .25), counts[0]);
  assert.equal(applyMeshStage(b, source, 2, .75), source.triangleCounts[2]);
  assert.equal(a.geometry, source.stageGeometries[0]);
  assert.equal(b.geometry, source.stageGeometries[2]);
  assert.equal(a.morphTargetInfluences[0], .25);
  assert.equal(b.morphTargetInfluences[0], .75);
  assert.equal(applyMeshStage(a, source, 0, 1), source.triangleCounts[1]);
  assert.equal(a.geometry, source.stageGeometries[1]);
  assert.equal(a.morphTargetInfluences[0], 0);
  for (let n = 0; n < 100; n++) applyMeshStage(a, source, n % 6, (n % 11) / 10);
  assert.equal(a.morphTargetInfluences, influenceA);
  assert.equal(b.morphTargetInfluences, influenceB);
  for (const geometry of source.stageGeometries) {
    assert.equal(geometry.attributes.position.version, 0);
    assert.equal(geometry.attributes.normal.version, 0);
    assert.equal(geometry.index.version, 0);
  }
  assert.equal(applyMeshStage(a, source, 5, 1), 0);
  assert.equal(a.visible, false);
  assert.equal(a.geometry.index.count, 0);
  assert.equal(b.visible, true);
  material.dispose();
});

test('baking nested translated, rotated and reflected transforms preserves winding and normals', () => {
  const scene = new Group(), root = new Group(), middle = new Group();
  root.name = 'synthetic';
  root.position.set(2, 3, 4); root.rotation.y = .35;
  middle.scale.set(-2, 3, 1); middle.rotation.x = .2;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1], 3));
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  scene.add(root); root.add(middle); middle.add(mesh);
  const [source] = extractSourceGeometries(scene, { sceneOriginOriginal: [0,0,0], sceneScale: 1, groups: [
    { id: 'synthetic', name: 'Synthetic', sourceGroup: 'synthetic', center: [0,0,0], bounds: { min: [-10,-10,-10], max: [10,10,10] } },
  ] });
  const actual = source.stages[0].positions;
  for (const [corner, sourceCorner] of [[0,0],[1,2],[2,1]]) {
    const expected = new Vector3().fromBufferAttribute(geometry.attributes.position, sourceCorner).applyMatrix4(mesh.matrixWorld);
    expected.y -= 10; expected.divideScalar(10);
    assert.ok(expected.distanceTo(new Vector3().fromArray(actual, corner * 3)) < 1e-7);
  }
  const a = new Vector3().fromArray(actual, 0), b = new Vector3().fromArray(actual, 3), c = new Vector3().fromArray(actual, 6);
  const normal = b.sub(a).cross(c.sub(a)).normalize();
  assert.ok(normal.dot(new Vector3().fromArray(source.stages[0].normals)) > .99999);
  source.stageGeometries.forEach(value => value.dispose()); geometry.dispose(); mesh.material.dispose();
});

test('invalid metadata and missing named sources fail explicitly instead of substituting a shape', () => {
  assert.throws(() => extractSourceGeometries(gltf.scene, wire.groups), /normalization metadata/);
  assert.throws(() => extractSourceGeometries(gltf.scene, { ...wire, groups: [{ ...wire.groups[0], sourceGroup: 'missing' }] }), /Missing original GLB group/);
  assert.throws(() => extractSourceGeometries(gltf.scene, wire, { steps: [0] }), /finite and positive/);
});

test('source asset bytes, original geometry attributes and source material assignments remain unchanged', () => {
  const current = readFileSync(glbURL);
  assert.deepEqual(current, glb);
  assert.equal(createHash('sha256').update(current).digest('hex'), wire.sourceSHA256);
  for (const snapshot of originalAttributes) {
    assert.deepEqual(snapshot.object.geometry.attributes.position.array, snapshot.position);
    assert.deepEqual(snapshot.object.geometry.attributes.normal.array, snapshot.normal);
    assert.deepEqual(snapshot.object.geometry.index.array, snapshot.index);
    assert.ok(snapshot.object.material.isMeshStandardMaterial);
  }
});
