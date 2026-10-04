/**
 * Pick only geometry submitted for the current rendered frame, in CSS pixels.
 * Bounds, labels and archive registration boxes deliberately play no part.
 *
 * Items: {serial, triangles: [{screen, local, world?, alpha?}],
 *                 curves: [{screen, local, world?, alpha?}],
 *                 points: [{screen, local, world?, alpha?}]}.
 * Triangle/curve coordinates are arrays of [x,y,z]; point coordinates are one
 * [x,y,z]. screen z uses the Canvas convention: larger depth is nearer the eye.
 * Hidden/deleted/zero-alpha items or primitives, and screen vertices with
 * visible=false, are excluded. Do not submit geometry the renderer did not draw.
 *
 * Preserve screen.multiplier from flight-camera's projector for correct local/
 * world/depth interpolation in both perspective and orthographic views. A
 * perspective-only screen.cameraDepth is also supported. Without either,
 * interpolation is affine. Source serials are never coerced.
 * Cost is linear in the supplied faces, polyline segments and points; callers
 * should supply their existing bounded display samples, not the entire archive.
 */
export function pickProjected(x, y, items, {
  lineTolerance = 7,
  pointTolerance = 8,
} = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !items) return null;
  const lineRadius = tolerance(lineTolerance, 7);
  const pointRadius = tolerance(pointTolerance, 8);
  let best = null, bestDistance = Infinity;

  const consider = (item, primitive, screen, local, weights, distance) => {
    const corrected = perspectiveWeights(screen, weights);
    const depth = screen.reduce((sum, point, i) => sum + point[2] * corrected[i], 0);
    if (!Number.isFinite(depth)) return;
    if (best && (depth < best.depth || (depth === best.depth && distance >= bestDistance))) return;
    best = {serial: item.serial, local: interpolate(local, corrected), depth};
    const world = primitive.world;
    if (world?.length === screen.length && world.every(validVector)) {
      best.world = interpolate(world, corrected);
    }
    bestDistance = distance;
  };

  for (const item of items) {
    if (!visible(item) || item.edgeCount === 0) continue;
    for (const triangle of item.triangles || []) {
      if (!visible(triangle)) continue;
      const screen = triangle.screen, local = triangle.local;
      if (!validSamples(screen, local, 3) || screen.length !== 3) continue;
      const [a, b, c] = screen;
      if (x < Math.min(a[0], b[0], c[0]) || x > Math.max(a[0], b[0], c[0]) ||
          y < Math.min(a[1], b[1], c[1]) || y > Math.max(a[1], b[1], c[1])) continue;
      const abx = b[0] - a[0], aby = b[1] - a[1];
      const acx = c[0] - a[0], acy = c[1] - a[1];
      const denominator = abx * acy - aby * acx;
      // A projected edge-on face has no visible interior to select.
      if (Math.abs(denominator) < 1e-12) continue;
      const px = x - a[0], py = y - a[1];
      const wb = (px * acy - py * acx) / denominator;
      const wc = (abx * py - aby * px) / denominator;
      const wa = 1 - wb - wc;
      if (wa < -1e-10 || wb < -1e-10 || wc < -1e-10) continue;
      consider(item, triangle, screen, local, [wa, wb, wc], 0);
    }

    for (const curve of item.curves || []) {
      if (!visible(curve)) continue;
      const screen = curve.screen, local = curve.local;
      if (!screen || !local || screen.length !== local.length) continue;
      for (let i = 1; i < screen.length; i++) {
        const a = screen[i - 1], b = screen[i];
        if (!visibleScreen(a) || !visibleScreen(b) ||
            !validVector(local[i - 1]) || !validVector(local[i])) continue;
        if (x < Math.min(a[0], b[0]) - lineRadius || x > Math.max(a[0], b[0]) + lineRadius ||
            y < Math.min(a[1], b[1]) - lineRadius || y > Math.max(a[1], b[1]) + lineRadius) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared)) : 0;
        const distance = (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2;
        if (distance > lineRadius * lineRadius) continue;
        consider(item, {world: curve.world?.slice(i - 1, i + 1)},
          [a, b], [local[i - 1], local[i]], [1 - t, t], distance);
      }
    }

    for (const point of item.points || []) {
      if (!visible(point) || !visibleScreen(point.screen) || !validVector(point.local)) continue;
      const distance = (x - point.screen[0]) ** 2 + (y - point.screen[1]) ** 2;
      if (distance > pointRadius * pointRadius) continue;
      consider(item, {world: point.world ? [point.world] : undefined},
        [point.screen], [point.local], [1], distance);
    }
  }
  return best;
}

const validVector = point => point?.length >= 3 &&
  Number.isFinite(point[0]) && Number.isFinite(point[1]) && Number.isFinite(point[2]);
const visible = value => value && value.visible !== false && value.hidden !== true &&
  value.deleted !== true && (value.alpha === undefined || (Number.isFinite(value.alpha) && value.alpha > 0));
const visibleScreen = point => validVector(point) && point.visible !== false;
const tolerance = (value, fallback) => Number.isFinite(value) ? Math.max(0, value) : fallback;

function validSamples(screen, local, count) {
  return screen?.length >= count && local?.length === screen.length &&
    screen.every(visibleScreen) && local.every(validVector);
}

function perspectiveWeights(screen, weights) {
  const hasMultiplier = screen.every(point => Number.isFinite(point.multiplier) && point.multiplier > 0);
  if (!hasMultiplier && !screen.every(point => Number.isFinite(point.cameraDepth) && point.cameraDepth > 0)) return weights;
  const corrected = weights.map((weight, i) => hasMultiplier
    ? weight * screen[i].multiplier : weight / screen[i].cameraDepth);
  const sum = corrected.reduce((total, weight) => total + weight, 0);
  return corrected.map(weight => weight / sum);
}

function interpolate(points, weights) {
  return [0, 1, 2].map(axis => points.reduce((sum, point, i) => sum + point[axis] * weights[i], 0));
}
