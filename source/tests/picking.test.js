import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickProjected} from '../src/picking.js';
import {automaticCamera, cameraBasis, createProjector, projectionParameters} from '../src/flight-camera.js';

const close = (actual, expected, epsilon = 1e-9) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < epsilon, `${actual} ≈ ${expected}`));
};
const face = (depth = 0, extra = {}) => ({
  screen: [[0, 0, depth], [100, 0, depth], [0, 100, depth]],
  local: [[0, 0, 0], [4, 0, 0], [0, 8, 0]],
  ...extra,
});

test('faces return barycentric local and optional world coordinates with the exact serial', () => {
  const serial = 'source-007';
  const triangle = face(4, {world: [[10, 20, 30], [14, 20, 30], [10, 28, 30]]});
  const hit = pickProjected(25, 50, [{serial, triangles: [triangle]}]);
  assert.equal(hit.serial, serial);
  assert.equal(hit.depth, 4);
  close(hit.local, [1, 4, 0]);
  close(hit.world, [11, 24, 30]);
  // Both windings and boundary points are visible in the Canvas renderer.
  const reversed = {...triangle, screen: [...triangle.screen].reverse(), local: [...triangle.local].reverse(), world: [...triangle.world].reverse()};
  close(pickProjected(25, 50, [{serial, triangles: [reversed]}]).local, hit.local);
  assert.ok(pickProjected(50, 50, [{serial, triangles: [triangle]}]));
});

test('registration bounds and empty space between visible geometry cannot select a model', () => {
  const item = {serial: 1, corners: [[-100, -100, 0], [200, 200, 0]], center: [80, 80, 0], triangles: [face()]};
  assert.equal(pickProjected(80, 80, [item]), null);
  assert.equal(pickProjected(50, 50, [{...item, triangles: []}]), null);
  const split = {serial: 2, curves: [
    {screen: [[0, 0, 0], [20, 0, 0]], local: [[0, 0, 0], [2, 0, 0]]},
    {screen: [[80, 0, 0], [100, 0, 0]], local: [[8, 0, 0], [10, 0, 0]]},
  ]};
  assert.equal(pickProjected(50, 0, [split]), null, 'a curved-edge gap remains unpickable');
});

test('thin curves use the nearest polyline segment and interpolate its local and world position', () => {
  const item = {serial: 12, curves: [{
    screen: [[0, 0, 0], [100, 0, 2], [100, 100, 6]],
    local: [[0, 0, 0], [10, 0, 1], [10, 20, 3]],
    world: [[5, 0, 0], [15, 0, 1], [15, 20, 3]],
  }]};
  const hit = pickProjected(106, 25, [item]);
  assert.equal(hit.serial, 12);
  close(hit.local, [10, 5, 1.5]);
  close(hit.world, [15, 5, 1.5]);
  assert.equal(hit.depth, 3);
  assert.equal(pickProjected(108, 25, [item]), null);
  assert.equal(pickProjected(106, 25, [item], {lineTolerance: 5}), null);
  close(pickProjected(-5, 0, [item]).local, [0, 0, 0]);
});

test('source-bound points have a larger forgiving hit radius without accepting a square around them', () => {
  const point = {serial: 8, points: [{screen: [40, 50, 3], local: [1, 2, 3]}]};
  assert.deepEqual(pickProjected(47.5, 50, [point]), {serial: 8, local: [1, 2, 3], depth: 3});
  assert.equal(pickProjected(48.01, 50, [point]), null);
  assert.equal(pickProjected(47, 57, [point]), null);
  assert.equal(pickProjected(47.5, 50, [point], {pointTolerance: 7}), null);
});

test('overlap chooses frontmost interpolated depth rather than center distance or item order', () => {
  const back = {serial: 'back', triangles: [face(-4)]};
  const front = {serial: 'front', triangles: [face(2)]};
  for (const items of [[back, front], [front, back]]) {
    assert.equal(pickProjected(20, 20, items).serial, 'front');
  }
  const slope = {serial: 'slope', triangles: [face(0, {screen: [[0, 0, -10], [100, 0, 10], [0, 100, -10]]})]};
  assert.equal(pickProjected(80, 10, [front, slope]).serial, 'slope', 'use depth at the clicked part of the face');
  const line = {serial: 'line', curves: [{screen: [[0, 20, 3], [100, 20, 3]], local: [[0, 0, 0], [1, 0, 0]]}]};
  const point = {serial: 'point', points: [{screen: [20, 20, 4], local: [4, 5, 6]}]};
  assert.equal(pickProjected(20, 20, [point, front, line]).serial, 'point');
  assert.equal(pickProjected(20, 20, [front, line]).serial, 'line');
});

test('hidden, deleted, fully erased and zero-alpha items or primitives do not intercept a hit', () => {
  const behind = {serial: 'behind', triangles: [face(-1)]};
  for (const flags of [{visible: false}, {hidden: true}, {deleted: true}, {edgeCount: 0}, {alpha: 0}, {alpha: -1}, {alpha: NaN}]) {
    assert.equal(pickProjected(10, 10, [behind, {serial: 'hidden', triangles: [face(4)], ...flags}]).serial, 'behind');
  }
  for (const flags of [{visible: false}, {hidden: true}, {deleted: true}, {alpha: 0}]) {
    const hidden = {serial: 'hidden', triangles: [face(9, flags)], curves: [{screen: [[0, 10, 9], [100, 10, 9]], local: [[0, 0, 0], [1, 0, 0]], ...flags}], points: [{screen: [10, 10, 9], local: [0, 0, 0], ...flags}]};
    assert.equal(pickProjected(10, 10, [behind, hidden]).serial, 'behind');
  }
});

test('clipped vertices, malformed geometry and degenerate faces remain unpickable', () => {
  const clipped = Object.assign([0, 0, 5], {visible: false});
  const item = {serial: 1, triangles: [face(5, {screen: [clipped, [100, 0, 5], [0, 100, 5]]}), face(5, {screen: [[0, 0, 5], [50, 0, 5], [100, 0, 5]]})], curves: [{screen: [clipped, [100, 0, 5]], local: [[0, 0, 0], [1, 0, 0]]}], points: [{screen: clipped, local: [0, 0, 0]}, {screen: [NaN, 0, 9], local: [0, 0, 0]}]};
  assert.equal(pickProjected(0, 0, [item]), null);
  assert.equal(pickProjected(NaN, 0, [item]), null);
  assert.equal(pickProjected(0, Infinity, [item]), null);
  assert.equal(pickProjected(0, 0, null), null);
  assert.equal(pickProjected(0, 0, [null, {triangles: [{}], curves: [{}], points: [{}]}]), null);
});

test('flight camera projection returns precise local hits after orbit, pan, zoom and object transforms', () => {
  const local = [[-1.2, -.6, -.2], [1.1, -.4, .8], [-.2, 1.3, -.4]];
  const transform = point => {
    const angle = .8, x = point[0] * Math.cos(angle) - point[2] * Math.sin(angle), z = point[0] * Math.sin(angle) + point[2] * Math.cos(angle);
    return [x * 2.3 - 2.1, point[1] * 2.3 + .8, z * 2.3 + 3.2];
  };
  const weights = [.2, .35, .45];
  const expectedLocal = [0, 1, 2].map(axis => local.reduce((sum, point, i) => sum + point[axis] * weights[i], 0));
  const expectedWorld = transform(expectedLocal);
  for (const time of [0, 5, 10]) {
    const camera = {...automaticCamera(time), yaw: .4, pitch: -.15, panX: .13, panY: -.09, zoom: 1.4};
    const projector = createProjector(camera);
    const {view} = projectionParameters(1188, 762, {scale: 45, cx: 590, cy: 340}, camera);
    const screenOf = point => {
      const projected = projector(point);
      return Object.assign([view.cx + projected[0] * view.scale, view.cy + projected[1] * view.scale, projected[2]], {visible: projected.visible, cameraDepth: projected.cameraDepth});
    };
    const world = local.map(transform), screen = world.map(screenOf), clicked = screenOf(expectedWorld);
    const hit = pickProjected(clicked[0], clicked[1], [{serial: 27, triangles: [{screen, local, world}]}]);
    assert.ok(hit);
    close(hit.local, expectedLocal);
    close(hit.world, expectedWorld);
    assert.ok(Math.abs(hit.depth - clicked[2]) < 1e-9);
    // The same precision applies to a sloped segment under perspective.
    const t = .35, segmentLocal = local[0].map((value, i) => value + (local[1][i] - value) * t);
    const segmentWorld = transform(segmentLocal), lineClick = screenOf(segmentWorld);
    const lineHit = pickProjected(lineClick[0], lineClick[1], [{serial: 27, curves: [{screen: screen.slice(0, 2), local: local.slice(0, 2), world: world.slice(0, 2)}]}]);
    close(lineHit.local, segmentLocal);
    close(lineHit.world, segmentWorld);
  }
});

test('actual flight-camera clipping excludes samples behind the eye', () => {
  const camera = automaticCamera(4), basis = cameraBasis(camera), project = createProjector(camera);
  const world = basis.eye.map((value, axis) => value + basis.direction[axis]);
  const screen = project(world);
  assert.equal(screen.visible, false);
  assert.equal(pickProjected(screen[0], screen[1], [{serial: 3, points: [{screen, local: [0, 0, 0], world}]}]), null);
});

test('projector multiplier preserves affine interpolation in orthographic views', () => {
  for (const perspective of [false, true]) {
    const camera = {...automaticCamera(5), perspective}, projector = createProjector(camera);
    const local = [[-2, -1, -3], [2, -1, 3], [0, 3, 1]];
    const expected = [.25, .25, .5];
    const position = [0, 1, 2].map(axis => local.reduce((sum, point, i) => sum + point[axis] * expected[i], 0));
    const screen = local.map(projector), click = projector(position);
    const hit = pickProjected(click[0], click[1], [{serial: 1, triangles: [{screen, local}]}]);
    assert.ok(hit);
    close(hit.local, position);
  }
});

test('selection leaves submitted geometry unchanged and does not keep old frame candidates', () => {
  const triangle = face(2), item = {serial: 3, triangles: [triangle]};
  const snapshot = structuredClone(item);
  const hit = pickProjected(25, 25, [item]);
  hit.local[0] = 900;
  assert.deepEqual(item, snapshot);
  assert.equal(pickProjected(25, 25, []), null);
});
