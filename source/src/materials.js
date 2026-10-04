import {gradientColor, gradientHeight} from './physical-gradients.js';

/**
 * Shared material palette with deliberately stylized Canvas fallback shading.
 * Only the WebGL renderer provides physically based transmission/reflections.
 * All variation comes from instance seeds, geometry and the current view. Time
 * never drives a blink, a random sample or a texture animation.
 */
export const MATERIAL_KINDS = Object.freeze(['metal', 'matte', 'translucent', 'cut', 'smoked', 'cobalt', 'oxide', 'amber', 'acid-glass', 'acid-metal', 'white']);
export const WHITE_MATERIAL_INDEX = 10;
export const MATERIAL_NAMES = Object.freeze({metal: 'POLISHED CHROME', matte: 'ROUGH METAL', translucent: 'CLEAR GLASS', cut: 'SATIN CUT METAL', smoked: 'SMOKED GLASS', cobalt: 'COBALT LACQUER', oxide: 'OXIDE CERAMIC', amber: 'AMBER GLASS', 'acid-glass': 'LIME VIOLET GLASS', 'acid-metal': 'VIOLET BLUE METAL', white: 'WHITE CUBE'});
// Preserve all eight existing indices. Only two duplicate opening finishes
// become gradients; all ten finishes are represented in the twelve intakes.
const INITIAL_MATERIALS = Object.freeze([0, 1, 2, 3, 4, 5, 8, 6, 9, 7, 2, 3]);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vector = (v, fallback = [0, 0, 1]) => {
  if (!v || v.length < 3 || !Array.from(v).slice(0, 3).every(Number.isFinite)) return [...fallback];
  const length = Math.hypot(v[0], v[1], v[2]);
  return length > 1e-12 && Number.isFinite(length) ? [v[0] / length, v[1] / length, v[2] / length] : [...fallback];
};
const rgb = values => `#${values.map(n => Math.round(clamp(finite(n, 128), 0, 255)).toString(16).padStart(2, '0')).join('')}`;
const gray = n => rgb([n, n, n]);
const tint = (color, light) => rgb(color.map(n => n * light));
const hash = seed => {
  let n = finite(seed) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return (n ^ (n >>> 15)) >>> 0;
};
const LIGHT = vector([.35, .83, -.42]);

/** Deterministic assignment: 55% neutral, 22% solid color, 23% acid gradients. */
export function materialIndexFor(seed = 0, serial = 0) {
  if (Number.isInteger(serial) && serial >= 1 && serial <= INITIAL_MATERIALS.length) return INITIAL_MATERIALS[serial - 1];
  const value = hash(finite(seed) >>> 0), selector = value / 4294967296;
  if (selector < .55) return Math.floor(selector / .55 * 5);
  if (selector < .77) return 5 + Math.min(2, Math.floor((selector - .55) / .22 * 3));
  return 8 + Math.min(1, Math.floor((selector - .77) / .23 * 2));
}

/** Call once per intake, not per face. No global state or Math.random is used. */
export function materialFor(seed = 0) {
  const stableSeed = finite(seed) >>> 0;
  const kind = MATERIAL_KINDS[materialIndexFor(stableSeed)];
  return Object.freeze({kind, label: MATERIAL_NAMES[kind], seed: stableSeed});
}

/**
 * normal and view share coordinates; view points from the facet to the camera.
 * Returns Canvas2D colors and bounded alpha/line widths. highlight is an
 * optional second fill of the SAME original facet, never an additional shape.
 * Translucent facets should be painted far-to-near with source-over blending.
 * elapsed is accepted for renderer compatibility but intentionally not used.
 */
export function shadeFacet({material = 'matte', normal, view, center, sourceCenter, sourceBounds, seed, elapsed: _elapsed} = {}) {
  const kind = MATERIAL_KINDS.includes(typeof material === 'string' ? material : material?.kind)
    ? (typeof material === 'string' ? material : material.kind) : 'matte';
  const stableSeed = finite(seed, finite(material?.seed)) >>> 0;
  const n = vector(normal), v = vector(view), lightFacing = dot(n, LIGHT);
  const diffuse = clamp(.16 + .84 * Math.abs(lightFacing), 0, 1);
  const grazing = clamp(1 - Math.abs(dot(n, v)), 0, 1);
  const style = {
    kind, fill: gray(110), alpha: .4, edge: '#242424', edgeAlpha: .85,
    lineWidth: .68, highlight: '#f8f8f8', highlightAlpha: 0,
    hatch: null, specular: 0, diffuse,
  };
  if (kind === 'acid-glass' || kind === 'acid-metal') {
    // Compatibility tint sampled from the ORIGINAL source centroid, not a
    // simulated PBR/refraction effect or a random color for each triangle.
    const color = gradientColor(kind, gradientHeight(sourceCenter, sourceBounds));
    const glass = kind === 'acid-glass';
    return {...style, fill: tint(color, glass ? 1 : .62 + .38 * diffuse),
      alpha: glass ? .2 + .08 * grazing : .72,
      edge: tint(color, .45), edgeAlpha: glass ? .54 : .84,
      lineWidth: .65, highlight: '#f7f7ff', highlightAlpha: glass ? .025 * grazing : 0};
  }
  if (kind === 'white') {
    return {...style, fill: gray(186 + 63 * diffuse), alpha: 1,
      edge: '#828582', edgeAlpha: .68, lineWidth: .55};
  }
  if (kind === 'metal') {
    const reflection = n.map((x, i) => 2 * lightFacing * x - LIGHT[i]);
    const alignment = clamp(dot(reflection, v), -1, 1);
    // A broad reflected band plus a small polished glint reads even on phones.
    const band = Math.exp(-Math.pow((alignment - .56) / .29, 2));
    const glint = Math.pow(Math.max(0, alignment), 12);
    const p = [0, 1, 2].map(i => clamp(finite(center?.[i]), -1e6, 1e6));
    const grain = .91 + .09 * Math.cos(dot(p, [.7, 1.2, .4]) * 2.3 + hash(stableSeed) / 4294967296 * Math.PI * 2);
    const specular = clamp((.72 * band + .78 * glint + .08 * grazing * grazing) * grain, 0, 1);
    return {...style, fill: gray(31 + 31 * diffuse + 171 * specular), alpha: .76,
      edge: '#1a1a1a', edgeAlpha: .94, lineWidth: .76,
      highlightAlpha: .27 * specular, specular};
  }
  if (kind === 'matte') {
    // Broad diffuse planes, with no view-dependent highlight.
    return {...style, fill: gray(43 + 99 * diffuse), alpha: .49,
      edge: '#343434', edgeAlpha: .79, lineWidth: .67};
  }
  if (kind === 'translucent' || kind === 'smoked' || kind === 'amber') {
    // Canvas only tints overlapping ORIGINAL facets; it does not simulate refraction.
    const glass = {
      translucent: {fill: '#88908e', edge: '#626d69', alpha: .035, rim: .065, highlight: '#f4f6f2'},
      smoked: {fill: '#46545a', edge: '#38474d', alpha: .14, rim: .11, highlight: '#d4e0e2'},
      amber: {fill: '#e5a82d', edge: '#74552d', alpha: .12, rim: .09, highlight: '#f6e4bd'},
    }[kind];
    return {...style, fill: glass.fill, alpha: glass.alpha + glass.rim * grazing,
      edge: glass.edge, edgeAlpha: kind === 'translucent' ? .44 : .59, lineWidth: .58,
      highlight: glass.highlight, highlightAlpha: .025 * grazing};
  }
  if (kind === 'cobalt') {
    const reflection = n.map((x, i) => 2 * lightFacing * x - LIGHT[i]);
    const specular = Math.pow(Math.max(0, dot(reflection, v)), 9);
    return {...style, fill: tint([40, 95, 158], .65 + .5 * diffuse), alpha: .7,
      edge: '#2c4052', edgeAlpha: .86, lineWidth: .7,
      highlight: '#d5e1ea', highlightAlpha: .3 * specular, specular};
  }
  if (kind === 'oxide') {
    return {...style, fill: tint([180, 97, 61], .6 + .55 * diffuse), alpha: .67,
      edge: '#624638', edgeAlpha: .8, lineWidth: .67, highlight: '#e7d5c7'};
  }
  return {...style, fill: gray(160 + 34 * diffuse), alpha: .28,
    edge: '#272727', edgeAlpha: .88, lineWidth: .76,
    hatch: {color: '#343434', alpha: .56, spacing: .115, bandWidth: .18,
      maxSegments: 6, seed: stableSeed}};
}

// Vertex records retain both projected coordinates and source coordinates.
// Clipping/interpolation of them is barycentric, so results cannot escape the
// original facet or accidentally bridge an aperture in the source mesh.
const interpolate = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const EPS = 1e-9;
function clipScalar(polygon, index, boundary, greater) {
  const output = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const insideA = greater ? a[index] >= boundary : a[index] <= boundary;
    const insideB = greater ? b[index] >= boundary : b[index] <= boundary;
    if (insideA) output.push(a);
    if (insideA !== insideB) output.push(interpolate(a, b, clamp((boundary - a[index]) / (b[index] - a[index]), 0, 1)));
  }
  return output;
}

/**
 * Analytically clip parallel hatch lines to one real projected triangle.
 *
 * projectedTriangle: three [x,y] or [x,y,depth] points in CSS pixels.
 * sourceTriangle: optional matching real model-space [x,y,z] vertices. When
 * present, the hatch scalar field uses source coordinates, so adjacent facets
 * align and lines remain attached to the model as the camera moves. spacing
 * is then in model units (default .115); otherwise it is in CSS pixels (5).
 * cutY: optional actual model-space inspection plane; only the band within
 * bandWidth/2 of it is hatched. This marks existing surfaces, NOT a new cap.
 *
 * Returns at most 32 [[x,y],[x,y]] segments. Degenerate/invalid geometry yields
 * no marks. The renderer can skip faces below ~5 square CSS pixels for speed.
 */
export function hatchTriangle(projectedTriangle, {
  sourceTriangle, cutY, bandWidth = .18, spacing, maxSegments = 6, seed = 0,
  angle = -Math.PI / 4,
} = {}) {
  if (!Array.isArray(projectedTriangle) || projectedTriangle.length !== 3 ||
      !projectedTriangle.every(p => p?.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 1e8 && Math.abs(p[1]) <= 1e8)) return [];
  const [a, b, c] = projectedTriangle;
  const area2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area2) < 1e-6) return [];
  const hasSource = Array.isArray(sourceTriangle) && sourceTriangle.length === 3 &&
    sourceTriangle.every(p => p?.length >= 3 && [p[0], p[1], p[2]].every(v => Number.isFinite(v) && Math.abs(v) <= 1e8));
  // An explicitly supplied invalid source or cut must not create false marks.
  if (sourceTriangle !== undefined && !hasSource) return [];
  if (cutY !== undefined && (!hasSource || !Number.isFinite(cutY))) return [];
  const limit = clamp(Math.floor(finite(maxSegments, 6)), 0, 32);
  if (limit === 0) return [];
  const step = Math.max(hasSource ? .005 : 1.5, finite(spacing, hasSource ? .115 : 5));
  const direction = finite(angle, -Math.PI / 4), nx = -Math.sin(direction), ny = Math.cos(direction);
  let polygon = projectedTriangle.map((p, i) => {
    const source = hasSource ? sourceTriangle[i] : [p[0], p[1], 0];
    // The small Z coefficient avoids blank sections on vertical source faces.
    const scalar = nx * source[0] + ny * source[1] + (hasSource ? .37 * source[2] : 0);
    return [p[0], p[1], scalar, source[1]];
  });
  if (cutY !== undefined) {
    const halfWidth = clamp(finite(bandWidth, .18), 0, 1e6) / 2;
    if (halfWidth === 0) return [];
    polygon = clipScalar(clipScalar(polygon, 3, cutY - halfWidth, true), 3, cutY + halfWidth, false);
    if (polygon.length < 3) return [];
  }
  const low = Math.min(...polygon.map(p => p[2])), high = Math.max(...polygon.map(p => p[2]));
  if (high - low < EPS) return [];
  const phase = hash(seed) / 4294967296 * step;
  const first = Math.ceil((low - phase) / step), last = Math.floor((high - phase) / step);
  const count = last - first + 1;
  if (count <= 0) return [];
  // Bounded work even for extreme input; stride preserves the source-space grid.
  const stride = Math.max(1, Math.ceil(count / limit)), segments = [];
  for (let index = first; index <= last && segments.length < limit; index += stride) {
    const level = phase + index * step, intersections = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const delta = q[2] - p[2];
      if (Math.abs(delta) < EPS) {
        if (Math.abs(level - p[2]) < EPS) intersections.push(p.slice(0, 2), q.slice(0, 2));
        continue;
      }
      const t = (level - p[2]) / delta;
      if (t >= -EPS && t <= 1 + EPS) intersections.push(interpolate(p, q, clamp(t, 0, 1)).slice(0, 2));
    }
    // At vertex coincidences there can be duplicates; use the farthest pair.
    let pair, length2 = 1e-8;
    for (let i = 0; i < intersections.length; i++) for (let j = i + 1; j < intersections.length; j++) {
      const dx = intersections[i][0] - intersections[j][0], dy = intersections[i][1] - intersections[j][1];
      if (dx * dx + dy * dy > length2) { length2 = dx * dx + dy * dy; pair = [intersections[i], intersections[j]]; }
    }
    if (pair) segments.push(pair);
  }
  return segments;
}
