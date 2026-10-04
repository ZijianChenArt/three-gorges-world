import {hash, random} from './archive.js';
import {patchIndex, phaseInfo} from './surface-patches.js';

// These are rendering budgets, never logical archive edge counts. No geometry
// or random selection is retained between calls, so paused time is exact.
export const MAX_FIELD_EDGES = 1024;
export const MAX_FIELD_SEGMENTS = 12;
const TAU = Math.PI * 2;
const validPoint = p => p?.length >= 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);
const limit = (value, fallback, max) => Math.min(max, Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback)));
const difference = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function sourceNormal(a, b) {
  const delta = difference(b, a), length = Math.hypot(...delta);
  if (length < 1e-12) return null;
  const tangent = delta.map(v => v / length);
  const radial = a.map((v, axis) => (v + b[axis]) * .5);
  const along = dot(radial, tangent);
  let normal = radial.map((v, axis) => v - tangent[axis] * along);
  let magnitude = Math.hypot(...normal);
  if (magnitude < 1e-7) {
    // An edge through the origin has no radial normal. Its least-aligned source
    // axis gives a stable perpendicular instead of a camera-facing decoration.
    const axis = tangent.reduce((best, v, i) => Math.abs(v) < Math.abs(tangent[best]) ? i : best, 0);
    const basis = [0, 0, 0];
    basis[axis] = 1;
    normal = cross(tangent, basis);
    magnitude = Math.hypot(...normal);
  }
  return normal.map(v => v / magnitude);
}

/**
 * Sample only surviving archive edges into curved polylines.
 *
 * `elapsed` must be the archive clock, not wall time: a fixed value freezes all
 * local shape/alpha changes. Spatial patch identity and curvature normals use
 * stage-zero source vertices, while both endpoints use this frame's quantized
 * vertices. Empty stages produce nothing. Optional split gaps remove portions
 * of those same arcs; they never introduce a new connection or detached prop.
 *
 * Work is O(min(activeEdges.length, edgeBudget) * segments), with
 * hard caps above. Each selected edge produces at most two curves and at most
 * `segments` line segments total, including when the edge is split.
 */
export function sampleEdgeField(frame, {
  elapsed = frame?.time ?? 0,
  reducedMotion = false,
  edgeBudget = 192,
  segments = 5,
} = {}) {
  const curves = [];
  // Empty point output is retained only for renderer compatibility. The artwork
  // has no point layer, point sampling, or point animation data.
  const result = {curves, points: [], logicalEdges: frame?.edgeCount ?? 0, renderedSegments: 0, renderedPoints: 0};
  const edges = frame?.activeEdges;
  if (!edges?.length || frame.edgeCount === 0) return result;
  const count = Math.min(edges.length, limit(edgeBudget, 192, MAX_FIELD_EDGES));
  const subdivisions = Math.max(1, limit(segments, 5, MAX_FIELD_SEGMENTS));
  if (!count) return result;
  const time = reducedMotion || !Number.isFinite(elapsed) ? 0 : Math.max(0, elapsed);
  const key = frame.instance?.key ?? frame.instance?.serial ?? frame.serial ?? 0;
  const source = frame.model?.stages?.[0]?.vertices ?? frame.vertices;
  const rotation = hash(key) % edges.length;
  const phases = new Map();

  for (let slot = 0; slot < count; slot++) {
    // Even sampling is bounded, stable at fixed topology, and does not scan or
    // sort a large source. Time never changes the chosen source edge identities.
    const edge = edges[(Math.floor(slot * edges.length / count) + rotation) % edges.length];
    const [a, b] = edge;
    const start = frame.vertices?.[a], end = frame.vertices?.[b];
    const originalStart = source?.[a], originalEnd = source?.[b];
    if (![start, end, originalStart, originalEnd].every(validPoint)) continue;
    const delta = difference(end, start), length = Math.hypot(...delta);
    if (length < 1e-9) continue;
    const originalNormal = sourceNormal(originalStart, originalEnd);
    if (!originalNormal) continue;
    const midpoint = originalStart.map((v, axis) => (v + originalEnd[axis]) * .5);
    const patch = patchIndex(midpoint);
    if (!phases.has(patch)) phases.set(patch, phaseInfo(key, patch, time, {reducedMotion}));
    const phase = phases.get(patch);
    const edgeKey = hash(key ^ Math.imul(Math.min(a, b) + 1, 0x9e3779b9) ^ Math.imul(Math.max(a, b) + 1, 0x85ebca6b));
    const offset = random(edgeKey, 0) * TAU;
    // Periods of 12–20 seconds, with no binary on/off gate or high-rate flash.
    const local = .5 + .5 * Math.sin(time * (.31 + random(edgeKey, 1) * .2) + offset);
    const tangent = delta.map(v => v / length);
    const normalAlong = dot(originalNormal, tangent);
    const normal = originalNormal.map((v, axis) => v - tangent[axis] * normalAlong);
    const bend = length * (.14 + random(edgeKey, 2) * .22) * (.72 + .72 * phase.curvature + .3 * local);
    const alpha = (.12 + .88 * phase.lineAlpha) * (.62 + .38 * local);
    const at = t => {
      // Preserve exact endpoints, including after repeated quantizations.
      if (t === 0) return start.slice(0, 3);
      if (t === 1) return end.slice(0, 3);
      return start.map((v, axis) => v + delta[axis] * t + normal[axis] * bend * 4 * t * (1 - t));
    };
    const split = subdivisions > 1 && random(edgeKey, 3) < .58;
    const center = .36 + .28 * random(edgeKey, 4) + .045 * Math.sin(time * .27 + offset);
    const gap = split ? .025 + .205 * (.3 + .7 * local) * (.45 + .55 * phase.curvature) : 0;
    const left = center - gap * .5, right = center + gap * .5;
    const addCurve = (from, to, steps) => {
      const sampled = Array.from({length: steps + 1}, (_, i) => at(from + (to - from) * i / steps));
      curves.push({points: sampled, alpha, edge: [a, b], patch});
      result.renderedSegments += steps;
    };
    if (split) {
      const leftSteps = Math.max(1, Math.min(subdivisions - 1, Math.round(subdivisions * center)));
      addCurve(0, left, leftSteps);
      addCurve(right, 1, subdivisions - leftSteps);
    } else addCurve(0, 1, subdivisions);
  }

  return result;
}
