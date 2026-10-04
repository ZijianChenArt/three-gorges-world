/**
 * A bounded, deterministic translation field for the existing archive instances.
 * This module owns no geometry and does not change intake, topology or counters.
 * Sample at each instance's undisplaced world centre and add the result once to
 * the complete pose (including registry boxes), never to individual vertices.
 */
export const MAX_RIPPLES = 4;
const SPEED = 9;
const RADIUS = 28;
const PULSE_SECONDS = 1.65;
const AMPLITUDE = 3.2;
const MAX_OFFSET = 5;
export const RIPPLE_DURATION = RADIUS / SPEED + PULSE_SECONDS;

export function createRippleState() {
  return {elapsed: 0, waves: []};
}

function point(value) {
  const p = value && typeof value[0] === 'number'
    ? [value[0], value[1], value[2]]
    : [value?.x, value?.y, value?.z];
  return p.every(Number.isFinite) ? p : null;
}

function retire(ripples) {
  ripples.waves = ripples.waves.filter(wave => ripples.elapsed - wave.started < RIPPLE_DURATION);
}

/**
 * Emit at the ripple clock, normally `ripples.elapsed`. An explicit later time
 * can synchronize this clock; old event times never rewind it. The origin is
 * copied. When all four slots are busy, reject the extra tap instead of evicting
 * a still-moving wave and making an instance jump. Returns whether emitted.
 * Reduced-motion users get no model displacement.
 */
export function emitRipple(ripples, worldOrigin, nowSeconds = ripples.elapsed, {reducedMotion = false} = {}) {
  const origin = point(worldOrigin);
  if (reducedMotion || !origin || !Number.isFinite(nowSeconds) || nowSeconds < 0) return false;
  ripples.elapsed = Math.max(ripples.elapsed, nowSeconds);
  retire(ripples);
  if (ripples.waves.length >= MAX_RIPPLES) return false;
  ripples.waves.push({origin, started: ripples.elapsed});
  return true;
}

/**
 * Advance only while the app is visible and its modal is closed. `paused` is
 * deliberately independent: pausing the archive stops autonomous processing,
 * while a user-triggered response still finishes and returns the objects home.
 * Call with visible wall dt, not archive elapsed. The return value requests a
 * redraw even when the last wave just expired, to render its final zero offset.
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

/** Pure xyz translation: a travelling outward pulse, then a smooth return. */
export function rippleOffset(ripples, worldPosition) {
  const position = point(worldPosition);
  const offset = [0, 0, 0];
  if (!position || !ripples?.waves?.length) return offset;
  for (const wave of ripples.waves) {
    const delta = position.map((v, i) => v - wave.origin[i]);
    const distance = Math.hypot(...delta);
    const age = ripples.elapsed - wave.started;
    if (distance >= RADIUS || age <= 0 || age >= RIPPLE_DURATION) continue;
    const phase = (age - distance / SPEED) / PULSE_SECONDS;
    if (phase <= 0 || phase >= 1) continue;
    // sin² has zero position and velocity at the front and tail of the pulse.
    const pulse = Math.sin(Math.PI * phase) ** 2;
    const edge = Math.max(0, Math.min(1, (RADIUS - distance) / 6));
    const taper = edge * edge * (3 - 2 * edge);
    // A softened denominator makes the vector field continuous at its origin.
    const strength = AMPLITUDE * pulse * Math.exp(-distance / 24) * taper / (distance + .75);
    for (let axis = 0; axis < 3; axis++) offset[axis] += delta[axis] * strength;
  }
  const magnitude = Math.hypot(...offset);
  if (!magnitude) return offset;
  // Smooth saturation bounds overlapping taps without hard clipping or jumps.
  const scale = MAX_OFFSET * Math.tanh(magnitude / MAX_OFFSET) / magnitude;
  return offset.map(value => value * scale);
}
