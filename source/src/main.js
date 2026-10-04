import './style.css';
import originalSculptureData from '../public/models/sculpture-wireframes.json';
import originalFaceData from '../public/models/sculpture-faces.json';
import {withProceduralCubes} from './procedural-cubes.js';
const {wireData:sculptureData,faceData}=withProceduralCubes(originalSculptureData,originalFaceData);
import {createState,advance,summary,setBudget} from './archive.js';
import {ArchivePrint,automaticCamera,instancePose} from './print-renderer.js';
import {orbitCamera,panCamera,zoomCamera,resetCamera} from './camera.js';
import {flightPhase} from './flight-camera.js';
import {ViewController} from './view-controller.js';
import {GestureController} from './gestures.js';
import {MATERIAL_KINDS} from './materials.js';
import {createRippleState,emitRipple,advanceRipples,beginHold,endHold,cancelHolds} from './ripple.js';
export const PLAYBACK_RATE=1.55;
const $=s=>document.querySelector(s),canvas=$('#world'),preference=matchMedia('(prefers-reduced-motion: reduce)'),state=createState({reducedMotion:preference.matches,seed:crypto.getRandomValues(new Uint32Array(1))[0],budget:innerWidth<650?16:26,initialCount:innerWidth<650?10:14,includeCubes:true}),view=new ViewController(),camera=view.manual;
state.ripples=createRippleState();state.poseTime=0;for(const i of state.instances)i.poseStarted=0;
let renderer=null,backend='loading',rippleCount=0,pointerHold=null,keyboardHold=null;
let last=0,lastDraw=0,lastUI=0,dirty=true,drawCost=0,lastBudgetCheck=0;
const say=t=>{$('#announcement').textContent=t;};
const touch=()=>{view.noteNavigation(performance.now());dirty=true;};
function routeScene(){const phone=innerWidth<650,models=renderer?.models||renderer?.overlay?.models;return{elapsed:state.elapsed,instances:state.instances.map(instance=>({...instance,...instancePose(instance,phone,{elapsed:state.poseTime}),bounds:models?.[instance.modelIndex]?.bounds}))};}
function updateUI(){document.body.dataset.playing=String(!state.paused);}
function resize(){if(!renderer)return;setBudget(state,backend==='webgl-pbr'?(innerWidth<650?16:26):(innerWidth<650?10:14));renderer.resize(innerWidth,$('#app').clientHeight,Math.min(devicePixelRatio||1,innerWidth<650?1.5:2));dirty=true;}
function rippleAt(x,y,hit){const target=hit!==undefined?hit:x===undefined?renderer?.centralTarget():renderer?.pick(x,y);if(!target||!renderer.frames.some(f=>f.serial===target.serial&&f.edgeCount>0))return;if(!emitRipple(state.ripples,{serial:target.serial,origin:target.local||[0,0,0]},state.ripples.elapsed,{reducedMotion:state.reducedMotion}))return;rippleCount++;dirty=true;say(`A—${target.serial}，${state.reducedMotion?'局部色彩提示':'涟漪扩散'}。`);}
function startLocalHold(x,y,hit){const target=hit!==undefined?hit:x===undefined?renderer?.centralTarget():renderer?.pick(x,y);if(!target||!renderer.frames.some(f=>f.serial===target.serial&&f.edgeCount>0))return null;if(!beginHold(state.ripples,{serial:target.serial,origin:target.local||[0,0,0]},state.ripples.elapsed,{reducedMotion:state.reducedMotion}))return null;dirty=true;say(`A—${target.serial}，局部吸引。`);return target.serial;}
function releasePointerHold(){if(pointerHold!==null)endHold(state.ripples,pointerHold);pointerHold=null;dirty=true;}
const gestures=new GestureController({tap:rippleAt,holdStart:(x,y,hit)=>{pointerHold=startLocalHold(x,y,hit);return pointerHold!==null;},holdEnd:releasePointerHold,navigationStart:()=>view.beginNavigation(performance.now()),navigationEnd:()=>view.endNavigation(performance.now()),orbit:(dx,dy)=>{orbitCamera(camera,dx,dy);touch();},pan:(dx,dy)=>{panCamera(camera,dx,dy,innerWidth,$('#app').clientHeight);touch();},zoom:factor=>{zoomCamera(camera,factor);touch();}});
function cancelGestures(){const ids=[...gestures.pointers.keys()];gestures.cancel();cancelHolds(state.ripples);pointerHold=keyboardHold=null;dirty=true;for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;e.preventDefault();canvas.focus({preventScroll:true});if(gestures.down({id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,now:performance.now(),hit:e.button===0&&gestures.pointers.size===0?renderer?.pick(e.clientX,e.clientY)??null:null}))canvas.setPointerCapture(e.pointerId);dirty=true;});
canvas.addEventListener('pointermove',e=>{if(!gestures.pointers.has(e.pointerId))return;e.preventDefault();gestures.move({id:e.pointerId,x:e.clientX,y:e.clientY});});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{gestures.up(e.pointerId,type!=='pointerup');if(type==='pointerup'&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);dirty=true;});
// iOS copy/callout is suppressed only on the inspection stage, never on the explanation.
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('selectstart',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomCamera(camera,Math.exp(-e.deltaY*.0015));touch();},{passive:false});
canvas.addEventListener('keydown',e=>{const key=e.key==='G'?'g':e.key,dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(key==='g'&&(e.ctrlKey||e.metaKey||e.altKey))return;if(!dirs[key]&&!['+','=','-','Home',' ','Enter','g'].includes(key))return;e.preventDefault();if(dirs[key]){const[x,y]=dirs[key];if(e.shiftKey)panCamera(camera,x*24,y*24,innerWidth,$('#app').clientHeight);else orbitCamera(camera,x*12,y*12);}else if(key==='+'||key==='=')zoomCamera(camera,1.12);else if(key==='-')zoomCamera(camera,1/1.12);else if(key==='Home')resetCamera(camera);else if(key==='Enter'&&!e.repeat)rippleAt();else if(key==='g'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)keyboardHold=startLocalHold();else if(key===' '&&!e.repeat){state.paused=!state.paused;updateUI();}if(key!=='Enter'&&key!==' '&&key!=='g')touch();else dirty=true;});
canvas.addEventListener('keyup',e=>{if(e.key.toLowerCase()!=='g')return;e.preventDefault();if(keyboardHold!==null)endHold(state.ripples,keyboardHold);keyboardHold=null;dirty=true;});
document.addEventListener('visibilitychange',()=>{cancelGestures();last=performance.now();dirty=true;});addEventListener('blur',cancelGestures);preference.addEventListener('change',e=>{state.reducedMotion=e.matches;if(e.matches){state.paused=true;updateUI();dirty=true;}});
function registry(){const frames=renderer.frames,s=summary(frames,state);$('#record-count').textContent=String(s.records);$('#edge-count').textContent=s.edges.toLocaleString('en-US');$('#sample-count').textContent=String(renderer.renderedSegments||0);$('#face-count').textContent=String(renderer.triangleCount??renderer.facetCount??0);
  document.body.dataset.edges=String(s.edges);document.body.dataset.records=String(s.records);document.body.dataset.phases=frames.map(f=>f.phase).join(',');document.body.dataset.present=String(s.visible);document.body.dataset.closed=String(s.closed);document.body.dataset.bundles=String(renderer.bundleCount);document.body.dataset.materials=frames.map(f=>MATERIAL_KINDS[f.instance.materialIndex]).join(',');document.body.dataset.elapsed=state.elapsed.toFixed(2);document.body.dataset.budget=String(state.budget);document.body.dataset.renderer=backend;document.body.dataset.meshTriangles=String(renderer.triangleCount??0);document.body.dataset.drawGroups=String(renderer.drawGroups??0);document.body.dataset.ripples=String(state.ripples.waves.length);document.body.dataset.rippleCount=String(rippleCount);document.body.dataset.rippleTargets=state.ripples.waves.map(w=>w.serial).join(',');document.body.dataset.segments=String(renderer.renderedSegments||0);document.body.dataset.points=String(renderer.renderedPoints||0);document.body.dataset.holdTargets=[pointerHold,keyboardHold].filter(v=>v!==null).join(',');
}
function frame(now){requestAnimationFrame(frame);if(!last)last=now;const dt=Math.min(1,(now-last)/1000);last=now;if(!renderer||document.hidden)return;advance(state,dt*PLAYBACK_RATE);if(!state.paused&&!state.reducedMotion)state.poseTime+=dt*PLAYBACK_RATE;for(const i of state.instances)if(i.poseStarted===undefined)i.poseStarted=state.poseTime;
  gestures.tick(now);
  if(advanceRipples(state.ripples,dt,{paused:state.paused,reducedMotion:state.reducedMotion}))dirty=true;
  renderer.camera=view.step(dt,now,{paused:state.paused,reducedMotion:state.reducedMotion,phone:innerWidth<650,scene:routeScene()});const auto=view.base;
  if((dirty||!state.paused)&&now-lastDraw>=1000/32){const started=performance.now();try{renderer.draw(state);}catch(error){console.warn('Renderer fallback:',error.message);useFallback('3D 渲染已中断');renderer.draw(state);}for(const serial of[pointerHold,keyboardHold])if(serial!==null&&!renderer.frames.some(f=>f.serial===serial&&f.edgeCount>0)){endHold(state.ripples,serial);if(pointerHold===serial)pointerHold=null;if(keyboardHold===serial)keyboardHold=null;}view.markDisplayed();drawCost=drawCost*.9+(performance.now()-started)*.1;dirty=false;lastDraw=now;document.body.dataset.camera=[camera.yaw,camera.pitch,camera.zoom,camera.panX,camera.panY].map(v=>v.toFixed(3)).join(',');document.body.dataset.flightPhase=flightPhase(view.time).phase;document.body.dataset.flight=[view.time,auto.yaw,auto.pitch,auto.distance,...auto.target].map(v=>v.toFixed(3)).join(',');}
  if(now-lastBudgetCheck>8000){const base=backend==='webgl-pbr'?(innerWidth<650?16:26):(innerWidth<650?10:14);setBudget(state,drawCost>29?Math.max(innerWidth<650?6:8,state.budget-2):drawCost<14?Math.min(base,state.budget+1):state.budget);renderer.faceBudget=drawCost>24?900:innerWidth<650?1100:2100;lastBudgetCheck=now;}
  if(now-lastUI>180){registry();lastUI=now;}
}
function useFallback(reason){
  if(backend==='canvas-fallback')return;
  const old=renderer;renderer=new ArchivePrint(canvas,sculptureData.groups,faceData.groups);backend='canvas-fallback';renderer.camera=old?.camera||automaticCamera(view.time,innerWidth<650);$('#pbr-layer').hidden=true;$('#render-mode').textContent='2D / WGL2=0';$('#render-mode').setAttribute('aria-label',`兼容线稿模式：${reason}`);document.body.dataset.renderer=backend;try{old?.dispose?.();}catch{}resize();dirty=true;
}
async function boot(){
  try{const {PbrArchive,webgl2Available}=await import('./pbr-renderer.js');
    if(webgl2Available()){renderer=await PbrArchive.create($('#pbr-layer'),canvas,sculptureData,faceData.groups,{onFailure:reason=>useFallback(reason)});backend='webgl-pbr';$('#pbr-layer').hidden=false;$('#render-mode').textContent='WGL2 / PBR';}
    else useFallback('此设备未启用 WebGL2');
  }catch(error){console.warn('PBR initialization unavailable:',error.message);useFallback('3D 渲染暂不可用');}
  if(!renderer.ctx){$('#unsupported').hidden=false;document.body.dataset.status='unsupported';return;}
  resize();updateUI();renderer.camera=view.step(0,performance.now(),{paused:state.paused,reducedMotion:state.reducedMotion,phone:innerWidth<650,scene:routeScene()});try{renderer.draw(state);}catch(error){console.warn('Initial 3D draw unavailable:',error.message);useFallback('3D 渲染暂不可用');renderer.draw(state);}view.markDisplayed();registry();document.body.dataset.status='ready';requestAnimationFrame(frame);
}
boot();addEventListener('resize',resize);
