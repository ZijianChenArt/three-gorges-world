import{test}from'node:test';import assert from'node:assert/strict';import{GestureController}from'../src/gestures.js';import{createCamera,orbitCamera,panCamera,zoomCamera,resetCamera}from'../src/camera.js';
function fixture({navigation=false,holds=true}={}){const events=[],names=['tap','orbit','pan','zoom'];if(holds)names.push('holdStart','holdEnd');if(navigation)names.push('navigationStart','navigationEnd');const g=new GestureController(Object.fromEntries(names.map(k=>[k,(...a)=>{events.push([k,...a]);return true;}])));return{g,events};}
function navigationFixture(){return fixture({navigation:true,holds:false});}
test('short stationary touch is exactly one tap',()=>{const{g,events}=fixture();g.down({id:1,x:100,y:100,now:0});g.tick(100);g.up(1);assert.deepEqual(events,[['tap',100,100]]);});
test('drag rotates and does not trigger tap or hold',()=>{const{g,events}=fixture();g.down({id:1,x:100,y:100,now:0});g.move({id:1,x:140,y:120});g.tick(700);g.up(1);assert.deepEqual(events,[['orbit',40,20]]);});
test('long press gathers once and releases once',()=>{const{g,events}=fixture();g.down({id:1,x:100,y:100,now:0});g.tick(500);g.tick(700);g.up(1);assert.deepEqual(events,[['holdStart',100,100],['holdEnd']]);});
test('moving after a hold releases it and starts orbit',()=>{const{g,events}=fixture();g.down({id:1,x:100,y:100,now:0});g.tick(500);g.move({id:1,x:130,y:100});g.up(1);assert.deepEqual(events,[['holdStart',100,100],['holdEnd'],['orbit',30,0]]);});
test('second finger cancels a hold before pinch',()=>{const{g,events}=fixture();g.down({id:1,x:100,y:100,now:0});g.tick(500);g.down({id:2,x:200,y:100,now:550});g.move({id:2,x:300,y:100});assert.deepEqual(events.slice(0,2),[['holdStart',100,100],['holdEnd']]);assert.deepEqual(events.slice(2),[['pan',50,0],['zoom',2]]);});
test('remaining finger after pinch never fires a tap',()=>{const{g,events}=fixture();g.down({id:1,x:100,y:100,now:0});g.down({id:2,x:200,y:100,now:10});g.up(2);g.up(1);assert.equal(events.length,0);});
test('pointer cancellation and focus loss cannot leave gathering active',()=>{const{g,events}=fixture();g.down({id:1,x:100,y:100,now:0});g.tick(500);g.cancel();g.up(1);assert.deepEqual(events,[['holdStart',100,100],['holdEnd']]);assert.equal(g.pointers.size,0);assert.equal(g.mode,'idle');});
test('cancelled short press never ripples',()=>{const{g,events}=fixture();g.down({id:1,x:0,y:0,now:0});g.up(1,true);assert.equal(events.length,0);});
test('right drag pans instead of orbiting',()=>{const{g,events}=fixture();g.down({id:1,x:0,y:0,button:2,now:0});g.move({id:1,x:20,y:30});g.up(1);assert.deepEqual(events,[['pan',20,30]]);});
test('camera zoom, pan and pitch remain bounded and resettable',()=>{const c=createCamera();orbitCamera(c,20,10000);zoomCamera(c,100);panCamera(c,10000,-10000,320,568);assert.equal(c.pitch,1.15);assert.equal(c.zoom,2.6);assert.equal(c.panX,.48);assert.equal(c.panY,-.48);zoomCamera(c,.0001);assert.equal(c.zoom,.55);resetCamera(c);assert.deepEqual(c,createCamera());});

test('tap-only mode never loses a stationary touch to an absent hold action',()=>{const events=[],g=new GestureController({tap:(...x)=>events.push(x)});g.down({id:1,x:10,y:20,now:0});g.tick(900);g.up(1);assert.deepEqual(events,[[10,20]]);});

test('stationary and sub-threshold taps never start or end navigation',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:100,y:100});
  assert.equal(g.mode,'pending');assert.equal(g.isNavigating,false);assert.deepEqual(events,[]);
  g.move({id:1,x:103,y:104});g.move({id:1,x:106,y:100});g.tick(9000);
  assert.equal(g.isNavigating,false);assert.deepEqual(events,[]);
  g.up(1);assert.deepEqual(events,[['tap',100,100]]);assert.equal(g.isNavigating,false);
});

test('crossing six pixels starts navigation once before orbit, ending after the final release',()=>{
  const events=[];
  const g=new GestureController({
    navigationStart:()=>{assert.equal(g.isNavigating,true);events.push('start');},
    orbit:(dx,dy)=>{assert.equal(g.isNavigating,true);events.push(['orbit',dx,dy]);},
    navigationEnd:()=>{assert.equal(g.isNavigating,false);assert.equal(g.pointers.size,0);events.push('end');},
  });
  g.down({id:1,x:0,y:0});g.move({id:1,x:6,y:0});assert.deepEqual(events,[]);
  g.move({id:1,x:7,y:0});g.move({id:1,x:10,y:2});g.up(1);g.up(1);g.cancel();
  assert.deepEqual(events,['start',['orbit',1,0],['orbit',3,2],'end']);
});

test('right click remains pending and cannot tap, hold or take over navigation',()=>{
  const{g,events}=fixture({navigation:true});
  g.down({id:1,x:10,y:20,button:2});g.tick(9000);g.move({id:1,x:15,y:20});
  assert.equal(g.mode,'pending');assert.equal(g.isNavigating,false);g.up(1);
  assert.deepEqual(events,[]);
});

test('right drag starts navigation before pan only after the threshold',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:0,y:0,button:2});g.move({id:1,x:6,y:0});assert.deepEqual(events,[]);
  g.move({id:1,x:10,y:5});g.up(1);
  assert.deepEqual(events,[['navigationStart'],['pan',4,5],['navigationEnd']]);
});

test('two fingers immediately navigate, keeping one lifecycle through the remaining finger',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:100,y:100});g.down({id:2,x:200,y:100});
  assert.equal(g.isNavigating,true);assert.deepEqual(events,[['navigationStart']]);
  g.move({id:2,x:300,y:100});g.up(2);
  assert.equal(g.isNavigating,true);assert.equal(g.mode,'orbit');
  g.move({id:1,x:102,y:103});g.up(1);
  assert.deepEqual(events,[['navigationStart'],['pan',50,0],['zoom',2],['orbit',2,3],['navigationEnd']]);
});

test('adding second and third fingers to a drag cannot restart navigation or produce a ghost tap',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:0,y:0});g.move({id:1,x:10,y:0});
  g.down({id:2,x:100,y:0});g.down({id:3,x:200,y:0});
  g.up(1);g.move({id:3,x:220,y:0});g.up(2);g.up(3);
  assert.deepEqual(events,[['navigationStart'],['orbit',10,0],['pan',10,0],['zoom',1.2],['navigationEnd']]);
  assert.equal(g.isNavigating,false);assert.equal(g.mode,'idle');
});

test('cancelling one pinch pointer keeps navigation active until the last pointer is cancelled',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:0,y:0});g.down({id:2,x:100,y:0});g.up(2,true);
  assert.equal(g.isNavigating,true);g.move({id:1,x:1,y:2});g.up(1,true);g.cancel();
  assert.deepEqual(events,[['navigationStart'],['orbit',1,2],['navigationEnd']]);
});

test('focus-loss cancellation ends navigation exactly once and ignores stale releases',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:0,y:0});g.down({id:2,x:100,y:0});g.cancel();g.cancel();g.up(1);g.up(2);
  assert.deepEqual(events,[['navigationStart'],['navigationEnd']]);
  assert.equal(g.isNavigating,false);assert.equal(g.pointers.size,0);assert.equal(g.mode,'idle');
});

test('pending cancellation never creates a navigation lifecycle or a tap',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:0,y:0});g.cancel();g.up(1);g.down({id:2,x:20,y:20});g.up(2,true);
  assert.deepEqual(events,[]);assert.equal(g.isNavigating,false);
});

test('repeated tap, drag, cancellation and pinch gestures have independent navigation lifecycles',()=>{
  const{g,events}=navigationFixture();
  for(let i=0;i<3;i++){
    g.down({id:1,x:10,y:20});g.up(1);
    g.down({id:1,x:0,y:0});g.move({id:1,x:10,y:0});g.cancel();
    g.down({id:1,x:0,y:0});g.down({id:2,x:100,y:0});g.up(2);g.up(1);
  }
  assert.deepEqual(events,Array.from({length:3},()=>[
    ['tap',10,20],['navigationStart'],['orbit',10,0],['navigationEnd'],['navigationStart'],['navigationEnd'],
  ]).flat());
  assert.equal(g.isNavigating,false);
});

test('tap preserves the exact down-time hit and coordinates through sub-threshold moves',()=>{
  const{g,events}=navigationFixture();
  const hit=Object.freeze({model:Object.freeze({name:'river boat'}),localPoint:Object.freeze({x:1,y:2,z:3})});
  g.down({id:1,x:100,y:200,hit});g.move({id:1,x:103,y:202});g.move({id:1,x:99,y:198});g.tick(10000);g.up(1);
  assert.equal(events.length,1);assert.deepEqual(events[0].slice(0,3),['tap',100,200]);
  assert.equal(events[0].length,4);assert.strictEqual(events[0][3],hit);
});

test('an empty down-time hit stays null, while absent and undefined hits retain the two-argument API',()=>{
  const{g,events}=navigationFixture();
  g.down({id:1,x:10,y:20,hit:null});g.move({id:1,x:12,y:22});g.up(1);
  g.down({id:1,x:30,y:40});g.up(1);
  g.down({id:1,x:50,y:60,hit:undefined});g.up(1);
  assert.deepEqual(events,[['tap',10,20,null],['tap',30,40],['tap',50,60]]);
});

test('second finger cancels the latched tap without leaking its hit into the next gesture',()=>{
  const{g,events}=navigationFixture(),hit={model:'boat'};
  g.down({id:1,x:0,y:0,hit});g.down({id:2,x:100,y:0,hit:{model:'bridge'}});g.up(2);g.up(1);
  g.down({id:1,x:30,y:40,hit:null});g.up(1);
  assert.deepEqual(events,[['navigationStart'],['navigationEnd'],['tap',30,40,null]]);
});

test('a latched hit cannot turn a drag or cancelled pointer into a tap',()=>{
  const{g,events}=navigationFixture(),hit={model:'boat'};
  g.down({id:1,x:0,y:0,hit});g.move({id:1,x:10,y:0});g.up(1);
  g.down({id:1,x:0,y:0,hit});g.up(1,true);
  assert.deepEqual(events,[['navigationStart'],['orbit',10,0],['navigationEnd']]);
});

test('navigation callbacks are optional while the state flag stays accurate',()=>{
  const g=new GestureController();
  g.down({id:1,x:0,y:0});assert.equal(g.isNavigating,false);
  g.move({id:1,x:7,y:0});assert.equal(g.isNavigating,true);g.up(1);assert.equal(g.isNavigating,false);
  g.down({id:1,x:0,y:0});g.down({id:2,x:100,y:0});assert.equal(g.isNavigating,true);
  g.cancel();assert.equal(g.isNavigating,false);
});

test('ignored buttons and duplicate pointer downs cannot corrupt an active gesture',()=>{
  const{g,events}=navigationFixture();
  assert.equal(g.down({id:9,x:0,y:0,button:1}),false);assert.equal(g.pointers.size,0);
  assert.equal(g.down({id:1,x:10,y:20}),true);assert.equal(g.down({id:1,x:90,y:90}),false);
  g.up(9);g.move({id:9,x:10,y:20});g.up(1);
  assert.deepEqual(events,[['tap',10,20]]);
});

test('legacy hold is released before second-finger navigation starts',()=>{
  const{g,events}=fixture({navigation:true});
  g.down({id:1,x:0,y:0});g.tick(500);assert.equal(g.isNavigating,false);
  g.down({id:2,x:100,y:0});g.up(1);g.up(2);
  assert.deepEqual(events,[['holdStart',0,0],['holdEnd'],['navigationStart'],['navigationEnd']]);
});
