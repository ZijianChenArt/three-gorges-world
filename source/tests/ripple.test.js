import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRippleState, emitRipple, advanceRipples, rippleOffset, MAX_RIPPLES, RIPPLE_DURATION} from '../src/ripple.js';

const zero = [0, 0, 0];
const magnitude = p => Math.hypot(...p);

test('a tap begins at rest, travels through space, and returns exactly home', () => {
  const ripples = createRippleState();
  assert.deepEqual(rippleOffset(undefined, [4, 0, 0]), zero);
  assert.deepEqual(rippleOffset(ripples, [4, 0, 0]), zero);
  assert.equal(emitRipple(ripples, zero, 0), true);
  assert.deepEqual(rippleOffset(ripples, [4, 0, 0]), zero);
  advanceRipples(ripples, .3);
  assert.deepEqual(rippleOffset(ripples, [4, 0, 0]), zero);
  advanceRipples(ripples, .7);
  const near = rippleOffset(ripples, [4, 0, 0]);
  assert.ok(near[0] > 1);
  assert.equal(near[1], 0);
  assert.equal(near[2], 0);
  assert.deepEqual(rippleOffset(ripples, [14, 0, 0]), zero);
  advanceRipples(ripples, 1.2);
  assert.deepEqual(rippleOffset(ripples, [4, 0, 0]), zero);
  assert.ok(rippleOffset(ripples, [14, 0, 0])[0] > 0);
  assert.equal(advanceRipples(ripples, RIPPLE_DURATION), true);
  assert.deepEqual(rippleOffset(ripples, [14, 0, 0]), zero);
  assert.equal(ripples.waves.length, 0);
  assert.equal(advanceRipples(ripples, .1), false);
});

test('displacement is spatially radial, symmetric, finite and deterministic', () => {
  const ripples = createRippleState();
  emitRipple(ripples, [1, 2, 3]);
  advanceRipples(ripples, 1);
  const p = [3, 4, 5], before = JSON.stringify(ripples);
  const offset = rippleOffset(ripples, p);
  assert.ok(offset[0] > 0);
  assert.ok(Math.abs(offset[0] - offset[1]) < 1e-12);
  assert.ok(Math.abs(offset[1] - offset[2]) < 1e-12);
  assert.deepEqual(rippleOffset(ripples, [-1, 0, 1]), offset.map(v => -v));
  assert.deepEqual(rippleOffset(ripples, p), offset);
  assert.deepEqual(rippleOffset(ripples, [1, 2, 3]), zero);
  assert.deepEqual(rippleOffset(ripples, [100, 2, 3]), zero);
  assert.equal(JSON.stringify(ripples), before);
  assert.deepEqual(p, [3, 4, 5]);
});

test('pulse fronts, tails and the origin have no displacement discontinuity', () => {
  for (const time of [4 / 9, 4 / 9 + 1.65]) {
    const samples = [time - 1e-6, time, time + 1e-6].map(elapsed => {
      const ripples = createRippleState();
      emitRipple(ripples, zero);
      advanceRipples(ripples, elapsed);
      return magnitude(rippleOffset(ripples, [4, 0, 0]));
    });
    assert.ok(samples.every(value => value < 1e-9));
  }
  const ripples = createRippleState();
  emitRipple(ripples, zero);
  advanceRipples(ripples, .8);
  assert.ok(magnitude(rippleOffset(ripples, [1e-8, 0, 0])) < 1e-7);
});

test('rapid taps are bounded without evicting a moving wave', () => {
  const ripples = createRippleState();
  for (let i = 0; i < MAX_RIPPLES; i++) assert.equal(emitRipple(ripples, zero), true);
  advanceRipples(ripples, 1);
  const before = rippleOffset(ripples, [4, 0, 0]);
  for (let i = 0; i < 100; i++) assert.equal(emitRipple(ripples, [5, 0, 0]), false);
  assert.equal(ripples.waves.length, MAX_RIPPLES);
  assert.deepEqual(rippleOffset(ripples, [4, 0, 0]), before);
  assert.ok(magnitude(before) > 0 && magnitude(before) < 5);
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.equal(emitRipple(ripples, zero), true);
  assert.equal(ripples.waves.length, 1);
});

test('archive pause permits a finite tap response; reduced motion suppresses it', () => {
  const ripples = createRippleState();
  emitRipple(ripples, zero);
  assert.equal(advanceRipples(ripples, 1, {paused: true}), true);
  assert.ok(magnitude(rippleOffset(ripples, [4, 0, 0])) > 0);
  advanceRipples(ripples, RIPPLE_DURATION, {paused: true});
  assert.deepEqual(rippleOffset(ripples, [4, 0, 0]), zero);
  assert.equal(emitRipple(ripples, zero, ripples.elapsed, {reducedMotion: true}), false);
  assert.equal(ripples.waves.length, 0);
  emitRipple(ripples, zero);
  advanceRipples(ripples, 1);
  assert.equal(advanceRipples(ripples, 0, {reducedMotion: true}), true);
  assert.deepEqual(rippleOffset(ripples, [4, 0, 0]), zero);
  assert.equal(ripples.waves.length, 0);
});

test('clock advance is frame-rate independent and invalid input cannot poison it', () => {
  const a = createRippleState(), b = createRippleState();
  emitRipple(a, zero, 12);
  emitRipple(b, zero, 12);
  advanceRipples(a, 1);
  for (let i = 0; i < 10; i++) advanceRipples(b, .1);
  assert.ok(Math.abs(rippleOffset(a, [4, 0, 0])[0] - rippleOffset(b, [4, 0, 0])[0]) < 1e-10);
  const before = JSON.stringify(a);
  for (const dt of [0, -1, Infinity, NaN]) assert.equal(advanceRipples(a, dt), false);
  for (const origin of [[NaN, 0, 0], [1, 2], null]) assert.equal(emitRipple(a, origin), false);
  assert.equal(emitRipple(a, zero, NaN), false);
  assert.equal(JSON.stringify(a), before);
  assert.deepEqual(rippleOffset(a, [NaN, 0, 0]), zero);
  const origin = [1, 2, 3];
  emitRipple(a, origin, 0);
  origin[0] = 100;
  assert.deepEqual(a.waves.at(-1).origin, [1, 2, 3]);
  assert.equal(a.waves.at(-1).started, a.elapsed);
});
