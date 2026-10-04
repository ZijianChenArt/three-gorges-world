import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareArchive, makeInstance, instanceFrame} from '../src/archive.js';
import {sampleEdgeField, MAX_FIELD_EDGES, MAX_FIELD_SEGMENTS} from '../src/edge-field.js';
import {patchIndex} from '../src/surface-patches.js';

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
      assert.ok(sampled.curves.every(curve => active.has(edgeKey(curve.edge))));
      assert.deepEqual(sampled.points, []);
      assert.deepEqual(frame.activeEdges, before);
      assert.equal(sampled.renderedPoints, 0);
      assert.equal(sampled.renderedSegments, sampled.curves.reduce((sum, c) => sum + c.points.length - 1, 0));
    }
  }
});

test('each source edge keeps its exact current endpoints, with real visibly bent intermediate vertices', () => {
  for (let index = 0; index < models.length; index++) {
    const frame = makeFrame(index, 0);
    const sampled = sampleEdgeField(frame, {elapsed: 3, edgeBudget: 64, segments: 5});
    let noticeablyBent = 0;
    for (const fragments of groupCurves(sampled.curves).values()) {
      const [a, b] = fragments[0].edge, start = frame.vertices[a], end = frame.vertices[b];
      assert.deepEqual(fragments[0].points[0], start);
      assert.deepEqual(fragments.at(-1).points.at(-1), end);
      const delta = end.map((v, i) => v - start[i]), length = Math.hypot(...delta);
      const offLine = fragments.flatMap(c => c.points).map(point => {
        const rel = point.map((v, i) => v - start[i]);
        const t = rel.reduce((sum, v, i) => sum + v * delta[i], 0) / (length * length);
        return distance(point, start.map((v, i) => v + t * delta[i]));
      });
      if (Math.max(...offLine) > length * .08) noticeablyBent++;
    }
    assert.ok(noticeablyBent > 40, `source ${index} has substantial curved edge coverage`);
  }
});

test('interior splitting removes part of the same source arc without adding new endpoints or excess segments', () => {
  const frame = makeFrame(1);
  const sampled = sampleEdgeField(frame, {elapsed: 2, edgeBudget: 96, segments: 5});
  const byEdge = groupCurves(sampled.curves);
  const split = [...byEdge.values()].filter(fragments => fragments.length === 2);
  assert.ok(split.length > 25 && split.length < 85);
  for (const fragments of byEdge.values()) {
    assert.equal(fragments.reduce((n, curve) => n + curve.points.length - 1, 0), 5);
    assert.ok(fragments.length <= 2);
    if (fragments.length === 2) assert.ok(distance(fragments[0].points.at(-1), fragments[1].points[0]) > 0);
  }
  const moved = groupCurves(sampleEdgeField(frame, {elapsed: 5, edgeBudget: 96}).curves);
  assert.ok(split.some(fragments => distance(fragments[0].points.at(-1), moved.get(edgeKey(fragments[0].edge))[0].points.at(-1)) > .002));
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

test('selection is deterministic and independent of time, with healthy first-five-seconds change', () => {
  const frame = makeFrame(2);
  const options = {elapsed: 0, edgeBudget: 60, pointBudget: 50};
  const first = sampleEdgeField(frame, options), later = sampleEdgeField(frame, {...options, elapsed: 5});
  assert.deepEqual(first, sampleEdgeField(frame, options));
  assert.deepEqual(first.curves.map(c => c.edge), later.curves.map(c => c.edge));
  assert.notDeepEqual(first.curves.map(c => c.points), later.curves.map(c => c.points));
  assert.ok(first.curves.some((c, i) => Math.abs(c.alpha - later.curves[i].alpha) > .08));
  assert.deepEqual(first.points, []);
  assert.deepEqual(later.points, []);
});

test('fixed elapsed freezes all changes and reduced motion is static for arbitrarily later elapsed', () => {
  const frame = makeFrame();
  assert.deepEqual(sampleEdgeField(frame, {elapsed: 2}), sampleEdgeField(frame, {elapsed: 2}));
  const still = sampleEdgeField(frame, {elapsed: 0, reducedMotion: true});
  assert.deepEqual(still, sampleEdgeField(frame, {elapsed: 10000, reducedMotion: true}));
  assert.ok(still.curves.length > 0);
  assert.deepEqual(still.points, []);
});

test('local continuous alpha envelopes differ spatially without abrupt high-contrast flashes', () => {
  const frame = makeFrame(1);
  let previous = sampleEdgeField(frame, {elapsed: 0, edgeBudget: 24, pointBudget: 24});
  assert.ok(new Set(previous.curves.map(c => c.alpha.toFixed(3))).size > 12);
  for (let step = 1; step <= 480; step++) {
    const next = sampleEdgeField(frame, {elapsed: step / 30, edgeBudget: 24, pointBudget: 24});
    for (let i = 0; i < next.curves.length; i++) {
      assert.ok(next.curves[i].alpha >= 0 && next.curves[i].alpha <= 1);
      assert.ok(Math.abs(next.curves[i].alpha - previous.curves[i].alpha) < .03);
    }
    assert.deepEqual(next.points, []);
    previous = next;
  }
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
  assert.ok(limited.curves.length <= 34);
  assert.ok(limited.renderedSegments <= 51);
  assert.equal(limited.renderedPoints, 0);
  assert.deepEqual(limited.points, []);
  const huge = sampleEdgeField(frame, {edgeBudget: 1e9, segments: 1e9, pointBudget: 1e9});
  assert.ok(huge.curves.length <= MAX_FIELD_EDGES * 2);
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
