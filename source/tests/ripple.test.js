import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRippleState, emitRipple, advanceRipples, deformRipplePoint, hasRipple, MAX_RIPPLES, RIPPLE_DURATION, MAX_RIPPLE_DISPLACEMENT} from '../src/ripple.js';

const zero = [0, 0, 0];
const displacement = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const tap = (ripples, serial = 1, origin = zero, now = ripples.elapsed, options) => emitRipple(ripples, {serial, origin}, now, options);

test('a tap deforms only the exact serial, starts at rest and returns exactly home', () => {
  const ripples = createRippleState(), local = [.35, .1, 0];
  assert.deepEqual(deformRipplePoint(undefined, 1, local), local);
  assert.equal(hasRipple(ripples, 1), false);
  assert.equal(tap(ripples), true);
  assert.equal(hasRipple(ripples, 1), true);
  assert.equal(hasRipple(ripples, 2), false);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  advanceRipples(ripples, 2);
  assert.ok(displacement(deformRipplePoint(ripples, 1, local), local) > .1);
  for (const serial of [0, 2, 10, 99999, undefined]) assert.deepEqual(deformRipplePoint(ripples, serial, local), local);
  assert.equal(advanceRipples(ripples, RIPPLE_DURATION), true);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  assert.equal(ripples.waves.length, 0);
  assert.equal(hasRipple(ripples, 1), false);
  assert.equal(advanceRipples(ripples, .1), false);
});

test('the local wave front spreads outward and each vertex gathers by 4.8 seconds', () => {
  const ripples = createRippleState(), near = [.1, 0, 0], far = [1, 0, 0];
  tap(ripples);
  advanceRipples(ripples, .3);
  assert.ok(displacement(deformRipplePoint(ripples, 1, near), near) > 0);
  assert.deepEqual(deformRipplePoint(ripples, 1, far), far);
  advanceRipples(ripples, 2.2);
  const largest = displacement(deformRipplePoint(ripples, 1, far), far);
  assert.ok(largest > .3);
  advanceRipples(ripples, 1.8);
  assert.ok(displacement(deformRipplePoint(ripples, 1, far), far) < largest * .2);
  advanceRipples(ripples, .5);
  assert.deepEqual(deformRipplePoint(ripples, 1, far), far);
  assert.ok(RIPPLE_DURATION >= 4 && RIPPLE_DURATION <= 5);
});

test('point deformation is deterministic, bounded, radial, and does not change source coordinates or state', () => {
  const ripples = createRippleState(), origin = [.1, -.2, .3];
  tap(ripples, 11, origin);
  advanceRipples(ripples, 2);
  const local = [.3, 0, .5], before = JSON.stringify(ripples);
  const deformed = deformRipplePoint(ripples, 11, local);
  const offset = deformed.map((value, axis) => value - local[axis]);
  assert.ok(offset[0] > 0);
  assert.ok(Math.abs(offset[0] - offset[1]) < 1e-12);
  assert.ok(Math.abs(offset[1] - offset[2]) < 1e-12);
  const reflected = [-.1, -.4, .1];
  const inverse = deformRipplePoint(ripples, 11, reflected).map((value, axis) => value - reflected[axis]);
  offset.forEach((value, axis) => assert.ok(Math.abs(value + inverse[axis]) < 1e-12));
  assert.deepEqual(deformRipplePoint(ripples, 11, local), deformed);
  assert.deepEqual(deformRipplePoint(ripples, 11, origin), origin);
  assert.equal(JSON.stringify(ripples), before);
  assert.deepEqual(local, [.3, 0, .5]);
  for (const distance of [.001, .1, 1, 10, 1e6]) {
    const p = [distance, .2, -.3], result = deformRipplePoint(ripples, 11, p);
    assert.ok(result.every(Number.isFinite));
    assert.ok(displacement(result, p) < MAX_RIPPLE_DISPLACEMENT);
  }
});

test('front, tail, and clicked origin join continuously with no coordinate discontinuity', () => {
  const local = [.4, 0, 0];
  const arrival = 1.35 * (1 - Math.exp(-.4 / .9));
  for (const time of [arrival, RIPPLE_DURATION]) {
    const values = [time - 1e-6, time, time + 1e-6].map(elapsed => {
      const ripples = createRippleState(); tap(ripples); advanceRipples(ripples, elapsed);
      return displacement(deformRipplePoint(ripples, 1, local), local);
    });
    assert.ok(values.every(value => value < 1e-9));
  }
  const ripples = createRippleState(); tap(ripples); advanceRipples(ripples, 2);
  assert.ok(displacement(deformRipplePoint(ripples, 1, [1e-8, 0, 0]), zero) < 1e-7);
});

test('repeated taps and target overflow are bounded without resetting or evicting moving targets', () => {
  const ripples = createRippleState();
  for (let serial = 1; serial <= MAX_RIPPLES; serial++) assert.equal(tap(ripples, serial), true);
  advanceRipples(ripples, 2);
  const before = JSON.stringify(ripples), pointBefore = deformRipplePoint(ripples, 1, [.4, 0, 0]);
  for (let i = 0; i < 100; i++) {
    assert.equal(tap(ripples, 1, [.2, 0, 0]), false);
    assert.equal(tap(ripples, MAX_RIPPLES + i + 1), false);
  }
  assert.equal(ripples.waves.length, MAX_RIPPLES);
  assert.equal(JSON.stringify(ripples), before);
  assert.deepEqual(deformRipplePoint(ripples, 1, [.4, 0, 0]), pointBefore);
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.equal(tap(ripples, 1), true);
  assert.equal(ripples.waves.length, 1);
});

test('archive pause permits a finite user response and reduced motion suppresses deformation', () => {
  const ripples = createRippleState(), local = [.4, 0, 0];
  tap(ripples);
  assert.equal(advanceRipples(ripples, 2, {paused: true}), true);
  assert.ok(displacement(deformRipplePoint(ripples, 1, local), local) > 0);
  advanceRipples(ripples, RIPPLE_DURATION, {paused: true});
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  assert.equal(tap(ripples, 1, zero, ripples.elapsed, {reducedMotion: true}), false);
  assert.equal(ripples.waves.length, 0);
  tap(ripples); advanceRipples(ripples, 1);
  assert.equal(advanceRipples(ripples, 0, {reducedMotion: true}), true);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  assert.equal(ripples.waves.length, 0);
});

test('deformation always uses this frame coordinates, never an old captured shape or pose', () => {
  const ripples = createRippleState(); tap(ripples); advanceRipples(ripples, 2);
  const newerPoint = [.08, -.06, .02], newerDeformed = deformRipplePoint(ripples, 1, newerPoint);
  assert.notDeepEqual(newerDeformed, newerPoint);
  assert.deepEqual(deformRipplePoint(ripples, 1, newerPoint), newerDeformed);
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.deepEqual(deformRipplePoint(ripples, 1, newerPoint), newerPoint);
});

test('clock is frame-rate independent, origins are copied, and malformed targets cannot poison it', () => {
  const a = createRippleState(), b = createRippleState();
  tap(a, 1, zero, 12); tap(b, 1, zero, 12);
  advanceRipples(a, 2);
  for (let i = 0; i < 20; i++) advanceRipples(b, .1);
  const p = [.4, 0, 0];
  assert.ok(displacement(deformRipplePoint(a, 1, p), deformRipplePoint(b, 1, p)) < 1e-10);
  const before = JSON.stringify(a);
  for (const dt of [0, -1, Infinity, NaN]) assert.equal(advanceRipples(a, dt), false);
  for (const origin of [[NaN, 0, 0], [1, 2], null]) assert.equal(tap(a, 2, origin), false);
  for (const serial of [undefined, null, NaN, Infinity, -1, '1', .5]) assert.equal(tap(a, serial), false);
  for (const target of [undefined, null, zero]) assert.equal(emitRipple(a, target), false);
  assert.equal(tap(a, 2, zero, NaN), false);
  assert.equal(JSON.stringify(a), before);
  const invalid = [NaN, 0, 0];
  assert.deepEqual(deformRipplePoint(a, 1, invalid), invalid);
  const origin = [1, 2, 3]; tap(a, 2, origin, 0); origin[0] = 100;
  assert.deepEqual(a.waves.at(-1).origin, [1, 2, 3]);
  assert.equal(a.waves.at(-1).started, a.elapsed);
  const out = [0, 0, 0];
  assert.equal(deformRipplePoint(a, 1, p, out), out);
  assert.deepEqual(out, deformRipplePoint(a, 1, p));
});
