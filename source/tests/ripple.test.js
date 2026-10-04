import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRippleState, emitRipple, advanceRipples, deformRipplePoint, hasRipple, MAX_RIPPLES, RIPPLE_DURATION, MAX_RIPPLE_DISPLACEMENT, pulseIntensity, createRippleDeformer, beginHold, endHold, cancelHolds, HOLD_ATTACK, HOLD_RELEASE, HOLD_RADIUS, MAX_PULSES_PER_TARGET, MAX_RETIRING_PULSES, PULSE_RETIRE_DURATION} from '../src/ripple.js';

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
  advanceRipples(ripples, .16);
  assert.ok(displacement(deformRipplePoint(ripples, 1, local), local) > .1);
  for (const serial of [0, 2, 10, 99999, undefined]) assert.deepEqual(deformRipplePoint(ripples, serial, local), local);
  assert.equal(advanceRipples(ripples, RIPPLE_DURATION), true);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  assert.equal(ripples.waves.length, 0);
  assert.equal(hasRipple(ripples, 1), false);
  assert.equal(advanceRipples(ripples, .1), false);
});

test('the impulse is measurable at 33ms, travels locally, and rebounds within 1.5 seconds', () => {
  const ripples = createRippleState(), near = [.1, 0, 0], far = [1, 0, 0];
  tap(ripples);
  advanceRipples(ripples, .033);
  assert.ok(displacement(deformRipplePoint(ripples, 1, near), near) > .02);
  assert.ok(pulseIntensity(ripples, 1, near) > .2);
  const footprintEdge = [.3, 0, 0];
  assert.ok(pulseIntensity(ripples, 1, footprintEdge) > .2);
  assert.ok(displacement(deformRipplePoint(ripples, 1, footprintEdge), footprintEdge) > .05);
  assert.deepEqual(deformRipplePoint(ripples, 1, far), far);
  assert.equal(pulseIntensity(ripples, 1, far), 0);
  advanceRipples(ripples, .235);
  const largest = displacement(deformRipplePoint(ripples, 1, far), far);
  assert.ok(largest > .38);
  advanceRipples(ripples, .55);
  assert.ok(displacement(deformRipplePoint(ripples, 1, far), far) < largest * .3);
  advanceRipples(ripples, RIPPLE_DURATION - ripples.elapsed);
  assert.deepEqual(deformRipplePoint(ripples, 1, far), far);
  assert.equal(pulseIntensity(ripples, 1, far), 0);
  assert.ok(RIPPLE_DURATION >= 1.3 && RIPPLE_DURATION <= 1.7);
});

test('near and far points have distinct single sharp peaks followed by a softer decay', () => {
  const points = [[.1, 0, 0], [.5, 0, 0], [1, 0, 0], [2, 0, 0]];
  const peaks = points.map(local => {
    const ripples = createRippleState(); tap(ripples);
    const samples = [];
    for (let i = 0; i < 1500; i++) {
      advanceRipples(ripples, .001);
      samples.push(pulseIntensity(ripples, 1, local));
    }
    const maximum = Math.max(...samples), peak = samples.indexOf(maximum);
    assert.ok(maximum > .999);
    assert.ok(samples.slice(0, peak).every((value, at) => value <= samples[at + 1]));
    assert.ok(samples.slice(peak).every((value, at) => at === 0 || value <= samples[peak + at - 1]));
    const onset = samples.findIndex(value => value > 0);
    const last = samples.findLastIndex(value => value > 0);
    assert.ok(peak - onset <= 29);
    assert.ok(last - peak > (peak - onset) * 8);
    assert.equal(samples.at(-1), 0);
    return peak;
  });
  for (let i = 1; i < peaks.length; i++) assert.ok(peaks[i] - peaks[i - 1] > 45);
});

test('edge tint intensity shares the radial deformation envelope and exact picked origin', () => {
  const origin = [.7, -.4, .2], local = [.8, -.4, .2];
  const ripples = createRippleState(); tap(ripples, 9, origin); advanceRipples(ripples, .033);
  const before = JSON.stringify(ripples);
  const intensity = pulseIntensity(ripples, 9, local);
  assert.ok(intensity > .2 && intensity <= 1);
  assert.equal(pulseIntensity(ripples, 10, local), 0);
  assert.equal(pulseIntensity(undefined, 9, local), 0);
  assert.equal(pulseIntensity(ripples, 9, [NaN, 0, 0]), 0);
  const expectedDistance = MAX_RIPPLE_DISPLACEMENT * intensity * .1 / (.1 + .22);
  assert.ok(Math.abs(displacement(deformRipplePoint(ripples, 9, local), local) - expectedDistance) < 1e-12);
  assert.deepEqual(deformRipplePoint(ripples, 9, origin), origin);
  assert.ok(pulseIntensity(ripples, 9, origin) > .99);
  assert.equal(pulseIntensity(ripples, 9, {x: local[0], y: local[1], z: local[2]}), intensity);
  const out = [0, 0, 0];
  createRippleDeformer(ripples, 9)(...local, out);
  assert.deepEqual(out, deformRipplePoint(ripples, 9, local));
  assert.equal(JSON.stringify(ripples), before);
});

test('point deformation is deterministic, bounded, radial, and does not change source coordinates or state', () => {
  const ripples = createRippleState(), origin = [.1, -.2, .3];
  tap(ripples, 11, origin);
  advanceRipples(ripples, .16);
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
  const arrival = .85 * (1 - Math.exp(-((.4 / 1.8) ** 2)));
  for (const time of [arrival, arrival + .65, RIPPLE_DURATION]) {
    const values = [time - 1e-6, time, time + 1e-6].map(elapsed => {
      const ripples = createRippleState(); tap(ripples); advanceRipples(ripples, elapsed);
      return displacement(deformRipplePoint(ripples, 1, local), local);
    });
    assert.ok(values.every(value => value < 2e-9));
  }
  const ripples = createRippleState(); tap(ripples); advanceRipples(ripples, .16);
  assert.ok(displacement(deformRipplePoint(ripples, 1, [1e-8, 0, 0]), zero) < 1e-7);
});

test('repeated taps are accepted while third-target overflow never evicts moving targets', () => {
  const ripples = createRippleState();
  for (let serial = 1; serial <= MAX_RIPPLES; serial++) assert.equal(tap(ripples, serial), true);
  advanceRipples(ripples, .16);
  const otherBefore = deformRipplePoint(ripples, 2, [.4, 0, 0]);
  for (let i = 0; i < 100; i++) {
    assert.equal(tap(ripples, 1, [.2, 0, 0]), true);
    assert.equal(tap(ripples, MAX_RIPPLES + i + 1), false);
  }
  assert.equal(ripples.waves.length, MAX_RIPPLES);
  assert.deepEqual(deformRipplePoint(ripples, 2, [.4, 0, 0]), otherBefore);
  assert.ok(ripples.waves[0].pulses.length <= MAX_PULSES_PER_TARGET);
  assert.ok(ripples.waves[0].retiring.length <= MAX_RETIRING_PULSES);
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.equal(tap(ripples, 1), true);
  assert.equal(ripples.waves.length, 1);
});

test('archive pause permits a finite user response and reduced motion suppresses deformation', () => {
  const ripples = createRippleState(), local = [.4, 0, 0];
  tap(ripples);
  assert.equal(advanceRipples(ripples, .16, {paused: true}), true);
  assert.ok(displacement(deformRipplePoint(ripples, 1, local), local) > 0);
  advanceRipples(ripples, RIPPLE_DURATION, {paused: true});
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  assert.equal(tap(ripples, 1, zero, ripples.elapsed, {reducedMotion: true}), true);
  advanceRipples(ripples,.08,{reducedMotion:true});assert.deepEqual(deformRipplePoint(ripples,1,local),local);assert.ok(pulseIntensity(ripples,1,local)>0);assert.equal(hasRipple(ripples,1),false);
  advanceRipples(ripples,.2,{reducedMotion:true});assert.equal(ripples.waves.length,0);
  tap(ripples); advanceRipples(ripples, .1);
  assert.equal(advanceRipples(ripples, 0, {reducedMotion: true}), true);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  assert.equal(ripples.waves.length, 0);
});

test('deformation always uses this frame coordinates, never an old captured shape or pose', () => {
  const ripples = createRippleState(); tap(ripples); advanceRipples(ripples, .16);
  const newerPoint = [.08, -.06, .02], newerDeformed = deformRipplePoint(ripples, 1, newerPoint);
  assert.notDeepEqual(newerDeformed, newerPoint);
  assert.deepEqual(deformRipplePoint(ripples, 1, newerPoint), newerDeformed);
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.deepEqual(deformRipplePoint(ripples, 1, newerPoint), newerPoint);
});

test('clock is frame-rate independent, origins are copied, and malformed targets cannot poison it', () => {
  const a = createRippleState(), b = createRippleState();
  tap(a, 1, zero, 12); tap(b, 1, zero, 12);
  advanceRipples(a, .2);
  for (let i = 0; i < 20; i++) advanceRipples(b, .01);
  const p = [.4, 0, 0];
  assert.ok(displacement(deformRipplePoint(a, 1, p), deformRipplePoint(b, 1, p)) < 1e-10);
  const before = JSON.stringify(a);
  for (const dt of [0, -1, Infinity, NaN]) assert.equal(advanceRipples(a, dt), false);
  for (const origin of [[NaN, 0, 0], [1, 2], null]) assert.equal(tap(a, 2, origin), false);
  for (const serial of [undefined, null, NaN, Infinity, -1, '1', .5]) assert.equal(emitRipple(a, {serial, origin: zero}), false);
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


test('a hold ramps in, attracts only local points on its exact target, sustains and releases at rest', () => {
  const ripples = createRippleState(), origin = [.2, -.1, .4], near = [.6, -.1, .4], far = [3, -.1, .4];
  assert.equal(beginHold(ripples, {serial: 7, origin}), true);
  origin[0] = 100;
  assert.equal(hasRipple(ripples, 7), true);
  assert.deepEqual(deformRipplePoint(ripples, 7, near), near);
  advanceRipples(ripples, HOLD_ATTACK / 2);
  const halfway = deformRipplePoint(ripples, 7, near);
  assert.ok(halfway[0] < near[0] && halfway[0] > .2);
  assert.deepEqual(deformRipplePoint(ripples, 8, near), near);
  assert.deepEqual(deformRipplePoint(ripples, 7, far), far);
  assert.equal(pulseIntensity(ripples, 7, near), 0);
  advanceRipples(ripples, HOLD_ATTACK / 2);
  const full = deformRipplePoint(ripples, 7, near);
  assert.ok(full[0] < halfway[0]);
  advanceRipples(ripples, 100, {paused: true});
  assert.deepEqual(deformRipplePoint(ripples, 7, near), full);
  assert.equal(endHold(ripples, 7), true);
  assert.deepEqual(deformRipplePoint(ripples, 7, near), full);
  assert.equal(endHold(ripples, 7), false);
  advanceRipples(ripples, HOLD_RELEASE / 2, {paused: true});
  assert.ok(displacement(deformRipplePoint(ripples, 7, near), near) < displacement(full, near));
  assert.equal(advanceRipples(ripples, HOLD_RELEASE / 2 + 1e-12, {paused: true}), true);
  assert.deepEqual(deformRipplePoint(ripples, 7, near), near);
  assert.equal(hasRipple(ripples, 7), false);
  assert.equal(ripples.waves.length, 0);
});

test('a cube face-center hold reaches its actual four corners without moving remote vertices', () => {
  const ripples = createRippleState(), origin = [0, 0, 1];
  assert.ok(HOLD_RADIUS >= 1.8);
  beginHold(ripples, {serial: 1, origin}); advanceRipples(ripples, HOLD_ATTACK);
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const result = deformRipplePoint(ripples, 1, [x, y, 1]);
    assert.ok(Math.abs(result[0]) < 1 && Math.abs(result[1]) < 1);
    assert.equal(result[2], 1);
    assert.ok(displacement(result, [x, y, 1]) > .1);
  }
  assert.deepEqual(deformRipplePoint(ripples, 1, [0, 0, -1]), [0, 0, -1]);
});

test('hold onset and release preserve an existing pulse and enforce the shared two-target cap', () => {
  const ripples = createRippleState(), local = [.5, .1, 0];
  tap(ripples); advanceRipples(ripples, .16);
  const before = deformRipplePoint(ripples, 1, local), tint = pulseIntensity(ripples, 1, local);
  assert.equal(beginHold(ripples, {serial: 1, origin: [.1, 0, 0]}), true);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), before);
  assert.equal(pulseIntensity(ripples, 1, local), tint);
  assert.equal(beginHold(ripples, {serial: 1, origin: [2, 0, 0]}), false);
  assert.equal(beginHold(ripples, {serial: 2, origin: zero}), true);
  assert.equal(beginHold(ripples, {serial: 3, origin: zero}), false);
  assert.equal(tap(ripples, 3), false);
  assert.equal(tap(ripples, 1, [.2, 0, 0]), true);
  advanceRipples(ripples, .1);
  const releasing = deformRipplePoint(ripples, 1, local);
  const pulses = ripples.waves[0].pulses.slice();
  assert.equal(cancelHolds(ripples), true); assert.equal(cancelHolds(ripples), false);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), releasing);
  assert.deepEqual(ripples.waves[0].pulses, pulses);
  advanceRipples(ripples, HOLD_RELEASE + 1e-10);
  assert.ok(pulseIntensity(ripples, 1, [1, 0, 0]) > 0);
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.equal(ripples.waves.length, 0);
});

test('early hold release and re-grab use continuous envelopes and copied fresh origins', () => {
  const ripples = createRippleState(), local = [.3, .2, 0];
  beginHold(ripples, {serial: 1, origin: zero}); advanceRipples(ripples, .08);
  const early = deformRipplePoint(ripples, 1, local);
  endHold(ripples, 1);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), early);
  advanceRipples(ripples, .06);
  const before = deformRipplePoint(ripples, 1, local), origin = [.6, .4, 0];
  assert.equal(beginHold(ripples, {serial: 1, origin}), true); origin[0] = 100;
  assert.deepEqual(deformRipplePoint(ripples, 1, local), before);
  advanceRipples(ripples, HOLD_ATTACK);
  assert.ok(deformRipplePoint(ripples, 1, local)[0] > local[0]);
  endHold(ripples); advanceRipples(ripples, HOLD_RELEASE + 1e-10);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), local);
  beginHold(ripples, {serial: 1, origin: zero}); endHold(ripples);
  advanceRipples(ripples, HOLD_RELEASE + 1e-10);
  assert.equal(ripples.waves.length, 0);
});

test('hold sampling uses current points, matches the mesh sampler and preserves collapsed coordinates', () => {
  const ripples = createRippleState(); beginHold(ripples, {serial: 1, origin: zero}); advanceRipples(ripples, .1);
  const before = JSON.stringify(ripples), sample = createRippleDeformer(ripples, 1), out = [0, 0, 0];
  for (const local of [[.6, 0, 0], [.1, .1, .1], zero, [2, 2, 2]]) {
    assert.deepEqual(sample(...local, out), deformRipplePoint(ripples, 1, local));
    assert.ok(displacement(out, local) <= MAX_RIPPLE_DISPLACEMENT + 1e-12);
    assert.deepEqual(sample(...local, out), sample(...local.slice(), [0, 0, 0]));
  }
  assert.equal(JSON.stringify(ripples), before);
  endHold(ripples); advanceRipples(ripples, HOLD_RELEASE + 1e-10);
  assert.deepEqual(deformRipplePoint(ripples, 1, [.1, .1, .1]), [.1, .1, .1]);
});

test('reduced motion suppresses holds immediately and malformed hold input cannot poison the state', () => {
  const ripples = createRippleState();
  assert.equal(beginHold(ripples, {serial: 1, origin: zero}, 0, {reducedMotion: true}), false);
  assert.equal(ripples.waves.length, 0);
  for (const target of [null, {}, {serial: -1, origin: zero}, {serial: 1, origin: [NaN, 0, 0]}]) assert.equal(beginHold(ripples, target), false);
  assert.equal(beginHold(ripples, {serial: 1, origin: zero}, NaN), false);
  beginHold(ripples, {serial: 1, origin: zero}); advanceRipples(ripples, .1);
  assert.equal(advanceRipples(ripples, 0, {reducedMotion: true}), true);
  assert.equal(ripples.waves.length, 0); assert.equal(endHold(ripples), false);
  assert.deepEqual(deformRipplePoint(ripples, 1, [.3, 0, 0]), [.3, 0, 0]);
});

test('rapid taps each retain their actual origin and timestamp with bounded finite response and no cooldown', () => {
  const ripples = createRippleState();
  for (let i = 0; i < 80; i++) {
    const origin = [(i % 3) * .3, (i % 5) * .1, 0];
    assert.equal(tap(ripples, 4, origin), true);
    const latest = ripples.waves[0].pulses.at(-1);
    assert.deepEqual(latest.origin, origin); assert.equal(latest.started, ripples.elapsed);
    origin[0] = 99; assert.notEqual(latest.origin[0], 99);
    assert.ok(ripples.waves[0].pulses.length <= MAX_PULSES_PER_TARGET);
    assert.ok(ripples.waves[0].retiring.length <= MAX_RETIRING_PULSES);
    advanceRipples(ripples, .045);
    for (const local of [[.2, 0, 0], [.6, .3, .1], [2, 1, .2]]) {
      const value = deformRipplePoint(ripples, 4, local), out = [0, 0, 0];
      assert.ok(value.every(Number.isFinite));
      assert.ok(displacement(value, local) <= MAX_RIPPLE_DISPLACEMENT + 1e-12);
      assert.deepEqual(createRippleDeformer(ripples, 4)(...local, out), value);
      assert.deepEqual(deformRipplePoint(ripples, 5, local), local);
      assert.ok(pulseIntensity(ripples, 4, local) >= 0 && pulseIntensity(ripples, 4, local) <= 1);
    }
  }
  advanceRipples(ripples, RIPPLE_DURATION);
  assert.equal(ripples.waves.length, 0);
  assert.deepEqual(deformRipplePoint(ripples, 4, [.4, .2, 0]), [.4, .2, 0]);
});

test('overflow moves an old pulse into a smooth short tail instead of jumping the current field', () => {
  const ripples = createRippleState(), local = [.8, .2, 0];
  for (let i = 0; i < MAX_PULSES_PER_TARGET; i++) { tap(ripples, 1, [i * .1, 0, 0]); advanceRipples(ripples, .04); }
  const before = deformRipplePoint(ripples, 1, local);
  tap(ripples, 1, [.3, .2, 0]);
  assert.deepEqual(deformRipplePoint(ripples, 1, local), before);
  assert.equal(ripples.waves[0].retiring.length, 1);
  advanceRipples(ripples, PULSE_RETIRE_DURATION + 1e-12);
  assert.equal(ripples.waves[0].retiring.length, 0);
});
