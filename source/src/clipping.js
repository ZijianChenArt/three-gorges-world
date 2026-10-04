import {cameraBasis} from './flight-camera.js';

const finitePoint = p => p?.length >= 3 && [p[0], p[1], p[2]].every(Number.isFinite);
const mix = (a, b, t) => a.map((value, i) => value * (1 - t) + b[i] * t);
const crossing = (a, b) => {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale ? (Math.abs(a) / scale) / (Math.abs(a) / scale + Math.abs(b) / scale) : 0;
};
const interpolate = (a, b, t) => ({world: mix(a.world, b.world, t), local: mix(a.local, b.local, t), camera: mix(a.camera, b.camera, t)});

/** Clip actual source geometry before perspective division. New vertices lie
 * on existing edges, retaining source-local coordinates for perspective picking.
 * Side planes keep Canvas paths finite and bounded without inventing caps.
 */
export function createGeometryClipper(camera, view, width, height) {
  const basis = cameraBasis(camera), {near, far, distance, perspective} = basis;
  const validView = [width, height, view.scale, view.cx, view.cy].every(Number.isFinite)
    && width > 0 && height > 0 && view.scale > 0;
  const lens = view.scale * (perspective ? distance : 1);
  const plane = (x, y, z, offset = 0) => {
    const norm = Math.max(Math.abs(x), Math.abs(y), Math.abs(z), Math.abs(offset), 1);
    return p => p[0] * (x / norm) + p[1] * (y / norm) + p[2] * (z / norm) + offset / norm;
  };
  const planes = [plane(0, 0, 1, -near), plane(0, 0, -1, far),
    perspective ? plane(lens, 0, view.cx) : plane(lens, 0, 0, view.cx),
    perspective ? plane(-lens, 0, width - view.cx) : plane(-lens, 0, 0, width - view.cx),
    perspective ? plane(0, lens, view.cy) : plane(0, lens, 0, view.cy),
    perspective ? plane(0, -lens, height - view.cy) : plane(0, -lens, 0, height - view.cy)];
  const vertex = (world, local) => {
    if (!validView || !finitePoint(world) || !finitePoint(local)) return null;
    const relative = world.map((value, i) => value - basis.target[i]);
    const dot = axis => relative.reduce((sum, value, i) => sum + value * axis[i], 0);
    const coordinates = [dot(basis.right), -dot(basis.up), distance - dot(basis.direction)];
    return coordinates.every(Number.isFinite) ? {world, local, camera: coordinates} : null;
  };
  const primitive = vertices => {
    if (!vertices.length) return null;
    const screen = vertices.map(p => {
      // Plane intersections can differ by a few ulps. Clamp only that numerical
      // residue after clipping; never clamp an untrimmed, hidden source vertex.
      const cameraDepth = Math.max(near, Math.min(far, p.camera[2]));
      const multiplier = perspective ? distance / cameraDepth : 1;
      const result = [Math.max(0, Math.min(width, view.cx + p.camera[0] * multiplier * view.scale)),
        Math.max(0, Math.min(height, view.cy + p.camera[1] * multiplier * view.scale)), distance - cameraDepth];
      result.visible = true; result.cameraDepth = cameraDepth; result.multiplier = multiplier;
      return result;
    });
    if (!screen.every(finitePoint)) return null;
    return {screen, world: vertices.map(p => p.world), local: vertices.map(p => p.local)};
  };
  return {
    segment(a, b, localA = a, localB = b) {
      let start = vertex(a, localA), end = vertex(b, localB);
      if (!start || !end) return null;
      for (const plane of planes) {
        const da = plane(start.camera), db = plane(end.camera);
        if (!Number.isFinite(da) || !Number.isFinite(db) || (da < 0 && db < 0)) return null;
        if (da < 0) start = interpolate(start, end, crossing(da, db));
        else if (db < 0) end = interpolate(start, end, crossing(da, db));
      }
      return primitive([start, end]);
    },
    polygon(world, local = world) {
      if (world.length < 3 || world.length !== local.length) return null;
      let vertices = world.map((point, i) => vertex(point, local[i]));
      if (vertices.some(p => !p)) return null;
      for (const plane of planes) {
        const output = [];
        for (let i = 0; i < vertices.length; i++) {
          const a = vertices[i], b = vertices[(i + 1) % vertices.length], da = plane(a.camera), db = plane(b.camera);
          if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
          if (da >= 0) output.push(a);
          if ((da < 0) !== (db < 0)) output.push(interpolate(a, b, crossing(da, db)));
        }
        vertices = output;
        if (vertices.length < 3) return null;
      }
      return primitive(vertices);
    },
  };
}

/** Fan triangulation preserves the clipped convex face and its exact attributes. */
export function triangulateClippedPolygon(polygon) {
  if (!polygon) return [];
  const triangles = [];
  for (let i = 1; i + 1 < polygon.screen.length; i++) {
    const indices = [0, i, i + 1], screen = indices.map(index => polygon.screen[index]);
    const [a, b, c] = screen;
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) <= 1e-10) continue;
    triangles.push({screen, world: indices.map(index => polygon.world[index]), local: indices.map(index => polygon.local[index])});
  }
  return triangles;
}

/** Final screen-space guard for annotation/hatch lines, which have no 3D pick data. */
export function clipSegmentToViewport(a, b, width, height) {
  if (![a?.[0], a?.[1], b?.[0], b?.[1], width, height].every(Number.isFinite) || width <= 0 || height <= 0
    || a.visible === false || b.visible === false) return null;
  let start = a.slice(0, 2), end = b.slice(0, 2);
  for (const [axis, boundary, sign] of [[0, 0, 1], [0, width, -1], [1, 0, 1], [1, height, -1]]) {
    const da = sign * (start[axis] - boundary), db = sign * (end[axis] - boundary);
    if (!Number.isFinite(da) || !Number.isFinite(db) || (da < 0 && db < 0)) return null;
    if (da < 0) start = mix(start, end, crossing(da, db));
    else if (db < 0) end = mix(start, end, crossing(da, db));
  }
  return [start, end].map(p => [Math.max(0, Math.min(width, p[0])), Math.max(0, Math.min(height, p[1]))]);
}
