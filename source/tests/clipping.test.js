import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeometryClipper, clipSegmentToViewport, triangulateClippedPolygon} from '../src/clipping.js';
import {createProjector, FLIGHT_NEAR, FLIGHT_FAR} from '../src/flight-camera.js';
import {pickProjected} from '../src/picking.js';

const camera = {perspective:true,distance:2,yaw:.47,pitch:-.43,target:[0,0,0]};
const view = {scale:100,cx:100,cy:100};
const clipper = createGeometryClipper(camera,view,200,200);
const world = (x,y,depth) => [x,-y,2-depth];
const close = (actual,expected,tolerance=1e-8) => assert.ok(Math.abs(actual-expected)<tolerance, `${actual} != ${expected}`);
function bounded(primitive) {
  assert.ok(primitive);
  for(const point of primitive.screen) {
    assert.ok(point.every(Number.isFinite));
    assert.ok(point[0]>=0&&point[0]<=200&&point[1]>=0&&point[1]<=200);
    assert.ok(point.cameraDepth>=FLIGHT_NEAR&&point.cameraDepth<=FLIGHT_FAR);
    assert.ok(point.visible);
  }
  assert.ok(primitive.world.flat().every(Number.isFinite));
  assert.ok(primitive.local.flat().every(Number.isFinite));
}
const area = triangles => triangles.reduce((sum,{screen:[a,b,c]})=>sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2,0);

test('near/far crossings trim actual lines and interpolate local coordinates instead of dropping them',()=>{
  const segment=clipper.segment(world(0,0,.1),world(.2,0,1),[0,0,0],[9,18,27]);
  bounded(segment);
  close(segment.screen[0].cameraDepth,.2);
  segment.local[0].forEach((value,i)=>close(value,i+1));
  close(segment.world[0][2],1.8);
  const distant=clipper.segment(world(0,0,179),world(.2,0,181));
  bounded(distant);close(distant.screen[1].cameraDepth,180);
  assert.equal(clipper.segment(world(0,0,-1),world(0,0,.1)),null);
  assert.equal(clipper.segment(world(0,0,181),world(0,0,182)),null);
});

test('near-crossing lines and convex source faces remain continuous and finite',()=>{
  let previousLine,previousArea;
  for(const depth of [.19998,.19999,.2,.20001,.20002]) {
    const line=clipper.segment(world(.01,0,depth),world(.2,0,1));bounded(line);
    if(previousLine)close(line.screen[0][0],previousLine.screen[0][0],.01);
    previousLine=line;
    const polygon=clipper.polygon([world(0,-.02,depth),world(-.2,.1,1),world(.2,.1,1)]);
    bounded(polygon);
    const triangles=triangulateClippedPolygon(polygon);assert.ok(triangles.length);
    const nextArea=area(triangles);assert.ok(nextArea>100);
    if(previousArea)close(nextArea,previousArea,.2);
    previousArea=nextArea;
  }
});

test('a face clipped across both depth planes keeps only its real finite interior',()=>{
  const polygon=clipper.polygon([world(0,-.01,.1),world(-1,1,179),world(1,1,181)]);
  bounded(polygon);
  assert.ok(polygon.screen.length>=3&&polygon.screen.length<=9);
  for(const triangle of triangulateClippedPolygon(polygon))bounded(triangle);
  assert.equal(clipper.polygon([world(-1,0,-1),world(1,0,-1),world(0,1,-2)]),null);
});

test('side clipping bounds projection and preserves perspective-correct picking attributes',()=>{
  const local=[[0,0,0],[1,0,0],[0,1,0]];
  const polygon=clipper.polygon([world(-5,-1,.1),world(2,-1,1),world(0,2,2)],local);
  bounded(polygon);
  const triangles=triangulateClippedPolygon(polygon);assert.ok(triangles.length);
  for(const triangle of triangles){
    bounded(triangle);
    const x=triangle.screen.reduce((sum,p)=>sum+p[0],0)/3,y=triangle.screen.reduce((sum,p)=>sum+p[1],0)/3;
    const hit=pickProjected(x,y,[{serial:7,triangles:[triangle]}]);assert.equal(hit.serial,7);
    const q=createProjector(camera)(hit.world);
    close(view.cx+q[0]*view.scale,x);close(view.cy+q[1]*view.scale,y);
    assert.ok(hit.local.every(value=>value>=-1e-8));assert.ok(hit.local[0]+hit.local[1]<=1+1e-8);
  }
  const clippedLine=clipper.segment(world(-2,0,.1),world(2,0,1),[0,0,0],[1,2,3]);bounded(clippedLine);
  const hit=pickProjected(100,100,[{serial:9,curves:[clippedLine]}],{lineTolerance:1e-7});assert.equal(hit.serial,9);
  close(hit.local[1],hit.local[0]*2);close(hit.local[2],hit.local[0]*3);
  const q=createProjector(camera)(hit.world);close(view.cx+q[0]*view.scale,100);
});

test('invalid geometry is discarded and viewport lines never create nonfinite or exterior paths',()=>{
  for(const bad of[NaN,Infinity,-Infinity]){
    assert.equal(clipper.segment([bad,0,0],[0,0,0]),null);
    assert.equal(clipper.polygon([[bad,0,0],[0,1,0],[1,0,0]]),null);
    assert.equal(clipSegmentToViewport([bad,0],[0,0],200,200),null);
  }
  assert.deepEqual(clipSegmentToViewport([-1e200,100],[1e200,100],200,200),[[0,100],[200,100]]);
  assert.equal(clipSegmentToViewport([-200,-1],[-100,-1],200,200),null);
  assert.deepEqual(clipSegmentToViewport([50,-30],[50,240],200,200),[[50,0],[50,200]]);
  assert.equal(clipper.polygon([world(0,0,1),world(.1,0,1)]),null);
});

test('orthographic clipping shares the viewport and preserves affine local interpolation',()=>{
  const clip=createGeometryClipper({...camera,perspective:false},view,200,200);
  const segment=clip.segment([-2,0,0],[2,0,0],[0,0,0],[4,8,12]);bounded(segment);
  assert.deepEqual(segment.screen.map(p=>p.slice(0,2)),[[0,100],[200,100]]);
  assert.deepEqual(segment.local,[[1,2,3],[3,6,9]]);
  assert.ok(segment.screen.every(p=>p.multiplier===1));
});
