import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareArchive, makeInstance, instanceFrame} from '../src/archive.js';
import {sampleEdgeField, MAX_FIELD_EDGES, MAX_FIELD_SEGMENTS} from '../src/edge-field.js';
import {patchIndex} from '../src/surface-patches.js';
import {createRippleState, emitRipple, advanceRipples, deformRipplePoint, createRippleDeformer, RIPPLE_DURATION} from '../src/ripple.js';

const groups = JSON.parse(readFileSync(new URL('../public/models/sculpture-wireframes.json', import.meta.url))).groups;
const models = prepareArchive(groups);
const makeFrame = (index = 0, elapsed = 0) => {
  const instance = makeInstance(index + 1, 0);
  return instanceFrame(models[index], instance, elapsed);
};
const edgeKey = edge => edge.join('/');
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const groupCurves = curves => {
  const groups = new Map();
  for (const curve of curves) {
    const key = edgeKey(curve.edge);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(curve);
  }
  return groups;
};

test('curves come only from actual surviving source edges, with no point layer and honest logical counts', () => {
  for (let model = 0; model < models.length; model++) {
    for (const elapsed of [0, 12, 23, 35, 48]) {
      const frame = makeFrame(model, elapsed);
      const before = frame.activeEdges.map(edge => edge.slice());
      const sampled = sampleEdgeField(frame, {elapsed, edgeBudget: 71, pointBudget: 49});
      const active = new Set(frame.activeEdges.map(edgeKey));
      assert.equal(sampled.logicalEdges, frame.edgeCount);
      assert.equal(sampled.curves.length, Math.min(71, frame.activeEdges.length));
      assert.equal(new Set(sampled.curves.map(c => c.edge.slice().sort((a, b) => a - b).join('/'))).size, sampled.curves.length);
      assert.ok(sampled.curves.every(curve => active.has(edgeKey(curve.edge))));
      assert.deepEqual(sampled.points, []);
      assert.deepEqual(frame.activeEdges, before);
      assert.equal(sampled.renderedPoints, 0);
      assert.equal(sampled.renderedSegments, sampled.curves.reduce((sum, c) => sum + c.points.length - 1, 0));
    }
  }
});

test('every selected source edge is exactly one continuous straight polyline with exact endpoints', () => {
  for (let index = 0; index < models.length; index++) {
    const frame = makeFrame(index, 0);
    const sampled = sampleEdgeField(frame, {elapsed: 3, edgeBudget: 64, segments: 5});
    assert.equal(sampled.curves.length, 64);
    assert.equal(groupCurves(sampled.curves).size, sampled.curves.length);
    assert.equal(sampled.renderedSegments, sampled.curves.length * 5);
    for (const curve of sampled.curves) {
      const [a, b] = curve.edge, start = frame.vertices[a], end = frame.vertices[b];
      assert.equal(curve.points.length, 6);
      assert.deepEqual(curve.points[0], start);
      assert.deepEqual(curve.points.at(-1), end);
      for (let i = 1; i < 5; i++) {
        const expected = start.map((v, axis) => v + (end[axis] - v) * (i / 5));
        assert.deepEqual(curve.points[i], expected);
      }
    }
  }
});

test('duplicate and reversed source identities never create overlaid polylines', () => {
  const vertices = [[0, 0, 0], [1, 0, 0], [1, 1, 0]];
  const frame = {vertices, activeEdges: [[0, 1], [1, 0], [0, 1], [1, 2], [2, 1]], edgeCount: 2};
  const sampled = sampleEdgeField(frame, {edgeBudget: 99, segments: 5});
  assert.equal(sampled.logicalEdges, 2);
  assert.equal(sampled.curves.length, 2);
  assert.equal(new Set(sampled.curves.map(c => c.edge.slice().sort().join('/'))).size, 2);
  assert.equal(sampled.renderedSegments, 10);
});

test('only the shared mesh ripple bends sampled edges, coherently and without gaps', () => {
  const vertices = [[-.6, .15, 0], [.6, .15, 0]];
  const frame = {vertices, activeEdges: [[0, 1]], edgeCount: 1};
  const sampled = sampleEdgeField(frame, {segments: 6});
  const rest = sampled.curves[0], ripples = createRippleState();
  assert.ok(emitRipple(ripples, {serial: 7, origin: [0, 0, 0]}));
  advanceRipples(ripples, .1);
  const deformMesh = createRippleDeformer(ripples, 7);
  const bent = rest.points.map(point => deformRipplePoint(ripples, 7, point));
  rest.points.forEach((point, i) => assert.deepEqual(bent[i], deformMesh(...point, [0, 0, 0])));
  assert.deepEqual(bent[0], deformRipplePoint(ripples, 7, vertices[0]));
  assert.deepEqual(bent.at(-1), deformRipplePoint(ripples, 7, vertices[1]));
  const chordMidpoint = bent[0].map((v, axis) => (v + bent.at(-1)[axis]) * .5);
  assert.ok(distance(bent[3], chordMidpoint) > .01, 'shared nonlinear deformation bends the edge');
  assert.equal(bent.length, rest.points.length);
  assert.deepEqual(sampleEdgeField(frame, {segments: 6, elapsed: .1}), sampled);
  assert.deepEqual(rest.points.map(p => deformRipplePoint(ripples, 8, p)), rest.points);
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.deepEqual(rest.points.map(p => deformRipplePoint(ripples, 7, p)), rest.points);
});

test('patch assignment uses the original edge midpoint throughout quantization', () => {
  const frame = makeFrame(0, 20);
  const sampled = sampleEdgeField(frame, {elapsed: 20, edgeBudget: 100});
  const original = frame.model.stages[0].vertices;
  for (const curve of sampled.curves) {
    const [a, b] = curve.edge;
    assert.equal(curve.patch, patchIndex(original[a].map((v, i) => (v + original[b][i]) * .5)));
    const fragments = sampled.curves.filter(c => edgeKey(c.edge) === edgeKey(curve.edge));
    assert.deepEqual(fragments[0].points[0], frame.vertices[a]);
    assert.deepEqual(fragments.at(-1).points.at(-1), frame.vertices[b]);
  }
});

test('elapsed time and reduced motion never gate, bow, split, or pulse source lines', () => {
  const frame = makeFrame(2);
  const options = {edgeBudget: 60, segments: 6};
  const first = sampleEdgeField(frame, options);
  assert.equal(first.curves.length, 60);
  assert.ok(first.curves.every(curve => curve.alpha === 1));
  for (const reducedMotion of [false, true]) {
    for (const elapsed of [0, .033, .2, 1, 2.5, 5, 20, 10000, NaN, Infinity]) {
      assert.deepEqual(sampleEdgeField(frame, {...options, elapsed, reducedMotion}), first);
    }
  }
  assert.deepEqual(first.points, []);
});

test('empty stages never regenerate lines or points, regardless of budgets', () => {
  for (let model = 0; model < models.length; model++) {
    const frame = makeFrame(model, 100);
    assert.equal(frame.edgeCount, 0);
    assert.deepEqual(sampleEdgeField(frame, {elapsed: 100, edgeBudget: 10000, pointBudget: 10000}), {
      curves: [], points: [], logicalEdges: 0, renderedSegments: 0, renderedPoints: 0,
    });
  }
});

test('work and output remain bounded without scanning unselected edges', () => {
  const frame = makeFrame(1);
  let reads = 0;
  frame.activeEdges = new Proxy(frame.activeEdges, {get(target, key) {
    if (/^\d+$/.test(String(key))) reads++;
    return Reflect.get(target, key);
  }});
  const limited = sampleEdgeField(frame, {edgeBudget: 17, segments: 3, pointBudget: 13});
  assert.equal(reads, 17);
  assert.equal(limited.curves.length, 17);
  assert.ok(limited.renderedSegments <= 51);
  assert.equal(limited.renderedPoints, 0);
  assert.deepEqual(limited.points, []);
  const huge = sampleEdgeField(frame, {edgeBudget: 1e9, segments: 1e9, pointBudget: 1e9});
  assert.ok(huge.curves.length <= MAX_FIELD_EDGES);
  assert.ok(huge.renderedSegments <= MAX_FIELD_EDGES * MAX_FIELD_SEGMENTS);
  assert.equal(huge.renderedPoints, 0);
  assert.deepEqual(huge.points, []);
  assert.equal(sampleEdgeField(frame, {edgeBudget: 0}).renderedSegments, 0);
  assert.equal(sampleEdgeField(frame, {pointBudget: 0}).renderedPoints, 0);
});

test('one-segment quality mode stays bounded and collapsed or malformed edges are skipped', () => {
  const frame = makeFrame();
  const low = sampleEdgeField(frame, {edgeBudget: 8, segments: 1});
  assert.equal(low.renderedSegments, 8);
  assert.equal(low.curves.length, 8);
  const invalid = {...frame, activeEdges: [[0, 0], [999999, 1]], edgeCount: 2};
  const skipped = sampleEdgeField(invalid);
  assert.equal(skipped.logicalEdges, 2);
  assert.equal(skipped.renderedSegments, 0);
  assert.equal(skipped.renderedPoints, 0);
});

test('all finite coordinates remain local to the surviving source forms', () => {
  for (let model = 0; model < models.length; model++) {
    for (const elapsed of [0, 2.5, 5, 15, 25, 35, 45]) {
      const frame = makeFrame(model, elapsed), sampled = sampleEdgeField(frame, {elapsed, edgeBudget: 65});
      for (const curve of sampled.curves) {
        const [a, b] = curve.edge, length = distance(frame.vertices[a], frame.vertices[b]);
        for (const point of curve.points) {
          assert.ok(point.every(Number.isFinite));
          assert.ok(distance(point, frame.vertices[a]) <= length * 1.5);
        }
      }
      assert.deepEqual(sampled.points, []);
    }
  }
});


test('legacy point budgets cannot produce a point layer at any phase or quality', () => {
  const frame = makeFrame(1);
  const baseline = sampleEdgeField(frame, {elapsed: 2});
  for (const pointBudget of [0, 1, 128, 1e9, Infinity, NaN]) {
    assert.deepEqual(sampleEdgeField(frame, {elapsed: 2, pointBudget}), baseline);
  }
  for (const reducedMotion of [false, true]) {
    for (const elapsed of [0, .2, 1, 2.4, 4.8, 10, 50]) {
      const field = sampleEdgeField(frame, {elapsed, reducedMotion, pointBudget: 1e9});
      assert.deepEqual(field.points, []);
      assert.equal(field.renderedPoints, 0);
      assert.ok(field.renderedSegments > 0);
    }
  }
});
