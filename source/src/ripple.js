/**
 * A bounded, instance-local vertex response. An event identifies one serial and
 * a point in that instance's local coordinates. It never changes an instance's
 * pose, the archive clock, survivor topology, or any shared source geometry.
 */
export const MAX_RIPPLES = 2;
export const RIPPLE_DURATION = 4.8;
export const MAX_RIPPLE_DISPLACEMENT = .48;
const FRONT_DELAY = 1.35;
const FRONT_DISTANCE = .9;
const ORIGIN_SOFTNESS = .22;

export function createRippleState() {
  return {elapsed: 0, waves: []};
}

function point(value) {
  const p = value && typeof value[0] === 'number'
    ? [value[0], value[1], value[2]]
    : [value?.x, value?.y, value?.z];
  return p.every(Number.isFinite) ? p : null;
}

function validSerial(serial) {
  return Number.isSafeInteger(serial) && serial >= 0;
}

function liveWave(ripples, serial) {
  if (!validSerial(serial)) return undefined;
  return ripples?.waves?.find(wave => wave.serial === serial
    && ripples.elapsed >= wave.started && ripples.elapsed - wave.started < RIPPLE_DURATION);
}

function retire(ripples) {
  ripples.waves = ripples.waves.filter(wave => ripples.elapsed - wave.started < RIPPLE_DURATION);
}

/** Whether this exact instance needs its temporary local vertex buffers. */
export function hasRipple(ripples, serial) {
  return !!liveWave(ripples, serial);
}

/**
 * Copy a local origin and start this serial's response. At most two targets can
 * be active. Repeated taps on an active target and overflow taps are ignored:
 * neither can reset/evict moving vertices and produce a visible discontinuity.
 * A newer event time can advance the independent clock; old times never rewind.
 */
export function emitRipple(ripples, target, nowSeconds = ripples.elapsed, {reducedMotion = false} = {}) {
  const origin = point(target?.origin);
  const serial = target?.serial;
  if (reducedMotion || !validSerial(serial) || !origin || !Number.isFinite(nowSeconds) || nowSeconds < 0) return false;
  ripples.elapsed = Math.max(ripples.elapsed, nowSeconds);
  retire(ripples);
  if (hasRipple(ripples, serial) || ripples.waves.length >= MAX_RIPPLES) return false;
  ripples.waves.push({serial, origin, started: ripples.elapsed});
  return true;
}

/**
 * The caller advances visible wall time only while the page/modal permits it.
 * Archive pause is intentionally independent: a user-triggered response still
 * finishes while autonomous processing is paused. The final active tick asks
 * for a redraw so the caller can release temporary geometry and restore the
 * current shared stage. Reduced motion cancels all deformation immediately.
 */
export function advanceRipples(ripples, dt, {paused = false, reducedMotion = false} = {}) {
  void paused;
  const active = ripples.waves.length > 0;
  if (reducedMotion) {
    ripples.waves = [];
    return active;
  }
  if (!Number.isFinite(dt) || dt <= 0) return false;
  ripples.elapsed += dt;
  retire(ripples);
  return active;
}

/**
 * Return a deformed copy of the CURRENT local point, never a captured old shape.
 * Optional `out` is a reusable xyz array for bounded CPU-mesh updates. Equal
 * input coordinates always remain equal, so collapsed faces cannot reappear.
 *
 * The smooth spatial front reaches farther points later. Each point scatters
 * radially and gathers back by 4.8 seconds, with zero velocity at both joins.
 * The softened radial vector is continuous at the clicked origin and its
 * displacement is strictly smaller than MAX_RIPPLE_DISPLACEMENT.
 */
export function deformRipplePoint(ripples, serial, localPoint, out = [0, 0, 0]) {
  const x = localPoint?.[0] ?? localPoint?.x;
  const y = localPoint?.[1] ?? localPoint?.y;
  const z = localPoint?.[2] ?? localPoint?.z;
  const wave = liveWave(ripples, serial);
  return deformAt(wave, wave ? ripples.elapsed - wave.started : 0, x, y, z, out);
}

/** Snapshot a frame's target/time once for tight vertex loops. The numeric
 * sampler writes into a supplied xyz array and never captures source geometry.
 */
export function createRippleDeformer(ripples, serial) {
  const wave = liveWave(ripples, serial);
  const age = wave ? ripples.elapsed - wave.started : 0;
  return (x, y, z, out) => deformAt(wave, age, x, y, z, out);
}

function deformAt(wave, age, x, y, z, out) {
  out[0] = x; out[1] = y; out[2] = z;
  if (!wave || age <= 0 || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return out;
  const dx = x - wave.origin[0], dy = y - wave.origin[1], dz = z - wave.origin[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const delay = FRONT_DELAY * (1 - Math.exp(-distance / FRONT_DISTANCE));
  const phase = (age - delay) / (RIPPLE_DURATION - delay);
  if (phase <= 0 || phase >= 1 || !distance) return out;
  const pulse = Math.sin(Math.PI * phase) ** 2;
  const strength = MAX_RIPPLE_DISPLACEMENT * pulse / (distance + ORIGIN_SOFTNESS);
  out[0] = x + dx * strength;
  out[1] = y + dy * strength;
  out[2] = z + dz * strength;
  return out;
}
