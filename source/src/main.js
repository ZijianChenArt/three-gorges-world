import './style.css';
import sculptureData from '../public/models/sculpture-wireframes.json';
import faceData from '../public/models/sculpture-faces.json';
import {createState,advance,summary,setBudget} from './archive.js';
import {ArchivePrint,automaticCamera} from './print-renderer.js';
import {createCamera,orbitCamera,panCamera,zoomCamera,resetCamera} from './camera.js';
import {GestureController} from './gestures.js';
import {createRippleState,emitRipple,advanceRipples} from './ripple.js';
export const PLAYBACK_RATE=1.55;
const $=s=>document.querySelector(s),canvas=$('#world'),preference=matchMedia('(prefers-reduced-motion: reduce)'),state=createState({reducedMotion:preference.matches,seed:crypto.getRandomValues(new Uint32Array(1))[0],budget:innerWidth<650?16:26,initialCount:innerWidth<650?8:12}),camera=createCamera();
state.ripples=createRippleState();
let renderer=null,backend='loading',rippleCount=0;
let last=0,lastDraw=0,lastUI=0,dirty=true,touched=-Infinity,viewTime=0,drawCost=0,lastBudgetCheck=0;
const say=t=>{$('#announcement').textContent=t;};
const touch=()=>{touched=performance.now();dirty=true;};
function updateUI(){$('#pause').textContent=state.paused?'▷':'Ⅱ';$('#pause').setAttribute('aria-label',state.paused?'播放':'暂停');$('#pause').setAttribute('aria-pressed',String(state.paused));document.body.dataset.playing=String(!state.paused);}
function resize(){if(!renderer)return;setBudget(state,backend==='webgl-pbr'?(innerWidth<650?16:26):(innerWidth<650?10:14));renderer.resize(innerWidth,$('#app').clientHeight,Math.min(devicePixelRatio||1,innerWidth<650?1.5:2));dirty=true;}
function rippleAt(x,y){const target=x===undefined?renderer?.centralTarget():renderer?.pick(x,y);if(!target)return;if(state.reducedMotion){say(`A—${target.serial}。减少动态效果已启用。`);return;}const origin=target.world.map((v,i)=>v-(i===1?.65:0));if(!emitRipple(state.ripples,origin,state.ripples.elapsed,{reducedMotion:state.reducedMotion}))return;rippleCount++;dirty=true;say(`A—${target.serial}，涟漪扩散。`);}
const gestures=new GestureController({tap:rippleAt,orbit:(dx,dy)=>{orbitCamera(camera,dx,dy);touch();},pan:(dx,dy)=>{panCamera(camera,dx,dy,innerWidth,$('#app').clientHeight);touch();},zoom:factor=>{zoomCamera(camera,factor);touch();}});
function cancelGestures(){const ids=[...gestures.pointers.keys()];gestures.cancel();for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;e.preventDefault();canvas.focus({preventScroll:true});if(gestures.down({id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,now:performance.now()}))canvas.setPointerCapture(e.pointerId);touch();});
canvas.addEventListener('pointermove',e=>{if(!gestures.pointers.has(e.pointerId))return;e.preventDefault();gestures.move({id:e.pointerId,x:e.clientX,y:e.clientY});});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{gestures.up(e.pointerId,type!=='pointerup');if(type==='pointerup'&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);dirty=true;});
// iOS copy/callout is suppressed only on the inspection stage, never on the explanation.
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('selectstart',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomCamera(camera,Math.exp(-e.deltaY*.0015));touch();},{passive:false});
canvas.addEventListener('keydown',e=>{const key=e.key,dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!dirs[key]&&!['+','=','-','Home',' ','Enter'].includes(key))return;e.preventDefault();if(dirs[key]){const[x,y]=dirs[key];if(e.shiftKey)panCamera(camera,x*24,y*24,innerWidth,$('#app').clientHeight);else orbitCamera(camera,x*12,y*12);}else if(key==='+'||key==='=')zoomCamera(camera,1.12);else if(key==='-')zoomCamera(camera,1/1.12);else if(key==='Home')resetCamera(camera);else if(key==='Enter'&&!e.repeat)rippleAt();else if(key===' '&&!e.repeat){state.paused=!state.paused;updateUI();}touch();});
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;last=performance.now();dirty=true;updateUI();say(state.paused?'程序与自动视角已暂停。仍可检查视角。':'程序继续自动运行。');});
$('#reset-view').addEventListener('click',()=>{cancelGestures();resetCamera(camera);touched=-Infinity;dirty=true;say('返回自动观察视角。');});
const about=$('#about');$('#about-open').addEventListener('click',()=>{cancelGestures();about.showModal();});for(const id of ['#about-close','#about-return'])$(id).addEventListener('click',()=>about.close());about.addEventListener('close',()=>{last=performance.now();dirty=true;});about.addEventListener('click',e=>{if(e.target===about){const r=about.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)about.close();}});
document.addEventListener('visibilitychange',()=>{cancelGestures();last=performance.now();dirty=true;});addEventListener('blur',cancelGestures);preference.addEventListener('change',e=>{state.reducedMotion=e.matches;if(e.matches){state.paused=true;updateUI();dirty=true;}});
function registry(){const frames=renderer.frames,s=summary(frames,state);$('#record-count').textContent=String(s.records);$('#edge-count').textContent=s.edges.toLocaleString('en-US');$('#point-count').textContent=String(renderer.renderedPoints||0);$('#sample-count').textContent=String(renderer.renderedSegments||0);$('#face-count').textContent=String(renderer.triangleCount??renderer.facetCount??0);
  document.body.dataset.edges=String(s.edges);document.body.dataset.records=String(s.records);document.body.dataset.phases=frames.map(f=>f.phase).join(',');document.body.dataset.present=String(s.visible);document.body.dataset.closed=String(s.closed);document.body.dataset.bundles=String(renderer.bundleCount);document.body.dataset.materials=frames.map(f=>['metal','matte','translucent','cut'][f.instance.materialIndex]).join(',');document.body.dataset.elapsed=state.elapsed.toFixed(2);document.body.dataset.budget=String(state.budget);document.body.dataset.renderer=backend;document.body.dataset.meshTriangles=String(renderer.triangleCount??0);document.body.dataset.drawGroups=String(renderer.drawGroups??0);document.body.dataset.ripples=String(state.ripples.waves.length);document.body.dataset.rippleCount=String(rippleCount);document.body.dataset.segments=String(renderer.renderedSegments||0);document.body.dataset.points=String(renderer.renderedPoints||0);
}
function frame(now){requestAnimationFrame(frame);if(!last)last=now;const dt=Math.min(1,(now-last)/1000);last=now;if(!renderer||document.hidden||about.open)return;advance(state,dt*PLAYBACK_RATE);
  if(advanceRipples(state.ripples,dt,{paused:state.paused,reducedMotion:state.reducedMotion}))dirty=true;
  const inspecting=gestures.pointers.size>0||now-touched<2400;
  if(!state.paused&&!state.reducedMotion&&!inspecting)viewTime+=dt;
  if(!inspecting&&!state.paused){const a=1-Math.exp(-dt*1.25);for(const key of ['yaw','pitch','panX','panY'])camera[key]*=1-a;camera.zoom+=(1-camera.zoom)*a;}
  const auto=automaticCamera(viewTime,innerWidth<650);renderer.camera={...auto,yaw:auto.yaw+camera.yaw,pitch:auto.pitch+camera.pitch,zoom:auto.zoom*camera.zoom,panX:camera.panX,panY:camera.panY};
  if((dirty||!state.paused)&&now-lastDraw>=1000/32){const started=performance.now();try{renderer.draw(state);}catch(error){console.warn('Renderer fallback:',error.message);useFallback('3D 渲染已中断');renderer.draw(state);}drawCost=drawCost*.9+(performance.now()-started)*.1;dirty=false;lastDraw=now;document.body.dataset.camera=[camera.yaw,camera.pitch,camera.zoom,camera.panX,camera.panY].map(v=>v.toFixed(3)).join(',');document.body.dataset.flight=[viewTime,auto.yaw,auto.pitch,auto.distance,...auto.target].map(v=>v.toFixed(3)).join(',');}
  if(now-lastBudgetCheck>8000){const base=backend==='webgl-pbr'?(innerWidth<650?16:26):(innerWidth<650?10:14);setBudget(state,drawCost>29?Math.max(innerWidth<650?6:8,state.budget-2):drawCost<14?Math.min(base,state.budget+1):state.budget);renderer.faceBudget=drawCost>24?900:innerWidth<650?1100:2100;lastBudgetCheck=now;}
  if(now-lastUI>180){registry();lastUI=now;}
}
function useFallback(reason){
  if(backend==='canvas-fallback')return;
  const old=renderer;renderer=new ArchivePrint(canvas,sculptureData.groups,faceData.groups);backend='canvas-fallback';renderer.camera=old?.camera||automaticCamera(viewTime,innerWidth<650);$('#pbr-layer').hidden=true;$('#render-mode').textContent='2D / WGL2=0';$('#render-mode').setAttribute('aria-label',`兼容线稿模式：${reason}`);document.body.dataset.renderer=backend;try{old?.dispose?.();}catch{}resize();dirty=true;
}
async function boot(){
  try{const {PbrArchive,webgl2Available}=await import('./pbr-renderer.js');
    if(webgl2Available()){renderer=await PbrArchive.create($('#pbr-layer'),canvas,sculptureData,faceData.groups,{onFailure:reason=>useFallback(reason)});backend='webgl-pbr';$('#pbr-layer').hidden=false;$('#render-mode').textContent='WGL2 / PBR';}
    else useFallback('此设备未启用 WebGL2');
  }catch(error){console.warn('PBR initialization unavailable:',error.message);useFallback('3D 渲染暂不可用');}
  if(!renderer.ctx){$('#unsupported').hidden=false;document.body.dataset.status='unsupported';return;}
  resize();updateUI();renderer.camera=automaticCamera(viewTime,innerWidth<650);try{renderer.draw(state);}catch(error){console.warn('Initial 3D draw unavailable:',error.message);useFallback('3D 渲染暂不可用');renderer.draw(state);}registry();document.body.dataset.status='ready';requestAnimationFrame(frame);
}
boot();addEventListener('resize',resize);
