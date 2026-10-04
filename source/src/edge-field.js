import {hash} from './archive.js';
import {patchIndex} from './surface-patches.js';

// Rendering budgets only: subdivisions never increase logical edge counts.
export const MAX_FIELD_EDGES = 1024;
export const MAX_FIELD_SEGMENTS = 12;
const validPoint = p => p?.length >= 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);
const limit = (value, fallback, max) => Math.min(max, Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback)));

/**
 * Sample surviving model edges, once each, into continuous straight polylines.
 * Every point lies on the current quantized edge and the endpoints are exact.
 * The caller applies the mesh's shared local deformation to these samples, so
 * a tapped edge can bend with its own surface without an independent arc layer.
 * Elapsed time and reduced motion never add gaps, bows, or appearance gates.
 *
 * Work is O(min(activeEdges.length, edgeBudget) * segments), with hard caps.
 * Duplicate/reversed identities are suppressed within the bounded selection;
 * no unselected edges are scanned to refill skipped duplicate or invalid slots.
 */
export function sampleEdgeField(frame, {
  edgeBudget = 192,
  segments = 5,
} = {}) {
  const curves = [];
  // Preserve the result API without allocating any point-rendering resources.
  const result = {curves, points: [], logicalEdges: frame?.edgeCount ?? 0, renderedSegments: 0, renderedPoints: 0};
  const edges = frame?.activeEdges;
  if (!edges?.length || frame.edgeCount === 0) return result;
  const count = Math.min(edges.length, limit(edgeBudget, 192, MAX_FIELD_EDGES));
  const subdivisions = Math.max(1, limit(segments, 5, MAX_FIELD_SEGMENTS));
  if (!count) return result;
  const key = frame.instance?.key ?? frame.instance?.serial ?? frame.serial ?? 0;
  const source = frame.model?.stages?.[0]?.vertices ?? frame.vertices;
  const rotation = hash(key) % edges.length;
  const seen = new Set();

  for (let slot = 0; slot < count; slot++) {
    // Fixed-topology selection is bounded and entirely independent of time.
    const edge = edges[(Math.floor(slot * edges.length / count) + rotation) % edges.length];
    if (!edge || edge.length < 2) continue;
    const [a, b] = edge;
    const identity = `${Math.min(a, b)}/${Math.max(a, b)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const start = frame.vertices?.[a], end = frame.vertices?.[b];
    const originalStart = source?.[a], originalEnd = source?.[b];
    if (![start, end, originalStart, originalEnd].every(validPoint)) continue;
    const delta = [0, 1, 2].map(axis => end[axis] - start[axis]);
    if (Math.hypot(...delta) < 1e-9) continue;
    const midpoint = [0, 1, 2].map(axis => (originalStart[axis] + originalEnd[axis]) * .5);
    const points = Array.from({length: subdivisions + 1}, (_, i) => {
      if (i === 0) return start.slice(0, 3);
      if (i === subdivisions) return end.slice(0, 3);
      return [0, 1, 2].map(axis => start[axis] + delta[axis] * (i / subdivisions));
    });
    curves.push({points, alpha: 1, edge: [a, b], patch: patchIndex(midpoint)});
    result.renderedSegments += subdivisions;
  }

  return result;
}
