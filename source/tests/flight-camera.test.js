import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {automaticCamera,cameraBasis,project,createProjector,projectionParameters,MIN_FLIGHT_DISTANCE} from '../src/flight-camera.js';
import {getView} from '../src/print-renderer.js';
import {createCamera,orbitCamera} from '../src/camera.js';

const length = p => Math.hypot(...p);
const difference = (a,b) => a.map((n,i)=>n-b[i]);
const shifted = (p,axis,n) => p.map((v,i)=>v+axis[i]*n);
const screen = (p,c,w=1188,h=762) => {
  const {view} = projectionParameters(w,h,getView(w,h),c), q=project(p,c);
  return [view.cx+q[0]*view.scale,view.cy+q[1]*view.scale];
};

test('flight is deterministic and freezing elapsed time freezes the complete camera',()=>{
  for(const phone of [false,true])for(const t of [0,5,10,67.5,3600]){
    assert.deepEqual(automaticCamera(t,phone),automaticCamera(t,phone));
    assert.equal(automaticCamera(t,phone).perspective,true);
  }
});

test('frame projector snapshots camera math without per-vertex trigonometry',()=>{
  const c=automaticCamera(5),frame=createProjector(c),p=[2,1,-3],expected=project(p,c);
  assert.deepEqual(frame(p),expected);
  assert.equal(frame(p).visible,expected.visible);
  c.yaw+=.4;c.target[0]+=2;
  assert.deepEqual(frame(p),expected);
  assert.notDeepEqual(frame(p),project(p,c));
});

test('five and ten seconds produce conspicuous actual translation and model displacement',()=>{
  const point=[-3.4,.4,4];
  for(const phone of [false,true]){
    const a=automaticCamera(0,phone), start=cameraBasis(a), p=screen(point,a,phone?390:1188,phone?844:762);
    for(const t of [5,10]){
      const b=automaticCamera(t,phone), next=cameraBasis(b);
      assert.ok(length(difference(next.target,start.target))>1.5,`target moves at ${t}s`);
      assert.ok(length(difference(next.eye,start.eye))>3,`eye translates at ${t}s`);
      assert.ok(Math.hypot(...difference(screen(point,b,phone?390:1188,phone?844:762),p))>(phone?28:75),`projected model moves at ${t}s`);
    }
    assert.ok(Math.abs(automaticCamera(10,phone).distance-a.distance)>2,'dolly is visible within ten seconds');
  }
});

test('route remains smooth at frame boundaries and bounded for an hour',()=>{
  let maxEyeStep=0;
  for(const phone of [false,true])for(let t=0;t<3600;t+=.37){
    const a=automaticCamera(t,phone),b=automaticCamera(t+1/60,phone);
    assert.ok(a.distance>=16.2&&a.distance<=21.9);
    assert.ok(Math.abs(a.target[0])<=2.65&&Math.abs(a.target[2])<=2.8);
    assert.ok(Math.abs(a.yaw-b.yaw)<.002);
    assert.ok(Math.abs(a.pitch-b.pitch)<.0004);
    const eyeA=cameraBasis(a).eye,eyeB=cameraBasis(b).eye;
    maxEyeStep=Math.max(maxEyeStep,length(difference(eyeA,eyeB)));
    assert.ok(eyeA.every(Number.isFinite));
  }
  assert.ok(maxEyeStep<.055,`maximum 60fps eye step ${maxEyeStep}`);
});

test('near and far objects show different perspective parallax',()=>{
  const c={...automaticCamera(3),target:[0,0,0]},basis=cameraBasis(c);
  const center=shifted([0,0,0],basis.right,2);
  const near=shifted(center,basis.direction,5),far=shifted(center,basis.direction,-5);
  const moved={...c,target:shifted(c.target,basis.right,1)};
  const nearMotion=Math.abs(project(near,moved)[0]-project(near,c)[0]);
  const farMotion=Math.abs(project(far,moved)[0]-project(far,c)[0]);
  assert.ok(nearMotion>farMotion*1.5);
  assert.ok(project(near,c).multiplier>1&&project(far,c).multiplier<1);
});

test('projection is finite around clipping planes and enforces a safe eye distance',()=>{
  for(const distance of [-100,0,.01,18,Infinity,NaN]){
    const c={...automaticCamera(0),distance},b=cameraBasis(c);
    assert.ok(b.distance>=MIN_FLIGHT_DISTANCE);
    for(const offset of [-500,-2,-.8,0,.1,2,50]){
      const p=shifted(shifted(b.eye,b.right,1),b.direction,offset),q=project(p,c);
      assert.ok(q.every(Number.isFinite));
      assert.equal(q.visible,offset<=-b.near&&offset>=-b.far);
    }
  }
});

test('default orthographic projection and natural manual orbit signs are unchanged',()=>{
  const point=[0,0,5],c=createCamera(),before=project(point,c);
  orbitCamera(c,30,0);assert.ok(project(point,c)[0]>before[0]);
  const up=createCamera();orbitCamera(up,0,-30);assert.ok(project(point,up)[1]<before[1]);
  for(const p of [[1,2,3],[-4,2,8]]){
    const yaw=-.47,tilt=.43,x=p[0]*Math.cos(yaw)-p[2]*Math.sin(yaw),z=p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);
    const expected=[x,z*Math.sin(tilt)-p[1]*Math.cos(tilt),z*Math.cos(tilt)+p[1]*Math.sin(tilt)];
    project(p,createCamera()).forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-12));
  }
});

test('Three perspective and orthographic projections match Canvas including off-axis pan',()=>{
  for(const[w,h]of[[320,568],[390,844],[1188,762],[1440,1000]]){
    for(const base of[createCamera(),automaticCamera(0),automaticCamera(5,true),automaticCamera(10)]){
      for(const manual of[{},{yaw:-.5,pitch:.3,zoom:1.3,panX:.12,panY:-.08}]){
        const c={...base,...manual},s=projectionParameters(w,h,getView(w,h),c);
        const camera=s.perspective
          ? new THREE.PerspectiveCamera(s.fov,s.aspect,s.near,s.far)
          : new THREE.OrthographicCamera(s.left,s.right,s.top,s.bottom,s.near,s.far);
        camera.position.set(...s.eye);camera.up.set(...s.up);camera.lookAt(...s.target);
        if(s.perspective)camera.setViewOffset(...s.viewOffset);
        camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        for(const p of[[1,2,3],[-4,-1,5],[8,3,-6]]){
          const actual=new THREE.Vector3(...p).project(camera),expected=screen(p,c,w,h);
          assert.ok(Math.abs((actual.x+1)*w/2-expected[0])<1e-8);
          assert.ok(Math.abs((1-actual.y)*h/2-expected[1])<1e-8);
        }
      }
    }
  }
});
