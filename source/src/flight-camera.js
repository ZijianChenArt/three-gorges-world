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

export const FLIGHT_NEAR = .8;
export const FLIGHT_FAR = 180;
export const MIN_FLIGHT_DISTANCE = 14;

/** Deterministic C-infinity flight: no waypoints, wrapping seams, or random jumps. */
export function automaticCamera(elapsed, phone = false) {
  const t = finite(elapsed);
  const distance = 18.2 + (phone ? 1.7 : 0) + 2 * Math.sin(t * .23 + 1.4);
  return {
    yaw: .64 * Math.sin(t * .12) + .16 * Math.sin(t * .039),
    pitch: .09 * Math.sin(t * .16) + .035 * Math.sin(t * .053),
    // Keep the lens length steady while the eye dollies closer and farther.
    zoom: (phone ? 19.9 : 18.2) / distance,
    panX: 0,
    panY: 0,
    target: [
      (phone ? 1.6 : 2.65) * Math.sin(t * .19),
      .55 * Math.sin(t * .14),
      (phone ? 2.3 : 2.8) * Math.sin(t * .13 + .38),
    ],
    distance,
    perspective: true,
  };
}

/** Orthonormal basis preserving the original orbit direction and downward Canvas y. */
export function cameraBasis(camera = {}) {
  const yaw = -.47 + finite(camera.yaw);
  const tilt = .43 + finite(camera.pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const right = [cy, 0, -sy];
  const up = [-sy * st, ct, -cy * st];
  const direction = [sy * ct, st, cy * ct];
  const target = vector(camera.target);
  const perspective = camera.perspective === true;
  const distance = perspective
    ? clamp(finite(camera.distance, 18.2), MIN_FLIGHT_DISTANCE, 100)
    : 65;
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
