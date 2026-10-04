/** Instance-local responses sampled on CURRENT geometry, never captured shapes. */
export const MAX_RIPPLES = 2;
export const RIPPLE_DURATION = 1.5;
export const MAX_RIPPLE_DISPLACEMENT = .48;
export const MAX_PULSES_PER_TARGET = 4;
export const MAX_RETIRING_PULSES = 4;
export const PULSE_RETIRE_DURATION = .08;
export const HOLD_ATTACK = .2;
export const HOLD_RELEASE = .6;
export const HOLD_RADIUS = 1.8;
const HOLD_PULL = .72;
const REDUCED_PULSE_DURATION = .22;
const FRONT_DELAY = .85;
const FRONT_DISTANCE = 1.8;
const FRONT_ATTACK = .028;
const FRONT_DECAY = RIPPLE_DURATION - FRONT_DELAY - FRONT_ATTACK;
const ORIGIN_SOFTNESS = .22;

export function createRippleState() { return {elapsed: 0, waves: []}; }

function point(value) {
  const p = value && typeof value[0] === 'number'
    ? [value[0], value[1], value[2]] : [value?.x, value?.y, value?.z];
  return p.every(Number.isFinite) ? p : null;
}
function validSerial(serial) { return Number.isSafeInteger(serial) && serial >= 0; }
function smoothstep(t) { return t * t * (3 - 2 * t); }
function pulseIsLive(pulse, elapsed) {
  return elapsed >= pulse.started && elapsed - pulse.started < (pulse.reducedMotion ? REDUCED_PULSE_DURATION : RIPPLE_DURATION)
    && (pulse.retired === undefined || elapsed - pulse.retired < PULSE_RETIRE_DURATION);
}
function holdIsLive(hold, elapsed) {
  return !!hold && elapsed >= hold.started && (hold.released === null || elapsed - hold.released < HOLD_RELEASE);
}
function targetIsLive(wave, elapsed) {
  return wave.pulses.some(pulse => pulseIsLive(pulse, elapsed)) || wave.retiring.some(pulse => pulseIsLive(pulse, elapsed))
    || holdIsLive(wave.hold, elapsed);
}
function liveWave(ripples, serial) {
  if (!validSerial(serial)) return undefined;
  return ripples?.waves?.find(wave => wave.serial === serial && targetIsLive(wave, ripples.elapsed));
}
function retire(ripples) {
  for (const wave of ripples.waves) {
    wave.pulses = wave.pulses.filter(pulse => pulseIsLive(pulse, ripples.elapsed));
    wave.retiring = wave.retiring.filter(pulse => pulseIsLive(pulse, ripples.elapsed));
    if (!holdIsLive(wave.hold, ripples.elapsed)) wave.hold = undefined;
  }
  ripples.waves = ripples.waves.filter(wave => targetIsLive(wave, ripples.elapsed));
}
function addTarget(ripples, serial, origin) {
  const wave = {serial, origin, started: ripples.elapsed, pulses: [], retiring: []};
  ripples.waves.push(wave);
  return wave;
}
function pulseWeight(pulse, elapsed) {
  return pulse.retired === undefined ? 1 : 1 - smoothstep(Math.min(1, (elapsed - pulse.retired) / PULSE_RETIRE_DURATION));
}

/** Whether this exact serial needs its temporary local vertex buffers. */
export function hasRipple(ripples, serial) {
  const wave = liveWave(ripples, serial);
  return !!wave && (holdIsLive(wave.hold, ripples.elapsed)
    || wave.pulses.some(pulse => !pulse.reducedMotion && pulseIsLive(pulse, ripples.elapsed))
    || wave.retiring.some(pulse => !pulse.reducedMotion && pulseIsLive(pulse, ripples.elapsed)));
}

/**
 * Every valid tap on a responding target starts its own origin/time immediately.
 * Four full pulses and four short retiring tails bound per-vertex work. The
 * oldest full pulse fades over 80ms instead of being replaced abruptly. Extremely
 * dense synthetic bursts can discard only an already-retiring oldest tail.
 * Two distinct targets remain the global budget; a third never evicts a target.
 */
export function emitRipple(ripples, target, nowSeconds = ripples.elapsed, {reducedMotion = false} = {}) {
  const origin = point(target?.origin), serial = target?.serial;
  if (!validSerial(serial) || !origin || !Number.isFinite(nowSeconds) || nowSeconds < 0) return false;
  ripples.elapsed = Math.max(ripples.elapsed, nowSeconds);
  retire(ripples);
  let wave = liveWave(ripples, serial);
  if (!wave) {
    if (ripples.waves.length >= MAX_RIPPLES) return false;
    wave = addTarget(ripples, serial, origin);
  }
  if (wave.pulses.length >= MAX_PULSES_PER_TARGET) {
    const retiring = wave.pulses.shift();
    retiring.retired = ripples.elapsed;
    wave.retiring.push(retiring);
    if (wave.retiring.length > MAX_RETIRING_PULSES) wave.retiring.shift();
  }
  wave.pulses.push({origin, started: ripples.elapsed, reducedMotion});
  wave.origin = origin; wave.started = ripples.elapsed;
  return true;
}

/** Holds and taps share the same target entry, so beginning a hold preserves
 * every current pulse. Re-grabs crossfade to the newly captured actual hit. */
export function beginHold(ripples, target, nowSeconds = ripples.elapsed, {reducedMotion = false} = {}) {
  const origin = point(target?.origin), serial = target?.serial;
  if (!validSerial(serial) || !origin || !Number.isFinite(nowSeconds) || nowSeconds < 0) return false;
  ripples.elapsed = Math.max(ripples.elapsed, nowSeconds);
  retire(ripples);
  if (reducedMotion) return false;
  let wave = liveWave(ripples, serial);
  const oldHold = wave?.hold;
  if (holdIsLive(oldHold, ripples.elapsed) && (oldHold.released === null || previousStrength(oldHold, ripples.elapsed) > 0)) return false;
  if (!wave) {
    if (ripples.waves.length >= MAX_RIPPLES) return false;
    wave = addTarget(ripples, serial, origin);
  }
  const previous = holdIsLive(oldHold, ripples.elapsed)
    ? {origin: oldHold.origin, strength: holdStrength(oldHold, ripples.elapsed)} : null;
  wave.hold = {origin, started: ripples.elapsed, released: null, releasedStrength: 0, previous};
  return true;
}

/** Release one serial, or every hold, without cancelling an existing pulse. */
export function endHold(ripples, serial) {
  if (serial !== undefined && !validSerial(serial)) return false;
  let changed = false;
  for (const wave of ripples?.waves ?? []) {
    const hold = wave.hold;
    if ((serial === undefined || wave.serial === serial) && holdIsLive(hold, ripples.elapsed) && hold.released === null) {
      hold.releasedStrength = holdStrength(hold, ripples.elapsed);
      hold.released = ripples.elapsed;
      changed = true;
    }
  }
  return changed;
}
export function cancelHolds(ripples) { return endHold(ripples); }

/** Archive pause does not freeze a user response. Return true on the final
 * active tick so temporary target geometry can return to its current stage. */
export function advanceRipples(ripples, dt, {paused = false, reducedMotion = false} = {}) {
  void paused;
  const active = ripples.waves.length > 0;
  if (reducedMotion) {
    for (const wave of ripples.waves) {
      wave.pulses = wave.pulses.filter(pulse => pulse.reducedMotion);
      wave.retiring = wave.retiring.filter(pulse => pulse.reducedMotion);
      wave.hold = undefined;
    }
    retire(ripples);
    if (!Number.isFinite(dt) || dt <= 0) return active;
  }
  if (!Number.isFinite(dt) || dt <= 0) return false;
  ripples.elapsed += dt;
  retire(ripples);
  return active;
}

/** Equal input coordinates remain equal; collapsed faces cannot reappear. */
export function deformRipplePoint(ripples, serial, localPoint, out = [0, 0, 0]) {
  const x = localPoint?.[0] ?? localPoint?.x, y = localPoint?.[1] ?? localPoint?.y, z = localPoint?.[2] ?? localPoint?.z;
  out[0] = x; out[1] = y; out[2] = z;
  const wave = liveWave(ripples, serial);
  if (!wave || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return out;
  const elapsed = ripples.elapsed;
  for (let i = 0; i < wave.pulses.length + wave.retiring.length; i++) {
    const pulse = i < wave.pulses.length ? wave.pulses[i] : wave.retiring[i - wave.pulses.length];
    if (!pulse.reducedMotion && pulseIsLive(pulse, elapsed)) scatterAt(pulse.origin, elapsed - pulse.started, pulseWeight(pulse, elapsed), x, y, z, out);
  }
  const hold = wave.hold;
  if (holdIsLive(hold, elapsed)) {
    attractAt(hold.origin, holdStrength(hold, elapsed), x, y, z, out);
    const previous = previousStrength(hold, elapsed);
    if (previous) attractAt(hold.previous.origin, previous, x, y, z, out);
  }
  return capDisplacement(x, y, z, out);
}

/** Snapshot field/time once for tight CPU vertex loops; capture no geometry. */
export function createRippleDeformer(ripples, serial) {
  const wave = liveWave(ripples, serial), elapsed = ripples?.elapsed ?? 0;
  const pulses = wave ? [...wave.pulses, ...wave.retiring]
    .filter(pulse => !pulse.reducedMotion && pulseIsLive(pulse, elapsed))
    .map(pulse => ({origin: pulse.origin, age: elapsed - pulse.started, weight: pulseWeight(pulse, elapsed)})) : [];
  const hold = wave && holdIsLive(wave.hold, elapsed) ? wave.hold : undefined;
  const strength = hold ? holdStrength(hold, elapsed) : 0;
  const previous = hold ? previousStrength(hold, elapsed) : 0;
  return (x, y, z, out = [0, 0, 0]) => {
    out[0] = x; out[1] = y; out[2] = z;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return out;
    for (const pulse of pulses) scatterAt(pulse.origin, pulse.age, pulse.weight, x, y, z, out);
    if (hold) {
      attractAt(hold.origin, strength, x, y, z, out);
      if (previous) attractAt(hold.previous.origin, previous, x, y, z, out);
    }
    return capDisplacement(x, y, z, out);
  };
}

/** Aggregate pulse-only tint on CURRENT geometry. A hold adds no color. */
export function pulseIntensity(ripples, serial, localPoint) {
  const wave = liveWave(ripples, serial);
  if (!wave) return 0;
  const x = localPoint?.[0] ?? localPoint?.x, y = localPoint?.[1] ?? localPoint?.y, z = localPoint?.[2] ?? localPoint?.z;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 0;
  let intensity = 0;
  for (let i = 0; i < wave.pulses.length + wave.retiring.length; i++) {
    const pulse = i < wave.pulses.length ? wave.pulses[i] : wave.retiring[i - wave.pulses.length];
    if (!pulseIsLive(pulse, ripples.elapsed)) continue;
    const distance = Math.hypot(x - pulse.origin[0], y - pulse.origin[1], z - pulse.origin[2]);
    const age = ripples.elapsed - pulse.started;
    const value = pulse.reducedMotion
      ? .42 * Math.sin(Math.PI * Math.max(0, Math.min(1, age / REDUCED_PULSE_DURATION))) ** 2 * Math.exp(-distance * distance / .28)
      : intensityAt(age, distance);
    intensity += value * pulseWeight(pulse, ripples.elapsed);
  }
  return Math.min(1, intensity);
}

function intensityAt(age, distance) {
  if (age <= 0 || age >= RIPPLE_DURATION) return 0;
  const radius = distance / FRONT_DISTANCE;
  const delay = FRONT_DELAY * (1 - Math.exp(-radius * radius));
  const sinceFront = age - delay;
  if (sinceFront <= 0 || sinceFront >= FRONT_ATTACK + FRONT_DECAY) return 0;
  if (sinceFront < FRONT_ATTACK) return smoothstep(sinceFront / FRONT_ATTACK);
  return 1 - smoothstep((sinceFront - FRONT_ATTACK) / FRONT_DECAY);
}
function scatterAt(origin, age, weight, x, y, z, out) {
  const dx = x - origin[0], dy = y - origin[1], dz = z - origin[2];
  const distance = Math.hypot(dx, dy, dz);
  if (!distance) return;
  const strength = MAX_RIPPLE_DISPLACEMENT * intensityAt(age, distance) * weight / (distance + ORIGIN_SOFTNESS);
  out[0] += dx * strength; out[1] += dy * strength; out[2] += dz * strength;
}
function holdStrength(hold, elapsed) {
  if (!holdIsLive(hold, elapsed)) return 0;
  if (hold.released !== null) return hold.releasedStrength * (1 - smoothstep(Math.min(1, (elapsed - hold.released) / HOLD_RELEASE)));
  return smoothstep(Math.min(1, (elapsed - hold.started) / HOLD_ATTACK));
}
function previousStrength(hold, elapsed) {
  if (!hold?.previous || !holdIsLive(hold, elapsed)) return 0;
  return hold.previous.strength * (1 - smoothstep(Math.min(1, (elapsed - hold.started) / HOLD_ATTACK)));
}
function attractAt(origin, strength, x, y, z, out) {
  if (!strength) return;
  const dx = origin[0] - x, dy = origin[1] - y, dz = origin[2] - z;
  const radius = Math.hypot(dx, dy, dz) / HOLD_RADIUS;
  if (radius >= 1) return;
  // Compact support and a C1 falloff leave distant vertices exactly still.
  const amount = HOLD_PULL * strength * (1 - smoothstep(radius));
  out[0] += dx * amount; out[1] += dy * amount; out[2] += dz * amount;
}

function capDisplacement(x, y, z, out) {
  // Combined responses stay inside the existing conservative mesh bounds.
  const dx = out[0] - x, dy = out[1] - y, dz = out[2] - z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance > MAX_RIPPLE_DISPLACEMENT) {
    const scale = MAX_RIPPLE_DISPLACEMENT / distance;
    out[0] = x + dx * scale; out[1] = y + dy * scale; out[2] = z + dz * scale;
  }
  return out;
}
