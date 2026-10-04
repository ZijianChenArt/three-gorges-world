import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {automaticCamera,cameraBasis,project,createProjector,projectionParameters,MIN_FLIGHT_DISTANCE,MIN_FLIGHT_HEIGHT,FLIGHT_NEAR} from '../src/flight-camera.js';
import {getView,instancePose,transformPoint} from '../src/print-renderer.js';
import {createCamera,orbitCamera} from '../src/camera.js';
import {prepareArchive,stateAt,instanceFrame} from '../src/archive.js';

const models=prepareArchive(JSON.parse(readFileSync(new URL('../public/models/sculpture-wireframes.json',import.meta.url))).groups);
const length = p => Math.hypot(...p);
const difference = (a,b) => a.map((n,i)=>n-b[i]);
const dot = (a,b) => a.reduce((sum,n,i)=>sum+n*b[i],0);
const shifted = (p,axis,n) => p.map((v,i)=>v+axis[i]*n);
const sceneAt = (t,phone=false) => {
  const state=stateAt(t,{budget:phone?16:26,initialCount:phone?8:12});
  return {elapsed:t,instances:state.instances.map(instance=>({...instance,...instancePose(instance,phone),bounds:models[instance.modelIndex].bounds}))};
};
const corners = item => Array.from({length:8},(_,i)=>transformPoint(item.bounds.map((v,j)=>v*(i&(1<<j)?1:-1)),item));
const boundsOf = points => ({min:[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),max:[0,1,2].map(j=>Math.max(...points.map(p=>p[j])))});
const contains = (bounds,point) => point.every((n,j)=>n>=bounds.min[j]&&n<=bounds.max[j]);
const screen = (p,c,w=1188,h=762) => {
  const {view} = projectionParameters(w,h,getView(w,h),c), q=project(p,c);
  return [view.cx+q[0]*view.scale,view.cy+q[1]*view.scale];
};

test('flight is deterministic and freezing time plus its scene snapshot freezes the complete camera',()=>{
  for(const phone of [false,true])for(const t of [0,5,10,67.5,3600]){
    const scene=sceneAt(t,phone);
    assert.deepEqual(automaticCamera(t,phone,scene),automaticCamera(t,phone,scene));
    assert.deepEqual(automaticCamera(t,phone),automaticCamera(t,phone));
    assert.equal(automaticCamera(t,phone,scene).perspective,true);
  }
});

test('the actual eye enters occupied cluster bounds and threads its interior rather than circling outside',()=>{
  for(const phone of [false,true]){
    let interior=0,closest=Infinity,furthest=0;
    for(let t=0;t<=240;t+=1){
      const scene=sceneAt(t,phone),camera=automaticCamera(t,phone,scene),eye=cameraBasis(camera).eye;
      const bounds=boundsOf(scene.instances.flatMap(corners));
      if(contains(bounds,eye))interior++;
      if(t===10)assert.ok(contains(bounds,eye),'the camera has entered the cluster within ten seconds');
      const distance=Math.min(...scene.instances.map(item=>length(difference(eye,item.position))));
      closest=Math.min(closest,distance);furthest=Math.max(furthest,distance);
      assert.ok(eye[1]>-7.7,'always above the mirror');
      assert.ok(camera.distance<12,'look-ahead focus is no longer clamped outside the cluster at 14 units');
    }
    assert.ok(interior>120,`more than half the route is inside occupied xyz bounds: ${interior}/241`);
    assert.ok(closest<3.5,'passes close to real model centers');
    assert.ok(furthest-closest>3,'meaningful near/far physical dolly range');
  }
});

test('look direction anticipates the route ahead instead of locking to the scene center',()=>{
  for(const phone of [false,true]){
    const scene=sceneAt(0,phone);let forward=0,offCenter=0;
    for(let t=0;t<120;t+=.5){
      const a=cameraBasis(automaticCamera(t,phone,scene)),b=cameraBasis(automaticCamera(t+.1,phone,scene));
      const velocity=difference(b.eye,a.eye),gaze=a.direction.map(n=>-n);
      // Vertical clearance climbs can look down at the approaching objects;
      // evaluate the forward travel direction in the horizontal corridor.
      if(gaze[0]*velocity[0]+gaze[2]*velocity[2]>0)forward++;
      const toCenter=a.eye.map(n=>-n),centerLength=length(toCenter);
      if(dot(gaze,toCenter)/centerLength<.94)offCenter++;
    }
    assert.ok(forward>210,`${forward}/240 samples look in the direction of travel`);
    assert.ok(offCenter>130,'view changes independently from the group center');
  }
});

test('five seconds creates visible translation and depth-dependent perspective motion',()=>{
  for(const phone of [false,true]){
    const a=automaticCamera(0,phone,sceneAt(0,phone)),b=automaticCamera(5,phone,sceneAt(5,phone));
    const ba=cameraBasis(a),bb=cameraBasis(b),w=phone?390:1188,h=phone?844:762;
    assert.ok(length(difference(bb.eye,ba.eye))>2.5,'eye really translates through world space');
    const model=sceneAt(0,phone).instances[0].position;
    assert.ok(length(difference(screen(model,b,w,h),screen(model,a,w,h)))>(phone?25:60),'model displacement visible within five seconds');
    const near=shifted(shifted(ba.eye,ba.direction,-5),ba.right,1.3),far=shifted(shifted(ba.eye,ba.direction,-13),ba.right,1.3);
    const nearMotion=length(difference(screen(near,b,w,h),screen(near,a,w,h)));
    const farMotion=length(difference(screen(far,b,w,h),screen(far,a,w,h)));
    assert.ok(nearMotion>farMotion*1.5,`near geometry has stronger parallax: ${nearMotion}/${farMotion}`);
  }
});

test('conservative static source boxes receive clearance without pretending to test actual mesh collisions',()=>{
  for(const phone of [false,true]){
    const scene=sceneAt(0,phone);scene.instances=scene.instances.map(({started,end,...item})=>item);
    for(let t=0;t<130;t+=.25){
      const eye=cameraBasis(automaticCamera(t,phone,scene)).eye;
      for(const item of scene.instances){
        const b=boundsOf(corners(item));
        assert.ok(!contains(b,eye),`camera cannot enter source box at ${t}s, model ${item.serial}`);
        if(eye[0]>=b.min[0]&&eye[0]<=b.max[0]&&eye[2]>=b.min[2]&&eye[2]<=b.max[2]){
          assert.ok(eye[1]>=b.max[1]+.64,'roof clearance remains at least .64 world units');
        }
      }
    }
  }
});

test('route stays continuous and bounded across hour-long loops and live arrivals/retirements',()=>{
  for(const phone of [false,true]){
    let maxStep=0,maxTurn=0;
    for(let t=0;t<3600;t+=.37){
      const a=automaticCamera(t,phone),b=automaticCamera(t+1/60,phone),ba=cameraBasis(a),bb=cameraBasis(b);
      assert.ok(a.distance>=MIN_FLIGHT_DISTANCE&&a.distance<12);
      assert.ok(ba.eye.every(Number.isFinite)&&ba.eye[1]>=MIN_FLIGHT_HEIGHT);
      maxStep=Math.max(maxStep,length(difference(ba.eye,bb.eye)));
      maxTurn=Math.max(maxTurn,Math.abs(b.yaw-a.yaw),Math.abs(b.pitch-a.pitch));
      assert.ok(Math.abs(a.zoom*a.distance-(phone?17.4:12.3))<1e-10,'lens remains stable while dollying');
    }
    assert.ok(maxStep<.04,`maximum 60fps translation ${maxStep}`);
    assert.ok(maxTurn<.005,`maximum 60fps rotation ${maxTurn}`);
    for(let t=.1;t<240;t+=.47){
      const dt=.01,a=cameraBasis(automaticCamera(t-dt,phone,sceneAt(t-dt,phone))),b=cameraBasis(automaticCamera(t,phone,sceneAt(t,phone))),c=cameraBasis(automaticCamera(t+dt,phone,sceneAt(t+dt,phone)));
      const first=difference(b.eye,a.eye),second=difference(c.eye,b.eye);
      assert.ok(length(second)/dt<2.1,'new models do not jump the eye');
      assert.ok(length(difference(second,first))/(dt*dt)<7,'bounded acceleration through arrivals and retirement');
      assert.ok(length(difference(c.direction,b.direction))/dt<.3,'bounded changing look direction');
    }
  }
});

test('provided model poses influence the route and malformed inputs remain finite',()=>{
  const scene=sceneAt(0),moved={...scene,instances:scene.instances.map(item=>({...item,position:shifted(item.position,[1,0,0],6)}))};
  assert.ok(cameraBasis(automaticCamera(15,false,moved)).eye[0]-cameraBasis(automaticCamera(15,false,scene)).eye[0]>2);
  for(const t of [NaN,Infinity,-1,0])for(const scene of [undefined,{},[],{instances:[{position:[NaN,0,0]}]}]){
    const basis=cameraBasis(automaticCamera(t,false,scene));assert.ok([...basis.eye,...basis.target,basis.distance].every(Number.isFinite));
  }
});

test('desktop and phone keep actual surviving source geometry in view throughout the changing archive',()=>{
  for(const [w,h] of [[320,568],[390,844],[1188,762],[1440,1000]]){
    const phone=w<650;
    for(let t=0;t<=240;t+=3){
      const scene=sceneAt(t,phone),camera=automaticCamera(t,phone,scene),{view,fov}=projectionParameters(w,h,getView(w,h),camera);
      let visible=0,near=Infinity,far=0;
      assert.ok(fov>40&&fov<100,`comfortable finite perspective ${fov}`);
      for(const item of scene.instances){
        const frame=instanceFrame(models[item.modelIndex],item,t);if(!frame.activeEdges.length)continue;
        for(let i=0;i<frame.vertices.length;i+=23){
          const q=project(transformPoint(frame.vertices[i],item),camera);
          assert.ok(q.every(Number.isFinite));
          const x=view.cx+q[0]*view.scale,y=view.cy+q[1]*view.scale;
          if(q.visible&&x>0&&x<w&&y>view.top&&y<view.bottom){visible++;near=Math.min(near,q.cameraDepth);far=Math.max(far,q.cameraDepth);}
        }
      }
      assert.ok(visible>=5,`${w}×${h} at ${t}s contains ${visible} sampled surviving vertices`);
      assert.ok(far-near>1,'several visible geometry depths preserve a spatial scene');
    }
  }
});

test('frame projector snapshots camera math without per-vertex trigonometry',()=>{
  const c=automaticCamera(5),frame=createProjector(c),p=[2,1,-3],expected=project(p,c);
  assert.deepEqual(frame(p),expected);assert.equal(frame(p).visible,expected.visible);
  c.yaw+=.4;c.target[0]+=2;
  assert.deepEqual(frame(p),expected);assert.notDeepEqual(frame(p),project(p,c));
});

test('projection stays finite at near/far planes and manual inspection cannot dip under the mirror',()=>{
  assert.ok(FLIGHT_NEAR>=.15&&FLIGHT_NEAR<=.25);
  for(const distance of [-100,0,.01,18,Infinity,NaN]){
    const c={...automaticCamera(0),distance},b=cameraBasis(c);assert.ok(b.distance>=MIN_FLIGHT_DISTANCE);
    for(const offset of [-500,-2,-.2,0,.1,2,50]){
      const p=shifted(shifted(b.eye,b.right,1),b.direction,offset),q=project(p,c);
      assert.ok(q.every(Number.isFinite));
      // A boundary projected through floating point may fall to either side.
      if(Math.abs(offset+b.near)>1e-8)assert.equal(q.visible,offset<=-b.near&&offset>=-b.far);
    }
    for(const pitch of [-10,-1.15,0,1.15,10])assert.ok(cameraBasis({...c,pitch}).eye[1]>=MIN_FLIGHT_HEIGHT-1e-9);
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

test('Three perspective and orthographic projections match Canvas including off-axis pan and manual offsets',()=>{
  for(const[w,h]of[[320,568],[390,844],[1188,762],[1440,1000]]){
    for(const base of[createCamera(),automaticCamera(0),automaticCamera(5,true),automaticCamera(10),automaticCamera(42,true),automaticCamera(100)]){
      for(const manual of[{},{yaw:-.5,pitch:.3,zoom:1.3,panX:.12,panY:-.08}]){
        const c={...base,...manual},s=projectionParameters(w,h,getView(w,h),c);
        const camera=s.perspective
          ? new THREE.PerspectiveCamera(s.fov,s.aspect,s.near,s.far)
          : new THREE.OrthographicCamera(s.left,s.right,s.top,s.bottom,s.near,s.far);
        camera.position.set(...s.eye);camera.up.set(...s.up);camera.lookAt(...s.target);
        if(s.perspective)camera.setViewOffset(...s.viewOffset);
        camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        for(const depth of[1,3,10,30])for(const side of[-2,0,3]){
          const p=shifted(shifted(s.eye,s.direction,-depth),cameraBasis(c).right,side);
          const actual=new THREE.Vector3(...p).project(camera),expected=screen(p,c,w,h);
          assert.ok(Math.abs((actual.x+1)*w/2-expected[0])<1e-8);
          assert.ok(Math.abs((1-actual.y)*h/2-expected[1])<1e-8);
        }
      }
    }
  }
});
