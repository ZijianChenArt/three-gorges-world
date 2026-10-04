/**
 * Shared camera math for the Canvas registration drawing and the Three.js scene.
 *
 * Automatic flight is a continuous world-space route. Inspection can freeze its
 * time and add the existing yaw/pitch/zoom/pan controls to the returned object.
 * Keep target, distance and perspective when composing that inspection camera.
 * Reduced motion/pause are handled by the caller not advancing elapsed time.
 *
 * Renderer integration:
 *   const s = projectionParameters(w, h, getView(w, h), camera);
 *   Canvas: const projectFrame = createProjector(camera), q=projectFrame(point);
 *           [s.view.cx + q[0] * s.view.scale, s.view.cy + q[1] * s.view.scale].
 *   Three: PerspectiveCamera(s.fov, s.aspect, s.near, s.far), position=s.eye,
 *          up=s.up, lookAt(s.target), setViewOffset(...s.viewOffset).
 * Use the orthographic bounds for legacy/manual cameras without perspective.
 * Do not translate a perspective camera's target to implement screen-space pan:
 * the off-axis view offset is what keeps near and distant geometry registered.
 */

const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const addScaled = (a, b, amount) => a.map((n, i) => n + b[i] * amount);
const vector = p => [0, 1, 2].map(i => finite(p?.[i]));

export const FLIGHT_NEAR = .2;
export const FLIGHT_FAR = 180;
export const MIN_FLIGHT_DISTANCE = 1.2;
export const MIN_FLIGHT_HEIGHT = -6.65; // The reflection surface is at -7.7.
const TAU = Math.PI * 2;
const ease = value => {
  const x = clamp(value, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

// The initial, fixed landmarks also keep the two-argument API useful. At runtime
// the caller supplies the actual poses, source bounds and lifetime descriptors.
const INITIAL_LANDMARKS = [
  {position: [-3.4, .4, 4], scale: 4.25, bounds: [1, .875, 1], angle: -1.7, lean: -.114},
  {position: [3.8, 1, -4], scale: 2.65, bounds: [1, .56, 1], angle: 1.5, lean: -.082},
  {position: [5.1, -1.9, 3], scale: 2.25, bounds: [1, .632, 1], angle: -1.21, lean: -.08},
];

function flightScene(scene, phone, elapsed) {
  const source = Array.isArray(scene) ? scene : scene?.instances;
  const now = finite(scene?.elapsed, elapsed);
  const supplied = Array.isArray(source) && source.some(item => Array.isArray(item.position));
  const instances = (supplied ? source : INITIAL_LANDMARKS).filter(item =>
    Array.isArray(item.position) && item.position.every(Number.isFinite)).map(item => {
    const position = vector(item.position);
    if (!supplied && phone) {position[0] *= .51; position[1] *= 1.5; position[2] *= .83;}
    const scale = clamp(finite(item.scale, 2) * (!supplied && phone ? .86 : 1), .1, 12);
    const bounds = vector(item.bounds || [1, .75, 1]).map(n => Math.max(.05, Math.abs(n)));
    const ca = Math.abs(Math.cos(finite(item.angle))), sa = Math.abs(Math.sin(finite(item.angle)));
    const cl = Math.abs(Math.cos(finite(item.lean))), sl = Math.abs(Math.sin(finite(item.lean)));
    const horizontalZ = sa * bounds[0] + ca * bounds[2];
    // Circumscribed, world-aligned source boxes. They deliberately overestimate
    // curved/open sculptures; this is clearance planning, not mesh collision.
    const extents = [ca * bounds[0] + sa * bounds[2], cl * bounds[1] + sl * horizontalZ,
      sl * bounds[1] + cl * horizontalZ].map(n => n * scale);
    const cr = Math.abs(Math.cos(finite(item.roll))), sr = Math.abs(Math.sin(finite(item.roll))), ex=extents[0], ey=extents[1];extents[0]=ex*cr+ey*sr;extents[1]=ex*sr+ey*cr;
    const arrival = finite(item.started) <= 0 ? 1 : ease((now - item.started) / 12);
    const departure = Number.isFinite(item.end) ? ease((item.end - now) / 14) : 1;
    return {position, extents, weight: arrival * departure};
  });
  // A small fixed prior stops one admission/retirement from moving the whole
  // route. Lifetime envelopes have zero first/second derivatives at both ends.
  const total = 5 + instances.reduce((sum, item) => sum + item.weight, 0);
  const center = [0, 1, 2].map(axis => instances.reduce((sum, item) =>
    sum + item.position[axis] * item.weight, 0) / total);
  return {instances, center};
}

function routePoint(time, phone, scene) {
  const phase = .056 * time + .32;
  // An elongated internal circuit crosses the occupied volume diagonally. It
  // starts outside and advances down the corridor, rather than orbiting a
  // fixed look-at point. The gradual entrance is never replayed on each lap.
  const x = (2.5 * Math.cos(phase) + 3.6 * Math.sin(phase)) * (phone ? .55 : 1);
  const z = 8.5 * Math.cos(phase) * (phone ? .83 : 1) + 4 * Math.exp(-Math.max(0, time) / 9);
  const eye = [x + scene.center[0] * .55, 1.65 + .55 * Math.sin(phase * .73 + .3) + scene.center[1] * .4,
    z + scene.center[2] * .55];
  const baseY = eye[1];
  // Preserve the horizontal corridor where possible, rising smoothly above a
  // conservative box only when its footprint closes that gap. A three-unit
  // shoulder starts the climb before reaching any occupied box face. Smooth
  // log-sum-exp joins overlapping roofs without snapping between obstacles.
  let roofs = 0;
  for (const item of scene.instances) {
    const dx = Math.abs(eye[0] - item.position[0]), dz = Math.abs(eye[2] - item.position[2]);
    const shoulder = phone ? 2.3 : 3;
    const coverage = ease((item.extents[0] + shoulder - dx) / shoulder)
      * ease((item.extents[2] + shoulder - dz) / shoulder) * item.weight;
    const lift = Math.max(0, item.position[1] + item.extents[1] + .65 - baseY) * coverage;
    roofs += Math.expm1(lift / .18);
  }
  eye[1] += .18 * Math.log1p(roofs);
  return eye;
}

/**
 * Forward-looking interior flight. Optional scene is an array of posed instances
 * or {elapsed, instances}, each with position/scale/bounds/angle/lean and optional
 * started/end. Freeze that descriptor snapshot together with elapsed when
 * inspecting or paused. No accumulated integration state or wrapping seam.
 */
export function automaticCamera(elapsed, phone = false, context) {
  const t = Math.max(0, finite(elapsed));
  const scene = flightScene(context, phone, t);
  const eye = routePoint(t, phone, scene);
  const ahead = routePoint(t + 13 + 1.7 * Math.sin(t * .037), phone, scene);
  const target = ahead.map((n, axis) => axis === 1
    ? eye[1] * .62 + scene.center[1] * .38 - .55
    : n * .8 + scene.center[axis] * .2);
  const backward = eye.map((n, i) => n - target[i]);
  const distance = Math.max(MIN_FLIGHT_DISTANCE, Math.hypot(...backward));
  const rawYaw = Math.atan2(backward[0], backward[2]);
  // Unwrap around the route's winding angle so manual offsets remain smooth
  // through atan2's +/- PI seam as well as the path's lap boundary.
  const referenceYaw = .056 * t + .32 - .48;
  const yaw = rawYaw + TAU * Math.round((referenceYaw - rawYaw) / TAU);
  return {
    yaw: yaw + .47,
    pitch: Math.asin(clamp(backward[1] / distance, -.98, .98)) - .43,
    // A fixed lens; actual eye translation creates the near/far change. The
    // wider interior view preserves useful framing on portrait screens too.
    zoom: (phone ? 17.4 : 12.3) / distance,
    panX: 0,
    panY: 0,
    target,
    distance,
    perspective: true,
  };
}

/** Orthonormal basis preserving the original orbit direction and downward Canvas y. */
export function cameraBasis(camera = {}) {
  const yaw = -.47 + finite(camera.yaw);
  const target = vector(camera.target);
  const perspective = camera.perspective === true;
  const distance = perspective
    ? clamp(finite(camera.distance, 8), MIN_FLIGHT_DISTANCE, 100)
    : 65;
  const minimumTilt = Math.asin(clamp((MIN_FLIGHT_HEIGHT - target[1]) / distance, -.9999, .9999));
  const tilt = perspective
    ? clamp(.43 + finite(camera.pitch), Math.max(-Math.PI / 2 + .015, minimumTilt), Math.PI / 2 - .015)
    : .43 + finite(camera.pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const right = [cy, 0, -sy];
  const up = [-sy * st, ct, -cy * st];
  const direction = [sy * ct, st, cy * ct];
  return {
    right, up, direction, target, distance, perspective,
    eye: addScaled(target, direction, distance),
    near: perspective ? FLIGHT_NEAR : .1,
    far: FLIGHT_FAR,
  };
}

/**
 * Return [x, y, depth] in view-plane world units. Positive depth is toward the
 * eye, retaining the Canvas painter's sort order. Attached .visible is false
 * behind either clipping plane; renderers should skip those vertices/faces.
 * Hidden points remain finite, so a near-plane crossing never emits Infinity.
 */
export function project(point, camera = {}) {
  return projectWithBasis(point, cameraBasis(camera));
}

/** Build once per rendered frame to avoid recomputing trigonometry per vertex. */
export function createProjector(camera = {}) {
  const basis = cameraBasis(camera);
  return point => projectWithBasis(point, basis);
}

function projectWithBasis(point, basis) {
  const relative = vector(point).map((n, i) => n - basis.target[i]);
  const depth = dot(relative, basis.direction);
  const cameraDepth = basis.distance - depth;
  const multiplier = basis.perspective
    ? basis.distance / Math.max(basis.near, cameraDepth)
    : 1;
  const projected = [dot(relative, basis.right) * multiplier, -dot(relative, basis.up) * multiplier, depth];
  // Non-enumerable metadata preserves compatibility with legacy array consumers.
  Object.defineProperties(projected, {
    visible: {value: cameraDepth >= basis.near && cameraDepth <= basis.far},
    multiplier: {value: multiplier},
    cameraDepth: {value: cameraDepth},
  });
  return projected;
}

/**
 * Pass an unmodified getView(width,height) result. Returned .view already has
 * camera zoom and pan applied. viewOffset is ordered exactly as Three.js's
 * setViewOffset(fullWidth, fullHeight, offsetX, offsetY, width, height).
 */
export function projectionParameters(width, height, baseView, camera = {}) {
  const w = Math.max(1, finite(width, 1));
  const h = Math.max(1, finite(height, 1));
  const scale = Math.max(.0001, finite(baseView?.scale, 1)) * clamp(finite(camera.zoom, 1), .01, 100);
  const view = {
    ...baseView,
    scale,
    cx: finite(baseView?.cx, w / 2) + finite(camera.panX) * w,
    cy: finite(baseView?.cy, h / 2) + finite(camera.panY) * h,
  };
  const basis = cameraBasis(camera);
  const offsetX = w / 2 - view.cx, offsetY = h / 2 - view.cy;
  let target = basis.target;
  // Orthographic pan is exactly equivalent to translating the eye and target.
  if (!basis.perspective) {
    target = addScaled(addScaled(target, basis.right, offsetX / scale), basis.up, -offsetY / scale);
  }
  return {
    ...basis,
    view,
    target,
    eye: addScaled(target, basis.direction, basis.distance),
    fov: 2 * Math.atan(h / (2 * scale * basis.distance)) * 180 / Math.PI,
    aspect: w / h,
    viewOffset: [w, h, offsetX, offsetY, w, h],
    left: -w / (2 * scale),
    right: w / (2 * scale),
    top: h / (2 * scale),
    bottom: -h / (2 * scale),
  };
}
