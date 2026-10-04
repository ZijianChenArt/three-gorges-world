import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRippleState,emitRipple,advanceRipples} from '../src/ripple.js';
import {chromaticFringes,MAX_PULSE_SEGMENTS} from '../src/chromatic-pulse.js';
import {StrokeRenderer} from '../src/stroke-renderer.js';
const curves=[{local:[[.1,0,0],[.3,0,0],[.6,0,0]],points:[[.1,0,0],[.3,0,0],[.6,0,0]],alpha:1}];
test('chromatic fringes originate on the picked model curves within33ms and disappear under a second',()=>{const s=createRippleState();emitRipple(s,{serial:7,origin:[0,0,0]});assert.deepEqual(chromaticFringes(curves,s,7),[]);advanceRipples(s,.033);const active=chromaticFringes(curves,s,7);assert.ok(active.length>=2);assert.ok(active.every(c=>c.chromatic&&c.points.length===2&&c.alpha>0));assert.deepEqual(chromaticFringes(curves,s,8),[]);assert.deepEqual(chromaticFringes([],s,7),[]);advanceRipples(s,.8);assert.deepEqual(chromaticFringes(curves,s,7),[]);});
test('spectral layer has bounded segment count, respects source transforms and contains no points',()=>{const s=createRippleState();emitRipple(s,{serial:7,origin:[0,0,0]});advanceRipples(s,.033);const f=chromaticFringes(Array(500).fill(curves[0]),s,7,p=>p.map(x=>x*2+3));assert.equal(f.length,MAX_PULSE_SEGMENTS*2);for(const c of f)c.points.forEach((p,i)=>assert.deepEqual(p,c.local[i].map(x=>x*2+3)));const scene=new THREE.Scene(),r=new StrokeRenderer(scene);r.update([{curves:f}]);assert.equal(r.renderedSegments,f.length);assert.equal(r.renderedPoints,0);assert.ok(scene.children.every(o=>!o.isPoints));assert.notEqual(r.lineColors[0],r.lineColors[1]);r.dispose();});
