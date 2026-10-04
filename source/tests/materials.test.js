import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeInstance} from '../src/archive.js';
import {MATERIAL_KINDS, MATERIAL_NAMES, materialFor, materialIndexFor, shadeFacet, hatchTriangle} from '../src/materials.js';

const base = {normal: [.3, .7, -.5], view: [0, .3, 1], center: [.2, -.1, .6], seed: 57};
const triangle = [[10, 20], [210, 30], [30, 220]];
const source = [[0, 0, 0], [2, 0, 0], [0, 2, 0]];
function barycentric(p, [a, b, c]) {
  const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const u = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / denominator;
  const v = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / denominator;
  return [u, v, 1 - u - v];
}

test('material intake assignment is deterministic, immutable, and covers the complete palette', () => {
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) {
    assert.deepEqual(materialFor(seed), materialFor(seed));
    assert.ok(Object.isFrozen(materialFor(seed)));
    seen.add(materialFor(seed).kind);
  }
  assert.deepEqual([...seen].sort(), [...MATERIAL_KINDS.slice(0,10)].sort());
  assert.deepEqual(materialFor(NaN), materialFor(0));
});

test('intake material indices are seeded, bounded, and keep color accents restrained', () => {
  assert.deepEqual(MATERIAL_KINDS.slice(0, 4), ['metal', 'matte', 'translucent', 'cut']);
  assert.deepEqual(MATERIAL_KINDS.slice(0, 8), ['metal', 'matte', 'translucent', 'cut', 'smoked', 'cobalt', 'oxide', 'amber']);
  assert.equal(MATERIAL_KINDS.length, 11);
  assert.equal(MATERIAL_KINDS[10], 'white');
  assert.ok(MATERIAL_KINDS.every(kind => MATERIAL_NAMES[kind]));
  const initial = Array.from({length: 12}, (_, i) => makeInstance(i + 1, 0, 271828).materialIndex);
  assert.deepEqual(initial.slice(0, 4), [0, 1, 2, 3]);
  assert.equal(new Set(initial).size, 10);
  assert.equal(initial.filter(index => index >= 5 && index < 8).length, 3);
  assert.equal(initial.filter(index => index >= 8).length, 2);
  for (const seed of [0, 1, 271828, 999999]) {
    const instances = Array.from({length: 2000}, (_, i) => makeInstance(i + 13, 0, seed));
    for (const instance of instances) {
      assert.ok(Number.isInteger(instance.materialIndex) && instance.materialIndex >= 0 && instance.materialIndex < MATERIAL_KINDS.length);
      assert.deepEqual(instance, makeInstance(instance.serial, 0, seed));
    }
    const fraction = instances.filter(instance => instance.materialIndex >= 8).length / instances.length;
    assert.ok(fraction >= .20 && fraction <= .25, `gradient fraction ${fraction} for seed ${seed}`);
  }
  assert.equal(materialIndexFor(NaN), materialIndexFor(0));
  assert.notDeepEqual(Array.from({length: 100}, (_, i) => makeInstance(i + 13, 0, 1).materialIndex), Array.from({length: 100}, (_, i) => makeInstance(i + 13, 0, 2).materialIndex));
});

test('the eleven fallback materials have distinct bounded neutral and tinted canvas styles', () => {
  const styles = MATERIAL_KINDS.map(material => shadeFacet({...base, material}));
  assert.equal(new Set(styles.map(s => `${s.fill}/${s.alpha}/${s.edge}/${Boolean(s.hatch)}`)).size, MATERIAL_KINDS.length);
  assert.ok(styles[2].alpha < .13 && styles[1].alpha > .4);
  assert.ok(styles[3].hatch && styles[3].hatch.spacing > 0);
  assert.ok(styles[4].alpha > styles[2].alpha);
  const channels = color => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  const cobalt = channels(styles[5].fill), oxide = channels(styles[6].fill), amber = channels(styles[7].fill);
  assert.ok(cobalt[2] > cobalt[1] && cobalt[1] > cobalt[0]);
  assert.ok(oxide[0] > oxide[1] && oxide[1] > oxide[2]);
  assert.ok(amber[0] > amber[1] && amber[1] > amber[2]);
  assert.equal(new Set([styles[5].fill, styles[6].fill, styles[7].fill]).size, 3);
  for (const s of styles) {
    for (const key of ['fill', 'edge', 'highlight']) {
      assert.match(s[key], /^#[0-9a-f]{6}$/);
    }
    for (const key of ['alpha', 'edgeAlpha', 'highlightAlpha', 'specular', 'diffuse']) assert.ok(Number.isFinite(s[key]) && s[key] >= 0 && s[key] <= 1);
    assert.ok(s.lineWidth >= .5 && s.lineWidth <= 1);
  }
});

test('metallic reflection responds strongly and continuously to the camera while matte does not', () => {
  const front = {...base, normal: [0, 0, 1], view: [-.35, -.83, -.42]};
  const back = {...front, view: [.35, .83, .42]};
  const bright = shadeFacet({...front, material: 'metal'}), dark = shadeFacet({...back, material: 'metal'});
  assert.ok(Math.abs(bright.specular - dark.specular) > .5);
  assert.notEqual(bright.fill, dark.fill);
  assert.deepEqual(shadeFacet({...front, material: 'matte'}), shadeFacet({...back, material: 'matte'}));
  for (let angle = -3; angle < 3; angle += .07) {
    const a = shadeFacet({...front, material: 'metal', view: [Math.sin(angle), 0, Math.cos(angle)]});
    const b = shadeFacet({...front, material: 'metal', view: [Math.sin(angle + .0001), 0, Math.cos(angle + .0001)]});
    assert.ok(Math.abs(a.specular - b.specular) < .002);
  }
});

test('shading is time-stable with no per-frame randomness or mutation', () => {
  const before = JSON.stringify(base), random = Math.random;
  Math.random = () => { throw new Error('per-frame randomness'); };
  try {
    for (const material of MATERIAL_KINDS) assert.deepEqual(shadeFacet({...base, material, elapsed: 0}), shadeFacet({...base, material, elapsed: 1e9}));
    assert.deepEqual(hatchTriangle(triangle, {sourceTriangle: source, seed: 8}), hatchTriangle(triangle, {sourceTriangle: source, seed: 8}));
  } finally { Math.random = random; }
  assert.equal(JSON.stringify(base), before);
});

test('all hatch endpoints remain inside their original projected triangle', () => {
  for (let seed = 0; seed < 20; seed++) for (const t of [triangle, [...triangle].reverse()]) {
    const segments = hatchTriangle(t, {seed, spacing: 3});
    assert.ok(segments.length > 0 && segments.length <= 14);
    for (const segment of segments) for (const p of segment) {
      assert.ok(p.every(Number.isFinite));
      assert.ok(barycentric(p, t).every(w => w >= -1e-7 && w <= 1 + 1e-7));
    }
  }
});

test('source-anchored hatch segments follow the actual plane section band', () => {
  const options = {sourceTriangle: source, cutY: .8, bandWidth: .16, spacing: .04, seed: 11};
  const segments = hatchTriangle(triangle, options);
  assert.ok(segments.length > 0);
  for (const segment of segments) for (const p of segment) {
    const weights = barycentric(p, triangle), sourceY = weights.reduce((sum, w, i) => sum + w * source[i][1], 0);
    assert.ok(weights.every(w => w >= -1e-7));
    assert.ok(sourceY >= .72 - 1e-7 && sourceY <= .88 + 1e-7);
  }
  assert.deepEqual(hatchTriangle(triangle, {...options, cutY: 4}), []);
  assert.deepEqual(hatchTriangle(triangle, {...options, bandWidth: 0}), []);
});

test('source-anchored hatches transform with projected geometry and align across adjacent facets', () => {
  const options = {sourceTriangle: source, spacing: .1, seed: 2};
  const segments = hatchTriangle(triangle, options);
  const shifted = hatchTriangle(triangle.map(p => [p[0] * 2 + 21, p[1] * 2 - 33]), options);
  assert.equal(shifted.length, segments.length);
  for (let i = 0; i < segments.length; i++) for (let j = 0; j < 2; j++) {
    assert.ok(Math.abs(shifted[i][j][0] - (segments[i][j][0] * 2 + 21)) < 1e-6);
    assert.ok(Math.abs(shifted[i][j][1] - (segments[i][j][1] * 2 - 33)) < 1e-6);
  }
  // No per-face seed: both triangles use the same source-coordinate grid.
  const squareA = [[0, 0], [100, 0], [0, 100]], squareB = [[100, 0], [100, 100], [0, 100]];
  const a = hatchTriangle(squareA, {sourceTriangle: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], seed: 17, spacing: .2, angle: 0});
  const b = hatchTriangle(squareB, {sourceTriangle: [[1, 0, 0], [1, 1, 0], [0, 1, 0]], seed: 17, spacing: .2, angle: 0});
  // Each hatch crosses the shared diagonal at the same exact source point.
  const diagonalEnds = segments => segments.flat().filter(p => Math.abs(p[0] + p[1] - 100) < 1e-7).sort((p, q) => p[1] - q[1]);
  const endA = diagonalEnds(a), endB = diagonalEnds(b);
  assert.ok(endA.length >= 4);
  assert.equal(endA.length, endB.length);
  for (let i = 0; i < endA.length; i++) assert.ok(Math.hypot(endA[i][0] - endB[i][0], endA[i][1] - endB[i][1]) < 1e-7);
  for (const seg of [...a, ...b]) {
    const levelA = seg[0][1] / 100;
    const levelB = seg[1][1] / 100;
    assert.ok(Math.abs(levelA - levelB) < 1e-7);
  }
});

test('invalid or degenerate input is harmless and hatch work has a strict bound', () => {
  for (const t of [[], [[0, 0], [1, 1], [2, 2]], [[0, 0], [Infinity, 1], [2, 2]], [[0, 0], [NaN, 1], [2, 2]]]) assert.deepEqual(hatchTriangle(t), []);
  assert.deepEqual(hatchTriangle(triangle, {sourceTriangle: [[0, 0, NaN], [1, 0, 0], [0, 1, 0]]}), []);
  assert.deepEqual(hatchTriangle(triangle, {cutY: 0}), []);
  assert.deepEqual(hatchTriangle(triangle, {maxSegments: 0}), []);
  assert.ok(hatchTriangle([[0, 0], [1e8, 0], [0, 1e8]], {spacing: 1e-30, maxSegments: 1e9}).length <= 32);
  assert.ok(hatchTriangle(triangle).length <= 6);
  for (const material of [...MATERIAL_KINDS, null, 'unknown']) {
    const style = shadeFacet({material, normal: [NaN, Infinity, 0], view: [0, 0, 0], center: [Infinity, NaN], seed: Infinity});
    for (const value of Object.values(style)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
  }
});
