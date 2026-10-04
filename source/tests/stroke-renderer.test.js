import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {StrokeRenderer, SEGMENT_CAP} from '../src/stroke-renderer.js';
import {sampleEdgeField} from '../src/edge-field.js';
import {createRippleState, emitRipple, advanceRipples, deformRipplePoint, RIPPLE_DURATION} from '../src/ripple.js';

const assertLineOnly = (scene, renderer) => {
  assert.deepEqual(scene.children, [renderer.lines]);
  scene.traverse(object => assert.equal(!!object.isPoints, false));
  for (const name of ['points', 'pointPositions', 'pointColors', 'pointTexture']) {
    assert.equal(name in renderer, false, `${name} must not allocate a point-layer resource`);
  }
  assert.equal(renderer.renderedPoints, 0);
  assert.equal(renderer.lines.material.map, null);
};

test('actual Three line buffers use supplied source-derived positions and truthful draw ranges', () => {
  const scene = new THREE.Scene(), renderer = new StrokeRenderer(scene);
  const field = {curves: [{points: [[1, 2, 3], [2, 3, 4], [3, 4, 5]], alpha: .8}]};
  assertLineOnly(scene, renderer);
  renderer.update([field]);
  assert.equal(renderer.renderedSegments, 2);
  assert.equal(renderer.lines.geometry.drawRange.count, 4);
  assert.deepEqual(Array.from(renderer.linePositions.slice(0, 6)), [1, 2, 3, 2, 3, 4]);
  assert.ok(renderer.lines.isLineSegments);
  assert.ok(renderer.lines.material.depthTest);
  assertLineOnly(scene, renderer);
  renderer.update([]);
  assert.equal(renderer.renderedSegments, 0);
  assert.equal(renderer.lines.geometry.drawRange.count, 0);
  assert.equal(renderer.lines.visible, false);
  assertLineOnly(scene, renderer);
  renderer.dispose();
  assert.equal(scene.children.length, 0);
});

test('one-pixel line opacity stays subtle and stable while supplied pulse tint is preserved', () => {
  const scene = new THREE.Scene(), renderer = new StrokeRenderer(scene);
  const curve = {points: [[0, 0, 0], [.5, 0, 0], [1, 0, 0]], alpha: 1};
  assert.equal(renderer.lines.material.opacity, .55);
  assert.equal(renderer.lines.material.linewidth, 1);
  renderer.update([{curves: [curve]}]);
  const original = Array.from(renderer.lineColors.slice(0, 12));
  for (const color of [[.1, .8, .9], [.85, .1, .7]]) {
    renderer.update([{curves: [{...curve, color}]}]);
    assert.equal(renderer.lines.material.opacity, .55);
    assert.equal(renderer.renderedSegments, 2);
    for (let at = 0; at < 12; at += 3) {
      assert.deepEqual(Array.from(renderer.lineColors.slice(at, at + 3)), color.map(Math.fround));
    }
    assertLineOnly(scene, renderer);
  }
  renderer.update([{curves: [curve]}]);
  assert.deepEqual(Array.from(renderer.lineColors.slice(0, 12)), original);
  renderer.dispose();
});

test('line GPU memory stays fixed and bounded under oversize input', () => {
  const scene = new THREE.Scene(), renderer = new StrokeRenderer(scene);
  const positions = renderer.linePositions, colors = renderer.lineColors;
  const field = {curves: [{points: Array.from({length: SEGMENT_CAP + 50}, (_, i) => [i, 0, 0]), alpha: 1}]};
  for (let i = 0; i < 3; i++) renderer.update([field]);
  assert.equal(renderer.renderedSegments, SEGMENT_CAP);
  assert.equal(renderer.lines.geometry.drawRange.count, SEGMENT_CAP * 2);
  assert.equal(renderer.linePositions, positions);
  assert.equal(renderer.lineColors, colors);
  assert.equal(positions.length, SEGMENT_CAP * 6);
  assert.equal(colors.length, SEGMENT_CAP * 6);
  assertLineOnly(scene, renderer);
  renderer.dispose();
});

test('legacy point input is never read and cannot create visible dots on desktop or phone', () => {
  for (const phone of [false, true]) {
    const scene = new THREE.Scene(), renderer = new StrokeRenderer(scene, {phone});
    const field = {curves: [], get points() { throw new Error('Removed point layer must not be visited'); }};
    renderer.update([field]);
    assert.equal(renderer.lines.visible, false);
    assertLineOnly(scene, renderer);
    renderer.dispose();
  }
});

test('source curves still scatter only on the selected model and gather without introducing point objects', () => {
  const vertices = [[-.6, 0, 0], [.6, .2, 0], [0, .7, .4]];
  const frame = {vertices, activeEdges: [[0, 1], [1, 2]], edgeCount: 2, instance: {key: 17}};
  const sampled = sampleEdgeField(frame, {elapsed: 2, edgeBudget: 2, segments: 5});
  const scene = new THREE.Scene(), renderer = new StrokeRenderer(scene);
  const ripples = createRippleState();
  const fields = () => [1, 2].map(serial => ({
    ...sampled,
    curves: sampled.curves.map(curve => ({...curve, points: curve.points.map(point => deformRipplePoint(ripples, serial, point))})),
  }));
  renderer.update(fields());
  const count = renderer.renderedSegments * 6, perModel = count / 2;
  const baseline = Array.from(renderer.linePositions.slice(0, count));
  assert.ok(emitRipple(ripples, {serial: 1, origin: [0, 0, 0]}));
  for (const elapsed of [0, .033, .2, .5, .7, RIPPLE_DURATION]) {
    advanceRipples(ripples, elapsed - ripples.elapsed);
    const next = fields();
    assert.ok(next.every(field => field.points.length === 0 && field.renderedPoints === 0));
    renderer.update(next);
    const actual = Array.from(renderer.linePositions.slice(0, count));
    assert.equal(renderer.renderedSegments, sampled.renderedSegments * 2);
    assert.ok(renderer.renderedSegments <= SEGMENT_CAP);
    assert.deepEqual(actual.slice(perModel), baseline.slice(perModel));
    if (elapsed === .2) assert.notDeepEqual(actual.slice(0, perModel), baseline.slice(0, perModel));
    if (elapsed === 0 || elapsed === RIPPLE_DURATION) assert.deepEqual(actual, baseline);
    assertLineOnly(scene, renderer);
  }
  renderer.dispose();
});

test('line disposal releases both GPU resources and removes the sole scene object', () => {
  const scene = new THREE.Scene(), renderer = new StrokeRenderer(scene);
  let geometryDisposals = 0, materialDisposals = 0;
  renderer.lines.geometry.addEventListener('dispose', () => geometryDisposals++);
  renderer.lines.material.addEventListener('dispose', () => materialDisposals++);
  renderer.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.deepEqual(scene.children, []);
});
