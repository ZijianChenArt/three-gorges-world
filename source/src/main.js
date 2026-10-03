import './style.css';
import sculptureData from '../public/models/sculpture-wireframes.json';
import {createState,advance,phaseFor,setGather,addRipple,sourcePoint,MATERIALS} from './simulation.js';
import {Formation} from './renderer.js';
import {createCamera,orbitCamera,panCamera,zoomCamera,resetCamera} from './camera.js';
import {GestureController} from './gestures.js';
const $=selector=>document.querySelector(selector),canvas=$('#world'),preference=matchMedia('(prefers-reduced-motion: reduce)');
const seed=crypto.getRandomValues(new Uint32Array(1))[0],state=createState({reducedMotion:preference.matches,seed}),renderer=new Formation(canvas,sculptureData.groups),camera=createCamera();
renderer.camera=camera;
let last=0,lastDraw=0,dirty=true,selected=0,held=null,keyboardGather=false;
const names=['记忆孔径','共振花园','数据云','回声室','相位花'];
const say=text=>{$('#announcement').textContent=text;};
function updateUI(){$('#pause').setAttribute('aria-pressed',String(state.paused));$('#pause').innerHTML=state.paused?'播放 <span aria-hidden="true">▷</span>':'暂停 <span aria-hidden="true">Ⅱ</span>';document.body.dataset.playing=String(!state.paused);}
function resize(){renderer.resize(innerWidth,$('#app').clientHeight,Math.min(devicePixelRatio||1,innerWidth<650?1.5:2));dirty=true;}
function endGather(){if(held!==null)setGather(state,held,false);held=null;keyboardGather=false;document.body.dataset.gathering='false';dirty=true;}
function beginGather(id){endGather();selected=id;held=id;setGather(state,id,true);document.body.dataset.gathering='true';dirty=true;say(`${names[id]}的线条正在聚拢。松开后缓缓散开。`);}
function ripple(hit){if(!hit)return;selected=hit.id;addRipple(state,hit.id,hit.point);dirty=true;say(`${names[hit.id]}泛起涟漪。`);}
const gestures=new GestureController({
  orbit:(dx,dy)=>{orbitCamera(camera,dx,dy);dirty=true;},
  pan:(dx,dy)=>{panCamera(camera,dx,dy,innerWidth,$('#app').clientHeight);dirty=true;},
  zoom:factor=>{zoomCamera(camera,factor);dirty=true;},
  tap:(x,y)=>ripple(renderer.pick(x,y)),
  holdStart:(x,y)=>{const hit=renderer.pick(x,y);if(!hit)return false;beginGather(hit.id);return true;},
  holdEnd:endGather,
});
function cancelGestures(){const ids=[...gestures.pointers.keys()];gestures.cancel();endGather();for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
canvas.addEventListener('pointerdown',event=>{if(event.button!==0&&event.button!==2)return;event.preventDefault();canvas.focus({preventScroll:true});if(gestures.down({id:event.pointerId,x:event.clientX,y:event.clientY,button:event.button,now:performance.now()}))canvas.setPointerCapture(event.pointerId);dirty=true;});
canvas.addEventListener('pointermove',event=>{if(!gestures.pointers.has(event.pointerId))return;event.preventDefault();gestures.move({id:event.pointerId,x:event.clientX,y:event.clientY});});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{gestures.up(event.pointerId,type!=='pointerup');if(type==='pointerup'&&canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);dirty=true;});
// Scoped to the artwork only: prevents iOS copy/callout without disabling About text selection.
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('selectstart',event=>event.preventDefault());
canvas.addEventListener('wheel',event=>{event.preventDefault();zoomCamera(camera,Math.exp(-event.deltaY*.0015));dirty=true;},{passive:false});
canvas.addEventListener('keydown',event=>{
  const key=event.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','Enter','Escape','g','G',' '].includes(key)||/^[1-5]$/.test(key))event.preventDefault();else return;
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(directions[key]){const[x,y]=directions[key];if(event.shiftKey)panCamera(camera,x*24,y*24,innerWidth,$('#app').clientHeight);else orbitCamera(camera,x*12,y*12);}
  else if(key==='+'||key==='=')zoomCamera(camera,1.12);
  else if(key==='-')zoomCamera(camera,1/1.12);
  else if(key==='Home'){resetCamera(camera);say('视角已归位。');}
  else if(/^[1-5]$/.test(key)){selected=Number(key)-1;say(`已选取${names[selected]}。回车泛起涟漪，G 聚拢。`);}
  else if(key==='Enter'){const m=renderer.models[selected];ripple({id:selected,point:sourcePoint(m,0,m.halfY,0,state.elapsed)});}
  else if((key==='g'||key==='G')&&!event.repeat){if(keyboardGather)endGather();else{beginGather(selected);keyboardGather=true;}}
  else if(key==='Escape'){cancelGestures();}
  else if(key===' '&&!event.repeat){state.paused=!state.paused;updateUI();}
  dirty=true;
});
canvas.addEventListener('blur',()=>{if(keyboardGather)endGather();});
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;last=performance.now();dirty=true;updateUI();say(state.paused?'自动演化已暂停。仍可旋转、缩放与触碰。':'作品继续自动运行。');});
$('#reset-view').addEventListener('click',()=>{cancelGestures();resetCamera(camera);dirty=true;say('视角已归位，作品继续当前过程。');});
const about=$('#about');$('#about-open').addEventListener('click',()=>{cancelGestures();about.showModal();});
for(const id of ['#about-close','#about-return'])$(id).addEventListener('click',()=>about.close());
about.addEventListener('click',event=>{if(event.target===about){const r=about.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)about.close();}});
about.addEventListener('close',()=>{last=performance.now();dirty=true;});
document.addEventListener('visibilitychange',()=>{cancelGestures();last=performance.now();dirty=true;});
addEventListener('blur',cancelGestures);
preference.addEventListener('change',event=>{state.reducedMotion=event.matches;if(event.matches){state.paused=true;updateUI();dirty=true;}});
function frame(now){
  requestAnimationFrame(frame);if(!last)last=now;const dt=(now-last)/1000;last=now;if(document.hidden||about.open)return;
  gestures.tick(now);advance(state,dt);
  const responding=state.pulses.length>0||state.gathers.some(g=>Math.abs(g.value-g.target)>.0001);
  if((dirty||!state.paused||responding)&&now-lastDraw>=1000/36){renderer.draw(state);lastDraw=now;dirty=false;}
  document.body.dataset.phases=state.scores.map(s=>phaseFor(s,state.elapsed)).join(',');document.body.dataset.cycles=state.scores.map(s=>s.index).join(',');document.body.dataset.materials=state.scores.map(s=>MATERIALS[s.material]).join(',');document.body.dataset.camera=[camera.yaw,camera.pitch,camera.zoom,camera.panX,camera.panY].map(v=>v.toFixed(3)).join(',');document.body.dataset.pulses=String(state.pulses.length);
}
if(!renderer.ctx){$('#unsupported').hidden=false;document.body.dataset.status='unsupported';}else{resize();updateUI();renderer.draw(state);document.body.dataset.status='ready';requestAnimationFrame(frame);}
addEventListener('resize',resize);
