import './style.css';
import sculptureData from '../public/models/sculpture-wireframes.json';
import faceData from '../public/models/sculpture-faces.json';
import {createState,advance,summary,setBudget} from './archive.js';
import {ArchivePrint,automaticCamera} from './print-renderer.js';
import {createCamera,orbitCamera,panCamera,zoomCamera,resetCamera} from './camera.js';
import {GestureController} from './gestures.js';
const $=s=>document.querySelector(s),canvas=$('#world'),preference=matchMedia('(prefers-reduced-motion: reduce)'),state=createState({reducedMotion:preference.matches,seed:crypto.getRandomValues(new Uint32Array(1))[0],budget:innerWidth<650?7:14}),renderer=new ArchivePrint(canvas,sculptureData.groups,faceData.groups),camera=createCamera();
let last=0,lastDraw=0,lastUI=0,dirty=true,touched=-Infinity,viewTime=0,drawCost=0,lastBudgetCheck=0;
const say=t=>{$('#announcement').textContent=t;};
const touch=()=>{touched=performance.now();dirty=true;};
function updateUI(){$('#pause').textContent=state.paused?'播放 ▷':'暂停 Ⅱ';$('#pause').setAttribute('aria-pressed',String(state.paused));document.body.dataset.playing=String(!state.paused);}
function resize(){setBudget(state,innerWidth<650?7:14);renderer.resize(innerWidth,$('#app').clientHeight,Math.min(devicePixelRatio||1,innerWidth<650?1.5:2));dirty=true;}
const gestures=new GestureController({orbit:(dx,dy)=>{orbitCamera(camera,dx,dy);touch();},pan:(dx,dy)=>{panCamera(camera,dx,dy,innerWidth,$('#app').clientHeight);touch();},zoom:factor=>{zoomCamera(camera,factor);touch();}});
function cancelGestures(){const ids=[...gestures.pointers.keys()];gestures.cancel();for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;e.preventDefault();canvas.focus({preventScroll:true});if(gestures.down({id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,now:performance.now()}))canvas.setPointerCapture(e.pointerId);touch();});
canvas.addEventListener('pointermove',e=>{if(!gestures.pointers.has(e.pointerId))return;e.preventDefault();gestures.move({id:e.pointerId,x:e.clientX,y:e.clientY});});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{gestures.up(e.pointerId,type!=='pointerup');if(type==='pointerup'&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);dirty=true;});
// iOS copy/callout is suppressed only on the inspection stage, never on the explanation.
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('selectstart',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomCamera(camera,Math.exp(-e.deltaY*.0015));touch();},{passive:false});
canvas.addEventListener('keydown',e=>{const key=e.key,dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!dirs[key]&&!['+','=','-','Home',' '].includes(key))return;e.preventDefault();if(dirs[key]){const[x,y]=dirs[key];if(e.shiftKey)panCamera(camera,x*24,y*24,innerWidth,$('#app').clientHeight);else orbitCamera(camera,x*12,y*12);}else if(key==='+'||key==='=')zoomCamera(camera,1.12);else if(key==='-')zoomCamera(camera,1/1.12);else if(key==='Home')resetCamera(camera);else if(key===' '&&!e.repeat){state.paused=!state.paused;updateUI();}touch();});
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;last=performance.now();dirty=true;updateUI();say(state.paused?'程序与自动视角已暂停。仍可检查视角。':'程序继续自动运行。');});
$('#reset-view').addEventListener('click',()=>{cancelGestures();resetCamera(camera);touched=-Infinity;dirty=true;say('返回自动观察视角。');});
const about=$('#about');$('#about-open').addEventListener('click',()=>{cancelGestures();about.showModal();});for(const id of ['#about-close','#about-return'])$(id).addEventListener('click',()=>about.close());about.addEventListener('close',()=>{last=performance.now();dirty=true;});about.addEventListener('click',e=>{if(e.target===about){const r=about.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)about.close();}});
document.addEventListener('visibilitychange',()=>{cancelGestures();last=performance.now();dirty=true;});addEventListener('blur',cancelGestures);preference.addEventListener('change',e=>{state.reducedMotion=e.matches;if(e.matches){state.paused=true;updateUI();dirty=true;}});
function registry(){const frames=renderer.frames,s=summary(frames,state);$('#record-count').textContent=String(s.records);$('#record-count').style.fontSize=s.records<10000?'':s.records<1000000?'23px':'18px';$('#edge-count').textContent=s.edges.toLocaleString('en-US');$('#edge-count').style.fontSize=s.edges>=10000?'23px':'';$('#batch').textContent=`CONTINUOUS INTAKE / ${s.visible} PRESENT`;const active=frames.find(f=>f.phase==='quantizing');$('#operation').textContent=s.empty?'记录持续保留':active?'调入 / 粗化 / 归档':'新副本登记';$('#operation-detail').textContent=`在场 ${s.visible} / 已归档 ${s.closed}`;
  document.body.dataset.edges=String(s.edges);document.body.dataset.records=String(s.records);document.body.dataset.phases=frames.map(f=>f.phase).join(',');document.body.dataset.present=String(s.visible);document.body.dataset.closed=String(s.closed);document.body.dataset.bundles=String(renderer.bundleCount);document.body.dataset.materials=frames.map(f=>['metal','matte','translucent','cut'][f.instance.materialIndex]).join(',');document.body.dataset.elapsed=state.elapsed.toFixed(2);document.body.dataset.budget=String(state.budget);
}
function frame(now){requestAnimationFrame(frame);if(!last)last=now;const dt=Math.min(1,(now-last)/1000);last=now;if(document.hidden||about.open)return;advance(state,dt);
  const inspecting=gestures.pointers.size>0||now-touched<8000;
  if(!state.paused&&!inspecting)viewTime+=dt;
  if(!inspecting&&!state.paused){const a=1-Math.exp(-dt*.32);for(const key of ['yaw','pitch','panX','panY'])camera[key]*=1-a;camera.zoom+=(1-camera.zoom)*a;}
  const auto=automaticCamera(viewTime);renderer.camera={yaw:auto.yaw+camera.yaw,pitch:auto.pitch+camera.pitch,zoom:auto.zoom*camera.zoom,panX:camera.panX,panY:camera.panY};
  if((dirty||!state.paused)&&now-lastDraw>=1000/32){const started=performance.now();renderer.draw(state);drawCost=drawCost*.9+(performance.now()-started)*.1;dirty=false;lastDraw=now;document.body.dataset.camera=[camera.yaw,camera.pitch,camera.zoom,camera.panX,camera.panY].map(v=>v.toFixed(3)).join(',');}
  if(now-lastBudgetCheck>8000){const base=innerWidth<650?7:14;setBudget(state,drawCost>27?Math.max(4,state.budget-2):drawCost<14?Math.min(base,state.budget+1):state.budget);renderer.faceBudget=drawCost>24?900:innerWidth<650?1100:2100;lastBudgetCheck=now;}
  if(now-lastUI>180){registry();lastUI=now;}
}
if(!renderer.ctx){$('#unsupported').hidden=false;document.body.dataset.status='unsupported';}else{resize();updateUI();renderer.draw(state);registry();document.body.dataset.status='ready';requestAnimationFrame(frame);}addEventListener('resize',resize);
