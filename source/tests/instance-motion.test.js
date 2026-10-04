import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeInstance} from '../src/archive.js';
import {instancePose,transformPoint} from '../src/print-renderer.js';
import {matrixForPose} from '../src/pbr-renderer.js';
test('every instance slowly rotates and drifts independently after entry at a fixed camera',()=>{let seen=new Set();for(let serial=1;serial<=12;serial++){const i=makeInstance(serial,0),a=instancePose(i),b=instancePose(i,false,{elapsed:10});assert.notDeepEqual(b.position,a.position);assert.ok(Math.abs(b.angle-a.angle)>.009&&Math.abs(b.angle-a.angle)<.08);assert.ok(Math.hypot(...b.position.map((v,j)=>v-a.position[j]))<.2);seen.add((b.angle-a.angle).toFixed(5));}assert.ok(seen.size>10);});
test('instance drift stays bounded and reduced motion is static; pause uses fixed pose time',()=>{for(const phone of[false,true])for(let serial=1;serial<=12;serial++){const i=makeInstance(serial,0),a=instancePose(i,phone);for(const elapsed of[0,10,300,3600,86400]){const b=instancePose(i,phone,{elapsed});assert.ok(Math.hypot(...b.position.map((v,j)=>v-a.position[j]))<.7);assert.ok(Math.abs(b.lean-a.lean)<.077&&Math.abs(b.roll)<.071);assert.deepEqual(instancePose(i,phone,{elapsed,reducedMotion:true}),a);assert.deepEqual(b,instancePose(i,phone,{elapsed}));}}});
test('drift and multi-axis orientation are identical in actual PBR, Canvas, picking and reflection poses',()=>{for(let serial=1;serial<=12;serial++){const p=instancePose(makeInstance(serial,0),serial%2===0,{elapsed:30}),v=[.3,-.4,.8],a=transformPoint(v,p),b=new THREE.Vector3(...v).applyMatrix4(matrixForPose(p)).toArray();a.forEach((n,j)=>assert.ok(Math.abs(n-b[j])<1e-10));}});
