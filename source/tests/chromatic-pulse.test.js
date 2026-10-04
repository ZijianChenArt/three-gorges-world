import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRippleState,emitRipple,advanceRipples,RIPPLE_DURATION} from '../src/ripple.js';
import {applyPulseTint} from '../src/chromatic-pulse.js';
const make=()=>[{local:[[.1,0,0],[.3,0,0],[.6,0,0]],points:[[.1,0,0],[.3,0,0],[.6,0,0]],edge:[1,2],alpha:1}];
test('pulse colors only existing source edges without adding or displacing any geometry',()=>{const s=createRippleState(),a=make(),b=make(),before=structuredClone(a);emitRipple(s,{serial:7,origin:[0,0,0]});advanceRipples(s,.033);assert.equal(applyPulseTint(a,s,7),a);assert.equal(a.length,1);assert.deepEqual(a[0].points,before[0].points);assert.deepEqual(a[0].local,before[0].local);assert.ok(a[0].color.some(v=>v>.13));assert.deepEqual(applyPulseTint(b,s,8),before);advanceRipples(s,RIPPLE_DURATION);assert.deepEqual(applyPulseTint(a,s,7),before);});
test('empty or erased edge fields cannot create colored arcs or points',()=>{const s=createRippleState();emitRipple(s,{serial:7,origin:[0,0,0]});advanceRipples(s,.2);const empty=[];assert.equal(applyPulseTint(empty,s,7),empty);assert.deepEqual(empty,[]);});
